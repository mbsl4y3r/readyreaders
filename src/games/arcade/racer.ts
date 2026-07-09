import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText, readingText } from '../../ui/kit';
import { chime } from '../../services/audio';

/**
 * Reef Racer — a gentle, forgiving take on the classic Pole Position: a
 * pseudo-3D road seen from behind the car, curving toward a swaying vanishing
 * point, with rival cars that scale up out of the horizon for you to overtake.
 *
 * Kid-friendly rules: you never "crash out". Bumping a rival or drifting off
 * the road just slows you down for a moment; the run is a timed joyride and the
 * score is how far you get (plus a bonus for every car you pass). Steer by
 * dragging left/right anywhere on screen.
 */

type Rival = { t: Phaser.GameObjects.Text; x: number; z: number; scored: boolean };

export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  const areaTop = hudBottom;
  const areaH = height - areaTop;
  const horizonY = areaTop + areaH * 0.3;
  const roadBottom = height;
  const ROWS = 60;
  const roadHalfNear = Math.min(440, width * 0.45);
  const roadHalfFar = 24;
  const curveAmp = roadHalfNear * 1.05;
  const carScreenY = height - 104;

  // ---- Sky + seabed backdrop -------------------------------------------
  const sky = scene.add.rectangle(width / 2, areaTop + (horizonY - areaTop) / 2, width, horizonY - areaTop, theme.bgTop);
  ctx.layer.add(sky);
  const seabed = scene.add.rectangle(width / 2, (horizonY + roadBottom) / 2, width, roadBottom - horizonY, theme.bgBottom);
  ctx.layer.add(seabed);
  // a soft sun/glow at the vanishing point
  const glow = scene.add.circle(width / 2, horizonY, 60, 0xffffff, 0.12);
  ctx.layer.add(glow);

  // the road is redrawn every frame into one graphics object
  const road = scene.add.graphics();
  ctx.layer.add(road);

  // ---- Player car -------------------------------------------------------
  const shadow = scene.add.ellipse(width / 2, carScreenY + 30, 104, 26, 0x000000, 0.3);
  ctx.layer.add(shadow);
  const car = emojiText(scene, width / 2, carScreenY, '🏎️', 84);
  ctx.layer.add(car);

  // ---- Rivals to overtake ----------------------------------------------
  const rivalEmojis = ['🚗', '🚙', '🛥️', '🚤'];
  const rivals: Rival[] = [];
  let spawnAcc = 700;

  // ---- HUD: countdown joyride ------------------------------------------
  const timeText = readingText(scene, width - 34, hudBottom + 22, '', 24, '#ffffff').setOrigin(1, 0.5);
  ctx.layer.add(timeText);

  // ---- State ------------------------------------------------------------
  let playerX = 0; // road-relative, -1..1 is on-road
  let steer = 0; // target from finger
  let speed = 0.35; // 0..1
  let curve = 0;
  let curveTarget = 0;
  let curveTimer = 0;
  let stripe = 0; // scrolls for a sense of speed
  let meters = 0;
  let bonkFlash = 0;
  let timeLeft = 60_000;
  let nextCheer = 200;
  let over = false;
  let destroyed = false;

  // perspective helpers (p: 0 at horizon → 1 at the bottom of the screen)
  const halfAt = (p: number): number => roadHalfFar + (roadHalfNear - roadHalfFar) * p * p;
  const centerAt = (p: number): number => width / 2 + curve * (1 - p) * (1 - p) * curveAmp;

  // ---- Input: drag to steer --------------------------------------------
  const setSteer = (px: number): void => {
    steer = Phaser.Math.Clamp((px - width / 2) / (width * 0.4), -1.15, 1.15);
  };
  let dragging = false;
  const onDown = (p: Phaser.Input.Pointer): void => { dragging = true; setSteer(p.x); };
  const onMove = (p: Phaser.Input.Pointer): void => { if (dragging || p.isDown) setSteer(p.x); };
  const onUp = (): void => { dragging = false; };
  scene.input.on('pointerdown', onDown, this);
  scene.input.on('pointermove', onMove, this);
  scene.input.on('pointerup', onUp, this);
  const cursors = scene.input.keyboard?.createCursorKeys();

  function spawnRival(): void {
    const emoji = rivalEmojis[Math.floor(Math.random() * rivalEmojis.length)]!;
    const t = emojiText(scene, width / 2, horizonY, emoji, 40);
    ctx.layer.add(t);
    rivals.push({ t, x: (Math.random() * 2 - 1) * 0.7, z: 1, scored: false });
  }

  function drawRoad(): void {
    road.clear();
    for (let i = 0; i < ROWS; i++) {
      const p0 = i / ROWS;
      const p1 = (i + 1) / ROWS;
      const yTop = horizonY + (roadBottom - horizonY) * p0;
      const yBot = horizonY + (roadBottom - horizonY) * p1;
      const cx = centerAt(p1);
      const half = halfAt(p1);
      // stripe phase scrolls with speed for a moving-road feel
      const band = Math.floor(p1 * 22 + stripe) % 2 === 0;
      // grass / seabed shoulder
      road.fillStyle(band ? theme.bgBottom : (theme.accent & 0xfefefe) >> 1, band ? 1 : 0.5);
      road.fillRect(0, yTop, width, yBot - yTop + 1);
      // rumble edge
      road.fillStyle(band ? theme.accent : 0xffffff, 0.9);
      road.fillRect(cx - half - 12, yTop, half * 2 + 24, yBot - yTop + 1);
      // tarmac
      road.fillStyle(band ? 0x2b3a4a : 0x33465a, 1);
      road.fillRect(cx - half, yTop, half * 2, yBot - yTop + 1);
      // centre dashes
      if (band) {
        road.fillStyle(0xffffff, 0.8);
        road.fillRect(cx - Math.max(1.5, half * 0.03), yTop, Math.max(3, half * 0.06), yBot - yTop + 1);
      }
    }
  }

  function endGame(): void {
    if (over) return;
    over = true;
    chime('good');
    ctx.onGameOver(Math.floor(meters));
  }

  return {
    update(_time: number, delta: number): void {
      if (over || destroyed) return;
      const dt = Math.min(delta, 50);
      const sec = dt / 1000;

      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        endGame();
        return;
      }
      timeText.setText(`⏱ ${Math.ceil(timeLeft / 1000)}s`);

      // keyboard nudge
      if (cursors?.left.isDown) steer = Phaser.Math.Clamp(steer - 2.2 * sec, -1.15, 1.15);
      else if (cursors?.right.isDown) steer = Phaser.Math.Clamp(steer + 2.2 * sec, -1.15, 1.15);

      // ease the car toward the steer target
      playerX += (steer - playerX) * Math.min(1, sec * 6);

      // off-road slows you; otherwise speed climbs to max
      const offRoad = Math.abs(playerX) > 1;
      const targetSpeed = offRoad ? 0.34 : ctx.difficulty;
      speed += (targetSpeed - speed) * Math.min(1, sec * (offRoad ? 3 : 0.5));

      // wandering curve — the vanishing point sways left/right
      curveTimer -= dt;
      if (curveTimer <= 0) {
        curveTarget = (Math.random() * 2 - 1) * 0.9;
        curveTimer = 2200 + Math.random() * 2200;
      }
      curve += (curveTarget - curve) * Math.min(1, sec * 0.8);

      // scroll + distance
      stripe = (stripe + speed * sec * 8) % 1000;
      meters += speed * sec * 70;
      ctx.onScore(Math.floor(meters));
      if (meters >= nextCheer) { chime('good'); nextCheer += 200; }

      drawRoad();

      // car visuals: lean into the turn, shudder when off-road/bonked
      const lean = Phaser.Math.Clamp((steer - playerX) * 12 + curve * 6, -14, 14);
      bonkFlash = Math.max(0, bonkFlash - dt);
      const shudder = (offRoad ? Math.sin(stripe * 40) * 4 : 0) + (bonkFlash > 0 ? Math.sin(bonkFlash) * 5 : 0);
      car.setPosition(width / 2 + shudder, carScreenY);
      car.setAngle(lean);
      car.setTint(bonkFlash > 0 ? 0xff8888 : 0xffffff);
      shadow.setPosition(width / 2 + shudder, carScreenY + 30);

      // spawn rivals
      spawnAcc -= dt;
      if (spawnAcc <= 0) {
        spawnRival();
        spawnAcc = (900 + Math.random() * 900) / ctx.difficulty;
      }

      // move + project rivals
      for (let i = rivals.length - 1; i >= 0; i--) {
        const r = rivals[i]!;
        r.z -= (0.22 + speed * 0.5) * sec;
        const p = 1 - r.z;
        if (p <= 0) { r.t.setVisible(false); continue; }
        const cx = centerAt(p);
        const sx = cx + (r.x - playerX) * roadHalfNear * p * p;
        const sy = horizonY + (roadBottom - horizonY) * p;
        const sc = 0.3 + 1.5 * p * p;
        r.t.setPosition(sx, sy);
        r.t.setScale(sc);
        r.t.setVisible(true);

        // near the player's row: bonk if overlapping, else it's a clean pass
        if (r.z <= 0.05 && !r.scored) {
          r.scored = true;
          if (Math.abs(r.x - playerX) < 0.32) {
            bonkFlash = Math.PI * 6;
            speed = 0.3;
            chime('gentle');
          } else {
            meters += 25; // reward for overtaking, Pole-Position style
            ctx.onScore(Math.floor(meters));
          }
        }
        if (r.z <= -0.15) {
          r.t.destroy();
          rivals.splice(i, 1);
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
