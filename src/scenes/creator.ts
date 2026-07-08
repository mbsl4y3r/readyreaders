/**
 * The first-run Character Creator — the magical "make your very own Evie!"
 * moment that runs before the adventure (boot routes here while
 * progress.created is false). It is deliberately NOT a form: a big live Evie
 * (with Inky) rebuilds herself the instant a choice is tapped, so the child
 * watches herself being made, one delighted step at a time.
 *
 * Everything offered here is a FREE welcome gift — no prices, no locks, no
 * fail states. The catalog's `starter` items are the palette; whatever the
 * child lands on is granted as owned at finish (see grantOwnership), even
 * where that starter piece carries a nonzero shop price.
 *
 * Preview discipline (mirrors the wardrobe): progress is NEVER written until
 * the final "That's me!" — the whole creator edits a working copy of the
 * config and repaints from it, so leaving mid-way can't leak a half-made look.
 */
import Phaser from 'phaser';
import {
  CREATION_CATEGORIES,
  starterItems,
  type AvatarConfig,
  type CosmeticCategory,
  type CosmeticItem,
  type SkinId,
} from '../avatar/catalog';
import { paintEvie, paintInky } from '../avatar/paint';
import { loadProgress, saveProgress } from '../services/progress';
import { speakUI, chime, playMusic } from '../services/audio';
import {
  GAME_W,
  readingText,
  emojiText,
  makeButton,
  drawRealmBackground,
  ensureSparkTexture,
  popIn,
  confettiBurst,
  type Button,
} from '../ui/kit';

/**
 * Skin tones are IDENTITY, not merchandise — always all four, always free,
 * shown as plain swatches (never priced chips). Order matches SkinId; the
 * colors match the painter's skin base tones so a swatch reads true.
 */
const SKINS: { id: SkinId; color: number }[] = [
  { id: 'shell', color: 0xffd9b0 },
  { id: 'sand', color: 0xf2c391 },
  { id: 'amber', color: 0xc98a5b },
  { id: 'cocoa', color: 0x8d5a3b },
];

/** Kid-facing prompt per creator step (skin step handled separately). */
const PROMPTS: Partial<Record<CosmeticCategory, string>> = {
  hairStyle: 'Pick a hairstyle',
  hairColor: 'Choose a hair color',
  outfit: 'Dress up!',
  face: 'Add a face',
  petColor: 'Your pet Inky',
};

/** One step of the walkthrough: the skin swatches, or one cosmetic category. */
interface StepDef {
  /** null marks the skin-swatch step (identity, not a cosmetic slot). */
  category: CosmeticCategory | null;
  prompt: string;
  /** Voice-clip id for the prompt — a pre-reader hears every step (clip-manifest). */
  clip: string;
}

/**
 * Step order: skin first, then exactly the catalog's CREATION_CATEGORIES
 * (hairStyle, hairColor, outfit, face, petColor). Built from the contract so
 * the flow stays honest if that list is ever reordered or extended. Each
 * step's `clip` mirrors an entry in scripts/clip-manifest.ts so the prompt is
 * spoken (recording or TTS) — the creator is a solo, pre-reading moment.
 */
const STEPS: StepDef[] = [
  { category: null, prompt: 'Pick your skin', clip: 'creator-step-skin' },
  ...CREATION_CATEGORIES.map((c) => ({
    category: c,
    prompt: PROMPTS[c] ?? c,
    clip: `creator-step-${c}`,
  })),
];

// ---- stage geometry --------------------------------------------------------
const EVIE_KEY = 'creator-evie';
const INKY_KEY = 'creator-inky';
const EVIE_X = 300;
const EVIE_Y = 404; // display height 420, centered → feet land on the spotlight
const EVIE_H = 420;
const INKY_X = 468;
const INKY_Y = 556;
const INKY_H = 132;

// ---- choice-rack card geometry (right side) --------------------------------
const RACK_CX = 785;
const PANEL_X = 566;
const PANEL_Y = 112;
const PANEL_W = 438;
const PANEL_H = 586;
const CHIP_W = 204;
const CHIP_H = 76;
const ROW_H = 96;
const COL_X = [676, 896]; // two chip columns; nav buttons share these centers
const AREA_TOP = 262; // where the chip grid begins
const AREA_BOTTOM = 590; // ...and where it must end (nav sits below)
const NAV_Y = 650;

export class CreatorScene extends Phaser.Scene {
  /** False once the scene shuts down — guards delayedCalls and audio .then. */
  private alive = true;

  /** The look being built. NEVER written to progress until "That's me!". */
  private working!: AvatarConfig;
  private stepIndex = 0;

