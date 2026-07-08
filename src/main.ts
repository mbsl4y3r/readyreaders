import Phaser from 'phaser';
import { BootScene } from './scenes/boot';
import { MapScene } from './scenes/map';
import { SessionScene } from './scenes/session';
import { ParentScene } from './scenes/parent';
import { VoyageScene } from './scenes/voyage';
import { PhrasesHubScene } from './scenes/phrases-hub';
import { CollectionScene } from './scenes/collection';
import { StoryScene } from './scenes/story';
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
  scene: [
    BootScene,
    MapScene,
    SessionScene,
    ParentScene,
    VoyageScene,
    PhrasesHubScene,
    CollectionScene,
    StoryScene,
  ],
});

// introspection hook for automated tests
(window as unknown as { __game: Phaser.Game }).__game = game;

// Offline support (iPad home-screen app): register the service worker in
// production only — in dev it would cache stale modules and fight HMR.
// BASE_URL keeps the path correct under the /readyreaders/ GitHub Pages base.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
