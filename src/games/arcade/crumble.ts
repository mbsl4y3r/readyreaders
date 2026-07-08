import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

type BrickKind = 'normal' | 'double' | 'wide' | 'bonus';

interface Brick {
  rect: Phaser.GameObjects.Rectangle;
  glyph: Phaser.GameObjects.Text;
  kind: BrickKind;
  baseColor: number;
  active: boolean;
}

interface Ball {
  circle: Phaser.GameObjects.Arc;
  face: Phaser.GameObjects.Text;
  x: number;
  y: number;
  vx: number;
  vy: number;
  launched: boolean;
  graceMs: number;
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
  const basePaddleW = 220;
  const widePaddleW = 340;
  const paddleH = 30;
  const paddleY = height - 46;
  const ballR = 20;
  const MAX_BALLS = 6;
  const BONUS_POINTS = 5;

  // Special power-up bricks: distinct colour + a little glyph so they read apart.
  const SPECIAL: Record<Exclude<BrickKind, 'normal'>, { color: number; glyph: string }> = {
    double: { color: 0x4dabf7, glyph: '➕' }, // splits into an extra ball
    wide: { color: 0x69db7c, glyph: '↔️' }, // paddle grows for a while
    bonus: { color: 0xffd43b, glyph: '💎' }, // extra points
  };

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

  // Mostly normal bricks, sprinkled with a few specials.
  const rollKind = (): BrickKind => {
    const r = Math.random();
    if (r < 0.06) return 'double';
    if (r < 0.11) return 'wide';
    if (r < 0.16) return 'bonus';
    return 'normal';
  };

  const styleBrick = (b: Brick, kind: BrickKind) => {
    b.kind = kind;
    if (kind === 'normal') {
      b.rect.setFillStyle(b.baseColor);
      b.glyph.setVisible(false);
    } else {
      const s = SPECIAL[kind];
      b.rect.setFillStyle(s.color);
      b.glyph.setText(s.glyph).setVisible(true);
    }
  };

