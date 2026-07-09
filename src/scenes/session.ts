/**
 * Runs one chunk (~8 rounds) for a level: plans the queue, mounts each
 * mini-game in turn, records results into progress, then celebrates with a
 * collectible. No fail states anywhere — every exit from here is a win.
 */
import Phaser from 'phaser';
import { LEVELS } from '../content/levels';
import { THEMES } from '../content/themes';
import { regionForLesson, baseRealmFor, themeForRegion } from '../content/regions';
import {
  planSession,
  planReview,
  planLesson,
  planCheckoutRetry,
  phraseStatKey,
} from '../engine/session-planner';
import { evaluateCheckout, passLesson, FREE_PASS_THROUGH } from '../services/road';
import type { RoundSpec, RoundResult } from '../engine/rounds';
import { updateStat } from '../engine/adaptive';
import { newlyEarned } from '../engine/achievements';
import { loadProgress, saveProgress, statFor } from '../services/progress';
import { WORDS_BY_ID } from '../content/words';
import {
  recordReadingDay,
  addInkyXp,
  inkyTitle,
  newlyEarnedStickers,
  INKY_XP_PER_SESSION,
} from '../services/juice';
import { PEARLS_PER_SESSION, PEARLS_SPEED_BEST } from '../avatar/catalog';
import { speakUI, chime, playMusic } from '../services/audio';
import { runFeedCreature } from '../games/feed-creature';
import { runBuildWord } from '../games/build-word';
import { runSentencePicture } from '../games/sentence-picture';
import { runMagicPhrase } from '../games/magic-phrase';
import { runMemoryWord } from '../games/memory-word';
import { runSpeedRound } from '../games/speed-round';
import { runFamilySort } from '../games/family-sort';
import type { RunRound } from '../games/types';
import {
  GAME_W,
  GAME_H,
  readingText,
  emojiText,
  drawRealmBackground,
  makeButton,
  confettiBurst,
  popIn,
  badgeToast,
} from '../ui/kit';

const RUNNERS: Record<RoundSpec['mechanic'], RunRound> = {
  'feed-creature': runFeedCreature,
  'build-word': runBuildWord,
  'sentence-picture': runSentencePicture,
  'magic-phrase': runMagicPhrase,
  'memory-word': runMemoryWord,
  'speed-round': runSpeedRound,
  'family-sort': runFamilySort,
};

export class SessionScene extends Phaser.Scene {
  private levelId = 1;
  /** The Reading Road lesson this session teaches (0 = legacy/review mode). */
  private lesson = 0;
  /** Review mode: reinforce already-seen words, no new material, no unlock. */
  private review = false;
  /** False once the scene shuts down (home button) — stops the round loop. */
  private alive = true;
  /** Wall-clock start of this chunk — celebrate() logs real minutes played. */
  private startedAt = 0;

  constructor() {
    super('session');
  }

  init(data: { lesson?: number; levelId?: number; review?: boolean }): void {
    this.review = data.review ?? false;
    this.lesson = this.review ? 0 : data.lesson ?? 0;
    // a review spans everything she's learned; anchor its look to the frontier
    this.levelId = data.levelId ?? (this.review ? loadProgress().currentLevel : 1);
  }

