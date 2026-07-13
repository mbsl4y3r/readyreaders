/**
 * The Games Arcade — Evie's reward for reading. One host scene that owns the
 * whole frame: a cabinet grid, the pearl "play pass" economy, and, while a
 * game runs, the HUD + game-over overlay. Individual games are tiny modules
 * (games/arcade/*) that mount into a layer and are driven by this scene's
 * update loop — see games/arcade/types.ts for the contract.
 *
 * Two gates, both intentional:
 *  - a cabinet is dark until her Reading Road marker reaches its
 *    unlockLesson (reading progress lights up new games), and
 *  - playing needs an active play pass: ten pearls buys five minutes, and
 *    reading is still the only way to earn pearls.
 */
import Phaser from 'phaser';
import {
  ARCADE_GAMES,
  ARCADE_ANNOUNCE,
  PASS_PEARLS,
  PASS_MS,
  passActive,
  type ArcadeGameDef,
} from '../content/arcade-games';
import { ARCADE_RUNNERS } from '../games/arcade';
import { THEMES } from '../content/themes';
import { loadProgress, saveProgress } from '../services/progress';
import { speedFactor, TICKETS_PER_PLAY, TICKETS_NEW_BEST } from '../services/juice';
import { speakUI, chime, playMusic } from '../services/audio';
import {
  GAME_W,
  GAME_H,
  emojiText,
  makeButton,
  drawRealmBackground,
  popIn,
  confettiBurst,
  sceneTitle,
  displayText,
  coinChip,
  COL,
  HEX,
} from '../ui/kit';
import type { ArcadeGame, ArcadeCtx } from '../games/arcade/types';

const HUD_BOTTOM = 92;

export class ArcadeScene extends Phaser.Scene {
  private alive = true;
  private playing = false;

  private menuLayer: Phaser.GameObjects.Container | null = null;
  private hudLayer: Phaser.GameObjects.Container | null = null;
  private playLayer: Phaser.GameObjects.Container | null = null;
  private overlay: Phaser.GameObjects.Container | null = null;

  private active: ArcadeGame | null = null;
  private currentDef: ArcadeGameDef | null = null;
  private score = 0;
  private scoreText: Phaser.GameObjects.Text | null = null;
  private passText: Phaser.GameObjects.Text | null = null;
  private lastPassTick = 0;

  constructor() {
    super('arcade');
  }

  create(): void {
    this.alive = true;
    this.playing = false;
    this.active = null;
    this.menuLayer = this.hudLayer = this.playLayer = this.overlay = null;

    drawRealmBackground(this, 0x1a1030, 0x0a0618, ['🕹️', '🎮', '⭐', '🏆'], 'stars');
    this.cameras.main.fadeIn(300);
    playMusic('arcade');
    void speakUI('arcade-hub', ARCADE_ANNOUNCE.hub!);

    this.buildMenu();
    this.events.once('shutdown', () => this.teardown());
  }

  private teardown(): void {
    this.alive = false;
    this.playing = false;
    if (this.active) {
      try {
        this.active.destroy();
      } catch {
        // game already torn down
      }
      this.active = null;
    }
  }

  override update(time: number, delta: number): void {
    if (!this.alive) return;
    if (this.playing && this.active) {
      this.active.update(time, delta);
      return;
    }
    // menu: tick the pass countdown roughly once a second
    if (this.menuLayer && this.passText && time - this.lastPassTick > 500) {
      this.lastPassTick = time;
      this.refreshPassText();
    }
  }

  // ---- menu ---------------------------------------------------------------

