/**
 * Avatar contact sheet + automated bald-spot detector.
 *
 *   npm run dev          # in one terminal
 *   node scripts/avatar-audit.mjs [outPrefix]
 *
 * Not part of `npm test`: it needs a running dev server and a local Chromium.
 * Run it after ANY change to the hair, head or face painters.
 *
 * Two outputs, and both matter:
 *  1. Contact sheets (PNG per character) — the only way to judge proportion.
 *     A hairline that is merely too high is not a hole; you have to look.
 *  2. A bald-spot scan — scalp ENCLOSED by hair. Descending a column through
 *     the crown you meet hair, then skin, then hair again. A plain forehead is
 *     hair-then-skin and never trips it; the scan stops above the brows so
 *     dark face features can't be mistaken for hair.
 *
 * It reads the avatar canvas back with toDataURL() rather than capturing the
 * screen, so the headless compositor's blit artifact can't lie to us — these
 * are exactly the pixels the painter produced.
 */
import { writeFileSync } from 'node:fs';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] ?? 'avatar-audit';

const BOY_STYLES = ['crop', 'spiky', 'buzz', 'flow', 'curlytop', 'mohawk'];
const GIRL_STYLES = ['waves', 'bob', 'curls', 'pixie', 'longstraight', 'pony', 'bun', 'braids', 'spacebuns', 'sidebraid'];

const page = await launch();
await page.goto('http://localhost:5173/');
await page.waitFor('!!document.querySelector("canvas")');

const script = `(async () => {
  const m = await import('/src/avatar/paint.ts');
  const S = 4;                       // 4x the 200x270 logical avatar
  const base = {
    skin: 'shell', hairColor: 'chestnut', headwear: null, necklace: null,
    held: null, face: null, glasses: null, earrings: null,
    petColor: 'violet', petHat: null,
  };
  const cfg = (character, hairStyle) => ({
    ...base, character, hairStyle,
    outfit: character === 'boy' ? 'hero-blue' : 'tail-seafoam',
  });

  const render = (character, hairStyle) => {
    const c = document.createElement('canvas');
    c.width = 200 * S; c.height = 270 * S;
    const ctx = c.getContext('2d');
    ctx.scale(S, S);
    m.drawReaderInto(ctx, cfg(character, hairStyle));
    return c;
  };

  // ---- bald-spot scan -------------------------------------------------
  // The head disc lives at (100,80) r42 in logical units; the boy's whole
  // figure is translated down 46. Scan the crown band and look for skin
  // pixels bracketed by hair on the same row.
  const scan = (character, hairStyle) => {
    const c = render(character, hairStyle);
    const ctx = c.getContext('2d');
    const dy = character === 'boy' ? 46 : 0;
    const px = (x, y) => {
      const d = ctx.getImageData(Math.round(x * S), Math.round((y + dy) * S), 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    };
    // skin 'shell' is a pale peach; hair 'chestnut' is dark brown. Classify by
    // luminance + warmth rather than exact colour so gradients don't fool it.
    const isSkin = ([r, g, b, a]) => a > 200 && r > 200 && g > 160 && b > 130 && (r - b) < 110;
    const isHair = ([r, g, b, a]) => a > 200 && r < 190 && (r + g + b) < 430;

    // A bald spot is scalp ENCLOSED by hair: descending a column through the
    // crown you meet hair, then skin, then hair again. Plain forehead is
    // hair-then-skin and never trips this. Scanning stops above the brows so
    // dark face features can't be mistaken for hair.
    const holes = [];
    for (let x = 66; x <= 134; x += 1) {
      let seenHair = false;
      let gap = 0;
      let gapTop = 0;
      for (let y = 24; y <= 62; y += 1) {
        const p = px(x, y);
        if (isHair(p)) {
          if (seenHair && gap >= 2) holes.push({ x, y0: gapTop, len: gap });
          seenHair = true;
          gap = 0;
        } else if (isSkin(p)) {
          if (seenHair) {
            if (gap === 0) gapTop = y;
            gap++;
          }
        }
        // outline / antialias / background: neither confirms nor breaks a gap
      }
    }
    return {
      style: hairStyle,
      character,
      holes: holes.length,
      worst: holes.sort((a, b) => b.len - a.len)[0] ?? null,
    };
  };

  const boys = ${JSON.stringify(BOY_STYLES)};
  const girls = ${JSON.stringify(GIRL_STYLES)};
  const report = [...boys.map(s => scan('boy', s)), ...girls.map(s => scan('girl', s))];

  // ---- contact sheets -------------------------------------------------
  const sheet = (character, styles) => {
    const cols = Math.min(5, styles.length);
    const rows = Math.ceil(styles.length / cols);
    const CW = 200 * S, CH = 270 * S;
    const out = document.createElement('canvas');
    out.width = cols * CW; out.height = rows * CH;
    const o = out.getContext('2d');
    o.fillStyle = '#fbf3e3';
    o.fillRect(0, 0, out.width, out.height);
    styles.forEach((s, i) => {
      const x = (i % cols) * CW, y = Math.floor(i / cols) * CH;
      o.drawImage(render(character, s), x, y);
      o.fillStyle = '#2b2118';
      o.font = 'bold ' + (18 * S / 2) + 'px sans-serif';
      o.textAlign = 'center';
      o.fillText(s, x + CW / 2, y + CH - 12);
    });
    return out.toDataURL('image/png');
  };

  return JSON.stringify({
    report,
    boy: sheet('boy', boys),
    girl: sheet('girl', girls),
  });
})()`;

// evalJS() JSON.stringifies its expression, which would swallow this async
// IIFE — go straight to Runtime.evaluate so the promise is awaited properly.
const r = await page.s.send('Runtime.evaluate', {
  expression: script,
  awaitPromise: true,
  returnByValue: true,
});
if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails, null, 2).slice(0, 2000));
const data = JSON.parse(r.result.value);

for (const key of ['boy', 'girl']) {
  const b64 = data[key].split(',')[1];
  writeFileSync(`${OUT}-${key}.png`, Buffer.from(b64, 'base64'));
}

console.log('--- bald-spot scan (holes = skin runs with hair on both sides) ---');
for (const r of data.report) {
  const flag = r.holes > 0 ? 'BALD SPOT' : 'ok';
  console.log(
    `${flag.padEnd(10)} ${r.character.padEnd(5)} ${r.style.padEnd(13)} holes=${String(r.holes).padStart(4)}` +
      (r.worst ? `  worst: y=${r.worst.y} x=${r.worst.x0} len=${r.worst.len}` : ''),
  );
}
console.log('sheets written to', OUT + '-boy.png', OUT + '-girl.png');
await page.close();
