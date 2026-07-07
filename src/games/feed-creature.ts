/**
 * Feed-the-creature: the realm's creature SAYS a word; Evie picks the matching
 * WRITTEN word from 3 choices (minimal-pair distractors — decoding, not
 * guessing; no pictures until after the decode).
 */
import Phaser from 'phaser';
import { getWord } from '../content/words';
import { speakWord, speakUI, chime } from '../services/audio';
import { GAME_W, makeButton, emojiText, readingText, wiggle, popIn, type Button } from '../ui/kit';
import type { RunRound } from './types';

export const runFeedCreature: RunRound = (scene, spec, ctx) => {
  return new Promise((resolve) => {
    const word = getWord(spec.wordId!);
    const distractors = (spec.distractorIds ?? []).map(getWord);
    const container = scene.add.container(0, 0);

    const creature = emojiText(scene, GAME_W / 2, 210, ctx.theme.creature, 150);
    container.add(creature);
    scene.tweens.add({
      targets: creature,
      y: creature.y - 12,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const prompt = readingText(
      scene,
      GAME_W / 2,
      340,
      `Feed ${ctx.theme.creatureName}!`,
      34,
      '#ffffffcc',
    );
    container.add(prompt);

    const sayIt = () => void speakWord(word.id, word.text);
    const replay = makeButton(scene, GAME_W / 2, 430, '🔊', sayIt, {
      emoji: true,
      fontSize: 52,
      fill: ctx.theme.accent,
      width: 110,
      height: 90,
    });
    container.add(replay);

    void speakUI('feed-me', `Feed ${ctx.theme.creatureName} the word:`).then(sayIt);

    const choices = Phaser.Utils.Array.Shuffle([word, ...distractors]);
    const choiceButtons: Button[] = [];
    const started = performance.now();
    let misses = 0;
    let done = false;

    const finish = (btn: Button) => {
      done = true;
      chime('good');
      // gobble: the card flies into the creature's mouth
      scene.tweens.add({
        targets: btn,
        x: creature.x,
        y: creature.y,
        scale: 0,
        duration: 420,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          scene.tweens.add({ targets: creature, scale: 1.25, duration: 140, yoyo: true });
          // picture appears only now, AFTER the decode
          if (word.emoji) {
            const pic = emojiText(scene, GAME_W / 2, 340, word.emoji, 100);
            container.add(pic);
            popIn(scene, pic);
          }
          void speakUI('yum', 'Yum! Thank you!');
          scene.time.delayedCall(1300, () => {
            container.destroy();
            resolve({
              itemId: word.id,
              correct: true,
              firstTry: misses === 0,
              latencyMs: Math.round(performance.now() - started),
              assisted: misses >= 2,
            });
          });
        },
      });
    };

    const miss = (btn: Button) => {
      misses++;
      wiggle(scene, btn);
      chime('gentle');
      btn.setEnabled(false);
      if (misses >= 2) {
        // model it: pulse the correct card and say the word
        const correctBtn = choiceButtons[choices.indexOf(word)]!;
        scene.tweens.add({ targets: correctBtn, scale: 1.12, duration: 380, yoyo: true, repeat: 2 });
        void speakUI('this-one', `This word says ${word.text}. Tap it!`);
      } else {
        void speakUI('try-again', 'Hmm, try again!').then(sayIt);
      }
    };

    const cardW = Math.min(280, (GAME_W - 120) / choices.length - 20);
    choices.forEach((w, i) => {
      const x = GAME_W / 2 + (i - (choices.length - 1) / 2) * (cardW + 36);
      const btn = makeButton(
        scene,
        x,
        575,
        w.text,
        () => {
          if (done) return;
          if (w.id === word.id) finish(btn);
          else miss(btn);
        },
        { width: cardW, height: 100, fontSize: 54 },
      );
      choiceButtons.push(btn);
      container.add(btn);
      popIn(scene, btn, 150 + i * 120);
    });
  });
};