  private buildMenu(): void {
    this.playing = false;
    if (this.playLayer) {
      this.playLayer.destroy();
      this.playLayer = null;
    }
    if (this.hudLayer) {
      this.hudLayer.destroy();
      this.hudLayer = null;
    }
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
    if (this.menuLayer) this.menuLayer.destroy();
    const layer = this.add.container(0, 0);
    this.menuLayer = layer;

    const progress = loadProgress();

    layer.add(sceneTitle(this, 'Games Arcade', '🕹️', 46));

    // home
    const home = makeButton(this, 58, 46, '🏠', () => this.scene.start('map'), {
      emoji: true,
      fontSize: 28,
      width: 72,
      height: 60,
      fill: COL.paper,
    });
    home.setAlpha(0.95);
    layer.add(home);

    // pearl purse + pass banner (top-right)
    layer.add(coinChip(this, GAME_W - 236, 46, '🦪', `${progress.pearls}`, 22));
    this.passText = displayText(this, GAME_W - 150, 46, '', 22, HEX.teal, '700').setOrigin(0, 0.5);
    layer.add(this.passText);
    this.refreshPassText();

    // cabinet grid: 5 cols (compact) so the growing library fits without scroll
    const cols = 5;
    const cellW = 196;
    const cellH = 128;
    const x0 = GAME_W / 2 - ((cols - 1) / 2) * cellW;
    const y0 = 196;
    ARCADE_GAMES.forEach((def, i) => {
      const cx = x0 + (i % cols) * cellW;
      const cy = y0 + Math.floor(i / cols) * cellH;
      const unlocked = progress.lesson >= def.unlockLesson;
      const best = progress.arcadeBest[def.id] ?? 0;
      layer.add(this.cabinet(def, cx, cy, unlocked, best, i));
    });
  }

  private refreshPassText(): void {
    if (!this.passText) return;
    const until = loadProgress().arcadePassUntil;
    const now = Date.now();
    if (passActive(until, now)) {
      // clamp to the pass length so a corrupt/imported far-future value can
      // never render a monster number
      const secs = Math.min(Math.ceil((until - now) / 1000), Math.ceil(PASS_MS / 1000));
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      this.passText.setText(`⏳ ${m}:${s.toString().padStart(2, '0')} left`);
      this.passText.setColor(HEX.teal);
    } else {
      this.passText.setText(`Pass: ${PASS_PEARLS} 🦪`);
      this.passText.setColor('#ffe9a8');
    }
  }

