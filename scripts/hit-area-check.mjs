/**
 * Hit-area check — measure where taps ACTUALLY land.
 *
 *   npm run dev
 *   node scripts/hit-area-check.mjs
 *
 * This exists because of a bug no screenshot could show: the character cards
 * in the creator only responded to taps in their top-left quadrant. The
 * declared hit box was a correctly centred `Rectangle(-w/2, -h/2, w, h)`, and
 * Phaser's own Rectangle.Contains agreed a tap at the card's bottom was inside
 * it — but under the 2x camera zoom the live input path lands the declared
 * offsets DOUBLED, so the real box sat with its bottom-right corner on the
 * card's centre.
 *
 * The rule measured from that bug:
 *     effective local rect = declared rect shifted by (-w/2, -h/2)
 * so a control is correct only when it declares a TOP-LEFT anchored box —
 * which is exactly what `setSize()` + a bare `setInteractive()` produces, the
 * pattern makeButton has always used. tests/hit-areas.test.ts enforces that
 * no one hand-rolls a centred rect again; this script is the live proof.
 *
 * It sweeps the character cards because selecting a character keeps you on the
 * same step — a control that navigates away cannot be swept, since the first
 * successful tap replaces the screen.
 */
import { launch } from './cdp.mjs';

const page = await launch();
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game`, { label: 'game' });
await page.tap(512, 470); // real touch on the start star
await page.waitFor(`window.__game.scene.isActive('creator')`, { label: 'creator' });
await page.wait(1400);

await page.evalJS(`(() => {
  const s = window.__game.scene.getScene('creator');
  window.__hit = null;
  s.input.on('gameobjectup', (p, o) => { window.__hit = Math.round(o.x) + ',' + Math.round(o.y); });
  return 1;
})()`);

/** The two character cards, with the box they are DRAWN at. */
const cards = await page.evalJS(`(() => {
  const s = window.__game.scene.getScene('creator');
  const out = [];
  const walk = (l) => {
    for (const o of l) {
      if (o.input && o.input.enabled && o.width > 100 && o.height > 150) {
        let x = o.x, y = o.y, p = o.parentContainer;
        while (p) { x += p.x; y += p.y; p = p.parentContainer; }
        out.push({ x, y, w: o.width, h: o.height, hit: o.input.hitArea });
      }
      if (o.type === 'Container') walk(o.list || []);
    }
  };
  walk(s.children.list);
  return out;
})()`);

/** Walk inward from outside the card until taps start registering. */
async function edge(card, axis, from, to) {
  const step = from < to ? 4 : -4;
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) {
    await page.evalJS(`(() => { window.__hit = null; return 1; })()`);
    await page.tap(axis === 'x' ? v : card.x, axis === 'x' ? card.y : v);
    await page.wait(80);
    if (await page.evalJS(`window.__hit`)) return v;
  }
  return null;
}

let failures = 0;
for (const c of cards) {
  const drawn = {
    left: c.x - c.w / 2, right: c.x + c.w / 2,
    top: c.y - c.h / 2, bottom: c.y + c.h / 2,
  };
  const live = {
    left: await edge(c, 'x', Math.round(drawn.left - 40), Math.round(c.x)),
    right: await edge(c, 'x', Math.round(drawn.right + 40), Math.round(c.x)),
    top: await edge(c, 'y', Math.round(drawn.top - 40), Math.round(c.y)),
    bottom: await edge(c, 'y', Math.round(drawn.bottom + 40), Math.round(c.y)),
  };
  // every measured edge must sit within a tap's width of the drawn edge
  const TOL = 12;
  const off = Object.entries(live).filter(
    ([k, v]) => v === null || Math.abs(v - drawn[k]) > TOL,
  );
  if (off.length) failures++;
  console.log(
    `${off.length ? 'BAD ' : 'ok  '} card at ${Math.round(c.x)},${Math.round(c.y)} ` +
      `drawn L${Math.round(drawn.left)} R${Math.round(drawn.right)} T${Math.round(drawn.top)} B${Math.round(drawn.bottom)} | ` +
      `tappable L${live.left} R${live.right} T${live.top} B${live.bottom}` +
      (off.length ? `  <-- ${off.map(([k]) => k).join(',')} off` : ''),
  );
}

console.log(
  failures === 0
    ? 'PASS: the tappable area matches the drawn card on every edge'
    : `FAIL: ${failures} card(s) have a hit box that does not match what is drawn`,
);
await page.close();
process.exit(failures === 0 ? 0 : 1);
