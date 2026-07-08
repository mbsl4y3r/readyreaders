import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText, readingText } from '../../ui/kit';
import { chime } from '../../services/audio';

type Dir = { x: number; y: number };
type Lane = { row: number; dir: number; speed: number; emoji: string };
type Hazard = { t: Phaser.GameObjects.Text; x: number };
type Flower = { t: Phaser.GameObjects.Text; col: number; row: number };

export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // ---- Grid geometry ----------------------------------------------------
  const COLS = 9;
  const ROWS = 7; // rows 0/3/6 are safe (green); rows 1/2/4/5 are hazard lanes
  const areaTop = hudBottom;
  const areaH = height - areaTop;
  const cell = Math.floor(Math.min(width / COLS, areaH / ROWS));
  const gridW = cell * COLS;
  const gridH = cell * ROWS;
  const offX = (width - gridW) / 2;
  const offY = areaTop + (areaH - gridH) / 2;
  const cx = (c: number) => offX + c * cell + cell / 2;
  const cy = (r: number) => offY + r * cell + cell / 2;

  // ---- Background & lane stripes ----------------------------------------
  const bg = scene.add.rectangle(width / 2, areaTop + areaH / 2, width, areaH, theme.bgBottom);
  ctx.layer.add(bg);
  const safeRows = new Set([0, 3, 6]);
  for (let r = 0; r < ROWS; r++) {
    const safe = safeRows.has(r);
    const stripe = scene.add.rectangle(offX + gridW / 2, cy(r), gridW, cell, safe ? 0x8fd694 : theme.bgTop, safe ? 0.85 : 0.55);
    ctx.layer.add(stripe);
  }

  // ---- Hazard lanes (slow & forgiving) ----------------------------------
  const lanes: Lane[] = [
    { row: 1, dir: -1, speed: 48, emoji: '🐟' },
    { row: 2, dir: 1, speed: 40, emoji: '🚤' },
    { row: 4, dir: -1, speed: 44, emoji: '🦆' },
    { row: 5, dir: 1, speed: 34, emoji: '🐠' },
  ];
  const perLane = 3;
  const spacing = gridW / perLane;
  const hazSize = Math.floor(cell * 0.82);
  const hazards: { lane: Lane; items: Hazard[] }[] = lanes.map((lane) => {
    const start = Math.random() * spacing;
    const items: Hazard[] = [];
    for (let i = 0; i < perLane; i++) {
      const x = (start + i * spacing) % gridW;
      const t = emojiText(scene, offX + x, cy(lane.row), lane.emoji, hazSize);
      ctx.layer.add(t);
      items.push({ t, x });
    }
    return { lane, items };
  });

  // ---- Hopper -----------------------------------------------------------
  let col = Math.floor(COLS / 2);
  let row = ROWS - 1;
  const frog = emojiText(scene, cx(col), cy(row), '🐸', Math.floor(cell * 0.7));
  ctx.layer.add(frog);

  let score = 0;
  let speedMul = 1;
  let over = false;
  let destroyed = false;
  let hopTween: Phaser.Tweens.Tween | undefined;
  const tweens: Phaser.Tweens.Tween[] = [];

  // ---- Flowers to collect -----------------------------------------------
  let flowers: Flower[] = [];
  const spawnFlowers = () => {
    // Candidate cells: rows 0..4 (upper field, clear of the bottom D-pad),
    // never on the hopper's current cell. Pick 4 on distinct rows so the
    // flowers spread out and each hunt takes her across the field.
    const cells: { col: number; row: number }[] = [];
    for (let r = 0; r <= 4; r++) {
      for (let c = 0; c < COLS; c++) {
        if (c === col && r === row) continue;
        cells.push({ col: c, row: r });
      }
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cells[i]!;
      cells[i] = cells[j]!;
      cells[j] = tmp;
    }
    const usedRows = new Set<number>();
    const fSize = Math.floor(cell * 0.6);
    for (const pos of cells) {
      if (flowers.length >= 4) break;
      if (usedRows.has(pos.row)) continue;
      usedRows.add(pos.row);
      const t = emojiText(scene, cx(pos.col), cy(pos.row), '🌸', fSize);
      ctx.layer.add(t);
      flowers.push({ t, col: pos.col, row: pos.row });
      tweens.push(scene.tweens.add({ targets: t, scale: { from: 0, to: 1 }, duration: 300, ease: 'Back.easeOut' }));
    }
  };

  // ---- Fading hint line (short, no reading required to play) -------------
  let hintText: Phaser.GameObjects.Text | undefined;
  let hintTween: Phaser.Tweens.Tween | undefined;
  const showHint = (msg: string) => {
    hintTween?.stop();
    hintText?.destroy();
    hintText = readingText(scene, width / 2, areaTop + 26, msg, Math.max(24, Math.floor(cell * 0.4)));
    hintText.setStroke('#2b3a2f', 6);
    hintText.setAlpha(0);
    ctx.layer.add(hintText);
    hintTween = scene.tweens.add({
      targets: hintText,
      alpha: 1,
      duration: 320,
      hold: 2600,
      yoyo: true,
      onComplete: () => {
        hintText?.destroy();
        hintText = undefined;
      },
    });
    tweens.push(hintTween);
  };

  const nextLevel = () => {
    speedMul = Math.min(1.5, speedMul + 0.12); // nudge hazards a touch faster
    chime('fanfare');
    spawnFlowers();
    showHint('More flowers! 🌸');
  };

  const collectFlower = (f: Flower) => {
    flowers = flowers.filter((x) => x !== f);
    score += 1;
    ctx.onScore(score);
    chime('good');
    const t = f.t;
    tweens.push(
      scene.tweens.add({
        targets: t,
        scaleX: t.scaleX * 1.7,
        scaleY: t.scaleY * 1.7,
        alpha: 0,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => t.destroy(),
      }),
    );
    if (flowers.length === 0) nextLevel();
  };

  const collectHere = () => {
    const f = flowers.find((fl) => fl.col === col && fl.row === row);
    if (f) collectFlower(f);
  };

  const endGame = () => {
    if (over) return;
    over = true;
    frog.setText('💫');
    chime('gentle');
    ctx.onGameOver(score);
  };

  const placeFrog = () => {
    frog.setPosition(cx(col), cy(row));
    hopTween?.stop();
    frog.setScale(1);
    hopTween = scene.tweens.add({ targets: frog, scale: { from: 1.3, to: 1 }, duration: 150, ease: 'Quad.out' });
  };

  const hop = (d: Dir) => {
    if (over) return;
    const nc = Phaser.Math.Clamp(col + d.x, 0, COLS - 1);
    const nr = Phaser.Math.Clamp(row + d.y, 0, ROWS - 1);
    if (nc === col && nr === row) return;
    col = nc;
    row = nr;
    placeFrog();
    collectHere();
  };

  // Kick off the first hunt.
  spawnFlowers();
  showHint('Get all the flowers! 🌸');

  // ---- On-screen arrow D-pad (four ways, ≥64px) -------------------------
  const pad = scene.add.graphics();
  ctx.layer.add(pad);
  const baseX = 116;
  const baseY = height - 132;
  const btns = [
    { x: baseX, y: baseY - 84, dir: { x: 0, y: -1 } }, // up
    { x: baseX, y: baseY + 84, dir: { x: 0, y: 1 } }, //  down
    { x: baseX - 92, y: baseY, dir: { x: -1, y: 0 } }, // left
    { x: baseX + 92, y: baseY, dir: { x: 1, y: 0 } }, //  right
  ];
  const BW = 84;
  for (const b of btns) {
    pad.fillStyle(0xffffff, 0.18);
    pad.lineStyle(3, theme.accent, 0.5);
    pad.fillRoundedRect(b.x - BW / 2, b.y - BW / 2, BW, BW, 18);
    pad.strokeRoundedRect(b.x - BW / 2, b.y - BW / 2, BW, BW, 18);
    const s = 22;
    pad.fillStyle(0xffffff, 0.9);
    pad.fillTriangle(
      b.x + b.dir.x * s, b.y + b.dir.y * s,
      b.x - b.dir.x * s + b.dir.y * s, b.y - b.dir.y * s + b.dir.x * s,
      b.x - b.dir.x * s - b.dir.y * s, b.y - b.dir.y * s - b.dir.x * s,
    );
  }

  // ---- Input ------------------------------------------------------------
  let downX = 0;
  let downY = 0;
  let onBtn = false;
  const hitBtn = (x: number, y: number): Dir | null => {
    for (const b of btns) {
      if (x >= b.x - BW / 2 && x <= b.x + BW / 2 && y >= b.y - BW / 2 && y <= b.y + BW / 2) return b.dir;
    }
    return null;
  };
  const onDown = (p: Phaser.Input.Pointer) => {
    downX = p.x;
    downY = p.y;
    const hit = hitBtn(p.x, p.y);
    onBtn = hit !== null;
    if (hit) hop(hit);
  };
  const onUp = (p: Phaser.Input.Pointer) => {
    if (onBtn) {
      onBtn = false;
      return;
    }
    const dx = p.x - downX;
    const dy = p.y - downY;
    if (Math.abs(dx) < 26 && Math.abs(dy) < 26) {
      hop({ x: 0, y: -1 }); // tap anywhere = hop forward
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) hop({ x: dx > 0 ? 1 : -1, y: 0 });
    else hop({ x: 0, y: dy > 0 ? 1 : -1 });
  };
  scene.input.on('pointerdown', onDown, scene);
  scene.input.on('pointerup', onUp, scene);

  const cursors = scene.input.keyboard?.createCursorKeys();
  let keyLatch = false;

  return {
    update(_time: number, delta: number) {
      if (over) return;

      if (cursors) {
        const anyDown = cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown;
        if (anyDown && !keyLatch) {
          keyLatch = true;
          if (cursors.left.isDown) hop({ x: -1, y: 0 });
          else if (cursors.right.isDown) hop({ x: 1, y: 0 });
          else if (cursors.up.isDown) hop({ x: 0, y: -1 });
          else if (cursors.down.isDown) hop({ x: 0, y: 1 });
        } else if (!anyDown) {
          keyLatch = false;
        }
      }

      const frogX = col * cell + cell / 2; // grid-relative
      const deadly = cell * 0.42;
      for (const { lane, items } of hazards) {
        const move = lane.dir * lane.speed * speedMul * (delta / 1000);
        for (const h of items) {
          h.x += move;
          if (h.x > gridW) h.x -= gridW;
          else if (h.x < 0) h.x += gridW;
          h.t.setPosition(offX + h.x, cy(lane.row));
          if (!over && lane.row === row && Math.abs(h.x - frogX) < deadly) endGame();
        }
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      hopTween?.stop();
      hintTween?.stop();
      for (const tw of tweens) tw.stop();
      scene.input.off('pointerdown', onDown, scene);
      scene.input.off('pointerup', onUp, scene);
    },
  } satisfies ArcadeGame;
};
