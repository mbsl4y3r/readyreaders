/**
 * Parent screen (behind the 2s long-press): a calm, grouped dashboard —
 * progress at a glance, two stepper controls (book marker + levels open),
 * what-to-practice and per-level fluency, then account actions. Panels and a
 * slate/gold palette keep it readable and tidy on the 1024×720 canvas.
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
import { allCosmeticIds } from '../avatar/catalog';
import { GAME_W, GAME_H, readingText, makeButton } from '../ui/kit';

/** Parent-facing names for the mastery ladder (see engine/adaptive.ts). */
const MASTERY_LABELS = ['learning', 'known', 'quick', 'automatic'] as const;

// cohesive palette for the grown-up screen
const BG = 0x1b2531;
const PANEL = 0x26333f;
const PANEL_LINE = 0x3d4f61;
const SLATE = 0x3a4d63;
const SLATE_TXT = '#eaf1f8';
const GOLD = 0xffe9a8;
const MUTED = '#9fb0bf';
const EYEBROW = '#ffd27a';

// two-column geometry
const M = 36;
const COL_W = 464;
const LX = M;
const RX = 524;
const LC = LX + COL_W / 2; // left column centre
const RC = RX + COL_W / 2; // right column centre

export class ParentScene extends Phaser.Scene {
  constructor() {
    super('parent');
  }

  create(): void {
    const cx = GAME_W / 2;
    this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, BG, 1);

    const progress = loadProgress();

    readingText(this, cx, 36, 'Parent corner', 30, '#ffe9a8');

    const musicBtn = makeButton(
      this,
      GAME_W - 58,
      38,
      progress.settings.musicOn ? '🎵' : '🔇',
      () => {
        const p = loadProgress();
        p.settings.musicOn = !p.settings.musicOn;
        saveProgress(p);
        setMusicEnabled(p.settings.musicOn);
        musicBtn.label.setText(p.settings.musicOn ? '🎵' : '🔇');
      },
      { emoji: true, fontSize: 22, width: 56, height: 50, fill: SLATE },
    );
    musicBtn.setAlpha(0.95);

    // ---- stats strip ----
    const wordStats = Object.entries(progress.words).filter(([k]) => !k.includes(':'));
    const mastered = wordStats.filter(([, s]) => s.mastery >= 2).length;
    const automatic = wordStats.filter(([, s]) => s.mastery === 3).length;
    const weekAgo = Date.now() - 7 * 86_400_000;
    const weekMin = progress.sessions
      .filter((s) => Date.parse(s.date) >= weekAgo)
      .reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    const best = progress.speedBest > 0 ? `${(progress.speedBest / 1000).toFixed(1)}s` : '—';
    this.panel(M, 64, GAME_W - 2 * M, 56);
    readingText(
      this,
      cx,
      92,
      `Words ${wordStats.length}   ·   quick ${mastered}   ·   automatic ${automatic}   ·   ${progress.sessions.length} sessions   ·   ${weekMin} min this week   ·   best ${best}`,
      18,
      '#cdd8e2',
    );

    // ---- control panels: book lesson + levels open (label top · stepper
    // middle · hint below, all clear of each other) ----
    this.panel(LX, 128, COL_W, 122);
    this.eyebrow(LX + 22, 152, 'BOOK LESSON');
    const focus = readingText(this, LC, 232, '', 16, MUTED);
    this.stepper(LC, 194, () => `${loadProgress().bookLesson}`, (d) => {
      const p = loadProgress();
      p.bookLesson = Math.min(120, Math.max(1, p.bookLesson + d));
      saveProgress(p);
      focus.setText(this.lessonFocus(p.bookLesson));
    });
    focus.setText(this.lessonFocus(progress.bookLesson));

    this.panel(RX, 128, COL_W, 122);
    this.eyebrow(RX + 22, 152, 'LEVELS OPEN');
    readingText(this, RC, 232, 'unlock map stops', 16, MUTED);
    this.stepper(RC, 194, () => `1–${loadProgress().currentLevel} of 9`, (d) => {
      const p = loadProgress();
      p.currentLevel = Math.min(9, Math.max(1, p.currentLevel + d));
      saveProgress(p);
    });

    // ---- info panels: needs practice + level mastery ----
    this.panel(LX, 264, COL_W, 182);
    this.eyebrow(LX + 22, 290, 'NEEDS PRACTICE');
    const weakest = wordStats
      .filter(([, s]) => s.exposures > 0)
      .sort(([, a], [, b]) => a.mastery - b.mastery || b.ema - a.ema)
      .slice(0, 5);
    if (weakest.length === 0) {
      readingText(this, LX + 22, 326, 'No words practiced yet', 19, MUTED).setOrigin(0, 0.5);
    } else {
      const wordText = new Map(WORDS.map((w) => [w.id, w.text]));
      weakest.forEach(([id, s], i) => {
        readingText(this, LX + 22, 322 + i * 26, wordText.get(id) ?? id, 19, '#ffffff').setOrigin(0, 0.5);
        readingText(this, LX + COL_W - 22, 322 + i * 26, MASTERY_LABELS[s.mastery], 17, MUTED).setOrigin(1, 0.5);
      });
    }

