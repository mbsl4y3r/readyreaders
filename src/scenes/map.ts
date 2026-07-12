/**
 * The Reading Road map — the home screen and the game's hero. The child's
 * current REGION paints the world; its ten lesson stops wind across the middle
 * as a sticker-medallion trail; one big gold button continues the journey.
 *
 * "Storybook Atlas" treatment: the region stays a full-color illustrated place,
 * but chrome (title, buttons, currency, milestones) is cut-paper stickers in the
 * display face. Navigation is four persistent destinations + a "More" chest, so
 * the road and the Lesson button own the screen instead of ten edge icons.
 */
import Phaser from 'phaser';
import { regionForLesson, baseRealmFor, TOTAL_LESSONS } from '../content/regions';
import { canStartLessonToday, roadDone } from '../services/road';
import { loadProgress } from '../services/progress';
import { seasonFor, SEASON_THEMES } from '../services/juice';
import { speakUI, playMusic, chime } from '../services/audio';
import {
  GAME_W,
  GAME_H,
  readingText,
  displayText,
  emojiText,
  drawRealmBackground,
  makeButton,
  makePanel,
  coinChip,
  wiggle,
  bob,
  breathe,
  COL,
  HEX,
} from '../ui/kit';

/** The ten lesson stops of the current region, winding across the middle. */
const STOP_POS: [number, number][] = [
  [210, 560], [320, 505], [435, 545], [545, 495], [650, 535],
  [755, 470], [650, 405], [525, 375], [400, 405], [285, 350],
];

export class MapScene extends Phaser.Scene {
  constructor() {
    super('map');
  }

