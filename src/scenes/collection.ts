/**
 * Evie's Collection Book — the trophy room. A pure celebration gallery of
 * every collectible she's earned across the three realms: no practice, no
 * timers, nothing to get wrong. Unearned slots are shown as gentle
 * mysteries ('?' over a ghosted emoji) — an invitation, never a failure.
 */
import Phaser from 'phaser';
import { LEVELS } from '../content/levels';
import { THEMES } from '../content/themes';
import type { RealmId } from '../content/types';
import { loadProgress, type ProgressData } from '../services/progress';
import { speakUI, chime } from '../services/audio';
import {
  GAME_W,
  GAME_H,
  emojiText,
  makeButton,
  drawRealmBackground,
  popIn,
  wiggle,
  confettiBurst,
  type Button,
  sceneTitle,
  displayText,
  makePanel,
  coinChip,
  COL,
  HEX,
} from '../ui/kit';

const REALM_ORDER: RealmId[] = ['cove', 'woods', 'castle'];

export class CollectionScene extends Phaser.Scene {
  private activeRealm: RealmId = 'cove';
  private tabs = new Map<RealmId, Button>();
  private grid: Phaser.GameObjects.Container | null = null;
  /** Infinite bob tweens on earned glyphs — destroy() won't stop these, so they're tracked by hand. */
  private gridTweens: Phaser.Tweens.Tween[] = [];
  /** Center-stage overlay while a collectible is being admired. */
  private stage: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('collection');
  }

  create(): void {
    this.tabs.clear();
    this.grid = null;
    this.stage = null;

    const progress = loadProgress();
    // neutral deep gradient (same as the map): tabs swap realms freely, so
    // the realm's color identity lives in the shelf tint, not a bg redraw
    drawRealmBackground(this, 0x14213d, 0x081c15, ['🌊', '🌲', '✨']);
    this.cameras.main.fadeIn(300);

    sceneTitle(this, 'My Collection Book', '📚', 56);
    void speakUI('collection-book', 'Your collection book! Look at everything you found!');

    // home button — she can always leave
    const home = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: COL.paper,
    });
    home.setAlpha(0.95);

    // open on the realm she's currently adventuring in — her newest finds
    const level = LEVELS.find((l) => l.id === progress.currentLevel) ?? LEVELS[0]!;
    this.activeRealm = level.realm;

    REALM_ORDER.forEach((realm, i) => {
      const theme = THEMES[realm];
      const tab = makeButton(
        this,
        GAME_W / 2 + (i - 1) * 314,
        138,
        theme.name,
        () => this.switchTab(realm),
        { width: 296, height: 72, fontSize: 26 },
      );
      // creature emoji sits left of the name, inside the same tap target
      tab.label.setX(20);
      tab.add(emojiText(this, 20 - tab.label.width / 2 - 30, 0, theme.creature, 32));
      this.tabs.set(realm, tab);
    });

    this.drawTally(progress);
    this.styleTabs();
    this.buildGrid();
  }

  private switchTab(realm: RealmId): void {
    if (realm === this.activeRealm) return;
    this.activeRealm = realm;
    void speakUI(`collection-tab-${realm}`, `${THEMES[realm].name}!`);
    this.styleTabs();
    this.buildGrid();
  }

  private styleTabs(): void {
    for (const [realm, tab] of this.tabs) {
      const active = realm === this.activeRealm;
      // kill the press-feedback tween so it can't yoyo back over our scale
      this.tweens.killTweensOf(tab);
      tab.setAlpha(active ? 1 : 0.82);
      this.tweens.add({
        targets: tab,
        scale: active ? 1.06 : 1,
        duration: 180,
        ease: 'Sine.easeOut',
      });
    }
  }

  /** Fully rebuilds the shelf + 5×2 grid for the active realm. */
  private buildGrid(): void {
    const progress = loadProgress();
    const theme = THEMES[this.activeRealm];
    const earned = new Set(progress.collections[theme.collectionKey]);

    this.gridTweens.forEach((t) => t.destroy());
    this.gridTweens = [];
    this.grid?.destroy();
    const grid = this.add.container(0, 0);
    this.grid = grid;

    // the "shelf": a warm paper page; the active realm tints its edge so
    // switching tabs still changes the room's color, but text always reads
    const shelf = makePanel(this, 58, 200, GAME_W - 116, 444, {
      edge: theme.accent,
      radius: 28,
    });
    grid.add(shelf);

    let found = 0;
    theme.collectibles.forEach((emoji, i) => {
      const x = 164 + (i % 5) * 174;
      const y = 316 + Math.floor(i / 5) * 178;
      const isEarned = earned.has(emoji);
      if (isEarned) found++;

      const slot = this.add.container(x, y);
      if (isEarned) {
        // a cut-paper sticker: white halo disc + realm-accent ring, lifts off the page
        const card = this.add.graphics();
        card.fillStyle(0x000000, 0.1);
        card.fillCircle(0, 4, 62);
        card.fillStyle(0xffffff, 1);
        card.fillCircle(0, 0, 60);
        card.lineStyle(4, theme.accent, 0.95);
        card.strokeCircle(0, 0, 60);
        slot.add(card);
        const glyph = emojiText(this, 0, 0, emoji, 70);
        slot.add(glyph);
        // gentle idle bob (staggered periods so the shelf breathes, not marches)
        this.gridTweens.push(
          this.tweens.add({
            targets: glyph,
            y: -6,
            duration: 1600 + i * 120,
            delay: i * 90,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          }),
        );
      } else {
        // a quiet embossed socket, waiting to be filled
        const card = this.add.graphics();
        card.fillStyle(COL.paperEdge, 0.6);
        card.fillCircle(0, 0, 58);
        card.lineStyle(3, 0x000000, 0.06);
        card.strokeCircle(0, 0, 56);
        slot.add(card);
        slot.add(emojiText(this, 0, 0, emoji, 60).setAlpha(0.14));
        slot.add(displayText(this, 0, 2, '?', 40, HEX.inkSoft, '700').setAlpha(0.7));
      }

      slot.setSize(150, 150);
      slot.setInteractive({ useHandCursor: true });
      slot.on('pointerup', () => {
        if (isEarned) this.showcase(emoji, x, y, theme.accent);
        else wiggle(this, slot); // a mystery, not a mistake — just a shrug
      });

      grid.add(slot);
      popIn(this, slot, i * 55);
    });

    grid.add(displayText(this, GAME_W / 2, 608, `${found} of 10 found!`, 30, HEX.ink, '700'));
  }

  /** One quiet bottom line: every realm's found-count at a glance. */
  private drawTally(progress: ProgressData): void {
    const y = GAME_H - 40;
    REALM_ORDER.forEach((realm, i) => {
      const theme = THEMES[realm];
      const inBook = new Set(progress.collections[theme.collectionKey]);
      const count = theme.collectibles.filter((e) => inBook.has(e)).length;
      const gx = GAME_W / 2 + (i - 1) * 170;
      emojiText(this, gx - 22, y, theme.creature, 30).setAlpha(0.9);
      displayText(this, gx + 22, y, `${count}`, 26, HEX.white, '700').setAlpha(0.9);
      if (i > 0) displayText(this, gx - 85, y, '·', 26, '#ffffff88', '500');
    });
  }

  /** Center-stage moment: the emoji flies big to center with confetti; any tap sends it home. */
  private showcase(emoji: string, fromX: number, fromY: number, accent: number): void {
    if (this.stage) return; // one at a time — keep the room calm
    const stage = this.add.container(0, 0).setDepth(50);
    this.stage = stage;

    // full-screen dim swallows taps so nothing underneath can be pressed
    const dim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.45);
    dim.setInteractive();
    stage.add(dim);

    const star = emojiText(this, fromX, fromY, emoji, 72);
    stage.add(star);
    this.tweens.add({
      targets: star,
      x: GAME_W / 2,
      y: GAME_H / 2 - 20,
      scale: 140 / 72,
      duration: 420,
      ease: 'Back.easeOut',
    });
    chime('good');
    confettiBurst(this, GAME_W / 2, GAME_H / 2 - 20, accent);

    dim.once('pointerup', () => {
      this.tweens.add({ targets: dim, alpha: 0, duration: 300 });
      this.tweens.add({
        targets: star,
        x: fromX,
        y: fromY,
        scale: 1,
        duration: 300,
        ease: 'Sine.easeIn',
        onComplete: () => {
          stage.destroy();
          if (this.stage === stage) this.stage = null;
        },
      });
    });
  }
}