  const bricks: Brick[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bx = brickAreaX + brickW / 2 + c * (brickW + brickGap);
      const by = brickAreaTop + brickH / 2 + r * (brickH + brickGap);
      const baseColor = brickColors[r % brickColors.length] ?? 0xff8fb3;
      const rect = scene.add.rectangle(bx, by, brickW, brickH, baseColor);
      rect.setStrokeStyle(3, 0xffffff, 0.75);
      ctx.layer.add(rect);
      const glyph = emojiText(scene, bx, by, '', 22);
      ctx.layer.add(glyph);
      const brick: Brick = { rect, glyph, kind: 'normal', baseColor, active: true };
      styleBrick(brick, rollKind());
      bricks.push(brick);
    }
  }

  const regenerate = () => {
    for (const b of bricks) {
      b.active = true;
      b.rect.setVisible(true);
      styleBrick(b, rollKind());
    }
  };

  // --- Paddle (in theme accent) ---------------------------------------------
  let paddleW = basePaddleW;
  const paddle = scene.add.rectangle(width / 2, paddleY, basePaddleW, paddleH, theme.accent);
  paddle.setStrokeStyle(4, 0xffffff, 0.85);
  ctx.layer.add(paddle);
  const crown = emojiText(scene, width / 2, paddleY, '🏰', 30);
  ctx.layer.add(crown);
  let wideMs = 0; // remaining time on the wide-paddle power-up

  const clampPaddle = (x: number) => {
    const half = paddleW / 2;
    return Phaser.Math.Clamp(x, leftX + half, rightX - half);
  };

  const setPaddleX = (x: number) => {
    const cx = clampPaddle(x);
    paddle.x = cx;
    crown.x = cx;
  };

  const setPaddleWidth = (w: number) => {
    paddleW = w;
    paddle.setDisplaySize(w, paddleH); // scales the accent bar to the new width
    setPaddleX(paddle.x); // re-clamp in case a grown paddle now pokes a wall
  };

  // --- Balls (start with one; power-ups add more) ---------------------------
  const balls: Ball[] = [];
  let speed = 250; // px/sec — shared bounce speed

  const spawnBall = (bx: number, by: number, bvx: number, bvy: number, isLaunched: boolean): Ball => {
    const circle = scene.add.circle(bx, by, ballR, 0xffffff);
    circle.setStrokeStyle(3, theme.accent, 0.9);
    ctx.layer.add(circle);
    const face = emojiText(scene, bx, by, '⭐', 22);
    ctx.layer.add(face);
    const b: Ball = { circle, face, x: bx, y: by, vx: bvx, vy: bvy, launched: isLaunched, graceMs: isLaunched ? 0 : 800 };
    balls.push(b);
    return b;
  };

  const startAngle = -Math.PI / 2 - 0.4 + Math.random() * 0.8; // mostly upward
  spawnBall(
    width / 2,
    brickAreaTop + ROWS * (brickH + brickGap) + 90,
    Math.cos(startAngle) * speed,
    Math.sin(startAngle) * speed,
    false,
  );

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

  let score = 0;
  let over = false;
  let destroyed = false;

  const endGame = () => {
    if (over) return;
    over = true;
    ctx.onGameOver(score);
  };

  // Fire the effect of a special brick that `src` just broke.
  const applyPowerUp = (kind: BrickKind, src: Ball) => {
    if (kind === 'double') {
      // Split: the source ball and a fresh twin fan out from the hit point.
      const spd = Math.hypot(src.vx, src.vy) || speed;
      const ang = Math.atan2(src.vy, src.vx);
      if (balls.length < MAX_BALLS) {
        spawnBall(src.x, src.y, Math.cos(ang + 0.5) * spd, Math.sin(ang + 0.5) * spd, true);
        src.vx = Math.cos(ang - 0.5) * spd;
        src.vy = Math.sin(ang - 0.5) * spd;
      }
      chime('good');
    } else if (kind === 'wide') {
      setPaddleWidth(widePaddleW);
      wideMs = 7000;
      chime('good');
    } else if (kind === 'bonus') {
      score += BONUS_POINTS;
      ctx.onScore(score);
      chime('fanfare');
    }
  };

  // Break at most one brick for this ball this frame (keeps things gentle).
  const collideBricks = (b: Ball) => {
    for (const brick of bricks) {
      if (!brick.active) continue;
      const rx = brick.rect.x;
      const ry = brick.rect.y;
      const halfW = brickW / 2;
      const halfH = brickH / 2;
      // Closest point on brick to ball center.
      const nearestX = Phaser.Math.Clamp(b.x, rx - halfW, rx + halfW);
      const nearestY = Phaser.Math.Clamp(b.y, ry - halfH, ry + halfH);
      const dx = b.x - nearestX;
      const dy = b.y - nearestY;
      if (dx * dx + dy * dy > ballR * ballR) continue;

      // Remove brick, score up.
      brick.active = false;
      brick.rect.setVisible(false);
      brick.glyph.setVisible(false);
      score += 1;
      ctx.onScore(score);

      // Reflect: bounce off the shallower overlap axis.
      const overlapX = halfW + ballR - Math.abs(b.x - rx);
      const overlapY = halfH + ballR - Math.abs(b.y - ry);
      if (overlapX < overlapY) {
        b.vx = b.x < rx ? -Math.abs(b.vx) : Math.abs(b.vx);
      } else {
        b.vy = b.y < ry ? -Math.abs(b.vy) : Math.abs(b.vy);
      }

      if (brick.kind === 'normal') chime('good');
      else applyPowerUp(brick.kind, b);
      break;
    }
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

      // Wide-paddle power-up winds down.
      if (wideMs > 0) {
        wideMs -= delta;
        if (wideMs <= 0) setPaddleWidth(basePaddleW);
      }

      const half = paddleW / 2;

      // Snapshot so twins spawned mid-loop wait until next frame.
      for (const b of balls.slice()) {
        if (!b.launched) {
          b.graceMs -= delta;
          b.y += 40 * dt; // slow drift so she can get ready
          if (b.graceMs <= 0) b.launched = true;
        } else {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
        }

        // Wall bounces (top, left, right).
        if (b.y - ballR < top) {
          b.y = top + ballR;
          b.vy = Math.abs(b.vy);
        }
        if (b.x - ballR < leftX) {
          b.x = leftX + ballR;
          b.vx = Math.abs(b.vx);
        }
        if (b.x + ballR > rightX) {
          b.x = rightX - ballR;
          b.vx = -Math.abs(b.vx);
        }

        // Brick collisions.
        collideBricks(b);

        // Paddle collision — generous hitbox, angle by hit position.
        const nearPaddle = b.y + ballR >= paddleY - paddleH / 2 && b.y < paddleY + paddleH;
        const withinX = b.x >= paddle.x - half - ballR && b.x <= paddle.x + half + ballR;
        if (b.vy > 0 && nearPaddle && withinX) {
          const offset = Phaser.Math.Clamp((b.x - paddle.x) / half, -1, 1);
          const bounceAngle = -Math.PI / 2 + offset * 1.05; // steer left/right
          b.vx = Math.cos(bounceAngle) * speed;
          b.vy = -Math.abs(Math.sin(bounceAngle) * speed);
          if (Math.abs(b.vy) < 120) b.vy = -120; // keep it lively, never stall sideways
          b.y = paddleY - paddleH / 2 - ballR - 1;
        }

        // Move the sprite to match.
        b.circle.x = b.x;
        b.circle.y = b.y;
        b.face.x = b.x;
        b.face.y = b.y;
      }

      // Retire balls that fell past the bottom. Losing one only stings if it
      // was the last — extra balls are a safety cushion.
      for (let i = balls.length - 1; i >= 0; i--) {
        const dead = balls[i];
        if (dead && dead.y - ballR > height + 30) {
          dead.circle.destroy();
          dead.face.destroy();
          balls.splice(i, 1);
          if (balls.length > 0) chime('gentle');
        }
      }
      if (balls.length === 0) {
        endGame();
        return;
      }

      // All bricks cleared => fresh layout, score keeps climbing.
      if (!bricks.some((b) => b.active)) {
        regenerate();
        speed = Math.min(speed + 18, 430); // a touch quicker each board
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
