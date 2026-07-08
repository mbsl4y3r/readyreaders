import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

type Coral = { t: Phaser.GameObjects.Text; x: number; y: number };

export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // ---- Playfield geometry ----------------------------------------------
  const areaTop = hudBottom;
  const areaH = height - areaTop;
  const roadW = Math.min(760, width - 60);
  const roadX = (width - roadW) / 2;
  const roadR = roadX + roadW;
  // keep the car fully inside the road edges
  const carHalf = 44;
  const minX = roadX + carHalf;
  const maxX = roadR - carHalf;

  // ---- Background + road -------------------------------------------------
  const bg = scene.add.rectangle(width / 2, areaTop + areaH / 2, width, areaH, theme.bgBottom);
  ctx.layer.add(bg);
  const road = scene.add.rectangle(width / 2, areaTop + areaH / 2, roadW, areaH, theme.bgTop, 0.85);
  road.setStrokeStyle(8, theme.accent, 0.6);
  ctx.layer.add(road);

  // Lane geometry: 3 lanes, obstacles spawn centered in a lane.
  const LANES = 3;
  const laneW = roadW / LANES;
  const laneCenter = (i: number): number => roadX + laneW * i + laneW / 2;

  // ---- Scrolling dashes (sense of speed) --------------------------------
  const dashes: Phaser.GameObjects.Rectangle[] = [];
  const dashGap = 90;
  for (let i = 0; i < LANES - 1; i++) {
    const lx = roadX + laneW * (i + 1);
    for (let y = areaTop; y < height + dashGap; y += dashGap) {
      const d = scene.add.rectangle(lx, y, 8, 44, 0xffffff, 0.35);
      ctx.layer.add(d);
      dashes.push(d);
    }
  }

  // ---- The car ----------------------------------------------------------
  const carY = height - 90;
  let carX = width / 2;
  const car = emojiText(scene, carX, carY, '🏎️', 76);
  ctx.layer.add(car);
  // faint accent glow under the car so it reads in-theme
  const glow = scene.add.ellipse(carX, carY + 30, 92, 26, theme.accent, 0.4);
  ctx.layer.add(glow);
  glow.setDepth(-1);

  // ---- Obstacles --------------------------------------------------------
  const coralEmojis = ['🪸', '🐚', '🦀', '🌿'];
  const corals: Coral[] = [];
  let spawnCountdown = 900; // ms until next spawn

  function spawnCoral(): void {
    const lane = Math.floor(Math.random() * LANES);
    const emoji = coralEmojis[Math.floor(Math.random() * coralEmojis.length)]!;
    const x = laneCenter(lane);
    const y = areaTop - 40;
    const t = emojiText(scene, x, y, emoji, 60);
    ctx.layer.add(t);
    corals.push({ t, x, y });
  }

  // ---- Input: drag to steer --------------------------------------------
  let dragging = false;
  const clampX = (x: number): number => Math.max(minX, Math.min(maxX, x));
  const steerTo = (x: number): void => { carX = clampX(x); };

  const onDown = (p: Phaser.Input.Pointer): void => { dragging = true; steerTo(p.x); };
  const onMove = (p: Phaser.Input.Pointer): void => { if (dragging || p.isDown) steerTo(p.x); };
  const onUp = (): void => { dragging = false; };
  scene.input.on('pointerdown', onDown, this);
  scene.input.on('pointermove', onMove, this);
  scene.input.on('pointerup', onUp, this);

  const cursors = scene.input.keyboard?.createCursorKeys();

  // ---- Run state --------------------------------------------------------
  let over = false;
  let destroyed = false;
  let meters = 0;
  let speed = 260; // px/sec scroll speed, ramps up very gently
  const maxSpeed = 520;

  function endGame(): void {
    if (over) return;
    over = true;
    chime('gentle');
    ctx.onGameOver(Math.floor(meters));
  }

  return {
    update(_time: number, delta: number): void {
      if (over || destroyed) return;
      const dt = Math.min(delta, 50);
      const sec = dt / 1000;

      // keyboard bonus steering
      if (cursors) {
        if (cursors.left.isDown) steerTo(carX - speed * 1.4 * sec);
        else if (cursors.right.isDown) steerTo(carX + speed * 1.4 * sec);
      }

      // very gentle speed ramp
      speed = Math.min(maxSpeed, speed + 6 * sec);

      // move car visuals
      car.setPosition(carX, carY);
      glow.setPosition(carX, carY + 30);

      // distance travelled -> score
      meters += speed * sec * 0.1;
      ctx.onScore(Math.floor(meters));

      // scroll dashes downward, wrap to top
      const move = speed * sec;
      for (const d of dashes) {
        d.y += move;
        if (d.y > height + 22) d.y -= (height - areaTop) + dashGap;
      }

      // spawn obstacles on a timer, spacing scaled loosely to speed
      spawnCountdown -= dt;
      if (spawnCountdown <= 0) {
        spawnCoral();
        spawnCountdown = 780 + Math.random() * 620;
      }

      // move + collide obstacles
      for (let i = corals.length - 1; i >= 0; i--) {
        const c = corals[i]!;
        c.y += move;
        c.t.setPosition(c.x, c.y);
        // forgiving hitbox: only near the car's row and close in x
        if (Math.abs(c.y - carY) < 46 && Math.abs(c.x - carX) < 50) {
          endGame();
          return;
        }
        if (c.y > height + 50) {
          c.t.destroy();
          corals.splice(i, 1);
        }
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, this);
      scene.input.off('pointermove', onMove, this);
      scene.input.off('pointerup', onUp, this);
    },
  } satisfies ArcadeGame;
};
