/**
 * Shared Phaser UI kit: reading-text styles (crisp Andika at device
 * resolution), chunky kid-sized buttons (≥60px targets), gentle animations.
 */
import Phaser from 'phaser';

export const GAME_W = 1024;
export const GAME_H = 720;

/** Font for text Evie READS — early-reader letterforms. */
export const READING_FONT = 'Andika, "Comic Sans MS", sans-serif';
/** Font stack that renders color emoji. */
export const EMOJI_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const RES = Math.min(3, (globalThis.devicePixelRatio ?? 1) * 1.5);

export function readingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 56,
  color = '#ffffff',
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: READING_FONT,
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
    })
    .setResolution(RES)
    .setOrigin(0.5);
}

export function emojiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  emoji: string,
  size = 64,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, emoji, { fontFamily: EMOJI_FONT, fontSize: `${size}px` })
    .setResolution(RES)
    .setOrigin(0.5);
}

export interface ButtonOpts {
  width?: number;
  height?: number;
  fill?: number;
  fontSize?: number;
  textColor?: string;
  emoji?: boolean;
}

export interface Button extends Phaser.GameObjects.Container {
  setEnabled(enabled: boolean): void;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

/** Chunky rounded-rect button. Whole area is tappable (min 64px tall). */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  onTap: () => void,
  opts: ButtonOpts = {},
): Button {
  const label = (opts.emoji ? emojiText : readingText)(
    scene,
    0,
    0,
    text,
    opts.fontSize ?? 44,
    opts.textColor ?? '#26323f',
  );
  const w = Math.max(opts.width ?? 0, label.width + 56, 96);
  const h = Math.max(opts.height ?? 0, label.height + 28, 72);
  const bg = scene.add.graphics();
  drawButtonBg(bg, w, h, opts.fill ?? 0xffffff);

  const container = scene.add.container(x, y, [bg, label]) as Button;
  container.bg = bg;
  container.label = label;
  container.setSize(w, h);
  container.setInteractive({ useHandCursor: true });

  let enabled = true;
  container.setEnabled = (e: boolean) => {
    enabled = e;
    container.setAlpha(e ? 1 : 0.5);
  };

  container.on('pointerdown', () => {
    if (!enabled) return;
    scene.tweens.add({ targets: container, scale: 0.92, duration: 70, yoyo: true });
  });
  container.on('pointerup', () => {
    if (!enabled) return;
    onTap();
  });
  return container;
}

function drawButtonBg(g: Phaser.GameObjects.Graphics, w: number, h: number, fill: number): void {
  g.clear();
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 20);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 20);
}

/** Gentle no-fail "hmm, not that one" wiggle. */
export function wiggle(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform): void {
  scene.tweens.add({
    targets: target,
    x: (target as unknown as { x: number }).x + 10,
    duration: 60,
    yoyo: true,
    repeat: 3,
  });
}

export function popIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform & { setScale(s: number): unknown },
  delay = 0,
): void {
  const finalScaleX = (target as unknown as { scaleX: number }).scaleX;
  target.setScale(0);
  scene.tweens.add({
    targets: target,
    scale: finalScaleX,
    delay,
    duration: 320,
    ease: 'Back.easeOut',
  });
}

/** Atmosphere particle flavor for realm backgrounds. */
export type BackgroundMood = 'bubbles' | 'motes' | 'stars';

