/**
 * The Starlight Story Book — pure reward reading. No stats, no timers,
 * nothing to get wrong: Evie reads a page herself, taps 'I read it!', and
 * only THEN does the picture appear — the emoji scene is the reward for
 * reading, never a crutch to guess from.
 *
 * Without a storyId the scene is the BOOKSHELF (covers, locked ones shown
 * as dimmed invitations); with one it's the page-by-page READING FLOW.
 */
import Phaser from 'phaser';
import { STORIES } from '../content/stories';
import type { Story } from '../content/types';
import { THEMES } from '../content/themes';
import { loadProgress, saveProgress } from '../services/progress';
import { PEARLS_PER_STORY } from '../avatar/catalog';
import { newlyEarned } from '../engine/achievements';
import { speakUI, chime, playMusic } from '../services/audio';
import {
  isRecordingSupported,
  startRecording,
  stopRecording,
  saveRecording,
  playRecording,
  stopPlayback,
} from '../services/recorder';
import {
  GAME_W,
  GAME_H,
  readingText,
  emojiText,
  makeButton,
  drawRealmBackground,
  popIn,
  wiggle,
  confettiBurst,
  badgeToast,
  type Button,
} from '../ui/kit';

export class StoryScene extends Phaser.Scene {
  /** False once the scene shuts down (home button) — guards audio .then callbacks. */
  private alive = true;
  private storyId: string | null = null;
  private pageIndex = 0;
  /** Current page's view — rebuilt per page; late audio callbacks check identity. */
  private pageView: Phaser.GameObjects.Container | null = null;
  /** True while the mic is capturing Evie reading the current page. */
  private recording = false;

  constructor() {
    super('story');
  }

  init(data: { storyId?: string }): void {
    this.storyId = data?.storyId ?? null;
  }

