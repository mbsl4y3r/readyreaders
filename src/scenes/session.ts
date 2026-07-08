/**
 * Runs one chunk (~8 rounds) for a level: plans the queue, mounts each
 * mini-game in turn, records results into progress, then celebrates with a
 * collectible. No fail states anywhere — every exit from here is a win.
 */
import Phaser from 'phaser';
import { LEVELS } from '../content/levels';
import { THEMES } from '../content/themes';
import { planSession, wordsForLevel, phraseStatKey } from '../engine/session-planner';
import type { RoundSpec, RoundResult } from '../engine/rounds';
import { updateStat } from '../engine/adaptive';
import { loadProgress, saveProgress, statFor } from '../services/progress';
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
  /** False once the scene shuts down (home button) — stops the round loop. */
  private alive = true;
  /** Wall-clock start of this chunk — celebrate() logs real minutes played. */
  private startedAt = 0;

  constructor() {
    super('session');
  }

  init(data: { levelId?: number }): void {
    this.levelId = data.levelId ?? 1;
  }

  create(): void {
    this.alive = true;
    this.startedAt = Date.now();
    this.events.once('shutdown', () => (this.alive = false));
    const level = LEVELS.find((l) => l.id === this.levelId)!;
    const theme = THEMES[level.realm];
    drawRealmBackground(this, theme.bgTop, theme.bgBottom, theme.ambient);
    this.cameras.main.fadeIn(300);
    playMusic(level.realm); // each realm has its own track (drop-in, optional)

    // home button — she can always leave, mid-session exits are fine
    const home = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    });
    home.setAlpha(0.85);

    void this.runChunk(level.id, theme);
  }

  private async runChunk(levelId: number, theme: (typeof THEMES)['cove']): Promise<void> {
    const progress = loadProgress();
    const rounds = planSession(levelId, progress);

    // progress pips
    const pips = rounds.map((_, i) =>
      this.add
        .circle(GAME_W / 2 + (i - (rounds.length - 1) / 2) * 34, 52, 10, 0xffffff, 0.25)
        .setStrokeStyle(2, 0xffffff, 0.5),
    );

    void speakUI('lets-read', "Let's read!");

    for (let i = 0; i < rounds.length; i++) {
      const spec = rounds[i]!;
      if (!this.alive) return; // she tapped home
      const result = await RUNNERS[spec.mechanic](this, spec, { theme });
      if (!this.alive) return;
      pips[i]?.setFillStyle(0xffe9a8, 1);
      this.recordResult(spec, result);
    }

    this.celebrate(levelId, theme);
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

  private celebrate(levelId: number, theme: (typeof THEMES)['cove']): void {
    const progress = loadProgress();

    // award a not-yet-collected collectible from this realm
    const owned = new Set(progress.collections[theme.collectionKey]);
    const prize = theme.collectibles.find((e) => !owned.has(e)) ?? theme.collectibles[0]!;
    if (!owned.has(prize)) progress.collections[theme.collectionKey].push(prize);

    // unlock the next level when ≥80% of this level's words are mastery ≥2
    const levelWords = wordsForLevel(levelId, progress.bookLesson);
    const quick = levelWords.filter((w) => (progress.words[w.id]?.mastery ?? 0) >= 2).length;
    if (
      levelWords.length > 0 &&
      quick / levelWords.length >= 0.8 &&
      progress.currentLevel === levelId &&
      levelId < 9
    ) {
      progress.currentLevel = levelId + 1;
    }
    progress.sessions.push({
      date: new Date().toISOString().slice(0, 10),
      rounds: 8,
      minutes: Math.max(1, Math.round((Date.now() - this.startedAt) / 60_000)),
    });
    progress.pearls += PEARLS_PER_SESSION; // reading is the only pearl faucet
    saveProgress(progress);

    chime('fanfare');
    const dim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.45);
    const big = emojiText(this, GAME_W / 2, GAME_H / 2 - 70, prize, 150);
    popIn(this, big);
    const label = readingText(this, GAME_W / 2, GAME_H / 2 + 60, 'You did it!', 52, '#ffe9a8');
    popIn(this, label, 200);
    confettiBurst(this, GAME_W / 2, GAME_H / 2 - 100, theme.accent);
    void speakUI('celebrate', `You did it! A new treasure for your collection!`);

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
  }
}
