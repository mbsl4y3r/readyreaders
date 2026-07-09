import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { chime } from '../../services/audio';

/**
 * Coral Cluster — our own gentle take on the classic Snood / bubble shooter.
 * Aim the launcher upward and fire a colored bubble; land three-or-more of a
 * color touching and the whole cluster pops (and anything left dangling drops
 * too). Clear the board for a fresh, fuller one. A generous timer ends the run
 * and the score is how many bubbles you popped. Forgiving for a six-year-old:
 * big bubbles, slow shots, a dotted aim guide with a wall-bounce preview.
 */

type Cell = { color: number; obj: Phaser.GameObjects.Container };

export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  const PALETTE = [0xff6b6b, 0x4fc3f7, 0x9ccc65, 0xffd166, 0xba68c8];
  const R = 34;
  const D = R * 2;
  const rowH = D * 0.87;
  const margin = 24;
  const wallL = margin;
  const wallR = width - margin;
  const COLS = 13;
  const y0 = hudBottom + R + 8;
  const launchX = width / 2;
  const launchY = height - 60;
  const dangerY = launchY - 150;
  const SHOT_SPEED = 880;
  const ROWS_INIT = 5;

  // ---- backdrop ---------------------------------------------------------
  const bg = scene.add.rectangle(width / 2, (hudBottom + height) / 2, width, height - hudBottom, theme.bgBottom);
  ctx.layer.add(bg);
  const dline = scene.add.rectangle(width / 2, dangerY, width, 3, 0xffffff, 0.18);
  ctx.layer.add(dline);
  const base = scene.add.circle(launchX, launchY + 8, 46, theme.accent, 0.5);
  ctx.layer.add(base);
  const aim = scene.add.graphics();
  ctx.layer.add(aim);
  const timeText = scene.add
    .text(wallR - 8, hudBottom + 18, '', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' })
    .setOrigin(1, 0.5);
  ctx.layer.add(timeText);

  // ---- helpers ----------------------------------------------------------
  const cellX = (r: number, c: number): number => wallL + R + c * D + (r % 2) * R;
  const cellY = (r: number): number => y0 + r * rowH;
  const key = (r: number, c: number): string => `${r}:${c}`;
  const grid = new Map<string, Cell>();

  function makeBubble(color: number): Phaser.GameObjects.Container {
    const c = scene.add.container(0, 0);
    const body = scene.add.circle(0, 0, R - 3, color, 1);
    body.setStrokeStyle(3, 0xffffff, 0.35);
    const shine = scene.add.circle(-R * 0.32, -R * 0.32, R * 0.24, 0xffffff, 0.5);
    c.add(body);
    c.add(shine);
    ctx.layer.add(c);
    return c;
  }

  function place(r: number, c: number, color: number): void {
    const obj = makeBubble(color);
    obj.setPosition(cellX(r, c), cellY(r));
    grid.set(key(r, c), { color, obj });
  }

  // offset-right hex adjacency (depends on row parity)
  const neighbors = (r: number, c: number): [number, number][] => {
    const deltas: [number, number][] =
      r % 2 === 0
        ? [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]
        : [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
    const out: [number, number][] = [];
    for (const [dr, dc] of deltas) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nc >= 0 && nc < COLS) out.push([nr, nc]);
    }
    return out;
  };

  function fillBoard(): void {
    for (const cell of grid.values()) cell.obj.destroy();
    grid.clear();
    for (let r = 0; r < ROWS_INIT; r++) {
      for (let c = 0; c < COLS; c++) {
        place(r, c, PALETTE[Math.floor(Math.random() * PALETTE.length)]!);
      }
    }
  }

  const pickColor = (): number => {
    const s = new Set<number>();
    for (const cell of grid.values()) s.add(cell.color);
    const pool = s.size ? [...s] : PALETTE;
    return pool[Math.floor(Math.random() * pool.length)]!;
  };

  function nearestEmpty(x: number, y: number): [number, number] {
    const r0 = Math.max(0, Math.round((y - y0) / rowH));
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid.has(key(r, c))) continue;
        const supported = r === 0 || neighbors(r, c).some(([nr, nc]) => grid.has(key(nr, nc)));
        if (!supported) continue;
        const d = Math.hypot(cellX(r, c) - x, cellY(r) - y);
        if (d < bestD) { bestD = d; best = [r, c]; }
      }
    }
    if (best) return best;
    const c = Phaser.Math.Clamp(Math.round((x - wallL - R - (r0 % 2) * R) / D), 0, COLS - 1);
    return [r0, c];
  }

  function sameCluster(r: number, c: number, color: number): string[] {
    const seen = new Set<string>([key(r, c)]);
    const stack: [number, number][] = [[r, c]];
    const out = [key(r, c)];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      for (const [nr, nc] of neighbors(cr, cc)) {
        const k = key(nr, nc);
        const cell = grid.get(k);
        if (cell && cell.color === color && !seen.has(k)) {
          seen.add(k);
          out.push(k);
          stack.push([nr, nc]);
        }
      }
    }
    return out;
  }

  const popKeys = (keys: string[]): void => {
    for (const k of keys) {
      const cell = grid.get(k);
      if (cell) { cell.obj.destroy(); grid.delete(k); }
    }
  };

  function dropFloating(): number {
    const anchored = new Set<string>();
    const stack: [number, number][] = [];
    for (let c = 0; c < COLS; c++) {
      if (grid.has(key(0, c))) { anchored.add(key(0, c)); stack.push([0, c]); }
    }
    while (stack.length) {
      const [r, c] = stack.pop()!;
      for (const [nr, nc] of neighbors(r, c)) {
        const k = key(nr, nc);
        if (grid.has(k) && !anchored.has(k)) { anchored.add(k); stack.push([nr, nc]); }
      }
    }
    const floating = [...grid.keys()].filter((k) => !anchored.has(k));
    popKeys(floating);
    return floating.length;
  }

  // ---- launcher queue ---------------------------------------------------
  fillBoard();
  let curColor = pickColor();
  let nextColor = pickColor();
  let loaded = makeBubble(curColor);
  loaded.setPosition(launchX, launchY);
  let preview = makeBubble(nextColor);
  preview.setPosition(launchX + 84, launchY + 6).setScale(0.6);

  function advanceQueue(): void {
    curColor = nextColor;
    nextColor = pickColor();
    loaded = makeBubble(curColor);
    loaded.setPosition(launchX, launchY);
    preview.destroy();
    preview = makeBubble(nextColor);
    preview.setPosition(launchX + 84, launchY + 6).setScale(0.6);
  }

  // ---- state ------------------------------------------------------------
  let phase: 'aim' | 'fly' | 'over' = 'aim';
  let angle = -Math.PI / 2;
  let shot: Phaser.GameObjects.Container | null = null;
  let shotColor = curColor;
  let sx = launchX;
  let sy = launchY;
  let vx = 0;
  let vy = 0;
  let score = 0;
  let timeLeft = 95_000;
  let destroyed = false;

  const setAim = (px: number, py: number): void => {
    let a = Math.atan2(py - launchY, px - launchX);
    const min = -Math.PI + 0.28;
    const max = -0.28;
    angle = a > max ? max : a < min ? min : a;
  };

  function drawAim(): void {
    aim.clear();
    if (phase !== 'aim') return;
    let x = launchX;
    let y = launchY;
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    aim.fillStyle(0xffffff, 0.7);
    let bounced = false;
    for (let i = 0; i < 90; i++) {
      x += dx * 22;
      y += dy * 22;
      if (x < wallL + R) { x = wallL + R; dx = -dx; bounced = true; }
      else if (x > wallR - R) { x = wallR - R; dx = -dx; bounced = true; }
      if (y < y0 - R) break;
      aim.fillCircle(x, y, i % 2 === 0 ? 5 : 3);
      if (bounced && y < y0 + rowH * 2) break;
    }
  }

  function endGame(): void {
    if (phase === 'over') return;
    phase = 'over';
    ctx.onGameOver(score);
  }

  function settleShot(): void {
    const [r, c] = nearestEmpty(sx, sy);
    place(r, c, shotColor);
    shot?.destroy();
    shot = null;
    const cluster = sameCluster(r, c, shotColor);
    if (cluster.length >= 3) {
      popKeys(cluster);
      const dropped = dropFloating();
      score += cluster.length + dropped;
      ctx.onScore(score);
      chime('good');
      if (grid.size === 0) fillBoard();
    } else if (cellY(r) >= dangerY) {
      endGame();
      return;
    } else {
      chime('gentle');
    }
    if (phase !== 'over') phase = 'aim';
  }

  // ---- input ------------------------------------------------------------
  const onDown = (p: Phaser.Input.Pointer): void => { if (phase === 'aim') setAim(p.x, p.y); };
  const onMove = (p: Phaser.Input.Pointer): void => { if (phase === 'aim' && p.isDown) setAim(p.x, p.y); };
  const onUp = (p: Phaser.Input.Pointer): void => {
    if (phase !== 'aim') return;
    setAim(p.x, p.y);
    shotColor = curColor;
    sx = launchX;
    sy = launchY;
    vx = Math.cos(angle) * SHOT_SPEED;
    vy = Math.sin(angle) * SHOT_SPEED;
    shot = loaded;
    advanceQueue();
    phase = 'fly';
    aim.clear();
  };
  scene.input.on('pointerdown', onDown, this);
  scene.input.on('pointermove', onMove, this);
  scene.input.on('pointerup', onUp, this);

  return {
    update(_time: number, delta: number): void {
      if (phase === 'over' || destroyed) return;
      const dt = Math.min(delta, 40) / 1000;

      timeLeft -= delta;
      if (timeLeft <= 0) { timeLeft = 0; endGame(); return; }
      timeText.setText(`⏱ ${Math.ceil(timeLeft / 1000)}s`);

      if (phase === 'aim') { drawAim(); return; }

      if (phase === 'fly' && shot) {
        sx += vx * dt;
        sy += vy * dt;
        if (sx < wallL + R) { sx = wallL + R; vx = Math.abs(vx); }
        else if (sx > wallR - R) { sx = wallR - R; vx = -Math.abs(vx); }
        shot.setPosition(sx, sy);
        let hit = sy <= y0;
        if (!hit) {
          for (const cell of grid.values()) {
            if (Math.hypot(cell.obj.x - sx, cell.obj.y - sy) < D * 0.9) { hit = true; break; }
          }
        }
        if (hit) settleShot();
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
