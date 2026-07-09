import Phaser from 'phaser';
import type { RunArcadeGame, ArcadeGame, ArcadeCtx } from './types';
import { emojiText } from '../../ui/kit';
import { chime } from '../../services/audio';

type CardState = 'down' | 'up' | 'matched';

interface Card {
  back: Phaser.GameObjects.Graphics;
  glyph: Phaser.GameObjects.Text;
  emoji: string;
  state: CardState;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * Memory Shells — a gentle concentration / pair-matching game. Tap face-down
 * shells to peek at the sea creature underneath; find two that match and they
 * stay up. Clear the board and a fresh (slightly bigger) round begins. A slow
 * ~80s timer ends the run. No reading required, no penalty for a wrong guess.
 */
export const run: RunArcadeGame = (scene, ctx: ArcadeCtx) => {
  const { width, height, hudBottom, theme } = ctx;

  // --- Soft playfield background -------------------------------------------
  const bg = scene.add.rectangle(
    width / 2,
    (hudBottom + height) / 2,
    width,
    height - hudBottom,
    theme.bgBottom,
  );
  ctx.layer.add(bg);
  const bgTopBand = scene.add.rectangle(width / 2, hudBottom + 40, width, 80, theme.bgTop, 0.6);
  ctx.layer.add(bgTopBand);

  // --- Layout region --------------------------------------------------------
  const areaTop = hudBottom + 30;
  const areaBottom = height - 24;
  const sidePad = 24;
  const gap = 16;
  const COLS = 4;
  const START_COUNT = 12;
  const MAX_COUNT = 16;

  // Sea-creature emoji — each becomes one pair. Need count/2 distinct kinds
  // (max 8 pairs at MAX_COUNT), so eight is plenty.
  const POOL = ['🐠', '🐙', '🦀', '🐢', '🦑', '🐡', '🐬', '🦞'];

  const CREAM = 0xfff6e9;
  const MATCH_STROKE = 0x74d99f;

  // --- Timer (gentle, non-text bar) ----------------------------------------
  const TOTAL_MS = 80000;
  let remainingMs = TOTAL_MS;
  const timerG = scene.add.graphics();
  ctx.layer.add(timerG);
  const timerX = sidePad;
  const timerY = hudBottom + 10;
  const timerW = width - sidePad * 2;
  const timerH = 10;

  const drawTimer = () => {
    const frac = Phaser.Math.Clamp(remainingMs / TOTAL_MS, 0, 1);
    timerG.clear();
    timerG.fillStyle(0x000000, 0.2);
    timerG.fillRoundedRect(timerX, timerY, timerW, timerH, 5);
    timerG.fillStyle(theme.accent, 1);
    timerG.fillRoundedRect(timerX, timerY, Math.max(2, timerW * frac), timerH, 5);
  };

  // --- Cards ----------------------------------------------------------------
  let cards: Card[] = [];
  let count = START_COUNT;
  let score = 0;

  // Selection / lock state.
  let first: Card | null = null;
  let second: Card | null = null;
  let mismatchMs = 0; // >0 while two unmatched cards are showing (input locked)

  // Short polish tweens; every one is tracked and stopped in destroy().
  const polishTweens: Phaser.Tweens.Tween[] = [];
  const popGlyph = (card: Card) => {
    const tw = scene.tweens.add({
      targets: card.glyph,
      scale: { from: 0.75, to: 1 },
      duration: 220,
      ease: 'Back.easeOut',
    });
    polishTweens.push(tw);
  };

  const drawCard = (card: Card) => {
    const g = card.back;
    const { cx, cy, w, h } = card;
    const left = cx - w / 2;
    const top = cy - h / 2;
    g.clear();
    // Soft drop shadow.
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(left + 3, top + 5, w, h, 22);
    // Face fill: accent when hidden, cream when revealed.
    const fill = card.state === 'down' ? theme.accent : CREAM;
    g.fillStyle(fill, 1);
    g.fillRoundedRect(left, top, w, h, 22);
    // Border: gentle white, green once matched.
    if (card.state === 'matched') g.lineStyle(5, MATCH_STROKE, 1);
    else g.lineStyle(4, 0xffffff, 0.85);
    g.strokeRoundedRect(left, top, w, h, 22);

    // The shell shows on the back; the creature shows when face-up.
    card.glyph.setText(card.state === 'down' ? '🐚' : card.emoji);
    card.glyph.setPosition(cx, cy);
  };

  const shuffled = (n: number): string[] => {
    const pairs = n / 2;
    const deck: string[] = [];
    for (let i = 0; i < pairs; i++) {
      const e = POOL[i % POOL.length]!;
      deck.push(e, e);
    }
    // Fisher-Yates.
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = deck[i]!;
      deck[i] = deck[j]!;
      deck[j] = tmp;
    }
    return deck;
  };

