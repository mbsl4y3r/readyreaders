import Phaser from 'phaser';
import { BootScene } from './scenes/boot';
import { MapScene } from './scenes/map';
import { SessionScene } from './scenes/session';
import { ParentScene } from './scenes/parent';
import { GAME_W, GAME_H } from './ui/kit';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b2545',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
  },
  scene: [BootScene, MapScene, SessionScene, ParentScene],
});

// introspection hook for automated tests
(window as unknown as { __game: Phaser.Game }).__game = game;
