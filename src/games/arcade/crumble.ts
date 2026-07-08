import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { chime } from '../../services/audio';

interface Brick {
  rect: Phaser.GameObjects.Rectangle;
  active: boolean;
}

export const run: RunArcadeGame = (scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // Soft playfield background so the game reads as its own place.
  const bg = scene.add.rectangle(width / 2, (hudBottom + height) / 2, width, height - hudBottom, theme.bgBottom);
  ctx.layer.add(bg);
  const bgGlow = scene.add.rectangle(width / 2, hudBottom + 6, width, 12, theme.bgTop, 0.5);
  ctx.layer.add(bgGlow);

  // --- Layout constants -----------------------------------------------------
  const top = hudBottom + 4;
  const wallPad = 8;
  const leftX = wallPad;
  const rightX = width - wallPad;
  const paddleW = 220;
  const paddleH = 30;
  const paddleY = height - 46;
  const ballR = 20;

  // --- Bricks ---------------------------------------------------------------
  const COLS = 6;
  const ROWS = 4;
  const brickGap = 10;
  const brickAreaTop = top + 40;
  const brickAreaW = width - 80;
  const brickAreaX = 40;
  const brickW = (brickAreaW - brickGap * (COLS - 1)) / COLS;
  const brickH = 34;
  const brickColors = [0xff8fb3, 0xffd166, 0x8ce99a, 0x74c0fc, 0xb197fc, 0xffa94d];

  const bricks: Brick[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bx = brickAreaX + brickW / 2 + c * (brickW + brickGap);
      const by = brickAreaTop + brickH / 2 + r * (brickH + brickGap);
      const rect = scene.add.rectangle(bx, by, brickW, brickH, brickColors[r % brickColors.length]);
      rect.setStrokeStyle(3, 0xffffff, 0.75);
      ctx.layer.add(rect);
      bricks.push({ rect, active: true });
    }
  }

  const regenerate = () => {
    for (const b of bricks) {
      b.active = true;
      b.rect.setVisible(true);
      b.rect.setFillStyle(brickColors[Math.floor(Math.random() * brickColors.length)]);
    }
  };

  // --- Paddle (in theme accent) ---------------------------------------------
  const paddle = scene.add.rectangle(width / 2, paddleY, paddleW, paddleH, theme.accent);
  paddle.setStrokeStyle(4, 0xffffff, 0.85);
  ctx.layer.add(paddle);
  const crown = scene.add.text(width / 2, paddleY, '🏰', { fontSize: '30px' }).setOrigin(0.5);
  ctx.layer.add(crown);

  // --- Ball -----------------------------------------------------------------
  const ball = scene.add.circle(width / 2, brickAreaTop + ROWS * (brickH + brickGap) + 90, ballR, 0xffffff);
  ball.setStrokeStyle(3, theme.accent, 0.9);
  ctx.layer.add(ball);
  const face = scene.add.text(ball.x, ball.y, '⭐', { fontSize: '22px' }).setOrigin(0.5);
  ctx.layer.add(face);

  // --- State ----------------------------------------------------------------
  let score = 0;
  let over = false;
  let destroyed = false;
  let speed = 250; // px/sec
  const startAngle = -Math.PI / 2 - 0.4 + Math.random() * 0.8; // mostly upward
  let vx = Math.cos(startAngle) * speed;
  let vy = Math.sin(startAngle) * speed;
  let px = ball.x;
  let py = ball.y;

  // Gentle intro grace: ball drifts down slowly for the first moment.
  let launched = false;
  let graceMs = 800;

  const clampPaddle = (x: number) => {
    const half = paddleW / 2;
    return Phaser.Math.Clamp(x, leftX + half, rightX - half);
  };

  const setPaddleX = (x: number) => {
    const cx = clampPaddle(x);
    paddle.x = cx;
    crown.x = cx;
  };

  // --- Touch input: drag paddle left/right ---------------------------------
  let dragging = false;
  const onDown = (p: Phaser.Input.Pointer) => {
    dragging = true;
    setPaddleX(p.x);
  };
  const onMove = (p: Phaser.Input.Pointer) => {
    if (dragging || p.isDown) setPaddleX(p.x);
  };
  const onUp = () => {
    dragging = false;
  };
  scene.input.on('pointerdown', onDown, this);
  scene.input.on('pointermove', onMove, this);
  scene.input.on('pointerup', onUp, this);
  scene.input.on('pointerupoutside', onUp, this);

  // Keyboard bonus (never the only control).
  const cursors = scene.input.keyboard?.createCursorKeys();

  const endGame = () => {
    if (over) return;
    over = true;
    ctx.onGameOver(score);
  };

  const hitBrick = () => {
    let bounced = false;
    for (const b of bricks) {
      if (!b.active) continue;
      const rx = b.rect.x;
      const ry = b.rect.y;
      const halfW = brickW / 2;
      const halfH = brickH / 2;
      // Closest point on brick to ball center.
      const nearestX = Phaser.Math.Clamp(px, rx - halfW, rx + halfW);
      const nearestY = Phaser.Math.Clamp(py, ry - halfH, ry + halfH);
      const dx = px - nearestX;
      const dy = py - nearestY;
      if (dx * dx + dy * dy > ballR * ballR) continue;

      // Remove brick, score up.
      b.active = false;
      b.rect.setVisible(false);
      score += 1;
      ctx.onScore(score);
      chime('good');

      // Reflect: bounce off the shallower overlap axis.
      const overlapX = halfW + ballR - Math.abs(px - rx);
      const overlapY = halfH + ballR - Math.abs(py - ry);
      if (overlapX < overlapY) {
        vx = px < rx ? -Math.abs(vx) : Math.abs(vx);
      } else {
        vy = py < ry ? -Math.abs(vy) : Math.abs(vy);
      }
      bounced = true;
      break; // one brick per frame keeps it gentle
    }
    return bounced;
  };

  return {
    update(_time: number, delta: number) {
      if (over) return;
      const dt = delta / 1000;

      // Keyboard nudge.
      if (cursors) {
        if (cursors.left.isDown) setPaddleX(paddle.x - 620 * dt);
        else if (cursors.right.isDown) setPaddleX(paddle.x + 620 * dt);
      }

      if (!launched) {
        graceMs -= delta;
        py += 40 * dt; // slow drift so she can get ready
        if (graceMs <= 0) launched = true;
      } else {
        px += vx * dt;
        py += vy * dt;
      }

      // Wall bounces (top, left, right).
      if (py - ballR < top) {
        py = top + ballR;
        vy = Math.abs(vy);
      }
      if (px - ballR < leftX) {
        px = leftX + ballR;
        vx = Math.abs(vx);
      }
      if (px + ballR > rightX) {
        px = rightX - ballR;
        vx = -Math.abs(vx);
      }

      // Brick collisions.
      hitBrick();

      // All bricks cleared => fresh layout, score keeps climbing.
      if (!bricks.some((b) => b.active)) {
        regenerate();
        speed = Math.min(speed + 18, 430); // a touch quicker each board
      }

      // Paddle collision — generous hitbox, angle by hit position.
      const half = paddleW / 2;
      const nearPaddle = py + ballR >= paddleY - paddleH / 2 && py < paddleY + paddleH;
      const withinX = px >= paddle.x - half - ballR && px <= paddle.x + half + ballR;
      if (vy > 0 && nearPaddle && withinX) {
        const offset = Phaser.Math.Clamp((px - paddle.x) / half, -1, 1);
        const bounceAngle = -Math.PI / 2 + offset * 1.05; // steer left/right
        vx = Math.cos(bounceAngle) * speed;
        vy = -Math.abs(Math.sin(bounceAngle) * speed);
        if (Math.abs(vy) < 120) vy = -120; // keep it lively, never stall sideways
        py = paddleY - paddleH / 2 - ballR - 1;
      }

      // Fell past the bottom => game over.
      if (py - ballR > height + 30) {
        endGame();
        return;
      }

      ball.x = px;
      ball.y = py;
      face.x = px;
      face.y = py;
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
