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
};

/** Mermaid tail colorways, top → bottom gradient stops. */
const TAILS: Record<string, string[]> = {
  seafoam: ['#39c7b6', '#2a7fb0'],
  coral: ['#ff8a76', '#e3564f'],
  violet: ['#9a6bde', '#6b3fb0'],
  midnight: ['#3a4a8a', '#1c2554'],
  gold: ['#ffd76a', '#d99a1e'],
  rainbow: ['#ff8ec4', '#a98cff', '#5ac8ff'],
};

/** Princess gown colorways, top → bottom gradient stops. */
const GOWN_STOPS: Record<string, [string, string]> = {
  rose: ['#f27ba0', '#d94f7e'],
  sky: ['#7ec4f0', '#4f8fd9'],
  mint: ['#7fd8b0', '#3fa877'],
  berry: ['#b06bd6', '#7a3fa0'],
  violet: ['#8a7fe0', '#5a4fb0'],
  gold: ['#ffd76a', '#e0a52e'],
};

const GOLD = '#f6d06a';
const GOLD_EDGE = '#c9881f';
const PEARL = '#ffffff';
const PEARL_BLUSH = '#fdeef3';
const EYE = '#3a2418';

const PETS: Record<PetColorId, { base: string; deep: string }> = {
  violet: { base: '#b06bff', deep: '#7d3fd6' },
  rose: { base: '#ff8ab5', deep: '#d65a8a' },
  sea: { base: '#5fd0c0', deep: '#2f9a8a' },
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

export function drawEvieInto(ctx: Ctx, config: AvatarConfig): void {
  const skin = SKINS[config.skin];
  const hair = HAIRS[config.hairColor];
  const mermaid = config.outfit.startsWith('tail-');
  const colorway = config.outfit.slice(config.outfit.indexOf('-') + 1);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. back hair silhouette
  drawBackHair(ctx, config.hairStyle, hair);

  // 2. outfit bottom
  if (mermaid) drawTail(ctx, colorway);
  else drawGownSkirt(ctx, colorway);

  // 3. torso, top garment, arms
  drawTorso(ctx, skin);
  if (mermaid) drawBandeau(ctx, colorway);
  else drawBodice(ctx, colorway);
  drawArms(ctx, skin, !mermaid, colorway);

  // 4. necklace (head chin overlaps its top edge)
  if (config.necklace) drawNecklace(ctx, config.necklace);

  // 6. head + 7. face
  drawHead(ctx, skin);
  drawFace(ctx, skin, hair);

  // 8. front hair
  drawFrontHair(ctx, config.hairStyle, hair);

  // held item in her right hand (viewer left) — in front of the long hair
  // so wand/star stay visible with every hairstyle.
  if (config.held) drawHeld(ctx, config.held);

  // 9. headwear
  if (config.headwear) drawHeadwear(ctx, config.headwear, config.hairStyle);

  ctx.restore();
}

// ---------------------------------------------------------------- hair (back)

function drawBackHair(ctx: Ctx, style: HairStyleId, hair: { base: string; sheen: string }): void {
  const base = hair.base;
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
  } else {
    // pony / bun / braids: neat cap slightly larger than the skull.
    ctx.beginPath();
    ctx.arc(HEAD_CX, HEAD_CY - 2, HEAD_R + 4, 0, Math.PI * 2);
    fillOutlined(ctx, base, 0.8, 1.8);
  }
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
  gown: boolean,
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
  if (gown) {
    // tiny puff sleeves over the shoulders
    const [top, bottom] = GOWN_STOPS[colorway] ?? GOWN_STOPS['rose']!;
    for (const s of [-1, 1]) {
      ellipsePath(ctx, 100 + s * 18, 126, 8.5, 7.5, s * 0.3);
      fillGradientOutlined(ctx, [lighten(top, 0.12), mix(top, bottom, 0.5)], 118, 134, 0.8, 1.4);
    }
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
    // faceted pink heart
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
): void {
  // blush
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ff8fa3';
  ellipsePath(ctx, 78, 96, 6.5, 4, 0);
  ctx.fill();
  ellipsePath(ctx, 122, 96, 6.5, 4, 0);
  ctx.fill();
  ctx.restore();

  // eyes — big warm ovals with double highlights
  for (const s of [-1, 1]) {
    const ex = 100 + s * 14;
    ellipsePath(ctx, ex, 83, 6.2, 8.6, 0);
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
    // lashes at the outer corner
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

  // brows — thin arches in the hair's shade
  ctx.strokeStyle = shade(hair.base, 0.92);
  ctx.lineWidth = 2.2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(100 + s * 8, 68.5);
    ctx.quadraticCurveTo(100 + s * 14, 65, 100 + s * 20, 68);
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

  const sheenArc = (r = HEAD_R + 1, a0 = Math.PI * 1.18, a1 = Math.PI * 1.5): void => {
    ctx.strokeStyle = sheen;
    ctx.lineWidth = 3.4;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(HEAD_CX, HEAD_CY + 4, r - 7, a0, a1);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
    sheenArc();
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
    sheenArc(HEAD_R + 3);
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
    sheenArc();
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
    sheenArc();
  } else {
    // braids: center part + two plaits framing the face
    crownCap(100, 46);
    for (const s of [-1, 1]) {
      const bx = 100 + s * 38;
      // 5 alternating bean-shaped segments, shrinking downward
      let r = 8.6;
      for (let i = 0; i < 5; i++) {
        const y = 104 + i * 15.5;
        const tilt = (i % 2 === 0 ? 1 : -1) * 0.5 * s;
        ellipsePath(ctx, bx + s * (i % 2 === 0 ? 1.5 : -1.5), y, r, r * 0.76 + 3, tilt);
        fillOutlined(ctx, base, 0.8, 1.4);
        r -= 0.75;
      }
      // tie + tip wisp
      const tieY = 104 + 4.6 * 15.5 + 8;
      ctx.beginPath();
      ctx.arc(bx, tieY, 3, 0, Math.PI * 2);
      fillOutlined(ctx, '#ff8ab5', 0.78, 1.1);
      ctx.beginPath();
      ctx.moveTo(bx - 3.5, tieY + 2);
      ctx.quadraticCurveTo(bx, tieY + 11, bx + 3.5, tieY + 2);
      ctx.closePath();
      ctx.fillStyle = shade(base, 0.9);
      ctx.fill();
      // plait groove hints
      ctx.strokeStyle = shade(base, 0.8);
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 4; i++) {
        const y = 111 + i * 15.5;
        ctx.beginPath();
        ctx.moveTo(bx - 4, y);
        ctx.quadraticCurveTo(bx, y + 3.5, bx + 4, y);
        ctx.stroke();
      }
    }
    sheenArc();
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
  const pet = PETS[config.petColor];
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

/** Paint Evie for `config` into texture `key` (re-paint safe). Returns `key`. */
export function paintEvie(
  scene: Phaser.Scene,
  config: AvatarConfig,
  key: string,
  scale = 2,
): string {
  return paintTo(scene, key, EVIE_W, EVIE_H, scale, (ctx) => drawEvieInto(ctx, config));
}

/** Paint Inky for `config` into texture `key` (re-paint safe). Returns `key`. */
export function paintInky(
  scene: Phaser.Scene,
  config: AvatarConfig,
  key: string,
  scale = 2,
): string {
  return paintTo(scene, key, INKY_W, INKY_H, scale, (ctx) => drawInkyInto(ctx, config));
}
