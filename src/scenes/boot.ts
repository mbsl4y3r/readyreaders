/**
 * Splash: "tap the starfish to start". The tap is what unlocks audio on iOS,
 * so nothing that makes sound happens before it.
 */
import Phaser from 'phaser';
import { unlockAudio, speakUI } from '../services/audio';
import { GAME_W, GAME_H, readingText, emojiText, drawRealmBackground } from '../ui/kit';
import { THEMES } from '../content/themes';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    drawRealmBackground(this, THEMES.cove.bgTop, THEMES.castle.bgBottom, ['✨', '🫧', '⭐']);

    emojiText(this, GAME_W / 2, 170, '🧜‍♀️📖✨', 84);
    readingText(this, GAME_W / 2, 300, "Evie's Reading Realms", 60, '#ffe9a8');

    const star = emojiText(this, GAME_W / 2, 470, '⭐', 130).setInteractive({ useHandCursor: true });
    this.tweens.add({
      targets: star,
      scale: 1.15,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    readingText(this, GAME_W / 2, 590, 'Tap the star to start!', 34, '#ffffffbb');

    star.once('pointerdown', () => {
      unlockAudio();
      void speakUI('welcome', "Welcome to Evie's Reading Realms!");
      this.cameras.main.fadeOut(350);
      this.time.delayedCall(380, () => this.scene.start('map'));
    });
  }
}
