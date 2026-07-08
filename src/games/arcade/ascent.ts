import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

type Acorn = {
  t: Phaser.GameObjects.Text;
  x: number;
  y: number;
  floor: number;
  dir: number;
  mode: 'roll' | 'drop';
  dropY: number;
  targetX: number;
};

export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // ---- Geometry ---------------------------------------------------------
  const FLOORS = 5;
  const TOP_FLOOR = FLOORS - 1;
  const playLeft = 70;
  const playRight = width - 70;
  const bottomY = height - 175; // leave a band at the bottom for touch controls
  const topY = hudBottom + 55;
  const floorGap = (bottomY - topY) / (FLOORS - 1);
  const floorY = (f: number) => bottomY - f * floorGap;
  const houseX = width / 2;
  const startX = houseX;

  // ---- Background -------------------------------------------------------
  const bg = scene.add.rectangle(width / 2, (hudBottom + height) / 2, width, height - hudBottom, theme.bgBottom);
  ctx.layer.add(bg);
  const band = scene.add.rectangle(width / 2, topY, width, floorGap * 1.6, theme.bgTop, 0.55);
  ctx.layer.add(band);

  // ---- Level layout (regenerated every cleared level) -------------------
  const g = scene.add.graphics();
  ctx.layer.add(g);

  let level = 0;
  let ladders: number[][] = []; // ladders[gap] = x positions between floor gap and gap+1
  let prevKey = '';

  // Several ladder choices per gap, at varied x, so climbing isn't forced.
  // The TOP gap always includes a ladder at the house so the house is reachable.
  const genLadders = (): number[][] => {
    const result: number[][] = [];
    for (let gap = 0; gap < FLOORS - 1; gap++) {
      const xs: number[] = [];
      if (gap === FLOORS - 2) xs.push(houseX);
      const count = Phaser.Math.Between(2, 3);
      let tries = 0;
      while (xs.length < count && tries < 60) {
        tries++;
        const x = Phaser.Math.Between(playLeft + 55, playRight - 55);
        if (xs.every((px) => Math.abs(px - x) >= 95)) xs.push(x);
      }
      xs.sort((a, b) => a - b);
      result.push(xs);
    }
    return result;
  };
  // Never repeat the previous level's layout.
  const genDistinct = (): number[][] => {
    let next = genLadders();
    let guard = 0;
    while (JSON.stringify(next) === prevKey && guard < 12) {
      next = genLadders();
      guard++;
    }
    prevKey = JSON.stringify(next);
    return next;
  };

  const drawStage = () => {
    g.clear();
    for (let f = 0; f < FLOORS; f++) {
      g.fillStyle(theme.accent, 1);
      g.fillRoundedRect(playLeft, floorY(f), playRight - playLeft, 12, 6);
    }
    for (let gap = 0; gap < FLOORS - 1; gap++) {
      const yTop = floorY(gap + 1);
      const yBot = floorY(gap);
      for (const x of ladders[gap] ?? []) {
        g.lineStyle(6, 0xffffff, 0.85);
        g.lineBetween(x - 16, yTop, x - 16, yBot + 12);
        g.lineBetween(x + 16, yTop, x + 16, yBot + 12);
        for (let ry = yBot; ry > yTop; ry -= 22) g.lineBetween(x - 16, ry, x + 16, ry);
      }
    }
  };

  // Nearest ladder x in a gap (gap always has >= 1 ladder once built).
  const nearestLadder = (gap: number, fromX: number): number => {
    let bestX = fromX;
    let bestD = Infinity;
    for (const lx of ladders[gap] ?? []) {
      const d = Math.abs(lx - fromX);
      if (d < bestD) {
        bestD = d;
        bestX = lx;
      }
    }
    return bestX;
  };

  let acornTarget = 3;
  const buildLevel = () => {
    ladders = genDistinct();
    drawStage();
    acornTarget = Math.min(6, 3 + level); // one more acorn per cleared level
  };

  // ---- Goal + celebration ----------------------------------------------
  const goal = emojiText(scene, houseX, floorY(TOP_FLOOR) - 30, '🏠', 46);
  ctx.layer.add(goal);
  const party = emojiText(scene, houseX, floorY(TOP_FLOOR) - 62, '🎉', 40).setAlpha(0);
  ctx.layer.add(party);

  // ---- Squirrel ---------------------------------------------------------
  const sq = {
    x: startX,
    y: floorY(0),
    floor: 0,
    mode: 'walk' as 'walk' | 'climb',
    climbTo: 1,
    climbX: startX,
    jumpT: 0,
    facing: 1 as 1 | -1,
  };
  const squirrel = emojiText(scene, sq.x, sq.y - 24, '🐿️', 46);
  ctx.layer.add(squirrel);

  // ---- Acorns -----------------------------------------------------------
  const acorns: Acorn[] = [];
  let spawnAcc = 1200;

  const spawnAcorn = () => {
    if (acorns.length >= acornTarget) return;
    const sx = playRight - 30;
    const t = emojiText(scene, sx, floorY(TOP_FLOOR) - 16, '🌰', 34);
    ctx.layer.add(t);
    const target = nearestLadder(TOP_FLOOR - 1, sx);
    acorns.push({
      t,
      x: sx,
      y: floorY(TOP_FLOOR),
      floor: TOP_FLOOR,
      dir: Math.sign(target - sx) || -1,
      mode: 'roll',
      dropY: 0,
      targetX: target,
    });
  };

  // ---- Touch controls ---------------------------------------------------
  type BtnName = 'left' | 'right' | 'up' | 'jump';
  type Btn = { name: BtnName; x: number; y: number; r: number };
  const buttons: Btn[] = [
    { name: 'up', x: 115, y: height - 135, r: 46 },
    { name: 'left', x: 55, y: height - 68, r: 46 },
    { name: 'right', x: 175, y: height - 68, r: 46 },
    { name: 'jump', x: width - 100, y: height - 92, r: 58 },
  ];
  const labels: Record<BtnName, string> = { up: '⬆️', left: '⬅️', right: '➡️', jump: '⤴️' };
  for (const b of buttons) {
    const c = scene.add.circle(b.x, b.y, b.r, 0xffffff, 0.22);
    c.setStrokeStyle(4, theme.accent, 0.9);
    ctx.layer.add(c);
    ctx.layer.add(emojiText(scene, b.x, b.y, labels[b.name], Math.floor(b.r * 0.8)));
  }

  const held = { left: false, right: false, up: false };
  const pointerMap = new Map<number, BtnName>();
  scene.input.addPointer(2);

  const btnAt = (px: number, py: number): BtnName | null => {
    for (const b of buttons) {
      const dx = px - b.x;
      const dy = py - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) return b.name;
    }
    return null;
  };
  const recompute = () => {
    held.left = held.right = held.up = false;
    for (const v of pointerMap.values()) {
      if (v === 'left') held.left = true;
      else if (v === 'right') held.right = true;
      else if (v === 'up') held.up = true;
    }
  };

  let over = false;
  let destroyed = false;
  let winTimer = 0; // > 0 during the house celebration
  const WIN_MS = 1100;

  const doJump = () => {
    if (sq.jumpT <= 0 && sq.mode === 'walk' && winTimer <= 0) {
      sq.jumpT = 650;
      chime('gentle');
    }
  };

  const onDown = (p: Phaser.Input.Pointer) => {
    const n = btnAt(p.x, p.y);
    if (!n) return;
    if (n === 'jump') doJump();
    else {
      pointerMap.set(p.id, n);
      recompute();
    }
  };
  const onMove = (p: Phaser.Input.Pointer) => {
    if (!p.isDown || !pointerMap.has(p.id)) return;
    const n = btnAt(p.x, p.y);
    if (n && n !== 'jump') pointerMap.set(p.id, n);
    else pointerMap.delete(p.id);
    recompute();
  };
  const onUp = (p: Phaser.Input.Pointer) => {
    if (pointerMap.delete(p.id)) recompute();
  };
  scene.input.on('pointerdown', onDown, this);
  scene.input.on('pointermove', onMove, this);
  scene.input.on('pointerup', onUp, this);
  scene.input.on('pointerupoutside', onUp, this);

  const cursors = scene.input.keyboard?.createCursorKeys();
  const spaceKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  let spacePrev = false;

  // ---- Helpers ----------------------------------------------------------
  const WALK = 155;
  const CLIMB = 115;
  const ACORN = 74;
  let score = 0;

  const endGame = () => {
    if (over) return;
    over = true;
    ctx.onGameOver(score);
  };

  // Reaching the house is a WIN: credit the floor, celebrate, then (after the
  // celebration) reset to the bottom with a brand-new layout.
  const creditWin = () => {
    score += 1;
    ctx.onScore(score);
    chime('fanfare');
    winTimer = WIN_MS;
    sq.x = houseX;
    sq.jumpT = 0;
    party.setAlpha(1);
  };

  const nextLevel = () => {
    level += 1;
    buildLevel();
    // fresh squirrel at the bottom
    sq.floor = 0;
    sq.x = startX;
    sq.y = floorY(0);
    sq.mode = 'walk';
    sq.jumpT = 0;
    // fresh acorns for the new layout
    for (const a of acorns) a.t.destroy();
    acorns.length = 0;
    spawnAcc = 1200;
    // reset celebration visuals
    goal.setScale(1);
    party.setAlpha(0).setScale(1);
  };

  buildLevel(); // initial layout

  return {
    update(_time: number, delta: number) {
      if (over) return;
      const dt = delta / 1000;

      // --- house celebration (win first, THEN drop to a new level) ---
      if (winTimer > 0) {
        winTimer -= delta;
        const p = 1 - Math.max(0, winTimer) / WIN_MS; // 0 -> 1
        const pop = Math.sin(p * Math.PI);
        goal.setScale(1 + 0.4 * pop);
        party.setScale(1 + 0.35 * pop);
        const hop = Math.abs(Math.sin(p * Math.PI * 3)) * 28;
        squirrel.setPosition(houseX, floorY(TOP_FLOOR) - 24 - hop);
        if (winTimer <= 0) {
          winTimer = 0;
          nextLevel();
        }
        return;
      }

      // --- input snapshot ---
      const left = held.left || !!cursors?.left.isDown;
      const right = held.right || !!cursors?.right.isDown;
      const up = held.up || !!cursors?.up.isDown;
      const space = !!spaceKey?.isDown;
      if (space && !spacePrev) doJump();
      spacePrev = space;

      // --- squirrel movement ---
      if (sq.mode === 'walk') {
        let vx = 0;
        if (left) vx -= 1;
        if (right) vx += 1;
        if (vx !== 0) {
          sq.facing = vx > 0 ? 1 : -1;
          squirrel.setFlipX(sq.facing > 0); // face right when moving right, left when moving left
        }
        sq.x = Phaser.Math.Clamp(sq.x + vx * WALK * dt, playLeft + 20, playRight - 20);
        sq.y = floorY(sq.floor);
        if (up && sq.floor < TOP_FLOOR) {
          let bestX = NaN;
          let bestD = 44; // forgiving grab radius
          for (const lx of ladders[sq.floor] ?? []) {
            const d = Math.abs(sq.x - lx);
            if (d < bestD) {
              bestD = d;
              bestX = lx;
            }
          }
          if (!Number.isNaN(bestX)) {
            sq.mode = 'climb';
            sq.climbTo = sq.floor + 1;
            sq.climbX = bestX;
            sq.x = bestX;
          }
        }
      } else {
        sq.x = sq.climbX;
        sq.y -= CLIMB * dt;
        const ty = floorY(sq.climbTo);
        if (sq.y <= ty) {
          sq.y = ty;
          sq.floor = sq.climbTo;
          sq.mode = 'walk';
          if (sq.floor === TOP_FLOOR) creditWin();
        }
      }

      // --- jump timer + visual ---
      if (sq.jumpT > 0) {
        sq.jumpT -= delta;
        if (sq.jumpT < 0) sq.jumpT = 0;
      }
      const jumpOff = sq.jumpT > 0 ? Math.sin(Math.PI * (1 - sq.jumpT / 650)) * 60 : 0;
      squirrel.setPosition(sq.x, sq.y - 24 - jumpOff);

      // --- acorn spawning ---
      spawnAcc -= delta;
      if (spawnAcc <= 0) {
        spawnAcorn();
        spawnAcc = Math.max(1600, 2800 - score * 120);
      }

      // --- acorn movement ---
      const invuln = sq.jumpT > 0 || winTimer > 0;
      for (let i = acorns.length - 1; i >= 0; i--) {
        const a = acorns[i];
        if (!a) continue;
        if (a.mode === 'roll') {
          a.x += a.dir * ACORN * dt;
          if (a.floor >= 1) {
            const tx = a.targetX;
            if ((a.dir < 0 && a.x <= tx) || (a.dir > 0 && a.x >= tx)) {
              a.x = tx;
              a.mode = 'drop';
              a.dropY = floorY(a.floor - 1);
            }
          } else if (a.x < playLeft - 60 || a.x > playRight + 60) {
            a.t.destroy();
            acorns.splice(i, 1);
            continue;
          }
        } else {
          a.y += ACORN * 1.5 * dt;
          if (a.y >= a.dropY) {
            a.y = a.dropY;
            a.floor -= 1;
            a.mode = 'roll';
            if (a.floor >= 1) {
              a.targetX = nearestLadder(a.floor - 1, a.x);
              a.dir = Math.sign(a.targetX - a.x) || 1;
            } else {
              a.dir = a.x < width / 2 ? -1 : 1;
            }
          }
        }
        a.t.setPosition(a.x, a.y - 16);

        if (!invuln && Math.abs(a.x - sq.x) < 40 && Math.abs(a.y - sq.y) < 46) {
          endGame();
          return;
        }
      }
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, this);
      scene.input.off('pointermove', onMove, this);
      scene.input.off('pointerup', onUp, this);
      scene.input.off('pointerupoutside', onUp, this);
      pointerMap.clear();
    },
  } satisfies ArcadeGame;
};
