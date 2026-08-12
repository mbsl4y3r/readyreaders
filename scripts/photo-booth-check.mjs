/**
 * Live check: the photo booth keeps every photo.
 *
 *   npm run dev
 *   node scripts/photo-booth-check.mjs
 *
 * Drives the real booth with real touches and takes eight snaps. The booth
 * used to run `while (photos.length > 6) photos.shift()`, so the first two
 * were destroyed the moment the seventh arrived — with no warning and no way
 * back. Against that code this reports 6 and FAILS.
 */
import { readFileSync } from 'node:fs';
import { launch } from './cdp.mjs';

const SEED = new URL('./seed-rich.json', import.meta.url);

const page = await launch();
try {
  await page.seed(JSON.parse(readFileSync(SEED, 'utf8')));
} catch {
  // no seed file: the run still works, it just starts at the creator
}
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game && window.__game.scene.isActive('boot')`, { label: 'boot' });
await page.tap(512, 470); // real touch on the start star
await page.waitFor(`!window.__game.scene.isActive('boot')`, { label: 'left boot' });

// Enter the booth the way the game does, then drive it by touch only.
await page.evalJS(`(() => { window.__game.scene.start('photobooth'); return 1; })()`);
await page.waitFor(`window.__game.scene.isActive('photobooth')`, { label: 'photobooth' });
await page.settle(900);

const before = await page.evalJS(`JSON.parse(localStorage.getItem('readyreaders.photos.v1') || '[]').length`);

// find the Snap button's world position from the scene, then TOUCH it
const snap = await page.evalJS(`(() => {
  const s = window.__game.scene.getScene('photobooth');
  const hit = s.children.list
    .filter((o) => o.input && o.input.enabled && o.x > 600)
    .map((o) => ({ x: o.x, y: o.y }));
  return hit;
})()`);
if (!Array.isArray(snap) || snap.length === 0) throw new Error('no tappable controls found');

// the Snap button is the lowest control in the right-hand column
const target = snap.reduce((lo, o) => (o.y > lo.y ? o : lo), snap[0]);

const SHOTS = 8;
for (let i = 0; i < SHOTS; i++) {
  await page.tap(target.x, target.y);
  await page.wait(700); // snapshotArea lands on the next render
}
await page.settle(800);

const stored = await page.evalJS(
  `JSON.parse(localStorage.getItem('readyreaders.photos.v1') || '[]').length`,
);
const inScene = await page.evalJS(
  `window.__game.scene.getScene('photobooth').progress.photos.length`,
);
const mainRecordPhotos = await page.evalJS(
  `(JSON.parse(localStorage.getItem('readyreaders.v1') || '{}').photos || []).length`,
);

const took = stored - before;
const pass = took === SHOTS && inScene === stored && mainRecordPhotos === 0;
console.log(
  JSON.stringify({ before, stored, inScene, took, expected: SHOTS, mainRecordPhotos }, null, 2),
);
console.log(
  pass
    ? 'PASS: every snap kept, and photos stay out of the progress record'
    : `FAIL: kept ${took} of ${SHOTS} snaps` +
        (mainRecordPhotos > 0 ? ' (photos are still inside the progress record)' : ''),
);
console.log('console errors:', page.errors.length ? page.errors.slice(0, 3) : 'none');
await page.close();
process.exit(pass ? 0 : 1);
