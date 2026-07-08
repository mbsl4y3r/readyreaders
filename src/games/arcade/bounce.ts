import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';

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
  const pearlR = 22;

  // --- Paddle (a shell/bar) -------------------------------------------------
  const paddle = scene.add.rectangle(width / 2, paddleY, paddleW, paddleH, theme.accent);
  paddle.setStrokeStyle(4, 0xffffff, 0.85);
  ctx.layer.add(paddle);
  const shell = scene.add.text(width / 2, paddleY, '🐚', { fontSize: '38px' }).setOrigin(0.5);
  ctx.layer.add(shell);

  // --- Pearl ----------------------------------------------------------------
  const pearl = scene.add.circle(width / 2, top + 120, pearlR, 0xffffff);
  pearl.setStrokeStyle(3, theme.accent, 0.9);
  ctx.layer.add(pearl);
  const sparkle = scene.add.text(pearl.x, pearl.y, '✨', { fontSize: '20px' }).setOrigin(0.5);
  ctx.layer.add(sparkle);

  // --- State ----------------------------------------------------------------
  let score = 0;
  let over = false;
  let destroyed = false;
  let speed = 260; // px/sec, grows a little each rally
  const startAngle = -Math.PI / 2 - 0.4 + Math.random() * 0.8; // mostly upward
  let vx = Math.cos(startAngle) * speed;
  let vy = Math.sin(startAngle) * speed;
  let px = pearl.x;
  let py = pearl.y;

  // Gentle intro grace: pearl drifts down slowly for the first moment.
  let launched = false;
  let graceMs = 700;

  const clampPaddle = (x: number) => {
    const half = paddleW / 2;
    return Phaser.Math.Clamp(x, leftX + half, rightX - half);
  };

  const setPaddleX = (x: number) => {
    const cx = clampPaddle(x);
    paddle.x = cx;
    shell.x = cx;
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

  const bumpTween = scene.tweens.add({
    targets: paddle,
    scaleY: 1.25,
    duration: 90,
    yoyo: true,
    paused: true,
  });

  const endGame = () => {
    if (over) return;
    over = true;
    ctx.onGameOver(score);
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
      if (py - pearlR < top) {
        py = top + pearlR;
        vy = Math.abs(vy);
      }
      if (px - pearlR < leftX) {
        px = leftX + pearlR;
        vx = Math.abs(vx);
      }
      if (px + pearlR > rightX) {
        px = rightX - pearlR;
        vx = -Math.abs(vx);
      }

      // Paddle collision — generous hitbox, angle by hit position.
      const half = paddleW / 2;
      const nearPaddle = py + pearlR >= paddleY - paddleH / 2 && py < paddleY + paddleH;
      const withinX = px >= paddle.x - half - pearlR && px <= paddle.x + half + pearlR;
      if (vy > 0 && nearPaddle && withinX) {
        score += 1;
        ctx.onScore(score);
        speed = Math.min(speed + 12, 560); // very slight speed-up per rally
        const offset = Phaser.Math.Clamp((px - paddle.x) / half, -1, 1);
        const bounceAngle = -Math.PI / 2 + offset * 1.05; // steer left/right
        vx = Math.cos(bounceAngle) * speed;
        vy = -Math.abs(Math.sin(bounceAngle) * speed);
        if (Math.abs(vy) < 120) vy = -120; // keep it lively, never stall sideways
        py = paddleY - paddleH / 2 - pearlR - 1;
        bumpTween.restart();
      }

      // Fell past the bottom => game over.
      if (py - pearlR > height + 30) {
        endGame();
        return;
      }

      pearl.x = px;
      pearl.y = py;
      sparkle.x = px;
      sparkle.y = py;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, this);
      scene.input.off('pointermove', onMove, this);
      scene.input.off('pointerup', onUp, this);
      scene.input.off('pointerupoutside', onUp, this);
      bumpTween.stop();
    },
  } satisfies ArcadeGame;
};