  create(): void {
    const progress = loadProgress();
    const lesson = Math.min(progress.lesson, TOTAL_LESSONS);
    const region = regionForLesson(lesson);
    const boy = progress.avatar.character === 'boy';

    const season = seasonFor();
    const st = SEASON_THEMES[season];
    // the region is a full-color place; only a few calm set-dressing emoji
    drawRealmBackground(this, region.bgTop, region.bgBottom, [...region.ambient, ...st.emoji], undefined, 3);
    this.cameras.main.fadeIn(300);
    playMusic(`region-${region.id}`, baseRealmFor(region));

    // ---- header: the LAND is the headline; the app name is a small eyebrow
    displayText(this, GAME_W / 2, 34, 'Reading Realms', 17, '#ffffffcc', '500').setAlpha(0.9);
    const head = this.add.container(GAME_W / 2, 74);
    const name = displayText(this, 0, 0, region.name, 42, HEX.white, '700');
    const emo = emojiText(this, -name.width / 2 - 26, 0, region.emoji, 34);
    head.add([emo, name]);
    displayText(this, GAME_W / 2, 112, `Lesson ${lesson} of ${TOTAL_LESSONS}`, 19, '#ffffffcc', '500');

    // ---- currency, top-left: pearls + a shell/collection tally as coin chips
    const c = progress.collections;
    const total = c.treasures.length + c.pets.length + c.charms.length;
    coinChip(this, 80, 44, '⚪', `${progress.pearls}`, 24);
    coinChip(this, 80, 92, '🐚', `${total}`, 22);

    // ---- status, top-right cluster: streak · tickets · pet level
    coinChip(this, GAME_W - 210, 44, '🔥', `${progress.streak.days}`, 22);
    coinChip(this, GAME_W - 128, 44, '🎟️', `${progress.tickets}`, 22);
    coinChip(this, GAME_W - 44, 44, boy ? '🦖' : '🐙', `${progress.inky.level}`, 22);

    // ---- navigation: FOUR persistent destinations + a "More" chest ----
    const goTo = (key: string) => {
      this.cameras.main.fadeOut(300);
      this.time.delayedCall(330, () => this.scene.start(key));
    };
    const startReview = () => {
      this.cameras.main.fadeOut(300);
      this.time.delayedCall(330, () => this.scene.start('session', { review: true }));
    };
    const navBtn = (x: number, y: number, glyph: string, cap: string, onTap: () => void, gold = false) => {
      const b = makeButton(this, x, y, glyph, onTap, {
        emoji: true, fontSize: 30, width: 78, height: 66, fill: gold ? COL.gold : COL.paper,
      });
      displayText(this, x, y + 46, cap, 14, gold ? HEX.goldEdge : '#ffffffdd', '500');
      return b;
    };
    // right-edge toolbelt: the four the child reaches for most
    navBtn(GAME_W - 66, 190, '📚', 'Book', () => goTo('collection'));
    navBtn(GAME_W - 66, 286, '👗', 'Dress', () => goTo('wardrobe'));
    navBtn(GAME_W - 66, 382, '🕹️', 'Games', () => goTo('arcade'), true);
    navBtn(GAME_W - 66, 478, '🔁', 'Review', startReview);
    // the "More adventures" chest — opens a paper tray with the rest
    navBtn(GAME_W - 66, 574, '🧰', 'More', () => this.openMore(goTo));

    // ---- the road: a dotted trail of sticker medallions ----
    this.drawTrail(region);

    const done = roadDone(progress);
    const canStart = canStartLessonToday(progress);
    const startLesson = (l: number): void => {
      this.cameras.main.fadeOut(300);
      this.time.delayedCall(330, () => this.scene.start('session', { lesson: l }));
    };

    const [regionFrom] = region.lessonRange;
    for (let i = 0; i < 10; i++) {
      const stopLesson = regionFrom + i;
      const [x, y] = STOP_POS[i]!;
      const passed = stopLesson < lesson || done;
      const isCurrent = !done && stopLesson === lesson;
      this.drawMilestone(x, y, stopLesson, passed, isCurrent, boy, () => {
        if (isCurrent && !canStart) {
          chime('gentle');
          void speakUI('road-tomorrow', 'Great reading today! A brand new lesson opens tomorrow!');
        } else if (passed || isCurrent) startLesson(stopLesson);
        else wiggle(this, this.add.container(x, y)); // an invitation, never a wall
      });
    }

    // the next land peeks at the end of the trail
    if (region.id < 12) {
      const nextRegion = regionForLesson(region.lessonRange[1] + 1);
      makePanel(this, 120, 250, 108, 96, { fill: COL.paper, radius: 18 }).setAlpha(0.85);
      emojiText(this, 174, 286, nextRegion.emoji, 34).setAlpha(0.9);
      displayText(this, 174, 322, 'next!', 15, HEX.inkSoft, '500');
    }

    // ---- session-cap sunset (unchanged gentle wind-down) ----
    const today = new Date().toISOString().slice(0, 10);
    const minutesToday = progress.sessions
      .filter((s) => s.date === today)
      .reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    if (minutesToday >= progress.settings.sessionCapMin) {
      this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x1a1035, 0.3).setDepth(5);
      const note = displayText(this, GAME_W / 2, 150, '🌙  What a lot of reading today!', 28, HEX.gold).setDepth(6);
      breathe(this, note, 1.04, 1800);
    }

    // ---- the ONE gold action ----
    const label = done ? '🏆 You did it all!' : canStart ? `Lesson ${lesson}!` : '🌙 Review time!';
    const cta = makeButton(this, GAME_W / 2, GAME_H - 54, label, () => {
      if (done) return;
      if (canStart) startLesson(lesson);
      else startReview();
    }, { fontSize: 32, width: 340, height: 88, fill: COL.gold, textColor: HEX.ink });
    if (canStart && !done) breathe(this, cta, 1.03, 1300);

