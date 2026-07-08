/**
 * Evie's Wardrobe — the dress-up shop where reading pearls get spent.
 * Left: Evie + Inky live-painted from her avatar config. Right: tabbed
 * racks of cosmetics.
 *
 * No fail states anywhere: unaffordable chips just wiggle and point her
 * back to reading; try-ons are free and always reversible; and skin tones
 * are identity, not merchandise — free forever, shown as plain swatches.
 *
 * Preview discipline: progress.avatar is ONLY ever mutated on a real
 * equip/purchase. A try-on renders from a derived config, so an un-kept
 * preview can never leak into a save (tab switch, other taps, or leaving
 * the scene all simply drop the derived config).
 */
import Phaser from 'phaser';
import {
  COSMETICS,
  OPTIONAL_CATEGORIES,
  type AvatarConfig,
  type CosmeticCategory,
  type CosmeticItem,
  type SkinId,
} from '../avatar/catalog';
import { paintEvie, paintInky } from '../avatar/paint';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { speakUI, chime, playMusic } from '../services/audio';
import {
  GAME_W,
  GAME_H,
  readingText,
  emojiText,
  makeButton,
  drawRealmBackground,
  ensureSparkTexture,
  popIn,
  wiggle,
  confettiBurst,
  type Button,
} from '../ui/kit';

type TabId = 'hair' | 'color' | 'outfit' | 'face' | 'sparkle' | 'inky';

const TAB_DEFS: { id: TabId; name: string; emoji: string }[] = [
  { id: 'hair', name: 'Hair', emoji: '💇‍♀️' },
  { id: 'color', name: 'Color', emoji: '🎨' },
  { id: 'outfit', name: 'Outfit', emoji: '👗' },
  { id: 'face', name: 'Face', emoji: '😊' },
  { id: 'sparkle', name: 'Sparkle', emoji: '✨' },
  { id: 'inky', name: 'Inky', emoji: '🐙' },
];

// Six tabs share the panel width (x 516→1008). Stepping 82 from 558 with a
// 76px button keeps a 6px gap, the first tab's left edge at 520 and the last
// tab's right edge at 1006 — inside the panel, touch targets still ≥64px.
const TAB_X0 = 558;
const TAB_STEP = 82;
const TAB_W = 76;

/** Skin tones: identity swatches, never priced. Order matches SkinId. */
const SKINS: { id: SkinId; color: number }[] = [
  { id: 'shell', color: 0xffd9b0 },
  { id: 'sand', color: 0xf2c391 },
  { id: 'amber', color: 0xc98a5b },
  { id: 'cocoa', color: 0x8d5a3b },
];

// panel geometry — the scrollable rack under the tabs
const PANEL_X = 516;
const PANEL_W = 492;
const PANEL_TOP = 196;
const PANEL_BOTTOM = 668;
const VIEW_H = PANEL_BOTTOM - PANEL_TOP;
const COL_X = [645, 885]; // chip column centers
const CHIP_W = 228;
const CHIP_H = 74;
const ROW_H = 84;

const EVIE_KEY = 'wardrobe-evie';
const INKY_KEY = 'wardrobe-inky';
const EVIE_X = 250;
const EVIE_Y = 405; // display height 400 → feet land on the spotlight
const INKY_X = 392;
const INKY_Y = 566;

export class WardrobeScene extends Phaser.Scene {
  /** False once the scene shuts down — guards delayedCalls and audio .then. */
  private alive = true;
  private progress!: ProgressData;
  private activeTab: TabId = 'hair';
  private tabs = new Map<TabId, Button>();

  private evieImg!: Phaser.GameObjects.Image;
  private inkyImg!: Phaser.GameObjects.Image;
  private inkyScale = 1;
  private homeBtn!: Button;

  /** Scrolling rack content — rebuilt whole after every state change. */
  private content: Phaser.GameObjects.Container | null = null;
  /** Infinite/long tweens on rack children — destroy() won't stop these, so they're tracked by hand. */
  private panelTweens: Phaser.Tweens.Tween[] = [];
  private panelMask: Phaser.Display.Masks.GeometryMask | null = null;
  /** Interactive rack children + their content-space y, for scroll hit-gating. */
  private chipHits: { obj: Phaser.GameObjects.Container; y: number }[] = [];
  private contentHeight = 0;
  private scrollOffset = 0;

  // drag-to-scroll bookkeeping: a real drag must not also fire chip taps
  private dragging = false;
  private dragStartY = 0;
  private contentStartY = 0;
  private scrollMoved = false;

