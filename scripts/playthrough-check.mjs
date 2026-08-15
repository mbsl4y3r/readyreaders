/**
 * The benchmark playthrough — plays a REAL lesson end to end by touch and
 * measures the three numbers the brief names, instead of asserting vibes:
 *
 *   Duolingo ABC   every tap acknowledged in ~100ms (input → tap-tick, page clock)
 *   Duolingo ABC   celebration exitable in under 3s (fanfare → map button live)
 *   Reading Eggs   the NEXT unopened reward is visible at session end (🎁)
 *
 *   npm run dev
 *   node scripts/playthrough-check.mjs
 *
 * The driver is deliberately dumb: it taps every enabled control in turn.
 * The game has no fail states — wrong answers wiggle and after two misses the
 * round models the answer and moves on — so a blind toddler-walk MUST still
 * reach the celebration. If it cannot, that itself is a finding.
 */
import { readFileSync } from 'node:fs';
import { launch } from './cdp.mjs';

const page = await launch();
const save = JSON.parse(readFileSync(new URL('./seed-rich.json', import.meta.url), 'utf8'));
save.lastPassDate = ''; // today's lesson is startable
await page.seed(save);
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game`, { label: 'game' });

// instrument the page clock: pointerdown time, tap-tick time, fanfare time
await page.evalJS(`(() => {
  window.__m = { taps: [], lastDown: 0, fanfareAt: 0, errors: 0 };
  window.addEventListener('pointerdown', () => { window.__m.lastDown = performance.now(); }, { capture: true, passive: true });
  return 1;
})()`);
// Simplest reliable ack signal: the press-squash tween. On gameobjectdown the
// input plugin fires chime('tap') synchronously in the same event turn, so we
// time pointerdown -> gameobjectdown handler execution.
await page.evalJS(`(() => {
  const arm = () => {
    for (const s of window.__game.scene.getScenes(true)) {
      if (s.__armed) continue; s.__armed = true;
      s.input.on('gameobjectdown', () => {
        if (window.__m.lastDown) window.__m.taps.push(performance.now() - window.__m.lastDown);
      });
    }
  };
  arm(); setInterval(arm, 500);
  return 1;
})()`);

await page.tap(512, 470); // start star
await page.waitFor(`window.__game.scene.isActive('map')`, { label: 'map' });
await page.wait(1200);

// tap the gold Lesson CTA
const cta = await page.evalJS(`(() => {
  const s = window.__game.scene.getScene('map'); let f = null;
  const walk = (l) => { for (const o of l) {
    if (!f && o.type === 'Container' && o.input && o.input.enabled) {
      let x=o.x,y=o.y,p=o.parentContainer; while(p){x+=p.x;y+=p.y;p=p.parentContainer;}
      if (o.width >= 300 && y > 600) f = { x, y };
    }
    if (o.type === 'Container') walk(o.list || []);
  }};
  walk(s.children.list); return f;
})()`);
await page.tap(cta.x, cta.y);
await page.waitFor(`window.__game.scene.isActive('session')`, { label: 'session' });

/** All tappable controls in the session scene, skipping the Home button. */
const CONTROLS = `(() => {
  const s = window.__game.scene.getScene('session');
  const out = [];
  const walk = (l, v, a) => { for (const o of l) {
    const vv = v && o.visible !== false;
    const aa = a * (typeof o.alpha === 'number' ? o.alpha : 1);
    if (o.type === 'Container') {
      if (o.input && o.input.enabled && vv && aa > 0.3) {
        let x=o.x,y=o.y,p=o.parentContainer; while(p){x+=p.x;y+=p.y;p=p.parentContainer;}
        if (!(x < 130 && y < 110)) out.push({ x: Math.round(x), y: Math.round(y) });
      }
      walk(o.list || [], vv, aa);
    }
  }};
  walk(s.children.list, true, 1);
  return out;
})()`;

// Celebration is detected by what is ON SCREEN — the "+N pearls!" award and
// the map-exit button — never by a sound fetch: the first cut watched for the
// fanfare sfx request and timed out on caching/ordering, blaming the game for
// a harness mistake. CELEB stamps page-clock times the first moment each
// marker exists, so the <3s budget is measured where she experiences it.
const CELEB = `(() => {
  const s = window.__game.scene.getScene('session');
  if (!s) return null;
  const out = { pearls: 0, exit: 0, gift: false };
  const walk = (l) => { for (const o of l) {
    if (o.type === 'Text') {
      const t = String(o.text);
      if (t.includes('pearls!')) out.pearls ||= performance.now();
      if (t.includes('🎁')) out.gift = true;
    }
    if (o.type === 'Container') {
      if (o.input && o.input.enabled &&
          (o.list || []).some((c) => c.type === 'Text' && String(c.text).includes('🗺️'))) {
        out.exit ||= performance.now();
      }
      walk(o.list || []);
    }
  }};
  walk(s.children.list);
  return out;
})()`;

const t0 = Date.now();
let celebAt = 0;
let tapCount = 0;
while (Date.now() - t0 < 420000) {
  const c = await page.evalJS(CELEB);
  if (c && c.pearls) { celebAt = c.pearls; break; }
  const inSession = await page.evalJS(`window.__game.scene.isActive('session')`);
  if (!inSession) break;
  const controls = await page.evalJS(CONTROLS);
  if (!controls || controls.length === 0) { await page.wait(600); continue; }
  for (const c2 of controls.slice(0, 6)) {
    await page.tap(c2.x, c2.y);
    tapCount++;
    await page.wait(380);
  }
}

let exitReadyMs = null;
let giftVisible = false;
if (celebAt) {
  // poll until the map-exit button is live; both stamps are page-clock
  for (let i = 0; i < 30; i++) {
    const probe = await page.evalJS(CELEB);
    if (probe.gift) giftVisible = true;
    if (probe.exit && exitReadyMs === null) exitReadyMs = probe.exit - celebAt;
    if (exitReadyMs !== null && giftVisible) break;
    await page.wait(160);
  }
}

const m = await page.evalJS(`window.__m`);
const taps = (m.taps || []).filter((t) => t >= 0 && t < 5000).sort((a, b) => a - b);
const median = taps.length ? taps[Math.floor(taps.length / 2)] : null;
const p90 = taps.length ? taps[Math.floor(taps.length * 0.9)] : null;

console.log(JSON.stringify({
  reachedCelebration: Boolean(celebAt), tapCount,
  ackMedianMs: median === null ? null : Math.round(median),
  ackP90Ms: p90 === null ? null : Math.round(p90),
  ackSamples: taps.length,
  celebrationExitMs: exitReadyMs === null ? null : Math.round(exitReadyMs),
  nextRewardVisible: giftVisible,
  consoleErrors: page.errors.filter((e) => !e.includes('404')).length,
}, null, 1));

const okAck = median !== null && median <= 100;
const okCeleb = exitReadyMs !== null && exitReadyMs <= 3000;
const okGift = giftVisible;
const okDone = Boolean(celebAt);
console.log(okDone ? 'PASS: a blind toddler-walk reached the celebration (no fail states hold)' : 'FAIL: never reached the celebration');
console.log(okAck ? `PASS: taps acknowledged in ${Math.round(median)}ms median (target 100ms)` : `FAIL: tap ack ${median}ms median`);
console.log(okCeleb ? `PASS: celebration exitable in ${Math.round(exitReadyMs)}ms (target 3000ms)` : `FAIL: exit took ${exitReadyMs}ms`);
console.log(okGift ? 'PASS: the next wrapped reward is visible at session end' : 'FAIL: no visible next reward at session end');
await page.close();
process.exit(okDone && okAck && okCeleb && okGift ? 0 : 1);
