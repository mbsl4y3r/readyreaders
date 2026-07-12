/**
 * Build-a-word: hear the word, assemble grapheme tiles into slots — the
 * game version of the book's "h a m → ham" arrow blending. Digraphs are
 * single fused tiles ("two letters work together to make one sound").
 * The picture reveals only AFTER the word is built.
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

export const runBuildWord: RunRound = (scene, spec, ctx) => {
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

    const title = readingText(scene, GAME_W / 2, 130, 'Build the word!', 40, '#ffffffcc');
    container.add(title);

    const sayIt = () => void speakWord(word.id, word.text);
    const replay = makeButton(scene, GAME_W / 2, 225, '🔊', sayIt, {
      emoji: true,
      fontSize: 52,
      fill: ctx.theme.accent,
      width: 110,
      height: 90,
    });
    container.add(replay);
    void speakUI('build-the-word', 'Build the word:').then(sayIt);

    // slots
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

    // tray tiles: this word's graphemes, shuffled until not already in order
    let order = graphemes.map((_, i) => i);
    if (graphemes.length > 1) {
      do {
        order = Phaser.Utils.Array.Shuffle(order);
      } while (order.every((v, i) => v === i));
    }

    const started = performance.now();
    let nextSlot = 0;
    let missesAtSlot = 0;
    let totalMisses = 0;
    let assisted = false;
    const tiles: (Button | null)[] = [];

    const trayY = 560;
    order.forEach((gi, trayIdx) => {
      const g = graphemes[gi]!;
      const x = GAME_W / 2 + (trayIdx - (order.length - 1) / 2) * (tileW + 22);
      const isVowel = 'aeiou'.includes(g.toLowerCase());
      // split graphemes ("a_e") read as a‿e — the e reaches back over the word
      const label = (nextSlot === 0 && gi === 0 ? g : g.toLowerCase()).replace('_', '‿');
      const tile = makeButton(
        scene,
        x,
        trayY,
        label,
        () => onTile(gi),
        {
          width: tileW,
          height: tileH,
          fontSize: 56,
          fill: 0xfff3d6,
          textColor: isVowel ? '#d1495b' : '#26323f',
          reading: true,
        },
      );
      tiles[gi] = tile;
      container.add(tile);
      popIn(scene, tile, 100 + trayIdx * 90);
    });

    const onTile = (gi: number) => {
      const tile = tiles[gi];
      if (!tile) return;
      if (gi === nextSlot) {
        // correct next piece: fly it into its slot, say its sound if recorded
        tiles[gi] = null;
        tile.disableInteractive();
        void speakGrapheme(graphemes[gi]!);
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
        if (nextSlot === graphemes.length) complete();
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
          void speakUI('next-sound', 'Find the next sound — this one!').then(sayIt);
        } else {
          void speakUI('try-again', 'Hmm, try again!').then(sayIt);
        }
      }
    };

    const complete = () => {
      chime('good');
      // "say the sounds together fast" — model the whole word
      void speakWord(word.id, word.text);
      if (word.emoji) {
        const pic = emojiText(scene, GAME_W / 2, 225, word.emoji, 110);
        container.add(pic);
        replay.setVisible(false);
        popIn(scene, pic);
      }
      confettiBurst(scene, GAME_W / 2, slotY - 60, ctx.theme.accent);
      void speakUI('you-read-it', `You built it! ${word.text}!`);
      scene.time.delayedCall(1700, () => {
        if (aborted) return;
        container.destroy();
        resolve({
          itemId: word.id,
          correct: true,
          firstTry: totalMisses === 0,
          latencyMs: Math.round(performance.now() - started),
          assisted,
        });
      });
    };
  });
};
