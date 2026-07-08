import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

// An obstacle scrolls down the road. `vx` lets rival cars drift sideways.
type Obstacle = {
  t: Phaser.GameObjects.Text;
  x: number;
  y: number;
  vx: number; // px/sec horizontal drift (0 for static coral / parked cars)
  half: number; // collision half-width
};

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

  // Lane geometry is now purely decorative — the dashed centre lines. Obstacles
  // spawn at CONTINUOUS x positions, so sitting on a line is never safe.
  const LANES = 3;
  const laneW = roadW / LANES;

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

  // ---- Obstacles + rival vehicles --------------------------------------
  const coralEmojis = ['🪸', '🐚', '🦀', '🌿'];
  const rivalEmojis = ['🚗', '🚙', '🛥️'];
  const obstacles: Obstacle[] = [];

  const spawnY = areaTop - 50; // just above view so waves are telegraphed early
  const STAGGER_DY = areaH * 0.36; // vertical offset between slalom rows
  const DRIFT_DY = areaH * 0.3; // vertical offset for a second drifting rival

  const pickCoral = (): string => coralEmojis[Math.floor(Math.random() * coralEmojis.length)]!;
  const pickRival = (): string => rivalEmojis[Math.floor(Math.random() * rivalEmojis.length)]!;
  const clampRoad = (x: number, half: number): number =>
    Math.max(roadX + half, Math.min(roadR - half, x));

  function addObstacle(x: number, y: number, emoji: string, size: number, half: number, vx: number): void {
    const t = emojiText(scene, x, y, emoji, size);
    ctx.layer.add(t);
    obstacles.push({ t, x, y, vx, half });
  }

  // Fill one row across the road, leaving a single clearly-wide gap centred on
  // `gapCenter`. Occasionally slots a parked rival car into the wall for flavour.
  function fillRow(y: number, gapCenter: number, gapHalf: number): void {
    const spacing = 64;
    for (let x = roadX + 34; x <= roadR - 34; x += spacing) {
      if (Math.abs(x - gapCenter) <= gapHalf) continue;
      if (Math.random() < 0.18) addObstacle(x, y, pickRival(), 60, 30, 0);
      else addObstacle(x, y, pickCoral(), 56, 26, 0);
    }
  }

  // Pattern A: a wall filling most of the road with ONE gap to steer into.
  function spawnWall(): number {
    const gapHalf = carHalf + 60; // ~104 -> ~208px opening, clearly wide enough
    const range = Math.max(0, roadW - 2 * gapHalf);
    const gapCenter = roadX + gapHalf + Math.random() * range;
    fillRow(spawnY, gapCenter, gapHalf);
    return 0;
  }

  // Pattern B: a slalom — two rows with openings on opposite sides, so the
  // player must weave one way then the other. Both rows are visible at once.
  function spawnStagger(): number {
    const gapHalf = carHalf + 66; // extra-wide openings for the weave
    const firstLeft = Math.random() < 0.5;
    const nearGap = firstLeft ? roadR - gapHalf : roadX + gapHalf;
    const farGap = firstLeft ? roadX + gapHalf : roadR - gapHalf;
    fillRow(spawnY, nearGap, gapHalf);
    fillRow(spawnY - STAGGER_DY, farGap, gapHalf);
    return STAGGER_DY;
  }

  // Pattern C: one or two rival cars drifting gently across the road — the
  // Pole-Position weave. They cross continuous x, so no fixed line is safe.
  function spawnDrift(): number {
    const count = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft ? roadX + roadW * 0.22 : roadR - roadW * 0.22;
      const vx = (fromLeft ? 1 : -1) * (36 + Math.random() * 44); // gentle drift
      addObstacle(startX, spawnY - i * DRIFT_DY, pickRival(), 64, 30, vx);
    }
    return (count - 1) * DRIFT_DY;
  }

  // Choose a wave. Very gentle at the start, more slaloms once warmed up.
  // Returns how far above `spawnY` the wave's topmost obstacle sits, so we can
  // keep a fair vertical gap before the next wave.
  function spawnWave(): number {
    const r = Math.random();
    if (meters < 120) return r < 0.6 ? spawnDrift() : spawnWall();
    if (r < 0.42) return spawnWall();
    if (r < 0.72) return spawnDrift();
    return spawnStagger();
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
  let nextChimeAt = 100; // soft cheer every 100m
  let speed = 240; // px/sec scroll speed, ramps up very gently
  const maxSpeed = 540;
  let spawnCountdown = 700; // ms until first wave

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

      // very gentle speed ramp — keeps getting faster with distance
      speed = Math.min(maxSpeed, speed + 8 * sec);

      // move car visuals
      car.setPosition(carX, carY);
      glow.setPosition(carX, carY + 30);

      // distance travelled -> score (meters), with an encouraging chime
      meters += speed * sec * 0.1;
      ctx.onScore(Math.floor(meters));
      if (meters >= nextChimeAt) {
        chime('good');
        nextChimeAt += 100;
      }

      // scroll dashes downward, wrap to top
      const move = speed * sec;
      for (const d of dashes) {
        d.y += move;
        if (d.y > height + 22) d.y -= (height - areaTop) + dashGap;
      }

      // spawn waves; rate ramps up gently as distance and speed grow, but a
      // fair vertical gap below the previous wave's top is always preserved.
      spawnCountdown -= dt;
      if (spawnCountdown <= 0) {
        const extra = spawnWave();
        const spacingPx = Math.max(areaH * 0.5, areaH * 0.92 - meters * 0.5);
        spawnCountdown = ((spacingPx + extra) / speed) * 1000 * (0.9 + Math.random() * 0.25);
      }

      // move + collide obstacles
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const c = obstacles[i]!;
        c.y += move;
        if (c.vx !== 0) c.x = clampRoad(c.x + c.vx * sec, c.half);
        c.t.setPosition(c.x, c.y);
        // forgiving hitbox: only near the car's row and overlapping in x
        if (Math.abs(c.y - carY) < 42 && Math.abs(c.x - carX) < c.half + 26) {
          endGame();
          return;
        }
        if (c.y > height + 60) {
          c.t.destroy();
          obstacles.splice(i, 1);
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
