/**
 * Composes one session chunk (~8 rounds) for a game level: a word queue from
 * the adaptive model, mechanics interleaved across word and sentence grains.
 * Pure — takes progress data in, returns RoundSpecs out.
 */
import { LEVELS } from '../content/levels';
import { WORDS } from '../content/words';
import { SENTENCES } from '../content/sentences';
import type { Word } from '../content/types';
import type { ProgressData } from '../services/progress';
import { planQueue } from './adaptive';
import type { RoundSpec } from './rounds';

/** The game may introduce material slightly ahead of the parent's book marker. */
export const BOOK_LOOKAHEAD = 2;

export function lessonCapFor(levelId: number, bookLesson: number): number {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) throw new Error(`Unknown level ${levelId}`);
  const [from, to] = level.lessonRange;
  // never below the level's first content lesson +1 (a tapped level always has words),
  // never above the level's range
  return Math.min(to, Math.max(bookLesson + BOOK_LOOKAHEAD, from + 1));
}

export function wordsForLevel(levelId: number, bookLesson: number): Word[] {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return [];
  const cap = lessonCapFor(levelId, bookLesson);
  return WORDS.filter((w) => w.lesson >= level.lessonRange[0] && w.lesson <= cap);
}

/** Pick 2 written-choice distractors that force full decoding (minimal pairs). */
export function pickDistractors(target: Word, pool: Word[], random = Math.random): string[] {
  const others = pool.filter((w) => w.id !== target.id);
  const scored = others
    .map((w) => {
      let score = 0;
      if (w.graphemes[0]?.toLowerCase() === target.graphemes[0]?.toLowerCase()) score += 3;
      if (w.graphemes.at(-1)?.toLowerCase() === target.graphemes.at(-1)?.toLowerCase()) score += 2;
      if (Math.abs(w.text.length - target.text.length) <= 1) score += 2;
      const sharedVowel = w.graphemes.some(
        (g) => 'aeiou'.includes(g.toLowerCase()) && target.graphemes.includes(g),
      );
      if (sharedVowel) score += 1;
      return { w, score: score + random() }; // jitter breaks ties differently each time
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((s) => s.w.id);
}

export function planSession(
  levelId: number,
  progress: ProgressData,
  random = Math.random,
): RoundSpec[] {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) throw new Error(`Unknown level ${levelId}`);

  const levelWords = wordsForLevel(levelId, progress.bookLesson);
  const cap = lessonCapFor(levelId, progress.bookLesson);

  const newIds = levelWords.map((w) => w.id);
  const seenIds = Object.keys(progress.words).filter(
    (id) => (progress.words[id]?.exposures ?? 0) > 0,
  );

  const queue = planQueue({
    newIds,
    seenIds,
    stats: progress.words,
    slots: 6,
    random,
  });

  // sentences available in this level's range (respecting the book marker)
  const sentencePool = SENTENCES.filter(
    (s) => s.lesson >= level.lessonRange[0] && s.lesson <= cap,
  );
  const sentences = shuffle(sentencePool, random).slice(0, 2);

  const wordById = new Map(WORDS.map((w) => [w.id, w]));
  const rounds: RoundSpec[] = [];

  queue.forEach((wordId, i) => {
    const word = wordById.get(wordId);
    if (!word) return;
    if (i % 2 === 0) {
      rounds.push({
        mechanic: 'feed-creature',
        wordId,
        distractorIds: pickDistractors(word, levelWords.length >= 3 ? levelWords : WORDS, random),
        realm: level.realm,
      });
    } else {
      rounds.push({ mechanic: 'build-word', wordId, realm: level.realm });
    }
  });

  // weave sentence rounds in at positions 3 and end — sentence comprehension
  // is the core loop, never an afterthought
  const [s1, s2] = sentences;
  if (s1) rounds.splice(Math.min(3, rounds.length), 0, { mechanic: 'sentence-picture', sentenceId: s1.id, realm: level.realm });
  if (s2) rounds.push({ mechanic: 'sentence-picture', sentenceId: s2.id, realm: level.realm });

  return rounds;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
