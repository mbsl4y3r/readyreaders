/**
 * The island map: 9 level stops along a winding path through the three
 * realms. Icon-first (no text she must read to navigate); each stop speaks
 * its name when unlocked. Parent screen hides behind a 2s long-press on
 * the gear.
 */
import Phaser from 'phaser';
import { regionForLesson, baseRealmFor, TOTAL_LESSONS } from '../content/regions';
import { canStartLessonToday, roadDone } from '../services/road';
import { loadProgress } from '../services/progress';
import { seasonFor, SEASON_THEMES } from '../services/juice';
import { speakUI, playMusic, chime } from '../services/audio';
import { GAME_W, GAME_H, readingText, emojiText, drawRealmBackground, makeButton, wiggle } from '../ui/kit';

/** The ten lesson stops of the current region, winding across the middle. */
const STOP_POS: [number, number][] = [
  [190, 560], [300, 505], [415, 545], [530, 490], [645, 535],
  [755, 470], [645, 400], [520, 370], [395, 400], [280, 345],
];

export class MapScene extends Phaser.Scene {
  constructor() {
    super('map');
  }

  create(): void {
    const progress = loadProgress();
    // The Reading Road: her current REGION paints the whole map, its ten
    // lessons wind across the middle, and the big button continues the journey.
    const lesson = Math.min(progress.lesson, TOTAL_LESSONS);
    const region = regionForLesson(lesson);

    // a gentle seasonal touch: the season's emoji drift in the background and
    // a small badge names it — date-driven, no settings to fuss with
    const season = seasonFor();
    const st = SEASON_THEMES[season];
    drawRealmBackground(this, region.bgTop, region.bgBottom, [...region.ambient, ...st.emoji]);
    this.cameras.main.fadeIn(300);
    playMusic(`region-${region.id}`, baseRealmFor(region));

    readingText(this, GAME_W / 2, 56, "Evie's Reading Realms", 40, '#ffe9a8');

    // status row under the title: reading streak · arcade tickets · Inky level
    emojiText(this, GAME_W / 2 - 132, 100, '🔥', 26);
    readingText(this, GAME_W / 2 - 104, 100, `${progress.streak.days}`, 24, '#ffffff').setOrigin(0, 0.5);
    emojiText(this, GAME_W / 2 - 20, 100, '🎟️', 24);
    readingText(this, GAME_W / 2 + 8, 100, `${progress.tickets}`, 24, '#ffffff').setOrigin(0, 0.5);
    emojiText(this, GAME_W / 2 + 96, 100, '🐙', 24);
    readingText(this, GAME_W / 2 + 124, 100, `Lv${progress.inky.level}`, 22, '#ffffff').setOrigin(0, 0.5);

    // seasonal badge, tucked bottom-left away from the Continue button
    emojiText(this, 120, GAME_H - 26, st.emoji[0]!, 22).setAlpha(0.8);
    readingText(this, 168, GAME_H - 26, st.name, 18, '#ffe9a8').setAlpha(0.8);

    // where she is on the whole road — region name + lesson N of 120
    readingText(
      this,
      GAME_W / 2,
      142,
      `${region.emoji} ${region.name}  ·  Lesson ${lesson} of ${TOTAL_LESSONS}`,
      22,
      '#ffe9a8',
    ).setAlpha(0.95);

    // collection tally
    const c = progress.collections;
    const total = c.treasures.length + c.pets.length + c.charms.length;
    emojiText(this, 80, 60, '🐚', 34);
    readingText(this, 130, 60, `${total}`, 34, '#ffffff');

    // pearl purse — the wardrobe currency, always visible so earning feels real
    const pearl = this.add.circle(80, 206, 12, 0xffffff, 1).setStrokeStyle(2, 0xd8e6ee, 1);
    pearl.setDepth(1);
    this.add.circle(76, 202, 3.5, 0xffffff, 0.95).setDepth(1);
    readingText(this, 130, 206, `${progress.pearls}`, 30, '#ffffff');

    // side doors off the map — icon-only, scenes greet with their own audio
    const goTo = (key: string) => {
      this.cameras.main.fadeOut(300);
      this.time.delayedCall(330, () => this.scene.start(key));
    };
    // 📚 sits under the shell tally: "see what those shells are"
    makeButton(this, 80, 134, '📚', () => goTo('collection'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // ✨ in the opposite top corner, clear of the path and the gear
    makeButton(this, GAME_W - 80, 60, '✨', () => goTo('phrases-hub'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // 📖 story pages under the sparkles — the castle's bookshelf
    makeButton(this, GAME_W - 80, 134, '📖', () => goTo('story'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // 👗 the wardrobe — dress-up with pearls earned by reading
    makeButton(this, GAME_W - 80, 208, '👗', () => goTo('wardrobe'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // 🔁 review — a gentler second-session pass over words she's already met
    makeButton(this, 80, 280, '🔁', () => {
      this.cameras.main.fadeOut(300);
      this.time.delayedCall(330, () => this.scene.start('session', { review: true }));
    }, {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffe9a8,
    }).setAlpha(0.9);
    // 🏅 achievements — the badge shelf
    makeButton(this, GAME_W - 80, 282, '🏅', () => goTo('achievements'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // 🕹️ the Games Arcade — spend pearls on a play pass, earned by reading
    makeButton(this, 80, 354, '🕹️', () => goTo('arcade'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffe9a8,
    }).setAlpha(0.92);
    // 🌟 sticker book — milestone stickers she's collected
    makeButton(this, 80, 428, '🌟', () => goTo('stickerbook'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // 📸 photo booth — pose dressed-up Evie and snap a picture
    makeButton(this, GAME_W - 80, 356, '📸', () => goTo('photobooth'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);
    // 🎟️ ticket shop — spend arcade tickets on fancy cosmetics
    makeButton(this, GAME_W - 80, 430, '🎟️', () => goTo('ticketshop'), {
      emoji: true,
      fontSize: 30,
      width: 76,
      height: 64,
      fill: 0xffffff,
    }).setAlpha(0.85);

    // session-cap sunset: past the daily cap the map turns to dusk and
    // suggests resting — a gentle wind-down, never a lock (parents decide)
    const today = new Date().toISOString().slice(0, 10);
    const minutesToday = progress.sessions
      .filter((s) => s.date === today)
      .reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    if (minutesToday >= progress.settings.sessionCapMin) {
      this.add
        .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x1a1035, 0.35)
        .setDepth(5);
      const moon = emojiText(this, GAME_W / 2 - 205, 116, '🌙', 40).setDepth(6);
      const note = readingText(
        this,
        GAME_W / 2 + 24,
        116,
        'What a lot of reading today! ⭐',
        30,
        '#ffe9a8',
      ).setDepth(6);
      this.tweens.add({
        targets: [moon, note],
        alpha: 0.75,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // ---- the road: this region's ten lesson stops winding across the middle
    const path = this.add.graphics();
    path.lineStyle(9, 0xffffff, 0.16);
    for (let i = 0; i < STOP_POS.length - 1; i++) {
      const [x1, y1] = STOP_POS[i]!;
      const [x2, y2] = STOP_POS[i + 1]!;
      path.lineBetween(x1, y1, x2, y2);
    }

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

      const r = isCurrent ? 40 : 26;
      const circle = this.add.circle(x, y, r, passed || isCurrent ? region.accent : 0x55606e, passed || isCurrent ? 1 : 0.55);
      circle.setStrokeStyle(isCurrent ? 5 : 3, 0xffffff, passed || isCurrent ? 0.9 : 0.25);
      const icon = emojiText(this, x, y, isCurrent ? region.creature : passed ? '⭐' : '', isCurrent ? 36 : 22);
      readingText(this, x, y + r + 20, `${stopLesson}`, 18, passed || isCurrent ? '#ffffff' : '#93a0ad');

      circle.setInteractive({ useHandCursor: true });
      circle.on('pointerup', () => {
        if (isCurrent) {
          if (canStart) startLesson(stopLesson);
          else {
            chime('gentle');
            void speakUI('road-tomorrow', 'Great reading today! A brand new lesson opens tomorrow!');
          }
        } else if (passed) {
          startLesson(stopLesson); // replaying an old lesson is always welcome
        } else {
          wiggle(this, circle); // not yet — an invitation, never a wall
        }
      });
      if (isCurrent) {
        this.tweens.add({
          targets: [circle, icon],
          scale: 1.12,
          duration: 650,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    // the next region waits at the end of the path
    if (region.id < 12) {
      const nextRegion = regionForLesson(region.lessonRange[1] + 1);
      const gx = 175;
      const gy = 300;
      this.add.circle(gx, gy, 34, 0x000000, 0.25).setStrokeStyle(3, 0xffffff, 0.35);
      emojiText(this, gx, gy, nextRegion.emoji, 30).setAlpha(0.8);
      readingText(this, gx, gy + 52, 'next!', 16, '#ffffffaa');
    }

    // the big CONTINUE button — the one thing to tap every day
    const label = done
      ? '🏆 You did it all!'
      : canStart
        ? `▶️ Lesson ${lesson}!`
        : '🌙 Review time!';
    makeButton(
      this,
      GAME_W / 2,
      GAME_H - 56,
      label,
      () => {
        if (done) return;
        if (canStart) startLesson(lesson);
        else {
          this.cameras.main.fadeOut(300);
          this.time.delayedCall(330, () => this.scene.start('session', { review: true }));
        }
      },
      { fontSize: 32, width: 340, height: 84, fill: 0xffe9a8 },
    );

    // parent gear — a plain tap opens the parent corner (a big hit target,
    // bottom-right, out of the way of play)
    makeButton(this, GAME_W - 58, GAME_H - 48, '⚙️', () => this.scene.start('parent'), {
      emoji: true,
      fontSize: 34,
      width: 76,
      height: 68,
      fill: 0xffffff,
    }).setAlpha(0.7);
  }
}
