/**
 * NEGATIVE TEST for the iOS-interruption hang.
 *
 * Suspending an AudioContext mid-clip is exactly what Safari does when the
 * app is backgrounded or a call arrives, and a suspended context never fires
 * `onended`. Gameplay is chained off voice promises, so before the watchdog
 * this froze the round permanently.
 *
 * The test serves a REAL 0.4s wav for one clip (the repo ships no recordings,
 * so otherwise the buffer path is never exercised), starts the line, suspends
 * the context, and asserts the promise still settles — and that a plain tap
 * brings audio back afterwards.
 */
import { launch } from './cdp.mjs';

const page = await launch();

await page.s.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__ctxs = [];
    const RealCtx = window.AudioContext;
    window.AudioContext = function (...a) {
      const c = new RealCtx(...a);
      window.__ctxs.push(c);
      return c;
    };
    window.AudioContext.prototype = RealCtx.prototype;

    // a real 0.4s 8kHz mono wav, so loadClip() actually decodes something
    window.__wav = () => {
      const rate = 8000, n = Math.floor(rate * 0.4);
      const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
      str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
      v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      str(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 12) * 8000, true);
      return buf;
    };
    const realFetch = window.fetch;
    window.fetch = function (u, ...r) {
      if (String(u).includes('/audio/ui/welcome.mp3')) {
        return Promise.resolve(new Response(window.__wav(), {
          status: 200, headers: { 'content-type': 'audio/wav' },
        }));
      }
      return realFetch.call(this, u, ...r);
    };
  `,
});

await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game && window.__ctxs && window.__ctxs.length > 0`, { label: 'audio ctx' });
await page.tap(512, 470); // real touch: unlocks audio the way she would
await page.wait(600);

const script = `(async () => {
  const audio = await import('/src/services/audio.ts');
  const ctx = window.__ctxs[0];
  await ctx.resume();

  // ---- 1. a line interrupted by an iOS-style suspend must still settle ----
  const t0 = performance.now();
  const line = audio.speakUI('welcome', 'fallback text');
  await new Promise((r) => setTimeout(r, 120));   // let the clip start
  await ctx.suspend();                            // <- the interruption
  const verdict = await Promise.race([
    line.then(() => 'settled'),
    new Promise((r) => setTimeout(() => r('HUNG'), 7000)),
  ]);
  const settleMs = Math.round(performance.now() - t0);

  // ---- 2. a plain tap must bring audio back afterwards ----
  const stateWhileSuspended = ctx.state;
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const stateAfterTap = ctx.state;

  // ---- 3. a line cut off by the NEXT line must settle too ----
  const first = audio.speakUI('welcome', 'first');
  await new Promise((r) => setTimeout(r, 80));
  audio.speakUI('welcome', 'second');
  const interrupted = await Promise.race([
    first.then(() => 'settled'),
    new Promise((r) => setTimeout(() => r('HUNG'), 5000)),
  ]);

  return JSON.stringify({ verdict, settleMs, stateWhileSuspended, stateAfterTap, interrupted });
})()`;

const r = await page.s.send('Runtime.evaluate', {
  expression: script,
  awaitPromise: true,
  returnByValue: true,
});
if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1500));
const out = JSON.parse(r.result.value);

const pass =
  out.verdict === 'settled' &&
  out.interrupted === 'settled' &&
  out.stateWhileSuspended === 'suspended' &&
  out.stateAfterTap === 'running';

console.log(JSON.stringify(out, null, 2));
console.log(pass ? 'PASS: audio survives interruption and never hangs a round' : 'FAIL');
await page.close();
process.exit(pass ? 0 : 1);
