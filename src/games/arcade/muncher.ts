import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

type Dir = { x: number; y: number };
type Mover = { t: Phaser.GameObjects.Text; col: number; row: number; dir: Dir; px: number; py: number };
type Chaser = Mover & { thinkMs: number };

export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // ---- Grid geometry ----------------------------------------------------
  const COLS = 13;
  const ROWS = 9;
  const areaTop = hudBottom;
  const areaH = height - areaTop;
  const cell = Math.floor(Math.min(width / COLS, areaH / ROWS));
  const gridW = cell * COLS;
  const gridH = cell * ROWS;
  const offX = (width - gridW) / 2;
  const offY = areaTop + (areaH - gridH) / 2;
  const cx = (c: number) => offX + c * cell + cell / 2;
  const cy = (r: number) => offY + r * cell + cell / 2;

  // ---- Playfield background ---------------------------------------------
  const bg = scene.add.rectangle(width / 2, areaTop + areaH / 2, width, areaH, theme.bgBottom);
  ctx.layer.add(bg);
  const board = scene.add.rectangle(offX + gridW / 2, offY + gridH / 2, gridW, gridH, theme.bgTop, 0.6);
  board.setStrokeStyle(6, theme.accent, 0.5);
  ctx.layer.add(board);

  // ---- Maze state -------------------------------------------------------
  // walls[row][col] === true means a solid block.
  let walls: boolean[][] = [];
  const wallRects: Phaser.GameObjects.Rectangle[] = [];
  const pearls: (Phaser.GameObjects.Arc | null)[][] = [];
  let pearlsLeft = 0;

  const isWall = (c: number, r: number): boolean =>
    c < 0 || r < 0 || c >= COLS || r >= ROWS || walls[r]![c]!;

  function clearGrid(): void {
    for (const w of wallRects) w.destroy();
    wallRects.length = 0;
    for (const rowArr of pearls) for (const p of rowArr) if (p) p.destroy();
    pearls.length = 0;
    pearlsLeft = 0;
  }

  function buildMaze(): void {
    clearGrid();
    // Border walls + a handful of interior single blocks on even/even cells so
    // corridors always stay open and the whole open area is connected.
    walls = [];
    for (let r = 0; r < ROWS; r++) {
      const rowArr: boolean[] = [];
      for (let c = 0; c < COLS; c++) {
        const border = c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1;
        rowArr.push(border);
      }
      walls.push(rowArr);
    }
    // interior blocks only on cells where both col and row are even -> keeps
    // every odd corridor open, guaranteeing a solvable maze.
    for (let r = 2; r < ROWS - 1; r += 2) {
      const wrow = walls[r]!;
      for (let c = 2; c < COLS - 1; c += 2) {
        if (Math.random() < 0.6) wrow[c] = true;
      }
    }
    // draw walls + pearls
    for (let r = 0; r < ROWS; r++) {
      const wrow = walls[r]!;
      const prow: (Phaser.GameObjects.Arc | null)[] = [];
      for (let c = 0; c < COLS; c++) {
        if (wrow[c]) {
          const wr = scene.add.rectangle(cx(c), cy(r), cell - 2, cell - 2, theme.accent, 0.85);
          wr.setStrokeStyle(2, 0xffffff, 0.25);
          ctx.layer.add(wr);
          wallRects.push(wr);
          prow.push(null);
        } else {
          const dot = scene.add.circle(cx(c), cy(r), Math.max(3, cell * 0.11), 0xfff2b0, 1);
          ctx.layer.add(dot);
          prow.push(dot);
          pearlsLeft++;
        }
      }
      pearls.push(prow);
    }
  }

  buildMaze();

  // ---- Movers -----------------------------------------------------------
  const muncherSize = Math.floor(cell * 0.7);
  const munch = emojiText(scene, cx(1), cy(1), '🟡', muncherSize);
  ctx.layer.add(munch);
  const player: Mover = { t: munch, col: 1, row: 1, dir: { x: 0, y: 0 }, px: cx(1), py: cy(1) };
  let nextDir: Dir = { x: 0, y: 0 };
  // eat the starting pearl
  const eatAt = (c: number, r: number): void => {
    const row = pearls[r];
    if (row && row[c]) { row[c]!.destroy(); row[c] = null; pearlsLeft--; }
  };
  eatAt(1, 1);

  const jellyEmojis = ['🟣', '🔵'];
  const jellies: Chaser[] = [];
  function spawnJellies(): void {
    jellies.length = 0;
    const spots: [number, number][] = [[COLS - 2, ROWS - 2], [COLS - 2, 1]];
    for (let i = 0; i < spots.length; i++) {
      const [c, r] = spots[i]!;
      const jt = emojiText(scene, cx(c), cy(r), jellyEmojis[i]!, muncherSize);
      ctx.layer.add(jt);
      jellies.push({ t: jt, col: c, row: r, dir: { x: 0, y: 0 }, px: cx(c), py: cy(r), thinkMs: 0 });
    }
  }
  spawnJellies();

  // ---- Input: swipe + on-screen d-pad ----------------------------------
  let downX = 0, downY = 0, downTime = 0;
  const onDown = (p: Phaser.Input.Pointer): void => { downX = p.x; downY = p.y; downTime = p.downTime; };
  const onUp = (p: Phaser.Input.Pointer): void => {
    const dx = p.x - downX, dy = p.y - downY;
    // ignore taps on the d-pad buttons (handled by their own hit events)
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (p.upTime - downTime > 900) return;
    if (Math.abs(dx) > Math.abs(dy)) nextDir = { x: dx > 0 ? 1 : -1, y: 0 };
    else nextDir = { x: 0, y: dy > 0 ? 1 : -1 };
  };
  scene.input.on('pointerdown', onDown, this);
  scene.input.on('pointerup', onUp, this);

  const cursors = scene.input.keyboard?.createCursorKeys();

  // big directional buttons in the bottom-right corner
  const btnR = Math.max(34, cell * 0.55);
  const padCx = width - btnR * 3.2;
  const padCy = height - btnR * 3.2;
  const arrows: { dir: Dir; ox: number; oy: number; label: string }[] = [
    { dir: { x: 0, y: -1 }, ox: 0, oy: -1, label: '⬆️' },
    { dir: { x: 0, y: 1 }, ox: 0, oy: 1, label: '⬇️' },
    { dir: { x: -1, y: 0 }, ox: -1, oy: 0, label: '⬅️' },
    { dir: { x: 1, y: 0 }, ox: 1, oy: 0, label: '➡️' },
  ];
  const padButtons: Phaser.GameObjects.Arc[] = [];
  for (const a of arrows) {
    const bx = padCx + a.ox * btnR * 1.9;
    const by = padCy + a.oy * btnR * 1.9;
    const circ = scene.add.circle(bx, by, btnR, 0xffffff, 0.22);
    circ.setStrokeStyle(3, theme.accent, 0.6);
    circ.setInteractive({ useHandCursor: true });
    circ.on('pointerdown', () => { nextDir = { x: a.dir.x, y: a.dir.y }; });
    ctx.layer.add(circ);
    padButtons.push(circ);
    const glyph = emojiText(scene, bx, by, a.label, Math.floor(btnR * 0.9));
    ctx.layer.add(glyph);
  }

  // ---- Loop state -------------------------------------------------------
  const playerSpeed = cell * 3.6; // px/sec
  const jellySpeed = cell * 2.1; // slower & dumb
  let over = false;
  let destroyed = false;
  let score = 0;

  function atCenter(m: Mover): boolean {
    return Math.abs(m.px - cx(m.col)) < 1 && Math.abs(m.py - cy(m.row)) < 1;
  }

  function stepMover(m: Mover, speed: number, delta: number): void {
    const dist = speed * delta / 1000;
    m.px += m.dir.x * dist;
    m.py += m.dir.y * dist;
    // snap and advance grid cell when passing target center
    const tx = cx(m.col + m.dir.x), ty = cy(m.row + m.dir.y);
    if (m.dir.x !== 0 && (m.dir.x > 0 ? m.px >= tx : m.px <= tx)) { m.col += m.dir.x; m.px = tx; }
    if (m.dir.y !== 0 && (m.dir.y > 0 ? m.py >= ty : m.py <= ty)) { m.row += m.dir.y; m.py = ty; }
    m.t.setPosition(m.px, m.py);
  }

  function tryTurn(m: Mover, d: Dir): boolean {
    if (d.x === 0 && d.y === 0) return false;
    if (!isWall(m.col + d.x, m.row + d.y)) { m.dir = { x: d.x, y: d.y }; return true; }
    return false;
  }

  function pickJellyDir(j: Chaser): void {
    const options: Dir[] = [];
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      if (!isWall(j.col + d.x, j.row + d.y)) options.push(d);
    }
    if (options.length === 0) { j.dir = { x: 0, y: 0 }; return; }
    // usually random; sometimes bias toward the player
    if (Math.random() < 0.35) {
      options.sort((a, b) => {
        const da = Math.abs(j.col + a.x - player.col) + Math.abs(j.row + a.y - player.row);
        const db = Math.abs(j.col + b.x - player.col) + Math.abs(j.row + b.y - player.row);
        return da - db;
      });
      j.dir = options[0]!;
    } else {
      j.dir = options[Math.floor(Math.random() * options.length)]!;
    }
  }

  function eatPearl(): void {
    const row = pearls[player.row];
    if (row && row[player.col]) {
      row[player.col]!.destroy();
      row[player.col] = null;
      pearlsLeft--;
      score++;
      ctx.onScore(score);
      chime('good');
      if (pearlsLeft <= 0) {
        // new maze, keep score climbing
        buildMaze();
        player.col = 1; player.row = 1; player.px = cx(1); player.py = cy(1);
        player.dir = { x: 0, y: 0 }; nextDir = { x: 0, y: 0 };
        player.t.setPosition(player.px, player.py);
        eatAt(1, 1);
        spawnJellies();
        chime('fanfare');
      }
    }
  }

  function endGame(): void {
    if (over) return;
    over = true;
    chime('gentle');
    ctx.onGameOver(score);
  }

  return {
    update(_time: number, delta: number): void {
      if (over || destroyed) return;
      const dt = Math.min(delta, 50); // clamp big frame gaps

      // keyboard bonus control
      if (cursors) {
        if (cursors.left.isDown) nextDir = { x: -1, y: 0 };
        else if (cursors.right.isDown) nextDir = { x: 1, y: 0 };
        else if (cursors.up.isDown) nextDir = { x: 0, y: -1 };
        else if (cursors.down.isDown) nextDir = { x: 0, y: 1 };
      }

      // player: turn only at cell centers
      if (atCenter(player)) {
        tryTurn(player, nextDir);
        if (isWall(player.col + player.dir.x, player.row + player.dir.y)) player.dir = { x: 0, y: 0 };
        eatPearl();
      }
      stepMover(player, playerSpeed, dt);
      if (atCenter(player)) eatPearl();

      // jellies wander
      for (const j of jellies) {
        j.thinkMs -= dt;
        if (atCenter(j) && (j.thinkMs <= 0 || isWall(j.col + j.dir.x, j.row + j.dir.y))) {
          pickJellyDir(j);
          j.thinkMs = 500 + Math.random() * 500;
        }
        stepMover(j, jellySpeed, dt);
        // caught? generous: same cell
        const gd = Math.hypot(j.px - player.px, j.py - player.py);
        if (gd < cell * 0.7) { endGame(); return; }
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, this);
      scene.input.off('pointerup', onUp, this);
      for (const b of padButtons) b.removeAllListeners();
    },
  } satisfies ArcadeGame;
};
