/**
 * Cross-scene UI audit.
 *
 *   npm run dev
 *   node scripts/ui-audit.mjs [sceneKey ...]
 *
 * Walks every screen and measures the things a six-year-old actually runs
 * into, none of which a screenshot from this harness can be trusted to show:
 *
 *   TAP TARGET  — a control smaller than 64px in either direction. Small
 *                 targets are the difference between "I tapped it" and "this
 *                 game is broken" for a child with imprecise aim.
 *   OFF SCREEN  — anything drawn outside the 1024x720 world box, i.e. clipped
 *                 or unreachable on the iPad.
 *   OVERLAP     — two visible TEXT labels sitting on top of each other.
 *
 * Alpha and visibility are inherited down the tree: a Phaser Container that is
 * hidden or faded leaves its children reading visible/alpha 1, and a naive
 * walk reports a clean screen no matter what is on it.
 */
import { readFileSync } from 'node:fs';
import { launch } from './cdp.mjs';

const GAME_W = 1024;
const GAME_H = 720;
const MIN_TAP = 64;

const SCENES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['map', 'arcade', 'collection', 'wardrobe', 'stickerbook', 'ticketshop',
     'photobooth', 'achievements', 'phrases-hub', 'parent'];

const page = await launch();
await page.seed(JSON.parse(readFileSync(new URL('./seed-rich.json', import.meta.url), 'utf8')));
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game`, { label: 'game' });
await page.tap(512, 470); // real touch on the start star
await page.waitFor(`!window.__game.scene.isActive('boot')`, { label: 'left boot' });

const SNAPSHOT = (key) => `(() => {
  const s = window.__game.scene.getScene('${key}');
  if (!s) return null;
  const out = [];
  const walk = (list, alpha, visible) => {
    for (const o of list) {
      const a = alpha * (typeof o.alpha === 'number' ? o.alpha : 1);
      const v = visible && o.visible !== false;
      if (o.type === 'Container') {
        if (o.mask) continue;
        if (o.input && o.input.enabled && v && a >= 0.05) {
          // A control's real target is its declared size CENTRED on its
          // origin — getBounds() returns the rendered art, which is a
          // different box and makes every centred button look off-screen.
          let x = o.x, y = o.y, p = o.parentContainer;
          while (p) { x += p.x; y += p.y; p = p.parentContainer; }
          const w = o.width || 0, h = o.height || 0;
          if (w > 0 && h > 0) out.push({ kind: 'control', label: '', alpha: a,
            x: x - w / 2, y: y - h / 2, w, h });
        }
        walk(o.list || [], a, v);
        continue;
      }
      // Content inside a scrolling rack is clipped by a geometry mask, so
      // rows past the fold are reachable by dragging, not lost off-screen.
      if (o.mask) continue;
      if (!v || a < 0.05 || typeof o.getBounds !== 'function') continue;
      const b = o.getBounds();
      if (b.width < 2 || b.height < 2) continue;
      const isText = o.type === 'Text';
      out.push({
        kind: o.input && o.input.enabled ? 'control' : (isText ? 'text' : 'art'),
        label: isText ? String(o.text).slice(0, 22) : o.type,
        alpha: a,
        x: b.x, y: b.y, w: b.width, h: b.height,
      });
    }
  };
  walk(s.children.list, 1, true);
  return out;
})()`;

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

let issues = 0;
for (const key of SCENES) {
  await page.evalJS(`(() => { window.__game.scene.start('${key}'); return 1; })()`);
  await page.waitFor(`window.__game.scene.isActive('${key}')`, { label: key }).catch(() => {});
  await page.settle(700);
  const objs = await page.evalJS(SNAPSHOT(key));
  if (!objs) { console.log(`?? ${key}: scene not found`); continue; }

  const found = [];
  for (const o of objs) {
    // The parent corner is deliberately adult-sized: smaller chips, denser
    // rows, and a little awkward for small fingers on purpose.
    if (key !== 'parent' && o.kind === 'control' && (o.w < MIN_TAP || o.h < MIN_TAP)) {
      found.push(`TAP TARGET ${Math.round(o.w)}x${Math.round(o.h)} at ${Math.round(o.x + o.w / 2)},${Math.round(o.y + o.h / 2)}`);
    }
    // Only things she must SEE or TOUCH can be off screen; drifting
    // background art and particle emitters are allowed to run off the edge.
    if (o.kind !== 'art' && o.alpha > 0.3 &&
        (o.x < -2 || o.y < -2 || o.x + o.w > GAME_W + 2 || o.y + o.h > GAME_H + 2)) {
      found.push(`OFF SCREEN ${o.kind} "${o.label}" at ${Math.round(o.x)},${Math.round(o.y)} ${Math.round(o.w)}x${Math.round(o.h)}`);
    }
  }
  // Ambient set dressing is painted at alpha 0.22 by drawRealmBackground; a
  // label sitting over a drifting cupcake is a wash, not a collision.
  const texts = objs.filter((o) => o.kind === 'text' && o.alpha > 0.3 && o.label.trim().length > 1);
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (overlaps(texts[i], texts[j])) {
        found.push(`OVERLAP "${texts[i].label}" x "${texts[j].label}" near ${Math.round(texts[i].x)},${Math.round(texts[i].y)}`);
      }
    }
  }

  issues += found.length;
  console.log(`\n== ${key} (${objs.length} objects) ==`);
  if (found.length === 0) console.log('   clean');
  else for (const f of [...new Set(found)]) console.log('   ' + f);
}

console.log(`\n${issues === 0 ? 'PASS: no UI issues found' : `FOUND ${issues} issue(s)`}`);
console.log('console errors:', page.errors.length ? page.errors.slice(0, 5) : 'none');
await page.close();
process.exit(issues === 0 ? 0 : 1);
