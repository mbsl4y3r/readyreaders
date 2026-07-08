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
  const leftLadderX = playLeft + 120;
  const rightLadderX = playRight - 120;
  const ladderX = (gap: number) => (gap % 2 === 0 ? rightLadderX : leftLadderX);

  // ---- Background -------------------------------------------------------
  const bg = scene.add.rectangle(width / 2, (hudBottom + height) / 2, width, height - hudBottom, theme.bgBottom);
  ctx.layer.add(bg);
  const band = scene.add.rectangle(width / 2, topY, width, floorGap * 1.6, theme.bgTop, 0.55);
  ctx.layer.add(band);

  // ---- Platforms & ladders ---------------------------------------------
  const g = scene.add.graphics();
  ctx.layer.add(g);
  for (let f = 0; f < FLOORS; f++) {
    g.fillStyle(theme.accent, 1);
    g.fillRoundedRect(playLeft, floorY(f), playRight - playLeft, 12, 6);
  }
  for (let gap = 0; gap < FLOORS - 1; gap++) {
    const x = ladderX(gap);
    const yTop = floorY(gap + 1);
    const yBot = floorY(gap);
    g.lineStyle(6, 0xffffff, 0.85);
    g.lineBetween(x - 16, yTop, x - 16, yBot + 12);
    g.lineBetween(x + 16, yTop, x + 16, yBot + 12);
    for (let ry = yBot; ry > yTop; ry -= 22) g.lineBetween(x - 16, ry, x + 16, ry);
  }
  const goal = emojiText(scene, width / 2, floorY(TOP_FLOOR) - 30, '🏠', 46);
  ctx.layer.add(goal);

  // ---- Squirrel ---------------------------------------------------------
  const startX = leftLadderX;
  const sq = { x: startX, y: floorY(0), floor: 0, mode: 'walk' as 'walk' | 'climb', climbTo: 1, jumpT: 0 };
  const squirrel = emojiText(scene, sq.x, sq.y - 24, '🐿️', 46);
  ctx.layer.add(squirrel);

  // ---- Acorns -----------------------------------------------------------
  const acorns: Acorn[] = [];
  const MAX_ACORNS = 5;
  let spawnAcc = 900;

  const spawnAcorn = () => {
    if (acorns.length >= MAX_ACORNS) return;
    const t = emojiText(scene, playRight - 30, floorY(TOP_FLOOR) - 16, '🌰', 34);
    ctx.layer.add(t);
    acorns.push({ t, x: playRight - 30, y: floorY(TOP_FLOOR), floor: TOP_FLOOR, dir: -1, mode: 'roll', dropY: 0 });
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

  const doJump = () => {
    if (sq.jumpT <= 0 && sq.mode === 'walk') {
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
  const award = () => {
    score += 1;
    ctx.onScore(score);
    chime('good');
    sq.x = startX;
    sq.floor = 0;
    sq.y = floorY(0);
    sq.mode = 'walk';
    sq.jumpT = 0;
    if (acorns.length < MAX_ACORNS) spawnAcorn();
  };

  return {
    update(_time: number, delta: number) {
      if (over) return;
      const dt = delta / 1000;

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
        sq.x = Phaser.Math.Clamp(sq.x + vx * WALK * dt, playLeft + 20, playRight - 20);
        sq.y = floorY(sq.floor);
        if (up && sq.floor < TOP_FLOOR && Math.abs(sq.x - ladderX(sq.floor)) < 36) {
          sq.mode = 'climb';
          sq.climbTo = sq.floor + 1;
          sq.x = ladderX(sq.floor);
        }
      } else {
        sq.y -= CLIMB * dt;
        const ty = floorY(sq.climbTo);
        if (sq.y <= ty) {
          sq.y = ty;
          sq.floor = sq.climbTo;
          sq.mode = 'walk';
          if (sq.floor === TOP_FLOOR) award();
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
        spawnAcc = Math.max(1500, 2800 - score * 120);
      }

      // --- acorn movement ---
      const invuln = sq.jumpT > 0;
      for (let i = acorns.length - 1; i >= 0; i--) {
        const a = acorns[i];
        if (!a) continue;
        if (a.mode === 'roll') {
          a.x += a.dir * ACORN * dt;
          if (a.floor >= 1) {
            const tx = ladderX(a.floor - 1);
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
            if (a.floor >= 1) a.dir = Math.sign(ladderX(a.floor - 1) - a.x) || -1;
            else a.dir = a.x < width / 2 ? -1 : 1;
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
