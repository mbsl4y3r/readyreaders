import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { readingText, emojiText } from '../../ui/kit';

/**
 * "Shell Duel" — two-player Pong on ONE iPad. A pearl bounces between a TOP
 * paddle (Player 2) and a BOTTOM paddle (Player 1), off the left/right walls.
 * Each player drags their paddle in their half of the playfield; both fingers
 * work at once. First to 5 points wins; the reported score is total rallies
 * (paddle hits), so a long, lively duel scores higher.
 */
export const run: RunArcadeGame = (scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // --- Playfield background --------------------------------------------------
  const bg = scene.add.rectangle(
    width / 2,
    (hudBottom + height) / 2,
    width,
    height - hudBottom,
    theme.bgBottom,
  );
  ctx.layer.add(bg);
  const bgGlow = scene.add.rectangle(width / 2, hudBottom + 6, width, 12, theme.bgTop, 0.5);
  ctx.layer.add(bgGlow);

  // --- Layout ----------------------------------------------------------------
  const top = hudBottom + 4;
  const wallPad = 8;
  const leftX = wallPad;
  const rightX = width - wallPad;
  const mid = (top + height) / 2; // divides P2 (above) from P1 (below)

  const paddleW = 240;
  const paddleH = 30;
  const topPaddleY = top + 48; // Player 2
  const bottomPaddleY = height - 48; // Player 1
  const pearlR = 22;
  const half = paddleW / 2;

  // Center divider dashes, so each player sees their own territory.
  const divider = scene.add.graphics();
  divider.fillStyle(0xffffff, 0.18);
  for (let x = 30; x < width - 30; x += 56) {
    divider.fillRoundedRect(x, mid - 3, 30, 6, 3);
  }
  ctx.layer.add(divider);

  // --- Big score numbers (behind play), each facing its own player -----------
  const p2Color = '#ffe08a';
  const p1Color = '#ffffff';
  const p2Num = readingText(scene, width / 2, mid - 150, '0', 130, p2Color);
  p2Num.setAlpha(0.32).setRotation(Math.PI); // upside-down for the top player
  ctx.layer.add(p2Num);
  const p1Num = readingText(scene, width / 2, mid + 150, '0', 130, p1Color);
  p1Num.setAlpha(0.32);
  ctx.layer.add(p1Num);

  // --- Paddles ---------------------------------------------------------------
  const drawPaddle = (g: Phaser.GameObjects.Graphics) => {
    const hw = paddleW / 2;
    const hh = paddleH / 2;
    const r = hh;
    g.clear();
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(-hw + 2, -hh + 4, paddleW, paddleH, r);
    g.fillStyle(theme.accent, 1);
    g.fillRoundedRect(-hw, -hh, paddleW, paddleH, r);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(-hw + 8, -hh + 5, paddleW - 16, 8, 4);
    g.lineStyle(4, 0xffffff, 0.95);
    g.strokeRoundedRect(-hw, -hh, paddleW, paddleH, r);
  };

  const topPaddle = scene.add.graphics();
  drawPaddle(topPaddle);
  topPaddle.setPosition(width / 2, topPaddleY);
  ctx.layer.add(topPaddle);
  const topShell = emojiText(scene, width / 2, topPaddleY, '🦀', 34);
  ctx.layer.add(topShell);

  const bottomPaddle = scene.add.graphics();
  drawPaddle(bottomPaddle);
  bottomPaddle.setPosition(width / 2, bottomPaddleY);
  ctx.layer.add(bottomPaddle);
  const bottomShell = emojiText(scene, width / 2, bottomPaddleY, '🐚', 34);
  ctx.layer.add(bottomShell);

  // --- Pearl -----------------------------------------------------------------
  const pearl = scene.add.circle(width / 2, mid, pearlR, 0xffffff);
  pearl.setStrokeStyle(3, theme.accent, 0.9);
  ctx.layer.add(pearl);
  const sparkle = emojiText(scene, pearl.x, pearl.y, '✨', 20);
  ctx.layer.add(sparkle);

  // --- Win banner (hidden until someone reaches 5) ---------------------------
  const banner = readingText(scene, width / 2, mid, '', 64, '#ffffff');
  banner.setAlpha(0).setDepth(10);
  ctx.layer.add(banner);

  // --- State -----------------------------------------------------------------
  let rallies = 0; // total paddle hits across the whole match == final score
  let p1Points = 0;
  let p2Points = 0;
  let over = false;
  let destroyed = false;

  const baseSpeed = 300 * ctx.difficulty;
  let speed = baseSpeed;
  let vx = 0;
  let vy = 0;
  let px = pearl.x;
  let py = pearl.y;
  let graceMs = 700; // ball sits at center briefly before each serve launches
  let winMs = 0; // >0 while showing the win banner before ending

  const clampX = (x: number) => Phaser.Math.Clamp(x, leftX + half, rightX - half);

  const setTopX = (x: number) => {
    const cx = clampX(x);
    topPaddle.x = cx;
    topShell.x = cx;
  };
  const setBottomX = (x: number) => {
    const cx = clampX(x);
    bottomPaddle.x = cx;
    bottomShell.x = cx;
  };

  // Serve from center. `towardTop` sends the pearl up toward Player 2.
  const serve = (towardTop: boolean) => {
    speed = baseSpeed;
    px = width / 2;
    py = mid;
    const drift = (Math.random() - 0.5) * speed * 0.5;
    vx = drift;
    const vyMag = Math.sqrt(Math.max(speed * speed - vx * vx, 0));
    vy = towardTop ? -vyMag : vyMag;
    graceMs = 700;
  };
  serve(Math.random() < 0.5);

  // Bounce off a paddle: steer horizontally by where the pearl struck.
  const bounce = (paddleX: number, downward: boolean) => {
    rallies += 1;
    ctx.onScore(rallies);
    speed = Math.min(speed + 14, baseSpeed * 2.1);
    const offset = Phaser.Math.Clamp((px - paddleX) / half, -1, 1);
    vx = offset * speed * 0.78;
    let vyMag = Math.sqrt(Math.max(speed * speed - vx * vx, 0));
    if (vyMag < 130) vyMag = 130;
    vy = downward ? vyMag : -vyMag;
  };

  // --- Touch input: multitouch, region-based --------------------------------
  scene.input.addPointer(3);
  const onPointer = (p: Phaser.Input.Pointer) => {
    if (!p.isDown) return;
    if (p.y < mid) setTopX(p.x);
    else setBottomX(p.x);
  };
  scene.input.on('pointerdown', onPointer, this);
  scene.input.on('pointermove', onPointer, this);

  // Keyboard bonus (never the only control): arrows = P1, A/D = P2.
  const cursors = scene.input.keyboard?.createCursorKeys();
  const keyA = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
  const keyD = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D);

  const endGame = () => {
    if (over) return;
    over = true;
    ctx.onGameOver(rallies);
  };

  return {
    update(_time: number, delta: number) {
      if (over) return;
      const dt = delta / 1000;

      // Win banner: hold briefly, then end the match.
      if (winMs > 0) {
        winMs -= delta;
        if (winMs <= 0) endGame();
        return;
      }

      // Keyboard nudges.
      if (cursors) {
        if (cursors.left.isDown) setBottomX(bottomPaddle.x - 640 * dt);
        else if (cursors.right.isDown) setBottomX(bottomPaddle.x + 640 * dt);
      }
      if (keyA?.isDown) setTopX(topPaddle.x - 640 * dt);
      else if (keyD?.isDown) setTopX(topPaddle.x + 640 * dt);

      // Serve grace: pearl waits at center so both players can get ready.
      if (graceMs > 0) {
        graceMs -= delta;
        pearl.x = px;
        pearl.y = py;
        sparkle.x = px;
        sparkle.y = py;
        return;
      }

      px += vx * dt;
      py += vy * dt;

      // Side walls.
      if (px - pearlR < leftX) {
        px = leftX + pearlR;
        vx = Math.abs(vx);
      }
      if (px + pearlR > rightX) {
        px = rightX - pearlR;
        vx = -Math.abs(vx);
      }

      // Top paddle (Player 2) — pearl travelling up.
      if (vy < 0) {
        const near = py - pearlR <= topPaddleY + paddleH / 2 && py > topPaddleY - paddleH;
        const within = px >= topPaddle.x - half - pearlR && px <= topPaddle.x + half + pearlR;
        if (near && within) {
          bounce(topPaddle.x, true);
          py = topPaddleY + paddleH / 2 + pearlR + 1;
          topPaddle.setScale(1, 1.25);
          topShell.setScale(1.25);
        }
      }

      // Bottom paddle (Player 1) — pearl travelling down.
      if (vy > 0) {
        const near = py + pearlR >= bottomPaddleY - paddleH / 2 && py < bottomPaddleY + paddleH;
        const within =
          px >= bottomPaddle.x - half - pearlR && px <= bottomPaddle.x + half + pearlR;
        if (near && within) {
          bounce(bottomPaddle.x, false);
          py = bottomPaddleY - paddleH / 2 - pearlR - 1;
          bottomPaddle.setScale(1, 1.25);
          bottomShell.setScale(1.25);
        }
      }

      // Ease the squash back to normal.
      topPaddle.scaleY += (1 - topPaddle.scaleY) * Math.min(1, dt * 12);
      topShell.scaleX += (1 - topShell.scaleX) * Math.min(1, dt * 12);
      topShell.scaleY = topShell.scaleX;
      bottomPaddle.scaleY += (1 - bottomPaddle.scaleY) * Math.min(1, dt * 12);
      bottomShell.scaleX += (1 - bottomShell.scaleX) * Math.min(1, dt * 12);
      bottomShell.scaleY = bottomShell.scaleX;

      // Past the top edge => Player 1 scores; re-serve toward the loser (P2).
      if (py + pearlR < top) {
        p1Points += 1;
        p1Num.setText(String(p1Points));
        if (p1Points >= 5) {
          banner.setText('Player 1 wins! 🎉').setColor(p1Color).setAlpha(1);
          winMs = 1700;
        } else {
          serve(true);
        }
      }

      // Past the bottom edge => Player 2 scores; re-serve toward the loser (P1).
      if (py - pearlR > height) {
        p2Points += 1;
        p2Num.setText(String(p2Points));
        if (p2Points >= 5) {
          banner.setText('Player 2 wins! 🎉').setColor(p2Color).setAlpha(1);
          winMs = 1700;
        } else {
          serve(false);
        }
      }

      pearl.x = px;
      pearl.y = py;
      sparkle.x = px;
      sparkle.y = py;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onPointer, this);
      scene.input.off('pointermove', onPointer, this);
    },
  } satisfies ArcadeGame;
};
