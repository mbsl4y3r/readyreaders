import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

export const run: RunArcadeGame = (scene, ctx: ArcadeCtx) => {
  const top = ctx.hudBottom + 6;
  const bottom = ctx.height - 6;
  const midY = (top + bottom) / 2;

  // ---- soft cove background ---------------------------------------------
  const bg = scene.add.rectangle(ctx.width / 2, midY, ctx.width, bottom - top, ctx.theme.bgTop);
  bg.setOrigin(0.5);
  ctx.layer.add(bg);
  const bgLow = scene.add.rectangle(
    ctx.width / 2,
    bottom - (bottom - top) * 0.28,
    ctx.width,
    (bottom - top) * 0.56,
    ctx.theme.bgBottom,
  );
  bgLow.setOrigin(0.5);
  bgLow.setAlpha(0.55);
  ctx.layer.add(bgLow);

  // A tinted waterline stripe for a little cheer.
  const stripe = scene.add.rectangle(ctx.width / 2, top + 4, ctx.width, 8, ctx.theme.accent);
  stripe.setOrigin(0.5, 0);
  stripe.setAlpha(0.5);
  ctx.layer.add(stripe);

  // ---- the net ----------------------------------------------------------
  const NET_Y = bottom - 70;
  const NET_HALF = 62; // finger-sized catch radius (horizontal)
  const net = emojiText(scene, ctx.width / 2, NET_Y, '🧺', 96);
  ctx.layer.add(net);
  let netX = ctx.width / 2;

  // ---- lives (hearts) ---------------------------------------------------
  const START_LIVES = 3;
  let lives = START_LIVES;
  const hearts: Phaser.GameObjects.Text[] = [];
  for (let i = 0; i < START_LIVES; i++) {
    const h = emojiText(scene, ctx.width - 40 - i * 46, top + 30, '❤️', 34);
    ctx.layer.add(h);
    hearts.push(h);
  }
  const refreshHearts = (): void => {
    for (let i = 0; i < hearts.length; i++) hearts[i]!.setAlpha(i < lives ? 1 : 0.18);
  };

  // ---- falling items ----------------------------------------------------
  const TREASURES = ['🐚', '💎', '⭐', '🪙', '🦪'];
  interface Faller {
    sprite: Phaser.GameObjects.Text;
    x: number;
    y: number;
    vy: number; // px/s
    junk: boolean;
    dead: boolean;
  }
  const fallers: Faller[] = [];

  const spawn = (): void => {
    // Treasures clearly outnumber jellyfish (~1 in 5 is junk).
    const junk = Math.random() < 0.2;
    const emoji = junk ? '🪼' : TREASURES[Math.floor(Math.random() * TREASURES.length)]!;
    const x = 60 + Math.random() * (ctx.width - 120);
    const sprite = emojiText(scene, x, top - 20, emoji, 62);
    ctx.layer.add(sprite);
    fallers.push({ sprite, x, y: top - 20, vy: fallSpeed(), junk, dead: false });
  };

  // ---- gentle difficulty ramp ------------------------------------------
  let elapsed = 0; // ms since start
  const BASE_SPEED = 90; // px/s
  const fallSpeed = (): number => {
    // ramps from ~90 to ~150 px/s over roughly two minutes
    const ramp = Math.min(60, elapsed / 2000);
    return BASE_SPEED + ramp + Math.random() * 20;
  };
  let spawnTimer = 0;
  const spawnInterval = (): number => {
    // starts ~1300ms, eases down toward ~750ms very gently
    const ramp = Math.min(550, elapsed / 220);
    return 1300 - ramp;
  };

  // ---- scoring / lifecycle ---------------------------------------------
  let score = 0;
  let over = false;
  let destroyed = false;

  const flashHeartLoss = (): void => {
    // short polish tween on the net; stopped in destroy()
    scene.tweens.add({ targets: net, angle: -12, duration: 90, yoyo: true, repeat: 1 });
  };

  const popGood = (): void => {
    scene.tweens.add({ targets: net, scale: 1.14, duration: 110, yoyo: true });
  };

  const endGame = (): void => {
    if (over) return;
    over = true;
    ctx.onGameOver(score);
  };

  // ---- input: drag the net --------------------------------------------
  const clampX = (x: number): number =>
    Phaser.Math.Clamp(x, NET_HALF, ctx.width - NET_HALF);

  let dragging = false;
  const onPointerDown = (p: Phaser.Input.Pointer): void => {
    if (over) return;
    dragging = true;
    netX = clampX(p.x);
  };
  const onPointerMove = (p: Phaser.Input.Pointer): void => {
    if (over) return;
    if (!dragging && !p.isDown) return;
    netX = clampX(p.x);
  };
  const onPointerUp = (): void => {
    dragging = false;
  };
  scene.input.on('pointerdown', onPointerDown, this);
  scene.input.on('pointermove', onPointerMove, this);
  scene.input.on('pointerup', onPointerUp, this);

  refreshHearts();

  return {
    update(_time: number, delta: number): void {
      if (over || destroyed) return;
      const dt = delta / 1000;
      elapsed += delta;

      // move net toward target (smooth but responsive)
      net.x += (netX - net.x) * Math.min(1, dt * 18);

      // spawn on our own accumulator
      spawnTimer += delta;
      if (spawnTimer >= spawnInterval()) {
        spawnTimer = 0;
        spawn();
      }

      const catchTop = NET_Y - 46;
      const catchBot = NET_Y + 30;

      for (const f of fallers) {
        if (f.dead) continue;
        f.y += f.vy * dt;
        f.sprite.y = f.y;

        // caught in the net?
        if (
          f.y >= catchTop &&
          f.y <= catchBot &&
          Math.abs(f.x - net.x) <= NET_HALF
        ) {
          f.dead = true;
          f.sprite.destroy();
          if (f.junk) {
            lives -= 1;
            refreshHearts();
            flashHeartLoss();
            chime('gentle');
            if (lives <= 0) {
              endGame();
              return;
            }
          } else {
            score += 1;
            ctx.onScore(score);
            popGood();
            chime('good');
          }
          continue;
        }

        // fell past the bottom — no penalty, just remove
        if (f.y > bottom + 40) {
          f.dead = true;
          f.sprite.destroy();
        }
      }

      // compact the list occasionally to avoid unbounded growth
      if (fallers.length > 40) {
        for (let i = fallers.length - 1; i >= 0; i--) {
          if (fallers[i]!.dead) fallers.splice(i, 1);
        }
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.tweens.killTweensOf(net);
      scene.input.off('pointerdown', onPointerDown, this);
      scene.input.off('pointermove', onPointerMove, this);
      scene.input.off('pointerup', onPointerUp, this);
    },
  } satisfies ArcadeGame;
};
