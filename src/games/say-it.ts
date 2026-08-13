/**
 * Say It — the fluency round, and the only one that asks her to READ.
 *
 * Every other mechanic is recognition: tap the matching card, pick the right
 * picture, drag sounds into slots. All of those can be passed by elimination
 * without ever reading the word. This one shows the word in silence and asks
 * her to say it out loud, then tells her whether she was right — which is the
 * only way to measure the thing the whole game exists for: how long it takes
 * her to recognise a word at a glance.
 *
 * Rules it obeys:
 * - NO audio while the word is on screen. Silence is the mechanic; any sound
 *   would let her answer by listening instead of reading.
 * - Self-reported. She taps "I said it!" — there is no verification and no
 *   way to be wrong, so there is no fail state to be afraid of.
 * - "Sound it out" may only ever play RECORDED letter sounds. If a grapheme
 *   has no recording it falls back to modelling the whole word, because TTS
 *   would say the letter's NAME, which is the exact opposite of the lesson.
 * - The picture appears only after she has said it — a reward, not a crutch.
 */
import Phaser from 'phaser';
import { getWord } from '../content/words';
import { speakWord, speakGrapheme, speakUI, chime } from '../services/audio';
import {
  GAME_W,
  GAME_H,
  makeButton,
  emojiText,
  displayText,
  readingText,
  popIn,
  confettiBurst,
  COL,
  type Button,
} from '../ui/kit';
import type { RunRound } from './types';

/**
 * The spoken instruction is for her FIRST say-it round only. Hearing "read
 * this out loud" before every single word is the kind of repetition that
 * makes a grown-up put the iPad away; the written prompt stays every time.
 */
let promptedThisSession = false;

export const runSayIt: RunRound = (scene, spec, _ctx) => {
  return new Promise((resolve) => {
    let aborted = false;
    scene.events.once('shutdown', () => {
      aborted = true;
      promptedThisSession = false; // a new session earns the instruction again
    });

    const word = getWord(spec.wordId!);
    const container = scene.add.container(0, 0);

    const title = displayText(scene, GAME_W / 2, 128, 'Read it out loud!', 38, '#ffffffcc');
    container.add(title);

    // The word, big and alone. Andika, generous tracking, nothing else near it.
    const card = scene.add.graphics();
    container.add(card);
    const label = readingText(scene, GAME_W / 2, 300, word.text, 116, '#2b2118');
    const padX = 70;
    const padY = 44;
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    card.fillStyle(COL.paper, 1);
    card.fillRoundedRect(GAME_W / 2 - w / 2, 300 - h / 2, w, h, 28);
    card.lineStyle(4, COL.paperEdge, 1);
    card.strokeRoundedRect(GAME_W / 2 - w / 2, 300 - h / 2, w, h, 28);
    container.add(label);
    popIn(scene, label);

    let started = 0;
    let assisted = false;
    let done = false;

    /** The clock only runs while the word is on screen and nothing is talking. */
    const startClock = (): void => {
      if (started === 0) started = performance.now();
    };

    if (promptedThisSession) {
      startClock();
    } else {
      promptedThisSession = true;
      // spoken before the timing starts, so listening never counts as reading
      void speakUI('say-it-prompt', 'Read this word out loud. Then tap, I said it!').then(() => {
        if (!aborted) startClock();
      });
      // never let a missing/blocked clip stall the round
      scene.time.delayedCall(3000, startClock);
    }

    const finish = (): void => {
      if (done || aborted) return;
      done = true;
      startClock(); // paranoia: a tap before the prompt resolved still times
      const latencyMs = Math.round(performance.now() - started);
      saidIt.setEnabled(false);
      help.setEnabled(false);
      chime('sparkle');

      // Now she hears it — as a check on herself, after the reading, never before.
      void speakWord(word.id, word.text);
      confettiBurst(scene, GAME_W / 2, 300, COL.gold);
      // The buttons step aside so the reward picture has the lower half of the
      // screen to itself — it must never land on top of the controls.
      scene.tweens.add({
        targets: [saidIt, help],
        alpha: 0,
        duration: 220,
        onComplete: () => {
          saidIt.setVisible(false);
          help.setVisible(false);
        },
      });
      if (word.emoji) {
        const pic = emojiText(scene, GAME_W / 2, 500, word.emoji, 120);
        container.add(pic);
        popIn(scene, pic, 220);
      }

      scene.time.delayedCall(1500, () => {
        if (aborted) return;
        container.destroy();
        resolve({
          itemId: word.id,
          correct: true, // self-reported: there is no wrong answer here
          firstTry: !assisted,
          latencyMs,
          assisted,
        });
      });
    };

    const saidIt = makeButton(scene, GAME_W / 2, GAME_H - 210, '⭐ I said it!', finish, {
      fontSize: 40,
      width: 380,
      height: 108,
      fill: COL.gold,
    });
    container.add(saidIt);

    /**
     * Sound it out. Recorded letter sounds only, in order, lighting each
     * grapheme as it plays; the moment one is missing we model the whole word
     * instead. Using it counts as assistance, which is honest — it means the
     * word was not automatic yet — but it costs her nothing else.
     */
    const soundItOut = async (): Promise<void> => {
      if (done || aborted) return;
      assisted = true;
      help.setEnabled(false);
      for (const g of word.graphemes) {
        if (aborted || done) break;
        // One text object holds the whole word, so a per-grapheme colour would
        // flash the ENTIRE word red on every vowel. A pulse carries the beat
        // of the sounds without lying about which letters they belong to.
        scene.tweens.add({ targets: label, scale: 1.08, duration: 120, yoyo: true });
        const played = await speakGrapheme(g);
        // No recording for this grapheme: TTS would say the letter's NAME,
        // which is the opposite of the lesson. Stop sounding out and model the
        // whole word instead.
        if (!played) break;
      }
      if (aborted || done) return;
      // The whole word, said fast — "now say the sounds together". This is the
      // point of sounding out, and it plays exactly once either way.
      await speakWord(word.id, word.text);
      if (!aborted && !done) help.setEnabled(true);
    };

    const help = makeButton(scene, GAME_W / 2, GAME_H - 90, '🔊 Sound it out', () => {
      void soundItOut();
    }, { fontSize: 26, width: 300, height: 76, fill: COL.paper });
    container.add(help);
  });
};

/** Reset the once-per-session spoken instruction (used by tests). */
export function resetSayItPrompt(): void {
  promptedThisSession = false;
}
