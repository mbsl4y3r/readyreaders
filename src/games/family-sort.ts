/**
 * Word-family sort: two big rime buckets ('-at' / '-an') and one word card
 * at a time — a single clear decision per card for a six-year-old, never a
 * pile. Membership is computed from the word text's ENDING, not the
 * planner's grouping, so a card can never land in a bucket its own letters
 * contradict.
 */
import { getWord } from '../content/words';
import { speakWord, speakUI, chime } from '../services/audio';
import {
  GAME_W,
  makeButton,
  readingText,
  displayText,
  wiggle,
  popIn,
  confettiBurst,
  type Button,
} from '../ui/kit';
import type { RunRound } from './types';

const BUCKET_W = 360;
const BUCKET_H = 240;

export const runFamilySort: RunRound = (scene, spec, ctx) => {
  return new Promise((resolve) => {
    // Phaser reuses the scene instance across visits, so the card-flight
    // delays and audio-chain callbacks below can still fire after she taps
    // home — into a LATER round already running on this same scene. Guard
    // every such callback with this flag.
    let aborted = false;
    scene.events.once('shutdown', () => (aborted = true));

    const { families, wordIds } = spec.family!;
    const words = wordIds.map(getWord);
    const container = scene.add.container(0, 0);

    const title = displayText(scene, GAME_W / 2, 84, 'Word families!', 40, '#ffffffcc');
    container.add(title);
    void speakUI('family-sort-intro', 'Sort the words into their families!');

    // a word belongs to the family its TEXT ends with (lowercase compare)
    const familyIndexOf = (text: string): number =>
      families.findIndex((f) => text.toLowerCase().endsWith(f));

    let idx = 0;
    let wordMisses = 0;
    let totalMisses = 0;
    let assisted = false;
    let busy = false; // swallows bucket taps while a card is mid-flight
    let card: Button | null = null;
    let firstShownAt: number | null = null;
    let latencyMs = 0;

    // --- the two buckets, side by side, well over finger size ---
    const bucketY = 500;
    const buckets = families.map((fam, bi) => {
      const x = GAME_W / 2 + (bi === 0 ? -1 : 1) * 250;
      const root = scene.add.container(x, bucketY);
      const panel = scene.add.graphics();
      panel.fillStyle(ctx.theme.accent, 0.22);
      panel.fillRoundedRect(-BUCKET_W / 2, -BUCKET_H / 2, BUCKET_W, BUCKET_H, 26);
      panel.lineStyle(6, ctx.theme.accent, 1);
      panel.strokeRoundedRect(-BUCKET_W / 2, -BUCKET_H / 2, BUCKET_W, BUCKET_H, 26);
      const label = readingText(scene, 0, -BUCKET_H / 2 + 46, `-${fam}`, 56);
      root.add([panel, label]);
      root.setSize(BUCKET_W, BUCKET_H);
      root.setInteractive({ useHandCursor: true });
      root.on('pointerup', () => onBucket(bi));
      container.add(root);
      popIn(scene, root, 150 + bi * 120);
      return { root, count: 0 };
    });

    const celebrate = () => {
      chime('fanfare');
      // both buckets glow — the whole board won, there is no losing side
      buckets.forEach((b) => {
        scene.tweens.add({ targets: b.root, scale: 1.06, duration: 420, yoyo: true, repeat: 3 });
        confettiBurst(scene, b.root.x, b.root.y - BUCKET_H / 2, ctx.theme.accent);
      });
      void speakUI('family-sort-done', 'You sorted the whole family!');
      scene.time.delayedCall(2200, () => {
        if (aborted) return;
        container.destroy();
        resolve({
          itemId: 'fam:' + families.join('-'),
          correct: true,
          firstTry: totalMisses === 0,
          latencyMs,
          assisted,
        });
      });
    };

    const showWord = () => {
      if (aborted) return;
      if (idx >= words.length) {
        celebrate();
        return;
      }
      const w = words[idx]!;
      // trust the planner but verify from the letters: a word that matches
      // neither ending is skipped rather than forced into a wrong "right"
      if (familyIndexOf(w.text) === -1) {
        idx++;
        showWord();
        return;
      }
      wordMisses = 0;
      // tapping the big card reads it aloud — a model on demand, never forced
      card = makeButton(scene, GAME_W / 2, 250, w.text, () => void speakWord(w.id, w.text), {
        width: 300,
        height: 120,
        fontSize: 64,
        reading: true,
      });
      container.add(card);
      popIn(scene, card);
      // latency runs from the FIRST card shown to the last one sorted
      if (firstShownAt === null) firstShownAt = performance.now();
    };

    const onBucket = (bi: number) => {
      if (busy || !card || idx >= words.length) return;
      const w = words[idx]!;
      const fi = familyIndexOf(w.text);
      if (bi === fi) {
        busy = true;
        chime('good');
        void speakWord(w.id, w.text);
        const bucket = buckets[bi]!;
        const flying = card;
        card = null;
        // fly + shrink into the bucket, then stack a small copy inside it so
        // the sorted family stays visible as it grows
        const stackX = bucket.root.x;
        const stackY = bucket.root.y - 20 + bucket.count * 56;
        scene.tweens.add({
          targets: flying,
          x: stackX,
          y: stackY,
          scale: 0.15,
          duration: 380,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            flying.destroy();
            const copy = readingText(scene, stackX, stackY, w.text, 34);
            container.add(copy);
            popIn(scene, copy);
            bucket.count++;
          },
        });
        idx++;
        if (idx >= words.length) {
          latencyMs = Math.round(performance.now() - (firstShownAt ?? performance.now()));
          // busy stays true — the round is over, no more sorting
          scene.time.delayedCall(450, () => {
            if (aborted) return;
            celebrate();
          });
        } else {
          scene.time.delayedCall(420, () => {
            if (aborted) return;
            busy = false;
            showWord();
          });
        }
      } else {
        wordMisses++;
        totalMisses++;
        wiggle(scene, buckets[bi]!.root);
        chime('gentle');
        if (wordMisses >= 2) {
          // model it: pulse the RIGHT bucket — assisted, never failed
          assisted = true;
          scene.tweens.add({
            targets: buckets[fi]!.root,
            scale: 1.08,
            duration: 380,
            yoyo: true,
            repeat: 2,
          });
          void speakUI('this-family', `${w.text} goes in this family! Tap it!`);
        } else {
          void speakUI('try-again', 'Hmm, try again!');
        }
      }
    };

    showWord();
  });
};
