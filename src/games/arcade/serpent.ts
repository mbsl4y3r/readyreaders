import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

type Cell = { x: number; y: number };
type Dir = { x: number; y: number };

export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // ---- Grid geometry ---------------------------------------------------
  const COLS = 22;
  const ROWS = 13;
  const areaTop = hudBottom;
  const areaH = height - areaTop;
  const cell = Math.floor(Math.min(width / COLS, areaH / ROWS));
  const gridW = cell * COLS;
  const gridH = cell * ROWS;
  const offX = (width - gridW) / 2;
  const offY = areaTop + (areaH - gridH) / 2;
  const cx = (c: number) => offX + c * cell + cell / 2;
  const cy = (r: number) => offY + r * cell + cell / 2;

  // ---- Background & walls ----------------------------------------------
  const bg = scene.add.rectangle(width / 2, areaTop + areaH / 2, width, areaH, theme.bgTop);
  ctx.layer.add(bg);
  const pool = scene.add.rectangle(offX + gridW / 2, offY + gridH / 2, gridW + 12, gridH + 12, theme.bgBottom);
  pool.setStrokeStyle(6, theme.accent, 0.5);
  ctx.layer.add(pool);

  // ---- Bubble (food) ----------------------------------------------------
  const bubble = emojiText(scene, cx(0), cy(0), '🫧', Math.floor(cell * 0.7));
  ctx.layer.add(bubble);

  // ---- Serpent graphics -------------------------------------------------
  const gfx = scene.add.graphics();
  ctx.layer.add(gfx);

  // ---- On-screen D-pad --------------------------------------------------
  const pad = scene.add.graphics();
  ctx.layer.add(pad);
  const btn = (x: number, y: number, dir: Dir) => ({ x, y, w: 84, h: 84, dir });
  const baseX = 118;
  const baseY = height - 150;
  const buttons = [
    btn(baseX, baseY - 92, { x: 0, y: -1 }), // up
    btn(baseX, baseY + 92, { x: 0, y: 1 }), //  down
    btn(baseX - 96, baseY, { x: -1, y: 0 }), // left
    btn(baseX + 96, baseY, { x: 1, y: 0 }), //  right
  ];
  pad.fillStyle(0xffffff, 0.16);
  pad.lineStyle(3, theme.accent, 0.4);
  for (const b of buttons) {
    pad.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 18);
    pad.strokeRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 18);
    const s = 20;
    pad.fillStyle(0xffffff, 0.85);
    pad.fillTriangle(
      b.x + b.dir.x * s, b.y + b.dir.y * s,
      b.x - b.dir.x * s + b.dir.y * s, b.y - b.dir.y * s + b.dir.x * s,
      b.x - b.dir.x * s - b.dir.y * s, b.y - b.dir.y * s - b.dir.x * s,
    );
    pad.fillStyle(0xffffff, 0.16);
  }

  // ---- Game state -------------------------------------------------------
  let snake: Cell[] = [
    { x: 8, y: 6 },
    { x: 7, y: 6 },
    { x: 6, y: 6 },
  ];
  let dir: Dir = { x: 1, y: 0 };
  let nextDir: Dir = { x: 1, y: 0 };
  let food: Cell = { x: 14, y: 6 };
  let score = 0;
  let acc = 0;
  const STEP_MS = 185;
  let over = false;
  let destroyed = false;

  const placeFood = () => {
    const free: Cell[] = [];
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        if (!snake.some((s) => s.x === c && s.y === r)) free.push({ x: c, y: r });
    const pick = free[Math.floor(Math.random() * free.length)];
    if (!pick) return;
    food = pick;
    bubble.setPosition(cx(food.x), cy(food.y));
  };
  placeFood();

  const setDir = (d: Dir) => {
    // no instant reversal
    if (d.x === -dir.x && d.y === -dir.y) return;
    nextDir = d;
  };

  const draw = () => {
    gfx.clear();
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      if (!seg) continue;
      const px = cx(seg.x);
      const py = cy(seg.y);
      const size = cell - 6;
      gfx.fillStyle(theme.accent, i === 0 ? 1 : 0.85);
      gfx.fillRoundedRect(px - size / 2, py - size / 2, size, size, 14);
      if (i === 0) {
        // cute eyes on the head, facing the travel direction
        const fx = dir.x;
        const fy = dir.y;
        const ex = px + fx * cell * 0.14;
        const ey = py + fy * cell * 0.14;
        const perpX = fy;
        const perpY = fx;
        const off = cell * 0.18;
        for (const s of [1, -1]) {
          const wx = ex + perpX * off * s;
          const wy = ey + perpY * off * s;
          gfx.fillStyle(0xffffff, 1);
          gfx.fillCircle(wx, wy, cell * 0.12);
          gfx.fillStyle(0x223344, 1);
          gfx.fillCircle(wx + fx * 2, wy + fy * 2, cell * 0.06);
        }
      }
    }
  };
  draw();

  const endGame = () => {
    if (over) return;
    over = true;
    chime('gentle');
    ctx.onGameOver(score);
  };

  const step = () => {
    dir = nextDir;
    const cur = snake[0];
    if (!cur) return;
    const head = { x: cur.x + dir.x, y: cur.y + dir.y };
    // wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      endGame();
      return;
    }
    const eating = head.x === food.x && head.y === food.y;
    // self collision (ignore tail cell when not growing, since it will move)
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some((s) => s.x === head.x && s.y === head.y)) {
      endGame();
      return;
    }
    snake.unshift(head);
    if (eating) {
      score += 1;
      ctx.onScore(score);
      chime('good');
      placeFood();
    } else {
      snake.pop();
    }
    draw();
  };

  // ---- Input ------------------------------------------------------------
  let downX = 0;
  let downY = 0;
  let onButton = false;

  const hitButton = (x: number, y: number): Dir | null => {
    for (const b of buttons) {
      if (x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h / 2 && y <= b.y + b.h / 2)
        return b.dir;
    }
    return null;
  };

  const onDown = (p: Phaser.Input.Pointer) => {
    downX = p.x;
    downY = p.y;
    const hit = hitButton(p.x, p.y);
    onButton = hit !== null;
    if (hit) setDir(hit);
  };
  const onUp = (p: Phaser.Input.Pointer) => {
    if (onButton) {
      onButton = false;
      return;
    }
    const dx = p.x - downX;
    const dy = p.y - downY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir({ x: dx > 0 ? 1 : -1, y: 0 });
    else setDir({ x: 0, y: dy > 0 ? 1 : -1 });
  };
  scene.input.on('pointerdown', onDown, scene);
  scene.input.on('pointerup', onUp, scene);

  const cursors = scene.input.keyboard?.createCursorKeys();

  return {
    update(_time: number, delta: number) {
      if (over) return;
      if (cursors) {
        if (cursors.left.isDown) setDir({ x: -1, y: 0 });
        else if (cursors.right.isDown) setDir({ x: 1, y: 0 });
        else if (cursors.up.isDown) setDir({ x: 0, y: -1 });
        else if (cursors.down.isDown) setDir({ x: 0, y: 1 });
      }
      acc += delta;
      while (acc >= STEP_MS && !over) {
        acc -= STEP_MS;
        step();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, scene);
      scene.input.off('pointerup', onUp, scene);
    },
  } satisfies ArcadeGame;
};
