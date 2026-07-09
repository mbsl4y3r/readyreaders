/**
 * Parent screen (behind the 2s long-press): a calm, grouped dashboard —
 * progress at a glance, two stepper controls (book marker + levels open),
 * what-to-practice and per-level fluency, then account actions.
 *
 * The kid-facing makeButton enforces a big 72px minimum for little fingers;
 * this adult screen uses its own compact `chip` button so the controls stay
 * small and the layout breathes.
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
import { GAME_W, GAME_H, readingText, emojiText } from '../ui/kit';

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

interface ChipOpts {
  fill?: number;
  textColor?: string;
  emoji?: boolean;
  fontSize?: number;
}

export class ParentScene extends Phaser.Scene {
  constructor() {
    super('parent');
  }

  create(): void {
    const cx = GAME_W / 2;
    this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, BG, 1);

    const progress = loadProgress();

    readingText(this, cx, 36, 'Parent corner', 30, '#ffe9a8');

    const music = this.chip(GAME_W - 54, 38, 50, 46, progress.settings.musicOn ? '🎵' : '🔇', () => {
      const p = loadProgress();
      p.settings.musicOn = !p.settings.musicOn;
      saveProgress(p);
      setMusicEnabled(p.settings.musicOn);
      (music.list[1] as Phaser.GameObjects.Text).setText(p.settings.musicOn ? '🎵' : '🔇');
    }, { fill: SLATE, emoji: true, fontSize: 22 });

    // arcade game speed (adaptive difficulty): tap to cycle chill → normal → zippy
    type Speed = 'chill' | 'normal' | 'zippy';
    const speedIcon = (s: Speed): string => (s === 'chill' ? '🐌' : s === 'zippy' ? '⚡' : '🐇');
    const nextSpeed = (s: Speed): Speed =>
      s === 'chill' ? 'normal' : s === 'normal' ? 'zippy' : 'chill';
    const speed = this.chip(GAME_W - 116, 38, 50, 46, speedIcon(progress.settings.gameSpeed), () => {
      const p = loadProgress();
      p.settings.gameSpeed = nextSpeed(p.settings.gameSpeed);
      saveProgress(p);
      (speed.list[1] as Phaser.GameObjects.Text).setText(speedIcon(p.settings.gameSpeed));
    }, { fill: SLATE, emoji: true, fontSize: 22 });

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

    // ---- control panels: book lesson + levels open ----
    this.panel(LX, 128, COL_W, 122);
    this.eyebrow(LX + 22, 152, 'BOOK LESSON');
    const focus = readingText(this, LC, 232, '', 16, MUTED);
    this.stepper(LC, 192, () => `${loadProgress().bookLesson}`, (d) => {
      const p = loadProgress();
      p.bookLesson = Math.min(120, Math.max(1, p.bookLesson + d));
      saveProgress(p);
      focus.setText(this.lessonFocus(p.bookLesson));
    });
    focus.setText(this.lessonFocus(progress.bookLesson));

    this.panel(RX, 128, COL_W, 122);
    this.eyebrow(RX + 22, 152, 'LEVELS OPEN');
    readingText(this, RC, 232, 'unlock map stops', 16, MUTED);
    this.stepper(RC, 192, () => `1–${loadProgress().currentLevel} of 9`, (d) => {
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

    // ---- account actions: small chips, clearly separated rows ----
    const W = 360;
    const H = 44;
    this.chip(LC, 486, W, H, 'Export progress', () => {
      const code = exportCode(loadProgress());
      void navigator.clipboard?.writeText(code).catch(() => {});
      window.prompt('Progress code (copied to clipboard — save it somewhere safe):', code);
    }, { fill: SLATE, textColor: SLATE_TXT, fontSize: 20 });
    this.chip(RC, 486, W, H, 'Import progress', () => {
      const code = window.prompt('Paste the progress code:');
      if (!code) return;
      const data = importCode(code);
      if (data) {
        saveProgress(data);
        this.scene.restart();
      } else {
        window.alert("That code didn't work — check it and try again.");
      }
    }, { fill: SLATE, textColor: SLATE_TXT, fontSize: 20 });
    this.chip(LC, 548, W, H, 'Placement voyage ⛵', () => this.scene.start('voyage', { fromParent: true }), {
      fill: SLATE,
      textColor: SLATE_TXT,
      fontSize: 20,
    });
    this.chip(RC, 548, W, H, 'Reset all progress', () => {
      // a grown-up gate so little fingers can't wipe the save
      const ans = window.prompt('To erase ALL progress, answer: what year was the USA founded?');
      if (ans === null) return;
      if (ans.trim() !== '1776') {
        window.alert('Not quite — progress is safe.');
        return;
      }
      resetProgress();
      this.scene.restart();
    }, { fill: 0x8f4a54, textColor: '#ffe1e1', fontSize: 20 });

    this.chip(cx, 614, 300, 48, '← Back to the map', () => this.scene.start('map'), {
      fill: GOLD,
      textColor: '#26323f',
      fontSize: 22,
    });

    // discreet debug unlock (beta testing) — password gated
    this.chip(38, 692, 46, 40, '🐞', () => this.debugUnlock(), {
      fill: 0x2b3644,
      emoji: true,
      fontSize: 18,
    }).setAlpha(0.55);
  }

  /**
   * A compact rounded button for the adult screen (no 72px floor). Returns
   * the container; its children are [bg, label].
   */
  private chip(
    cx: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onTap: () => void,
    opts: ChipOpts = {},
  ): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.22);
    bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 11);
    bg.fillStyle(opts.fill ?? SLATE, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 11);
    const text = (opts.emoji ? emojiText : readingText)(
      this,
      0,
      0,
      label,
      opts.fontSize ?? 20,
      opts.textColor ?? SLATE_TXT,
    );
    const c = this.add.container(cx, y, [bg, text]);
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => this.tweens.add({ targets: c, scale: 0.95, duration: 70, yoyo: true }));
    c.on('pointerup', onTap);
    return c;
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
    this.chip(cx - 112, y, 48, 48, '−', () => { onDelta(-1); val.setText(value()); }, {
      fill: SLATE,
      textColor: SLATE_TXT,
      fontSize: 32,
    });
    this.chip(cx + 112, y, 48, 48, '+', () => { onDelta(1); val.setText(value()); }, {
      fill: SLATE,
      textColor: SLATE_TXT,
      fontSize: 32,
    });
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
