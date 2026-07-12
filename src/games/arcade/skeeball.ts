import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { chime } from '../../services/audio';

export const run: RunArcadeGame = (scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // --- Soft playfield backdrop (its own place) ------------------------------
  const bg = scene.add.rectangle(width / 2, (hudBottom + height) / 2, width, height - hudBottom, theme.bgBottom);
  ctx.layer.add(bg);
  const bgTop = scene.add.rectangle(width / 2, hudBottom + 4, width, 8, theme.bgTop, 0.6);
  ctx.layer.add(bgTop);

  // --- Layout ---------------------------------------------------------------
  const top = hudBottom + 6;
  const wall = 30;
  const leftX = wall;
  const rightX = width - wall;
  // Rings ride at the very top and the shell sits low, so there's a long
  // skee-ball LANE between them — but the shell still leaves ~175px below it
  // for a decent backswing drag.
  const centerX = width / 2;
  const rOuter = 120; // 10 pts
  const rMid = 76; //   25 pts
  const rBull = 40; //  50 pts
  const centerY = top + rOuter + 8;
  const restY = height - 175;

  // Ramp side rails so it reads as a lane.
  const railL = scene.add.rectangle(leftX, (top + height) / 2, 10, height - top, theme.accent, 0.5);
  ctx.layer.add(railL);
  const railR = scene.add.rectangle(rightX, (top + height) / 2, 10, height - top, theme.accent, 0.5);
  ctx.layer.add(railR);

  // Concentric ring targets near the top.
  const ringOuter = scene.add.circle(centerX, centerY, rOuter, theme.accent, 0.18);
  ringOuter.setStrokeStyle(6, theme.accent, 0.9);
  ctx.layer.add(ringOuter);
  const ringMid = scene.add.circle(centerX, centerY, rMid, 0xffffff, 0.16);
  ringMid.setStrokeStyle(6, theme.accent, 0.9);
  ctx.layer.add(ringMid);
  const ringBull = scene.add.circle(centerX, centerY, rBull, theme.accent, 0.35);
  ringBull.setStrokeStyle(6, 0xffffff, 0.9);
  ctx.layer.add(ringBull);
  const star = scene.add.text(centerX, centerY, '⭐', { fontSize: '40px' }).setOrigin(0.5);
  ctx.layer.add(star);

  // Ring point labels (decorative, not needed to play).
  const lblOuter = scene.add.text(centerX, centerY - rOuter + 20, '10', { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
  ctx.layer.add(lblOuter);
  const lblMid = scene.add.text(centerX, centerY - rMid + 18, '25', { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
  ctx.layer.add(lblMid);

  // --- The shell ------------------------------------------------------------
  const shell = scene.add.text(centerX, restY, '🐚', { fontSize: '52px' }).setOrigin(0.5);
  ctx.layer.add(shell);

  // Aim line while dragging.
  const aim = scene.add.graphics();
  ctx.layer.add(aim);

  // Floating "+N" result text.
  const popup = scene.add.text(centerX, restY, '', { fontSize: '40px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setVisible(false);
  ctx.layer.add(popup);

  // Rolls-remaining pill (small, top-left of playfield).
  const rollsText = scene.add.text(leftX + 24, top + 20, '', { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5);
  ctx.layer.add(rollsText);

  // --- State ----------------------------------------------------------------
  const TOTAL_ROLLS = 9;
  let rolls = TOTAL_ROLLS;
  let score = 0;
  let over = false;
  let destroyed = false;
  type Phase = 'ready' | 'aim' | 'roll' | 'rest';
  let phase: Phase = 'ready';
  let sx = centerX;
  let sy = restY;
  let vx = 0;
  let vy = 0;
  let restMs = 0;
  const pointer = new Phaser.Math.Vector2(centerX, restY);
  const MAX_PULL = 220;

  const drawRolls = () => {
    rollsText.setText('🐚'.repeat(Math.max(0, rolls)));
  };
  drawRolls();

  const endGame = () => {
    if (over) return;
    over = true;
    ctx.onGameOver(score);
  };

  const settle = () => {
    // Score by distance from the bullseye center.
    const dist = Math.hypot(sx - centerX, sy - centerY);
    let pts = 0;
    if (dist <= rBull) pts = 50;
    else if (dist <= rMid) pts = 25;
    else if (dist <= rOuter) pts = 10;
    if (pts > 0) {
      score += pts;
      ctx.onScore(score);
      chime('good');
    } else {
      chime('gentle');
    }
    popup.setText(pts > 0 ? `+${pts}` : 'oops!');
    popup.setPosition(sx, sy - 44);
    popup.setVisible(true);
    rolls -= 1;
    drawRolls();
    phase = 'rest';
    restMs = 850;
  };

  // --- Touch input: slingshot ----------------------------------------------
  const onDown = (p: Phaser.Input.Pointer) => {
    if (phase !== 'ready') return;
    phase = 'aim';
    pointer.set(p.worldX, p.worldY);
  };
  const onMove = (p: Phaser.Input.Pointer) => {
    if (phase === 'aim') pointer.set(p.worldX, p.worldY);
  };
  const onUp = () => {
    if (phase !== 'aim') return;
    // Launch direction is from the pulled-back finger toward the shell.
    const dx = sx - pointer.x;
    const dy = sy - pointer.y;
    const pull = Math.min(Math.hypot(dx, dy), MAX_PULL);
    aim.clear();
    if (pull < 24) {
      phase = 'ready'; // tiny tap — not a real shot
      return;
    }
    const power = 340 + (pull / MAX_PULL) * 1350; // px/sec — a short pull is soft, a full backswing sails up the lane
    vx = (dx / pull) * power;
    vy = (dy / pull) * power;
    phase = 'roll';
  };
  scene.input.on('pointerdown', onDown, this);
  scene.input.on('pointermove', onMove, this);
  scene.input.on('pointerup', onUp, this);
  scene.input.on('pointerupoutside', onUp, this);

  const shellR = 26;

  return {
    update(_time: number, delta: number) {
      if (over) return;
      const dt = Math.min(delta, 40) / 1000;

      if (phase === 'aim') {
        // Draw the pull-back band and a projected shot arrow.
        aim.clear();
        aim.lineStyle(6, theme.accent, 0.8);
        aim.beginPath();
        aim.moveTo(sx, sy);
        aim.lineTo(pointer.x, pointer.y);
        aim.strokePath();
        const dx = sx - pointer.x;
        const dy = sy - pointer.y;
        const pull = Math.min(Math.hypot(dx, dy), MAX_PULL);
        if (pull > 1) {
          const ax = sx + (dx / pull) * (pull * 0.9);
          const ay = sy + (dy / pull) * (pull * 0.9);
          aim.lineStyle(8, 0xffffff, 0.9);
          aim.beginPath();
          aim.moveTo(sx, sy);
          aim.lineTo(ax, ay);
          aim.strokePath();
          aim.fillStyle(0xffffff, 0.95);
          aim.fillCircle(ax, ay, 9);
        }
        return;
      }

      if (phase === 'roll') {
        sx += vx * dt;
        sy += vy * dt;
        // Rolling friction — a gentle, satisfying slow-down.
        const damp = Math.exp(-1.5 * dt);
        vx *= damp;
        vy *= damp;
        // Rail bounces.
        if (sx - shellR < leftX) {
          sx = leftX + shellR;
          vx = Math.abs(vx) * 0.7;
        } else if (sx + shellR > rightX) {
          sx = rightX - shellR;
          vx = -Math.abs(vx) * 0.7;
        }
        if (sy - shellR < top) {
          sy = top + shellR;
          vy = Math.abs(vy) * 0.7;
        } else if (sy + shellR > height) {
          sy = height - shellR;
          vy = -Math.abs(vy) * 0.7;
        }
        shell.setPosition(sx, sy);
        shell.rotation += (vx / 400) * dt * 6;
        if (Math.hypot(vx, vy) < 28) settle();
        return;
      }

      if (phase === 'rest') {
        restMs -= delta;
        popup.y -= 20 * dt; // float up
        if (restMs <= 0) {
          popup.setVisible(false);
          if (rolls <= 0) {
            endGame();
            return;
          }
          // Reset the shell for the next roll.
          sx = centerX;
          sy = restY;
          vx = 0;
          vy = 0;
          shell.setPosition(sx, sy);
          shell.rotation = 0;
          phase = 'ready';
        }
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, this);
      scene.input.off('pointermove', onMove, this);
      scene.input.off('pointerup', onUp, this);
      scene.input.off('pointerupoutside', onUp, this);
    },
  } satisfies ArcadeGame;
};
