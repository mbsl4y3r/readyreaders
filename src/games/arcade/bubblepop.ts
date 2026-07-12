import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { chime } from '../../services/audio';

/**
 * Bubble Pop (cove theme). Big, slow bubbles drift up from the bottom of the
 * playfield; tap one to pop it (+1) with a little burst. An occasional golden
 * bubble rises even slower and is worth a +5 treat. A ~40s countdown runs the
 * show; bubbles that float off the top are simply missed — no penalty, purely
 * joyful. All motion is hand-rolled in update(time, delta).
 */
export const run: RunArcadeGame = (scene, ctx: ArcadeCtx) => {
  const top = ctx.hudBottom + 44; // leave room for the timer bar
  const bottom = ctx.height;
  const cx = ctx.width / 2;

  // ---- soft playfield background -----------------------------------------
  const bgTop = scene.add.rectangle(cx, ctx.hudBottom, ctx.width, bottom - ctx.hudBottom, ctx.theme.bgTop);
  bgTop.setOrigin(0.5, 0);
  ctx.layer.add(bgTop);
  const bgLow = scene.add.rectangle(cx, bottom, ctx.width, (bottom - ctx.hudBottom) * 0.55, ctx.theme.bgBottom);
  bgLow.setOrigin(0.5, 1);
  bgLow.setAlpha(0.6);
  ctx.layer.add(bgLow);

  // ---- countdown timer bar ------------------------------------------------
  const TIMER_Y = ctx.hudBottom + 20;
  const TIMER_MARGIN = 60;
  const TIMER_W = ctx.width - TIMER_MARGIN * 2;
  const timerTrack = scene.add.rectangle(TIMER_MARGIN, TIMER_Y, TIMER_W, 16, 0x000000, 0.18);
  timerTrack.setOrigin(0, 0.5);
  ctx.layer.add(timerTrack);
  const timerFill = scene.add.rectangle(TIMER_MARGIN, TIMER_Y, TIMER_W, 16, ctx.theme.accent, 1);
  timerFill.setOrigin(0, 0.5);
  ctx.layer.add(timerFill);

  // ---- state --------------------------------------------------------------
  const DURATION = 40000; // ~40s run
  let elapsed = 0;
  let spawnAccum = 0;
  let score = 0;
  let over = false;
  let destroyed = false;

  interface Bubble {
    container: Phaser.GameObjects.Container;
    baseX: number;
    y: number;
    r: number;
    vy: number; // px/s upward (positive = moving up)
    driftAmp: number;
    phase: number;
    golden: boolean;
    alive: boolean;
  }
  const bubbles: Bubble[] = [];

  interface Particle {
    obj: Phaser.GameObjects.Arc;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    r0: number;
  }
  const particles: Particle[] = [];

  const spawnBubble = (): void => {
    const golden = Math.random() < 0.1;
    const r = golden ? 58 + Math.random() * 8 : 40 + Math.random() * 22;
    const baseX = r + 20 + Math.random() * (ctx.width - (r + 20) * 2);
    const y = bottom + r + 10;
    // gentle rise; golden even slower as a treat to chase
    const vy = (golden ? 34 + Math.random() * 10 : 46 + Math.random() * 28) * ctx.difficulty;

    const bodyColor = golden ? 0xffd166 : ctx.theme.accent;
    const bodyAlpha = golden ? 0.55 : 0.3;
    const body = scene.add.circle(0, 0, r, bodyColor, bodyAlpha);
    body.setStrokeStyle(3, golden ? 0xfff3b0 : 0xeaffff, golden ? 0.95 : 0.7);
    const highlight = scene.add.circle(-r * 0.34, -r * 0.34, r * 0.24, 0xffffff, golden ? 0.9 : 0.75);
    const sparkle = scene.add.circle(r * 0.22, r * 0.28, r * 0.09, 0xffffff, 0.5);

    const container = scene.add.container(baseX, y, [body, highlight, sparkle]);
    ctx.layer.add(container);

    bubbles.push({
      container,
      baseX,
      y,
      r,
      vy,
      driftAmp: 12 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
      golden,
      alive: true,
    });
  };

  const burst = (x: number, y: number, golden: boolean): void => {
    const n = golden ? 10 : 6;
    const color = golden ? 0xffe08a : 0xeaffff;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const speed = 140 + Math.random() * 160;
      const r0 = 5 + Math.random() * 4;
      const obj = scene.add.circle(x, y, r0, color, 0.9);
      ctx.layer.add(obj);
      particles.push({
        obj,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 420,
        maxLife: 420,
        r0,
      });
    }
  };

  const removeBubble = (b: Bubble): void => {
    b.alive = false;
    b.container.destroy();
  };

  const endGame = (): void => {
    if (over) return;
    over = true;
    ctx.onGameOver(score);
  };

  // ---- input: tap a bubble to pop it -------------------------------------
  const onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (over || destroyed) return;
    // topmost (most recently near the surface) first — iterate newest last
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]!;
      if (!b.alive) continue;
      const dx = pointer.worldX - b.container.x;
      const dy = pointer.worldY - b.container.y;
      const hitR = b.r + 16; // forgiving pad; tap target well over 64px
      if (dx * dx + dy * dy <= hitR * hitR) {
        score += b.golden ? 5 : 1;
        ctx.onScore(score);
        chime('good');
        burst(b.container.x, b.container.y, b.golden);
        removeBubble(b);
        return; // one pop per tap
      }
    }
  };
  scene.input.on('pointerdown', onPointerDown, this);

  // seed a couple so the screen is never empty at the start
  spawnBubble();
  spawnBubble();

  return {
    update(time: number, delta: number): void {
      if (over || destroyed) return;
      const dt = delta / 1000;

      // countdown
      elapsed += delta;
      const remaining = Math.max(0, DURATION - elapsed);
      timerFill.width = TIMER_W * (remaining / DURATION);
      if (remaining <= 0) {
        endGame();
        return;
      }

      // spawn ramp: gently busier over the run (1500ms → 650ms)
      const progress = elapsed / DURATION;
      const interval = (1500 - progress * 850) / ctx.difficulty;
      spawnAccum += delta;
      if (spawnAccum >= interval) {
        spawnAccum -= interval;
        spawnBubble();
      }

      // move bubbles up with a soft side-to-side drift
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]!;
        if (!b.alive) {
          bubbles.splice(i, 1);
          continue;
        }
        b.y -= b.vy * dt;
        const xOffset = Math.sin(time / 620 + b.phase) * b.driftAmp;
        b.container.setPosition(b.baseX + xOffset, b.y);
        // drifted off the top → simply missed, no penalty
        if (b.y + b.r < top - 30) {
          removeBubble(b);
          bubbles.splice(i, 1);
        }
      }

      // pop-burst particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.life -= delta;
        if (p.life <= 0) {
          p.obj.destroy();
          particles.splice(i, 1);
          continue;
        }
        p.obj.x += p.vx * dt;
        p.obj.y += p.vy * dt;
        const t = p.life / p.maxLife;
        p.obj.setAlpha(t);
        p.obj.setScale(0.4 + t * 0.6);
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onPointerDown, this);
      for (const p of particles) p.obj.destroy();
      particles.length = 0;
      for (const b of bubbles) b.container.destroy();
      bubbles.length = 0;
    },
  } satisfies ArcadeGame;
};
