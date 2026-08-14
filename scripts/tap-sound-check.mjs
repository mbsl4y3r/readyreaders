/**
 * Measure the button tap tick.
 *
 *   npm run dev
 *   node scripts/tap-sound-check.mjs
 *
 * It fires on EVERY button in the game, so a grown-up in the same room hears
 * it dozens of times an hour. "Very soft" has to be a number, not an opinion:
 * this wraps the AudioContext before the game loads, records the gain envelope
 * the tick actually schedules, and compares it to the other chimes.
 */
import { launch } from './cdp.mjs';

const page = await launch();
await page.s.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__gains = [];
    const RealCtx = window.AudioContext;
    window.AudioContext = function (...a) {
      const c = new RealCtx(...a);
      const realCreateGain = c.createGain.bind(c);
      c.createGain = () => {
        const g = realCreateGain();
        const ramp = g.gain.exponentialRampToValueAtTime.bind(g.gain);
        g.gain.exponentialRampToValueAtTime = (v, t) => {
          window.__gains.push({ v, t });
          return ramp(v, t);
        };
        return g;
      };
      return c;
    };
    window.AudioContext.prototype = RealCtx.prototype;
  `,
});
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game`, { label: 'game' });
await page.tap(512, 470); // real touch on the start star: unlocks audio + leaves boot
await page.waitFor(`!window.__game.scene.isActive('boot')`, { label: 'left boot' });
await page.wait(1200);

/** Peak + duration of the envelope scheduled by one press. */
async function measure(label, fn) {
  await page.evalJS(`(() => { window.__gains.length = 0; return 1; })()`);
  await fn();
  await page.wait(500);
  const gains = await page.evalJS(`window.__gains.slice()`);
  if (gains.length === 0) return { label, fired: false };
  const peak = Math.max(...gains.map((g) => g.v));
  const span = Math.max(...gains.map((g) => g.t)) - Math.min(...gains.map((g) => g.t));
  return { label, fired: true, peak: Number(peak.toFixed(4)), spanMs: Math.round(span * 1000) };
}

// a REAL touch on a real button in the current scene
const btn = await page.evalJS(`(() => {
  const s = window.__game.scene.getScenes(true)[0];
  let f = null;
  const walk = (l) => { for (const o of l) {
    if (!f && o.input && o.input.enabled && o.width > 60) {
      let x=o.x,y=o.y,p=o.parentContainer; while(p){x+=p.x;y+=p.y;p=p.parentContainer;}
      f = { x: Math.round(x), y: Math.round(y) };
    }
    if (o.type === 'Container') walk(o.list || []);
  }};
  walk(s.children.list); return f;
})()`);
if (!btn) throw new Error('no button found to press');

const tap = await measure('button tap', () => page.tap(btn.x, btn.y));
const sparkle = await measure("chime('sparkle')", () =>
  page.evalJS(`(async () => { const a = await import('/src/services/audio.ts'); a.chime('sparkle'); return 1; })()`));

console.log(JSON.stringify({ tap, sparkle }, null, 1));

const MAX_PEAK = 0.05;
const MAX_MS = 120;
const quiet = tap.fired && tap.peak <= MAX_PEAK && tap.spanMs <= MAX_MS;
// compared against the sparkle, which is itself the quietest REWARD sound
const quieter = tap.fired && sparkle.fired && tap.peak < sparkle.peak / 3;
console.log(tap.fired ? 'PASS: every button press makes a sound' : 'FAIL: the press was silent');
console.log(quiet ? `PASS: the tick is soft and short (peak ${tap.peak} <= ${MAX_PEAK}, ${tap.spanMs}ms <= ${MAX_MS}ms)`
                  : `FAIL: too loud or too long (peak ${tap.peak}, ${tap.spanMs}ms)`);
console.log(quieter ? `PASS: well under the reward chimes (${tap.peak} vs sparkle ${sparkle.peak})`
                    : 'FAIL: the tick is not clearly quieter than the reward chimes');
await page.close();
process.exit(tap.fired && quiet && quieter ? 0 : 1);
