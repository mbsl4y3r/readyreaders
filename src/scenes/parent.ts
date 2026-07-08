/**
 * Parent screen (behind the 2s long-press): book-lesson marker, quick stats,
 * weakest-words and per-level mastery readouts, progress export/import, reset.
 * Plain and text-y on purpose — it's for the grown-up. Two columns keep the
 * denser readouts clear of the button rows on the 1024×720 canvas.
 */
import Phaser from 'phaser';
import { LESSONS } from '../content/lessons';
import { WORDS } from '../content/words';
import { wordsForLevel } from '../engine/session-planner';
import {
  loadProgress,
  saveProgress,
  resetProgress,
  exportCode,
  importCode,
} from '../services/progress';
import { setMusicEnabled } from '../services/audio';
import { GAME_W, GAME_H, readingText, makeButton } from '../ui/kit';

/** Parent-facing names for the mastery ladder (see engine/adaptive.ts). */
const MASTERY_LABELS = ['learning', 'known', 'quick', 'automatic'] as const;

export class ParentScene extends Phaser.Scene {
  constructor() {
    super('parent');
  }

  create(): void {
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x1d2733, 1);
    readingText(this, GAME_W / 2, 40, 'Parent corner', 36, '#ffe9a8');

    const progress = loadProgress();

    // music toggle — the only sound switch in the house
    const musicBtn = makeButton(
      this,
      GAME_W - 80,
      52,
      progress.settings.musicOn ? '🎵' : '🔇',
      () => {
        const p = loadProgress();
        p.settings.musicOn = !p.settings.musicOn;
        saveProgress(p);
        setMusicEnabled(p.settings.musicOn);
        musicBtn.label.setText(p.settings.musicOn ? '🎵' : '🔇');
      },
      { emoji: true, fontSize: 28, width: 76, height: 64, fill: 0xffffff },
    );
    musicBtn.setAlpha(0.9);
    // sentence + phrase stats share the words map under ':'-prefixed keys —
    // keep every word number on this screen honest by skipping them
    const wordStats = Object.entries(progress.words).filter(([k]) => !k.includes(':'));
    const mastered = wordStats.filter(([, s]) => s.mastery >= 2).length;
    const automatic = wordStats.filter(([, s]) => s.mastery === 3).length;

    readingText(
      this,
      GAME_W / 2,
      84,
      `Words practiced: ${wordStats.length} · quick: ${mastered} · automatic: ${automatic}`,
      24,
      '#ffffffcc',
    );

    // this week = rolling 7 days; minutes only exist on newer session records
    const weekAgo = Date.now() - 7 * 86_400_000;
    const week = progress.sessions.filter((s) => Date.parse(s.date) >= weekAgo);
    const weekMin = week.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    const best = progress.speedBest > 0 ? `${(progress.speedBest / 1000).toFixed(1)}s` : '—';
    readingText(
      this,
      GAME_W / 2,
      116,
      `Sessions: ${progress.sessions.length} · this week: ${week.length} (${weekMin} min) · Lightning best: ${best}`,
      22,
      '#ffffffcc',
    );

    // --- book lesson marker ---
    const lesson = LESSONS[progress.bookLesson - 1];
    const markerLabel = readingText(
      this,
      GAME_W / 2,
      172,
      this.markerText(progress.bookLesson, lesson?.label ?? ''),
      30,
      '#ffffff',
    );
    const bump = (delta: number) => {
      const p = loadProgress();
      p.bookLesson = Math.min(120, Math.max(1, p.bookLesson + delta));
      saveProgress(p);
      const l = LESSONS[p.bookLesson - 1];
      markerLabel.setText(this.markerText(p.bookLesson, l?.label ?? ''));
    };
    makeButton(this, GAME_W / 2 - 300, 172, '−', () => bump(-1), { width: 90, height: 72, fontSize: 44 });
    makeButton(this, GAME_W / 2 + 300, 172, '+', () => bump(1), { width: 90, height: 72, fontSize: 44 });

    // --- left column: what to practice at the kitchen table tonight ---
    const leftX = 70;
    readingText(this, leftX, 220, 'Needs practice', 24, '#ffe9a8').setOrigin(0, 0.5);
    const weakest = wordStats
      .filter(([, s]) => s.exposures > 0)
      .sort(([, a], [, b]) => a.mastery - b.mastery || b.ema - a.ema)
      .slice(0, 5);
    if (weakest.length === 0) {
      readingText(this, leftX, 256, 'No words practiced yet', 22, '#ffffff99').setOrigin(0, 0.5);
    } else {
      const wordText = new Map(WORDS.map((w) => [w.id, w.text]));
      weakest.forEach(([id, s], i) => {
        readingText(
          this,
          leftX,
          256 + i * 34,
          `${wordText.get(id) ?? id} — ${MASTERY_LABELS[s.mastery]}`,
          22,
          '#ffffff',
        ).setOrigin(0, 0.5);
      });
    }

    // --- right column: per-level fluency coverage against the book marker ---
    const rightX = 544;
    readingText(this, rightX, 220, 'Level mastery (quick or faster)', 24, '#ffe9a8').setOrigin(0, 0.5);
    // 9 rows is both every possible level and exactly what fits above the buttons
    for (let n = 1; n <= Math.min(progress.currentLevel, 9); n++) {
      const pool = wordsForLevel(n, progress.bookLesson);
      const quick = pool.filter((w) => (progress.words[w.id]?.mastery ?? 0) >= 2).length;
      readingText(this, rightX, 256 + (n - 1) * 26, `L${n}: ${quick}/${pool.length} quick+`, 20, '#ffffff').setOrigin(
        0,
        0.5,
      );
    }

    // --- export / import ---
    makeButton(
      this,
      GAME_W / 2 - 250,
      516,
      "Export Evie's progress",
      () => {
        const code = exportCode(loadProgress());
        void navigator.clipboard?.writeText(code).catch(() => {});
        window.prompt('Progress code (copied to clipboard — save it somewhere safe):', code);
      },
      { fontSize: 24, height: 72, width: 340 },
    );
    makeButton(
      this,
      GAME_W / 2 + 250,
      516,
      'Import progress',
      () => {
        const code = window.prompt('Paste the progress code:');
        if (!code) return;
        const data = importCode(code);
        if (data) {
          saveProgress(data);
          this.scene.restart();
        } else {
          window.alert("That code didn't work — check it and try again.");
        }
      },
      { fontSize: 24, height: 72, width: 300 },
    );

    // --- placement voyage (re-runnable from here without touching the save) ---
    makeButton(
      this,
      GAME_W / 2 - 250,
      596,
      'Placement voyage ⛵',
      () => this.scene.start('voyage', { fromParent: true }),
      { fontSize: 24, height: 72, width: 340 },
    );

    // --- reset (double confirm) ---
    makeButton(
      this,
      GAME_W / 2 + 250,
      596,
      'Reset all progress',
      () => {
        if (window.confirm('Really erase ALL of Evie’s progress? This cannot be undone.')) {
          resetProgress();
          this.scene.restart();
        }
      },
      { fontSize: 24, height: 72, width: 320, fill: 0xf4a6a6 },
    );

    makeButton(this, GAME_W / 2, 676, '← Back to the map', () => this.scene.start('map'), {
      fontSize: 26,
      height: 72,
      fill: 0xffe9a8,
    });
  }

  private markerText(n: number, label: string): string {
    return `Book lesson: ${n}  (${label})`;
  }
}