/** Scale a 0xRRGGBB color's channels by `f` (f < 1 darkens). */
function shadeColor(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

/** Mix a 0xRRGGBB color toward white by `t` (0..1). */
function lightenColor(color: number, t: number): number {
  const mix = (c: number): number => Math.round(c + (255 - c) * t);
  return (mix((color >> 16) & 0xff) << 16) | (mix((color >> 8) & 0xff) << 8) | mix(color & 0xff);
}

/** Hue of a 0xRRGGBB color in degrees (0..360). */
function hueOf(color: number): number {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Pick a particle mood from the palette's dominant hue. */
function moodFromHue(bgTop: number): BackgroundMood {
  const h = hueOf(bgTop);
  if (h >= 70 && h < 170) return 'motes'; // greens → forest fireflies
  if (h >= 170 && h < 250) return 'bubbles'; // blues → underwater bubbles
  return 'stars'; // purples/pinks (and fallback) → twinkles
}

/** One distant rolling silhouette band (dunes/hills/spires feel). */
function drawSilhouetteBand(
  g: Phaser.GameObjects.Graphics,
  color: number,
  baseY: number,
  amp: number,
  waves: number,
): void {
  const segs = 16;
  const phase = Math.random() * Math.PI * 2;
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y =
      baseY +
      Math.sin(phase + t * Math.PI * waves) * amp +
      Math.sin(phase * 1.7 + t * Math.PI * waves * 2.3) * amp * 0.35;
    pts.push({ x: GAME_W * t, y });
  }
  pts.push({ x: GAME_W, y: GAME_H }, { x: 0, y: GAME_H });
  g.fillStyle(color, 0.55);
  g.fillPoints(pts, true);
}

/**
 * Calm generated atmosphere: ≤10 small circles animated with slow tweens
 * only (no emitters, no per-frame update work — old-iPad friendly).
 */
function addAtmosphereParticles(scene: Phaser.Scene, mood: BackgroundMood): void {
  const COUNT = 10;
  for (let i = 0; i < COUNT; i++) {
    const dur = 4000 + Math.random() * 5000; // 4–9s
    const delay = Math.random() * dur;
    if (mood === 'bubbles') {
      // Slow-rising bubbles: fade in/out over one rise so the loop-back is invisible.
      const r = 3 + Math.random() * 5;
      const x = 30 + Math.random() * (GAME_W - 60);
      const y = GAME_H * 0.4 + Math.random() * GAME_H * 0.55;
      const peak = 0.18 + Math.random() * 0.2;
      const c = scene.add.circle(x, y, r, 0xcfeeff, 1).setAlpha(0);
      scene.tweens.add({
        targets: c,
        y: y - (100 + Math.random() * 130),
        duration: dur,
        delay,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      scene.tweens.add({
        targets: c,
        alpha: peak,
        duration: dur / 2,
        delay,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (mood === 'motes') {
      // Drifting motes/fireflies: gentle wander + glow pulse in one tween.
      const r = 2 + Math.random() * 3;
      const x = 30 + Math.random() * (GAME_W - 60);
      const y = GAME_H * 0.2 + Math.random() * GAME_H * 0.7;
      const c = scene.add.circle(x, y, r, 0xfff3b0, 1).setAlpha(0.08 + Math.random() * 0.1);
      scene.tweens.add({
        targets: c,
        x: x + (Math.random() - 0.5) * 70,
        y: y + (Math.random() - 0.5) * 46,
        alpha: 0.3 + Math.random() * 0.15,
        duration: dur,
        delay: Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      // Twinkling star dots: fixed position, slow alpha pulse.
      const r = 1.5 + Math.random() * 1.8;
      const x = 20 + Math.random() * (GAME_W - 40);
      const y = 20 + Math.random() * GAME_H * 0.6;
      const c = scene.add.circle(x, y, r, 0xfff2c8, 1).setAlpha(0.1 + Math.random() * 0.08);
      scene.tweens.add({
        targets: c,
        alpha: 0.35 + Math.random() * 0.15,
        duration: dur,
        delay: Math.random() * 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}

/**
 * Layered realm background: vertical gradient, a soft high glow (sun/moon
 * feel), distant rolling silhouette bands, calm palette-matched atmosphere
 * particles, the floating ambient emoji, and a gentle edge vignette.
 * `mood` overrides the particle flavor (defaults by bgTop hue).
 */
export function drawRealmBackground(
  scene: Phaser.Scene,
  bgTop: number,
  bgBottom: number,
  ambient: string[],
  mood?: BackgroundMood,
): void {
  const g = scene.add.graphics();
  const steps = 12;
  const top = Phaser.Display.Color.IntegerToColor(bgTop);
  const bottom = Phaser.Display.Color.IntegerToColor(bgBottom);
  for (let i = 0; i < steps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, steps - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(0, (GAME_H / steps) * i, GAME_W, GAME_H / steps + 1);
  }

  // Soft radial glow high in the scene (sun/moon feel) — concentric fills
  // approximate a radial gradient; cumulative center alpha ≈ 0.13.
  const glowX = GAME_W * 0.72;
  const glowY = GAME_H * 0.18;
  const glowColor = lightenColor(bgTop, 0.75);
  for (let i = 6; i >= 1; i--) {
    g.fillStyle(glowColor, 0.022);
    g.fillCircle(glowX, glowY, 40 + i * 34);
  }

  // Distant rolling silhouette bands in darker shades of bgBottom.
  drawSilhouetteBand(g, shadeColor(bgBottom, 0.72), GAME_H * 0.68, 42, 3);
  drawSilhouetteBand(g, shadeColor(bgBottom, 0.5), GAME_H * 0.82, 54, 2);

  // Atmosphere particles behind the emoji layer.
  addAtmosphereParticles(scene, mood ?? moodFromHue(bgTop));

  for (let i = 0; i < 7; i++) {
    const e = ambient[i % ambient.length]!;
    const t = emojiText(
      scene,
      60 + Math.random() * (GAME_W - 120),
      60 + Math.random() * (GAME_H - 120),
      e,
      26 + Math.random() * 22,
    ).setAlpha(0.35);
    scene.tweens.add({
      targets: t,
      y: t.y - 14 - Math.random() * 18,
      duration: 2200 + Math.random() * 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // Gentle vignette: layered edge frames, cumulative edge alpha ≈ 0.19.
  const v = scene.add.graphics();
  const frames: ReadonlyArray<readonly [number, number]> = [
    [10, 0.05],
    [22, 0.05],
    [38, 0.04],
    [58, 0.04],
    [82, 0.03],
  ];
  for (const [d, a] of frames) {
    v.fillStyle(0x000000, a);
    v.fillRect(0, 0, GAME_W, d);
    v.fillRect(0, GAME_H - d, GAME_W, d);
    v.fillRect(0, d, d, GAME_H - 2 * d);
    v.fillRect(GAME_W - d, d, d, GAME_H - 2 * d);
  }
}

/** One-time particle texture for celebrations. */
export function ensureSparkTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('spark')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 8);
  g.generateTexture('spark', 16, 16);
  g.destroy();
}

export function confettiBurst(scene: Phaser.Scene, x: number, y: number, tint: number): void {
  ensureSparkTexture(scene);
  const emitter = scene.add.particles(x, y, 'spark', {
    speed: { min: 220, max: 520 },
    angle: { min: 200, max: 340 },
    gravityY: 900,
    lifespan: 1400,
    scale: { start: 0.9, end: 0 },
    quantity: 36,
    emitting: false,
    tint: [tint, 0xffffff, 0xffd166, 0xef476f, 0x06d6a0],
  });
  emitter.explode(36, x, y);
  scene.time.delayedCall(1600, () => emitter.destroy());
}

/**
 * A "New badge!" toast that slides down from the top and fades out. Used when
 * an achievement is earned mid-celebration. Caller stamps the chime.
 */
export function badgeToast(
  scene: Phaser.Scene,
  emoji: string,
  label: string,
  delay = 0,
): void {
  const y0 = 96;
  const c = scene.add.container(GAME_W / 2, y0 - 70).setDepth(100).setAlpha(0);
  const bg = scene.add.graphics();
  bg.fillStyle(0x241640, 0.96);
  bg.fillRoundedRect(-210, -38, 420, 76, 20);
  bg.lineStyle(2.5, 0xffe9a8, 1);
  bg.strokeRoundedRect(-210, -38, 420, 76, 20);
  c.add(bg);
  c.add(emojiText(scene, -162, 0, emoji, 46));
  c.add(readingText(scene, -122, -12, 'New badge!', 18, '#ffd27a').setOrigin(0, 0.5));
  c.add(readingText(scene, -122, 13, label, 24, '#ffffff').setOrigin(0, 0.5));
  scene.tweens.add({ targets: c, y: y0, alpha: 1, duration: 340, delay, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: c,
    alpha: 0,
    duration: 420,
    delay: delay + 2700,
    onComplete: () => c.destroy(),
  });
}
