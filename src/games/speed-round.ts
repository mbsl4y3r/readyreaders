/**
 * Lightning round ⚡ — the fluency finish line: five words she already reads
 * accurately (the planner only sends mastery ≥ 1), read fast one after
 * another. The clock runs SILENTLY — no visible timer, no red, no fail
 * state — because the celebration is the time, never the pressure.
 */
import Phaser from 'phaser';
import { WORDS, getWord } from '../content/words';
import { pickDistractors } from '../engine/session-planner';
import { speakWord, speakUI, chime } from '../services/audio';
import {
  GAME_W,
  makeButton,
  emojiText,
  readingText,
  wiggle,
  popIn,
  confettiBurst,
  type Button,
} from '../ui/kit';
import type { RunRound } from './types';

export const runSpeedRound: RunRound = (scene, spec, ctx) => {
  return new Promise((resolve) => {
    // Phaser reuses the scene instance across visits, so the countdown chain,
    // the turn-advance delays, and the audio-chain callbacks below can all
    // fire after she taps home — into a LATER round already running on this
    // same scene. Guard every such callback with this flag.
    let aborted = false;
    scene.events.once('shutdown', () => (aborted = true));

    const words = spec.speedWordIds!.map(getWord);
    const container = scene.add.container(0, 0);

    // Distractors come from words she could plausibly have met: the bank up
    // to the speed words' highest lesson. If that pool is somehow too thin
    // for minimal pairs, the whole bank backs it up — never crash the finale.
    const maxLesson = Math.max(...words.map((w) => w.lesson));
    const lessonPool = WORDS.filter((w) => w.lesson <= maxLesson);
    const pool = lessonPool.length >= 3 ? lessonPool : WORDS;

    // 5-star meter: dim slots along the top that light up one per word read —
    // soft progress feel, not a score
    const starSlots = words.map((_, i) => {
      const star = emojiText(
        scene,
        GAME_W / 2 + (i - (words.length - 1) / 2) * 84,
        92,
        '⭐',
        48,
      ).setAlpha(0.22);
      container.add(star);
      return star;
    });

    const title = readingText(scene, GAME_W / 2, 190, '⚡ Lightning round!', 44, '#ffffffcc');
    container.add(title);

    let started = performance.now();
    let totalMisses = 0;
    let assisted = false;

    const finish = () => {
      // total elapsed since the FIRST turn appeared — the session records
      // speedBest from this; the round itself never judges the number
      const elapsed = Math.round(performance.now() - started);
      const secs = (elapsed / 1000).toFixed(1);
      chime('fanfare');
      confettiBurst(scene, GAME_W / 2, 300, ctx.theme.accent);
      const banner = readingText(
        scene,
        GAME_W / 2,
        410,
        `⚡ You read 5 words in ${secs} seconds!`,
        40,
      );
      if (banner.width > GAME_W - 80) banner.setStyle({ wordWrap: { width: GAME_W - 120 } });
      container.add(banner);
      popIn(scene, banner);
      void speakUI('lightning-done', `You read five words in ${secs} seconds!`);
      scene.time.delayedCall(2400, () => {
        if (aborted) return;
        container.destroy();
        resolve({
          itemId: 'speed',
          correct: true,
          firstTry: totalMisses === 0,
          latencyMs: elapsed,
          assisted,
        });
      });
    };

    const startTurn = (idx: number) => {
      const word = words[idx]!;
      let turnMisses = 0;
      let turnDone = false;

      // everything belonging to this turn lives in one group so the ~250ms
      // transition is a single destroy, not a bookkeeping exercise
      const group = scene.add.container(0, 0);
      container.add(group);

      void speakWord(word.id, word.text);

      const distractorIds = pickDistractors(word, pool);
      // thin-pool safety: pad from the full bank so there are always 3 cards
      for (const w of WORDS) {
        if (distractorIds.length >= 2) break;
        if (w.id !== word.id && !distractorIds.includes(w.id)) distractorIds.push(w.id);
      }
      const choices = Phaser.Utils.Array.Shuffle([word, ...distractorIds.map(getWord)]);
      const buttons: Button[] = [];

      const hit = (btn: Button) => {
        turnDone = true;
        chime('good');
        buttons.forEach((b) => b !== btn && b.setAlpha(0.25));
        // the earned star flies up into its meter slot
        const slot = starSlots[idx]!;
        const flyer = emojiText(scene, btn.x, btn.y, '⭐', 48);
        container.add(flyer);
        scene.tweens.add({
          targets: flyer,
          x: slot.x,
          y: slot.y,
          duration: 260,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            flyer.destroy();
            slot.setAlpha(1);
            scene.tweens.add({ targets: slot, scale: 1.35, duration: 130, yoyo: true });
          },
        });
        // pace IS the point: next turn almost immediately
        scene.time.delayedCall(250, () => {
          if (aborted) return;
          group.destroy();
          if (idx + 1 < words.length) startTurn(idx + 1);
          else finish();
        });
      };

      const miss = (btn: Button) => {
        turnMisses++;
        totalMisses++;
        wiggle(scene, btn);
        chime('gentle');
        btn.setEnabled(false);
        if (turnMisses >= 2) {
          // model it: pulse the correct card — assisted, never failed; the
          // round moves on as soon as she taps it
          assisted = true;
          const correctBtn = buttons[choices.indexOf(word)]!;
          scene.tweens.add({ targets: correctBtn, scale: 1.12, duration: 380, yoyo: true, repeat: 2 });
          void speakUI('this-one', `This word says ${word.text}. Tap it!`);
        } else {
          void speakWord(word.id, word.text);
        }
      };

      const cardW = Math.min(280, (GAME_W - 120) / choices.length - 20);
      choices.forEach((w, i) => {
        const x = GAME_W / 2 + (i - (choices.length - 1) / 2) * (cardW + 36);
        const btn = makeButton(
          scene,
          x,
          430,
          w.text,
          () => {
            if (turnDone) return;
            if (w.id === word.id) hit(btn);
            else miss(btn);
          },
          { width: cardW, height: 100, fontSize: 54, reading: true },
        );
        buttons.push(btn);
        group.add(btn);
        popIn(scene, btn, i * 60); // quick stagger — keep the lightning feel
      });
    };

    // --- intro beat: ready… set… read! with a 3-2-1 star pulse ---
    const countStar = emojiText(scene, GAME_W / 2, 420, '⭐', 170).setAlpha(0);
    const countNum = readingText(scene, GAME_W / 2, 420, '', 110, '#26323f');
    container.add(countStar);
    container.add(countNum);

    const tick = (n: number) => {
      if (aborted) return;
      if (n === 0) {
        countStar.destroy();
        countNum.destroy();
        started = performance.now(); // the silent clock starts with turn one
        startTurn(0);
        return;
      }
      countNum.setText(String(n));
      countStar.setAlpha(1).setScale(0.6);
      countNum.setScale(0.6);
      scene.tweens.add({
        targets: [countStar, countNum],
        scale: 1,
        duration: 220,
        ease: 'Back.easeOut',
      });
      chime('gentle');
      scene.time.delayedCall(600, () => tick(n - 1));
    };
    void speakUI('lightning-round', 'Lightning round! Ready… set… read!').then(() => {
      if (!aborted) tick(3);
    });
  });
};
