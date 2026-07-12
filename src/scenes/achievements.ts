/**
 * Badge shelf — every achievement, earned ones bright and gently bobbing,
 * locked ones dimmed with a '?' and a hint. Pure celebration, no fail states.
 */
import Phaser from 'phaser';
import { BADGES, newlyEarned } from '../engine/achievements';
import { loadProgress, saveProgress } from '../services/progress';
import { speakUI, chime } from '../services/audio';
import {
  GAME_W,
  emojiText,
  makeButton,
  drawRealmBackground,
  popIn,
  confettiBurst,
  sceneTitle,
  displayText,
  HEX,
  COL,
} from '../ui/kit';

export class AchievementsScene extends Phaser.Scene {
  private bobs: Phaser.Tweens.Tween[] = [];

  constructor() {
    super('achievements');
  }

  create(): void {
    this.bobs = [];
    drawRealmBackground(this, 0x2a1f4a, 0x120a24, ['🏅', '⭐', '✨'], 'stars');
    this.cameras.main.fadeIn(300);

    const progress = loadProgress();
    // catch up any badges she's met but hasn't seen celebrated yet, so the
    // shelf is always accurate (they won't re-toast later either)
    const caught = newlyEarned(progress);
    if (caught.length > 0) {
      caught.forEach((b) => progress.badges.push(b.id));
      saveProgress(progress);
    }
    const earned = new Set(progress.badges);

    sceneTitle(this, 'My Badges', '🏅', 50);
    void speakUI('badges', 'Your badges! Look what you earned!');

    const home = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: COL.paper,
    });
    home.setAlpha(0.95);

    const cols = 5;
    const cellW = 184;
    const cellH = 150;
    const x0 = GAME_W / 2 - ((cols - 1) / 2) * cellW;
    const y0 = 168;
    BADGES.forEach((b, i) => {
      const cx = x0 + (i % cols) * cellW;
      const cy = y0 + Math.floor(i / cols) * cellH;
      const has = earned.has(b.id);

      const card = this.add.graphics();
      card.fillStyle(0xffffff, has ? 0.14 : 0.05);
      card.fillRoundedRect(cx - 82, cy - 60, 164, 120, 18);
      card.lineStyle(3, 0xffe9a8, has ? 0.8 : 0.18);
      card.strokeRoundedRect(cx - 82, cy - 60, 164, 120, 18);

      const glyph = emojiText(this, cx, cy - 20, b.emoji, 56);
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
        displayText(this, cx, cy + 34, b.label, 18, '#ffffff', '500');
      } else {
        glyph.setAlpha(0.16);
        displayText(this, cx, cy - 20, '?', 40, '#ffffff').setAlpha(0.6);
        displayText(this, cx, cy + 34, b.hint, 15, '#ffffff88', '500');
      }
      popIn(this, glyph, i * 45);
    });

    const total = BADGES.length;
    displayText(this, GAME_W / 2, 668, `${earned.size} of ${total} earned!`, 30, '#ffe9a8');
    if (earned.size > 0) confettiBurst(this, GAME_W / 2, 120, 0xffe9a8);

    this.events.once('shutdown', () => this.bobs.forEach((t) => t.stop()));
  }
}