  const clearCards = () => {
    for (const c of cards) {
      c.back.destroy();
      c.glyph.destroy();
    }
    cards = [];
  };

  const buildRound = () => {
    clearCards();
    first = null;
    second = null;
    mismatchMs = 0;

    const rows = Math.ceil(count / COLS);
    const areaH = areaBottom - areaTop;
    const areaW = width - sidePad * 2;
    const cellW = (areaW - gap * (COLS - 1)) / COLS;
    const cellH = (areaH - gap * (rows - 1)) / rows;
    // Keep cards big and finger-friendly but not absurdly wide.
    const cardW = Math.min(cellW, 210);
    const cardH = Math.min(cellH, 210);
    const glyphSize = Math.round(cardH * 0.5);

    const deck = shuffled(count);

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / COLS);
      const colsThisRow = Math.min(COLS, count - row * COLS);
      const col = i - row * COLS;
      // Center each row (handles a partial final row gracefully).
      const rowW = colsThisRow * cardW + (colsThisRow - 1) * gap;
      const rowLeft = (width - rowW) / 2;
      const cx = rowLeft + cardW / 2 + col * (cardW + gap);
      const cy = areaTop + cardH / 2 + row * (cardH + gap);

      const back = scene.add.graphics();
      ctx.layer.add(back);
      const glyph = emojiText(scene, cx, cy, '🐚', glyphSize);
      ctx.layer.add(glyph);

      const card: Card = {
        back,
        glyph,
        emoji: deck[i]!,
        state: 'down',
        cx,
        cy,
        w: cardW,
        h: cardH,
      };
      cards.push(card);
      drawCard(card);
    }
  };

  buildRound();
  ctx.onScore(score);
  drawTimer();

  // --- End of run -----------------------------------------------------------
  let over = false;
  let destroyed = false;
  const endGame = () => {
    if (over) return;
    over = true;
    ctx.onGameOver(score);
  };

  const flipDown = (card: Card) => {
    card.state = 'down';
    drawCard(card);
  };

  // --- Touch input ----------------------------------------------------------
  const hitCard = (x: number, y: number): Card | null => {
    for (const c of cards) {
      if (
        x >= c.cx - c.w / 2 &&
        x <= c.cx + c.w / 2 &&
        y >= c.cy - c.h / 2 &&
        y <= c.cy + c.h / 2
      ) {
        return c;
      }
    }
    return null;
  };

  const onDown = (p: Phaser.Input.Pointer) => {
    if (over) return;
    if (mismatchMs > 0) return; // wait for the two shown cards to flip back
    if (first && second) return; // safety: mid-evaluation
    const card = hitCard(p.x, p.y);
    if (!card || card.state !== 'down') return;

    // Reveal it.
    card.state = 'up';
    drawCard(card);
    popGlyph(card);
    chime('gentle');

    if (!first) {
      first = card;
      return;
    }
    second = card;

    if (first.emoji === second.emoji) {
      // Match — they stay up, one pair banked.
      first.state = 'matched';
      second.state = 'matched';
      drawCard(first);
      drawCard(second);
      popGlyph(second);
      first = null;
      second = null;
      score += 1;
      ctx.onScore(score);
      chime('good');
    } else {
      // No match — hold both up briefly, then flip back (no penalty).
      mismatchMs = 900;
    }
  };
  scene.input.on('pointerdown', onDown, this);

  return {
    update(_time: number, delta: number) {
      if (over) return;

      // Gentle countdown.
      remainingMs -= delta;
      drawTimer();
      if (remainingMs <= 0) {
        endGame();
        return;
      }

      // Flip a mismatched pair back down after the peek window.
      if (mismatchMs > 0) {
        mismatchMs -= delta;
        if (mismatchMs <= 0) {
          if (first) flipDown(first);
          if (second) flipDown(second);
          first = null;
          second = null;
        }
      }

      // Board cleared → fresh, slightly larger round; score keeps climbing.
      if (cards.length > 0 && cards.every((c) => c.state === 'matched')) {
        count = Math.min(MAX_COUNT, count + 2);
        buildRound();
        chime('good');
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.input.off('pointerdown', onDown, this);
      for (const tw of polishTweens) tw.stop();
    },
  } satisfies ArcadeGame;
};