  private evieImg!: Phaser.GameObjects.Image;
  private inkyImg!: Phaser.GameObjects.Image;
  private inkyScale = 1;
  /** Idle bobs are infinite tweens — tracked so they can be killed before scene end. */
  private ambient: Phaser.Tweens.Tween[] = [];

  /** Everything that changes per step (prompt, dots, chips, nav) lives here. */
  private stepLayer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('creator');
  }

  create(): void {
    this.alive = true;
    this.ambient = [];
    this.stepLayer = null;
    this.stepIndex = 0;
    this.events.once('shutdown', () => (this.alive = false));

    // A fresh save already holds defaultAvatar(); clone it so the creator's
    // edits never touch the stored config until finish. Robust if we somehow
    // arrive with a look already saved (a re-run): we start from it.
    this.working = { ...loadProgress().avatar };

    // Warm, celebratory dusk: rosy plum → deep aubergine with star twinkles.
    drawRealmBackground(this, 0x7a4a72, 0x2b1636, ['✨', '🌟', '💖'], 'stars');
    this.cameras.main.fadeIn(300);
    playMusic('wardrobe');
    ensureSparkTexture(this);

    readingText(this, GAME_W / 2, 56, 'Make your Evie! ✨', 40, '#ffe9a8');
    // welcome, then name the very first step so a pre-reader knows what to do
    // (later steps are voiced on the step change — see goToStep)
    void speakUI('creator-welcome', "Let's make your very own Evie!").then(() => {
      if (this.alive && this.stepIndex === 0) this.speakStep();
    });

    this.buildStage();
    this.buildRackCard();
    this.renderStep(true);
  }

  // ---------------------------------------------------------------- stage

  /** Spotlight pool + the big live Evie and a smaller Inky, both bobbing. */
  private buildStage(): void {
    const pool = this.add.graphics();
    pool.fillStyle(0xffe9a8, 0.1);
    pool.fillEllipse(EVIE_X + 40, 624, 460, 88);
    pool.fillStyle(0xffffff, 0.08);
    pool.fillEllipse(EVIE_X + 40, 622, 320, 60);

    paintEvie(this, this.working, EVIE_KEY);
    this.evieImg = this.add.image(EVIE_X, EVIE_Y, EVIE_KEY);
    // Painter renders at 2× resolution — scale from the texture's real pixel
    // height, or Evie doubles in size. Display height lands at EVIE_H.
    this.evieImg.setScale(EVIE_H / this.evieImg.height);
    this.ambient.push(
      this.tweens.add({
        targets: this.evieImg,
        y: EVIE_Y - 9,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );

    paintInky(this, this.working, INKY_KEY);
    this.inkyImg = this.add.image(INKY_X, INKY_Y, INKY_KEY);
    this.inkyScale = INKY_H / this.inkyImg.height;
    this.inkyImg.setScale(this.inkyScale);
    this.ambient.push(
      this.tweens.add({
        targets: this.inkyImg,
        y: INKY_Y - 6,
        duration: 1700,
        delay: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
  }

  /** Repaint both textures from the working look and keep their display size. */
  private repaintAvatars(): void {
    paintEvie(this, this.working, EVIE_KEY);
    this.evieImg.setTexture(EVIE_KEY);
    this.evieImg.setScale(EVIE_H / this.evieImg.height);
    paintInky(this, this.working, INKY_KEY);
    this.inkyImg.setTexture(INKY_KEY);
    this.inkyImg.setScale(this.inkyScale);
  }

  /** A small celebratory puff at Evie whenever a choice lands. */
  private sparkleAtEvie(): void {
    const emitter = this.add.particles(EVIE_X, EVIE_Y - 40, 'spark', {
      speed: { min: 60, max: 190 },
      lifespan: 700,
      scale: { start: 0.5, end: 0 },
      quantity: 10,
      emitting: false,
      tint: [0xffe9a8, 0xffffff, 0xffd166],
    });
    emitter.explode(10, EVIE_X, EVIE_Y - 40);
    this.time.delayedCall(900, () => {
      if (this.alive) emitter.destroy();
    });
  }

  // ---------------------------------------------------------------- rack card

  /** The static translucent card the choice rack sits on (built once). */
  private buildRackCard(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffe9a8, 0.1);
    g.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 28);
    g.lineStyle(3, 0xffe9a8, 0.4);
    g.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 28);
  }

  // ---------------------------------------------------------------- steps

  /**
   * Rebuild the whole per-step layer (indicator, prompt, dots, chips, nav).
   * `animateChips` pops the chips in on a real step change, but stays still on
   * a same-step reselect so moving the gold highlight doesn't twitch the rack.
   */
  private renderStep(animateChips: boolean): void {
    this.stepLayer?.destroy();
    const layer = this.add.container(0, 0);
    this.stepLayer = layer;

    const step = STEPS[this.stepIndex]!;

    // step indicator: "Step k of N" + a row of dots (current one gold)
    layer.add(
      readingText(this, RACK_CX, 150, `Step ${this.stepIndex + 1} of ${STEPS.length}`, 18, '#ffffffaa'),
    );
    layer.add(readingText(this, RACK_CX, 188, step.prompt, 30, '#ffe9a8'));
    this.buildDots(layer);

    if (step.category === null) this.buildSkinRow(layer);
    else this.buildChips(layer, step.category, animateChips);

    this.buildNav(layer);
  }

  /**
   * A row of step dots that actually READS as progress (the only cue a
   * non-reader has besides the spoken prompt): a bright gold current dot, solid
   * gold for steps already done behind it, faint white for steps still ahead.
   */
  private buildDots(layer: Phaser.GameObjects.Container): void {
    const g = this.add.graphics();
    const gap = 28;
    const x0 = RACK_CX - ((STEPS.length - 1) * gap) / 2;
    STEPS.forEach((_, i) => {
      const x = x0 + i * gap;
      if (i === this.stepIndex) {
        g.fillStyle(0xffe9a8, 1); // here now — biggest, brightest
        g.fillCircle(x, 226, 7);
      } else if (i < this.stepIndex) {
        g.fillStyle(0xffe9a8, 0.8); // already done — a gold trail filling up
        g.fillCircle(x, 226, 5.5);
      } else {
        g.fillStyle(0xffffff, 0.3); // still to come — faint
        g.fillCircle(x, 226, 5);
      }
    });
    layer.add(g);
  }

  /** Four skin swatches, always available, current one ringed. */
  private buildSkinRow(layer: Phaser.GameObjects.Container): void {
    const y = (AREA_TOP + AREA_BOTTOM) / 2;
    SKINS.forEach((skin, i) => {
      const x = RACK_CX + (i - 1.5) * 96;
      const swatch = this.add.container(x, y);
      const g = this.add.graphics();
      if (this.working.skin === skin.id) {
        g.lineStyle(4, 0xffe9a8, 1);
        g.strokeCircle(0, 0, 37);
      }
      g.fillStyle(0x000000, 0.2);
      g.fillCircle(2, 3, 30);
      g.fillStyle(skin.color, 1);
      g.fillCircle(0, 0, 30);
      swatch.add(g);
      // visual is a 60px circle; the tap target stays ≥64px
      swatch.setSize(80, 80);
      swatch.setInteractive({ useHandCursor: true });
      swatch.on('pointerup', () => this.chooseSkin(skin.id));
      layer.add(swatch);
      popIn(this, swatch, i * 60);
    });
  }

  /** The tappable chips for a cosmetic step (face also gets a 'None' chip). */
  private buildChips(
    layer: Phaser.GameObjects.Container,
    category: CosmeticCategory,
    animate: boolean,
  ): void {
    const items: (CosmeticItem | null)[] = starterItems(category);
    // Face is optional: a bare face (face=null) is a real, valid choice.
    if (category === 'face') items.push(null);

    const rows = Math.ceil(items.length / 2);
    const gridH = rows * ROW_H;
    const startY = AREA_TOP + (AREA_BOTTOM - AREA_TOP - gridH) / 2 + ROW_H / 2;
    const selectedId = partOf(this.working, category);

    items.forEach((item, i) => {
      const col = i % 2;
      // a lone last chip (odd count) centers across both columns
      const lonely = col === 0 && i === items.length - 1;
      const x = lonely ? RACK_CX : COL_X[col]!;
      const yy = startY + Math.floor(i / 2) * ROW_H;
      const id = item?.id ?? null;
      const selected = id === selectedId;

      const chip = makeButton(
        this,
        x,
        yy,
        item?.label ?? 'None',
        () => this.chooseItem(category, id),
        { width: CHIP_W, height: CHIP_H, fontSize: 18, fill: selected ? 0xffe9a8 : 0xffffff },
      );
      chip.label.setX(6);
      chip.add(emojiText(this, -76, 0, item?.emoji ?? '✖', 30));
      // gold tick marks the current pick without a price or clutter
      if (selected) chip.add(readingText(this, 82, 0, '✓', 24, '#3c7a3c'));
      // squeeze long labels into the space between emoji and edge
      const maxLabel = 112;
      if (chip.label.width > maxLabel) chip.label.setScale(maxLabel / chip.label.width);
      if (animate) popIn(this, chip, i * 45);
      layer.add(chip);
    });
  }

  /** Back (hidden on step 1) and Next → / ⭐ That's me! (accent on last step). */
  private buildNav(layer: Phaser.GameObjects.Container): void {
    const last = this.stepIndex === STEPS.length - 1;

    if (this.stepIndex > 0) {
      const back = makeButton(this, COL_X[0]!, NAV_Y, '← Back', () => this.goToStep(this.stepIndex - 1), {
        width: CHIP_W,
        height: 84,
        fontSize: 26,
      });
      back.setAlpha(0.9);
      layer.add(back);
    }

    const next = makeButton(
      this,
      COL_X[1]!,
      NAV_Y,
      last ? "⭐ That's me!" : 'Next →',
      () => (last ? this.finish() : this.goToStep(this.stepIndex + 1)),
      { width: CHIP_W, height: 84, fontSize: last ? 24 : 26, fill: last ? 0xffe9a8 : 0xffffff },
    );
    layer.add(next);
  }

  private goToStep(i: number): void {
    this.stepIndex = Phaser.Math.Clamp(i, 0, STEPS.length - 1);
    chime('gentle');
    this.renderStep(true);
    this.speakStep(); // voice the new step's prompt for a non-reading child
  }

  /** Speak the current step's prompt so a pre-reader knows what to pick. */
  private speakStep(): void {
    const step = STEPS[this.stepIndex]!;
    void speakUI(step.clip, step.prompt);
  }

  // ---------------------------------------------------------------- choices

  private chooseSkin(id: SkinId): void {
    if (this.working.skin === id) return;
    this.working = { ...this.working, skin: id };
    this.onChoiceMade();
  }

  private chooseItem(category: CosmeticCategory, id: string | null): void {
    if (partOf(this.working, category) === id) return;
    this.working = withPart(this.working, category, id);
    this.onChoiceMade();
  }

  /** Shared feedback for any pick: repaint, chime, sparkle, move the highlight. */
  private onChoiceMade(): void {
    this.repaintAvatars();
    chime('gentle');
    this.sparkleAtEvie();
    this.renderStep(false); // reselect only — keep the rack still
  }

  // ---------------------------------------------------------------- finish

  /**
   * The ONE place progress is written. Save the built look, GRANT ownership of
   * every chosen piece (see grantOwnership), flip `created`, then sail on to
   * the placement voyage (a fresh save is not yet placed) with a celebration.
   */
  private finish(): void {
    const progress = loadProgress();
    progress.avatar = { ...this.working };
    progress.cosmetics = grantOwnership(progress.cosmetics, this.working);
    progress.created = true;
    saveProgress(progress);

    // lock the layer so no stray tap fires mid-celebration
    this.stepLayer?.destroy();
    this.stepLayer = null;

    confettiBurst(this, EVIE_X, EVIE_Y - 70, 0xffe9a8);
    this.sparkleAtEvie();
    chime('fanfare');
    void speakUI('creator-done', "Yay! Let's start your adventure!");

    this.time.delayedCall(1300, () => {
      if (!this.alive) return;
      this.cameras.main.fadeOut(400);
    });
    this.time.delayedCall(1750, () => {
      if (!this.alive) return;
      this.stopAmbient(); // kill the infinite idle bobs before leaving
      // a brand-new save is not `placed`, so this routes onward to the voyage
      this.scene.start(loadProgress().placed ? 'map' : 'voyage');
    });
  }

  /** Remove the infinite idle-bob tweens so nothing lingers past scene end. */
  private stopAmbient(): void {
    this.ambient.forEach((t) => t.remove());
    this.ambient = [];
  }
}

// ------------------------------------------------------------- avatar util

/** Read the equipped id for a cosmetic slot of a config. */
function partOf(a: AvatarConfig, cat: CosmeticCategory): string | null {
  return (a as unknown as Record<CosmeticCategory, string | null>)[cat];
}

/** A new config with one slot swapped — always a copy (never shares an object). */
function withPart(a: AvatarConfig, cat: CosmeticCategory, id: string | null): AvatarConfig {
  const next = { ...a } as unknown as Record<CosmeticCategory, string | null>;
  next[cat] = id;
  return next as unknown as AvatarConfig;
}

/**
 * Ownership grant at finish: the union of what she already owns (starter
 * cosmetics from freshProgress) with every piece the creator let her choose —
 * the ids sitting in each CREATION_CATEGORIES slot of the finished look. This
 * makes her picks a free welcome gift even where that starter item carries a
 * nonzero shop price (e.g. a gown or a bob). Skin is identity, not a cosmetic
 * id, so it never enters the set; a null slot (a bare face) grants nothing.
 */
function grantOwnership(owned: string[], look: AvatarConfig): string[] {
  const set = new Set(owned);
  for (const category of CREATION_CATEGORIES) {
    const id = partOf(look, category);
    if (id) set.add(id);
  }
  return [...set];
}
