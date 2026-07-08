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
  const maxDrag = 180;
  // Punchy launch: a full drag now sends the pearl clear across the green.
  const maxSpeed = 1600;
  const stopSpeed = 18;
  // Gentle rolling friction; heavy drag inside a sand patch.
  const baseFriction = 0.28;
  const sandFriction = 0.06;

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
  interface Mover { axis: 'x' | 'y'; min: number; max: number; speed: number; dir: number; }
  interface Wall { x: number; y: number; w: number; h: number; move?: Mover; }
  interface Rect { x: number; y: number; w: number; h: number; }
  let walls: Wall[] = [];
  let sand: Rect | null = null;
  let hasMoving = false;
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
  const inRect = (x: number, y: number, r: Rect) =>
    x > r.x - r.w / 2 && x < r.x + r.w / 2 && y > r.y - r.h / 2 && y < r.y + r.h / 2;
  const clearOfBallAndHole = (cx: number, cy: number, pad: number) =>
    dist(cx, cy, px, py) > pad && dist(cx, cy, holeX, holeY) > pad;

  function drawWalls(): void {
    wallGfx.clear();
    if (sand) {
      // Soft sand patch — the pearl crawls through it.
      wallGfx.fillStyle(0xe6cf92, 0.9);
      wallGfx.fillRoundedRect(sand.x - sand.w / 2, sand.y - sand.h / 2, sand.w, sand.h, 16);
      wallGfx.fillStyle(0xcbb06a, 0.9);
      const dots: ReadonlyArray<readonly [number, number]> = [
        [-0.26, -0.2], [0.22, -0.26], [0.02, 0.08], [-0.16, 0.28], [0.28, 0.22],
      ];
      for (const [dx, dy] of dots) wallGfx.fillCircle(sand.x + dx * sand.w, sand.y + dy * sand.h, 4);
    }
    for (const w of walls) {
      if (w.move) wallGfx.fillStyle(0xff9d5c, 0.95); // moving walls stand out
      else wallGfx.fillStyle(theme.accent, 0.85);
      wallGfx.fillRoundedRect(w.x - w.w / 2, w.y - w.h / 2, w.w, w.h, 8);
    }
  }

  // --- Layout builders ------------------------------------------------------
  function addRandomWalls(count: number): void {
    const target = walls.length + count;
    let guard = 0;
    while (walls.length < target && guard++ < 60) {
      const vertical = Math.random() < 0.5;
      const w: Wall = {
        x: rnd(left + 160, right - 160),
        y: rnd(top + 90, bottom - 90),
        w: vertical ? 26 : rnd(140, 240),
        h: vertical ? rnd(140, 240) : 26,
      };
      if (clearOfBallAndHole(w.x, w.y, 130)) walls.push(w);
    }
  }

  // A near-full-height barrier with a friendly gap to thread through.
  function addGapWall(gap: number): void {
    const cx = (left + right) / 2;
    const bx = rnd(cx - 70, cx + 70);
    const gapY = rnd(top + 150, bottom - 150);
    const thick = 26;
    const topStart = top + 6;
    const topEnd = gapY - gap / 2;
    if (topEnd - topStart > 40) walls.push({ x: bx, y: (topStart + topEnd) / 2, w: thick, h: topEnd - topStart });
    const botStart = gapY + gap / 2;
    const botEnd = bottom - 6;
    if (botEnd - botStart > 40) walls.push({ x: bx, y: (botStart + botEnd) / 2, w: thick, h: botEnd - botStart });
  }

  function addSand(): void {
    const cx = (left + right) / 2;
    let guard = 0;
    do {
      sand = {
        x: rnd(cx - 120, cx + 120),
        y: rnd(top + 110, bottom - 110),
        w: rnd(150, 230),
        h: rnd(120, 180),
      };
    } while (
      guard++ < 30 &&
      (inRect(px, py, sand) || inRect(holeX, holeY, sand) || dist(sand.x, sand.y, holeX, holeY) < 130)
    );
  }

  function addMovingWall(): void {
    const cx = (left + right) / 2;
    const horizontal = Math.random() < 0.5;
    const speed = rnd(70, 110);
    const dir = Math.random() < 0.5 ? 1 : -1;
    if (horizontal) {
      walls.push({
        x: cx, y: rnd(top + 130, bottom - 130), w: 150, h: 26,
        move: { axis: 'x', min: left + 110, max: right - 110, speed, dir },
      });
    } else {
      walls.push({
        x: rnd(cx - 120, cx + 120), y: (top + bottom) / 2, w: 26, h: 150,
        move: { axis: 'y', min: top + 110, max: bottom - 110, speed, dir },
      });
    }
    hasMoving = true;
  }

  function newLayout(): void {
    // Difficulty ramps with holes already sunk: open at first, then busy.
    const level = holes;
    const leftSide = Math.random() < 0.5;
    px = leftSide ? rnd(left + 70, left + 150) : rnd(right - 150, right - 70);
    py = rnd(top + 70, bottom - 70);
    do {
      holeX = leftSide ? rnd(right - 200, right - 80) : rnd(left + 80, left + 200);
      holeY = rnd(top + 70, bottom - 70);
    } while (dist(px, py, holeX, holeY) < 320);

    walls = [];
    sand = null;
    hasMoving = false;

    if (level <= 0) {
      // Wide open — just roll it in.
    } else if (level === 1) {
      addRandomWalls(1);
    } else if (level <= 3) {
      addRandomWalls(2);
    } else if (level <= 5) {
      addGapWall(150);
      addRandomWalls(1);
      if (level === 5) addSand();
    } else if (level <= 7) {
      addGapWall(140);
      addSand();
      addRandomWalls(1);
    } else {
      addGapWall(140);
      addSand();
      addMovingWall();
      addRandomWalls(1);
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
    const dx = px - dragX;
    const dy = py - dragY;
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

  function stepMovers(dt: number): void {
    if (!hasMoving) return;
    for (const w of walls) {
      if (!w.move) continue;
      const m = w.move;
      const half = m.axis === 'x' ? w.w / 2 : w.h / 2;
      let pos = (m.axis === 'x' ? w.x : w.y) + m.dir * m.speed * dt;
      if (pos < m.min + half) { pos = m.min + half; m.dir = 1; }
      if (pos > m.max - half) { pos = m.max - half; m.dir = -1; }
      if (m.axis === 'x') w.x = pos; else w.y = pos;
    }
    drawWalls();
  }

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
      stepMovers(dt);

      if (!atRest()) {
        px += vx * dt;
        py += vy * dt;

        // Bounce off the felt edges.
        if (px < left + pearlR) { px = left + pearlR; vx = -vx * 0.85; }
        if (px > right - pearlR) { px = right - pearlR; vx = -vx * 0.85; }
        if (py < top + pearlR) { py = top + pearlR; vy = -vy * 0.85; }
        if (py > bottom - pearlR) { py = bottom - pearlR; vy = -vy * 0.85; }

        bounceWalls();

        // Friction (gentle exponential decay; sand grabs hard).
        const inSand = sand !== null && inRect(px, py, sand);
        const f = Math.pow(inSand ? sandFriction : baseFriction, dt);
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
      } else if (hasMoving) {
        // Gently keep a resting pearl out of a sweeping wall's way.
        bounceWalls();
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
