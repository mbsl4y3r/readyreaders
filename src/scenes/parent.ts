/**
 * Parent screen (behind the 2s long-press): book-lesson marker, quick stats,
 * progress export/import, reset. Plain and text-y on purpose — it's for the
 * grown-up.
 */
import Phaser from 'phaser';
import { LESSONS } from '../content/lessons';
import {
  loadProgress,
  saveProgress,
  resetProgress,
  exportCode,
  importCode,
} from '../services/progress';
import { GAME_W, GAME_H, readingText, makeButton } from '../ui/kit';

export class ParentScene extends Phaser.Scene {
  constructor() {
    super('parent');
  }

  create(): void {
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x1d2733, 1);
    readingText(this, GAME_W / 2, 60, 'Parent corner', 40, '#ffe9a8');

    const progress = loadProgress();
    const wordStats = Object.entries(progress.words).filter(([k]) => !k.startsWith('sent:'));
    const mastered = wordStats.filter(([, s]) => s.mastery >= 2).length;
    const automatic = wordStats.filter(([, s]) => s.mastery === 3).length;

    readingText(
      this,
      GAME_W / 2,
      130,
      `Words practiced: ${wordStats.length} · quick: ${mastered} · automatic: ${automatic}`,
      26,
      '#ffffffcc',
    );
    readingText(this, GAME_W / 2, 175, `Sessions played: ${progress.sessions.length}`, 26, '#ffffffcc');

    // --- book lesson marker ---
    const lesson = LESSONS[progress.bookLesson - 1];
    const markerLabel = readingText(
      this,
      GAME_W / 2,
      265,
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
    makeButton(this, GAME_W / 2 - 300, 265, '−', () => bump(-1), { width: 90, height: 76, fontSize: 44 });
    makeButton(this, GAME_W / 2 + 300, 265, '+', () => bump(1), { width: 90, height: 76, fontSize: 44 });

    // --- export / import ---
    makeButton(
      this,
      GAME_W / 2 - 180,
      380,
      "Export Evie's progress",
      () => {
        const code = exportCode(loadProgress());
        void navigator.clipboard?.writeText(code).catch(() => {});
        window.prompt('Progress code (copied to clipboard — save it somewhere safe):', code);
      },
      { fontSize: 24, height: 76, width: 330 },
    );
    makeButton(
      this,
      GAME_W / 2 + 180,
      380,
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
      { fontSize: 24, height: 76, width: 300 },
    );

    // --- reset (double confirm) ---
    makeButton(
      this,
      GAME_W / 2,
      490,
      'Reset all progress',
      () => {
        if (window.confirm('Really erase ALL of Evie’s progress? This cannot be undone.')) {
          resetProgress();
          this.scene.restart();
        }
      },
      { fontSize: 24, height: 72, width: 320, fill: 0xf4a6a6 },
    );

    makeButton(this, GAME_W / 2, GAME_H - 100, '← Back to the map', () => this.scene.start('map'), {
      fontSize: 28,
      height: 80,
      fill: 0xffe9a8,
    });
  }

  private markerText(n: number, label: string): string {
    return `Book lesson: ${n}  (${label})`;
  }
}
