/**
 * Live check for the serial story ending and the day card.
 *
 *   npm run dev
 *   node scripts/serial-share-check.mjs
 *
 * The serial exists to leave her NOT knowing: a part flagged as a cliffhanger
 * must end on "To be continued", never "The end", and the next part must be
 * sitting on the shelf. The day card must produce a shareable sentence that
 * names the words she can now read without stopping.
 */
import { readFileSync } from 'node:fs';
import { launch } from './cdp.mjs';

const page = await launch();
await page.seed(JSON.parse(readFileSync(new URL('./seed-rich.json', import.meta.url), 'utf8')));
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game`, { label: 'game' });
await page.tap(512, 470); // real touch on the start star
await page.waitFor(`!window.__game.scene.isActive('boot')`, { label: 'left boot' });
await page.wait(600);

/**
 * evalJS() JSON-stringifies its expression, which swallows a promise — these
 * probes use dynamic import(), so they need the raw awaited evaluate.
 */
async function evalAsync(expr) {
  const r = await page.s.send('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 800));
  return r.result.value;
}

// ---- the serial's shape, straight from the content ----
const serial = await evalAsync(`(async () => {
  const { STORIES } = await import('/src/content/stories.ts');
  const parts = STORIES.filter((s) => s.serial);
  return parts.map((s) => ({ id: s.id, title: s.title, part: s.serial.part, of: s.serial.of,
    unlockLevel: s.unlockLevel, cliffhanger: Boolean(s.cliffhanger), pages: s.pages.length,
    lastLine: s.pages[s.pages.length - 1].text }));
})()`);
console.log('serial:', JSON.stringify(serial, null, 1));

// ---- read the cliffhanger part to its end, by real touches ----
const part1 = serial.find((s) => s.part === 1);
await page.evalJS(`(() => { window.__game.scene.start('story', { storyId: '${part1.id}' }); return 1; })()`);
await page.waitFor(`window.__game.scene.isActive('story')`, { label: 'story' });
await page.wait(900);

const NEXT = `(() => {
  const s = window.__game.scene.getScene('story');
  let f = null;
  const walk = (l) => { for (const o of l) {
    if (!f && o.input && o.input.enabled) {
      const t = (o.list || []).filter((c) => c.type === 'Text').map((c) => String(c.text));
      // Two taps per page: "I read it!" reveals the picture, then the arrow
      // turns the page. Neither is home, replay or record.
      if (t.some((x) => x.includes('I read it') || x.trim() === '\u2192')) {
        let x=o.x,y=o.y,p=o.parentContainer; while(p){x+=p.x;y+=p.y;p=p.parentContainer;}
        f = { x: Math.round(x), y: Math.round(y) };
      }
    }
    if (o.type === 'Container') walk(o.list || []);
  }};
  walk(s.children.list); return f;
})()`;

const ENDING = `(() => {
  const s = window.__game.scene.getScene('story');
  const out = [];
  const walk = (l) => { for (const o of l) {
    if (o.type === 'Text') out.push(String(o.text));
    if (o.type === 'Container') walk(o.list || []);
  }};
  walk(s.children.list); return out;
})()`;

/** The page-turn only reappears once that page's narration has finished. */
async function waitForTurn(timeoutMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const btn = await page.evalJS(NEXT);
    if (btn) return btn;
    const seen = await page.evalJS(ENDING);
    if (seen.some((t) => t.includes('continued') || t.includes('The end'))) return null;
    await page.wait(400);
  }
  return null;
}

let ending = [];
// two taps per page (reveal the picture, then turn), so budget generously
for (let i = 0; i < 24; i++) {
  const btn = await waitForTurn();
  if (!btn) break;
  await page.tap(btn.x, btn.y);
  await page.wait(600);
  ending = await page.evalJS(ENDING);
  if (ending.some((t) => t.includes('continued') || t.includes('The end'))) break;
}
if (ending.length === 0) ending = await page.evalJS(ENDING);
const continued = ending.some((t) => t.includes('To be continued'));
const said_end = ending.some((t) => t.includes('The end'));

// ---- the day card ----
const card = await evalAsync(`(async () => {
  const { dayCardText } = await import('/src/services/daycard.ts');
  const { loadProgress } = await import('/src/services/progress.ts');
  const p = loadProgress();
  const today = new Date().toISOString().slice(0, 10);
  p.sessions.push({ date: today, rounds: 9, minutes: 12 });
  const { WORDS } = await import('/src/content/words.ts');
  for (const w of WORDS.slice(0, 3)) {
    p.words[w.id] = { exposures: 8, firstTryCorrect: 6, latencies: [800], ema: 800, best: 700, lastSeen: 0, mastery: 3 };
  }
  return dayCardText(p, today, 'Thu 13 Aug');
})()`);
console.log('--- day card ---\n' + card);

const shares = Boolean(card) && /without stopping/.test(card) && card.split('\n').length >= 3;
const pass = serial.length === 2 && part1.cliffhanger && continued && !said_end && shares;
console.log(continued ? 'PASS: the cliffhanger part ends on "To be continued"' : 'FAIL: no cliffhanger ending shown');
console.log(!said_end ? 'PASS: it never says "The end"' : 'FAIL: it closed the arc anyway');
console.log(serial.length === 2 ? 'PASS: the next part exists to unlock' : 'FAIL: nothing to come back for');
console.log(shares ? 'PASS: the day card names her automatic words' : 'FAIL: the day card is not shareable');
await page.close();
process.exit(pass ? 0 : 1);
