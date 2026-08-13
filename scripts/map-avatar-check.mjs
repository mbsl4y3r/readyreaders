/**
 * Live check: HER reader stands on her current stop on the Reading Road.
 *
 *   npm run dev
 *   node scripts/map-avatar-check.mjs
 *
 * She spends pearls dressing up a character who, before this, never appeared
 * in the world she was travelling — the map marked "you are here" with the
 * region's creature emoji. This asserts her painted reader and her pet are
 * on the current milestone, that the marker cluster does not collide, and
 * that the medallion underneath is still tappable. Against the previous code
 * there is no reader on the map at all and it fails on the first assertion.
 */
import { readFileSync } from 'node:fs';
import { launch } from './cdp.mjs';

const page = await launch();
await page.seed(JSON.parse(readFileSync(new URL('./seed-rich.json', import.meta.url), 'utf8')));
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game`, { label: 'game' });
await page.tap(512, 470); // real touch on the start star
await page.waitFor(`window.__game.scene.isActive('map')`, { label: 'map' });
await page.settle(1000);

const BOXES = `(() => {
  const s = window.__game.scene.getScene('map');
  const out = [];
  const walk = (l, a, v) => { for (const o of l) {
    const aa = a * (typeof o.alpha === 'number' ? o.alpha : 1), vv = v && o.visible !== false;
    if (o.type === 'Container') { walk(o.list || [], aa, vv); continue; }
    if (!vv || aa < 0.05 || typeof o.getBounds !== 'function') continue;
    const b = o.getBounds(); if (b.width < 2 || b.height < 2) continue;
    const label = o.type === 'Text' ? String(o.text).slice(0, 14) : (o.texture ? o.texture.key : o.type);
    out.push({ label, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) });
  }};
  walk(s.children.list, 1, true);
  return out;
})()`;

const all = await page.evalJS(BOXES);
const reader = all.find((b) => b.label === 'map-reader');
const pet = all.find((b) => b.label === 'map-pet');
const flag = all.find((b) => b.label.includes("YOU'RE HERE"));

// the marker cluster must not collide with anything except her own pet
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
// Ambient emoji are painted behind the map as set dressing; a figure standing
// in front of a drifting lollipop is not a layout defect. Only real UI counts:
// stop numbers, the flag, and the wrapped gift.
const MEANINGFUL = /^[0-9]+$|YOU'RE HERE|\u{1F381}/u;
const collisions = reader
  ? all.filter((b) => b !== reader && MEANINGFUL.test(b.label) && overlaps(reader, b)).map((b) => b.label)
  : [];

// and the stop underneath must still start the lesson
await page.evalJS(`(() => {
  const s = window.__game.scene.getScene('map');
  s.scene.start = () => {}; s.cameras.main.fadeOut = () => {};   // side effect only
  window.__hit = null;
  s.input.on('gameobjectup', () => { window.__hit = 1; });
  return 1;
})()`);
const stop = await page.evalJS(`(() => {
  const s = window.__game.scene.getScene('map'); let f = null;
  const walk = (l) => { for (const o of l) {
    if (!f && o.input && o.input.hitArea && o.input.hitArea.radius > 30) {
      let x=o.x,y=o.y,p=o.parentContainer; while(p){x+=p.x;y+=p.y;p=p.parentContainer;}
      f = { x: Math.round(x), y: Math.round(y) };
    }
    if (o.type === 'Container') walk(o.list || []);
  }};
  walk(s.children.list); return f;
})()`);
let tappable = false;
if (stop) { await page.tap(stop.x, stop.y); await page.wait(250);
  tappable = Boolean(await page.evalJS(`window.__hit`)); }

console.log(JSON.stringify({ reader, pet, flag, collisions, stop, tappable }, null, 1));
const pass = Boolean(reader) && Boolean(pet) && collisions.length === 0 && tappable;
console.log(reader ? 'PASS: her reader stands on the current stop' : 'FAIL: no reader on the map');
console.log(pet ? 'PASS: her pet is with her' : 'FAIL: no pet on the map');
console.log(collisions.length === 0 ? 'PASS: the marker cluster is clear' : 'FAIL: reader overlaps ' + collisions.join(', '));
console.log(tappable ? 'PASS: the stop still starts the lesson' : 'FAIL: the stop is no longer tappable');
await page.close();
process.exit(pass ? 0 : 1);
