/**
 * Evie's Collection Book — the trophy room. A pure celebration gallery of
 * every collectible she's earned along the Reading Road: no practice, no
 * timers, nothing to get wrong. One page per region (twelve albums of ten),
 * paged with big sticker arrows. Unearned slots are shown as gentle
 * mysteries ('?' over a ghosted emoji) — an invitation, never a failure.
 */
import Phaser from 'phaser';
import { REGIONS, regionForLesson, type Region } from '../content/regions';
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
  sceneTitle,
  displayText,
  makePanel,
  COL,
  HEX,
} from '../ui/kit';

/** Legacy narration clips for the first three albums — reuse what's recorded. */
const LEGACY_PAGE_CLIPS: Record<number, string> = {
  1: 'collection-tab-cove',
  2: 'collection-tab-woods',
  3: 'collection-tab-castle',
};

export class CollectionScene extends Phaser.Scene {
  /** Index into REGIONS (0..11) of the album page being viewed. */
  private page = 0;
  /** The pager's paper name-plate (rebuilt on every page turn). */
  private pageLabel: Phaser.GameObjects.Container | null = null;
  private grid: Phaser.GameObjects.Container | null = null;
  /** Infinite bob tweens on earned glyphs — destroy() won't stop these, so they're tracked by hand. */
  private gridTweens: Phaser.Tweens.Tween[] = [];
  /** Center-stage overlay while a collectible is being admired. */
  private stage: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('collection');
  }

  create(): void {
    this.pageLabel = null;
    this.grid = null;
    this.stage = null;

    const progress = loadProgress();
    // neutral deep gradient (same as the map): pages swap regions freely, so
    // the region's color identity lives in the shelf tint, not a bg redraw
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

    // open on the region she's currently adventuring in — her newest finds
    this.page = regionForLesson(progress.lesson).id - 1;

    // pager row: ◀ [region emoji + name] ▶ — wraps around at both ends
    makeButton(this, GAME_W / 2 - 320, 138, '◀', () => this.turnPage(-1), {
      emoji: true,
      fontSize: 28,
      width: 84,
      height: 68,
      fill: COL.paper,
    });
    makeButton(this, GAME_W / 2 + 320, 138, '▶', () => this.turnPage(1), {
      emoji: true,
      fontSize: 28,
      width: 84,
      height: 68,
      fill: COL.paper,
    });

    this.drawTally(progress);
    this.drawPageLabel();
    this.buildGrid();
  }

  private get region(): Region {
    return REGIONS[this.page]!;
  }

  private turnPage(dir: -1 | 1): void {
    this.page = (this.page + dir + REGIONS.length) % REGIONS.length;
    const region = this.region;
    void speakUI(LEGACY_PAGE_CLIPS[region.id] ?? `collection-region-${region.id}`, `${region.name}!`);
    this.drawPageLabel();
    this.buildGrid();
  }

  /** The paper name-plate between the arrows: region emoji + name in ink. */
  private drawPageLabel(): void {
    this.pageLabel?.destroy();
    const region = this.region;
    const label = this.add.container(GAME_W / 2, 138);
    this.pageLabel = label;

    const name = displayText(this, 20, 0, region.name, 28, HEX.ink, '700');
    const emoji = emojiText(this, 20 - name.width / 2 - 30, 0, region.emoji, 32);
    // a cut-paper sticker pill so the ink always reads on the deep background
    const w = name.width + 116;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.1);
    g.fillRoundedRect(-w / 2, -32, w, 68, 34);
    g.fillStyle(COL.paper, 1);
    g.fillRoundedRect(-w / 2, -34, w, 68, 34);
    g.lineStyle(3, region.accent, 0.9);
    g.strokeRoundedRect(-w / 2, -34, w, 68, 34);
    label.add([g, emoji, name]);
    popIn(this, label);
  }

  /** Fully rebuilds the shelf + 5×2 grid for the current region's album. */
  private buildGrid(): void {
    const progress = loadProgress();
    const region = this.region;
    const earned = new Set(progress.collections[region.collectionKey] ?? []);

    this.gridTweens.forEach((t) => t.destroy());
    this.gridTweens = [];
    this.grid?.destroy();
    const grid = this.add.container(0, 0);
    this.grid = grid;

    // the "shelf": a warm paper page; the region tints its edge so paging
    // still changes the room's color, but text always reads
    const shelf = makePanel(this, 58, 200, GAME_W - 116, 444, {
      edge: region.accent,
      radius: 28,
    });
    grid.add(shelf);

    let found = 0;
    region.collectibles.forEach((emoji, i) => {
      const x = 164 + (i % 5) * 174;
      const y = 316 + Math.floor(i / 5) * 178;
      const isEarned = earned.has(emoji);
      if (isEarned) found++;

      const slot = this.add.container(x, y);
      if (isEarned) {
        // a cut-paper sticker: white halo disc + region-accent ring, lifts off the page
        const card = this.add.graphics();
        card.fillStyle(0x000000, 0.1);
        card.fillCircle(0, 4, 62);
        card.fillStyle(0xffffff, 1);
        card.fillCircle(0, 0, 60);
        card.lineStyle(4, region.accent, 0.95);
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
        if (isEarned) this.showcase(emoji, x, y, region.accent);
        else wiggle(this, slot); // a mystery, not a mistake — just a shrug
      });

      grid.add(slot);
      popIn(this, slot, i * 55);
    });

    grid.add(displayText(this, GAME_W / 2, 608, `${found} of 10 found!`, 30, HEX.ink, '700'));
  }

  /** One quiet bottom line: the whole road's found-count at a glance. */
  private drawTally(progress: ProgressData): void {
    const total = REGIONS.reduce(
      (sum, r) =>
        sum + r.collectibles.filter((e) => (progress.collections[r.collectionKey] ?? []).includes(e)).length,
      0,
    );
    const y = GAME_H - 40;
    const line = displayText(
      this,
      GAME_W / 2 + 18,
      y,
      `${total} of ${REGIONS.length * 10} found!`,
      26,
      HEX.white,
      '700',
    ).setAlpha(0.9);
    emojiText(this, GAME_W / 2 + 18 - line.width / 2 - 26, y, '⭐', 26).setAlpha(0.9);
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
