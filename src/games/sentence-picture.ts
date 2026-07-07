/**
 * Sentence→picture — the mechanic aimed straight at Evie's pain point.
 * Four beats: (1) she reads the sentence (pictures stay hidden — no
 * three-cueing), (2) picks the matching picture from 3 near-misses,
 * (3) hears it read fluently, (4) rereads it with expression.
 */
import Phaser from 'phaser';
import { SENTENCES } from '../content/sentences';
import { speakSentence, speakUI, chime } from '../services/audio';
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

export const runSentencePicture: RunRound = (scene, spec, ctx) => {
  return new Promise((resolve) => {
    const sentence = SENTENCES.find((s) => s.id === spec.sentenceId);
    if (!sentence) throw new Error(`Unknown sentence ${spec.sentenceId}`);
    const container = scene.add.container(0, 0);

    // The sentence, big and crisp — this is the thing she reads.
    const text = readingText(scene, GAME_W / 2, 200, sentence.text, 58);
    if (text.width > GAME_W - 80) {
      text.setStyle({ wordWrap: { width: GAME_W - 120 } });
      text.setFontSize(50);
    }
    container.add(text);

    const started = performance.now();
    let misses = 0;
    let done = false;

    void speakUI('read-sentence', 'Read the sentence. Then tap "I read it!"');

    // Beat 1 → 2: she declares she's read it; only then do pictures appear.
    const readItBtn = makeButton(
      scene,
      GAME_W / 2,
      420,
      'I read it! ⭐',
      () => {
        readItBtn.destroy();
        showPictures();
      },
      { fill: ctx.theme.accent, fontSize: 40, height: 92 },
    );
    container.add(readItBtn);
    popIn(scene, readItBtn, 400);

    const showPictures = () => {
      void speakUI('pick-picture', 'Which picture matches? You pick!');
      const options = Phaser.Utils.Array.Shuffle([
        { emoji: sentence.correctEmoji, correct: true },
        { emoji: sentence.distractorEmojis[0], correct: false },
        { emoji: sentence.distractorEmojis[1], correct: false },
      ]);
      const cardButtons: Button[] = [];
      options.forEach((opt, i) => {
        const x = GAME_W / 2 + (i - 1) * 300;
        const card = makeButton(
          scene,
          x,
          480,
          opt.emoji,
          () => {
            if (done) return;
            if (opt.correct) {
              done = true;
              chime('good');
              cardButtons.forEach((b) => b !== card && b.setAlpha(0.25));
              scene.tweens.add({ targets: card, scale: 1.15, y: 460, duration: 300, ease: 'Back.easeOut' });
              confettiBurst(scene, x, 420, ctx.theme.accent);
              // Beat 3: hear it read fluently…
              void speakUI('listen', 'Yes! Listen:')
                .then(() => speakSentence(sentence.id, sentence.text))
                .then(() => {
                  // Beat 4: …then read it again, with expression.
                  const prompt = sentence.rereadPrompt ?? 'Now read it again, nice and smooth!';
                  void speakUI(`reread-${sentence.id}`, prompt);
                  const rereadLabel = readingText(scene, GAME_W / 2, 620, '📖 ' + prompt, 30, '#ffe9a8');
                  container.add(rereadLabel);
                  popIn(scene, rereadLabel);
                  const doneBtn = makeButton(
                    scene,
                    GAME_W / 2,
                    GAME_H - 130,
                    'I read it again! ✨',
                    () => {
                      container.destroy();
                      resolve({
                        itemId: sentence.id,
                        correct: true,
                        firstTry: misses === 0,
                        latencyMs: Math.round(performance.now() - started),
                        assisted: misses >= 2,
                      });
                    },
                    { fill: 0xffe9a8, fontSize: 36, height: 84 },
                  );
                  container.add(doneBtn);
                  popIn(scene, doneBtn, 500);
                });
            } else {
              misses++;
              wiggle(scene, card);
              chime('gentle');
              card.setEnabled(false);
              if (misses >= 2) {
                const correctCard = cardButtons[options.findIndex((o) => o.correct)]!;
                scene.tweens.add({ targets: correctCard, scale: 1.12, duration: 380, yoyo: true, repeat: 2 });
                void speakUI('listen-match', 'Listen, then tap the match:').then(() =>
                  speakSentence(sentence.id, sentence.text),
                );
              } else {
                void speakUI('read-again-try', 'Read the sentence one more time, then try again!');
              }
            }
          },
          { width: 260, height: 190, fontSize: 76, emoji: true },
        );
        cardButtons.push(card);
        container.add(card);
        popIn(scene, card, i * 130);
      });
    };
  });
};
