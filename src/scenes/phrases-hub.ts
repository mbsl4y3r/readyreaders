/**
 * Magic Phrases hub — a practice gallery outside sessions. Cards show each
 * phrase with mastery pips; tapping one runs the same magic-phrase round the
 * session uses, and records under the same phrase stat key — hub practice
 * and session practice feed one adaptive model.
 */
import Phaser from 'phaser';
import { LEVELS } from '../content/levels';
import { THEMES, type RealmTheme } from '../content/themes';
import type { RealmId } from '../content/types';
import { phrasesForLevel, phraseStatKey } from '../engine/session-planner';
import type { RoundSpec } from '../engine/rounds';
import { updateStat } from '../engine/adaptive';
import { loadProgress, saveProgress, statFor } from '../services/progress';
import { speakUI } from '../services/audio';
import { runMagicPhrase } from '../games/magic-phrase';
import {
  GAME_W,
  GAME_H,
  makeButton,
  drawRealmBackground,
  popIn,
  sceneTitle,
  displayText,
  COL,
  HEX,
} from '../ui/kit';

export class PhrasesHubScene extends Phaser.Scene {
  /** False once the scene shuts down (home button) — ignores late round results. */
  private alive = true;
  private gallery: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('phrases-hub');
  }

  create(): void {
    this.alive = true;
    this.gallery = null;
    this.events.once('shutdown', () => (this.alive = false));

    const progress = loadProgress();
    const level = LEVELS.find((l) => l.id === progress.currentLevel) ?? LEVELS[0]!;
    const theme = THEMES[level.realm];
    drawRealmBackground(this, theme.bgTop, theme.bgBottom, theme.ambient);
    this.cameras.main.fadeIn(300);

    // home button — she can always leave, even mid-round
    const home = makeButton(this, 62, 52, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: COL.paper,
    });
    home.setAlpha(0.95);

    sceneTitle(this, 'Magic Phrases', '✨', 56);
    void speakUI('phrases-hub', 'Magic phrases! Pick one to read!');

    this.buildGallery();
  }

  /** (Re)draws the card grid — called again after each round so pips update. */
  private buildGallery(): void {
    const progress = loadProgress();
    const level = LEVELS.find((l) => l.id === progress.currentLevel) ?? LEVELS[0]!;
    const theme = THEMES[level.realm];

    this.gallery?.destroy();
    const gallery = this.add.container(0, 0);
    this.gallery = gallery;

    const pool = phrasesForLevel(progress.currentLevel, progress.bookLesson);
    if (pool.length === 0) {
      const empty = displayText(this, GAME_W / 2, GAME_H / 2, 'More magic phrases soon!', 34, HEX.gold);
      gallery.add(empty);
      popIn(this, empty);
      return;
    }

    // up to 8 cards — least-practised win the spots, shown in book order
    const exposures = (id: string) => progress.words[phraseStatKey(id)]?.exposures ?? 0;
    const picked = new Set(
      [...pool]
        .sort((a, b) => exposures(a.id) - exposures(b.id))
        .slice(0, 8)
        .map((p) => p.id),
    );
    const cards = pool.filter((p) => picked.has(p.id));

    // centre the rows in the space below the title so a short list never
    // leaves a lopsided empty band at the bottom of the screen
    const rowCount = Math.ceil(cards.length / 2);
    const y0 = Math.max(190, 190 + ((4 - rowCount) * 128) / 2);
    cards.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_W / 2 + (col === 0 ? -1 : 1) * 245;
      const y = y0 + row * 128;
      const card = makeButton(this, x, y, p.text, () => this.playPhrase(p.id, level.realm, theme), {
        width: 460,
        height: 108,
        fontSize: 32,
        reading: true,
      });
      // nudge the label up so the mastery pips fit along the bottom edge
      card.label.setY(-10);
      const mastery = progress.words[phraseStatKey(p.id)]?.mastery ?? 0;
      for (let d = 0; d < 3; d++) {
        const pip = this.add
          .circle((d - 1) * 26, 36, 7, COL.gold, d < mastery ? 1 : 0.18)
          .setStrokeStyle(2, COL.goldEdge, d < mastery ? 1 : 0.4);
        card.add(pip);
      }
      gallery.add(card);
      popIn(this, card, i * 70);
    });
  }

  /** Runs one round inline: hide the gallery, play, record, rebuild. */
  private playPhrase(phraseId: string, realm: RealmId, theme: RealmTheme): void {
    this.gallery?.setVisible(false);
    const spec: RoundSpec = { mechanic: 'magic-phrase', phraseId, realm };
    void runMagicPhrase(this, spec, { theme }).then((result) => {
      if (!this.alive) return;
      // record exactly as the session does, keyed apart from word stats
      const progress = loadProgress();
      const key = phraseStatKey(result.itemId);
      const stat = statFor(progress, key);
      progress.words[key] = updateStat(stat, result);
      saveProgress(progress);
      this.buildGallery();
    });
  }
}
