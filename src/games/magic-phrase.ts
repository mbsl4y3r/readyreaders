/**
 * Magic phrase — short decodable chunks, the stepping stone between single
 * words and sentences. Three beats: (1) she reads the phrase big (a replay
 * button offers a model but never forces one), (2) declares the read,
 * (3) a listen-and-tap word check keeps the declaration honest. Pictures
 * and the fluent re-read arrive only AFTER — reward, not crutch.
 */
import Phaser from 'phaser';
import { PHRASES } from '../content/phrases';
import { WORDS_BY_ID } from '../content/words';
import { speakPhrase, speakWord, speakUI, chime } from '../services/audio';
import {
  GAME_W,
  GAME_H,
  makeButton,
  emojiText,
  readingText,
  wiggle,
  popIn,
  confettiBurst,
  type Button,
} from '../ui/kit';
import type { RunRound } from './types';

export const runMagicPhrase: RunRound = (scene, spec, ctx) => {
  return new Promise((resolve) => {
    // Phaser reuses the scene instance across visits, so an audio-chain
    // callback or delayed call left pending when she taps home can still
    // fire once a LATER round is running on this same scene — mounting a
    // ghost UI on top of it. Guard every such callback with this flag.
    let aborted = false;
    scene.events.once('shutdown', () => (aborted = true));

    const phrase = PHRASES.find((p) => p.id === spec.phraseId);
    if (!phrase) throw new Error(`Unknown phrase ${spec.phraseId}`);
    const container = scene.add.container(0, 0);

    const title = readingText(scene, GAME_W / 2, 120, 'Magic phrase! ✨', 40, '#ffffffcc');
    container.add(title);

    // The phrase, big and crisp — this is the thing she reads.
    const text = readingText(scene, GAME_W / 2, 260, phrase.text, 54);
    if (text.width > GAME_W - 80) {
      text.setStyle({ wordWrap: { width: GAME_W - 120 } });
      text.setFontSize(46);
    }
    container.add(text);

    const replay = makeButton(
      scene,
      GAME_W / 2,
      410,
      '🔊',
      () => void speakPhrase(phrase.id, phrase.text),
      { emoji: true, fontSize: 52, fill: ctx.theme.accent, width: 110, height: 90 },
    );
    container.add(replay);

    let started = performance.now();
    let latencyMs = 0;
    let misses = 0;
    let assisted = false;
    let done = false;

    // reset once the prompt finishes — trust-path latency measures HER time,
    // not the fixed narration length (which would else make the "known"
    // mastery threshold structurally unreachable for short phrases)
    void speakUI('read-phrase', 'Read the magic phrase. Then tap "I read it!"').then(() => {
      if (!aborted) started = performance.now();
    });

    const displayWords = phrase.text.split(' ');

    // A fair tap target must be unique in the phrase (never ask for "a" when
    // "a" appears twice), and content words of 3+ letters carry the meaning.
    const counts = new Map<string, number>();
    for (const id of phrase.wordIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    const usable = phrase.wordIds
      .map((_, i) => i)
      .filter((i) => counts.get(phrase.wordIds[i]!) === 1);
    const preferred = usable.filter((i) => (displayWords[i] ?? '').length >= 3);
    const candidates = preferred.length > 0 ? preferred : usable;

    const finishRound = () => {
      chime('good');
      confettiBurst(scene, GAME_W / 2, 300, ctx.theme.accent);
      // the phrase's pictures appear only now, AFTER the decode
      const emojis = [...new Set(phrase.wordIds)]
        .map((id) => WORDS_BY_ID.get(id)?.emoji)
        .filter((e): e is string => e !== undefined);
      emojis.forEach((e, i) => {
        const pic = emojiText(
          scene,
          GAME_W / 2 + (i - (emojis.length - 1) / 2) * 130,
          GAME_H - 130,
          e,
          92,
        );
        container.add(pic);
        popIn(scene, pic, 200 + i * 140);
      });
      // hear it read fluently, then move on
      void speakUI('listen', 'Yes! Listen:')
        .then(() => speakPhrase(phrase.id, phrase.text))
        .then(() => {
          if (aborted) return;
          scene.time.delayedCall(900, () => {
            if (aborted) return;
            container.destroy();
            resolve({
              itemId: phrase.id,
              correct: !assisted,
              firstTry: misses === 0,
              latencyMs,
              assisted,
            });
          });
        });
    };

    // Beat 3: prove the read — hear one word from the phrase, tap its card.
    const showWordCheck = () => {
      text.destroy();
      replay.destroy();
      const target = Phaser.Utils.Array.GetRandom(candidates);
      const sayTarget = () => void speakWord(phrase.wordIds[target]!, displayWords[target]!);

      const prompt = readingText(scene, GAME_W / 2, 210, 'Tap the word you heard!', 34, '#ffffffcc');
      container.add(prompt);

      const wordReplay = makeButton(scene, GAME_W / 2, 310, '🔊', sayTarget, {
        emoji: true,
        fontSize: 44,
        fill: ctx.theme.accent,
        width: 100,
        height: 84,
      });
      container.add(wordReplay);

      void speakUI('tap-heard', 'Tap the word you heard!').then(() => {
        if (!aborted) sayTarget();
      });

      const onCard = (i: number, card: Button, cardButtons: Button[]) => {
        if (done) return;
        if (i === target) {
          done = true;
          latencyMs = Math.round(performance.now() - started);
          prompt.destroy();
          wordReplay.setVisible(false);
          cardButtons.forEach((b) => b !== card && b.setAlpha(0.25));
          scene.tweens.add({ targets: card, scale: 1.15, duration: 300, ease: 'Back.easeOut' });
          finishRound();
        } else {
          misses++;
          wiggle(scene, card);
          chime('gentle');
          card.setEnabled(false);
          if (misses >= 2) {
            // model it: the correct card pulses "here I am" — no fail state
            assisted = true;
            const correctCard = cardButtons[target]!;
            scene.tweens.add({ targets: correctCard, scale: 1.12, duration: 380, yoyo: true, repeat: 2 });
            void speakUI('this-word', 'This one! Tap it!').then(() => {
              if (!aborted) sayTarget();
            });
          } else {
            void speakUI('listen-tap', 'Listen again, then tap it!').then(() => {
              if (!aborted) sayTarget();
            });
          }
        }
      };

      // one card per word, auto-sized then laid out in centred rows so long
      // phrases wrap instead of squashing below finger size
      const cardButtons: Button[] = [];
      displayWords.forEach((dw, i) => {
        const card = makeButton(scene, 0, 0, dw, () => onCard(i, card, cardButtons), {
          height: 104,
          fontSize: 46,
        });
        cardButtons.push(card);
        container.add(card);
      });
      const gapX = 30;
      const rows: Button[][] = [[]];
      let rowW = 0;
      for (const card of cardButtons) {
        if (rowW > 0 && rowW + card.width + gapX > GAME_W - 100) {
          rows.push([]);
          rowW = 0;
        }
        rows[rows.length - 1]!.push(card);
        rowW += card.width + gapX;
      }
      let popIdx = 0;
      rows.forEach((row, r) => {
        const totalW = row.reduce((sum, c) => sum + c.width, 0) + gapX * (row.length - 1);
        let x = GAME_W / 2 - totalW / 2;
        row.forEach((card) => {
          card.setPosition(x + card.width / 2, 460 + r * 128);
          x += card.width + gapX;
          popIn(scene, card, 120 + popIdx++ * 90);
        });
      });

      // latency counts from the moment the cards are visible
      started = performance.now();
    };

    // Beat 1 → 2: she declares the read; only then does the check appear.
    const readItBtn = makeButton(
      scene,
      GAME_W / 2,
      560,
      'I read it! ⭐',
      () => {
        readItBtn.destroy();
        if (usable.length <= 2) {
          // 1–2 distinct words can't make a fair tap check — trust the read
          // (like sentence-picture's declared-read step)
          done = true;
          latencyMs = Math.round(performance.now() - started);
          replay.setVisible(false);
          finishRound();
        } else {
          showWordCheck();
        }
      },
      { fill: ctx.theme.accent, fontSize: 40, height: 92 },
    );
    container.add(readItBtn);
    popIn(scene, readItBtn, 400);
  });
};
