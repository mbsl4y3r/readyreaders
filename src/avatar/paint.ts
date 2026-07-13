/**
 * Avatar painter — draws chibi Evie and Inky the octopus onto Phaser
 * CanvasTextures using the full 2D canvas path API (beziers, gradients),
 * so every cosmetic reads as hand-drawn vector art rather than stacked
 * primitives.
 *
 * `drawEvieInto` / `drawInkyInto` are pure functions of (ctx, config) in
 * logical coordinates; `paintEvie` / `paintInky` are the Phaser-facing
 * wrappers that manage the texture lifecycle.
 */
import type Phaser from 'phaser';
import type {
  AvatarConfig,
  EarringId,
  FaceId,
  GlassesId,
  HairColorId,
  HairStyleId,
  HeadwearId,
  HeldId,
  NecklaceId,
  PetColorId,
  PetHatId,
  SkinId,
} from './catalog';

export const EVIE_W = 200;
export const EVIE_H = 270;
export const INKY_W = 160;
export const INKY_H = 170;

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- palettes

const SKINS: Record<SkinId, { base: string; shadow: string }> = {
  shell: { base: '#ffd9b0', shadow: '#f0b98a' },
  sand: { base: '#f2c391', shadow: '#dba36c' },
  amber: { base: '#c98a5b', shadow: '#a96e42' },
  cocoa: { base: '#8d5a3b', shadow: '#6f4227' },
};

const HAIRS: Record<HairColorId, { base: string; sheen: string }> = {
  chestnut: { base: '#6b3f2a', sheen: '#8a5a3e' },
  midnight: { base: '#2e2e40', sheen: '#4a4a66' },
  sunshine: { base: '#e8b64c', sheen: '#f6d488' },
  ember: { base: '#b34a2e', sheen: '#d4663f' },
  rose: { base: '#e07a9e', sheen: '#f0a2bd' },
  lilac: { base: '#9a7fd1', sheen: '#b8a2e6' },
  aqua: { base: '#2fbfae', sheen: '#5fd8c8' },
  silver: { base: '#c6ccd6', sheen: '#e6ebf2' },
  auburn: { base: '#8a3b24', sheen: '#a8543a' },
  honey: { base: '#d99a4e', sheen: '#eec27a' },
};

/** Mermaid tail colorways, top → bottom gradient stops. */
const TAILS: Record<string, string[]> = {
  seafoam: ['#39c7b6', '#2a7fb0'],
  coral: ['#ff8a76', '#e3564f'],
  violet: ['#9a6bde', '#6b3fb0'],
  midnight: ['#3a4a8a', '#1c2554'],
  gold: ['#ffd76a', '#d99a1e'],
  rainbow: ['#ff8ec4', '#a98cff', '#5ac8ff'],
  sunset: ['#ff9a6b', '#ff6f9d'],
  pearl: ['#eef2f6', '#c9d6e6'],
};

/** Princess gown colorways, top → bottom gradient stops. */
const GOWN_STOPS: Record<string, [string, string]> = {
  rose: ['#f27ba0', '#d94f7e'],
  sky: ['#7ec4f0', '#4f8fd9'],
  mint: ['#7fd8b0', '#3fa877'],
  berry: ['#b06bd6', '#7a3fa0'],
  violet: ['#8a7fe0', '#5a4fb0'],
  gold: ['#ffd76a', '#e0a52e'],
  winter: ['#dbeeff', '#9cc4e8'],
  starlight: ['#3a4a8a', '#151a3a'],
  // round-2 additions — more color dresses & princess gowns
  sunset: ['#ffb06a', '#ff5f8d'],
  aqua: ['#6fe6d6', '#2aa7b5'],
  lavender: ['#cbb4f2', '#8a6fd6'],
  peach: ['#ffc9a6', '#ff8fa6'],
  emerald: ['#79e6a6', '#1f9e6b'],
  ruby: ['#ff8090', '#c62448'],
  bluebell: ['#9cc0ff', '#4f6fd6'],
  blossom: ['#ffb6e6', '#e864c4'],
  buttercup: ['#ffe38a', '#f4b23a'],
  cocoa: ['#e6b98a', '#a56b3f'],
};

/**
 * Fairy dress + butterfly-wing colorways, light → deep. The dress gradient and
 * the translucent wings share the same two stops so the outfit reads as one.
 */
const FAIRY_STOPS: Record<string, [string, string]> = {
  rose: ['#ff9ec4', '#ff6f9d'],
  violet: ['#b18cff', '#7d5ad6'],
  mint: ['#8fe0c0', '#4bbf95'],
};

/**
 * Everyday play-clothes colorways. Each has the main garment color plus the
 * tee it's worn over, a trim accent, and the little shoe fill — enough for the
 * three distinct looks (sunny playsuit, berry pinafore, denim & tee).
 */
interface PlayLook {
  garment: string; // skirt / pinafore / denim
  tee: string; // top under the garment (and short sleeves)
  trim: string; // white piping / stripe accent
  shoe: string; // shoe body
  shoeKind: 'plain' | 'maryjane' | 'sneaker';
  striped?: boolean; // draw 2 tee stripes
}
const PLAY_LOOKS: Record<string, PlayLook> = {
  sunny: { garment: '#ffd36a', tee: '#ffd36a', trim: '#ffffff', shoe: '#ffffff', shoeKind: 'plain' },
  berry: { garment: '#e2567f', tee: '#fff3e0', trim: '#ffe4ef', shoe: '#e2567f', shoeKind: 'maryjane' },
  denim: { garment: '#5a86c4', tee: '#eef2f6', trim: '#7fb0e0', shoe: '#ffffff', shoeKind: 'sneaker', striped: true },
};

const GOLD = '#f6d06a';
const GOLD_EDGE = '#c9881f';
const PEARL = '#ffffff';
const PEARL_BLUSH = '#fdeef3';
const EYE = '#3a2418';

const PETS: Record<PetColorId, { base: string; deep: string }> = {
  violet: { base: '#b06bff', deep: '#7d3fd6' },
  'pet-rose': { base: '#ff8ab5', deep: '#d65a8a' },
  sea: { base: '#5fd0c0', deep: '#2f9a8a' },
  coral: { base: '#ff8f6b', deep: '#e3564f' },
  gold: { base: '#ffcf6a', deep: '#e0a52e' },
  'pet-midnight': { base: '#5b6bb0', deep: '#2a2f5c' },
  forest: { base: '#5fbf5a', deep: '#2f8a3a' },
  sky: { base: '#5aa8f0', deep: '#2f6fc4' },
};

