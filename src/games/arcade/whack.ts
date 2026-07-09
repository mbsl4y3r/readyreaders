import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

/**
 * Critter Whack — a gentle woods whack-a-mole. Cute critters bob up out of
 * burrow holes for a generous window; tap one to bonk it (+1). An occasional
 * shy puffer should be left alone — tapping it just doesn't score, no penalty.
 * A ~40s run whose pop rhythm ramps up softly so it gets livelier.
 *
 * All motion/timing is hand-rolled in update(delta); no scene timers/tweens.
 */

type HoleState = 'down' | 'rising' | 'up' | 'ducking' | 'bonked';

interface Hole {
  x: number;
  holeY: number; // center of the burrow opening
  restY: number; // critter parked (hidden behind the front lip)
  upY: number; // critter fully popped up
  critter: Phaser.GameObjects.Text;
  state: HoleState;
  stateT: number; // ms elapsed in current state
  bob: number; // bob accumulator while up
  shy: boolean; // puffer — don't bonk
}

export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // ---- Playfield background (soft vertical gradient) --------------------
  const areaTop = hudBottom;
  const areaH = height - areaTop;
  const bgG = scene.add.graphics();
  const cTop = Phaser.Display.Color.IntegerToColor(theme.bgTop);
  const cBot = Phaser.Display.Color.IntegerToColor(theme.bgBottom);
  const bands = 12;
  for (let i = 0; i < bands; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(cTop, cBot, bands - 1, i);
    bgG.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    bgG.fillRect(0, areaTop + (areaH / bands) * i, width, areaH / bands + 1);
  }
  ctx.layer.add(bgG);

  // ---- Timer bar (below the HUD strip) ----------------------------------
  const RUN_MS = 40000;
  const barMargin = 70;
  const barW = width - barMargin * 2;
  const barX = barMargin;
  const barY = areaTop + 22;
  const barH = 16;
  const barTrack = scene.add.rectangle(barX, barY, barW, barH, 0x000000, 0.28).setOrigin(0, 0.5);
  ctx.layer.add(barTrack);
  const barFill = scene.add.rectangle(barX, barY, barW, barH, theme.accent, 1).setOrigin(0, 0.5);
  ctx.layer.add(barFill);
  // tiny (non-essential) hint of what to do — a friendly mallet
  const hint = emojiText(scene, barX - 34, barY, '🔨', 34).setAlpha(0.9);
  ctx.layer.add(hint);

  // ---- Burrow holes -----------------------------------------------------
  const CRITTERS = ['🐰', '🦔', '🐿️', '🦫'];
  const holeW = 150;
  const holeH = 66;
  const critterSize = 84;
  const rowCounts = [3, 2, 3]; // 8 holes, diamond-ish woods layout
  const holes: Hole[] = [];

  const fieldTop = areaTop + 70; // headroom for the timer bar + rising critters
  const fieldBottom = height - 46;
  const rowGap = (fieldBottom - fieldTop) / rowCounts.length;
  const xMargin = 90;

  for (let r = 0; r < rowCounts.length; r++) {
    const n = rowCounts[r]!;
    const rowY = fieldTop + (r + 0.5) * rowGap;
    for (let i = 0; i < n; i++) {
      const x = xMargin + ((i + 0.5) * (width - xMargin * 2)) / n;

      // back opening (dark), critter, then the near rim on top so the critter
      // reads as emerging from the ground.
      const back = scene.add.ellipse(x, rowY, holeW, holeH, 0x211812, 1);
      back.setStrokeStyle(4, theme.accent, 0.35);
      ctx.layer.add(back);

      const critter = emojiText(scene, x, rowY + 24, CRITTERS[0]!, critterSize).setVisible(false);
      ctx.layer.add(critter);

      const lip = scene.add.ellipse(x, rowY + 12, holeW + 8, holeH, 0x5f4326, 1);
      lip.setStrokeStyle(4, theme.accent, 0.5);
      ctx.layer.add(lip);

      holes.push({
        x,
        holeY: rowY,
        restY: rowY + 24,
        upY: rowY - 52,
        critter,
        state: 'down',
        stateT: 0,
        bob: 0,
        shy: false,
      });
    }
  }

  // ---- Loop state -------------------------------------------------------
  const RISE_MS = 190;
  const DUCK_MS = 190;
  const BONK_MS = 200;
  let elapsed = 0;
  let spawnTimer = 0;
  let score = 0;
  let over = false;
  let destroyed = false;

  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

  function popRandomHole(): void {
    const progress = Math.min(1, elapsed / RUN_MS);
    const maxUp = Math.min(4, 2 + Math.floor(progress * 2)); // 2 → 4 near the end
    let upCount = 0;
    const down: Hole[] = [];
    for (const h of holes) {
      if (h.state === 'down') down.push(h);
      else if (h.state === 'rising' || h.state === 'up') upCount++;
    }
    if (upCount >= maxUp || down.length === 0) return;
    const h = down[Math.floor(Math.random() * down.length)]!;
    h.shy = Math.random() < 0.16;
    h.critter.setText(h.shy ? '🐡' : CRITTERS[Math.floor(Math.random() * CRITTERS.length)]!);
    h.critter.setScale(1);
    h.critter.setPosition(h.x, h.restY);
    h.critter.setVisible(true);
    ctx.layer.bringToTop(h.critter);
    h.state = 'rising';
    h.stateT = 0;
    h.bob = 0;
  }

  function duck(h: Hole): void {
    h.state = 'ducking';
    h.stateT = 0;
  }

  function endGame(): void {
    if (over) return;
    over = true;
    chime('gentle');
    ctx.onGameOver(score);
  }

  // ---- Input: tap a critter while it's up -------------------------------
  const onPointerDown = (p: Phaser.Input.Pointer): void => {
    if (over || destroyed) return;
    const R = 92; // generous, finger-sized tap radius
    let best: Hole | null = null;
    let bestD = R;
    for (const h of holes) {
      if (h.state !== 'up' && h.state !== 'rising') continue;
      const d = Math.hypot(p.x - h.x, p.y - h.critter.y);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (!best) return;
    if (best.shy) {
      // forgiving: no penalty, the puffer just shyly ducks away
      chime('gentle');
      duck(best);
      return;
    }
    score += 1;
    ctx.onScore(score);
    chime('good');
    best.state = 'bonked';
    best.stateT = 0;
  };
  scene.input.on('pointerdown', onPointerDown, this);

  return {
    update(_time: number, delta: number): void {
      if (over || destroyed) return;
      const dt = Math.min(delta, 50);
      elapsed += dt;

      // countdown timer
      const timeLeft = Math.max(0, RUN_MS - elapsed);
      barFill.width = barW * (timeLeft / RUN_MS);
      if (timeLeft <= 0) {
        endGame();
        return;
      }

      // spawn scheduler — interval eases from calm to lively
      const progress = Math.min(1, elapsed / RUN_MS);
      const interval = 1400 - progress * 750; // 1400ms → 650ms
      spawnTimer += dt;
      if (spawnTimer >= interval) {
        spawnTimer -= interval;
        popRandomHole();
      }

      const upMs = 1300 - progress * 350; // ~1.3s → ~0.95s window

      for (const h of holes) {
        h.stateT += dt;
        switch (h.state) {
          case 'rising': {
            const t = Math.min(1, h.stateT / RISE_MS);
            h.critter.setPosition(h.x, lerp(h.restY, h.upY, t));
            if (t >= 1) {
              h.state = 'up';
              h.stateT = 0;
            }
            break;
          }
          case 'up': {
            h.bob += dt;
            h.critter.setPosition(h.x, h.upY + Math.sin(h.bob / 180) * 6);
            if (h.stateT >= upMs) duck(h);
            break;
          }
          case 'ducking': {
            const t = Math.min(1, h.stateT / DUCK_MS);
            h.critter.setPosition(h.x, lerp(h.upY, h.restY, t));
            if (t >= 1) {
              h.state = 'down';
              h.critter.setVisible(false);
            }
            break;
          }
          case 'bonked': {
            const t = Math.min(1, h.stateT / BONK_MS);
            // quick squishy pop, then drop back down
            h.critter.setScale(1 + Math.sin(t * Math.PI) * 0.35);
            h.critter.setPosition(h.x, lerp(h.upY, h.restY, t));
            if (t >= 1) {
              h.state = 'down';
              h.critter.setScale(1);
              h.critter.setVisible(false);
            }
            break;
          }
          case 'down':
          default:
            break;
        }
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onPointerDown, this);
    },
  } satisfies ArcadeGame;
};
