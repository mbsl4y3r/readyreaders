/**
 * Sticker Book — an open paper spread. Earned stickers sit in cut-paper slots
 * with a soft white halo (they pop off the page); locked ones are quiet
 * embossed sockets waiting to be filled. Pure celebration, no fail states.
 */
import Phaser from 'phaser';
import { STICKERS, newlyEarnedStickers } from '../services/juice';
import { loadProgress, saveProgress } from '../services/progress';
import { speakUI } from '../services/audio';
import {
  GAME_W,
  GAME_H,
  displayText,
  emojiText,
  makeButton,
  makePanel,
  coinChip,
  drawRealmBackground,
  bob,
  popIn,
  confettiBurst,
  COL,
  HEX,
} from '../ui/kit';

export class StickerBookScene extends Phaser.Scene {
  constructor() {
    super('stickerbook');
  }

  create(): void {
    // calm dusk backdrop — the paper spread carries the page, no emoji swarm
    drawRealmBackground(this, 0x2a1f4a, 0x120a24, ['🌟', '✨'], 'stars', 0);
    this.cameras.main.fadeIn(300);
    void speakUI('sticker-book', 'Your sticker book! Look at all your shiny stickers!');

    const progress = loadProgress();
    // catch up any stickers earned but not yet recorded, so the book is accurate
    const fresh = newlyEarnedStickers(progress);
    if (fresh.length) {
      fresh.forEach((s) => progress.stickers.push(s.id));
      saveProgress(progress);
    }
    const earned = new Set(progress.stickers);

    // --- the open book: one big paper spread with a soft centre gutter ---
    const px = 44;
    const pw = GAME_W - px * 2;
    const py = 92;
    const ph = GAME_H - py - 40;
    makePanel(this, px, py, pw, ph, { radius: 28 });
    const gutter = this.add.graphics();
    gutter.fillStyle(COL.paperEdge, 0.5);
    gutter.fillRect(GAME_W / 2 - 1.5, py + 26, 3, ph - 52);
    gutter.fillStyle(0x000000, 0.05);
    gutter.fillRect(GAME_W / 2 - 8, py + 26, 8, ph - 52);
    gutter.fillRect(GAME_W / 2, py + 26, 8, ph - 52);

    // header on the page
    displayText(this, GAME_W / 2, py + 46, 'Sticker Book', 34, HEX.ink);
    displayText(this, GAME_W / 2, py + 46, '🌟', 30).setX(GAME_W / 2 - 152);

    // count chip + a slim collection meter
    const chip = coinChip(this, GAME_W / 2, py + 96, '⭐', `${earned.size}/${STICKERS.length}`, 22);
    popIn(this, chip, 120);
    const meterW = 320;
    const meterX = GAME_W / 2 - meterW / 2;
    const meterY = py + 132;
    const meter = this.add.graphics();
    meter.fillStyle(COL.paperEdge, 0.7);
    meter.fillRoundedRect(meterX, meterY, meterW, 12, 6);
    const frac = STICKERS.length ? earned.size / STICKERS.length : 0;
    if (frac > 0) {
      meter.fillStyle(COL.gold, 1);
      meter.fillRoundedRect(meterX, meterY, Math.max(12, meterW * frac), 12, 6);
    }

    // home button — a paper sticker
    const home = makeButton(this, px + 42, py + 40, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 26,
      width: 64,
      height: 58,
      fill: COL.paper,
    });
    home.setDepth(5);

    // --- 4×3 grid of sticker slots on the page ---
    const cols = 4;
    const cellW = 214;
    const cellH = 140;
    const x0 = GAME_W / 2 - ((cols - 1) / 2) * cellW;
    const y0 = py + 208;
    STICKERS.forEach((s, i) => {
      const cx = x0 + (i % cols) * cellW;
      const cy = y0 + Math.floor(i / cols) * cellH;
      const has = earned.has(s.id);

      if (has) {
        // a cut-paper sticker: bright white halo disc so it lifts off the page
        const halo = this.add.graphics();
        halo.fillStyle(0x000000, 0.1);
        halo.fillCircle(cx, cy + 4, 50);
        halo.fillStyle(0xffffff, 1);
        halo.fillCircle(cx, cy, 48);
        halo.lineStyle(3, COL.gold, 0.9);
        halo.strokeCircle(cx, cy, 48);
        const glyph = emojiText(this, cx, cy, s.emoji, 56);
        bob(this, glyph, 5, 1500 + i * 90);
        displayText(this, cx, cy + 66, s.label, 17, HEX.ink, '500');
        popIn(this, glyph, i * 45);
      } else {
        // a quiet embossed socket, waiting to be filled
        const socket = this.add.graphics();
        socket.fillStyle(COL.paperEdge, 0.55);
        socket.fillCircle(cx, cy, 46);
        socket.lineStyle(3, 0x000000, 0.06);
        socket.strokeCircle(cx, cy, 44);
        emojiText(this, cx, cy, s.emoji, 46).setAlpha(0.13);
        displayText(this, cx, cy + 66, s.label, 15, HEX.inkSoft, '500').setAlpha(0.7);
      }
    });

    if (earned.size > 0) confettiBurst(this, GAME_W / 2, py + 20, COL.gold);
  }
}
