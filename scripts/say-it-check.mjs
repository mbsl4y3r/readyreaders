/**
 * Live check for the Say-It round, driven by real touches.
 *
 *   npm run dev
 *   node scripts/say-it-check.mjs
 *
 * The load-bearing property is SILENCE. If anything speaks while the word is
 * on screen she can answer by listening instead of reading, and the round
 * measures nothing. So this watches the audio layer for the whole time the
 * word is displayed, then taps "I said it!" with a real touch and checks that
 * the word is spoken only afterwards — as a check on herself — that the
 * reward picture appears, and that it lands clear of the controls.
 *
 * Rounds are MOUNTED rather than reached by tapping through a session: the
 * queue is adaptive, so walking to a say-it round on a word that has a
 * picture is luck. Setup is deterministic; every interaction under test is
 * still a real touch on a real button.
 */
import { launch } from './cdp.mjs';

const page = await launch();
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game`, { label: 'game' });

// Watch everything the VOICE layer is asked to play (sfx and music are not voice).
await page.evalJS(`(() => {
  window.__spoken = [];
  const realFetch = window.fetch;
  window.fetch = function (u, ...r) {
    const s = String(u);
    if (s.includes('/audio/') && !s.includes('/sfx/') && !s.includes('/music/')) {
      window.__spoken.push(s.replace(/^https?:\\/\\/[^/]+/, ''));
    }
    return realFetch.call(this, u, ...r);
  };
  const ss = window.speechSynthesis;
  if (ss) {
    const realSpeak = ss.speak.bind(ss);
    ss.speak = (utt) => { window.__spoken.push('tts:' + (utt && utt.text)); return realSpeak(utt); };
  }
  return 1;
})()`);

await page.tap(512, 470); // real touch on the start star — this unlocks audio
await page.waitFor(`!window.__game.scene.isActive('boot')`, { label: 'left boot' });
await page.evalJS(`(() => { window.__game.scene.start('session', { levelId: 1 }); return 1; })()`);
await page.waitFor(`window.__game.scene.isActive('session')`, { label: 'session' });
await page.wait(600);

/** World position of the "I said it!" label, or null if no say-it is mounted. */
const FIND_BTN = `(() => {
  const s = window.__game.scene.getScene('session');
  const out = [];
  const walk = (list) => {
    for (const o of list) {
      if (o.type === 'Container') { walk(o.list || []); continue; }
      if (o.type === 'Text' && typeof o.text === 'string' && o.text.includes('I said it')) {
        let x = o.x, y = o.y, p = o.parentContainer;
        while (p) { x += p.x; y += p.y; p = p.parentContainer; }
        out.push({ x, y });
      }
    }
  };
  walk(s.children.list);
  return out[0] || null;
})()`;

/**
 * Does the reward picture overlap either control?
 *
 * Alpha and visibility must be INHERITED down the tree: a Phaser Container
 * that is hidden or faded leaves its children reading `visible: true` and
 * `alpha: 1`, so a naive walk sees buttons that are not on screen and reports
 * a clean layout no matter what. That false negative is exactly what this
 * check exists to prevent, so the walk carries both down.
 */
const OVERLAP = `(() => {
  const s = window.__game.scene.getScene('session');
  const boxes = [];
  const walk = (list, alpha, visible) => {
    for (const o of list) {
      const a = alpha * (typeof o.alpha === 'number' ? o.alpha : 1);
      const v = visible && o.visible !== false;
      if (o.type === 'Container') { walk(o.list || [], a, v); continue; }
      if (!v || a < 0.05 || typeof o.getBounds !== 'function') continue;
      const b = o.getBounds();
      if (b.width < 2 || b.height < 2) continue;
      boxes.push({ label: o.type === 'Text' ? String(o.text) : o.type, x: b.x, y: b.y, w: b.width, h: b.height });
    }
  };
  walk(s.children.list, 1, true);
  const controls = boxes.filter((b) => /said it|Sound it out/.test(b.label));
  // the reward picture: a lone emoji glyph, large, below the word card
  const pic = boxes.find((b) => [...b.label].length <= 2 && b.h > 60 && b.y > 380);
  if (!pic) return { checked: false, controlsVisible: controls.length };
  const hits = controls.filter((b) =>
    b.x < pic.x + pic.w && b.x + b.w > pic.x && b.y < pic.y + pic.h && b.y + b.h > pic.y);
  return { checked: true, pic, controlsVisible: controls.length, hits: hits.map((h) => h.label) };
})()`;

/** Mount one say-it round for a word that has a picture. */
function mount(index) {
  return page.evalJS(`(async () => {
    const { runSayIt } = await import('/src/games/say-it.ts');
    const { WORDS } = await import('/src/content/words.ts');
    const { THEMES } = await import('/src/content/themes.ts');
    const scene = window.__game.scene.getScene('session');
    const pool = WORDS.filter((w) => w.emoji && w.lesson <= 30);
    const w = pool[${index} % pool.length];
    void runSayIt(scene, { mechanic: 'say-it', wordId: w.id, realm: 'cove' }, { theme: THEMES.cove });
    return w.text;
  })()`);
}

const rounds = [];
for (let i = 0; i < 3; i++) {
  const word = await mount(i);
  await page.wait(i === 0 ? 3600 : 900); // round 0 also carries the spoken prompt
  const btn = await page.evalJS(FIND_BTN);
  if (!btn || typeof btn.x !== 'number') {
    rounds.push({ word, error: 'no I-said-it button appeared' });
    continue;
  }

  await page.evalJS(`(() => { window.__spoken.length = 0; return 1; })()`);
  await page.wait(2000); // the word is on screen — this window must be SILENT
  const duringWord = await page.evalJS(`window.__spoken.slice()`);

  await page.tap(btn.x, btn.y); // REAL touch on "I said it!"
  await page.wait(900);
  const afterTap = await page.evalJS(`window.__spoken.slice()`);
  const overlap = await page.evalJS(OVERLAP);

  rounds.push({ word, duringWord, afterTap, overlap });
  await page.wait(1200); // let the round tear itself down
}

const usable = rounds.filter((r) => !r.error);
const silent = usable.length > 0 && usable.every((r) => r.duringWord.length === 0);
const spokeAfter = usable.length > 0 && usable.every((r) => r.afterTap.length > 0);
const pictured = usable.filter((r) => r.overlap.checked);
const clear = pictured.length > 0 && pictured.every((r) => r.overlap.hits.length === 0);
const pass = silent && spokeAfter && clear;

console.log(JSON.stringify(rounds, null, 2));
console.log(silent ? `PASS: silent in all ${usable.length} rounds while the word showed` : 'FAIL: audio played while a word was on screen');
console.log(spokeAfter ? 'PASS: the word is modelled only after she says it' : 'FAIL: no confirmation audio after the tap');
console.log(clear ? `PASS: reward picture clear of the controls (${pictured.length} checked)` : 'FAIL: reward picture overlaps the controls, or never appeared');
console.log('console errors:', page.errors.length ? page.errors.slice(0, 3) : 'none');
await page.close();
process.exit(pass ? 0 : 1);
