/**
 * Live check: reading opens the arcade, and it never costs her pearls.
 *
 *   npm run dev
 *   node scripts/arcade-access-check.mjs
 *
 * The arcade was a toll booth — 10 pearls a visit, the same currency the
 * wardrobe runs on, so a child with none was simply locked out of the fun
 * part. This drives the real arcade by touch with a Play Pass in hand and
 * asserts the game starts with her pearls untouched. Against the previous
 * code the pearl modal appears instead and no game starts.
 */
import { readFileSync } from 'node:fs';
import { launch } from './cdp.mjs';

const page = await launch();
const save = JSON.parse(readFileSync(new URL('./seed-rich.json', import.meta.url), 'utf8'));
save.arcadeTokens = 1;
save.arcadePassUntil = 0;
save.pearls = 3; // deliberately BELOW the 10-pearl toll
await page.seed(save);
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game`, { label: 'game' });
await page.tap(512, 470); // real touch on the start star
await page.waitFor(`!window.__game.scene.isActive('boot')`, { label: 'left boot' });
await page.evalJS(`(() => { window.__game.scene.start('arcade'); return 1; })()`);
await page.waitFor(`window.__game.scene.isActive('arcade')`, { label: 'arcade' });
await page.settle(900);

const before = await page.evalJS(`(() => {
  const s = JSON.parse(localStorage.getItem('readyreaders.v1'));
  return { pearls: s.pearls, tokens: s.arcadeTokens };
})()`);

// tap the first UNLOCKED cabinet — a real touch on a real tile
const cabinet = await page.evalJS(`(() => {
  const s = window.__game.scene.getScene('arcade');
  let f = null;
  const walk = (l) => { for (const o of l) {
    if (!f && o.input && o.input.enabled && o.width > 150) {
      const locked = (o.list || []).some((c) => c.type === 'Text' && String(c.text).includes('🔒'));
      if (!locked) {
        let x=o.x,y=o.y,p=o.parentContainer; while(p){x+=p.x;y+=p.y;p=p.parentContainer;}
        f = { x: Math.round(x), y: Math.round(y) };
      }
    }
    if (o.type === 'Container') walk(o.list || []);
  }};
  walk(s.children.list); return f;
})()`);
if (!cabinet) throw new Error('no unlocked arcade cabinet found');
await page.tap(cabinet.x, cabinet.y);
await page.wait(1600);

const after = await page.evalJS(`(() => {
  const s = JSON.parse(localStorage.getItem('readyreaders.v1'));
  const scene = window.__game.scene.getScene('arcade');
  const texts = [];
  const walk = (l) => { for (const o of l) {
    if (o.type === 'Text') texts.push(String(o.text).slice(0, 24));
    if (o.type === 'Container') walk(o.list || []);
  }};
  walk(scene.children.list);
  return { pearls: s.pearls, tokens: s.arcadeTokens, passUntil: s.arcadePassUntil, texts };
})()`);

const askedForPearls = after.texts.some((t) => t.includes('Play Pass') && t.includes('Pass'))
  && after.texts.some((t) => /need|for 10/.test(t));
const spentToken = after.tokens === before.tokens - 1;
const keptPearls = after.pearls === before.pearls;
const passRunning = after.passUntil > Date.now();

console.log(JSON.stringify({ before, after: { ...after, texts: undefined } }, null, 1));
console.log(spentToken ? 'PASS: her earned Play Pass was spent' : 'FAIL: the Play Pass was not used');
console.log(keptPearls ? `PASS: pearls untouched (${after.pearls})` : `FAIL: it charged her pearls (${before.pearls} -> ${after.pearls})`);
console.log(passRunning ? 'PASS: the arcade opened' : 'FAIL: no play pass is running');
console.log(!askedForPearls ? 'PASS: she was never shown the pearl toll' : 'FAIL: the pearl modal appeared anyway');
const ok = spentToken && keptPearls && passRunning && !askedForPearls;
await page.close();
process.exit(ok ? 0 : 1);