    this.panel(RX, 264, COL_W, 182);
    this.eyebrow(RX + 22, 290, 'LEVEL MASTERY  (quick or faster)');
    const shownLevels = Math.min(progress.currentLevel, 9);
    for (let n = 1; n <= shownLevels; n++) {
      const pool = wordsForLevel(n, progress.bookLesson);
      const quick = pool.filter((w) => (progress.words[w.id]?.mastery ?? 0) >= 2).length;
      const pct = pool.length ? Math.round((quick / pool.length) * 100) : 0;
      const y = 320 + (n - 1) * 14.5;
      readingText(this, RX + 22, y, `Level ${n}`, 16, '#ffffff').setOrigin(0, 0.5);
      readingText(this, RX + COL_W - 22, y, `${quick}/${pool.length}  ·  ${pct}%`, 16, MUTED).setOrigin(1, 0.5);
    }

    // ---- account actions ----
    const wide = COL_W;
    this.action(LC, 482, wide, 'Export progress', SLATE, SLATE_TXT, () => {
      const code = exportCode(loadProgress());
      void navigator.clipboard?.writeText(code).catch(() => {});
      window.prompt('Progress code (copied to clipboard — save it somewhere safe):', code);
    });
    this.action(RC, 482, wide, 'Import progress', SLATE, SLATE_TXT, () => {
      const code = window.prompt('Paste the progress code:');
      if (!code) return;
      const data = importCode(code);
      if (data) {
        saveProgress(data);
        this.scene.restart();
      } else {
        window.alert("That code didn't work — check it and try again.");
      }
    });
    this.action(LC, 552, wide, 'Placement voyage ⛵', SLATE, SLATE_TXT, () =>
      this.scene.start('voyage', { fromParent: true }),
    );
    this.action(RC, 552, wide, 'Reset all progress', 0x8f4a54, '#ffe1e1', () => {
      if (window.confirm('Really erase ALL of Evie’s progress? This cannot be undone.')) {
        resetProgress();
        this.scene.restart();
      }
    });

    makeButton(this, cx, 628, '← Back to the map', () => this.scene.start('map'), {
      fontSize: 24,
      height: 56,
      width: 360,
      fill: GOLD,
    });

    // discreet debug unlock (beta testing) — password gated
    makeButton(this, 40, 692, '🐞', () => this.debugUnlock(), {
      emoji: true,
      fontSize: 20,
      width: 52,
      height: 42,
      fill: 0x2b3644,
    }).setAlpha(0.5);
  }

  /** Rounded section panel with a subtle border. */
  private panel(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(PANEL, 1);
    g.fillRoundedRect(x, y, w, h, 16);
    g.lineStyle(1.5, PANEL_LINE, 1);
    g.strokeRoundedRect(x, y, w, h, 16);
  }

  /** Small left-aligned section label. */
  private eyebrow(x: number, y: number, text: string): void {
    readingText(this, x, y, text, 15, EYEBROW).setOrigin(0, 0.5);
  }

  /** Centred "[−] value [+]" control with the value clear of both buttons. */
  private stepper(cx: number, y: number, value: () => string, onDelta: (d: number) => void): void {
    const val = readingText(this, cx, y, value(), 30, '#ffffff');
    makeButton(this, cx - 118, y, '−', () => { onDelta(-1); val.setText(value()); }, {
      width: 54,
      height: 54,
      fontSize: 36,
      fill: SLATE,
      textColor: SLATE_TXT,
    });
    makeButton(this, cx + 118, y, '+', () => { onDelta(1); val.setText(value()); }, {
      width: 54,
      height: 54,
      fontSize: 36,
      fill: SLATE,
      textColor: SLATE_TXT,
    });
  }

  /** A full-width account button in the shared style. */
  private action(
    cx: number,
    y: number,
    w: number,
    label: string,
    fill: number,
    textColor: string,
    onTap: () => void,
  ): void {
    makeButton(this, cx, y, label, onTap, { fontSize: 22, height: 54, width: w, fill, textColor });
  }

  /** Password 'bingo' opens every asset + mode for beta testing. */
  private debugUnlock(): void {
    const pw = window.prompt('Debug password:');
    if (pw === null) return;
    if (pw.trim().toLowerCase() !== 'bingo') {
      window.alert('Nope.');
      return;
    }
    const p = loadProgress();
    p.created = true;
    p.placed = true;
    p.currentLevel = 9; // every map stop open
    p.bookLesson = 120; // all content decodable/available
    p.pearls = 9999;
    p.cosmetics = allCosmeticIds(); // own everything in the wardrobe
    saveProgress(p);
    window.alert('Debug mode on — all levels, stories, and wardrobe items unlocked. 🐞');
    this.scene.start('map');
  }

  /** Short focus hint for a book lesson, truncated so it never runs long. */
  private lessonFocus(n: number): string {
    const label = LESSONS[n - 1]?.label ?? '';
    const short = label.length > 40 ? label.slice(0, 38) + '…' : label;
    return short ? `focus: ${short}` : '';
  }
}
