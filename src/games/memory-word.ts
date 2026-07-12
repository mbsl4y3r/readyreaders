/**
 * Memory word — the book's ritual for rule-breakers ("was", "the"…). Phonics
 * can't unlock the heart-marked graphemes, so the order is REVERSED from
 * build-a-word: we model the whole word first, show which parts break the
 * rules (purple + 💜), and only then scatter the tiles for her to rebuild
 * from memory. Heart tiles never play a letter sound — the phonics sound
 * would be a lie — they chime instead.
 */
import Phaser from 'phaser';
import { getWord } from '../content/words';
import { speakWord, speakGrapheme, speakUI, chime } from '../services/audio';
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

/** Heart-grapheme purple — wins over the vowel-red convention. */
const HEART_COLOR = '#9b5de5';
/** Non-heart vowels keep the usual red. */
const VOWEL_COLOR = '#d1495b';

export const runMemoryWord: RunRound = (scene, spec, ctx) => {
  return new Promise((resolve) => {
    // Phaser reuses the scene instance across visits, so a delayed call or
    // audio-chain callback left pending when she taps home can still fire
    // once a LATER round is already running on this same scene. Guard every
    // callback below with this flag so an abandoned round never mutates a
    // scene it no longer owns.
    let aborted = false;
    scene.events.once('shutdown', () => (aborted = true));

    const word = getWord(spec.wordId!);
    const container = scene.add.container(0, 0);
    const graphemes = word.graphemes;
    const hearts = new Set(word.heartIndexes ?? []);

    const title = readingText(scene, GAME_W / 2, 130, 'Memory word!', 40, '#ffffffcc');
    container.add(title);

    const bigHeart = emojiText(scene, GAME_W / 2, 225, '💜', 96);
    container.add(bigHeart);
    popIn(scene, bigHeart);

    // slots — same geometry as build-a-word so the ritual feels familiar
    const tileW = Math.min(120, (GAME_W - 200) / graphemes.length - 16);
    const tileH = 110;
    const slotY = 380;
    const slotX = (i: number) =>
      GAME_W / 2 + (i - (graphemes.length - 1) / 2) * (tileW + 18);
    const slotGraphics = scene.add.graphics();
    container.add(slotGraphics);
    for (let i = 0; i < graphemes.length; i++) {
      slotGraphics.lineStyle(4, ctx.theme.accent, 0.9);
      slotGraphics.strokeRoundedRect(slotX(i) - tileW / 2, slotY - tileH / 2, tileW, tileH, 16);
    }

    // Tiles start ASSEMBLED in the slots: she sees the whole word modeled
    // before it scatters. Heart graphemes ride with their own floating 💜
    // (a child of the tile, so the badge follows through every move).
    const tiles: (Button | null)[] = [];
    const floatTweens: Phaser.Tweens.Tween[] = [];
    graphemes.forEach((g, gi) => {
      const isVowel = 'aeiou'.includes(g.toLowerCase());
      const tile = makeButton(
        scene,
        slotX(gi),
        slotY,
        // split graphemes ("a_e") read as a‿e — the e reaches back over the word
        (gi === 0 ? g : g.toLowerCase()).replace('_', '‿'),
        () => onTile(gi),
        {
          width: tileW,
          height: tileH,
          fontSize: 56,
          fill: 0xfff3d6,
          textColor: hearts.has(gi) ? HEART_COLOR : isVowel ? VOWEL_COLOR : '#26323f',
          reading: true,
        },
      );
      tile.disableInteractive(); // look, don't touch, until the scatter
      if (hearts.has(gi)) {
        const badge = emojiText(scene, 0, -tileH / 2 - 24, '💜', 30);
        tile.add(badge);
        floatTweens.push(
          scene.tweens.add({
            targets: badge,
            y: badge.y - 8,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          }),
        );
      }
      tiles[gi] = tile;
      container.add(tile);
      popIn(scene, tile, 200 + gi * 90);
    });

    const sayIt = () => void speakWord(word.id, word.text);
    let replay: Button | null = null;

    // Latency clock restarts at the scatter — the modeled intro is our
    // talking, not her thinking. Captured the instant the last tile lands,
    // NOT inside complete()'s celebration delay — else the fixed ~1.9s
    // celebration would be baked into every latency, making the "automatic"
    // mastery threshold structurally unreachable for this mechanic.
    let started = performance.now();
    let latencyMs = 0;
    let nextSlot = 0;
    let missesAtSlot = 0;
    let totalMisses = 0;
    let assisted = false;

    // tray order: shuffled until it differs from the built word
    let order = graphemes.map((_, i) => i);
    if (graphemes.length > 1) {
      do {
        order = Phaser.Utils.Array.Shuffle(order);
      } while (order.every((v, i) => v === i));
    }
    const trayY = 560;
    const trayX = (trayIdx: number) =>
      GAME_W / 2 + (trayIdx - (order.length - 1) / 2) * (tileW + 22);

    const scatter = () => {
      scene.tweens.add({
        targets: bigHeart,
        scale: 0,
        duration: 220,
        ease: 'Back.easeIn',
        onComplete: () => bigHeart.setVisible(false),
      });
      replay = makeButton(scene, GAME_W / 2, 225, '🔊', sayIt, {
        emoji: true,
        fontSize: 52,
        fill: ctx.theme.accent,
        width: 110,
        height: 90,
      });
      container.add(replay);
      popIn(scene, replay);
      order.forEach((gi, trayIdx) => {
        const tile = tiles[gi]!;
        scene.tweens.add({
          targets: tile,
          x: trayX(trayIdx),
          y: trayY,
          delay: trayIdx * 70,
          duration: 420,
          ease: 'Cubic.easeInOut',
          onComplete: () => tile.setInteractive({ useHandCursor: true }),
        });
      });
      started = performance.now();
      void speakUI('memory-word-build', 'Now you build it — you remember!');
    };

    // Intro moment: name the ritual, model the word, let the assembled
    // word sit for one quiet beat, then scatter.
    const intro = async () => {
      await speakUI(
        'memory-word-intro',
        'This is a memory word. The heart part breaks the rules — we just remember it!',
      );
      if (aborted) return;
      await speakWord(word.id, word.text);
      if (aborted) return;
      scene.time.delayedCall(900, () => {
        if (!aborted) scatter();
      });
    };
    void intro();

    const onTile = (gi: number) => {
      const tile = tiles[gi];
      if (!tile) return;
      if (gi === nextSlot) {
        // correct next piece: fly it home — but a heart grapheme gets NO
        // letter sound (it breaks the rules), just a soft "remembered!" chime
        tiles[gi] = null;
        tile.disableInteractive();
        if (hearts.has(gi)) chime('gentle');
        else void speakGrapheme(graphemes[gi]!);
        scene.tweens.add({
          targets: tile,
          x: slotX(gi),
          y: slotY,
          duration: 300,
          ease: 'Back.easeOut',
        });
        scene.tweens.add({ targets: tile, scale: 1.12, duration: 150, yoyo: true, delay: 300 });
        nextSlot++;
        missesAtSlot = 0;
        if (nextSlot === graphemes.length) {
          latencyMs = Math.round(performance.now() - started);
          complete();
        }
      } else {
        totalMisses++;
        missesAtSlot++;
        wiggle(scene, tile);
        chime('gentle');
        if (missesAtSlot >= 2) {
          assisted = true;
          const correct = tiles[nextSlot];
          if (correct) {
            scene.tweens.add({ targets: correct, scale: 1.15, duration: 350, yoyo: true, repeat: 2 });
          }
          void speakUI('memory-this-one', 'It goes like this — this one!').then(sayIt);
        } else {
          void speakUI('try-again', 'Hmm, try again!').then(sayIt);
        }
      }
    };

    const complete = () => {
      chime('good');
      void speakWord(word.id, word.text);
      if (word.emoji) {
        const pic = emojiText(scene, GAME_W / 2, 225, word.emoji, 110);
        container.add(pic);
        replay?.setVisible(false);
        popIn(scene, pic);
      }
      confettiBurst(scene, GAME_W / 2, slotY - 60, ctx.theme.accent);
      void speakUI('you-remembered-it', `You remembered it! ${word.text}!`);
      const warm = readingText(scene, GAME_W / 2, 655, 'You remembered it! 💜', 34, '#ffe9a8');
      container.add(warm);
      popIn(scene, warm, 250);
      scene.time.delayedCall(1900, () => {
        if (aborted) return;
        // infinite badge tweens must die by hand — destroy() won't stop them
        floatTweens.forEach((t) => t.destroy());
        container.destroy();
        resolve({
          itemId: word.id,
          correct: true,
          firstTry: totalMisses === 0,
          latencyMs,
          assisted,
        });
      });
    };
  });
};
