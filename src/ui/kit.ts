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

/** Vertical gradient background + a few floating ambient emoji. */
export function drawRealmBackground(
  scene: Phaser.Scene,
  bgTop: number,
  bgBottom: number,
  ambient: string[],
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