  private cabinet(
    def: ArcadeGameDef,
    x: number,
    y: number,
    unlocked: boolean,
    best: number,
    i: number,
  ): Phaser.GameObjects.Container {
    const theme = THEMES[def.realm];
    const w = 182;
    const h = 112;
    const c = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.28);
    bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, 16);
    bg.fillStyle(unlocked ? theme.accent : 0x3a4351, unlocked ? 0.9 : 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.lineStyle(3, 0xffffff, unlocked ? 0.85 : 0.2);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    c.add(bg);

    const glyph = emojiText(this, 0, -22, unlocked ? def.emoji : '🔒', 46);
    if (!unlocked) glyph.setAlpha(0.75);
    c.add(glyph);

    if (unlocked) {
      c.add(displayText(this, 0, 20, def.title, 16, '#12202e'));
      const bestLabel = best > 0 ? `Best: ${best}` : 'Tap to play!';
      c.add(displayText(this, 0, 41, bestLabel, 12, '#12202e', '500').setAlpha(0.85));
    } else {
      c.add(displayText(this, 0, 20, `Lesson ${def.unlockLesson}`, 15, '#c9d2de'));
      c.add(displayText(this, 0, 41, 'to unlock', 12, '#9aa6b4', '500'));
    }

    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true });
    });
    c.on('pointerup', () => this.onCabinet(def, unlocked));
    popIn(this, c, 60 + i * 35);
    return c;
  }

  private onCabinet(def: ArcadeGameDef, unlocked: boolean): void {
    if (!unlocked) {
      chime('gentle');
      this.floatingNote(`Reach Lesson ${def.unlockLesson} to unlock this game!`);
      return;
    }
    const progress = loadProgress();
    if (passActive(progress.arcadePassUntil, Date.now())) {
      this.startGame(def);
    } else {
      this.passModal(def);
    }
  }

  private floatingNote(text: string): void {
    const note = displayText(this, GAME_W / 2, GAME_H - 70, text, 24, HEX.gold);
    note.setDepth(50);
    this.tweens.add({
      targets: note,
      y: GAME_H - 110,
      alpha: 0,
      duration: 1800,
      ease: 'Sine.easeIn',
      onComplete: () => note.destroy(),
    });
  }

  // ---- play pass ----------------------------------------------------------

  private passModal(def: ArcadeGameDef): void {
    const progress = loadProgress();
    const canAfford = progress.pearls >= PASS_PEARLS;
    const m = this.add.container(GAME_W / 2, GAME_H / 2).setDepth(60);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setInteractive();
    m.add(dim);
    const panel = this.add.graphics();
    panel.fillStyle(0x241640, 0.98);
    panel.fillRoundedRect(-300, -170, 600, 340, 26);
    panel.lineStyle(3, 0xffe9a8, 1);
    panel.strokeRoundedRect(-300, -170, 600, 340, 26);
    m.add(panel);

    m.add(emojiText(this, 0, -104, '🎟️', 58));
    m.add(displayText(this, 0, -34, 'Play Pass', 38, HEX.gold));
    m.add(
      displayText(
        this,
        0,
        16,
        canAfford ? `5 minutes of games for ${PASS_PEARLS} 🦪` : `You need ${PASS_PEARLS} 🦪 to play`,
        24,
        HEX.white,
        '500',
      ),
    );

    if (canAfford) {
      const buy = makeButton(this, -130, 108, '🎟️ Get Pass!', () => {
        m.destroy();
        this.buyPassAndPlay(def);
      }, { width: 240, height: 76, fill: 0xffe9a8, fontSize: 28 });
      m.add(buy);
      const no = makeButton(this, 140, 108, 'Not now', () => m.destroy(), {
        width: 200,
        height: 76,
        fill: 0xffffff,
        fontSize: 26,
      });
      m.add(no);
    } else {
      m.add(displayText(this, 0, 62, 'Read a lesson to earn pearls! 🦪', 22, HEX.teal, '500'));
      const ok = makeButton(this, 0, 118, 'Okay!', () => m.destroy(), {
        width: 220,
        height: 76,
        fill: 0xffffff,
        fontSize: 28,
      });
      m.add(ok);
    }
    popIn(this, m);
  }

  private buyPassAndPlay(def: ArcadeGameDef): void {
    const progress = loadProgress();
    if (progress.pearls < PASS_PEARLS) return;
    progress.pearls -= PASS_PEARLS;
    progress.arcadePassUntil = Date.now() + PASS_MS;
    saveProgress(progress);
    chime('good');
    this.startGame(def);
  }

  // ---- game host ----------------------------------------------------------

  private startGame(def: ArcadeGameDef): void {
    if (this.menuLayer) {
      this.menuLayer.destroy();
      this.menuLayer = null;
      this.passText = null;
    }
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
    this.currentDef = def;
    this.score = 0;

    // play layer first (games draw here), HUD on top so it's never covered
    this.playLayer = this.add.container(0, 0);
    this.hudLayer = this.add.container(0, 0);

    const back = makeButton(this, 58, 46, '⬅️', () => this.exitToMenu(), {
      emoji: true,
      fontSize: 26,
      width: 72,
      height: 60,
      fill: 0xffffff,
    });
    back.setAlpha(0.92);
    this.hudLayer.add(back);
    this.hudLayer.add(displayText(this, GAME_W / 2, 40, def.title, 28, HEX.gold));
    this.scoreText = displayText(this, GAME_W - 34, 40, `0 ${def.scoreLabel}`, 24, HEX.white).setOrigin(
      1,
      0.5,
    );
    this.hudLayer.add(this.scoreText);

    const theme = THEMES[def.realm];
    const ctx: ArcadeCtx = {
      layer: this.playLayer,
      width: GAME_W,
      height: GAME_H,
      hudBottom: HUD_BOTTOM,
      theme,
      difficulty: speedFactor(loadProgress().settings.gameSpeed),
      onScore: (s) => this.setScore(s),
      onGameOver: (s) => this.gameOver(s),
    };

    void speakUI(`arcade-${def.id}`, ARCADE_ANNOUNCE[def.id] ?? def.title);
    this.playing = true;
    try {
      this.active = ARCADE_RUNNERS[def.id]!(this, ctx);
    } catch {
      // a game that fails to start shouldn't strand her in a blank screen
      this.playing = false;
      this.exitToMenu();
    }
  }

  private setScore(s: number): void {
    if (!this.playing) return;
    this.score = s;
    const label = this.currentDef?.scoreLabel ?? '';
    this.scoreText?.setText(`${s} ${label}`);
  }

  private gameOver(finalScore: number): void {
    if (!this.playing) return;
    this.playing = false;
    this.score = finalScore;
    if (this.active) {
      try {
        this.active.destroy(); // unhook input so overlay taps aren't eaten
      } catch {
        // already down
      }
      this.active = null;
    }

    const def = this.currentDef!;
    const progress = loadProgress();
    const prevBest = progress.arcadeBest[def.id] ?? 0;
    const newBest = finalScore > prevBest;
    if (newBest) progress.arcadeBest[def.id] = finalScore;
    // playing earns arcade tickets — the ticket-shop currency (a new best pays more)
    const ticketsEarned = TICKETS_PER_PLAY + (newBest ? TICKETS_NEW_BEST : 0);
    progress.tickets += ticketsEarned;
    saveProgress(progress);
    chime(newBest ? 'newbest' : 'good');

    const o = this.add.container(GAME_W / 2, GAME_H / 2).setDepth(70);
    this.overlay = o;
    o.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.5));
    const panel = this.add.graphics();
    panel.fillStyle(0x241640, 0.98);
    panel.fillRoundedRect(-280, -180, 560, 360, 26);
    panel.lineStyle(3, 0xffe9a8, 1);
    panel.strokeRoundedRect(-280, -180, 560, 360, 26);
    o.add(panel);

    o.add(displayText(this, 0, -120, newBest ? 'New best! 🏆' : 'Great job! ⭐', 40, HEX.gold));
    o.add(displayText(this, 0, -52, `${finalScore} ${def.scoreLabel}`, 38, HEX.white));
    if (!newBest && prevBest > 0) {
      o.add(displayText(this, 0, -4, `Best: ${prevBest} ${def.scoreLabel}`, 22, HEX.teal, '500'));
    }
    o.add(displayText(this, 0, 42, `+${ticketsEarned} 🎟️`, 28, HEX.gold));
    if (newBest) confettiBurst(this, 0, -60, THEMES[def.realm].accent);

    const again = makeButton(this, -128, 108, '🔁 Play again', () => this.replay(), {
      width: 244,
      height: 78,
      fill: 0xffe9a8,
      fontSize: 26,
    });
    o.add(again);
    const choose = makeButton(this, 138, 108, '🕹️ Games', () => this.exitToMenu(), {
      width: 200,
      height: 78,
      fill: 0xffffff,
      fontSize: 26,
    });
    o.add(choose);
    popIn(this, o);
  }

  private clearGame(): void {
    if (this.active) {
      try {
        this.active.destroy();
      } catch {
        // ok
      }
      this.active = null;
    }
    this.playing = false;
    this.playLayer?.destroy();
    this.hudLayer?.destroy();
    this.overlay?.destroy();
    this.playLayer = this.hudLayer = this.overlay = null;
    this.scoreText = null;
  }

  private replay(): void {
    const def = this.currentDef;
    this.clearGame();
    if (def && passActive(loadProgress().arcadePassUntil, Date.now())) {
      this.startGame(def);
    } else {
      this.buildMenu();
    }
  }

  private exitToMenu(): void {
    this.clearGame();
    this.buildMenu();
  }
}