  /** Try-on state — a derived look, never written into progress until kept. */
  private previewItem: CosmeticItem | null = null;
  private confirmBar: Phaser.GameObjects.Container | null = null;

  private pearlText!: Phaser.GameObjects.Text;
  private pearlDisplay = { v: 0 };
  private pearlTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('wardrobe');
  }

  create(): void {
    this.alive = true;
    this.tabs.clear();
    this.content = null;
    this.panelTweens = [];
    this.chipHits = [];
    this.scrollOffset = 0;
    this.previewItem = null;
    this.confirmBar = null;
    this.pearlTween = null;
    this.events.once('shutdown', () => (this.alive = false));

    this.progress = loadProgress();

    // warm castle dressing room: rosy plum → deep aubergine, star twinkles
    drawRealmBackground(this, 0x6b3a5b, 0x2b1230, ['✨', '🎀', '👗'], 'stars');
    this.cameras.main.fadeIn(300);
    playMusic('wardrobe');
    ensureSparkTexture(this);

    readingText(this, GAME_W / 2, 56, "Evie's Wardrobe ✨", 40, '#ffe9a8');
    void speakUI('wardrobe-welcome', 'Welcome to your wardrobe!');

    // home button — she can always leave
    this.homeBtn = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    });
    this.homeBtn.setAlpha(0.85);

    this.buildStage();
    this.buildPurse();
    this.buildTabs();
    this.buildPanelChrome();
    this.styleTabs();
    this.buildPanel();

    // anti-camping: the wardrobe is a treat, not a home — after 3 quiet
    // minutes Inky yawns and nudges her back to reading (never blocks)
    this.time.delayedCall(3 * 60_000, () => this.nudge());
  }

  // ---------------------------------------------------------------- stage

  private buildStage(): void {
    // soft "spotlight" pool the pair stands in
    const pool = this.add.graphics();
    pool.fillStyle(0xffe9a8, 0.1);
    pool.fillEllipse(300, 632, 420, 84);
    pool.fillStyle(0xffffff, 0.08);
    pool.fillEllipse(300, 630, 300, 58);

    paintEvie(this, this.progress.avatar, EVIE_KEY);
    this.evieImg = this.add.image(EVIE_X, EVIE_Y, EVIE_KEY);
    // the painter renders at 2x resolution — scale from the texture's real
    // pixel height or Evie doubles in size and her hit area smothers 🏠
    this.evieImg.setScale(400 / this.evieImg.height);
    this.evieImg.setInteractive({ useHandCursor: true });
    this.evieImg.on('pointerup', () => {
      // pure joy, no function — tapping your friend just makes her happy
      wiggle(this, this.evieImg);
      chime('good');
    });
    this.tweens.add({
      targets: this.evieImg,
      y: EVIE_Y - 8,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    paintInky(this, this.progress.avatar, INKY_KEY);
    this.inkyImg = this.add.image(INKY_X, INKY_Y, INKY_KEY);
    this.inkyScale = 130 / this.inkyImg.height;
    this.inkyImg.setScale(this.inkyScale);
    this.inkyImg.setInteractive({ useHandCursor: true });
    this.inkyImg.on('pointerup', () => {
      wiggle(this, this.inkyImg);
      chime('good');
    });
    this.tweens.add({
      targets: this.inkyImg,
      y: INKY_Y - 6,
      duration: 1700,
      delay: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Repaint both textures from the current look (saved + any try-on). */
  private repaintAvatars(): void {
    const cfg = this.previewItem
      ? withPart(this.progress.avatar, this.previewItem.category, this.previewItem.id)
      : this.progress.avatar;
    paintEvie(this, cfg, EVIE_KEY);
    this.evieImg.setTexture(EVIE_KEY);
    this.evieImg.setScale(400 / this.evieImg.height);
    paintInky(this, cfg, INKY_KEY);
    this.inkyImg.setTexture(INKY_KEY);
    this.inkyImg.setScale(this.inkyScale);
  }

  /** A small celebratory puff at Evie — gentler than the purchase confetti. */
  private sparkleAtEvie(): void {
    const emitter = this.add.particles(EVIE_X, EVIE_Y - 40, 'spark', {
      speed: { min: 60, max: 180 },
      lifespan: 700,
      scale: { start: 0.5, end: 0 },
      quantity: 10,
      emitting: false,
      tint: [0xffe9a8, 0xffffff],
    });
    emitter.explode(10, EVIE_X, EVIE_Y - 40);
    this.time.delayedCall(900, () => {
      if (this.alive) emitter.destroy();
    });
  }

  // ---------------------------------------------------------------- purse

  private buildPurse(): void {
    // hand-drawn pearl: white circle with an off-center highlight (22px)
    const g = this.add.graphics();
    g.fillStyle(0xd9dfe8, 1);
    g.fillCircle(856, 46, 11);
    g.fillStyle(0xf4f6ff, 1);
    g.fillCircle(855, 45, 9);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(852, 42, 4);

    this.pearlDisplay.v = this.progress.pearls;
    // fixed left edge so the number doesn't shimmy as digits change
    this.pearlText = readingText(this, 878, 44, `${this.progress.pearls}`, 34, '#ffffff');
    this.pearlText.setOrigin(0, 0.5);
    readingText(this, 878, 74, 'pearls', 18, '#c9b8d8').setOrigin(0, 0.5);
  }

  /** Tween the visible count to the real balance (spend/earn feedback). */
  private animatePearls(to: number): void {
    this.pearlTween?.destroy();
    this.pearlTween = this.tweens.add({
      targets: this.pearlDisplay,
      v: to,
      duration: 600,
      ease: 'Sine.easeOut',
      onUpdate: () => this.pearlText.setText(`${Math.round(this.pearlDisplay.v)}`),
    });
    this.tweens.add({ targets: this.pearlText, scale: 1.25, duration: 140, yoyo: true });
  }

  // ----------------------------------------------------------------- tabs

  private buildTabs(): void {
    TAB_DEFS.forEach((def, i) => {
      const tab = makeButton(this, TAB_X0 + i * TAB_STEP, 138, def.emoji, () => this.switchTab(def.id), {
        emoji: true,
        fontSize: 28,
        width: TAB_W,
        height: 76,
      });
      tab.label.setY(-12);
      tab.add(readingText(this, 0, 20, def.name, 15, '#26323f'));
      this.tabs.set(def.id, tab);
    });
  }

  private switchTab(tab: TabId): void {
    if (tab === this.activeTab) return;
    this.clearPreview(); // never carry an un-kept try-on across tabs
    this.activeTab = tab;
    this.scrollOffset = 0;
    chime('gentle');
    this.styleTabs();
    this.buildPanel();
  }

  private styleTabs(): void {
    for (const [id, tab] of this.tabs) {
      const active = id === this.activeTab;
      // kill the press-feedback tween so it can't yoyo back over our scale
      this.tweens.killTweensOf(tab);
      tab.setAlpha(active ? 1 : 0.55);
      this.tweens.add({
        targets: tab,
        scale: active ? 1.06 : 1,
        duration: 180,
        ease: 'Sine.easeOut',
      });
    }
  }

  // ---------------------------------------------------------------- panel

  /** Static backdrop + mask + drag-to-scroll wiring (built once). */
  private buildPanelChrome(): void {
    const back = this.add.graphics();
    back.fillStyle(0xffe9a8, 0.1);
    back.fillRoundedRect(PANEL_X, PANEL_TOP, PANEL_W, VIEW_H, 24);
    back.lineStyle(3, 0xffe9a8, 0.4);
    back.strokeRoundedRect(PANEL_X, PANEL_TOP, PANEL_W, VIEW_H, 24);

    // GeometryMask source stays off the display list on purpose
    const shape = this.make.graphics({}, false);
    shape.fillStyle(0xffffff, 1);
    shape.fillRect(PANEL_X, PANEL_TOP, PANEL_W, VIEW_H);
    this.panelMask = shape.createGeometryMask();

    // drag anywhere on the rack to scroll; a real drag suppresses chip taps
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.scrollMoved = false;
      if (p.x >= PANEL_X && p.x <= PANEL_X + PANEL_W && p.y >= PANEL_TOP && p.y <= PANEL_BOTTOM) {
        this.dragging = true;
        this.dragStartY = p.y;
        this.contentStartY = this.content?.y ?? PANEL_TOP;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown || !this.content) return;
      const dy = p.y - this.dragStartY;
      if (Math.abs(dy) > 12) this.scrollMoved = true;
      const maxScroll = Math.max(0, this.contentHeight - VIEW_H);
      this.content.y = Phaser.Math.Clamp(
        this.contentStartY + dy,
        PANEL_TOP - maxScroll,
        PANEL_TOP,
      );
      this.scrollOffset = PANEL_TOP - this.content.y;
      this.gateChipInput();
    });
    this.input.on('pointerup', () => (this.dragging = false));
  }

  /**
   * Chips scrolled past the mask are invisible but would still swallow taps
   * meant for the tabs above — so input is switched off outside the window.
   */
  private gateChipInput(): void {
    const cy = this.content?.y ?? PANEL_TOP;
    for (const { obj, y } of this.chipHits) {
      const worldY = cy + y;
      const visible = worldY > PANEL_TOP + 18 && worldY < PANEL_BOTTOM - 10;
      if (obj.input) obj.input.enabled = visible;
    }
  }

  /** Fully rebuilds the rack for the active tab (collection.ts pattern). */
  private buildPanel(): void {
    this.panelTweens.forEach((t) => t.destroy());
    this.panelTweens = [];
    this.chipHits = [];
    this.content?.destroy();

    const content = this.add.container(0, PANEL_TOP);
    content.setDepth(5);
    if (this.panelMask) content.setMask(this.panelMask);
    this.content = content;

    // simple flow cursor: headers span the row, chips pack two per row
    let cursor = 14;
    let col = 0;
    let chipIndex = 0;
    const flushRow = (): void => {
      if (col > 0) {
        col = 0;
        cursor += ROW_H;
      }
    };
    const addHeader = (text: string): void => {
      flushRow();
      cursor += 6;
      content.add(readingText(this, (COL_X[0]! + COL_X[1]!) / 2, cursor + 12, text, 20, '#e8d5f5'));
      cursor += 36;
    };
    const addChip = (item: CosmeticItem | null, category: CosmeticCategory): void => {
      const x = COL_X[col]!;
      const y = cursor + CHIP_H / 2;
      const chip = this.makeChip(item, category, x, y, chipIndex++);
      content.add(chip);
      this.chipHits.push({ obj: chip, y });
      col++;
      if (col === 2) {
        col = 0;
        cursor += ROW_H;
      }
    };
    const addCategory = (category: CosmeticCategory): void => {
      for (const item of COSMETICS.filter((c) => c.category === category)) {
        addChip(item, category);
      }
      // "none" is a real choice for optional slots — a free take-it-off chip
      if (OPTIONAL_CATEGORIES.includes(category)) addChip(null, category);
      flushRow();
    };

    switch (this.activeTab) {
      case 'hair':
        addHeader('Me');
        cursor = this.addSkinRow(content, cursor);
        addHeader('Hair styles');
        addCategory('hairStyle');
        break;
      case 'color':
        addHeader('Hair colors');
        addCategory('hairColor');
        break;
      case 'outfit':
        addHeader('Mermaid tails');
        for (const item of COSMETICS.filter((c) => c.id.startsWith('tail-'))) {
          addChip(item, 'outfit');
        }
        flushRow();
        addHeader('Princess gowns');
        for (const item of COSMETICS.filter((c) => c.id.startsWith('gown-'))) {
          addChip(item, 'outfit');
        }
        flushRow();
        addHeader('Fairy dresses');
        for (const item of COSMETICS.filter((c) => c.id.startsWith('fairy-'))) {
          addChip(item, 'outfit');
        }
        flushRow();
        addHeader('Everyday');
        for (const item of COSMETICS.filter((c) => c.id.startsWith('play-'))) {
          addChip(item, 'outfit');
        }
        flushRow();
        break;
      case 'face':
        // all three are optional slots, so addCategory appends a free "None ✖"
        addHeader('Freckles & blush');
        addCategory('face');
        addHeader('Glasses');
        addCategory('glasses');
        addHeader('Earrings');
        addCategory('earrings');
        break;
      case 'sparkle':
        addHeader('Headwear');
        addCategory('headwear');
        addHeader('Necklaces');
        addCategory('necklace');
        addHeader('To hold');
        addCategory('held');
        break;
      case 'inky':
        addHeader('Inky colors');
        addCategory('petColor');
        addHeader('Inky hats');
        addCategory('petHat');
        break;
    }
    flushRow();
    this.contentHeight = cursor + 12;

    // restore the scroll so an equip doesn't yank the rack back to the top
    const maxScroll = Math.max(0, this.contentHeight - VIEW_H);
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, maxScroll);
    content.y = PANEL_TOP - this.scrollOffset;
    this.gateChipInput();
  }

  /** Row of four skin swatches — plain circles, always free, never priced. */
  private addSkinRow(content: Phaser.GameObjects.Container, cursor: number): number {
    SKINS.forEach((skin, i) => {
      const x = 588 + i * 112;
      const y = cursor + 38;
      const swatch = this.add.container(x, y);
      const g = this.add.graphics();
      if (this.progress.avatar.skin === skin.id) {
        // ring highlight marks "this is me"
        g.lineStyle(4, 0xffe9a8, 1);
        g.strokeCircle(0, 0, 34);
      }
      g.fillStyle(0x000000, 0.2);
      g.fillCircle(2, 3, 27);
      g.fillStyle(skin.color, 1);
      g.fillCircle(0, 0, 27);
      swatch.add(g);
      // visual is a 54px circle but the tap target stays ≥64px
      swatch.setSize(72, 72);
      swatch.setInteractive({ useHandCursor: true });
      swatch.on('pointerup', () => {
        if (this.scrollMoved) return;
        if (this.progress.avatar.skin === skin.id) return;
        this.clearPreview();
        this.progress.avatar = { ...this.progress.avatar, skin: skin.id };
        saveProgress(this.progress);
        this.repaintAvatars();
        chime('gentle');
        this.sparkleAtEvie();
        this.buildPanel();
      });
      content.add(swatch);
      this.chipHits.push({ obj: swatch, y });
      popIn(this, swatch, i * 45);
    });
    return cursor + 84;
  }

  /** One shop chip. `item === null` is the "None ✖" unequip chip. */
  private makeChip(
    item: CosmeticItem | null,
    category: CosmeticCategory,
    x: number,
    y: number,
    index: number,
  ): Button {
    const id = item?.id ?? null;
    const equipped = partOf(this.progress.avatar, category) === id;
    const owned = item === null || item.price === 0 || this.progress.cosmetics.includes(item.id);
    const affordable = item !== null && this.progress.pearls >= item.price;

    const fill = equipped ? 0xffe9a8 : 0xffffff;
    const chip = makeButton(
      this,
      x,
      y,
      item?.label ?? 'None',
      () => this.onChipTap(item, category, owned, affordable),
      { width: CHIP_W, height: CHIP_H, fontSize: 18, fill },
    );
    chip.label.setX(-4);
    chip.add(emojiText(this, -88, 0, item?.emoji ?? '✖', 30));

    if (equipped) {
      chip.add(readingText(this, 88, 0, '✓', 26, '#3c7a3c'));
    } else if (item && !owned) {
      // price with a tiny pearl dot; not shown once it's hers
      const dot = this.add.graphics();
      dot.fillStyle(0xf4f6ff, 1);
      dot.fillCircle(66, 0, 5);
      dot.fillStyle(0xffffff, 1);
      dot.fillCircle(64, -2, 2);
      chip.add(dot);
      chip.add(readingText(this, 84, 0, `${item.price}`, 18, '#4a5568'));
      chip.setAlpha(affordable ? 0.9 : 0.45);
    }

    // squeeze long labels into the space between emoji and price/check
    const maxLabel = 118;
    if (chip.label.width > maxLabel) chip.label.setScale(maxLabel / chip.label.width);

    popIn(this, chip, index * 40);
    return chip;
  }

  private onChipTap(
    item: CosmeticItem | null,
    category: CosmeticCategory,
    owned: boolean,
    affordable: boolean,
  ): void {
    if (this.scrollMoved) return; // that was a scroll, not a choice
    if (this.previewItem && this.previewItem.id === item?.id) return; // already trying it on

    // any other tap drops an un-kept try-on before doing its own thing
    this.clearPreview();

    if (item === null) {
      // "None" chip: bare is a valid look for optional slots
      if (partOf(this.progress.avatar, category) === null) return;
      this.equip(category, null);
      return;
    }

    if (owned) {
      const equipped = partOf(this.progress.avatar, category) === item.id;
      if (equipped) {
        // optional slots toggle off; required slots just stay put
        if (OPTIONAL_CATEGORIES.includes(category)) this.equip(category, null);
        return;
      }
      this.equip(category, item.id);
      return;
    }

    if (!affordable) {
      chime('gentle');
      void speakUI('need-pearls', 'Read to earn more pearls!');
      return;
    }

    this.startPreview(item);
  }

  /** Owned-item equip (or unequip with id null): save, repaint, sparkle. */
  private equip(category: CosmeticCategory, id: string | null): void {
    this.progress.avatar = withPart(this.progress.avatar, category, id);
    saveProgress(this.progress);
    this.repaintAvatars();
    chime('gentle');
    this.sparkleAtEvie();
    this.buildPanel();
  }

  // -------------------------------------------------------------- try-on

  /** Free try-on: paint the look, offer Keep/Put back. Nothing is saved. */
  private startPreview(item: CosmeticItem): void {
    this.previewItem = item;
    this.repaintAvatars();
    chime('good');
    this.showConfirmBar(item);
  }

  private clearPreview(): void {
    this.confirmBar?.destroy();
    this.confirmBar = null;
    if (!this.previewItem) return;
    this.previewItem = null;
    this.repaintAvatars(); // back to the saved look — nothing was written
  }

  private showConfirmBar(item: CosmeticItem): void {
    this.confirmBar?.destroy();
    const bar = this.add.container(PANEL_X + PANEL_W / 2, 648).setDepth(30);
    this.confirmBar = bar;

    const bg = this.add.graphics();
    bg.fillStyle(0x2b1230, 0.96);
    bg.fillRoundedRect(-PANEL_W / 2 + 4, -46, PANEL_W - 8, 92, 22);
    bg.lineStyle(3, 0xffe9a8, 0.7);
    bg.strokeRoundedRect(-PANEL_W / 2 + 4, -46, PANEL_W - 8, 92, 22);
    bar.add(bg);

    const keep = makeButton(this, -104, 0, 'Keep it!', () => this.keepPreview(), {
      width: 228,
      height: 70,
      fontSize: 24,
      fill: 0xffe9a8,
    });
    keep.label.setX(-16);
    keep.add(emojiText(this, -88, 0, '⭐', 26));
    const dot = this.add.graphics();
    dot.fillStyle(0xf4f6ff, 1);
    dot.fillCircle(58, 0, 5);
    keep.add(dot);
    keep.add(readingText(this, 78, 0, `${item.price}`, 22, '#4a5568'));
    bar.add(keep);

    const back = makeButton(this, 138, 0, 'Put back', () => this.clearPreview(), {
      width: 176,
      height: 70,
      fontSize: 22,
    });
    bar.add(back);

    popIn(this, bar);
  }

  private keepPreview(): void {
    const item = this.previewItem;
    if (!item) return;
    // the ONE place a purchase becomes real: pearls, ownership, look, save
    this.progress.pearls = Math.max(0, this.progress.pearls - item.price);
    this.progress.cosmetics.push(item.id);
    this.progress.avatar = withPart(this.progress.avatar, item.category, item.id);
    saveProgress(this.progress);

    this.previewItem = null; // look already matches — no repaint flicker
    this.confirmBar?.destroy();
    this.confirmBar = null;

    this.animatePearls(this.progress.pearls);
    confettiBurst(this, EVIE_X, EVIE_Y - 60, 0xffe9a8);
    chime('fanfare');
    void speakUI('new-outfit', 'Ooh! You look wonderful!');
    this.buildPanel();
  }

  // -------------------------------------------------------- anti-camping

  /**
   * Gentle shopkeeper's-closing-time nudge. Nothing is ever blocked — Inky
   * yawns, one voice line points at reading, the home button waves. Re-arms
   * every 2 minutes so a long linger keeps hearing it, softly.
   */
  private nudge(): void {
    if (!this.alive) return;
    this.tweens.add({
      targets: this.inkyImg,
      scaleX: this.inkyScale * 1.2,
      scaleY: this.inkyScale * 0.76,
      angle: -12,
      duration: 420,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!this.alive) return;
        this.inkyImg.setScale(this.inkyScale);
        this.inkyImg.setAngle(0);
      },
    });
    void speakUI('wardrobe-nudge', "Let's go read to earn more pearls!");
    this.tweens.add({
      targets: this.homeBtn,
      scale: 1.15,
      duration: 260,
      yoyo: true,
      repeat: 2, // three pulses
      ease: 'Sine.easeInOut',
    });
    this.time.delayedCall(2 * 60_000, () => this.nudge());
  }
}

// ------------------------------------------------------------- avatar util

/** Read the equipped id for a cosmetic slot. */
function partOf(a: AvatarConfig, cat: CosmeticCategory): string | null {
  return (a as unknown as Record<CosmeticCategory, string | null>)[cat];
}

/**
 * New config with one slot swapped — always a copy, so the saved avatar and
 * a try-on preview can never share an object.
 */
function withPart(a: AvatarConfig, cat: CosmeticCategory, id: string | null): AvatarConfig {
  const next = { ...a } as unknown as Record<CosmeticCategory, string | null>;
  next[cat] = id;
  return next as unknown as AvatarConfig;
}
