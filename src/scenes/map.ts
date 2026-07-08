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
import { speakUI, playMusic } from '../services/audio';
import { GAME_W, GAME_H, readingText, emojiText, drawRealmBackground, makeButton } from '../ui/kit';

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
    playMusic('map');

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

    // pearl purse — the wardrobe currency, always visible so earning feels real
    const pearl = this.add.circle(80, 206, 12, 0xffffff, 1).setStrokeStyle(2, 0xd8e6ee, 1);
    pearl.setDepth(1);
    this.add.circle(76, 202, 3.5, 0xffffff, 0.95).setDepth(1);
    readingText(this, 130, 206, `${progress.pearls}`, 30, '#ffffff');

    // side doors off the map — icon-only, scenes greet with their own audio
    const goTo = (key: string) => {
      this.cameras.main.fadeOut(300);
      this.time.delayedCall(330, () => this.scene.start(key));
    };
    // 📚 sits under the shell tally: "see what those shells are"
    makeButton(this, 80, 134, '📚', () => goTo('collection'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // ✨ in the opposite top corner, clear of the path and the gear
    makeButton(this, GAME_W - 80, 60, '✨', () => goTo('phrases-hub'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // 📖 story pages under the sparkles — the castle's bookshelf
    makeButton(this, GAME_W - 80, 134, '📖', () => goTo('story'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // 👗 the wardrobe — dress-up with pearls earned by reading
    makeButton(this, GAME_W - 80, 208, '👗', () => goTo('wardrobe'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);

    // session-cap sunset: past the daily cap the map turns to dusk and
    // suggests resting — a gentle wind-down, never a lock (parents decide)
    const today = new Date().toISOString().slice(0, 10);
    const minutesToday = progress.sessions
      .filter((s) => s.date === today)
      .reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    if (minutesToday >= progress.settings.sessionCapMin) {
      this.add
        .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x1a1035, 0.35)
        .setDepth(5);
      const moon = emojiText(this, GAME_W / 2 - 205, 116, '🌙', 40).setDepth(6);
      const note = readingText(
        this,
        GAME_W / 2 + 24,
        116,
        'What a lot of reading today! ⭐',
        30,
        '#ffe9a8',
      ).setDepth(6);
      this.tweens.add({
        targets: [moon, note],
        alpha: 0.75,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

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
