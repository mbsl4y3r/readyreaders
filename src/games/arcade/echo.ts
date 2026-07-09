import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

/**
 * "Star Echo" — a gentle Simon / memory-sequence game for a 6-year-old.
 * Four big star pads light up one at a time (SHOW); she taps them back in
 * order (INPUT). Get the whole sequence right and it grows by one. A wrong
 * tap simply ends the round softly. All timing is hand-rolled in update()
 * with millisecond accumulators — no scene timers or tweens for core logic.
 */

interface Pad {
  cx: number;
  cy: number;
  color: number;
  container: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  /** ms of tap-flash brightness remaining. */
  flash: number;
  /** eased current alpha / scale, lerped toward the lit/dim target each frame. */
  curAlpha: number;
  curScale: number;
}

type Phase = 'show' | 'input' | 'won' | 'over';

export const run: RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx): ArcadeGame => {
  const cx = ctx.width / 2;

  // ---- soft background --------------------------------------------------
  const bg = scene.add.graphics();
  ctx.layer.add(bg);
  const steps = 14;
  const top = Phaser.Display.Color.IntegerToColor(ctx.theme.bgTop);
  const bottom = Phaser.Display.Color.IntegerToColor(ctx.theme.bgBottom);
  for (let i = 0; i < steps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, steps - 1, i);
    bg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    bg.fillRect(0, (ctx.height / steps) * i, ctx.width, ctx.height / steps + 1);
  }

  // ---- pad geometry (2x2 block, each 220px) -----------------------------
  const PAD = 220;
  const half = PAD / 2;
  const offset = 130; // centre-to-centre / 2 → 40px gap between pads
  const clusterCy = (ctx.hudBottom + ctx.height) / 2 + 14;

  // soft accent panel behind the pads
  const panel = scene.add.graphics();
  ctx.layer.add(panel);
  const panW = offset * 2 + PAD + 48;
  const panH = offset * 2 + PAD + 48;
  panel.fillStyle(ctx.theme.accent, 0.16);
  panel.fillRoundedRect(cx - panW / 2, clusterCy - panH / 2, panW, panH, 40);

  const COLORS = [0xffd166, 0xef476f, 0x06d6a0, 0x9b5de5]; // gold, pink, aqua, violet
  const pads: Pad[] = [];
  const layout: ReadonlyArray<readonly [number, number]> = [
    [-offset, -offset],
    [offset, -offset],
    [-offset, offset],
    [offset, offset],
  ];
  for (let i = 0; i < 4; i++) {
    const px = cx + layout[i]![0];
    const py = clusterCy + layout[i]![1];
    const gfx = scene.add.graphics();
    gfx.fillStyle(COLORS[i]!, 1);
    gfx.fillRoundedRect(-half, -half, PAD, PAD, 32);
    gfx.fillStyle(0xffffff, 0.16);
    gfx.fillRoundedRect(-half, -half, PAD, PAD * 0.42, 32);
    const star = emojiText(scene, 0, 0, '⭐', 96);
    const container = scene.add.container(px, py, [gfx, star]);
    container.setAlpha(0.55);
    ctx.layer.add(container);
    pads.push({
      cx: px,
      cy: py,
      color: COLORS[i]!,
      container,
      gfx,
      flash: 0,
      curAlpha: 0.55,
      curScale: 1,
    });
  }

  // ---- tiny non-reading HUD cue (watch / your turn) ---------------------
  const cue = emojiText(scene, cx, ctx.hudBottom + 30, '👀', 40);
  ctx.layer.add(cue);

  // ---- state ------------------------------------------------------------
  const LIT_MS = 520;
  const GAP_MS = 260;
  const WON_PAUSE_MS = 600;
  const FLASH_MS = 360;

  let phase: Phase = 'show';
  const sequence: number[] = [Phaser.Math.Between(0, 3)];
  let roundsCompleted = 0;
  let score = 0;

  // SHOW cursors
  let showStep = 0;
  let showSub: 'on' | 'off' = 'off';
  let showTimer = -350; // small lead-in beat before the first pad lights
  let showActive = -1; // pad index currently lit during playback

  // INPUT cursor
  let inputIndex = 0;

  // WON pause
  let wonTimer = 0;

  let gameOverFired = false;
  let destroyed = false;

  ctx.onScore(score);

  function startShow(): void {
    phase = 'show';
    showStep = 0;
    showSub = 'off';
    showTimer = -350;
    showActive = -1;
    cue.setText('👀');
  }

  function beginInput(): void {
    phase = 'input';
    inputIndex = 0;
    cue.setText('👆');
  }

  function completeRound(): void {
    roundsCompleted = sequence.length;
    score = sequence.length;
    ctx.onScore(score);
    chime('good');
    phase = 'won';
    wonTimer = 0;
    cue.setText('🎉');
  }

  function endGame(): void {
    if (gameOverFired) return;
    gameOverFired = true;
    phase = 'over';
    cue.setText('💫');
    chime('gentle');
    ctx.onGameOver(roundsCompleted);
  }

  function padAt(x: number, y: number): number {
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i]!;
      if (Math.abs(x - p.cx) <= half && Math.abs(y - p.cy) <= half) return i;
    }
    return -1;
  }

  function onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (phase !== 'input') return;
    const i = padAt(pointer.x, pointer.y);
    if (i < 0) return;
    pads[i]!.flash = FLASH_MS;
    if (i === sequence[inputIndex]) {
      chime('good');
      inputIndex++;
      if (inputIndex >= sequence.length) completeRound();
    } else {
      endGame();
    }
  }

  scene.input.on('pointerdown', onPointerDown, this);

  return {
    update(_time: number, delta: number): void {
      // advance state machine
      if (phase === 'show') {
        showTimer += delta;
        if (showSub === 'on') {
          if (showTimer >= LIT_MS) {
            showActive = -1;
            showSub = 'off';
            showTimer = 0;
            showStep++;
          }
        } else {
          if (showTimer >= GAP_MS) {
            if (showStep >= sequence.length) {
              beginInput();
            } else {
              showActive = sequence[showStep]!;
              chime('good');
              showSub = 'on';
              showTimer = 0;
            }
          }
        }
      } else if (phase === 'won') {
        wonTimer += delta;
        if (wonTimer >= WON_PAUSE_MS) {
          sequence.push(Phaser.Math.Between(0, 3));
          startShow();
        }
      }

      // per-pad visual easing (bright when lit in playback or tap-flashing)
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i]!;
        if (p.flash > 0) p.flash = Math.max(0, p.flash - delta);
        const bright = showActive === i || p.flash > 0;
        const targetAlpha = bright ? 1 : 0.55;
        const targetScale = bright ? 1.12 : 1;
        const k = Math.min(1, delta / 80);
        p.curAlpha += (targetAlpha - p.curAlpha) * k;
        p.curScale += (targetScale - p.curScale) * k;
        p.container.setAlpha(p.curAlpha);
        p.container.setScale(p.curScale);
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onPointerDown, this);
    },
  } satisfies ArcadeGame;
};
