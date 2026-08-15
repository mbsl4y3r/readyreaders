/**
 * Live check: the world is inhabited.
 *
 *   npm run dev
 *   node scripts/world-check.mjs
 *
 * (a) the region's host creature stands on the map, welcomes her ONCE on
 *     arrival in its region and never again (a host that repeats itself is
 *     nagging); (b) the trail behind her is gold; (c) tapping her pet makes
 *     it bound toward the gold Lesson button and the button swell — the pet
 *     leads; (d) the arcade lists her current realm's games first, wearing
 *     the same host creature she met on the map.
 * Against the previous code: no host exists, no greeting plays, walked
 * segments are undefined, and the arcade order field does not exist.
 */
import { readFileSync } from 'node:fs';
import { launch } from './cdp.mjs';

const page = await launch();
const save = JSON.parse(readFileSync(new URL('./seed-rich.json', import.meta.url), 'utf8'));
delete save.greetedRegion; // first arrival: the host should welcome her
await page.seed(save);
await page.goto('http://localhost:5173/');
await page.waitFor(`window.__game`, { label: 'game' });

// watch the TTS fallback — no region-hello recordings exist yet
await page.evalJS(`(() => {
  window.__tts = [];
  const ss = window.speechSynthesis;
  if (ss) { const real = ss.speak.bind(ss);
    ss.speak = (u) => { window.__tts.push(String(u && u.text)); return real(u); }; }
  return 1;
})()`);

await page.tap(512, 470); // real touch on the start star
await page.waitFor(`window.__game.scene.isActive('map')`, { label: 'map' });
await page.wait(2200); // greeting fires after a 700ms beat

const world = await page.evalJS(`(() => {
  const s = window.__game.scene.getScene('map');
  const save = JSON.parse(localStorage.getItem('readyreaders.v1'));
  let host = null;
  const walk = (l) => { for (const o of l) {
    if (o.type === 'Container' && o.input && o.input.enabled && o.width === 72 && o.height === 84) {
      host = { x: o.x, y: o.y };
    }
    if (o.type === 'Container') walk(o.list || []);
  }};
  walk(s.children.list);
  return { host, walked: s.walkedSegments, greetedRegion: save.greetedRegion,
           tts: window.__tts.slice() };
})()`);

const greeted1 = world.tts.some((t) => t.includes('Welcome to') && t.includes("I'm"));

// ---- second visit: the host must NOT repeat itself ----
await page.evalJS(`(() => { window.__tts.length = 0; window.__game.scene.start('map'); return 1; })()`);
await page.wait(2200);
const secondVisit = await page.evalJS(`window.__tts.slice()`);
const greetedTwice = secondVisit.some((t) => t.includes('Welcome to') && t.includes("I'm"));

// ---- pet leads: tap the pet, the gold button must swell ----
const petAndCta = await page.evalJS(`(() => {
  const s = window.__game.scene.getScene('map');
  let cta = null; const smalls = [];
  const walk = (l) => { for (const o of l) {
    if (o.type === 'Container' && o.input && o.input.enabled) {
      let x = o.x, y = o.y, p = o.parentContainer;
      while (p) { x += p.x; y += p.y; p = p.parentContainer; }
      if (o.width >= 300 && y > 600) cta = { x, y };
      if (o.width === 64 && o.height === 64) smalls.push({ x, y });
    }
    if (o.type === 'Container') walk(o.list || []);
  }};
  walk(s.children.list);
  // the pet stands LEFT of the current stop; the wrapped gift sits right of it
  smalls.sort((a, b) => a.x - b.x);
  return { pet: smalls[0] || null, cta };
})()`);
let ctaSwelled = false;
if (petAndCta.pet && petAndCta.cta) {
  await page.tap(petAndCta.pet.x, petAndCta.pet.y);
  // sample the CTA scale during the pulse window
  for (let i = 0; i < 8 && !ctaSwelled; i++) {
    await page.wait(90);
    const scale = await page.evalJS(`(() => {
      const s = window.__game.scene.getScene('map');
      let v = 1; const walk = (l) => { for (const o of l) {
        if (o.type === 'Container' && o.input && o.input.enabled) {
          let x=o.x,y=o.y,p=o.parentContainer; while(p){x+=p.x;y+=p.y;p=p.parentContainer;}
          if (o.width >= 300 && y > 600) v = o.scaleX;
        }
        if (o.type === 'Container') walk(o.list || []);
      }};
      walk(s.children.list); return v;
    })()`);
    if (scale > 1.04) ctaSwelled = true;
  }
}

// ---- arcade: home realm first, host badge riding its cabinets ----
await page.evalJS(`(() => { window.__game.scene.start('arcade'); return 1; })()`);
await page.waitFor(`window.__game.scene.isActive('arcade')`, { label: 'arcade' });
await page.settle(800);
// evalJS stringifies its expression and would swallow this async probe, so
// it goes through the raw awaited evaluate.
const r = await page.s.send('Runtime.evaluate', {
  expression: `(async () => {
    const s = window.__game.scene.getScene('arcade');
    const { ARCADE_GAMES } = await import('/src/content/arcade-games.ts');
    const { regionForLesson, baseRealmFor } = await import('/src/content/regions.ts');
    const save = JSON.parse(localStorage.getItem('readyreaders.v1'));
    const home = baseRealmFor(regionForLesson(save.lesson));
    const ids = s.homeFirstIds || [];
    const realms = ids.map((id) => ARCADE_GAMES.find((g) => g.id === id).realm);
    const firstOff = realms.findIndex((x) => x !== home);
    const lastHome = realms.lastIndexOf(home);
    const texts = [];
    const walk = (l) => { for (const o of l) {
      if (o.type === 'Text') texts.push(String(o.text));
      if (o.type === 'Container') walk(o.list || []);
    }};
    walk(s.children.list);
    const creature = regionForLesson(save.lesson).creature;
    const badges = texts.filter((t) => t === creature).length;
    const shelfLabel = texts.some((t) => t.includes('games first'));
    return JSON.stringify({ ordered: ids.length > 0, homeFirst: firstOff === -1 || lastHome < firstOff,
      badges, shelfLabel });
  })()`, awaitPromise: true, returnByValue: true });
const arc = JSON.parse(r.result.value);

console.log(JSON.stringify({ world: { ...world, tts: world.tts.length }, greeted1, greetedTwice, ctaSwelled, arc }, null, 1));
const pass =
  Boolean(world.host) && greeted1 && !greetedTwice &&
  world.walked === 4 && world.greetedRegion > 0 &&
  ctaSwelled && arc.ordered && arc.homeFirst && arc.badges > 0 && arc.shelfLabel;
console.log(world.host ? 'PASS: the host creature lives on the map' : 'FAIL: no host on the map');
console.log(greeted1 ? 'PASS: it welcomed her on arrival' : 'FAIL: no welcome played');
console.log(!greetedTwice ? 'PASS: and never repeats itself' : 'FAIL: it greeted her again (nagging)');
console.log(world.walked === 4 ? 'PASS: the trail behind her is gold (4 segments)' : `FAIL: walked=${world.walked}`);
console.log(ctaSwelled ? 'PASS: tapping her pet leads her to the Lesson button' : 'FAIL: pet tap did nothing');
console.log(arc.homeFirst && arc.badges > 0 && arc.shelfLabel ? 'PASS: the arcade is her realm\'s fair (home games first, host on the cabinets)' : 'FAIL: arcade not tied to her realm');
await page.close();
process.exit(pass ? 0 : 1);
