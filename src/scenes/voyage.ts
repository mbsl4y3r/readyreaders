/**
 * The Placement Voyage: parent + kid sail a boat to the lesson Evie is on
 * in her physical book. Runs on first launch (progress.placed is false) and
 * on demand from the parent corner. The book-lesson frontier set here gates
 * ALL game content, so the scene makes the stakes visible: the boat shows
 * where the journey stands, the unlock line shows exactly which levels open.
 */
import Phaser from 'phaser';
import { LESSONS } from '../content/lessons';
import { LEVELS } from '../content/levels';
import { THEMES } from '../content/themes';
import type { RealmId } from '../content/types';
import { BOOK_LOOKAHEAD } from '../engine/session-planner';
import { chime, speakUI } from '../services/audio';
import { loadProgress, saveProgress } from '../services/progress';
import {
  GAME_W,
  readingText,
  emojiText,
  makeButton,
  drawRealmBackground,
  confettiBurst,
  wiggle,
} from '../ui/kit';
import type { Button } from '../ui/kit';

const TRACK_W = 800;
const TRACK_X = (GAME_W - TRACK_W) / 2;
const TRACK_Y = 415;
const TRACK_H = 64;

/** Warm starlight gold for the second-lap stretch — no single realm owns it. */
const FAR_SEAS_FILL = 0xffd166;

interface VoyageZone {
  from: number;
  to: number;
  fill: number;
  emoji: string;
}

/**
 * Fold LEVELS into voyage zones: consecutive first-lap levels sharing a realm
 * merge into one zone, and the moment a realm comes around AGAIN the map is
 * on its second lap — everything from there reads as one starry 'far seas'
 * stretch. Derived from LEVELS (not hardcoded) so the track stays honest if
 * the lesson grouping ever shifts.
 */
function buildZones(): VoyageZone[] {
  const zones: VoyageZone[] = [];
  const seen = new Set<RealmId>();
  let lastRealm: RealmId | 'far' | null = null;
  for (const level of LEVELS) {
    const [from, to] = level.lessonRange;
    if (lastRealm === 'far' || lastRealm === level.realm) {
      zones[zones.length - 1]!.to = to;
    } else if (seen.has(level.realm)) {
      zones.push({ from, to, fill: FAR_SEAS_FILL, emoji: '✨' });
      lastRealm = 'far';
    } else {
      seen.add(level.realm);
      const theme = THEMES[level.realm];
      zones.push({ from, to, fill: theme.accent, emoji: theme.creature });
      lastRealm = level.realm;
    }
  }
  return zones;
}

export class VoyageScene extends Phaser.Scene {
  private fromParent = false;
  private lesson = 17;
  private boat!: Phaser.GameObjects.Text;
  private glide: Phaser.Tweens.Tween | null = null;
  private numberText!: Phaser.GameObjects.Text;
  private labelText!: Phaser.GameObjects.Text;
  private unlockLine!: Phaser.GameObjects.Text;
  private buttons: Button[] = [];

  constructor() {
    super('voyage');
  }

  init(data: { fromParent?: boolean }): void {
    this.fromParent = data?.fromParent ?? false;
  }

