/**
 * The island map: 9 level stops along a winding path through the three
 * realms. Icon-first (no text she must read to navigate); each stop speaks
 * its name when unlocked. Parent screen hides behind a 2s long-press on
 * the gear.
 */
import Phaser from 'phaser';
import { LEVELS } from '../content/levels';
import { THEMES } from '../content/themes';
import { loadProgress } from '../services/progress';
import { speakUI } from '../services/audio';
import { GAME_W, GAME_H, readingText, emojiText, drawRealmBackground } from '../ui/kit';

const STOP_POS: [number, number][] = [
  [140, 590], [330, 620], [520, 570], [700, 610], [870, 520],
  [820, 370], [620, 320], [400, 270], [210, 180],
];

export class MapScene extends Phaser.Scene {
  constructor() {
    super('map');
  }

  create(): void {
    const progress = loadProgress();
    drawRealmBackground(this, 0x14213d, 0x081c15, ['🌊', '🌲', '✨']);
    this.cameras.main.fadeIn(300);

    readingText(this, GAME_W / 2, 56, "Evie's Reading Realms", 40, '#ffe9a8');

    // path
    const path = this.add.graphics();
    path.lineStyle(10, 0xffffff, 0.18);
    for (let i = 0; i < STOP_POS.length - 1; i++) {
      const [x1, y1] = STOP_POS[i]!;
      const [x2, y2] = STOP_POS[i + 1]!;
      path.lineBetween(x1, y1, x2, y2);
    }

    // collection tally
    const c = progress.collections;
    const total = c.treasures.length + c.pets.length + c.charms.length;
    emojiText(this, 80, 60, '🐚', 34);
    readingText(this, 130, 60, `${total}`, 34, '#ffffff');

    LEVELS.forEach((level, i) => {
      const [x, y] = STOP_POS[i]!;
      const theme = THEMES[level.realm];
      const unlocked = level.id <= progress.currentLevel;

      const circle = this.add.circle(x, y, 46, unlocked ? theme.accent : 0x555f6b, 1);
      circle.setStrokeStyle(5, 0xffffff, unlocked ? 0.9 : 0.3);
      const icon = emojiText(this, x, y, unlocked ? theme.creature : '🔒', 40);
      if (!unlocked) icon.setAlpha(0.7);

      if (unlocked) {
        circle.setInteractive({ useHandCursor: true });
        circle.on('pointerdown', () => {
          this.tweens.add({ targets: [circle, icon], scale: 0.9, duration: 80, yoyo: true });
        });
        circle.on('pointerup', () => {
          void speakUI(`level-${level.id}`, `${theme.name}! Here we go!`);
          this.cameras.main.fadeOut(300);
          this.time.delayedCall(330, () => this.scene.start('session', { levelId: level.id }));
        });
        if (level.id === progress.currentLevel) {
          // the frontier stop gently pulses "play me"
          this.tweens.add({
            targets: [circle, icon],
            scale: 1.12,
            duration: 650,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      }
      readingText(this, x, y + 72, `${level.id}`, 26, unlocked ? '#ffffff' : '#8a94a0');
    });

    // parent gear: 2-second long-press
    const gear = emojiText(this, GAME_W - 54, GAME_H - 46, '⚙️', 36).setAlpha(0.6);
    gear.setInteractive({ useHandCursor: true });
    let holdTimer: Phaser.Time.TimerEvent | null = null;
    gear.on('pointerdown', () => {
      holdTimer = this.time.delayedCall(2000, () => this.scene.start('parent'));
    });
    const cancel = () => holdTimer?.remove();
    gear.on('pointerup', cancel);
    gear.on('pointerout', cancel);
  }
}