    // parent gear — quiet, bottom-left, out of the way of play
    makeButton(this, 58, GAME_H - 46, '⚙️', () => this.scene.start('parent'), {
      emoji: true, fontSize: 30, width: 72, height: 64, fill: COL.paper,
    }).setAlpha(0.85);
  }

  /** A dotted stitched trail connecting the ten stops. */
  private drawTrail(region: { accent: number }): void {
    const g = this.add.graphics();
    for (let i = 0; i < STOP_POS.length - 1; i++) {
      const [x1, y1] = STOP_POS[i]!;
      const [x2, y2] = STOP_POS[i + 1]!;
      const dist = Phaser.Math.Distance.Between(x1, y1, x2, y2);
      const dots = Math.max(3, Math.round(dist / 26));
      for (let d = 1; d < dots; d++) {
        const t = d / dots;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(x, y, 4);
      }
    }
  }

  /** One road stop as a cut-paper medallion: passed = gold coin, today = pet marker, upcoming = paper coin. */
  private drawMilestone(
    x: number, y: number, lessonNum: number,
    passed: boolean, isCurrent: boolean, boy: boolean, onTap: () => void,
  ): void {
    const cont = this.add.container(x, y);
    const g = this.add.graphics();
    const r = isCurrent ? 38 : 26;
    // shadow
    g.fillStyle(0x000000, 0.18);
    g.fillCircle(0, 4, r);
    if (isCurrent) {
      g.fillStyle(COL.paper, 1); g.fillCircle(0, 0, r);
      g.lineStyle(4, COL.gold, 1); g.strokeCircle(0, 0, r);
    } else if (passed) {
      g.fillStyle(COL.gold, 1); g.fillCircle(0, 0, r);
      g.lineStyle(3, COL.goldEdge, 1); g.strokeCircle(0, 0, r);
    } else {
      g.fillStyle(COL.paper, 0.9); g.fillCircle(0, 0, r);
      g.lineStyle(3, COL.paperEdge, 1); g.strokeCircle(0, 0, r);
    }
    cont.add(g);

    if (isCurrent) {
      // the child's pet marks "you are here", under a little flag
      const region = regionForLesson(lessonNum);
      cont.add(emojiText(this, 0, 2, region.creature, 34));
      const flag = this.add.container(0, -r - 20);
      const fg = this.add.graphics();
      fg.fillStyle(COL.gold, 1); fg.fillRoundedRect(-52, -15, 104, 26, 8);
      fg.lineStyle(2, COL.goldEdge, 1); fg.strokeRoundedRect(-52, -15, 104, 26, 8);
      flag.add(fg);
      flag.add(displayText(this, 0, -2, "YOU'RE HERE", 13, HEX.ink, '700'));
      cont.add(flag);
      bob(this, cont, 6, 1400);
    } else if (passed) {
      cont.add(emojiText(this, 0, 0, '⭐', 24));
    }
    // number label
    cont.add(displayText(this, 0, r + 18, `${lessonNum}`, 16, passed || isCurrent ? HEX.white : '#ffffff99', '700'));

    g.setInteractive(new Phaser.Geom.Circle(0, 0, r), Phaser.Geom.Circle.Contains);
    g.on('pointerup', onTap);
  }

  /** The "More adventures" chest: a paper tray of the six less-frequent destinations. */
  private openMore(goTo: (k: string) => void): void {
    const scrim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x201018, 0.55).setDepth(20).setInteractive();
    const panel = this.add.container(GAME_W / 2, GAME_H / 2).setDepth(21);
    panel.add(makePanel(this, -320, -150, 640, 300, { fill: COL.paper }));
    panel.add(displayText(this, 0, -112, 'More adventures', 30, HEX.ink, '700'));
    const items: [string, string, string][] = [
      ['✨', 'Phrases', 'phrases-hub'],
      ['📖', 'Stories', 'story'],
      ['🏅', 'Badges', 'achievements'],
      ['🌟', 'Stickers', 'stickerbook'],
      ['📸', 'Photos', 'photobooth'],
      ['🎟️', 'Shop', 'ticketshop'],
    ];
    const close = () => { scrim.destroy(); panel.destroy(); };
    items.forEach(([glyph, cap, key], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = -200 + col * 200;
      const by = -30 + row * 96;
      const b = makeButton(this, bx, by, glyph, () => { close(); goTo(key); }, {
        emoji: true, fontSize: 34, width: 96, height: 76, fill: COL.paper,
      });
      panel.add(b);
      panel.add(displayText(this, bx, by + 50, cap, 15, HEX.inkSoft, '500'));
    });
    const x = makeButton(this, 296, -138, '✕', close, { emoji: true, fontSize: 22, width: 52, height: 52, fill: COL.paper });
    panel.add(x);
    scrim.on('pointerup', close);
  }
}