  create(): void {
    this.alive = true;
    this.startedAt = Date.now();
    this.events.once('shutdown', () => (this.alive = false));
    const theme = this.lesson
      ? themeForRegion(regionForLesson(this.lesson))
      : THEMES[LEVELS.find((l) => l.id === this.levelId)!.realm];
    drawRealmBackground(this, theme.bgTop, theme.bgBottom, theme.ambient);
    this.cameras.main.fadeIn(300);
    // each base realm has its own track (drop-in, optional)
    playMusic(this.lesson ? baseRealmFor(regionForLesson(this.lesson)) : theme.id);

    // home button — she can always leave, mid-session exits are fine
    const home = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    });
    home.setAlpha(0.85);

    if (this.lesson) {
      readingText(this, GAME_W / 2, 96, `Lesson ${this.lesson}`, 22, '#ffffff').setAlpha(0.7);
    }

    void this.runChunk(theme);
  }

  private async runChunk(theme: (typeof THEMES)['cove']): Promise<void> {
    const progress = loadProgress();
    const rounds = this.lesson
      ? planLesson(this.lesson, progress)
      : this.review
        ? planReview(progress)
        : planSession(this.levelId, progress);

    // progress pips (the retry extension redraws its own smaller row)
    let pips = rounds.map((_, i) =>
      this.add
        .circle(GAME_W / 2 + (i - (rounds.length - 1) / 2) * 34, 52, 10, 0xffffff, 0.25)
        .setStrokeStyle(2, 0xffffff, 0.5),
    );

    const checkoutResults: { wordId: string; firstTry: boolean }[] = [];
    let bannered = false;
    let retried = false;

    for (let i = 0; i < rounds.length; i++) {
      const spec = rounds[i]!;
      if (!this.alive) return; // she tapped home
      if (spec.checkout && !bannered) {
        bannered = true;
        await this.checkoutBanner();
        if (!this.alive) return;
      }
      const result = await RUNNERS[spec.mechanic](this, spec, { theme });
      if (!this.alive) return;
      pips[i]?.setFillStyle(0xffe9a8, 1);
      this.recordResult(spec, result);
      if (spec.checkout && spec.wordId) {
        checkoutResults.push({ wordId: spec.wordId, firstTry: result.firstTry });
      }

      // end of the queue: in lesson mode, a missed check-out earns ONE gentle
      // same-session retry — re-drill the misses, then face a fresh gate
      if (i === rounds.length - 1 && this.lesson && !retried) {
        const verdict = evaluateCheckout(checkoutResults);
        if (!verdict.passed && verdict.missedIds.length > 0) {
          retried = true;
          checkoutResults.length = 0;
          bannered = false; // the retry gate announces itself again
          await this.retryBanner();
          if (!this.alive) return;
          const extra = planCheckoutRetry(this.lesson, verdict.missedIds, loadProgress());
          rounds.push(...extra);
          pips.forEach((p) => p.destroy());
          pips = rounds.map((_, j) =>
            this.add
              .circle(GAME_W / 2 + (j - (rounds.length - 1) / 2) * 26, 52, 8, 0xffffff, j <= i ? 1 : 0.25)
              .setStrokeStyle(2, 0xffffff, 0.5),
          );
        }
      }
    }

    this.celebrate(theme, this.lesson ? evaluateCheckout(checkoutResults) : null);
  }

  /** "Show what you know!" — a beat before the first check-out round. */
  private async checkoutBanner(): Promise<void> {
    chime('good');
    const note = readingText(this, GAME_W / 2, GAME_H / 2, 'Show what you know! ⭐', 44, '#ffe9a8');
    popIn(this, note);
    void speakUI('checkout-time', 'Check-out time! Show what you know!');
    await new Promise((r) => this.time.delayedCall(1600, r));
    note.destroy();
  }

  /** "Almost!" — a kind beat before the re-drill + fresh gate. */
  private async retryBanner(): Promise<void> {
    chime('gentle');
    const note = readingText(this, GAME_W / 2, GAME_H / 2, "Almost! Let's practice and try again!", 38, '#bfe9ff');
    note.setWordWrapWidth(GAME_W - 160);
    note.setAlign('center');
    popIn(this, note);
    void speakUI('checkout-almost', "Almost! Let's practice those tricky words and try again!");
    await new Promise((r) => this.time.delayedCall(1800, r));
    note.destroy();
  }

  private recordResult(spec: RoundSpec, result: RoundResult): void {
    const progress = loadProgress();
    if (spec.mechanic === 'speed-round') {
      // the lightning round is celebration, not assessment: no per-word
      // stats, just the personal best — and only from a clean, unassisted run
      if (!result.assisted && result.latencyMs > 0) {
        if (progress.speedBest === 0 || result.latencyMs < progress.speedBest) {
          progress.speedBest = result.latencyMs;
          progress.pearls += PEARLS_SPEED_BEST; // a new best earns bonus pearls
        }
      }
      saveProgress(progress);
      return;
    }
    if (spec.mechanic === 'family-sort') return; // pattern play — no stats
    // sentence and phrase stats live under prefixed keys so they never
    // collide with word ids — same stat machinery either way
    const key =
      spec.mechanic === 'sentence-picture'
        ? `sent:${result.itemId}`
        : spec.mechanic === 'magic-phrase'
          ? phraseStatKey(result.itemId)
          : result.itemId;
    const stat = statFor(progress, key);
    progress.words[key] = updateStat(stat, result);
    saveProgress(progress);
  }

  private celebrate(
    theme: (typeof THEMES)['cove'],
    checkout: ReturnType<typeof evaluateCheckout> | null,
  ): void {
    const progress = loadProgress();
    const passed = checkout?.passed ?? false;

    // a collectible marks a PASSED lesson (or a legacy session win); reviews
    // and not-yet passes shower a star so treasures stay tied to real progress
    const owned = new Set(progress.collections[theme.collectionKey]);
    const winsPrize = this.lesson ? passed : !this.review;
    const prize = winsPrize
      ? theme.collectibles.find((e) => !owned.has(e)) ?? theme.collectibles[0]!
      : '⭐';
    if (winsPrize && !owned.has(prize)) progress.collections[theme.collectionKey].push(prize);

    progress.sessions.push({
      date: new Date().toISOString().slice(0, 10),
      rounds: 8,
      minutes: Math.max(1, Math.round((Date.now() - this.startedAt) / 60_000)),
    });
    progress.pearls += PEARLS_PER_SESSION; // reading is the only pearl faucet

    // ---- the Reading Road: a passed check-out moves the marker; a miss
    // stores the words to re-drill so next session starts with them
    let pass: ReturnType<typeof passLesson> | null = null;
    if (this.lesson && checkout) {
      if (passed && this.lesson === progress.lesson) {
        pass = passLesson(progress);
      } else if (!passed) {
        progress.checkoutMisses = checkout.missedIds;
      }
    }
    // juice: advance the daily streak (pays a pearl bonus at milestones) and
    // feed pet Inky some XP — both are earned only by reading, like pearls
    const streak = this.review ? null : recordReadingDay(progress);
    const inky = addInkyXp(progress, INKY_XP_PER_SESSION);
    saveProgress(progress);

    chime('fanfare');
    const dim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.45);
    const big = emojiText(
      this,
      GAME_W / 2,
      GAME_H / 2 - 70,
      pass?.crossedInto ? pass.crossedInto.emoji : prize,
      150,
    );
    popIn(this, big);

    // headline + spoken line by outcome
    let headline = 'You did it!';
    if (this.review) headline = 'Great reviewing!';
    else if (pass?.finishedRoad) headline = 'You read the WHOLE book!';
    else if (pass?.crossedInto) headline = `Welcome to ${pass.crossedInto.name}!`;
    else if (pass) headline = `Lesson ${pass.passedLesson} — passed!`;
    else if (this.lesson && !passed) headline = 'Great practicing!';
    const label = readingText(this, GAME_W / 2, GAME_H / 2 + 60, headline, 44, '#ffe9a8');
    label.setWordWrapWidth(GAME_W - 120);
    label.setAlign('center');
    popIn(this, label, 200);
    confettiBurst(this, GAME_W / 2, GAME_H / 2 - 100, theme.accent);

    if (pass?.finishedRoad) {
      void speakUI('road-done', 'You read the whole book! You are a REAL reader now!');
    } else if (pass?.crossedInto) {
      void speakUI(
        `region-${pass.crossedInto.id}`,
        `You finished the whole region! Welcome to ${pass.crossedInto.name}!`,
      );
    } else if (pass) {
      void speakUI('checkout-pass', 'You passed your lesson! What amazing reading!');
    } else if (this.lesson && !passed) {
      void speakUI('checkout-keep-going', "Great practicing! We'll get those words next time!");
    } else {
      void speakUI(
        this.review ? 'review-done' : 'celebrate',
        this.review ? 'Great reviewing! Your reading is getting stronger!' : 'You did it! A new treasure for your collection!',
      );
    }

    // tell her plainly what comes next on the road
    let progressMsg = '';
    if (pass?.finishedRoad) progressMsg = '🎉 All 120 lessons — incredible!';
    else if (pass?.crossedInto) progressMsg = `A whole new land opens! ${pass.crossedInto.emoji}`;
    else if (pass) {
      progressMsg =
        pass.passedLesson < FREE_PASS_THROUGH
          ? `Lesson ${pass.passedLesson + 1} is ready right now! ⭐`
          : 'A new lesson opens tomorrow! 🌙';
    } else if (this.lesson && !passed && checkout) {
      const names = checkout.missedIds
        .map((id) => WORDS_BY_ID.get(id)?.text ?? id)
        .slice(0, 3)
        .join(', ');
      progressMsg = names ? `Next time we'll practice: ${names}` : 'So close — try again soon!';
    }
    if (progressMsg) {
      const sub = readingText(this, GAME_W / 2, GAME_H / 2 - 182, progressMsg, 30, pass ? '#ffe9a8' : '#bfe9ff');
      sub.setWordWrapWidth(GAME_W - 160);
      sub.setAlign('center');
      popIn(this, sub, 320);
    }

    // pearls earned by this reading — the wardrobe currency
    const pearl = this.add.circle(GAME_W / 2 - 52, GAME_H / 2 + 128, 13, 0xffffff, 1);
    pearl.setStrokeStyle(2, 0xd8e6ee, 1);
    const pearlShine = this.add.circle(GAME_W / 2 - 56, GAME_H / 2 + 123, 4, 0xffffff, 0.9);
    const earned = readingText(
      this,
      GAME_W / 2 + 26,
      GAME_H / 2 + 128,
      `+${PEARLS_PER_SESSION} pearls!`,
      34,
      '#ffffff',
    );
    [pearl, pearlShine, earned].forEach((o) => popIn(this, o, 450));

    const done = makeButton(
      this,
      GAME_W / 2,
      GAME_H - 120,
      '🗺️',
      () => this.scene.start('map'),
      { emoji: true, fontSize: 48, width: 140, height: 100, fill: 0xffe9a8 },
    );
    popIn(this, done, 600);

    this.awardRewards(progress, streak, inky);
  }

  /** Earn + celebrate freshly-unlocked badges, streak milestones, Inky level-ups, and stickers. */
  private awardRewards(
    progress: ReturnType<typeof loadProgress>,
    streak: ReturnType<typeof recordReadingDay> | null,
    inky: ReturnType<typeof addInkyXp>,
  ): void {
    const toasts: { emoji: string; label: string }[] = [];

    const freshBadges = newlyEarned(progress);
    freshBadges.forEach((b) => {
      progress.badges.push(b.id);
      toasts.push({ emoji: b.emoji, label: b.label });
    });
    if (streak?.milestone) toasts.push({ emoji: '🔥', label: `${streak.days}-day streak!` });
    if (inky.leveledUp) toasts.push({ emoji: '🐙', label: `${inkyTitle(inky.level)}!` });
    if (inky.gift) toasts.push({ emoji: '🎁', label: 'Inky got a treat!' });

    const freshStickers = newlyEarnedStickers(progress);
    freshStickers.forEach((s) => {
      progress.stickers.push(s.id);
      toasts.push({ emoji: s.emoji, label: 'New sticker!' });
    });

    saveProgress(progress);

    toasts.slice(0, 5).forEach((t, i) => {
      badgeToast(this, t.emoji, t.label, 900 + i * 1500);
      this.time.delayedCall(900 + i * 1500, () => this.alive && chime('good'));
    });
  }
}
