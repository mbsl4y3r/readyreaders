/**
 * Photo Booth — pose the dressed-up Evie (and Inky) in a little photo frame,
 * pick a cheerful backdrop, dab on a few emoji stamps, then snap a keepsake
 * into a six-slot gallery.
 *
 * No fail states: every backdrop and stamp is free, snapping is always
 * available, and the gallery just keeps the six most-recent shots.
 *
 * The avatars are live-painted from progress.avatar exactly as the wardrobe
 * does (paintEvie/paintInky → CanvasTexture → Image). A snap is captured with
 * the renderer's snapshotArea over the opaque frame interior, so whatever is
 * rendered inside the frame (backdrop + avatars + stamps) becomes the PNG.
 */
import Phaser from 'phaser';
import { paintReader, paintPet } from '../avatar/paint';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { chime, speakUI } from '../services/audio';
import {
  GAME_W,
  GAME_H,
  EMOJI_FONT,
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

// ---- frame geometry (left-centre of the screen) -----------------------------
// Outer decorative frame.
const OX = 70;
const OY = 128;
const OW = 500;
const OH = 500;
const FCX = OX + OW / 2; // 320
const FCY = OY + OH / 2; // 378
// Opaque backdrop image (sits just inside the border).
const BD_W = 492;
const BD_H = 492;
// Capture rectangle — inset 10 from the backdrop so its corners stay safely
// inside the opaque rounded fill (no scene-behind bleed in the snapshot).
const CAP_X = 84;
const CAP_Y = 142;
const CAP_W = 472;
const CAP_H = 472;

const BACKDROP_KEY = 'photobooth-backdrop';
const EVIE_KEY = 'photobooth-evie';
const INKY_KEY = 'photobooth-inky';

// ---- right-hand control column ----------------------------------------------
// Two rows of five for both choosers, so the bigger catalog still fits beside
// the frame: labels, two swatch rows, two stamp rows, then Snap + Start over.
const RX = 800;
const SWATCH_Y = 186;
const SWATCH_Y2 = 262;
const STAMP_Y = 380;
const STAMP_Y2 = 456;
const CHOOSER_STEP = 88;

// ---- gallery strip ----------------------------------------------------------
const GALLERY_Y = 686;
const GALLERY_STEP = 76;
const GALLERY_X0 = 322; // first of up to six thumbs, centred on 512
const THUMB = 66;

interface Backdrop {
  id: string;
  swatch: string; // emoji shown on the chooser button
  top: string; // gradient top colour
  bottom: string; // gradient bottom colour
  accent: string; // little emoji scattered across the backdrop
}

const BACKDROPS: Backdrop[] = [
  { id: 'ocean', swatch: '🌊', top: '#9fe6ff', bottom: '#2a6cb0', accent: '🐚' },
  { id: 'forest', swatch: '🌲', top: '#c4f0ac', bottom: '#2f8f5b', accent: '🍃' },
  { id: 'sparkle', swatch: '✨', top: '#f7dcff', bottom: '#8a5ad0', accent: '⭐' },
  { id: 'rainbow', swatch: '🌈', top: '#ffd6ec', bottom: '#7ec8ff', accent: '🌈' },
  { id: 'castle', swatch: '🏰', top: '#ffe7b3', bottom: '#e0893a', accent: '👑' },
  { id: 'candy', swatch: '🍭', top: '#ffd9f0', bottom: '#ff8fc8', accent: '🍬' },
  { id: 'space', swatch: '🚀', top: '#3a3f7d', bottom: '#12102e', accent: '🪐' },
  { id: 'snow', swatch: '❄️', top: '#eaf6ff', bottom: '#9cc4e8', accent: '⛄' },
  { id: 'sunset', swatch: '🌅', top: '#ffd2a1', bottom: '#e0608a', accent: '🌴' },
  { id: 'meadow', swatch: '🌼', top: '#d8f7c1', bottom: '#7cc46a', accent: '🦋' },
];

const STAMPS: string[] = ['⭐', '🌈', '💖', '🐚', '🎀', '🦋', '👑', '🫧', '🌸', '🎈'];

/** Default drop spots for stamps — all comfortably inside the capture rect. */
const STAMP_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [160, 210],
  [468, 200],
  [498, 330],
  [138, 340],
  [300, 172],
  [470, 480],
  [150, 480],
  [300, 300],
];