  create(): void {
    const cove = THEMES.cove;
    drawRealmBackground(this, cove.bgTop, cove.bgBottom, ['🫧', '⛅', '🐟']);
    this.cameras.main.fadeIn(300);
    this.buttons = [];

    this.lesson = loadProgress().bookLesson;

    readingText(this, GAME_W / 2, 64, 'The Placement Voyage ⛵', 40, '#ffe9a8');
    readingText(this, GAME_W / 2, 116, 'Sail to the lesson Evie is on in her book.', 26, '#ffffffcc');

    // big current-lesson readout: the number is the thing being chosen,
    // so it gets the largest type on the screen
    this.numberText = readingText(this, GAME_W / 2, 212, `${this.lesson}`, 72, '#ffffff');
    this.labelText = readingText(
      this,
      GAME_W / 2,
      278,
      LESSONS[this.lesson - 1]?.label ?? '',
      28,
      '#ffffffcc',
    );
    this.unlockLine = readingText(this, GAME_W / 2, 326, this.describeUnlocks(), 24, '#ffe9a8');

    // voyage track: realm zones sized by their share of the 120 lessons
    const track = this.add.graphics();
    for (const zone of buildZones()) {
      const x = TRACK_X + ((zone.from - 1) / LESSONS.length) * TRACK_W;
      const w = ((zone.to - zone.from + 1) / LESSONS.length) * TRACK_W;
      track.fillStyle(zone.fill, 0.25);
      track.fillRoundedRect(x + 2, TRACK_Y, w - 4, TRACK_H, 14);
      emojiText(this, x + w / 2, TRACK_Y + TRACK_H / 2, zone.emoji, 36).setAlpha(0.9);
    }
    readingText(this, TRACK_X + 8, TRACK_Y + TRACK_H + 22, '1', 20, '#ffffff88');
    readingText(this, TRACK_X + TRACK_W - 14, TRACK_Y + TRACK_H + 22, '120', 20, '#ffffff88');

    this.boat = emojiText(this, this.boatX(this.lesson), TRACK_Y - 28, '⛵', 56);
    // idle bob keeps the sea alive even when nobody is pressing buttons
    this.tweens.add({
      targets: this.boat,
      y: this.boat.y - 8,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const steps: [string, number][] = [
      ['−5', -5],
      ['−1', -1],
      ['+1', 1],
      ['+5', 5],
    ];
    steps.forEach(([label, delta], i) => {
      this.buttons.push(
        makeButton(this, GAME_W / 2 + (i - 1.5) * 160, 565, label, () => this.nudge(delta), {
          width: 120,
          height: 84,
          fontSize: 40,
        }),
      );
    });

    this.buttons.push(
      makeButton(this, GAME_W / 2, 660, '⚓ Drop anchor!', () => this.dropAnchor(), {
        fontSize: 32,
        height: 88,
        fill: 0xffe9a8,
      }),
    );

    if (this.fromParent) {
      // the parent corner sent us here on demand — leaving must not save
      this.buttons.push(
        makeButton(this, 96, 52, '← Back', () => this.scene.start('parent'), { fontSize: 24 }),
      );
    }
  }

  /** Track x for a lesson — centre of its slice, so the boat never overhangs the ends. */
  private boatX(lesson: number): number {
    return TRACK_X + ((lesson - 0.5) / LESSONS.length) * TRACK_W;
  }

  /** Which game levels this placement opens (the planner peeks BOOK_LOOKAHEAD ahead). */
  private describeUnlocks(): string {
    const open = LEVELS.filter((l) => l.lessonRange[0] <= this.lesson + BOOK_LOOKAHEAD);
    const lo = open[0]!.id;
    const hi = open[open.length - 1]!.id;
    return lo === hi ? `Opens level ${lo}` : `Opens levels ${lo}–${hi}`;
  }

  private nudge(delta: number): void {
    const next = Math.min(LESSONS.length, Math.max(1, this.lesson + delta));
    if (next === this.lesson) {
      // already at the edge — no fail state, just a friendly nudge back
      wiggle(this, this.numberText);
      return;
    }
    this.lesson = next;
    this.numberText.setText(`${next}`);
    this.labelText.setText(LESSONS[next - 1]?.label ?? '');
    this.unlockLine.setText(this.describeUnlocks());
    // replace (not stack) the glide so rapid taps land exactly once
    this.glide?.remove();
    this.glide = this.tweens.add({
      targets: this.boat,
      x: this.boatX(next),
      duration: 250,
      ease: 'Sine.easeOut',
    });
    chime('gentle');
  }

  private dropAnchor(): void {
    // one decisive save: the frontier that gates all content, plus the flag
    // that stops the game from routing back here on the next launch
    const progress = loadProgress();
    progress.bookLesson = this.lesson;
    progress.placed = true;
    saveProgress(progress);

    this.buttons.forEach((b) => b.setEnabled(false));
    confettiBurst(this, GAME_W / 2, 660, THEMES.cove.accent);
    void speakUI('voyage-anchor', 'Anchors away! Your reading adventure starts here!');
    this.time.delayedCall(1100, () => this.cameras.main.fadeOut(400));
    this.time.delayedCall(1500, () => this.scene.start('map'));
  }
}
