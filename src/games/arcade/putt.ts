import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { chime } from '../../services/audio';

export const run: RunArcadeGame = (scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // Playfield bounds (keep everything below the HUD strip).
  const margin = 26;
  const left = margin;
  const right = width - margin;
  const top = hudBottom + margin;
  const bottom = height - margin;

  const pearlR = 18;
  const holeR = 40; // generous
  const maxDrag = 200;
  const maxSpeed = 850;
  const stopSpeed = 12;

  // --- Soft playfield backdrop (its own place) ------------------------------
  const bg = scene.add.rectangle(width / 2, (hudBottom + height) / 2, width, height - hudBottom, theme.bgBottom);
  ctx.layer.add(bg);
  const felt = scene.add.rectangle((left + right) / 2, (top + bottom) / 2, right - left, bottom - top, theme.bgTop, 0.55);
  felt.setStrokeStyle(6, theme.accent, 0.6);
  ctx.layer.add(felt);

  // --- Persistent visuals ---------------------------------------------------
  const wallGfx = scene.add.graphics();
  ctx.layer.add(wallGfx);
  const aim = scene.add.graphics();
  ctx.layer.add(aim);

  const hole = scene.add.circle(0, 0, holeR, 0x1b2233, 1);
  hole.setStrokeStyle(5, 0xffffff, 0.7);
  ctx.layer.add(hole);
  const flag = scene.add.text(0, 0, '🚩', { fontSize: '46px' }).setOrigin(0.5, 1);
  ctx.layer.add(flag);

  const pearl = scene.add.circle(0, 0, pearlR, 0xffffff, 1);
  pearl.setStrokeStyle(4, theme.accent, 1);
  ctx.layer.add(pearl);
  const shine = scene.add.circle(0, 0, 5, 0xffffff, 0.9);
  ctx.layer.add(shine);

  const strokesLabel = scene.add.text(right - 8, top - 2, '', {
    fontFamily: 'sans-serif',
    fontSize: '26px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(1, 0);
  ctx.layer.add(strokesLabel);

  // --- Game state -----------------------------------------------------------
  interface Wall { x: number; y: number; w: number; h: number; }
  let walls: Wall[] = [];
  let px = 0, py = 0, vx = 0, vy = 0;
  let holeX = 0, holeY = 0;
  let strokes = 12;
  let holes = 0;
  let dragging = false;
  let dragX = 0, dragY = 0;
  let over = false;
  let destroyed = false;

  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

  function overlapsWall(x: number, y: number, pad: number): boolean {
    return walls.some(
      (w) =>
        x > w.x - w.w / 2 - pad && x < w.x + w.w / 2 + pad &&
        y > w.y - w.h / 2 - pad && y < w.y + w.h / 2 + pad,
    );
  }

  function drawWalls(): void {
    wallGfx.clear();
    for (const w of walls) {
      wallGfx.fillStyle(theme.accent, 0.85);
      wallGfx.fillRoundedRect(w.x - w.w / 2, w.y - w.h / 2, w.w, w.h, 8);
    }
  }

  function newLayout(): void {
    // Pearl start on one side, hole far away on the other.
    const leftSide = Math.random() < 0.5;
    px = leftSide ? rnd(left + 70, left + 220) : rnd(right - 220, right - 70);
    py = rnd(top + 70, bottom - 70);
    do {
      holeX = leftSide ? rnd(right - 240, right - 80) : rnd(left + 80, left + 240);
      holeY = rnd(top + 70, bottom - 70);
    } while (dist(px, py, holeX, holeY) < 320);

    // One or two blocker walls in the middle, clear of pearl and hole.
    walls = [];
    const count = 1 + (Math.random() < 0.6 ? 1 : 0);
    let guard = 0;
    while (walls.length < count && guard++ < 40) {
      const vertical = Math.random() < 0.5;
      const w: Wall = {
        x: rnd(left + 260, right - 260),
        y: rnd(top + 90, bottom - 90),
        w: vertical ? 26 : rnd(140, 230),
        h: vertical ? rnd(140, 230) : 26,
      };
      const clearPearl = dist(w.x, w.y, px, py) > 130;
      const clearHole = dist(w.x, w.y, holeX, holeY) > 130;
      if (clearPearl && clearHole) walls.push(w);
    }
    vx = 0; vy = 0;
    drawWalls();
    syncSprites();
  }

  function syncSprites(): void {
    pearl.setPosition(px, py);
    shine.setPosition(px - 5, py - 6);
    hole.setPosition(holeX, holeY);
    flag.setPosition(holeX, holeY - holeR + 6);
    strokesLabel.setText(`⛳ ${holes}   Putts ${Math.max(0, strokes)}`);
  }

  const atRest = () => vx === 0 && vy === 0;

  // --- Input: drag back from the pearl, release to putt ---------------------
  function onDown(p: Phaser.Input.Pointer): void {
    if (over || !atRest()) return;
    if (dist(p.x, p.y, px, py) > 90) return; // must grab near the pearl
    dragging = true;
    dragX = p.x;
    dragY = p.y;
  }

  function onMove(p: Phaser.Input.Pointer): void {
    if (!dragging) return;
    dragX = p.x;
    dragY = p.y;
    drawAim();
  }

  function drawAim(): void {
    aim.clear();
    // Putt goes opposite the drag (slingshot feel).
    let dx = px - dragX;
    let dy = py - dragY;
    const d = Math.hypot(dx, dy);
    if (d < 6) return;
    const power = Math.min(d, maxDrag);
    const ux = dx / d, uy = dy / d;
    const len = 40 + power;
    aim.lineStyle(6, 0xffffff, 0.9);
    aim.beginPath();
    aim.moveTo(px, py);
    aim.lineTo(px + ux * len, py + uy * len);
    aim.strokePath();
    // little arrowhead
    aim.fillStyle(theme.accent, 1);
    const ex = px + ux * len, ey = py + uy * len;
    aim.fillCircle(ex, ey, 9);
  }

  function onUp(): void {
    if (!dragging) return;
    dragging = false;
    aim.clear();
    const dx = px - dragX;
    const dy = py - dragY;
    const d = Math.hypot(dx, dy);
    if (d < 12) return; // tiny nudge = not a stroke
    const power = Math.min(d, maxDrag) / maxDrag;
    vx = (dx / d) * maxSpeed * power;
    vy = (dy / d) * maxSpeed * power;
    strokes -= 1;
    syncSprites();
  }

  scene.input.on('pointerdown', onDown, this);
  scene.input.on('pointermove', onMove, this);
  scene.input.on('pointerup', onUp, this);
  scene.input.on('pointerupoutside', onUp, this);

  newLayout();
  syncSprites();
  ctx.onScore(0);

  function bounceWalls(): void {
    for (const w of walls) {
      const hw = w.w / 2 + pearlR;
      const hh = w.h / 2 + pearlR;
      const dx = px - w.x;
      const dy = py - w.y;
      if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
        const ox = hw - Math.abs(dx);
        const oy = hh - Math.abs(dy);
        if (ox < oy) {
          px += dx >= 0 ? ox : -ox;
          vx = -vx * 0.8;
        } else {
          py += dy >= 0 ? oy : -oy;
          vy = -vy * 0.8;
        }
      }
    }
  }

  return {
    update(_time: number, delta: number): void {
      if (over || destroyed) return;
      const dt = Math.min(delta, 40) / 1000;

      if (!atRest()) {
        px += vx * dt;
        py += vy * dt;

        // Bounce off the felt edges.
        if (px < left + pearlR) { px = left + pearlR; vx = -vx * 0.85; }
        if (px > right - pearlR) { px = right - pearlR; vx = -vx * 0.85; }
        if (py < top + pearlR) { py = top + pearlR; vy = -vy * 0.85; }
        if (py > bottom - pearlR) { py = bottom - pearlR; vy = -vy * 0.85; }

        bounceWalls();

        // Friction (gentle exponential decay).
        const f = Math.pow(0.26, dt);
        vx *= f;
        vy *= f;

        // Sink it — generous radius, forgiving of speed.
        if (dist(px, py, holeX, holeY) < holeR - 4) {
          holes += 1;
          vx = 0; vy = 0;
          chime('good');
          ctx.onScore(holes);
          if (strokes <= 0) { finish(); return; }
          newLayout();
          syncSprites();
          return;
        }

        if (Math.hypot(vx, vy) < stopSpeed) {
          vx = 0; vy = 0;
          if (strokes <= 0) { finish(); return; }
        }
        syncSprites();
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, this);
      scene.input.off('pointermove', onMove, this);
      scene.input.off('pointerup', onUp, this);
      scene.input.off('pointerupoutside', onUp, this);
    },
  } satisfies ArcadeGame;

  function finish(): void {
    if (over) return;
    over = true;
    aim.clear();
    chime('fanfare');
    ctx.onGameOver(holes);
  }
};