export class PhotoBoothScene extends Phaser.Scene {
  /** False once the scene shuts down — guards async snapshot / image loads. */
  private alive = true;
  private progress!: ProgressData;

  private bgIndex = 0;
  private backdropImg: Phaser.GameObjects.Image | null = null;

  /** Emoji stamps currently placed inside the frame. */
  private stamps: Phaser.GameObjects.Text[] = [];
  private stampSeq = 0;

  /** Backdrop chooser buttons + label — rebuilt in place on selection. */
  private chooserBtns: Phaser.GameObjects.Container[] = [];
  private chooserLabel: Phaser.GameObjects.Text | null = null;

  /** Gallery thumbnails (+ their private texture keys) for teardown/rebuild. */
  private thumbs: { obj: Phaser.GameObjects.GameObject; key: string }[] = [];
  private thumbSeq = 0;
  private emptyHint: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('photobooth');
  }

  create(): void {
    this.alive = true;
    this.bgIndex = 0;
    this.backdropImg = null;
    this.stamps = [];
    this.stampSeq = 0;
    this.chooserBtns = [];
    this.chooserLabel = null;
    this.thumbs = [];
    this.thumbSeq = 0;
    this.emptyHint = null;
    this.events.once('shutdown', () => (this.alive = false));

    this.progress = loadProgress();

    // cheerful photo-studio backdrop: rosy → violet with drifting sparkles
    drawRealmBackground(this, 0x5b6bd0, 0x2a1f52, ['📸', '✨', '💖'], 'stars');
    this.cameras.main.fadeIn(300);
    void speakUI('photo-booth', "Photo booth! Let's take a picture of you!");

    sceneTitle(this, 'Photo Booth', '📸', 56);

    const home = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: COL.paper,
    });
    home.setAlpha(0.95);
    home.setDepth(30);

    this.buildFrame();
    this.renderBackdrop();
    this.buildAvatars();
    this.buildBackgroundChooser();
    this.buildStampBar();
    this.buildSnapButton();
    this.buildGallery();
  }

  // ------------------------------------------------------------------- frame

  private buildFrame(): void {
    // soft drop shadow behind the whole frame
    const shadow = this.add.graphics().setDepth(1);
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(OX - 4 + 6, OY - 4 + 8, OW + 8, OH + 8, 34);

    // the opaque backdrop image is created lazily by renderBackdrop() at depth 2

    // decorative border drawn on TOP of the backdrop edge (outside the capture
    // rect, so it never lands in the photo) — creamy frame with a gold inner line
    const border = this.add.graphics().setDepth(6);
    border.lineStyle(14, 0xfff3d6, 1);
    border.strokeRoundedRect(OX, OY, OW, OH, 30);
    border.lineStyle(3, 0xe0b34c, 0.9);
    border.strokeRoundedRect(OX + 9, OY + 9, OW - 18, OH - 18, 22);
  }

  /** Paint the selected backdrop into a canvas texture and (re)bind the image. */
  private renderBackdrop(): void {
    const bg = BACKDROPS[this.bgIndex]!;
    if (this.textures.exists(BACKDROP_KEY)) this.textures.remove(BACKDROP_KEY);
    const tex = this.textures.createCanvas(BACKDROP_KEY, BD_W, BD_H);
    if (!tex) return;
    const ctx = tex.getContext();
    this.drawBackdrop(ctx, bg);
    tex.refresh();

    if (this.backdropImg) {
      this.backdropImg.setTexture(BACKDROP_KEY);
    } else {
      this.backdropImg = this.add.image(FCX, FCY, BACKDROP_KEY).setDepth(2);
    }
  }

  /** Rounded, opaque gradient fill with a scatter of the backdrop's accent. */
  private drawBackdrop(ctx: CanvasRenderingContext2D, bg: Backdrop): void {
    const r = 24;
    ctx.clearRect(0, 0, BD_W, BD_H);
    ctx.save();
    // rounded-rect clip
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(BD_W - r, 0);
    ctx.arcTo(BD_W, 0, BD_W, r, r);
    ctx.lineTo(BD_W, BD_H - r);
    ctx.arcTo(BD_W, BD_H, BD_W - r, BD_H, r);
    ctx.lineTo(r, BD_H);
    ctx.arcTo(0, BD_H, 0, BD_H - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.clip();

    // vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, BD_H);
    grad.addColorStop(0, bg.top);
    grad.addColorStop(1, bg.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BD_W, BD_H);

    // soft ground glow near the bottom (where the pair stands)
    const glow = ctx.createRadialGradient(BD_W / 2, BD_H - 40, 20, BD_W / 2, BD_H - 40, 260);
    glow.addColorStop(0, 'rgba(255,255,255,0.28)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, BD_W, BD_H);

    // scattered accent emoji
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const spots: ReadonlyArray<readonly [number, number, number, number]> = [
      [70, 90, 40, 0.32],
      [410, 70, 34, 0.28],
      [440, 250, 44, 0.24],
      [60, 300, 30, 0.26],
      [230, 60, 26, 0.3],
    ];
    for (const [x, y, size, alpha] of spots) {
      ctx.globalAlpha = alpha;
      ctx.font = `${size}px ${EMOJI_FONT}`;
      ctx.fillText(bg.accent, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ----------------------------------------------------------------- avatars

  private buildAvatars(): void {
    paintReader(this, this.progress.avatar, EVIE_KEY);
    const evie = this.add.image(300, 440, EVIE_KEY).setDepth(4);
    evie.setScale(330 / evie.height);
    this.tweens.add({
      targets: evie,
      y: evie.y - 8,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    paintPet(this, this.progress.avatar, INKY_KEY);
    const inky = this.add.image(442, 553, INKY_KEY).setDepth(3);
    inky.setScale(95 / inky.height);
    this.tweens.add({
      targets: inky,
      y: inky.y - 6,
      duration: 1700,
      delay: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // -------------------------------------------------------- background chooser

  private buildBackgroundChooser(): void {
    if (!this.chooserLabel) {
      this.chooserLabel = displayText(this, RX, 132, 'Backdrops', 26, '#ffe9a8', '700').setDepth(30);
    }
    this.chooserBtns.forEach((b) => b.destroy());
    this.chooserBtns = [];
    BACKDROPS.forEach((bg, i) => {
      const col = i % 5;
      const x = RX + (col - 2) * CHOOSER_STEP;
      const y = i < 5 ? SWATCH_Y : SWATCH_Y2;
      const btn = makeButton(this, x, y, bg.swatch, () => this.chooseBackdrop(i), {
        emoji: true,
        fontSize: 30,
        width: 78,
        height: 68,
      });
      btn.setDepth(30);
      if (i === this.bgIndex) btn.setScale(1.08);
      this.chooserBtns.push(btn);
    });
  }

  private chooseBackdrop(index: number): void {
    if (index === this.bgIndex) return;
    this.bgIndex = index;
    this.renderBackdrop();
    chime('gentle');
    // rebuild the chooser so the selected swatch pops
    this.buildBackgroundChooser();
  }

  // ------------------------------------------------------------------ stamps

  private buildStampBar(): void {
    displayText(this, RX, 326, 'Stamps', 26, '#ffe9a8', '700').setDepth(30);
    STAMPS.forEach((emoji, i) => {
      const col = i % 5;
      const x = RX + (col - 2) * CHOOSER_STEP;
      const y = i < 5 ? STAMP_Y : STAMP_Y2;
      const btn = makeButton(this, x, y, emoji, () => this.addStamp(emoji), {
        emoji: true,
        fontSize: 30,
        width: 78,
        height: 68,
      });
      btn.setDepth(30);
    });
  }

  /** Drop a stamp at the next default spot INSIDE the frame, with a little pop. */
  private addStamp(emoji: string): void {
    const spot = STAMP_SPOTS[this.stampSeq % STAMP_SPOTS.length]!;
    this.stampSeq++;
    const t = emojiText(this, spot[0], spot[1], emoji, 50).setDepth(5);
    this.stamps.push(t);
    // keep the frame from getting crowded — retire the oldest past twelve
    if (this.stamps.length > 12) {
      const old = this.stamps.shift();
      old?.destroy();
    }
    popIn(this, t);
    chime('gentle');
  }

  /** Start over: sweep every stamp off the photo (backdrop + pose stay). */
  private clearStamps(): void {
    if (this.stamps.length === 0) return;
    this.stamps.forEach((s) => s.destroy());
    this.stamps = [];
    this.stampSeq = 0;
    chime('gentle');
  }

  // -------------------------------------------------------------------- snap

  private buildSnapButton(): void {
    const snap = makeButton(this, RX - 56, 560, '📸 Snap!', () => this.snap(), {
      width: 230,
      height: 84,
      fontSize: 32,
      fill: 0xffd166,
    });
    snap.setDepth(30);
    // start over — sweeps the stamps so she can decorate fresh
    const reset = makeButton(this, RX + 118, 560, '🧹', () => this.clearStamps(), {
      emoji: true,
      fontSize: 32,
      width: 96,
      height: 84,
      fill: COL.paper,
    });
    reset.setDepth(30);
    reset.setAlpha(0.92);
  }

  /**
   * Capture the frame interior to a PNG. snapshotArea runs on the next render
   * and hands an HTMLImageElement to the callback — its .src is the data URL.
   * The alive flag stops a late callback from touching a dead scene.
   */
  private snap(): void {
    if (!this.alive) return;
    chime('good');
    this.game.renderer.snapshotArea(
      CAP_X,
      CAP_Y,
      CAP_W,
      CAP_H,
      (image: HTMLImageElement | Phaser.Display.Color) => {
        if (!this.alive) return;
        if (!(image instanceof HTMLImageElement)) return;
        const url = image.src;
        this.progress.photos.push(url);
        while (this.progress.photos.length > 6) this.progress.photos.shift();
        saveProgress(this.progress);
        chime('fanfare');
        confettiBurst(this, RX, 320, 0xffe9a8);
        this.buildGallery();
      },
    );
  }

  // ----------------------------------------------------------------- gallery

  private buildGallery(): void {
    for (const t of this.thumbs) {
      t.obj.destroy();
      if (t.key && this.textures.exists(t.key)) this.textures.remove(t.key);
    }
    this.thumbs = [];
    this.emptyHint?.destroy();
    this.emptyHint = null;

    const photos = this.progress.photos;
    if (photos.length === 0) {
      this.emptyHint = displayText(
        this,
        512,
        GALLERY_Y,
        'Your photos will appear here 📷',
        20,
        '#c9b8e8',
        '500',
      ).setDepth(24);
      return;
    }

    // show up to the six most recent, oldest → newest, left → right
    const start = Math.max(0, photos.length - 6);
    for (let i = start; i < photos.length; i++) {
      const cx = GALLERY_X0 + (i - start) * GALLERY_STEP;
      this.loadThumb(photos[i]!, cx);
    }
  }

  /** Turn a data URL into a texture, then place a tappable thumbnail. */
  private loadThumb(url: string, cx: number): void {
    const key = `pb-thumb-${this.thumbSeq++}`;
    const img = new Image();
    img.onload = (): void => {
      if (!this.alive) return;
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addImage(key, img);
      this.placeThumb(key, cx, url);
    };
    img.src = url;
  }

  private placeThumb(key: string, cx: number, url: string): void {
    const half = THUMB / 2 + 3;
    const frame = this.add.graphics().setDepth(24);
    frame.fillStyle(0x000000, 0.3);
    frame.fillRoundedRect(cx - half + 2, GALLERY_Y - half + 3, half * 2, half * 2, 12);
    frame.fillStyle(0xffffff, 1);
    frame.fillRoundedRect(cx - half, GALLERY_Y - half, half * 2, half * 2, 12);

    const im = this.add.image(cx, GALLERY_Y, key).setDepth(25);
    im.setScale(THUMB / Math.max(im.width, im.height));
    im.setInteractive({ useHandCursor: true });
    im.on('pointerup', () => this.showBig(url));

    this.thumbs.push({ obj: frame, key: '' }, { obj: im, key });
    popIn(this, im);
  }

  /** Full-size preview of a saved photo; tap anywhere to close. */
  private showBig(url: string): void {
    const overlay = this.add.container(0, 0).setDepth(300);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.8);
    dim.fillRect(0, 0, GAME_W, GAME_H);
    overlay.add(dim);

    const zone = this.add.zone(0, 0, GAME_W, GAME_H).setOrigin(0).setInteractive();
    overlay.add(zone);

    overlay.add(displayText(this, GAME_W / 2, 60, 'Tap to close', 24, '#ffe9a8', '500'));

    const key = `pb-big-${this.thumbSeq++}`;
    const img = new Image();
    img.onload = (): void => {
      if (!this.alive || !overlay.active) return;
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addImage(key, img);
      const big = this.add.image(GAME_W / 2, GAME_H / 2 + 20, key);
      big.setScale(Math.min(560 / big.width, 560 / big.height));
      overlay.add(big);
      popIn(this, big);
    };
    img.src = url;

    zone.on('pointerup', () => {
      if (this.textures.exists(key)) this.textures.remove(key);
      overlay.destroy();
    });
  }
}
