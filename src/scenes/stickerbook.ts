/**
 * Sticker Book — every milestone sticker, earned ones bright and gently
 * bobbing with their label, locked ones dimmed with a '?' and a faint hint.
 * Pure celebration, no fail states.
 */
import Phaser from 'phaser';
import { STICKERS, newlyEarnedStickers } from '../services/juice';
import { loadProgress, saveProgress } from '../services/progress';
import { speakUI } from '../services/audio';
import {
  GAME_W,
  readingText,
  emojiText,
  makeButton,
  drawRealmBackground,
  popIn,
  confettiBurst,
} from '../ui/kit';

export class StickerBookScene extends Phaser.Scene {
  private bobs: Phaser.Tweens.Tween[] = [];

  constructor() {
    super('stickerbook');
  }

  create(): void {
    this.bobs = [];
    drawRealmBackground(this, 0x2a1f4a, 0x120a24, ['🌟', '📸', '✨'], 'stars');
    this.cameras.main.fadeIn(300);
    void speakUI('sticker-book', 'Your sticker book! Look at all your shiny stickers!');

    const progress = loadProgress();
    // catch up any stickers she's earned but hasn't recorded yet, so the
    // book is always accurate.
    const fresh = newlyEarnedStickers(progress);
    if (fresh.length) {
      fresh.forEach((s) => progress.stickers.push(s.id));
      saveProgress(progress);
    }
    const earned = new Set(progress.stickers);

    readingText(this, GAME_W / 2, 50, 'Sticker Book 🌟', 40, '#ffe9a8');

    const home = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    });
    home.setAlpha(0.85);

    const cols = 4;
    const cellW = 200;
    const cellH = 150;
    const x0 = GAME_W / 2 - ((cols - 1) / 2) * cellW;
    const y0 = 168;
    STICKERS.forEach((s, i) => {
      const cx = x0 + (i % cols) * cellW;
      const cy = y0 + Math.floor(i / cols) * cellH;
      const has = earned.has(s.id);

      const card = this.add.graphics();
      card.fillStyle(0xffffff, has ? 0.14 : 0.05);
      card.fillRoundedRect(cx - 82, cy - 60, 164, 120, 18);
      card.lineStyle(3, 0xffe9a8, has ? 0.8 : 0.18);
      card.strokeRoundedRect(cx - 82, cy - 60, 164, 120, 18);

      const glyph = emojiText(this, cx, cy - 20, s.emoji, 56);
      if (has) {
        this.bobs.push(
          this.tweens.add({
            targets: glyph,
            y: cy - 26,
            duration: 1500 + i * 110,
            delay: i * 70,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          }),
        );
        readingText(this, cx, cy + 34, s.label, 19, '#ffffff');
      } else {
        glyph.setAlpha(0.16);
        readingText(this, cx, cy - 20, '?', 40, '#ffffff').setAlpha(0.6);
        readingText(this, cx, cy + 34, s.label, 15, '#ffffff88');
      }
      popIn(this, glyph, i * 45);
    });

    const total = STICKERS.length;
    readingText(this, GAME_W / 2, 668, `${earned.size} of ${total} stickers!`, 30, '#ffe9a8');
    if (earned.size > 0) confettiBurst(this, GAME_W / 2, 120, 0xffe9a8);

    this.events.once('shutdown', () => this.bobs.forEach((t) => t.stop()));
  }
}
