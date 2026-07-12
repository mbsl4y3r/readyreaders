import Phaser from 'phaser';
// Display face for chrome (titles, buttons, scores). Andika stays the reading
// face for decodable words. @fontsource injects the @font-face; we wait for the
// glyphs to load before first paint so Phaser's canvas text never flashes fallback.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import { BootScene } from './scenes/boot';
import { CreatorScene } from './scenes/creator';
import { MapScene } from './scenes/map';
import { SessionScene } from './scenes/session';
import { ParentScene } from './scenes/parent';
import { VoyageScene } from './scenes/voyage';
import { PhrasesHubScene } from './scenes/phrases-hub';
import { CollectionScene } from './scenes/collection';
import { StoryScene } from './scenes/story';
import { WardrobeScene } from './scenes/wardrobe';
import { AchievementsScene } from './scenes/achievements';
import { ArcadeScene } from './scenes/arcade';
import { StickerBookScene } from './scenes/stickerbook';
import { TicketShopScene } from './scenes/ticketshop';
import { PhotoBoothScene } from './scenes/photobooth';
import { GAME_W, GAME_H, RENDER_SCALE } from './ui/kit';

function startGame(): Phaser.Game {
  return new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#3b2a1e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // internal canvas rasterizes at 2048×1440; scenes stay in 1024×720 world
    // units via the per-scene camera zoom below
    width: GAME_W * RENDER_SCALE,
    height: GAME_H * RENDER_SCALE,
  },
  callbacks: {
    postBoot: (game) => {
      // Every scene lays out in 1024×720 world units; the camera zoom maps
      // that onto the 2× canvas so all vector art rasterizes at retina
      // density. Re-applied on every CREATE (scene.start/restart resets it).
      for (const scene of game.scene.scenes) {
        scene.events.on(Phaser.Scenes.Events.CREATE, () => {
          const cam = scene.cameras.main;
          cam.setZoom(RENDER_SCALE);
          cam.centerOn(GAME_W / 2, GAME_H / 2);
        });
      }
    },
  },
  scene: [
    BootScene,
    CreatorScene,
    MapScene,
    SessionScene,
    ParentScene,
    VoyageScene,
    PhrasesHubScene,
    CollectionScene,
    StoryScene,
    WardrobeScene,
    AchievementsScene,
    ArcadeScene,
    StickerBookScene,
    TicketShopScene,
    PhotoBoothScene,
  ],
  });
}

// Wait for Fredoka to load (with a short safety timeout so a slow/blocked font
// can never hang the game), then boot — so the very first frame uses the display
// face, not a fallback.
function boot(): void {
  const game = startGame();
  // introspection hook for automated tests
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
const fontsReady = Promise.all([
  document.fonts.load('700 40px Fredoka'),
  document.fonts.load('500 20px Fredoka'),
]).catch(() => undefined);
void Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(boot);

// Offline support (iPad home-screen app): register the service worker in
// production only — in dev it would cache stale modules and fight HMR.
// BASE_URL keeps the path correct under the /readyreaders/ GitHub Pages base.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