// ---------------------------------------------------------------- color math

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((c(r) << 16) | (c(g) << 8) | c(b)).toString(16).padStart(6, '0')}`;
}

/** Darken (`f` < 1) or brighten (`f` > 1) a hex color. */
function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * f, g * f, b * f);
}

/** Mix a hex color toward white by `t` (0..1). */
function lighten(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

/** Mix two hex colors. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// ---------------------------------------------------------------- path helpers

/** Fill the current path, then outline it in a darker shade of the fill. */
function fillOutlined(ctx: Ctx, fill: string, edgeFactor = 0.78, lineWidth = 1.6): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = shade(fill, edgeFactor);
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Fill the current path with a vertical gradient, outlined in the dark stop. */
function fillGradientOutlined(
  ctx: Ctx,
  stops: string[],
  y0: number,
  y1: number,
  edgeFactor = 0.8,
  lineWidth = 1.6,
): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = shade(stops[stops.length - 1]!, edgeFactor);
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function ellipsePath(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  ctx.closePath();
}

function starPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  points = 5,
  rot = -Math.PI / 2,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = rot + (Math.PI * i) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Tiny 4-point twinkle. */
function sparkle(ctx: Ctx, cx: number, cy: number, r: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  starPath(ctx, cx, cy, r, r * 0.32, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

// ================================================================ EVIE
// Logical box 200×270, centered on x=100. Head circle r≈42 at (100, 80).

const HEAD_CX = 100;
const HEAD_CY = 80;
const HEAD_R = 42;

/**
 * Paint the reader. The lower body (outfit) is the only girl/boy-specific
 * stack; the head, face, hair, and accessory layers on top are shared, so both
 * characters share one warm chibi look — only the wardrobe universe differs.
 */
export function drawReaderInto(ctx: Ctx, config: AvatarConfig): void {
  const skin = SKINS[config.skin];
  const hair = HAIRS[config.hairColor];

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // The boy's figure ends at his shoes (~y214) while the girl's tail/gown
  // reaches ~y260, so his art floats high in the shared 270-tall canvas.
  // Shifting the whole figure down means every scene that stages the
  // texture (wardrobe, creator, photo booth) grounds him automatically.
  if (config.character === 'boy') ctx.translate(0, 46);

  // 1. back hair silhouette
  drawBackHair(ctx, config.hairStyle, hair);

  // 2–3. the outfit stack (wings/tail/gown vs. cape/suit) + torso + arms
  if (config.character === 'boy') drawBoyStack(ctx, config, skin);
  else drawGirlStack(ctx, config, skin);

  // 4. necklace (head chin overlaps its top edge)
  if (config.necklace) drawNecklace(ctx, config.necklace);

  // 6. head + 7. face
  drawHead(ctx, skin);
  drawFace(ctx, skin, hair, config.face, config.character === 'boy');

  // 8. front hair
  drawFrontHair(ctx, config.hairStyle, hair);

  // 8b. earrings ride the hairline so they read even when the ear is covered.
  if (config.earrings) drawEarrings(ctx, config.earrings, config.hairStyle);

  // 8c. glasses sit on the nose bridge, in front of the face and fringe.
  if (config.glasses) drawGlasses(ctx, config.glasses);

  // held item in the right hand (viewer left) — in front of the long hair
  // so wand/star stay visible with every hairstyle.
  if (config.held) drawHeld(ctx, config.held);

  // 9. headwear
  if (config.headwear) drawHeadwear(ctx, config.headwear, config.hairStyle);

  ctx.restore();
}

/** The girl's outfit universe: wings/tail/gown/fairy/play + torso + arms. */
function drawGirlStack(ctx: Ctx, config: AvatarConfig, skin: { base: string; shadow: string }): void {
  const family = config.outfit.slice(0, config.outfit.indexOf('-')); // tail|gown|fairy|play
  const colorway = config.outfit.slice(config.outfit.indexOf('-') + 1);

  // fairy wings sit behind the body but over the back hair so they always read.
  if (family === 'fairy') drawWings(ctx, colorway);

  // outfit bottom — legs peek out first so the short skirt overlaps them.
  if (family === 'tail') {
    drawTail(ctx, colorway);
  } else if (family === 'gown') {
    drawGownSkirt(ctx, colorway);
  } else if (family === 'fairy') {
    drawLegs(ctx, skin, slipperFill(colorway), 'plain');
    drawFairySkirt(ctx, colorway);
  } else {
    const look = PLAY_LOOKS[colorway] ?? PLAY_LOOKS['sunny']!;
    drawLegs(ctx, skin, look.shoe, look.shoeKind);
    drawPlaySkirt(ctx, look);
  }

  drawTorso(ctx, skin);
  if (family === 'tail') drawBandeau(ctx, colorway);
  else if (family === 'gown') drawBodice(ctx, colorway);
  else if (family === 'fairy') drawFairyBodice(ctx, colorway);
  else drawPlayTop(ctx, colorway);
  drawArms(ctx, skin, family, colorway);
}

/** Keep the old export name working for any stragglers. */
export const drawEvieInto = drawReaderInto;

// ================================================================ BOY outfits
// Same chibi body as the girl; only the outfit universe changes. Torso spans
// y120–154, legs 166–204, arms 124–163, chest emblem centre ≈ (100, 136).

interface HeroLook {
  suit: [string, string]; // bodysuit top→bottom
  trim: string; // belt + cuffs
  cape: string;
  boot: string;
  emblem: string;
  shape: 'bolt' | 'flame' | 'frost' | 'star' | 'sun' | 'wave';
}
const HERO_LOOKS: Record<string, HeroLook> = {
  bolt: { suit: ['#3f74d6', '#2b4fa8'], trim: '#ffd23f', cape: '#ffd23f', boot: '#26397a', emblem: '#ffd23f', shape: 'bolt' },
  flame: { suit: ['#e2503a', '#b0311c'], trim: '#ffcf3f', cape: '#ff7a2f', boot: '#7a2214', emblem: '#ffd76a', shape: 'flame' },
  frost: { suit: ['#5fc4e6', '#2f8fc4'], trim: '#eaffff', cape: '#bfeeff', boot: '#1f6a8a', emblem: '#ffffff', shape: 'frost' },
  thunder: { suit: ['#7a5ad6', '#4f36a8'], trim: '#ffd23f', cape: '#b89aff', boot: '#3a2680', emblem: '#ffe06a', shape: 'bolt' },
  storm: { suit: ['#3fb06a', '#1f8047'], trim: '#eaffea', cape: '#8fe0a0', boot: '#186236', emblem: '#eaffea', shape: 'star' },
  solar: { suit: ['#ffb03f', '#e0801f'], trim: '#fff0c0', cape: '#ffd76a', boot: '#a85f14', emblem: '#fff0c0', shape: 'sun' },
  shadow: { suit: ['#3a3f66', '#22263f'], trim: '#8f9ad6', cape: '#2a2f4a', boot: '#161a2e', emblem: '#aeb8ff', shape: 'star' },
  aqua: { suit: ['#2fb0c4', '#1f7f9c'], trim: '#eaffff', cape: '#7fe6f0', boot: '#175668', emblem: '#eaffff', shape: 'wave' },
};

interface JobLook {
  top: string;
  pants: string;
  trim: string;
  boot: string;
  detail: 'fire' | 'police' | 'build' | 'space' | 'doctor' | 'army' | 'chef' | 'racer';
}
const JOB_LOOKS: Record<string, JobLook> = {
  fire: { top: '#c9993f', pants: '#3a3a3a', trim: '#ffe23f', boot: '#222222', detail: 'fire' },
  police: { top: '#2f3f66', pants: '#26324f', trim: '#ffd23f', boot: '#1a1a1a', detail: 'police' },
  build: { top: '#ff8a1f', pants: '#c9a15a', trim: '#fff0a0', boot: '#6a4a24', detail: 'build' },
  space: { top: '#eef2f6', pants: '#eef2f6', trim: '#5a86c4', boot: '#9aa6b4', detail: 'space' },
  doctor: { top: '#f4f7fa', pants: '#4fa0c4', trim: '#e2503a', boot: '#ffffff', detail: 'doctor' },
  army: { top: '#5f6a3a', pants: '#4a5230', trim: '#39412450', boot: '#3a3220', detail: 'army' },
  chef: { top: '#f4f4ee', pants: '#3a3a3a', trim: '#e2503a', boot: '#222222', detail: 'chef' },
  racer: { top: '#e23f3a', pants: '#e23f3a', trim: '#ffffff', boot: '#1a1a1a', detail: 'racer' },
};

interface SportLook {
  jersey: string;
  shorts: string;
  trim: string;
  shoe: string;
  motif: 'num' | 'dino';
}
const SPORT_LOOKS: Record<string, SportLook> = {
  blue: { jersey: '#3f74d6', shorts: '#eef2f6', trim: '#ffffff', shoe: '#ffffff', motif: 'num' },
  red: { jersey: '#e2433a', shorts: '#eef2f6', trim: '#ffffff', shoe: '#ffffff', motif: 'num' },
  dino: { jersey: '#4fae5a', shorts: '#3a5a8a', trim: '#ffffff', shoe: '#ffffff', motif: 'dino' },
};

/** The boy's outfit universe: cape/suit/uniform + torso + arms. */
function drawBoyStack(ctx: Ctx, config: AvatarConfig, skin: { base: string; shadow: string }): void {
  const family = config.outfit.slice(0, config.outfit.indexOf('-')); // hero|job|sport
  const colorway = config.outfit.slice(config.outfit.indexOf('-') + 1);
  if (family === 'hero') drawHeroSuit(ctx, colorway, skin);
  else if (family === 'job') drawJobSuit(ctx, colorway, skin);
  else drawSportSuit(ctx, colorway, skin);
}

/** The torso block of a suit — matches the chibi torso silhouette, one fill. */
function drawSuitTorso(ctx: Ctx, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(84, 120);
  ctx.quadraticCurveTo(100, 127, 116, 120);
  ctx.bezierCurveTo(120, 134, 119, 146, 117, 154);
  ctx.lineTo(83, 154);
  ctx.bezierCurveTo(81, 146, 80, 134, 84, 120);
  ctx.closePath();
  fillOutlined(ctx, fill, 0.82, 1.5);
}

/** Same, filled with a vertical gradient (hero bodysuits). */
function drawSuitTorsoGrad(ctx: Ctx, stops: [string, string]): void {
  ctx.beginPath();
  ctx.moveTo(84, 120);
  ctx.quadraticCurveTo(100, 127, 116, 120);
  ctx.bezierCurveTo(120, 134, 119, 146, 117, 154);
  ctx.lineTo(83, 154);
  ctx.bezierCurveTo(81, 146, 80, 134, 84, 120);
  ctx.closePath();
  fillGradientOutlined(ctx, stops, 120, 154, 0.8, 1.5);
}

/** Sleeved arms: long sleeves take the suit color, short stay skin + a cap. */
function drawBoyArms(
  ctx: Ctx,
  skin: { base: string; shadow: string },
  sleeveFill: string,
  short: boolean,
): void {
  for (const s of [-1, 1]) {
    const shX = 100 + s * 16;
    const handX = 100 + s * 31;
    ctx.beginPath();
    ctx.moveTo(shX - s * 2, 124);
    ctx.bezierCurveTo(shX + s * 9, 128, shX + s * 14, 142, handX + s * 2, 162);
    ctx.bezierCurveTo(handX - s * 2, 166, handX - s * 5, 162, handX - s * 4, 158);
    ctx.bezierCurveTo(shX + s * 6, 144, shX + s * 3, 132, shX - s * 4, 128);
    ctx.closePath();
    fillOutlined(ctx, short ? skin.base : sleeveFill, 0.86, 1.3);
    // mitten hand (always skin)
    ctx.beginPath();
    ctx.arc(handX, 163, 6, 0, Math.PI * 2);
    fillOutlined(ctx, skin.base, 0.86, 1.3);
    if (short) {
      // short-sleeve cap in the jersey color
      ctx.beginPath();
      ctx.moveTo(100 + s * 9, 123);
      ctx.bezierCurveTo(100 + s * 20, 123, 100 + s * 25, 130, 100 + s * 24, 138);
      ctx.quadraticCurveTo(100 + s * 16, 141, 100 + s * 9, 137);
      ctx.closePath();
      fillOutlined(ctx, sleeveFill, 0.82, 1.3);
    } else {
      // a cuff hint near the wrist
      ctx.strokeStyle = shade(sleeveFill, 0.7);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(handX - s * 7, 156);
      ctx.quadraticCurveTo(handX, 160, handX + s * 3, 157);
      ctx.stroke();
    }
  }
}

/**
 * A flowing hero cape behind the body (drawn first so the body covers its top).
 * Wide at the shoulders, tapering to a narrower billowing hem so it reads as a
 * cape flowing behind — not a skirt around the legs.
 */
function drawCape(ctx: Ctx, color: string): void {
  // Stays INSIDE the leg silhouette's height: hem ends well above the shoes
  // (feet reach ~y214) and the sides stay close to the torso, so it reads as
  // a cape hanging behind the body — never a gown wrapped around the legs.
  ctx.beginPath();
  ctx.moveTo(87, 122);
  ctx.bezierCurveTo(76, 142, 71, 168, 77, 190); // left edge
  ctx.quadraticCurveTo(84, 196, 90, 190); // billowing hem lobes
  ctx.quadraticCurveTo(100, 197, 110, 190);
  ctx.quadraticCurveTo(116, 196, 123, 190);
  ctx.bezierCurveTo(129, 168, 124, 142, 113, 122); // right edge
  ctx.closePath();
  fillGradientOutlined(ctx, [color, shade(color, 0.82)], 122, 196, 0.72, 1.8);
  // a soft center fold
  ctx.strokeStyle = shade(color, 0.82);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(100, 130);
  ctx.quadraticCurveTo(98, 160, 100, 190);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** The cape's collar peeking over the shoulders — sells the cape, drawn on top. */
function drawCapeCollar(ctx: Ctx, color: string): void {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(100 + s * 5, 118);
    ctx.lineTo(100 + s * 22, 120);
    ctx.lineTo(100 + s * 12, 132);
    ctx.closePath();
    fillOutlined(ctx, color, 0.75, 1.3);
  }
  // a round clasp at the throat
  ctx.beginPath();
  ctx.arc(100, 120, 3, 0, Math.PI * 2);
  fillOutlined(ctx, lighten(color, 0.2), 0.7, 1);
}

/** A belt band across the waist with a small buckle. */
function drawBelt(ctx: Ctx, color: string): void {
  ctx.beginPath();
  ctx.moveTo(82, 149);
  ctx.quadraticCurveTo(100, 154, 118, 149);
  ctx.lineTo(118, 157);
  ctx.quadraticCurveTo(100, 162, 82, 157);
  ctx.closePath();
  fillOutlined(ctx, color, 0.7, 1.3);
  ctx.beginPath();
  ctx.arc(100, 153, 3.2, 0, Math.PI * 2);
  fillOutlined(ctx, lighten(color, 0.3), 0.66, 1);
}

/** The chest emblem for a hero (a crisp, outlined little symbol). */
function drawEmblem(ctx: Ctx, shape: HeroLook['shape'], color: string): void {
  const cx = 100;
  const cy = 136;
  if (shape === 'bolt') {
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 9);
    ctx.lineTo(cx + 4, cy - 9);
    ctx.lineTo(cx - 0.5, cy - 1);
    ctx.lineTo(cx + 4.5, cy - 1);
    ctx.lineTo(cx - 4, cy + 10);
    ctx.lineTo(cx - 0.5, cy + 1.5);
    ctx.lineTo(cx - 4.5, cy + 1.5);
    ctx.closePath();
    fillOutlined(ctx, color, 0.7, 1.4);
  } else if (shape === 'star') {
    starPath(ctx, cx, cy, 8.5, 3.6, 5, -Math.PI / 2);
    fillOutlined(ctx, color, 0.7, 1.4);
  } else if (shape === 'flame') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.bezierCurveTo(cx + 8, cy - 1, cx + 5, cy + 8, cx, cy + 9);
    ctx.bezierCurveTo(cx - 5, cy + 8, cx - 8, cy - 1, cx, cy - 9);
    ctx.closePath();
    fillOutlined(ctx, color, 0.7, 1.4);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2);
    ctx.bezierCurveTo(cx + 4, cy + 1, cx + 2, cy + 6, cx, cy + 7);
    ctx.bezierCurveTo(cx - 2, cy + 6, cx - 4, cy + 1, cx, cy - 2);
    ctx.closePath();
    ctx.fillStyle = lighten(color, 0.45);
    ctx.fill();
  } else if (shape === 'frost') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      const dx = Math.cos(a) * 9;
      const dy = Math.sin(a) * 9;
      ctx.beginPath();
      ctx.moveTo(cx - dx, cy - dy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
    }
  } else if (shape === 'sun') {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
      ctx.lineTo(cx + Math.cos(a) * 9.5, cy + Math.sin(a) * 9.5);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    fillOutlined(ctx, color, 0.7, 1.2);
  } else {
    // wave — two stacked ripples
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (const dy of [-3, 3]) {
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + dy);
      ctx.quadraticCurveTo(cx - 4, cy + dy - 4, cx, cy + dy);
      ctx.quadraticCurveTo(cx + 4, cy + dy + 4, cx + 8, cy + dy);
      ctx.stroke();
    }
  }
}

function drawHeroSuit(ctx: Ctx, colorway: string, skin: { base: string; shadow: string }): void {
  const look = HERO_LOOKS[colorway] ?? HERO_LOOKS['bolt']!;
  drawCape(ctx, look.cape);
  drawLegs(ctx, skin, look.boot, 'plain', look.suit[0]);
  drawSuitTorsoGrad(ctx, look.suit);
  drawBelt(ctx, look.trim);
  drawBoyArms(ctx, skin, look.suit[0], false);
  drawCapeCollar(ctx, look.cape);
  drawEmblem(ctx, look.shape, look.emblem);
}

function drawJobSuit(ctx: Ctx, colorway: string, skin: { base: string; shadow: string }): void {
  const look = JOB_LOOKS[colorway] ?? JOB_LOOKS['fire']!;
  drawLegs(ctx, skin, look.boot, 'plain', look.pants);
  drawSuitTorso(ctx, look.top);
  drawBoyArms(ctx, skin, look.top, false);
  drawJobDetail(ctx, look);
}

function drawJobDetail(ctx: Ctx, look: JobLook): void {
  const d = look.detail;
  if (d === 'fire') {
    // two reflective bands across the coat + a collar
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 3;
    for (const y of [134, 146]) {
      ctx.beginPath();
      ctx.moveTo(85, y);
      ctx.quadraticCurveTo(100, y + 3, 115, y);
      ctx.stroke();
    }
    ctx.strokeStyle = shade(look.top, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(88, 123);
    ctx.quadraticCurveTo(100, 130, 112, 123);
    ctx.stroke();
  } else if (d === 'police') {
    // shirt placket + collar + a gold star badge on the left chest
    ctx.strokeStyle = shade(look.top, 0.72);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(100, 124);
    ctx.lineTo(100, 152);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(90, 123);
    ctx.lineTo(100, 129);
    ctx.lineTo(110, 123);
    ctx.stroke();
    starPath(ctx, 91, 135, 4, 1.7, 5, -Math.PI / 2);
    fillOutlined(ctx, look.trim, 0.7, 1);
  } else if (d === 'build') {
    // hi-vis reflective stripes + a chest pocket
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 2.6;
    for (const y of [136, 147]) {
      ctx.beginPath();
      ctx.moveTo(86, y);
      ctx.quadraticCurveTo(100, y + 2, 114, y);
      ctx.stroke();
    }
    for (const s of [-1, 1]) {
      ctx.strokeStyle = shade(look.top, 0.7);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(100 + s * 6, 124);
      ctx.lineTo(100 + s * 9, 148);
      ctx.stroke();
    }
  } else if (d === 'space') {
    // control panel of colored squares + a mission stripe
    const cols = ['#e2503a', '#4fae5a', '#3f74d6'];
    cols.forEach((c, i) => {
      ctx.beginPath();
      ctx.rect(92 + i * 6, 132, 4, 4);
      fillOutlined(ctx, c, 0.7, 0.9);
    });
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(85, 126);
    ctx.quadraticCurveTo(100, 131, 115, 126);
    ctx.stroke();
    // a little flag patch on the shoulder
    ctx.beginPath();
    ctx.rect(82, 127, 6, 4);
    fillOutlined(ctx, '#e2503a', 0.7, 0.8);
  } else if (d === 'doctor') {
    // white-coat lapels (V), a red cross pocket, and a stethoscope
    ctx.fillStyle = shade(look.top, 0.92);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(100, 122);
      ctx.lineTo(100 + s * 12, 124);
      ctx.lineTo(100 + s * 5, 150);
      ctx.lineTo(100, 140);
      ctx.closePath();
      ctx.fill();
    }
    // scrubs V of the shirt beneath
    ctx.fillStyle = look.pants;
    ctx.beginPath();
    ctx.moveTo(100, 122);
    ctx.lineTo(94, 124);
    ctx.lineTo(100, 138);
    ctx.lineTo(106, 124);
    ctx.closePath();
    ctx.fill();
    // stethoscope: grey tube looping from the neck + a disc
    ctx.strokeStyle = '#5a6472';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(94, 122);
    ctx.quadraticCurveTo(90, 140, 100, 146);
    ctx.quadraticCurveTo(110, 140, 106, 122);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(100, 148, 3, 0, Math.PI * 2);
    fillOutlined(ctx, '#c0c8d2', 0.7, 1);
    // red cross on the pocket
    drawCross(ctx, 110, 148, look.trim);
  } else if (d === 'army') {
    // camo blotches + a shoulder star
    const blobs: ReadonlyArray<readonly [number, number, number]> = [
      [90, 130, 5], [110, 134, 4.5], [98, 144, 5.5], [86, 146, 4], [112, 147, 4],
    ];
    ctx.fillStyle = shade(look.top, 0.72);
    for (const [x, y, r] of blobs) {
      ellipsePath(ctx, x, y, r, r * 0.8, 0.4);
      ctx.fill();
    }
    ctx.fillStyle = lighten(look.top, 0.16);
    for (const [x, y, r] of blobs) {
      ellipsePath(ctx, x + 2, y - 1, r * 0.6, r * 0.5, 0.4);
      ctx.fill();
    }
    starPath(ctx, 100, 127, 3.2, 1.4, 5, -Math.PI / 2);
    fillOutlined(ctx, '#e8c94a', 0.7, 0.9);
  } else if (d === 'chef') {
    // double-breasted button dots + a red neckerchief
    ctx.fillStyle = shade(look.top, 0.7);
    for (const s of [-1, 1]) {
      for (const y of [130, 138, 146]) {
        ctx.beginPath();
        ctx.arc(100 + s * 5, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.moveTo(94, 122);
    ctx.lineTo(106, 122);
    ctx.lineTo(100, 132);
    ctx.closePath();
    fillOutlined(ctx, look.trim, 0.72, 1.2);
  } else {
    // racer — white diagonal stripes + a star sponsor patch
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 3;
    for (const dx of [-6, 2]) {
      ctx.beginPath();
      ctx.moveTo(88 + dx, 123);
      ctx.lineTo(96 + dx, 152);
      ctx.stroke();
    }
    starPath(ctx, 108, 132, 3.4, 1.5, 5, -Math.PI / 2);
    fillOutlined(ctx, '#ffffff', 0.7, 0.9);
    drawBelt(ctx, '#1a1a1a');
  }
}

/** A little plus/cross (medical). */
function drawCross(ctx: Ctx, cx: number, cy: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.rect(cx - 1.4, cy - 4, 2.8, 8);
  ctx.rect(cx - 4, cy - 1.4, 8, 2.8);
  ctx.fill();
}

function drawShorts(ctx: Ctx, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(83, 150);
  ctx.lineTo(117, 150);
  ctx.lineTo(116, 173);
  ctx.lineTo(104, 171);
  ctx.lineTo(100, 160);
  ctx.lineTo(96, 171);
  ctx.lineTo(84, 173);
  ctx.closePath();
  fillOutlined(ctx, fill, 0.82, 1.4);
}

function drawSportSuit(ctx: Ctx, colorway: string, skin: { base: string; shadow: string }): void {
  const look = SPORT_LOOKS[colorway] ?? SPORT_LOOKS['blue']!;
  drawLegs(ctx, skin, look.shoe, 'sneaker');
  drawShorts(ctx, look.shorts);
  drawSuitTorso(ctx, look.jersey);
  drawBoyArms(ctx, skin, look.jersey, true);
  // collar
  ctx.strokeStyle = look.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(89, 123);
  ctx.quadraticCurveTo(100, 130, 111, 123);
  ctx.stroke();
  if (look.motif === 'num') {
    // a bold jersey number "1"
    ctx.fillStyle = look.trim;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', 100, 139);
  } else {
    // a small toy-dino built from simple solids so the silhouette always
    // reads: plump body + boxy head up-right + thick tail left + two legs
    ctx.save();
    ctx.translate(100, 139); // chest centre, clear of the collar
    ctx.fillStyle = look.trim;
    // tail — a thick wedge sweeping left
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.lineTo(-11.5, -1.5); // tip
    ctx.lineTo(-3, -3.5);
    ctx.closePath();
    ctx.fill();
    // legs — two sturdy stumps under the body
    ctx.fillRect(-2.5, 2.5, 3, 5.5);
    ctx.fillRect(2, 2.5, 3, 5.5);
    // body — plump oval
    ellipsePath(ctx, 0.5, -0.5, 6, 4.8, -0.15);
    ctx.fill();
    // head — rounded block up-right
    ctx.beginPath();
    ctx.moveTo(3.5, -5);
    ctx.quadraticCurveTo(3.5, -9.5, 7, -9.5); // rounded back of skull
    ctx.lineTo(10.5, -9.5);
    ctx.quadraticCurveTo(11.5, -9.5, 11.5, -8.5);
    ctx.lineTo(11.5, -5.8); // blunt snout
    ctx.lineTo(6.5, -5.8);
    ctx.lineTo(10.5, -3); // open-jaw notch → lower jaw
    ctx.lineTo(8, -1.8);
    ctx.quadraticCurveTo(4.5, -1.5, 3.5, -5); // chin back into the neck
    ctx.closePath();
    ctx.fill();
    // tiny arm + eye punched in the jersey color
    ctx.strokeStyle = look.jersey;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2.5, -0.5);
    ctx.lineTo(5, 0.8);
    ctx.stroke();
    ctx.fillStyle = look.jersey;
    ctx.beginPath();
    ctx.arc(6.8, -7.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** A soft matching slipper color for a fairy's little feet. */
function slipperFill(colorway: string): string {
  const stops = FAIRY_STOPS[colorway] ?? FAIRY_STOPS['rose']!;
  return lighten(stops[0], 0.3);
}

// ---------------------------------------------------------------- hair (back)

function drawBackHair(ctx: Ctx, style: HairStyleId, hair: { base: string; sheen: string }): void {
  const base = hair.base;
  if (style === 'crop' || style === 'spiky' || style === 'buzz' || style === 'flow' || style === 'curlytop') {
    // Short-cut back rim: hair hugs the skull from ear to ear so the front
    // cap always connects to the sideburns — without this the cut reads as a
    // detached ring floating on the crown. (Mohawk skips it: shaved sides.)
    ctx.strokeStyle = shade(base, 0.96);
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(HEAD_CX, HEAD_CY, HEAD_R, Math.PI * 0.88, Math.PI * 2.12, false);
    ctx.stroke();
    return;
  }
  if (style === 'waves') {
    // Long wavy mane flowing past the shoulders, S-curve outer edges.
    ctx.beginPath();
    ctx.moveTo(100, 32);
    ctx.bezierCurveTo(64, 30, 46, 62, 50, 96); // left crown → temple
    ctx.bezierCurveTo(42, 118, 52, 132, 44, 152); // S out
    ctx.bezierCurveTo(40, 168, 50, 182, 62, 186); // to bottom-left curl
    ctx.quadraticCurveTo(74, 196, 85, 187); // rounded hem lobes
    ctx.quadraticCurveTo(100, 198, 115, 187);
    ctx.quadraticCurveTo(126, 196, 138, 186);
    ctx.bezierCurveTo(150, 182, 160, 168, 156, 152);
    ctx.bezierCurveTo(148, 132, 158, 118, 150, 96);
    ctx.bezierCurveTo(154, 62, 136, 30, 100, 32);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.8);
    // wave ridge accents
    ctx.strokeStyle = shade(base, 0.82);
    ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(100 + s * 46, 104);
      ctx.bezierCurveTo(100 + s * 54, 124, 100 + s * 42, 140, 100 + s * 52, 162);
      ctx.stroke();
    }
  } else if (style === 'bob') {
    // Chin-length rounded mass hugging the head.
    ctx.beginPath();
    ctx.moveTo(100, 30);
    ctx.bezierCurveTo(60, 30, 46, 62, 48, 96);
    ctx.bezierCurveTo(48, 116, 58, 130, 72, 132); // inward curl left
    ctx.bezierCurveTo(80, 134, 88, 130, 100, 130);
    ctx.bezierCurveTo(112, 130, 120, 134, 128, 132);
    ctx.bezierCurveTo(142, 130, 152, 116, 152, 96);
    ctx.bezierCurveTo(154, 62, 140, 30, 100, 30);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.8);
  } else if (style === 'curls') {
    // Rounded cloud of curl lobes framing the whole head — a bumpy halo of
    // overlapping circles a little wider than the skull.
    const lobes: ReadonlyArray<readonly [number, number, number]> = [
      [100, 30, 20],
      [70, 40, 17],
      [130, 40, 17],
      [54, 66, 16],
      [146, 66, 16],
      [52, 92, 15],
      [148, 92, 15],
      [62, 116, 14],
      [138, 116, 14],
      [82, 128, 13],
      [118, 128, 13],
    ];
    for (const [x, y, r] of lobes) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      fillOutlined(ctx, base, 0.8, 1.6);
    }
  } else if (style === 'pixie') {
    // Short crop: a snug cap that tapers to a little point at the nape.
    ctx.beginPath();
    ctx.moveTo(100, 32);
    ctx.bezierCurveTo(66, 32, 52, 58, 54, 88);
    ctx.bezierCurveTo(55, 102, 62, 112, 74, 116); // left nape taper
    ctx.quadraticCurveTo(100, 122, 126, 116); // rounded nape
    ctx.bezierCurveTo(138, 112, 145, 102, 146, 88);
    ctx.bezierCurveTo(148, 58, 134, 32, 100, 32);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.8);
  } else if (style === 'longstraight') {
    // Very long straight curtain falling well past the shoulders, gentle taper.
    ctx.beginPath();
    ctx.moveTo(100, 30);
    ctx.bezierCurveTo(58, 30, 46, 60, 48, 96);
    ctx.lineTo(44, 150);
    ctx.bezierCurveTo(43, 178, 46, 200, 50, 214); // left edge down
    ctx.quadraticCurveTo(62, 220, 74, 214); // hem lobes
    ctx.quadraticCurveTo(100, 222, 126, 214);
    ctx.quadraticCurveTo(138, 220, 150, 214);
    ctx.bezierCurveTo(154, 200, 157, 178, 156, 150); // right edge up
    ctx.lineTo(152, 96);
    ctx.bezierCurveTo(154, 60, 142, 30, 100, 30);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.8);
    // soft vertical sheen band down the centre-back
    ctx.strokeStyle = hair.sheen;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(90, 60);
    ctx.quadraticCurveTo(86, 140, 90, 206);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    // pony / bun / braids / spacebuns / sidebraid: neat cap slightly larger
    // than the skull. Braids hang from BEHIND the head here (anchored up top,
    // their attachment hidden by the head) — only the fringe is drawn in front.
    ctx.beginPath();
    ctx.arc(HEAD_CX, HEAD_CY - 2, HEAD_R + 4, 0, Math.PI * 2);
    fillOutlined(ctx, base, 0.8, 1.8);
    if (style === 'braids') {
      drawBackPlait(ctx, base, -1);
      drawBackPlait(ctx, base, 1);
    } else if (style === 'sidebraid') {
      drawBackPlait(ctx, base, -1);
    }
  }
}

/**
 * One plait hanging from behind the head. The top beans sit under the head
 * silhouette (so the braid reads as anchored up top, not floating in front),
 * and the rest drapes down the side. Drawn in the back pass, before the head.
 * s = -1 hangs on the left, +1 on the right.
 */
function drawBackPlait(ctx: Ctx, base: string, s: number): void {
  const beans: ReadonlyArray<readonly [number, number, number]> = [
    [26, 58, 8.4], // tucked behind the head
    [28, 78, 8.4],
    [30, 98, 8.2],
    [34, 116, 7.8], // emerges below the head from here down
    [37, 133, 7.4],
    [39, 149, 7.0],
    [40, 165, 6.6],
  ];
  beans.forEach(([dx, y, r], i) => {
    const x = 100 + s * dx;
    const tilt = (i % 2 === 0 ? 1 : -1) * 0.4 * s;
    ellipsePath(ctx, x, y, r, r * 0.78 + 3, tilt);
    fillOutlined(ctx, base, 0.8, 1.4);
  });
  // groove hints on the visible lower part
  ctx.strokeStyle = shade(base, 0.8);
  ctx.lineWidth = 1.1;
  for (let i = 3; i < beans.length - 1; i++) {
    const [dx, y] = beans[i]!;
    const x = 100 + s * dx;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 6);
    ctx.quadraticCurveTo(x, y + 10, x + 5, y + 6);
    ctx.stroke();
  }
  // tie + tip wisp
  const [ldx, ly] = beans[beans.length - 1]!;
  const tx = 100 + s * ldx;
  const ty = ly + 11;
  ctx.beginPath();
  ctx.arc(tx, ty, 3, 0, Math.PI * 2);
  fillOutlined(ctx, '#ff8ab5', 0.78, 1.1);
  ctx.beginPath();
  ctx.moveTo(tx - 3.5, ty + 2);
  ctx.quadraticCurveTo(tx, ty + 11, tx + 3.5, ty + 2);
  ctx.closePath();
  ctx.fillStyle = shade(base, 0.9);
  ctx.fill();
}

// ---------------------------------------------------------------- outfits

function drawTail(ctx: Ctx, colorway: string): void {
  const stops = TAILS[colorway] ?? TAILS['seafoam']!;
  const dark = stops[stops.length - 1]!;

  // Fluke first (behind the tail body) — two rounded bezier lobes.
  ctx.beginPath();
  ctx.moveTo(95, 220);
  ctx.bezierCurveTo(82, 228, 64, 238, 56, 256); // out to left lobe tip
  ctx.bezierCurveTo(72, 254, 86, 248, 98, 242); // lobe curls back to notch
  ctx.quadraticCurveTo(102, 246, 106, 242); // gentle center notch
  ctx.bezierCurveTo(118, 248, 132, 254, 148, 254); // right lobe tip
  ctx.bezierCurveTo(140, 236, 122, 227, 111, 220);
  ctx.closePath();
  fillGradientOutlined(ctx, stops.map((c) => lighten(c, 0.18)), 214, 258, 0.78, 1.6);

  // Tail body: hips taper to a narrow "ankle" with a gentle sway.
  ctx.beginPath();
  ctx.moveTo(76, 144);
  ctx.bezierCurveTo(70, 172, 78, 198, 94, 224); // left edge
  ctx.lineTo(112, 224);
  ctx.bezierCurveTo(124, 198, 130, 172, 124, 144); // right edge
  ctx.closePath();
  fillGradientOutlined(ctx, stops, 144, 226, 0.78, 1.6);

  // Scale arcs, clipped to the tail body.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1.4;
  for (let row = 0; row < 3; row++) {
    const y = 162 + row * 15;
    for (let i = -3; i <= 3; i++) {
      const x = 100 + i * 12 + (row % 2 === 0 ? 0 : 6);
      ctx.beginPath();
      ctx.arc(x, y, 6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  if (colorway === 'gold') {
    // diagonal shimmer streaks
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 5;
    for (const [x, y] of [
      [86, 158],
      [104, 186],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 22, y + 30);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (colorway === 'pearl') {
    // faint iridescent pastel sheen streaks
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 6;
    for (const [x, y, c] of [
      [84, 156, '#ffd9ec'],
      [100, 180, '#d9ecff'],
      [92, 204, '#e2ffe9'],
    ] as const) {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18, y + 26);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (colorway === 'midnight') {
    const pts: ReadonlyArray<readonly [number, number, number]> = [
      [88, 160, 2.6],
      [112, 172, 2.1],
      [96, 188, 2.4],
      [116, 200, 1.9],
      [90, 212, 2.1],
      [128, 246, 2.3],
    ];
    for (const [x, y, r] of pts) sparkle(ctx, x, y, r, 0.5);
  }
}

function drawGownSkirt(ctx: Ctx, colorway: string): void {
  const [top, bottom] = GOWN_STOPS[colorway] ?? GOWN_STOPS['rose']!;

  // Darker underskirt sliver peeking at the hem.
  ctx.beginPath();
  ctx.moveTo(42, 228);
  ctx.quadraticCurveTo(100, 250, 158, 228);
  ctx.quadraticCurveTo(100, 246, 42, 228);
  ctx.lineTo(42, 236);
  ctx.quadraticCurveTo(100, 254, 158, 236);
  ctx.lineTo(158, 228);
  ctx.closePath();
  ctx.fillStyle = shade(bottom, 0.7);
  ctx.fill();

  // A-line skirt: waist flares wide to a scalloped hem around y≈235.
  ctx.beginPath();
  ctx.moveTo(86, 146);
  ctx.bezierCurveTo(62, 176, 44, 208, 36, 234); // left flare
  // scalloped hem — 4 shallow arcs
  ctx.quadraticCurveTo(52, 244, 68, 236);
  ctx.quadraticCurveTo(84, 246, 100, 238);
  ctx.quadraticCurveTo(116, 246, 132, 236);
  ctx.quadraticCurveTo(148, 244, 164, 234);
  ctx.bezierCurveTo(156, 208, 138, 176, 114, 146); // right flare
  ctx.closePath();
  fillGradientOutlined(ctx, [top, bottom], 146, 242, 0.8, 1.6);

  // soft center fold lines
  ctx.strokeStyle = shade(bottom, 0.86);
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.7;
  for (const dx of [-22, 0, 22]) {
    ctx.beginPath();
    ctx.moveTo(100 + dx * 0.35, 158);
    ctx.quadraticCurveTo(100 + dx * 0.8, 196, 100 + dx, 230);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // top-left sheen on the skirt
  ctx.strokeStyle = lighten(top, 0.45);
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(76, 162);
  ctx.quadraticCurveTo(62, 190, 54, 218);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (colorway === 'violet') {
    const pts: ReadonlyArray<readonly [number, number, number]> = [
      [72, 186, 2.4],
      [108, 172, 2.0],
      [128, 204, 2.5],
      [88, 214, 2.0],
      [116, 228, 2.2],
      [58, 222, 1.9],
    ];
    for (const [x, y, r] of pts) sparkle(ctx, x, y, r, 0.55);
  }
  if (colorway === 'gold') {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 5;
    for (const [x, y] of [
      [70, 178],
      [108, 196],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 26, y + 34);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (colorway === 'winter') {
    // tiny 6-spoke snowflakes drifting down the skirt
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1;
    const flakes: ReadonlyArray<readonly [number, number, number]> = [
      [72, 178, 3.4],
      [110, 168, 3],
      [128, 202, 3.6],
      [86, 210, 3.2],
      [118, 224, 3],
      [58, 210, 3],
      [98, 194, 3.4],
    ];
    for (const [x, y, r] of flakes) {
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (colorway === 'starlight') {
    // scattered white star dots + one bigger sparkle
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    const dots: ReadonlyArray<readonly [number, number, number]> = [
      [74, 186, 1.3],
      [110, 172, 1.1],
      [128, 206, 1.4],
      [88, 214, 1.1],
      [118, 228, 1.3],
      [58, 214, 1.1],
      [98, 198, 1],
      [136, 184, 1.2],
      [70, 232, 1],
    ];
    for (const [x, y, r] of dots) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    sparkle(ctx, 82, 176, 3.4, 0.95);
  }
}

// ---------------------------------------------------------------- body

function drawTorso(ctx: Ctx, skin: { base: string; shadow: string }): void {
  // Neck
  ctx.beginPath();
  ctx.moveTo(93, 112);
  ctx.lineTo(107, 112);
  ctx.lineTo(107, 128);
  ctx.lineTo(93, 128);
  ctx.closePath();
  ctx.fillStyle = skin.shadow;
  ctx.fill();
  // Small chibi torso — rounded trapezoid.
  ctx.beginPath();
  ctx.moveTo(85, 122);
  ctx.bezierCurveTo(80, 134, 79, 144, 80, 152);
  ctx.lineTo(120, 152);
  ctx.bezierCurveTo(121, 144, 120, 134, 115, 122);
  ctx.closePath();
  fillOutlined(ctx, skin.base, 0.86, 1.4);
}

function drawBandeau(ctx: Ctx, colorway: string): void {
  const stops = TAILS[colorway] ?? TAILS['seafoam']!;
  const c = mix(stops[0]!, stops[stops.length - 1]!, 0.4);
  // Fitted top: two soft scallop cups along the top edge, flowing down to
  // meet the tail at the hips so the silhouette stays clean.
  ctx.beginPath();
  ctx.moveTo(84, 130);
  ctx.quadraticCurveTo(92, 124.5, 100, 129.5);
  ctx.quadraticCurveTo(108, 124.5, 116, 130);
  ctx.quadraticCurveTo(119, 141, 121, 153);
  ctx.lineTo(79, 153);
  ctx.quadraticCurveTo(81, 140, 84, 130);
  ctx.closePath();
  fillOutlined(ctx, c, 0.76, 1.5);
  // little highlight
  ctx.strokeStyle = lighten(c, 0.45);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(93, 135, 4.5, Math.PI * 1.05, Math.PI * 1.7);
  ctx.stroke();
}

function drawBodice(ctx: Ctx, colorway: string): void {
  const [top, bottom] = GOWN_STOPS[colorway] ?? GOWN_STOPS['rose']!;
  ctx.beginPath();
  ctx.moveTo(85, 120);
  ctx.quadraticCurveTo(100, 126, 115, 120); // soft neckline
  ctx.bezierCurveTo(119, 132, 118, 144, 115, 153);
  ctx.lineTo(85, 153);
  ctx.bezierCurveTo(82, 142, 81, 132, 85, 120);
  ctx.closePath();
  fillGradientOutlined(ctx, [lighten(top, 0.08), mix(top, bottom, 0.55)], 118, 152, 0.8, 1.5);
  // waist sash
  ctx.beginPath();
  ctx.moveTo(84, 146);
  ctx.quadraticCurveTo(100, 151, 116, 146);
  ctx.quadraticCurveTo(100, 157, 84, 146);
  ctx.closePath();
  ctx.fillStyle = shade(bottom, 0.85);
  ctx.fill();
}

function drawArms(
  ctx: Ctx,
  skin: { base: string; shadow: string },
  family: string,
  colorway: string,
): void {
  // Tapered arms resting at her sides, mitten hands.
  for (const s of [-1, 1]) {
    const shX = 100 + s * 16;
    const handX = 100 + s * 31;
    ctx.beginPath();
    ctx.moveTo(shX - s * 2, 124);
    ctx.bezierCurveTo(shX + s * 9, 128, shX + s * 14, 142, handX + s * 2, 162);
    ctx.bezierCurveTo(handX - s * 2, 166, handX - s * 5, 162, handX - s * 4, 158);
    ctx.bezierCurveTo(shX + s * 6, 144, shX + s * 3, 132, shX - s * 4, 128);
    ctx.closePath();
    fillOutlined(ctx, skin.base, 0.86, 1.3);
    // mitten hand
    ctx.beginPath();
    ctx.arc(handX, 163, 6, 0, Math.PI * 2);
    fillOutlined(ctx, skin.base, 0.86, 1.3);
  }
  if (family === 'gown') {
    // tiny puff sleeves over the shoulders
    const [top, bottom] = GOWN_STOPS[colorway] ?? GOWN_STOPS['rose']!;
    for (const s of [-1, 1]) {
      ellipsePath(ctx, 100 + s * 18, 126, 8.5, 7.5, s * 0.3);
      fillGradientOutlined(ctx, [lighten(top, 0.12), mix(top, bottom, 0.5)], 118, 134, 0.8, 1.4);
    }
  } else if (family === 'fairy') {
    // little petal cap sleeves in the dress colorway
    const [lite, deep] = FAIRY_STOPS[colorway] ?? FAIRY_STOPS['rose']!;
    for (const s of [-1, 1]) {
      ellipsePath(ctx, 100 + s * 18, 127, 8, 7, s * 0.35);
      fillGradientOutlined(ctx, [lighten(lite, 0.1), mix(lite, deep, 0.5)], 119, 135, 0.8, 1.3);
    }
  } else if (family === 'play') {
    // short-sleeve tee caps
    const look = PLAY_LOOKS[colorway] ?? PLAY_LOOKS['sunny']!;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(100 + s * 9, 123);
      ctx.bezierCurveTo(100 + s * 20, 123, 100 + s * 25, 130, 100 + s * 24, 138);
      ctx.quadraticCurveTo(100 + s * 16, 141, 100 + s * 9, 137);
      ctx.closePath();
      fillOutlined(ctx, look.tee, 0.82, 1.3);
      // a hint of trim at the cuff
      ctx.strokeStyle = look.trim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(100 + s * 12, 138);
      ctx.quadraticCurveTo(100 + s * 18, 141, 100 + s * 23, 138);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- fairy wings

/** Fill a wing shape translucently, then trace a brighter thin rim. */
function paintWing(
  ctx: Ctx,
  build: () => void,
  lite: string,
  deep: string,
  rim: string,
  y0: number,
  y1: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.55;
  build();
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, lite);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.8;
  build();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

/**
 * Two translucent butterfly wings behind the body — an upper forewing and a
 * smaller hindwing per side, with soft veins. They reach well past where the
 * arms rest so they always peek out.
 */
function drawWings(ctx: Ctx, colorway: string): void {
  const [lite, deep] = FAIRY_STOPS[colorway] ?? FAIRY_STOPS['rose']!;
  const rim = lighten(lite, 0.4);
  for (const s of [-1, 1]) {
    const upper = (): void => {
      ctx.beginPath();
      ctx.moveTo(100, 136);
      ctx.bezierCurveTo(100 + s * 26, 108, 100 + s * 64, 106, 100 + s * 72, 130);
      ctx.bezierCurveTo(100 + s * 77, 146, 100 + s * 58, 156, 100 + s * 32, 152);
      ctx.bezierCurveTo(100 + s * 16, 150, 100 + s * 6, 146, 100, 136);
      ctx.closePath();
    };
    paintWing(ctx, upper, lite, deep, rim, 106, 156);
    const lower = (): void => {
      ctx.beginPath();
      ctx.moveTo(100, 150);
      ctx.bezierCurveTo(100 + s * 20, 156, 100 + s * 52, 166, 100 + s * 56, 184);
      ctx.bezierCurveTo(100 + s * 57, 196, 100 + s * 40, 198, 100 + s * 24, 189);
      ctx.bezierCurveTo(100 + s * 13, 182, 100 + s * 6, 168, 100, 150);
      ctx.closePath();
    };
    paintWing(ctx, lower, lite, deep, rim, 150, 198);
    // faint veins fanning out from the body root
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = deep;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(100 + s * 8, 134);
    ctx.quadraticCurveTo(100 + s * 40, 126, 100 + s * 62, 130);
    ctx.moveTo(100 + s * 8, 140);
    ctx.quadraticCurveTo(100 + s * 34, 144, 100 + s * 52, 150);
    ctx.moveTo(100 + s * 10, 158);
    ctx.quadraticCurveTo(100 + s * 30, 170, 100 + s * 46, 184);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- fairy dress

function drawFairySkirt(ctx: Ctx, colorway: string): void {
  const [lite, deep] = FAIRY_STOPS[colorway] ?? FAIRY_STOPS['rose']!;
  // short flared skirt with a petal (pointed-scallop) hem
  ctx.beginPath();
  ctx.moveTo(85, 150);
  ctx.bezierCurveTo(76, 162, 70, 172, 66, 176); // left flare
  ctx.quadraticCurveTo(70, 188, 78, 178); // petal points along the hem
  ctx.quadraticCurveTo(86, 190, 94, 178);
  ctx.quadraticCurveTo(100, 190, 106, 178);
  ctx.quadraticCurveTo(114, 190, 122, 178);
  ctx.quadraticCurveTo(130, 188, 134, 176); // right
  ctx.bezierCurveTo(130, 172, 124, 162, 115, 150);
  ctx.closePath();
  fillGradientOutlined(ctx, [lite, deep], 150, 186, 0.8, 1.5);
  // soft fold lines
  ctx.strokeStyle = shade(deep, 0.9);
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.3;
  for (const dx of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(100 + dx * 0.4, 158);
    ctx.quadraticCurveTo(100 + dx * 0.8, 170, 100 + dx, 180);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // a little fairy shimmer
  sparkle(ctx, 80, 166, 1.8, 0.6);
  sparkle(ctx, 120, 164, 1.6, 0.55);
  sparkle(ctx, 100, 175, 1.7, 0.6);
}

function drawFairyBodice(ctx: Ctx, colorway: string): void {
  const [lite, deep] = FAIRY_STOPS[colorway] ?? FAIRY_STOPS['rose']!;
  ctx.beginPath();
  ctx.moveTo(85, 120);
  ctx.quadraticCurveTo(100, 126, 115, 120); // soft neckline
  ctx.bezierCurveTo(119, 132, 118, 144, 116, 152);
  ctx.lineTo(84, 152);
  ctx.bezierCurveTo(82, 142, 81, 132, 85, 120);
  ctx.closePath();
  fillGradientOutlined(ctx, [lighten(lite, 0.08), mix(lite, deep, 0.5)], 118, 152, 0.8, 1.5);
  // a sparkle at the neckline
  sparkle(ctx, 100, 128, 2, 0.7);
}

// ---------------------------------------------------------------- legs + shoes

type ShoeKind = 'plain' | 'maryjane' | 'sneaker';

/**
 * Chibi legs from the hem down to little rounded shoes. `legFill` defaults to
 * skin (bare legs) but a boy's suit/trousers pass their own color so the leg
 * reads as covered by the outfit.
 */
function drawLegs(
  ctx: Ctx,
  skin: { base: string; shadow: string },
  shoeFill: string,
  shoeKind: ShoeKind,
  legFill?: string,
): void {
  for (const s of [-1, 1]) {
    const lx = 100 + s * 11;
    ctx.beginPath();
    ctx.moveTo(lx - 7, 166);
    ctx.bezierCurveTo(lx - 8, 182, lx - 6, 196, lx - 5, 204);
    ctx.quadraticCurveTo(lx, 207, lx + 5, 204);
    ctx.bezierCurveTo(lx + 6, 196, lx + 8, 182, lx + 7, 166);
    ctx.closePath();
    fillOutlined(ctx, legFill ?? skin.base, 0.86, 1.3);
    drawShoe(ctx, lx, 202, s, shoeFill, shoeKind);
  }
}

/** A small rounded shoe with the toe pointing outward (`s` = side). */
function drawShoe(ctx: Ctx, cx: number, topY: number, s: number, fill: string, kind: ShoeKind): void {
  ctx.save();
  ctx.translate(cx, topY);
  ctx.scale(s, 1); // mirror so the toe points away from center
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.bezierCurveTo(-8, 3, -8, 10, -3, 12); // heel
  ctx.lineTo(6, 12);
  ctx.bezierCurveTo(12, 12, 13, 6, 10, 2); // toe
  ctx.bezierCurveTo(7, -1, 2, -1, -6, 0);
  ctx.closePath();
  fillOutlined(ctx, fill, 0.78, 1.3);
  // sole
  ctx.strokeStyle = shade(fill, 0.66);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-4, 11.4);
  ctx.lineTo(9, 11.4);
  ctx.stroke();
  if (kind === 'maryjane') {
    ctx.strokeStyle = shade(fill, 0.72);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-1, 1.5);
    ctx.quadraticCurveTo(3, 4, 6, 1.5);
    ctx.stroke();
    ctx.fillStyle = '#fff3e0';
    ctx.beginPath();
    ctx.arc(-1, 1.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'sneaker') {
    // blue laces + a little side stripe
    ctx.strokeStyle = '#5a86c4';
    ctx.lineWidth = 1;
    for (const lx of [1, 4]) {
      ctx.beginPath();
      ctx.moveTo(lx, 1.5);
      ctx.lineTo(lx + 2.4, 4.5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-3, 8);
    ctx.quadraticCurveTo(3, 9.5, 9, 7);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- play clothes

function drawPlaySkirt(ctx: Ctx, look: PlayLook): void {
  // short flared skirt
  ctx.beginPath();
  ctx.moveTo(84, 150);
  ctx.bezierCurveTo(74, 160, 66, 170, 62, 180); // left flare
  ctx.quadraticCurveTo(80, 188, 100, 184); // hem
  ctx.quadraticCurveTo(120, 188, 138, 180);
  ctx.bezierCurveTo(134, 170, 126, 160, 116, 150);
  ctx.closePath();
  fillOutlined(ctx, look.garment, 0.8, 1.5);
  // trim line along the hem
  ctx.strokeStyle = look.trim;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(64, 178);
  ctx.quadraticCurveTo(81, 185, 100, 181);
  ctx.quadraticCurveTo(119, 185, 136, 178);
  ctx.stroke();
  // soft pleat lines
  ctx.strokeStyle = shade(look.garment, 0.85);
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.3;
  for (const dx of [-12, 0, 12]) {
    ctx.beginPath();
    ctx.moveTo(100 + dx * 0.4, 158);
    ctx.quadraticCurveTo(100 + dx * 0.8, 171, 100 + dx, 182);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPlayTop(ctx: Ctx, colorway: string): void {
  const look = PLAY_LOOKS[colorway] ?? PLAY_LOOKS['sunny']!;
  // tee / top base over the torso
  ctx.beginPath();
  ctx.moveTo(84, 120);
  ctx.quadraticCurveTo(100, 127, 116, 120);
  ctx.bezierCurveTo(119, 132, 118, 145, 116, 153);
  ctx.lineTo(84, 153);
  ctx.bezierCurveTo(82, 145, 81, 132, 84, 120);
  ctx.closePath();
  const teeFill = colorway === 'sunny' ? look.garment : look.tee;
  fillOutlined(ctx, teeFill, 0.84, 1.5);

  if (colorway === 'sunny') {
    // white collar trim
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(88, 123);
    ctx.quadraticCurveTo(100, 130, 112, 123);
    ctx.stroke();
  } else if (colorway === 'berry') {
    // pink pinafore bib + straps over the cream tee
    ctx.beginPath();
    ctx.moveTo(90, 131);
    ctx.lineTo(110, 131);
    ctx.lineTo(111, 153);
    ctx.lineTo(89, 153);
    ctx.closePath();
    fillOutlined(ctx, look.garment, 0.8, 1.4);
    ctx.strokeStyle = look.garment;
    ctx.lineWidth = 4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(100 + s * 10, 132);
      ctx.lineTo(100 + s * 8, 121);
      ctx.stroke();
    }
    ctx.fillStyle = look.trim;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(100 + s * 6, 137, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // denim: striped tee with denim suspender straps (reads as overalls)
    if (look.striped) {
      ctx.strokeStyle = look.trim;
      ctx.lineWidth = 3;
      for (const y of [131, 141]) {
        ctx.beginPath();
        ctx.moveTo(84, y);
        ctx.quadraticCurveTo(100, y + 3, 116, y);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = look.garment;
    ctx.lineWidth = 4.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(100 + s * 11, 153);
      ctx.lineTo(100 + s * 8, 121);
      ctx.stroke();
    }
    ctx.fillStyle = GOLD;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(100 + s * 9, 150, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- hearts (shared)

/** Trace a rounded heart of half-width `halfW` centred at (cx, cy). */
function heartPath(ctx: Ctx, cx: number, cy: number, halfW: number): void {
  const k = halfW / 9;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-9, 0, -7.5, -7.5, -3.5, -7.5);
  ctx.bezierCurveTo(-1.2, -7.5, 0, -5.6, 0, -4.4);
  ctx.bezierCurveTo(0, -5.6, 1.2, -7.5, 3.5, -7.5);
  ctx.bezierCurveTo(7.5, -7.5, 9, 0, 0, 8);
  ctx.closePath();
  ctx.restore();
}

function drawTinyHeart(
  ctx: Ctx,
  cx: number,
  cy: number,
  halfW: number,
  fill: string,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  heartPath(ctx, cx, cy, halfW);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- earrings

function drawEarrings(ctx: Ctx, kind: EarringId, _hairStyle: HairStyleId): void {
  // The ear sits at (60, 86) / (140, 86), r7 — its lobe bottom is ~y90. Studs,
  // stars and hearts ride ON the lobe (y90) so they read as an earring on the
  // ear, not a gold dot floating mid-cheek on the hair; the pearl drop hangs
  // just below it. Painted after the hair so a bought earring is never fully
  // swallowed by a voluminous style, but kept up on the lobe for all styles.
  const ly = 90;
  for (const s of [-1, 1]) {
    const ex = 100 + s * 40;
    if (kind === 'studs') {
      ctx.beginPath();
      ctx.arc(ex, ly, 2.2, 0, Math.PI * 2);
      fillOutlined(ctx, GOLD, 0.7, 0.9);
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.arc(ex - 0.7, ly - 0.7, 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'pearl') {
      ctx.strokeStyle = GOLD_EDGE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ex, ly - 1.5);
      ctx.lineTo(ex, ly + 1.5);
      ctx.stroke();
      ellipsePath(ctx, ex, ly + 4.5, 2.4, 3, 0);
      fillOutlined(ctx, PEARL, 0.9, 0.8);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 0.8, ly + 3.6, 0.9, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'stars') {
      starPath(ctx, ex, ly, 3.4, 1.5, 5, -Math.PI / 2);
      fillOutlined(ctx, GOLD, 0.7, 0.9);
    } else {
      drawTinyHeart(ctx, ex, ly, 2.4, '#ff6f9d', 1);
    }
  }
}

// ---------------------------------------------------------------- glasses

function drawGlasses(ctx: Ctx, kind: GlassesId): void {
  const lx = 86;
  const rx = 114;
  const cy = 83; // eye centres
  if (kind === 'round') {
    for (const cx of [lx, rx]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.strokeStyle = GOLD_EDGE;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // faint lens glare
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx + 8, cy - 1);
    ctx.quadraticCurveTo(100, cy - 4, rx - 8, cy - 1); // bridge
    ctx.moveTo(lx - 8.5, cy - 0.5);
    ctx.lineTo(60, 88); // arms to the ears
    ctx.moveTo(rx + 8.5, cy - 0.5);
    ctx.lineTo(140, 88);
    ctx.stroke();
  } else if (kind === 'star') {
    const tint = '#7fd0ff';
    const edge = '#3aa0e0';
    for (const cx of [lx, rx]) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      starPath(ctx, cx, cy, 9.5, 4.6, 5, -Math.PI / 2);
      ctx.fillStyle = tint;
      ctx.fill();
      ctx.restore();
      starPath(ctx, cx, cy, 9.5, 4.6, 5, -Math.PI / 2);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(lx + 6, cy);
    ctx.lineTo(rx - 6, cy);
    ctx.moveTo(lx - 9, cy);
    ctx.lineTo(60, 88);
    ctx.moveTo(rx + 9, cy);
    ctx.lineTo(140, 88);
    ctx.stroke();
  } else {
    // heart-shaped pink sunnies
    const tint = '#ff8fbf';
    const edge = '#e0568f';
    for (const cx of [lx, rx]) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      heartPath(ctx, cx, cy - 2, 8.5);
      ctx.fillStyle = tint;
      ctx.fill();
      ctx.restore();
      heartPath(ctx, cx, cy - 2, 8.5);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(lx + 7, cy - 1);
    ctx.lineTo(rx - 7, cy - 1);
    ctx.moveTo(lx - 8, cy - 2);
    ctx.lineTo(60, 87);
    ctx.moveTo(rx + 8, cy - 2);
    ctx.lineTo(140, 87);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- held items

function drawHeld(ctx: Ctx, held: HeldId): void {
  const hx = 69; // her right hand (viewer left)
  const hy = 163;
  if (held === 'wand') {
    ctx.strokeStyle = GOLD_EDGE;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(hx + 4, hy + 8);
    ctx.lineTo(hx - 14, hy - 26);
    ctx.stroke();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx + 4, hy + 8);
    ctx.lineTo(hx - 14, hy - 26);
    ctx.stroke();
    starPath(ctx, hx - 16, hy - 31, 9, 3.8, 5, -Math.PI / 2 + 0.2);
    fillOutlined(ctx, GOLD, 0.72, 1.4);
    sparkle(ctx, hx - 27, hy - 36, 2.4, 0.9);
    sparkle(ctx, hx - 6, hy - 42, 2.0, 0.85);
    sparkle(ctx, hx - 28, hy - 22, 1.7, 0.8);
  } else if (held === 'book') {
    // small closed storybook, cover facing us
    ctx.save();
    ctx.translate(hx - 1, hy - 3);
    ctx.rotate(-0.16);
    ctx.beginPath();
    ctx.moveTo(-11, -9);
    ctx.lineTo(9, -9);
    ctx.quadraticCurveTo(12, -9, 12, -6);
    ctx.lineTo(12, 10);
    ctx.quadraticCurveTo(12, 13, 9, 13);
    ctx.lineTo(-11, 13);
    ctx.closePath();
    fillOutlined(ctx, '#d4453f', 0.72, 1.6);
    // darker spine down the left
    ctx.fillStyle = '#b5322c';
    ctx.beginPath();
    ctx.moveTo(-11, -9);
    ctx.lineTo(-6, -9);
    ctx.lineTo(-6, 13);
    ctx.lineTo(-11, 13);
    ctx.closePath();
    ctx.fill();
    // page edges peeking on the right
    ctx.fillStyle = '#fff7e8';
    ctx.beginPath();
    ctx.moveTo(12, -6);
    ctx.lineTo(14, -4);
    ctx.lineTo(14, 9);
    ctx.lineTo(12, 11);
    ctx.closePath();
    ctx.fill();
    // gold star emblem
    starPath(ctx, 2, 2, 4, 1.8, 5, -Math.PI / 2);
    fillOutlined(ctx, GOLD, 0.72, 0.9);
    // bookmark ribbon from the top
    ctx.fillStyle = '#ffd36a';
    ctx.beginPath();
    ctx.moveTo(6, -9);
    ctx.lineTo(9, -9);
    ctx.lineTo(9, 4);
    ctx.lineTo(7.5, 1.5);
    ctx.lineTo(6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (held === 'bouquet') {
    ctx.save();
    ctx.translate(hx, hy);
    // stems
    ctx.strokeStyle = '#4bae6a';
    ctx.lineWidth = 2;
    for (const dx of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.moveTo(dx * 0.4, 6);
      ctx.lineTo(dx, -14);
      ctx.stroke();
    }
    // leaves
    ctx.fillStyle = '#57c07a';
    for (const [lxx, lyy, rot] of [
      [-3, -3, -0.6],
      [4, -1, 0.6],
    ] as const) {
      ctx.save();
      ctx.translate(lxx, lyy);
      ctx.rotate(rot);
      ellipsePath(ctx, 0, 0, 2.2, 4.5, 0);
      ctx.fill();
      ctx.restore();
    }
    // blooms
    const blooms: ReadonlyArray<readonly [number, number, string]> = [
      [-7, -16, '#ff7fae'],
      [0, -21, '#ffd36a'],
      [7, -15, '#a98cff'],
    ];
    for (const [bx, by, c] of blooms) {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(a) * 3.1, by + Math.sin(a) * 3.1, 2.4, 0, Math.PI * 2);
        fillOutlined(ctx, c, 0.78, 0.9);
      }
      ctx.beginPath();
      ctx.arc(bx, by, 2, 0, Math.PI * 2);
      fillOutlined(ctx, GOLD, 0.74, 0.8);
    }
    ctx.restore();
  } else if (held === 'balloon') {
    // thin string from the hand up to a round balloon floating beside her
    ctx.strokeStyle = '#c9b98a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo(hx - 6, hy - 40, hx - 2, hy - 60);
    ctx.stroke();
    const bx = hx - 2;
    const by = hy - 74;
    ctx.beginPath();
    ctx.moveTo(bx, by + 16);
    ctx.bezierCurveTo(bx - 14, by + 12, bx - 15, by - 6, bx, by - 14);
    ctx.bezierCurveTo(bx + 15, by - 6, bx + 14, by + 12, bx, by + 16);
    ctx.closePath();
    fillOutlined(ctx, '#ff6f8f', 0.76, 1.6);
    // knot
    ctx.beginPath();
    ctx.moveTo(bx - 2.5, by + 15);
    ctx.lineTo(bx + 2.5, by + 15);
    ctx.lineTo(bx, by + 19);
    ctx.closePath();
    fillOutlined(ctx, '#e0566f', 0.8, 1);
    // gentle highlight
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ellipsePath(ctx, bx - 5, by - 5, 3, 4.5, -0.4);
    ctx.fill();
    ctx.restore();
  } else if (held === 'lantern') {
    ctx.save();
    ctx.translate(hx - 2, hy - 6);
    // handle ring
    ctx.strokeStyle = GOLD_EDGE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -14, 4, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    // star topper
    starPath(ctx, 0, -18, 4.5, 2, 5, -Math.PI / 2);
    fillOutlined(ctx, GOLD, 0.72, 1);
    // glass body
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.quadraticCurveTo(-9, 4, -6, 10);
    ctx.lineTo(6, 10);
    ctx.quadraticCurveTo(9, 4, 7, -8);
    ctx.quadraticCurveTo(0, -11, -7, -8);
    ctx.closePath();
    fillOutlined(ctx, '#ffe6a3', 0.82, 1.4);
    // warm glow
    ctx.save();
    ctx.globalAlpha = 0.9;
    const gg = ctx.createRadialGradient(0, 1, 1, 0, 1, 8);
    gg.addColorStop(0, '#fff3c4');
    gg.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(0, 1, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // little flame
    ctx.fillStyle = '#ff9a3c';
    ellipsePath(ctx, 0, 2, 2, 3.4, 0);
    ctx.fill();
    // frame caps
    ctx.strokeStyle = GOLD_EDGE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.lineTo(7, -8);
    ctx.moveTo(-6, 10);
    ctx.lineTo(6, 10);
    ctx.stroke();
    ctx.restore();
  } else {
    // plump orange-pink sea star
    ctx.save();
    ctx.translate(hx - 3, hy + 2);
    ctx.rotate(0.22);
    starPath(ctx, 0, 0, 14, 6.5, 5);
    ctx.lineJoin = 'round';
    // plump the arms: heavy same-color stroke rounds every point
    ctx.fillStyle = '#ff9b80';
    ctx.strokeStyle = '#ff9b80';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.fill();
    starPath(ctx, 0, 0, 14, 6.5, 5);
    ctx.strokeStyle = '#e3705a';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // dot texture
    ctx.fillStyle = '#ffd9c4';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 8, Math.sin(a) * 8, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 3.5, Math.sin(a) * 3.5, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- necklaces

function drawNecklace(ctx: Ctx, necklace: NecklaceId): void {
  if (necklace === 'pearls') {
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = 82 + t * 36;
      const y = 124 + Math.sin(t * Math.PI) * 8;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? PEARL : PEARL_BLUSH;
      ctx.fill();
      ctx.strokeStyle = '#e8c8d4';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    return;
  }
  if (necklace === 'ribbon') {
    // a satin choker band hugging the throat, with a little bow at centre
    const band = '#ff7aa8';
    ctx.beginPath();
    ctx.moveTo(83, 116);
    ctx.quadraticCurveTo(100, 123, 117, 116); // top edge
    ctx.lineTo(117, 119);
    ctx.quadraticCurveTo(100, 127, 83, 119); // bottom edge dips at the throat
    ctx.closePath();
    fillOutlined(ctx, band, 0.78, 1.1);
    // centred bow: two small loops + a knot
    ctx.save();
    ctx.translate(100, 120);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 4, -5, s * 10, -5, s * 10.5, -1);
      ctx.bezierCurveTo(s * 11, 3, s * 5, 4, 0, 0);
      ctx.closePath();
      fillOutlined(ctx, band, 0.76, 1);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 2.1, 0, Math.PI * 2);
    fillOutlined(ctx, shade(band, 0.86), 0.76, 1);
    ctx.restore();
    return;
  }
  if (necklace === 'starbead') {
    // a beaded strand — pastel round beads alternating with tiny gold stars,
    // a little gold star pendant swinging from the centre
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const x = 82 + t * 36;
      const y = 123 + Math.sin(t * Math.PI) * 9;
      if (i % 2 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, 2.3, 0, Math.PI * 2);
        fillOutlined(ctx, '#a9c4ff', 0.8, 0.8);
        ctx.beginPath();
        ctx.arc(x - 0.8, y - 0.8, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      } else {
        starPath(ctx, x, y, 2.5, 1.1, 5, -Math.PI / 2);
        fillOutlined(ctx, GOLD, 0.72, 0.8);
      }
    }
    // link + star pendant hanging below the lowest (centre) bead
    ctx.strokeStyle = GOLD_EDGE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 133);
    ctx.lineTo(100, 135);
    ctx.stroke();
    starPath(ctx, 100, 140, 4.6, 1.9, 5, -Math.PI / 2);
    fillOutlined(ctx, GOLD, 0.72, 1.1);
    return;
  }
  // fine gold chain for locket / heartgem
  ctx.strokeStyle = GOLD_EDGE;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(84, 122);
  ctx.quadraticCurveTo(100, 136, 116, 122);
  ctx.stroke();
  if (necklace === 'locket') {
    // small fan-shaped shell pendant
    ctx.save();
    ctx.translate(100, 131);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-7, 2, -7.5, 8, -5, 11);
    ctx.quadraticCurveTo(0, 14, 5, 11);
    ctx.bezierCurveTo(7.5, 8, 7, 2, 0, 0);
    ctx.closePath();
    fillOutlined(ctx, GOLD, 0.72, 1.2);
    ctx.strokeStyle = GOLD_EDGE;
    ctx.lineWidth = 0.9;
    for (const dx of [-3.2, 0, 3.2]) {
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.quadraticCurveTo(dx, 6, dx * 1.4, 11);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // heartgem: faceted pink heart pendant
    ctx.save();
    ctx.translate(100, 132);
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.bezierCurveTo(-9, 4, -7.5, -3.5, -3.5, -3.5);
    ctx.bezierCurveTo(-1.2, -3.5, 0, -1.6, 0, -0.4);
    ctx.bezierCurveTo(0, -1.6, 1.2, -3.5, 3.5, -3.5);
    ctx.bezierCurveTo(7.5, -3.5, 9, 4, 0, 12);
    ctx.closePath();
    fillOutlined(ctx, '#ff5f8f', 0.72, 1.2);
    // two-tone facet triangles
    ctx.fillStyle = '#ff9bbd';
    ctx.beginPath();
    ctx.moveTo(-4.5, -1.5);
    ctx.lineTo(0, 1.5);
    ctx.lineTo(-2.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3.5, -2.5);
    ctx.lineTo(1.5, 1);
    ctx.lineTo(5, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- head + face

function drawHead(ctx: Ctx, skin: { base: string; shadow: string }): void {
  // Ears barely peeking (hair usually covers most of them).
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(HEAD_CX + s * (HEAD_R - 1), HEAD_CY + 6, 7, 0, Math.PI * 2);
    fillOutlined(ctx, skin.base, 0.85, 1.3);
  }
  // Skull with a soft top-left light.
  const g = ctx.createRadialGradient(
    HEAD_CX - 14,
    HEAD_CY - 16,
    6,
    HEAD_CX,
    HEAD_CY,
    HEAD_R + 4,
  );
  g.addColorStop(0, lighten(skin.base, 0.14));
  g.addColorStop(0.7, skin.base);
  g.addColorStop(1, mix(skin.base, skin.shadow, 0.55));
  ctx.beginPath();
  ctx.arc(HEAD_CX, HEAD_CY, HEAD_R, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = shade(skin.shadow, 0.95);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawFace(
  ctx: Ctx,
  skin: { base: string; shadow: string },
  hair: { base: string; sheen: string },
  face: FaceId | null = null,
  boy = false,
): void {
  if (face === 'blushhearts') {
    // Heart-shaped cheeks stand in for the usual round blush.
    for (const s of [-1, 1]) drawTinyHeart(ctx, 100 + s * 22, 96, 3.6, '#ff7fa8', 0.9);
  } else if (!boy) {
    // blush — girls only; the boy's cheeks stay plain
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ff8fa3';
    ellipsePath(ctx, 78, 96, 6.5, 4, 0);
    ctx.fill();
    ellipsePath(ctx, 122, 96, 6.5, 4, 0);
    ctx.fill();
    ctx.restore();
  }

  // eyes — big warm ovals with double highlights (boys': a touch rounder)
  for (const s of [-1, 1]) {
    const ex = 100 + s * 14;
    ellipsePath(ctx, ex, 83, boy ? 6.6 : 6.2, boy ? 7.8 : 8.6, 0);
    ctx.fillStyle = EYE;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 2, 79.8, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(ex + 2.2, 86.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!boy) {
      // lashes at the outer corner — the girl's look only
      ctx.strokeStyle = EYE;
      ctx.lineWidth = 1.4;
      for (const [dy, len] of [
        [-3, 3.4],
        [0.5, 3.0],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(ex + s * 5.6, 81 + dy);
        ctx.quadraticCurveTo(ex + s * (5.6 + len * 0.7), 80 + dy - 1, ex + s * (5.6 + len), 79 + dy - 1.6);
        ctx.stroke();
      }
    }
  }

  // brows — thin arches; the boy's sit straighter and a touch bolder
  ctx.strokeStyle = shade(hair.base, 0.92);
  ctx.lineWidth = boy ? 2.7 : 2.2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (boy) {
      ctx.moveTo(100 + s * 8, 68);
      ctx.quadraticCurveTo(100 + s * 14, 66.2, 100 + s * 20, 67.6);
    } else {
      ctx.moveTo(100 + s * 8, 68.5);
      ctx.quadraticCurveTo(100 + s * 14, 65, 100 + s * 20, 68);
    }
    ctx.stroke();
  }

  // tiny nose
  ctx.strokeStyle = skin.shadow;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(98, 92.5);
  ctx.quadraticCurveTo(100, 94.5, 102, 92.5);
  ctx.stroke();

  // wide warm smile + lower-lip accent
  ctx.strokeStyle = '#b2543f';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(100, 95, 9, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(100, 99.5, 4.5, Math.PI * 0.25, Math.PI * 0.75);
  ctx.stroke();
  ctx.restore();

  // freckles (drawn last so they sit over cheeks and nose bridge)
  if (face === 'freckles' || face === 'sunfreckles') {
    const sun = face === 'sunfreckles';
    // a shade darker than the skin; sun-freckles lean warmer + denser
    const dot = sun ? mix(shade(skin.base, 0.78), '#c9683a', 0.4) : shade(skin.base, 0.8);
    // cheek + nose-bridge scatter, mirrored across the face
    const spots: ReadonlyArray<readonly [number, number, number]> = sun
      ? [
          [74, 92, 1.3], [79, 95, 1.4], [84, 91, 1.2], [77, 99, 1.2], [82, 96, 1.1], [72, 96, 1.1],
          [116, 91, 1.2], [121, 95, 1.4], [126, 92, 1.3], [118, 99, 1.2], [123, 96, 1.1], [128, 96, 1.1],
          [96, 90, 1.0], [100, 92, 1.1], [104, 90, 1.0],
        ]
      : [
          [76, 93, 1.3], [82, 96, 1.3], [78, 98, 1.1],
          [118, 93, 1.3], [124, 96, 1.3], [122, 98, 1.1],
          [98, 91, 1.0], [102, 91, 1.0],
        ];
    ctx.save();
    ctx.globalAlpha = sun ? 0.85 : 0.75;
    ctx.fillStyle = dot;
    for (const [x, y, r] of spots) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- hair (front)

function drawFrontHair(ctx: Ctx, style: HairStyleId, hair: { base: string; sheen: string }): void {
  const base = hair.base;
  const sheen = hair.sheen;

  const crownCap = (partX: number, edgeY: number): void => {
    // hair band over the skull: outer edge over the crown, inner edge = two
    // scallops meeting at the part.
    ctx.beginPath();
    ctx.moveTo(59, 96);
    ctx.bezierCurveTo(56, 56, 74, 34, 100, 34);
    ctx.bezierCurveTo(126, 34, 144, 56, 141, 96);
    ctx.bezierCurveTo(139, 76, 132, 62, 122, 56); // right temple → bang lobe
    ctx.bezierCurveTo(114, 51, partX + 5, edgeY - 3, partX, edgeY); // to the part
    ctx.bezierCurveTo(partX - 5, edgeY - 3, 86, 51, 78, 56);
    ctx.bezierCurveTo(68, 62, 61, 76, 59, 96);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.7);
  };

  if (style === 'waves') {
    crownCap(100, 48);
    // side strands flowing in front of the shoulders
    for (const s of [-1, 1]) {
      const x0 = 100 + s * 40;
      ctx.beginPath();
      ctx.moveTo(x0, 62);
      ctx.bezierCurveTo(x0 + s * 8, 84, x0 + s * 2, 108, x0 + s * 9, 132);
      ctx.bezierCurveTo(x0 + s * 13, 148, x0 + s * 5, 160, x0 + s * 9, 172);
      ctx.bezierCurveTo(x0 + s * 1, 168, x0 - s * 3, 156, x0 - s * 2, 144);
      ctx.bezierCurveTo(x0 - s * 3, 118, x0 - s * 8, 96, x0 - s * 6, 72);
      ctx.closePath();
      fillOutlined(ctx, base, 0.8, 1.5);
    }
  } else if (style === 'bob') {
    // full fringe with 3 shallow scallops
    ctx.beginPath();
    ctx.moveTo(56, 94);
    ctx.bezierCurveTo(54, 54, 74, 32, 100, 32);
    ctx.bezierCurveTo(126, 32, 146, 54, 144, 94);
    ctx.bezierCurveTo(142, 78, 136, 66, 130, 62);
    ctx.quadraticCurveTo(122, 70, 113, 63);
    ctx.quadraticCurveTo(106, 70, 96, 63);
    ctx.quadraticCurveTo(86, 70, 74, 62);
    ctx.bezierCurveTo(66, 66, 58, 78, 56, 94);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.7);
    // side curtains hugging the face, curling inward at the chin
    for (const s of [-1, 1]) {
      const x0 = 100 + s * 43;
      ctx.beginPath();
      ctx.moveTo(x0, 66);
      ctx.bezierCurveTo(x0 + s * 9, 84, x0 + s * 9, 106, x0 + s * 3, 122);
      ctx.bezierCurveTo(x0, 130, x0 - s * 10, 132, x0 - s * 15, 127); // inward curl
      ctx.bezierCurveTo(x0 - s * 8, 124, x0 - s * 4, 118, x0 - s * 5, 108);
      ctx.bezierCurveTo(x0 - s * 6, 92, x0 - s * 8, 78, x0 - s * 7, 70);
      ctx.closePath();
      fillOutlined(ctx, base, 0.8, 1.5);
    }
  } else if (style === 'pony') {
    // swept bangs — one big sweep from left temple to right brow
    ctx.beginPath();
    ctx.moveTo(59, 96);
    ctx.bezierCurveTo(56, 56, 74, 34, 100, 34);
    ctx.bezierCurveTo(126, 34, 144, 56, 141, 92);
    ctx.bezierCurveTo(139, 70, 132, 58, 124, 54);
    ctx.bezierCurveTo(108, 66, 84, 70, 70, 62); // sweep edge
    ctx.bezierCurveTo(64, 70, 60, 82, 59, 96);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.7);
    // high ponytail arcing from the crown to the side
    ctx.beginPath();
    ctx.moveTo(120, 44);
    ctx.bezierCurveTo(146, 34, 166, 52, 162, 84);
    ctx.bezierCurveTo(160, 104, 152, 118, 148, 130); // outer edge down
    ctx.bezierCurveTo(158, 132, 162, 140, 154, 144); // curl tip
    ctx.bezierCurveTo(147, 146, 141, 140, 143, 132);
    ctx.bezierCurveTo(142, 116, 146, 100, 146, 86);
    ctx.bezierCurveTo(146, 62, 136, 52, 124, 54);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.6);
    // hair tie band
    ctx.save();
    ctx.translate(126, 48);
    ctx.rotate(-0.5);
    ellipsePath(ctx, 0, 0, 4, 7.5, 0);
    fillOutlined(ctx, shade(base, 0.68), 0.8, 1.2);
    ctx.restore();
    // sheen along the ponytail
    ctx.strokeStyle = sheen;
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(138, 50);
    ctx.bezierCurveTo(154, 56, 156, 76, 152, 96);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (style === 'bun') {
    // bun on top (behind the smooth cap edge)
    ctx.beginPath();
    ctx.arc(100, 36, 15, 0, Math.PI * 2);
    fillOutlined(ctx, base, 0.8, 1.6);
    ctx.strokeStyle = sheen;
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(100, 36, 9.5, Math.PI * 0.85, Math.PI * 1.9);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // neat pulled-back cap: smooth hairline
    ctx.beginPath();
    ctx.moveTo(59, 96);
    ctx.bezierCurveTo(56, 56, 74, 34, 100, 34);
    ctx.bezierCurveTo(126, 34, 144, 56, 141, 96);
    ctx.bezierCurveTo(138, 72, 126, 56, 100, 55); // smooth hairline curve
    ctx.bezierCurveTo(74, 56, 62, 72, 59, 96);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.7);
    // pulled-back strand lines
    ctx.strokeStyle = shade(base, 0.82);
    ctx.lineWidth = 1.3;
    for (const dx of [-16, 0, 16]) {
      ctx.beginPath();
      ctx.moveTo(100 + dx, dx === 0 ? 54 : 58);
      ctx.quadraticCurveTo(100 + dx * 0.4, 44, 100 + dx * 0.15, 40);
      ctx.stroke();
    }
  } else if (style === 'curls') {
    // Bouncy fringe of curl lobes across the forehead with a couple framing
    // the temples, plus a few spiral hints so the curls read as curls.
    const fringe: ReadonlyArray<readonly [number, number, number]> = [
      [78, 60, 11],
      [92, 56, 12],
      [108, 57, 12],
      [122, 61, 11],
      [66, 74, 9],
      [134, 74, 9],
    ];
    for (const [x, y, r] of fringe) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      fillOutlined(ctx, base, 0.8, 1.5);
    }
    // little inward spirals catch the light like ringlets
    ctx.strokeStyle = shade(base, 0.82);
    ctx.lineWidth = 1.3;
    for (const [x, y] of [
      [92, 56],
      [108, 57],
      [66, 74],
      [134, 74],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 4.6, Math.PI * 0.2, Math.PI * 1.8);
      ctx.stroke();
    }
  } else if (style === 'pixie') {
    // Short crop: a side-swept fringe across the brow with a wispy tip and a
    // little sideburn flick; no length anywhere.
    ctx.beginPath();
    ctx.moveTo(56, 94);
    ctx.bezierCurveTo(52, 54, 72, 33, 100, 33);
    ctx.bezierCurveTo(128, 33, 148, 54, 144, 92);
    ctx.bezierCurveTo(142, 70, 133, 58, 123, 55);
    ctx.bezierCurveTo(103, 69, 80, 71, 64, 60); // sweep across the brow
    ctx.bezierCurveTo(59, 70, 57, 82, 56, 94);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.7);
    // wispy fringe tip trailing toward the right brow
    ctx.beginPath();
    ctx.moveTo(122, 56);
    ctx.quadraticCurveTo(112, 66, 99, 71);
    ctx.quadraticCurveTo(110, 65, 117, 59);
    ctx.closePath();
    ctx.fillStyle = shade(base, 0.9);
    ctx.fill();
    // little sideburn flicks in front of each ear
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(100 + s * 44, 66);
      ctx.quadraticCurveTo(100 + s * 47, 78, 100 + s * 39, 88);
      ctx.quadraticCurveTo(100 + s * 44, 76, 100 + s * 42, 66);
      ctx.closePath();
      fillOutlined(ctx, base, 0.8, 1.3);
    }
  } else if (style === 'longstraight') {
    // Centre-part crown + two long sleek panels framing the face and falling
    // past the shoulders (the back curtain supplies the bulk of the length).
    crownCap(100, 48);
    for (const s of [-1, 1]) {
      const x0 = 100 + s * 44;
      ctx.beginPath();
      ctx.moveTo(x0 - s * 6, 62);
      ctx.bezierCurveTo(x0 + s * 2, 96, x0 + s * 1, 150, x0 - s * 1, 196);
      ctx.quadraticCurveTo(x0 - s * 2, 204, x0 - s * 9, 202); // rounded tip
      ctx.bezierCurveTo(x0 - s * 8, 150, x0 - s * 10, 100, x0 - s * 12, 70);
      ctx.closePath();
      fillOutlined(ctx, base, 0.8, 1.5);
      ctx.strokeStyle = sheen;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x0 - s * 4, 80);
      ctx.quadraticCurveTo(x0 - s * 3, 140, x0 - s * 4, 190);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  } else if (style === 'spacebuns') {
    // Centre part + two round buns riding high on each side, each wrapped with
    // a band and finished with a short tail.
    crownCap(100, 46);
    for (const s of [-1, 1]) {
      const bx = 100 + s * 34;
      const by = 40;
      // short tail wisp poking out under the bun
      ctx.beginPath();
      ctx.moveTo(bx - 5, by + 6);
      ctx.quadraticCurveTo(bx + s * 3, by + 22, bx + s * 11, by + 19);
      ctx.quadraticCurveTo(bx + s * 3, by + 13, bx + 5, by + 6);
      ctx.closePath();
      fillOutlined(ctx, base, 0.8, 1.3);
      // the bun
      ctx.beginPath();
      ctx.arc(bx, by, 13, 0, Math.PI * 2);
      fillOutlined(ctx, base, 0.8, 1.6);
      // wrapped band across the bun
      ctx.strokeStyle = shade(base, 0.72);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx - 12, by + 1);
      ctx.quadraticCurveTo(bx, by + 4, bx + 12, by + 1);
      ctx.stroke();
      // curl sheen
      ctx.strokeStyle = sheen;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(bx - 2, by - 2, 7, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  } else if (style === 'sidebraid') {
    // Swept fringe + one thick plait draped over her left shoulder.
    ctx.beginPath();
    ctx.moveTo(56, 94);
    ctx.bezierCurveTo(52, 54, 72, 33, 100, 33);
    ctx.bezierCurveTo(128, 33, 148, 54, 144, 92);
    ctx.bezierCurveTo(142, 70, 133, 58, 123, 55);
    ctx.bezierCurveTo(103, 69, 78, 71, 62, 60); // sweep to the left
    ctx.bezierCurveTo(58, 70, 57, 82, 56, 94);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.7);
    // the plait itself hangs from BEHIND the head (drawn in the back pass),
    // so up front we draw only the swept fringe.
  } else if (style === 'crop') {
    // classic short boy's cut: an open forehead under a THICK cap whose side
    // panels run all the way down to the ears, merging into the sideburns —
    // one connected mass of hair, never a floating ring
    ctx.beginPath();
    ctx.moveTo(57, 86);
    ctx.bezierCurveTo(53, 46, 74, 29, 100, 29);
    ctx.bezierCurveTo(126, 29, 147, 46, 143, 86); // outer edge down to ear level
    ctx.bezierCurveTo(141, 84, 139, 82, 137, 80); // around the ear notch
    ctx.bezierCurveTo(138, 68, 135, 57, 127, 52); // inner right temple
    ctx.bezierCurveTo(119, 48, 109, 46, 100, 46); // hairline across the forehead
    ctx.bezierCurveTo(91, 46, 82, 48, 76, 52);
    ctx.lineTo(72, 58); // little front flick
    ctx.bezierCurveTo(66, 62, 62, 70, 63, 80); // inner left, down to the ear
    ctx.bezierCurveTo(61, 82, 59, 84, 57, 86);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.7);
    // short sideburns in front of the ears, overlapping the cap's side panels
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(100 + s * 42, 60);
      ctx.quadraticCurveTo(100 + s * 45, 70, 100 + s * 40, 79);
      ctx.quadraticCurveTo(100 + s * 37, 70, 100 + s * 37, 61);
      ctx.closePath();
      fillOutlined(ctx, base, 0.8, 1.3);
    }
  } else if (style === 'spiky') {
    // base cap + a zig-zag of spikes over the crown
    ctx.beginPath();
    ctx.moveTo(58, 88);
    ctx.bezierCurveTo(54, 56, 74, 40, 100, 40);
    ctx.bezierCurveTo(126, 40, 146, 56, 142, 88);
    ctx.bezierCurveTo(140, 72, 133, 62, 124, 58);
    ctx.bezierCurveTo(108, 64, 84, 66, 68, 58);
    ctx.bezierCurveTo(62, 64, 59, 74, 58, 88);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.6);
    ctx.beginPath();
    ctx.moveTo(60, 62);
    ctx.lineTo(68, 38);
    ctx.lineTo(79, 54);
    ctx.lineTo(90, 32);
    ctx.lineTo(100, 50);
    ctx.lineTo(110, 32);
    ctx.lineTo(121, 54);
    ctx.lineTo(132, 38);
    ctx.lineTo(140, 62);
    ctx.bezierCurveTo(120, 55, 80, 55, 60, 62);
    ctx.closePath();
    fillOutlined(ctx, base, 0.78, 1.5);
  } else if (style === 'buzz') {
    // very short — a thin close cap with a stubbly texture and low hairline
    ctx.beginPath();
    ctx.moveTo(60, 84);
    ctx.bezierCurveTo(57, 56, 75, 42, 100, 42);
    ctx.bezierCurveTo(125, 42, 143, 56, 140, 84);
    ctx.bezierCurveTo(138, 72, 132, 64, 124, 61);
    ctx.bezierCurveTo(108, 66, 84, 67, 68, 61);
    ctx.bezierCurveTo(60, 64, 57, 72, 60, 84);
    ctx.closePath();
    fillOutlined(ctx, base, 0.85, 1.4);
    ctx.fillStyle = shade(base, 0.84);
    for (const [x, y] of [[80, 52], [100, 48], [120, 52], [90, 60], [110, 60], [100, 56]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === 'curlytop') {
    // a cluster of short curl lobes on the crown (short sides)
    const lobes: ReadonlyArray<readonly [number, number, number]> = [
      [72, 52, 11], [88, 44, 12], [104, 44, 12], [120, 52, 11],
      [80, 60, 10], [100, 56, 11], [120, 62, 10], [64, 62, 9], [136, 62, 9],
    ];
    for (const [x, y, r] of lobes) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      fillOutlined(ctx, base, 0.8, 1.4);
    }
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = sheen;
    ctx.lineWidth = 1.8;
    for (const [x, y, r] of lobes.slice(0, 4)) {
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, r * 0.5, Math.PI * 1.0, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (style === 'flow') {
    // surfer sweep: hair combed straight BACK off a high open forehead,
    // with a little side length past the ears — no fringe, no bonnet
    ctx.beginPath();
    ctx.moveTo(60, 80);
    ctx.bezierCurveTo(55, 44, 76, 28, 100, 28);
    ctx.bezierCurveTo(124, 28, 145, 44, 140, 80);
    ctx.bezierCurveTo(138, 60, 132, 50, 124, 46); // right side down
    ctx.bezierCurveTo(116, 42.5, 107, 41, 100, 41); // high hairline across
    ctx.bezierCurveTo(90, 41, 78, 44, 71, 50);
    ctx.bezierCurveTo(64, 56, 61, 68, 60, 80);
    ctx.closePath();
    fillOutlined(ctx, base, 0.8, 1.7);
    // swept-back comb strokes selling the direction
    ctx.strokeStyle = shade(base, 0.8);
    ctx.lineWidth = 1.5;
    for (const [x0, y0, cx2, cy2, x1, y1] of [
      [84, 42, 78, 36, 72, 33],
      [100, 40, 98, 34, 95, 30],
      [116, 42, 120, 36, 127, 34],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx2, cy2, x1, y1);
      ctx.stroke();
    }
    // side length past the ears
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(100 + s * 42, 64);
      ctx.quadraticCurveTo(100 + s * 51, 86, 100 + s * 40, 104);
      ctx.quadraticCurveTo(100 + s * 47, 84, 100 + s * 40, 66);
      ctx.closePath();
      fillOutlined(ctx, base, 0.8, 1.3);
    }
  } else if (style === 'mohawk') {
    // shaved sides (a faint stubble arc) + a tall central spiked strip
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = base;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(HEAD_CX, HEAD_CY - 2, HEAD_R - 1, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(91, 66);
    ctx.lineTo(89, 42);
    ctx.lineTo(96, 50);
    ctx.lineTo(98, 22);
    ctx.lineTo(104, 50);
    ctx.lineTo(111, 40);
    ctx.lineTo(109, 66);
    ctx.closePath();
    fillOutlined(ctx, base, 0.78, 1.6);
    ctx.strokeStyle = sheen;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(99, 30);
    ctx.lineTo(99, 62);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    // braids: center part + bangs. The two plaits hang from behind the head
    // (back pass) so they stay anchored up top and never cover the face.
    crownCap(100, 46);
  }
}

// ---------------------------------------------------------------- headwear

function drawHeadwear(ctx: Ctx, headwear: HeadwearId, hairStyle: HairStyleId): void {
  // On the bun style the bun owns the very top — nudge crown pieces forward.
  const topY = hairStyle === 'bun' ? 6 : 0;
  if (headwear === 'tiara') {
    ctx.save();
    ctx.translate(0, topY);
    // band
    ctx.beginPath();
    ctx.moveTo(76, 52);
    ctx.quadraticCurveTo(100, 42, 124, 52);
    ctx.quadraticCurveTo(100, 48, 76, 52);
    ctx.closePath();
    fillOutlined(ctx, GOLD, 0.72, 1.3);
    // three soft points
    for (const [x, h, w] of [
      [100, 20, 7],
      [86, 10, 5],
      [114, 10, 5],
    ] as const) {
      const baseY = x === 100 ? 45 : 48;
      ctx.beginPath();
      ctx.moveTo(x - w, baseY);
      ctx.bezierCurveTo(x - w * 0.4, baseY - h * 0.55, x - w * 0.25, baseY - h, x, baseY - h);
      ctx.bezierCurveTo(x + w * 0.25, baseY - h, x + w * 0.4, baseY - h * 0.55, x + w, baseY);
      ctx.closePath();
      fillOutlined(ctx, GOLD, 0.72, 1.3);
    }
    // gems: pink center, aqua sides
    ctx.beginPath();
    ctx.arc(100, 43, 3.2, 0, Math.PI * 2);
    fillOutlined(ctx, '#ff6fa0', 0.72, 1);
    for (const x of [86, 114]) {
      ctx.beginPath();
      ctx.arc(x, 46.5, 2.2, 0, Math.PI * 2);
      fillOutlined(ctx, '#57d0c8', 0.72, 0.9);
    }
    ctx.restore();
  } else if (headwear === 'crown') {
    ctx.save();
    ctx.translate(0, topY);
    // 5-point crown
    ctx.beginPath();
    ctx.moveTo(72, 52);
    ctx.lineTo(69, 30);
    ctx.quadraticCurveTo(78, 40, 84, 36);
    ctx.lineTo(87, 22);
    ctx.quadraticCurveTo(94, 34, 100, 33);
    ctx.quadraticCurveTo(106, 34, 113, 22);
    ctx.lineTo(116, 36);
    ctx.quadraticCurveTo(122, 40, 131, 30);
    ctx.lineTo(128, 52);
    ctx.quadraticCurveTo(100, 44, 72, 52);
    ctx.closePath();
    fillOutlined(ctx, GOLD, 0.72, 1.5);
    // base band
    ctx.beginPath();
    ctx.moveTo(71, 52);
    ctx.quadraticCurveTo(100, 43, 129, 52);
    ctx.quadraticCurveTo(100, 51, 71, 52);
    ctx.closePath();
    ctx.fillStyle = shade(GOLD, 0.85);
    ctx.fill();
    // jewel dots
    const jewels: ReadonlyArray<readonly [number, number, string]> = [
      [100, 46, '#ff6fa0'],
      [84, 48.5, '#57d0c8'],
      [116, 48.5, '#57d0c8'],
      [73, 45, '#9a6bde'],
      [127, 45, '#9a6bde'],
    ];
    for (const [x, y, c] of jewels) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      fillOutlined(ctx, c, 0.72, 0.9);
    }
    ctx.restore();
  } else if (headwear === 'flower') {
    // hibiscus above her left ear (viewer left)
    ctx.save();
    ctx.translate(66, 58);
    ctx.rotate(-0.2);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      ctx.save();
      ctx.rotate(a);
      ellipsePath(ctx, 0, -8, 5.5, 8.5, 0);
      fillOutlined(ctx, '#ff7fae', 0.78, 1.2);
      ctx.strokeStyle = '#ffb7d2';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(0, -12);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    fillOutlined(ctx, GOLD, 0.72, 1.1);
    ctx.fillStyle = GOLD_EDGE;
    for (const [dx, dy] of [
      [-1.5, -1],
      [1.5, -0.5],
      [0, 1.5],
    ] as const) {
      ctx.beginPath();
      ctx.arc(dx, dy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (headwear === 'starclip') {
    starPath(ctx, 79, 52, 8, 3.4, 5, -Math.PI / 2 + 0.25);
    fillOutlined(ctx, GOLD, 0.72, 1.3);
    sparkle(ctx, 86, 45, 1.8, 0.85);
  } else if (headwear === 'headband') {
    ctx.save();
    ctx.translate(0, topY);
    const band = '#ff8fb5';
    // band arc riding the hairline over the crown
    ctx.strokeStyle = band;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(HEAD_CX, HEAD_CY - 2, HEAD_R + 1, Math.PI * 1.14, Math.PI * 1.86);
    ctx.stroke();
    // top sheen
    ctx.strokeStyle = lighten(band, 0.4);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(HEAD_CX, HEAD_CY - 2, HEAD_R - 1, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // tiny side bow near the right end
    ctx.save();
    ctx.translate(126, 52);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 5, -5, s * 11, -5, s * 11, -0.5);
      ctx.bezierCurveTo(s * 11, 4, s * 5, 4.5, 0, 0);
      ctx.closePath();
      fillOutlined(ctx, '#ff6f9d', 0.78, 1.1);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    fillOutlined(ctx, '#ff5f8f', 0.76, 0.9);
    ctx.restore();
    ctx.restore();
  } else if (headwear === 'sunhat') {
    ctx.save();
    ctx.translate(0, topY);
    const straw = '#f0d091';
    const strawDeep = '#d8ad5f';
    // wide floppy brim
    ellipsePath(ctx, 100, 50, 52, 13, 0);
    fillGradientOutlined(ctx, [lighten(straw, 0.1), strawDeep], 38, 63, 0.8, 1.6);
    // straw texture radiating across the brim
    ctx.strokeStyle = strawDeep;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(100 + i * 6, 46);
      ctx.lineTo(100 + i * 13, 56);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // rounded crown dome
    ctx.beginPath();
    ctx.moveTo(73, 50);
    ctx.bezierCurveTo(70, 26, 130, 26, 127, 50);
    ctx.quadraticCurveTo(100, 44, 73, 50);
    ctx.closePath();
    fillGradientOutlined(ctx, [lighten(straw, 0.14), straw], 26, 52, 0.8, 1.5);
    // ribbon band round the crown base + little bow
    ctx.beginPath();
    ctx.moveTo(73, 47);
    ctx.quadraticCurveTo(100, 54, 127, 47);
    ctx.lineTo(127, 52);
    ctx.quadraticCurveTo(100, 59, 73, 52);
    ctx.closePath();
    fillOutlined(ctx, '#ff8fb5', 0.8, 1.2);
    ctx.save();
    ctx.translate(120, 50);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 5, -4, s * 10, -4, s * 10, -0.5);
      ctx.bezierCurveTo(s * 10, 4, s * 5, 4, 0, 0);
      ctx.closePath();
      fillOutlined(ctx, '#ff6f9d', 0.78, 1);
    }
    ctx.restore();
    ctx.restore();
  } else if (headwear === 'earmuffs') {
    ctx.save();
    ctx.translate(0, topY);
    const band = '#e08fb5';
    const muff = '#ffb0cf';
    // band over the crown, ends meeting the muffs at ear height
    ctx.strokeStyle = band;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(100, 76, 44, Math.PI, Math.PI * 2);
    ctx.stroke();
    // fuzzy muffs over each ear
    for (const s of [-1, 1]) {
      const mx = 100 + s * 44;
      const my = 78;
      ctx.beginPath();
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const rr = 10 + (i % 2 === 0 ? 1.6 : -0.4);
        const px = mx + Math.cos(a) * rr;
        const py = my + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      fillOutlined(ctx, muff, 0.82, 1.4);
      ctx.beginPath();
      ctx.arc(mx, my, 5.5, 0, Math.PI * 2);
      fillOutlined(ctx, shade(muff, 0.9), 0.82, 1);
    }
    ctx.restore();
  } else if (headwear === 'flowercrown') {
    ctx.save();
    ctx.translate(0, topY);
    // a ring of little blooms following the hairline
    const N = 6;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const a = Math.PI * (1.12 + t * 0.76);
      const cx = 100 + Math.cos(a) * (HEAD_R + 3);
      const cy = 78 + Math.sin(a) * (HEAD_R + 3);
      const petalC = i % 2 === 0 ? '#ff8fb5' : '#ffffff';
      for (let p = 0; p < 5; p++) {
        const pa = -Math.PI / 2 + (p * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(pa) * 3, cy + Math.sin(pa) * 3, 2.6, 0, Math.PI * 2);
        fillOutlined(ctx, petalC, 0.82, 0.9);
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      fillOutlined(ctx, GOLD, 0.74, 0.8);
    }
    ctx.restore();
  } else if (headwear === 'heromask') {
    // a domino mask across the eyes with cut-out eye holes (evenodd)
    const mask = '#232842';
    ctx.beginPath();
    ctx.moveTo(70, 76);
    ctx.quadraticCurveTo(100, 70, 130, 76);
    ctx.quadraticCurveTo(132, 92, 118, 96);
    ctx.quadraticCurveTo(100, 92, 82, 96);
    ctx.quadraticCurveTo(68, 92, 70, 76);
    ctx.closePath();
    ctx.moveTo(92, 84);
    ctx.ellipse(86, 84, 6, 7.5, 0, 0, Math.PI * 2);
    ctx.moveTo(120, 84);
    ctx.ellipse(114, 84, 6, 7.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = mask;
    ctx.fill('evenodd');
    // clean outer edge
    ctx.beginPath();
    ctx.moveTo(70, 76);
    ctx.quadraticCurveTo(100, 70, 130, 76);
    ctx.quadraticCurveTo(132, 92, 118, 96);
    ctx.quadraticCurveTo(100, 92, 82, 96);
    ctx.quadraticCurveTo(68, 92, 70, 76);
    ctx.closePath();
    ctx.strokeStyle = shade(mask, 0.7);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (headwear === 'firehelmet') {
    ctx.save();
    ctx.translate(0, topY);
    const red = '#d23a2a';
    ellipsePath(ctx, 100, 52, 45, 12, 0);
    fillOutlined(ctx, shade(red, 0.85), 0.75, 1.5);
    ctx.beginPath();
    ctx.moveTo(72, 51);
    ctx.bezierCurveTo(70, 24, 130, 24, 128, 51);
    ctx.quadraticCurveTo(100, 45, 72, 51);
    ctx.closePath();
    fillGradientOutlined(ctx, [lighten(red, 0.12), red], 24, 52, 0.78, 1.6);
    // center ridge
    ctx.strokeStyle = shade(red, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 26);
    ctx.lineTo(100, 48);
    ctx.stroke();
    // gold front shield badge
    ctx.beginPath();
    ctx.moveTo(100, 34);
    ctx.lineTo(107, 37);
    ctx.lineTo(105, 47);
    ctx.lineTo(100, 50);
    ctx.lineTo(95, 47);
    ctx.lineTo(93, 37);
    ctx.closePath();
    fillOutlined(ctx, GOLD, 0.7, 1.2);
    ctx.restore();
  } else if (headwear === 'policecap') {
    ctx.save();
    ctx.translate(0, topY);
    const navy = '#2a3560';
    // peak brim in front
    ellipsePath(ctx, 100, 58, 34, 8, 0);
    fillOutlined(ctx, shade(navy, 0.7), 0.72, 1.4);
    // band
    ctx.beginPath();
    ctx.moveTo(72, 52);
    ctx.quadraticCurveTo(100, 58, 128, 52);
    ctx.lineTo(128, 46);
    ctx.quadraticCurveTo(100, 52, 72, 46);
    ctx.closePath();
    fillOutlined(ctx, shade(navy, 0.8), 0.75, 1.3);
    // crown
    ctx.beginPath();
    ctx.moveTo(74, 47);
    ctx.bezierCurveTo(74, 28, 126, 28, 126, 47);
    ctx.quadraticCurveTo(100, 40, 74, 47);
    ctx.closePath();
    fillGradientOutlined(ctx, [lighten(navy, 0.14), navy], 28, 48, 0.78, 1.5);
    // gold badge
    starPath(ctx, 100, 40, 4.5, 2, 5, -Math.PI / 2);
    fillOutlined(ctx, GOLD, 0.7, 1);
    ctx.restore();
  } else if (headwear === 'hardhat') {
    ctx.save();
    ctx.translate(0, topY);
    const hard = '#f4b02a';
    ellipsePath(ctx, 100, 52, 42, 10, 0);
    fillOutlined(ctx, shade(hard, 0.9), 0.75, 1.5);
    ctx.beginPath();
    ctx.moveTo(76, 52);
    ctx.bezierCurveTo(74, 28, 126, 28, 124, 52);
    ctx.quadraticCurveTo(100, 46, 76, 52);
    ctx.closePath();
    fillGradientOutlined(ctx, [lighten(hard, 0.12), hard], 28, 53, 0.78, 1.6);
    ctx.strokeStyle = shade(hard, 0.82);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 30);
    ctx.lineTo(100, 50);
    ctx.moveTo(85, 34);
    ctx.quadraticCurveTo(100, 32, 115, 34);
    ctx.stroke();
    ctx.restore();
  } else if (headwear === 'ballcap') {
    ctx.save();
    ctx.translate(0, topY);
    const cap = '#3f74d6';
    // curved brim to the front
    ctx.beginPath();
    ctx.moveTo(96, 54);
    ctx.quadraticCurveTo(132, 52, 140, 60);
    ctx.quadraticCurveTo(132, 62, 96, 60);
    ctx.closePath();
    fillOutlined(ctx, shade(cap, 0.82), 0.75, 1.4);
    // crown
    ctx.beginPath();
    ctx.moveTo(72, 54);
    ctx.bezierCurveTo(70, 28, 126, 28, 124, 54);
    ctx.quadraticCurveTo(100, 47, 72, 54);
    ctx.closePath();
    fillGradientOutlined(ctx, [lighten(cap, 0.12), cap], 28, 55, 0.78, 1.5);
    // top button + seams
    ctx.beginPath();
    ctx.arc(100, 32, 2.4, 0, Math.PI * 2);
    fillOutlined(ctx, lighten(cap, 0.2), 0.75, 0.9);
    ctx.strokeStyle = shade(cap, 0.82);
    ctx.lineWidth = 1.2;
    for (const dx of [-12, 12]) {
      ctx.beginPath();
      ctx.moveTo(100, 33);
      ctx.quadraticCurveTo(100 + dx, 42, 100 + dx * 1.2, 52);
      ctx.stroke();
    }
    ctx.restore();
  } else if (headwear === 'spacehelmet') {
    // a clear bubble helmet over the whole head + a white collar ring
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(100, 82, 50, 0, Math.PI * 2);
    ctx.fillStyle = '#bfe4ff';
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#dfeeff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(100, 82, 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(100, 82, 44, Math.PI * 1.05, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
    // collar ring
    ellipsePath(ctx, 100, 122, 30, 9, 0);
    fillOutlined(ctx, '#e6edf4', 0.82, 1.6);
  } else {
    // big two-loop ribbon bow on top
    ctx.save();
    ctx.translate(100, 34 + (hairStyle === 'bun' ? 4 : 0));
    const ribbon = '#ff8ab5';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 10, -14, s * 26, -14, s * 27, -3);
      ctx.bezierCurveTo(s * 28, 7, s * 12, 10, 0, 0);
      ctx.closePath();
      fillOutlined(ctx, ribbon, 0.76, 1.5);
      // loop crease
      ctx.strokeStyle = shade(ribbon, 0.82);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s * 5, -2);
      ctx.quadraticCurveTo(s * 15, -6, s * 22, -4);
      ctx.stroke();
      // trailing tail
      ctx.beginPath();
      ctx.moveTo(s * 4, 3);
      ctx.bezierCurveTo(s * 12, 10, s * 14, 18, s * 10, 24);
      ctx.lineTo(s * 16, 22);
      ctx.bezierCurveTo(s * 20, 14, s * 14, 5, s * 7, 1);
      ctx.closePath();
      fillOutlined(ctx, shade(ribbon, 0.92), 0.78, 1.2);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    fillOutlined(ctx, shade(ribbon, 0.85), 0.76, 1.3);
    ctx.restore();
  }
}

// ================================================================ INKY
// Logical box 160×170, dome centered on x=80.

export function drawInkyInto(ctx: Ctx, config: AvatarConfig): void {
  // Fall back to violet for any legacy/unknown pet color (e.g. a pre-prefix
  // save that stored the bare 'rose' id) so Inky always paints, never crashes.
  const pet = PETS[config.petColor] ?? PETS.violet;
  const mid = mix(pet.base, pet.deep, 0.45);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // back tentacle hints
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(80 + s * 30, 104);
    ctx.bezierCurveTo(80 + s * 52, 116, 80 + s * 60, 134, 80 + s * 52, 148);
    ctx.bezierCurveTo(80 + s * 47, 152, 80 + s * 42, 148, 80 + s * 44, 142);
    ctx.bezierCurveTo(80 + s * 46, 130, 80 + s * 36, 118, 80 + s * 22, 112);
    ctx.closePath();
    fillOutlined(ctx, shade(mid, 0.88), 0.82, 1.3);
  }

  // 4 front tentacles curling outward, tips curl up (drawn before the dome
  // so the mantle edge cleanly covers their attachment).
  const tents: ReadonlyArray<readonly [number, number, number]> = [
    // [start x, reach, curl y]
    [46, -34, 1],
    [68, -14, 0.8],
    [92, 14, 0.8],
    [114, 34, 1],
  ];
  for (const [sx, reach, k] of tents) {
    const tipX = sx + reach;
    const tipY = 150 + k * 6;
    ctx.beginPath();
    ctx.moveTo(sx - 8, 100);
    ctx.bezierCurveTo(sx - 10, 124, tipX - 12, tipY - 16, tipX - 6, tipY); // outer edge
    ctx.bezierCurveTo(tipX - 4, tipY + 6, tipX + 5, tipY + 4, tipX + 6, tipY - 3); // curled tip
    ctx.bezierCurveTo(tipX + 7, tipY - 9, tipX, tipY - 10, tipX - 1, tipY - 7); // tip inner curl
    ctx.bezierCurveTo(sx + 4, tipY - 22, sx + 8, 122, sx + 8, 100); // inner edge
    ctx.closePath();
    fillOutlined(ctx, mid, 0.82, 1.4);
    // suction dots on the visible run below the mantle
    ctx.fillStyle = lighten(mid, 0.35);
    for (let i = 0; i < 3; i++) {
      const t = 0.55 + i * 0.16;
      const dx = sx + (tipX - sx) * t;
      const dy = 108 + (tipY - 112) * t;
      ctx.beginPath();
      ctx.arc(dx, dy, 2 - i * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // dome head — slightly pear-shaped, radial gradient with top-left light
  ctx.beginPath();
  ctx.moveTo(80, 18);
  ctx.bezierCurveTo(54, 18, 32, 42, 28, 76);
  ctx.bezierCurveTo(25, 100, 42, 116, 80, 117);
  ctx.bezierCurveTo(118, 116, 135, 100, 132, 76);
  ctx.bezierCurveTo(128, 42, 106, 18, 80, 18);
  ctx.closePath();
  const g = ctx.createRadialGradient(60, 52, 8, 80, 76, 92);
  g.addColorStop(0, lighten(pet.base, 0.22));
  g.addColorStop(0.55, pet.base);
  g.addColorStop(1, pet.deep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = shade(pet.deep, 0.85);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // face
  for (const s of [-1, 1]) {
    const ex = 80 + s * 19;
    ctx.beginPath();
    ctx.arc(ex, 78, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = shade(pet.deep, 0.9);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex + 1, 79.5, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = '#352a4a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 1, 77.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + 2.6, 81.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // blush
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ff9db5';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(80 + s * 30, 94, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // tiny 'w' smile
  ctx.strokeStyle = shade(pet.deep, 0.8);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(74, 95);
  ctx.quadraticCurveTo(77, 99, 80, 95);
  ctx.quadraticCurveTo(83, 99, 86, 95);
  ctx.stroke();

  // hat on top of the dome
  if (config.petHat) drawPetHat(ctx, config.petHat);

  ctx.restore();
}

function drawPetHat(ctx: Ctx, hat: PetHatId): void {
  if (hat === 'petbow') {
    ctx.save();
    ctx.translate(80, 20);
    const ribbon = '#ff6fa0';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 8, -11, s * 20, -11, s * 21, -2);
      ctx.bezierCurveTo(s * 22, 6, s * 9, 8, 0, 0);
      ctx.closePath();
      fillOutlined(ctx, ribbon, 0.76, 1.3);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    fillOutlined(ctx, shade(ribbon, 0.85), 0.76, 1.1);
    ctx.restore();
  } else if (hat === 'petflower') {
    ctx.save();
    ctx.translate(80, 16);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 3);
      ellipsePath(ctx, 0, -7, 3.6, 7, 0);
      fillOutlined(ctx, '#ffffff', 0.88, 1.1);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    fillOutlined(ctx, '#ffca3a', 0.78, 1.1);
    ctx.restore();
  } else if (hat === 'party') {
    ctx.save();
    ctx.translate(80, 0);
    // cone
    ctx.beginPath();
    ctx.moveTo(-13, 24);
    ctx.quadraticCurveTo(0, 28, 13, 24);
    ctx.lineTo(2, -8);
    ctx.quadraticCurveTo(0, -10, -2, -8);
    ctx.closePath();
    ctx.save();
    fillOutlined(ctx, '#57c7e8', 0.78, 1.4);
    ctx.clip();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(-16, 12);
    ctx.lineTo(16, 4);
    ctx.lineTo(16, 10);
    ctx.lineTo(-16, 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-16, 26);
    ctx.lineTo(16, 18);
    ctx.lineTo(16, 24);
    ctx.lineTo(-16, 32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // pompom
    ctx.beginPath();
    ctx.arc(0, -10, 4.5, 0, Math.PI * 2);
    fillOutlined(ctx, '#ff6fa0', 0.78, 1.1);
    ctx.restore();
  } else if (hat === 'petstar') {
    // a little gold star perched on the dome
    ctx.save();
    ctx.translate(80, 12);
    starPath(ctx, 0, 0, 11, 4.8, 5, -Math.PI / 2);
    fillOutlined(ctx, GOLD, 0.72, 1.4);
    starPath(ctx, 0, 0, 5.6, 2.4, 5, -Math.PI / 2);
    fillOutlined(ctx, lighten(GOLD, 0.35), 0.8, 0.8);
    sparkle(ctx, 9, -8, 2, 0.85);
    ctx.restore();
  } else if (hat === 'petwizard') {
    // small pointed wizard hat with a star + moon (kept short to fit)
    ctx.save();
    ctx.translate(80, 20);
    // cone (slightly bent tip)
    ctx.beginPath();
    ctx.moveTo(-15, 3);
    ctx.quadraticCurveTo(0, 7, 15, 3);
    ctx.lineTo(3, -18);
    ctx.quadraticCurveTo(1, -21, -2, -18);
    ctx.closePath();
    fillGradientOutlined(ctx, ['#6b5bc4', '#3f3286'], -18, 5, 0.8, 1.5);
    // brim
    ellipsePath(ctx, 0, 4, 18, 5, 0);
    fillOutlined(ctx, '#4a3a9c', 0.8, 1.4);
    // tip star
    starPath(ctx, 1, -19, 3, 1.4, 5, -Math.PI / 2);
    fillOutlined(ctx, GOLD, 0.72, 0.8);
    // little gold star on the cone
    starPath(ctx, -5, -6, 2.8, 1.2, 5, -Math.PI / 2);
    fillOutlined(ctx, GOLD, 0.72, 0.7);
    // crescent moon carved from two circles
    ctx.save();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(5, -9, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#463699';
    ctx.beginPath();
    ctx.arc(6.6, -10.2, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  } else if (hat === 'petcap') {
    // a little backwards-ish ball cap perched on the dome
    ctx.save();
    ctx.translate(80, 16);
    const cap = '#e2503a';
    // brim to the front
    ctx.beginPath();
    ctx.moveTo(-3, 3);
    ctx.quadraticCurveTo(-20, 2, -26, 8);
    ctx.quadraticCurveTo(-20, 10, -3, 8);
    ctx.closePath();
    fillOutlined(ctx, shade(cap, 0.82), 0.75, 1.2);
    // crown
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.bezierCurveTo(-16, -12, 16, -12, 16, 4);
    ctx.quadraticCurveTo(0, -2, -16, 4);
    ctx.closePath();
    fillOutlined(ctx, cap, 0.78, 1.3);
    ctx.beginPath();
    ctx.arc(0, -8, 1.8, 0, Math.PI * 2);
    fillOutlined(ctx, lighten(cap, 0.25), 0.75, 0.8);
    ctx.restore();
  } else if (hat === 'petspikes') {
    // a colorful little fin/mohawk of spikes down the crown
    ctx.save();
    ctx.translate(80, 18);
    const cols = ['#ffcf3f', '#ff8a3f', '#e2503a'];
    const spikes: ReadonlyArray<readonly [number, number]> = [
      [-14, 10], [-1, 15], [12, 11],
    ];
    spikes.forEach(([x, h], i) => {
      ctx.beginPath();
      ctx.moveTo(x - 6, 6);
      ctx.lineTo(x, 6 - h);
      ctx.lineTo(x + 6, 6);
      ctx.closePath();
      fillOutlined(ctx, cols[i % cols.length]!, 0.75, 1.2);
    });
    ctx.restore();
  } else {
    // mini 3-point gold crown
    ctx.save();
    ctx.translate(80, 14);
    ctx.beginPath();
    ctx.moveTo(-12, 8);
    ctx.lineTo(-13, -6);
    ctx.quadraticCurveTo(-7, 1, -4.5, -2);
    ctx.lineTo(0, -10);
    ctx.lineTo(4.5, -2);
    ctx.quadraticCurveTo(7, 1, 13, -6);
    ctx.lineTo(12, 8);
    ctx.quadraticCurveTo(0, 4, -12, 8);
    ctx.closePath();
    fillOutlined(ctx, GOLD, 0.72, 1.3);
    ctx.beginPath();
    ctx.arc(0, 3, 1.8, 0, Math.PI * 2);
    fillOutlined(ctx, '#ff6fa0', 0.72, 0.8);
    ctx.restore();
  }
}

// ================================================================ REX (boy pet)
// A chibi baby T-rex — same box as Inky (160×170, centred x=80), palette-swapped
// by petColor and wearing the same pet hats, so the boy's pet slots into every
// place Inky did with zero extra plumbing.

export function drawRexInto(ctx: Ctx, config: AvatarConfig): void {
  const pet = PETS[config.petColor] ?? PETS.forest;
  const belly = lighten(pet.base, 0.42);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // thick baby tail curling up behind to the right
  ctx.beginPath();
  ctx.moveTo(96, 122);
  ctx.bezierCurveTo(126, 124, 144, 116, 148, 98); // top edge to the tip
  ctx.quadraticCurveTo(150, 112, 140, 124); // rounded tip
  ctx.bezierCurveTo(128, 138, 106, 142, 92, 138);
  ctx.closePath();
  fillOutlined(ctx, shade(pet.base, 0.92), 0.82, 1.4);

  // stubby legs with round toes
  for (const s of [-1, 1]) {
    ellipsePath(ctx, 80 + s * 17, 152, 13, 10, 0);
    fillOutlined(ctx, pet.base, 0.82, 1.4);
    ctx.fillStyle = lighten(pet.base, 0.5);
    for (const t of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.arc(80 + s * 17 + t * 5.5, 159, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // small round tummy — the big head is the star, just like Inky
  ctx.beginPath();
  ellipsePath(ctx, 80, 126, 31, 28, 0);
  const bg2 = ctx.createRadialGradient(66, 110, 6, 80, 126, 42);
  bg2.addColorStop(0, lighten(pet.base, 0.18));
  bg2.addColorStop(0.6, pet.base);
  bg2.addColorStop(1, pet.deep);
  ctx.fillStyle = bg2;
  ctx.fill();
  ctx.strokeStyle = shade(pet.deep, 0.85);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // lighter belly patch with faint tummy lines
  ctx.save();
  ctx.globalAlpha = 0.9;
  ellipsePath(ctx, 80, 132, 20, 19, 0);
  ctx.fillStyle = belly;
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = shade(belly, 0.85);
  ctx.lineWidth = 1.4;
  for (const dy of [128, 136]) {
    ctx.beginPath();
    ctx.moveTo(68, dy);
    ctx.quadraticCurveTo(80, dy + 3, 92, dy);
    ctx.stroke();
  }
  ctx.restore();

  // proper little bent T-rex arms held up in front of the tummy: shoulder →
  // elbow → hand as an outlined tube, finished with two tiny claws
  for (const s of [-1, 1]) {
    const arm = (w: number, c: string): void => {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(80 + s * 25, 108);
      ctx.quadraticCurveTo(80 + s * 31, 114, 80 + s * 29, 119); // upper arm → elbow
      ctx.quadraticCurveTo(80 + s * 26, 124, 80 + s * 20, 125); // forearm → hand
      ctx.stroke();
    };
    arm(9, shade(pet.deep, 0.85)); // outline pass
    arm(6.2, pet.base); // fill pass
    // two tiny claws pointing down-in from the hand
    ctx.strokeStyle = shade(pet.deep, 0.85);
    ctx.lineWidth = 1.8;
    for (const [dx, dy] of [
      [-1.5, 4],
      [-4.5, 3],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(80 + s * 20, 125);
      ctx.lineTo(80 + s * (20 + dx), 125 + dy);
      ctx.stroke();
    }
  }

  // three soft rounded crest bumps peeking over the crown (drawn pre-head)
  for (const [x, y, r] of [[58, 26, 8], [80, 18, 9.5], [102, 26, 8]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    fillOutlined(ctx, mix(pet.base, pet.deep, 0.5), 0.82, 1.3);
  }

  // BIG dome head — same pear proportions and lighting as Inky's
  ctx.beginPath();
  ctx.moveTo(80, 20);
  ctx.bezierCurveTo(52, 20, 32, 44, 29, 74);
  ctx.bezierCurveTo(26, 98, 44, 112, 80, 113);
  ctx.bezierCurveTo(116, 112, 134, 98, 131, 74);
  ctx.bezierCurveTo(128, 44, 108, 20, 80, 20);
  ctx.closePath();
  const g = ctx.createRadialGradient(60, 50, 8, 80, 72, 90);
  g.addColorStop(0, lighten(pet.base, 0.22));
  g.addColorStop(0.55, pet.base);
  g.addColorStop(1, pet.deep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = shade(pet.deep, 0.85);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // big sparkly eyes, low on the face like Inky's
  for (const s of [-1, 1]) {
    const ex = 80 + s * 19;
    ctx.beginPath();
    ctx.arc(ex, 74, 11.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = shade(pet.deep, 0.9);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex + 1, 75.5, 5.4, 0, Math.PI * 2);
    ctx.fillStyle = '#352a2a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 1, 73, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + 2.6, 77.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // little snout bump low on the dome: two nostril dots + a happy smile
  ctx.fillStyle = shade(pet.deep, 0.8);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(80 + s * 5, 90, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = shade(pet.deep, 0.75);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(68, 96);
  ctx.quadraticCurveTo(80, 105, 92, 96);
  ctx.stroke();
  // one tiny friendly tooth — says "T-rex" without any scary
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.moveTo(85, 100.5);
  ctx.lineTo(90, 99);
  ctx.lineTo(88.4, 104);
  ctx.closePath();
  ctx.fill();

  // soft cheeks (Inky has them; so does his best friend)
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#ff9db5';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(80 + s * 31, 88, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // hat rides the crown
  if (config.petHat) drawPetHat(ctx, config.petHat);

  ctx.restore();
}

/** Paint whichever pet this reader has — Inky (girl) or Rex (boy). */
export function drawPetInto(ctx: Ctx, config: AvatarConfig): void {
  if (config.character === 'boy') drawRexInto(ctx, config);
  else drawInkyInto(ctx, config);
}

// ================================================================ Phaser wrappers

function paintTo(
  scene: Phaser.Scene,
  key: string,
  logicalW: number,
  logicalH: number,
  scale: number,
  draw: (ctx: Ctx) => void,
): string {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, logicalW * scale, logicalH * scale);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(scale, scale);
  draw(ctx);
  ctx.restore();
  tex.refresh();
  return key;
}

/** Paint the reader for `config` into texture `key` (re-paint safe). */
export function paintReader(
  scene: Phaser.Scene,
  config: AvatarConfig,
  key: string,
  scale = 2,
): string {
  return paintTo(scene, key, EVIE_W, EVIE_H, scale, (ctx) => drawReaderInto(ctx, config));
}

/** Paint the reader's pet (Inky or Rex, by character) into texture `key`. */
export function paintPet(
  scene: Phaser.Scene,
  config: AvatarConfig,
  key: string,
  scale = 2,
): string {
  return paintTo(scene, key, INKY_W, INKY_H, scale, (ctx) => drawPetInto(ctx, config));
}

/** Back-compat aliases (scenes are migrating to paintReader/paintPet). */
export const paintEvie = paintReader;
export const paintInky = paintPet;