  create(): void {
    this.alive = true;
    this.pageIndex = 0;
    this.pageView = null;
    this.recording = false;
    this.events.once('shutdown', () => {
      this.alive = false;
      stopPlayback();
      if (this.recording) {
        this.recording = false;
        void stopRecording(); // discard a half-finished take on the way out
      }
    });

    // the story book lives in Starlight Castle no matter which realm she's
    // adventuring in — one cozy reading nook, always the same colors
    const theme = THEMES.castle;
    drawRealmBackground(this, theme.bgTop, theme.bgBottom, theme.ambient);
    this.cameras.main.fadeIn(300);
    playMusic('story');

    // home button — she can always leave, even mid-story
    const home = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    });
    home.setAlpha(0.85);

    const story = this.storyId ? STORIES.find((s) => s.id === this.storyId) : undefined;
    if (story) this.buildReader(story);
    else this.buildShelf();
  }

  /** The bookshelf: one cover per story; locked covers are invitations, not walls. */
  private buildShelf(): void {
    const progress = loadProgress();
    readingText(this, GAME_W / 2, 56, 'Story Pages 📖', 40, '#ffe9a8');
    void speakUI('story-shelf', 'Story pages! Pick a story to read!');

    if (STORIES.length === 0) {
      // content ships separately — an empty shelf still feels warm
      const soon = readingText(this, GAME_W / 2, GAME_H / 2, 'Stories are coming soon! ✨', 40, '#ffe9a8');
      popIn(this, soon);
      return;
    }

    const readSet = new Set(progress.storiesRead);
    const cols = 3;
    const rows = Math.ceil(STORIES.length / cols);
    const top = 180;
    // rows share the space below the title — cards shrink a little when the
    // shelf fills up rather than spilling off the canvas
    const rowH = Math.min(215, (GAME_H - top - 24) / rows);
    const cardH = rowH - 18;
    const cardW = 300;

    STORIES.forEach((story, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, STORIES.length - row * cols);
      const col = i % cols;
      // a short last row centers itself instead of hugging the left edge
      const x = GAME_W / 2 + (col - (inRow - 1) / 2) * (cardW + 22);
      const y = top + rowH * row + rowH / 2;
      const unlocked = story.unlockLevel <= progress.currentLevel;
      const realmTheme = THEMES[story.realm];

      const card = this.add.container(x, y);
      const bg = this.add.graphics();
      bg.fillStyle(0xffffff, unlocked ? 0.16 : 0.07);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 22);
      bg.lineStyle(3, realmTheme.accent, unlocked ? 0.8 : 0.25);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 22);
      card.add(bg);

      card.add(emojiText(this, 0, -cardH / 2 + 40, realmTheme.creature, 40));
      const title = readingText(this, 0, 10, story.title, 24, '#ffffff');
      title.setWordWrapWidth(cardW - 28);
      title.setAlign('center');
      card.add(title);

      if (!unlocked) {
        // dimmed, never hidden — something to look forward to
        card.setAlpha(0.55);
        card.add(emojiText(this, -40, cardH / 2 - 26, '🔒', 22));
        card.add(readingText(this, 20, cardH / 2 - 26, `Level ${story.unlockLevel}`, 20, '#ffffffaa'));
      } else if (readSet.has(story.id)) {
        card.add(emojiText(this, cardW / 2 - 26, -cardH / 2 + 26, '✨', 26));
      }

      card.setSize(cardW, cardH);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerup', () => {
        if (unlocked) {
          this.scene.restart({ storyId: story.id });
        } else {
          wiggle(this, card); // an invitation, not a wall — just a shrug
          void speakUI('story-locked', 'Keep adventuring — this story unlocks soon!');
        }
      });

      popIn(this, card, i * 60);
    });
  }

  /** The reading flow: page by page, picture after the read. */
  private buildReader(story: Story): void {
    readingText(this, GAME_W / 2, 56, story.title, 34, '#ffe9a8');
    this.showPage(story);
  }

  private showPage(story: Story): void {
    const page = story.pages[this.pageIndex];
    if (!page) return;
    const n = this.pageIndex + 1;

    this.pageView?.destroy();
    const view = this.add.container(0, 0);
    this.pageView = view;

    // page number pebble — where we are in the story, never a score
    const pebble = this.add.graphics();
    pebble.fillStyle(0xffffff, 0.12);
    pebble.fillRoundedRect(GAME_W / 2 - 110, 108, 220, 44, 22);
    view.add(pebble);
    view.add(readingText(this, GAME_W / 2, 130, `Page ${n} of ${story.pages.length}`, 22, '#ffffffcc'));

    // THE reading moment: big decodable text, and no picture yet
    const text = readingText(this, GAME_W / 2, 280, page.text, 46, '#ffffff');
    text.setWordWrapWidth(GAME_W - 140);
    text.setAlign('center');
    view.add(text);
    popIn(this, text);

    const speakId = `story-${story.id}-p${n}`;
    const replay = makeButton(this, GAME_W / 2 - 280, 600, '🔊', () => void speakUI(speakId, page.text), {
      emoji: true,
      fontSize: 32,
      width: 84,
      height: 76,
      fill: 0xffffff,
    });
    view.add(replay);

    // "read it yourself" — record Evie reading this page and play it back
    this.addRecorderControls(view, speakId);

    const readBtn = makeButton(
      this,
      GAME_W / 2,
      600,
      'I read it! ⭐',
      () => {
        readBtn.destroy();
        chime('good');
        // the reward: the picture appears only AFTER the read
        const art = emojiText(this, GAME_W / 2, 440, page.emojiScene, 84);
        view.add(art);
        popIn(this, art);
        // fluent model of the page, then the way forward appears
        void speakUI(speakId, page.text).then(() => {
          if (!this.alive || this.pageView !== view) return;
          if (n < story.pages.length) {
            const next = makeButton(
              this,
              GAME_W / 2 + 280,
              600,
              '→',
              () => {
                this.pageIndex++;
                this.showPage(story);
              },
              { fontSize: 44, width: 96, height: 84 },
            );
            view.add(next);
            popIn(this, next);
          } else {
            this.finish(story, view);
          }
        });
      },
      { fontSize: 34, width: 340, height: 84, fill: 0xffe9a8 },
    );
    view.add(readBtn);
  }

  /**
   * The record-your-own-voice controls: a 🎤 toggle to capture Evie reading
   * this page (saved to IndexedDB), and a ▶️ to play her take back. Skipped
   * entirely where the mic isn't available.
   */
  private addRecorderControls(view: Phaser.GameObjects.Container, pageId: string): void {
    if (!isRecordingSupported()) return;
    const hasRec = loadProgress().recordings.includes(pageId);

    const play = makeButton(this, GAME_W - 66, 132, '▶️', () => void playRecording(pageId), {
      emoji: true,
      fontSize: 28,
      width: 80,
      height: 72,
      fill: 0xffe9a8,
    });
    play.setVisible(hasRec);
    view.add(play);

    const mic = makeButton(this, GAME_W - 152, 132, '🎤', () => void this.toggleRecording(view, pageId, mic, play), {
      emoji: true,
      fontSize: 28,
      width: 80,
      height: 72,
      fill: 0xffffff,
    });
    view.add(mic);
  }

  private async toggleRecording(
    view: Phaser.GameObjects.Container,
    pageId: string,
    mic: Button,
    play: Button,
  ): Promise<void> {
    if (!this.recording) {
      const ok = await startRecording();
      if (!ok) return;
      if (!this.alive || this.pageView !== view) {
        void stopRecording(); // page/scene changed while the mic warmed up
        return;
      }
      this.recording = true;
      mic.label.setText('⏹️');
      return;
    }
    // stop + save
    this.recording = false;
    const blob = await stopRecording();
    const live = this.alive && this.pageView === view;
    if (live) mic.label.setText('🎤');
    if (blob) {
      await saveRecording(pageId, blob);
      const p = loadProgress();
      if (!p.recordings.includes(pageId)) {
        p.recordings.push(pageId);
        saveProgress(p);
      }
      if (live) {
        play.setVisible(true);
        chime('good');
      }
    }
  }

  /** Warm ending: confetti, 'The end!', and the shelf remembers the read. */
  private finish(story: Story, view: Phaser.GameObjects.Container): void {
    const progress = loadProgress();
    const firstRead = !progress.storiesRead.includes(story.id);
    if (firstRead) {
      progress.storiesRead.push(story.id);
      progress.pearls += PEARLS_PER_STORY; // first read of a story earns pearls
      saveProgress(progress);
    }

    chime('fanfare');
    confettiBurst(this, GAME_W / 2, 320, THEMES.castle.accent);
    const end = readingText(this, GAME_W / 2, 528, 'The end! ⭐', 44, '#ffe9a8');
    view.add(end);
    popIn(this, end);
    void speakUI('story-the-end', 'The end! You read the whole story!');
    if (firstRead) {
      const pearl = this.add.circle(GAME_W / 2 - 92, 566, 11, 0xffffff, 1).setStrokeStyle(2, 0xd8e6ee, 1);
      const shine = this.add.circle(GAME_W / 2 - 96, 562, 3, 0xffffff, 0.95);
      const earned = readingText(this, GAME_W / 2 + 8, 566, `+${PEARLS_PER_STORY} pearls!`, 26, '#ffffff');
      view.add(pearl);
      view.add(shine);
      view.add(earned);
      [pearl, shine, earned].forEach((o) => popIn(this, o, 350));

      // celebrate any story badges just earned (first story, bookworm, all…)
      const fresh = newlyEarned(progress);
      if (fresh.length > 0) {
        fresh.forEach((b) => progress.badges.push(b.id));
        saveProgress(progress);
        fresh.slice(0, 3).forEach((b, i) => badgeToast(this, b.emoji, b.label, 700 + i * 1400));
      }
    }

    // pass explicit empty data — Phaser's restart() reuses old data otherwise,
    // which would reopen this same story instead of the shelf
    const more = makeButton(this, GAME_W / 2, 604, '📖 More stories', () => this.scene.restart({}), {
      fontSize: 28,
      width: 320,
      height: 76,
      fill: 0xffe9a8,
    });
    view.add(more);
    popIn(this, more, 150);
  }
}
