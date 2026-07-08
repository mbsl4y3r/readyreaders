/**
 * Composes one session chunk (~8 rounds) for a game level: a word queue from
 * the adaptive model, mechanics interleaved across word and sentence grains.
 * Pure — takes progress data in, returns RoundSpecs out.
 */
import { LEVELS } from '../content/levels';
import { WORDS } from '../content/words';
import { SENTENCES } from '../content/sentences';
import { PHRASES } from '../content/phrases';
import type { Phrase, Word } from '../content/types';
import type { ProgressData } from '../services/progress';
import { planQueue, speedRoundPool } from './adaptive';
import { isSplitGrapheme } from '../content/decodability';
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

/** Phrases readable in this level right now (respects the book marker). */
export function phrasesForLevel(levelId: number, bookLesson: number): Phrase[] {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return [];
  const cap = lessonCapFor(levelId, bookLesson);
  return PHRASES.filter((p) => p.lesson >= level.lessonRange[0] && p.lesson <= cap);
}

/** Progress key for phrase stats (kept apart from word stats). */
export const phraseStatKey = (phraseId: string): string => `phr:${phraseId}`;

/** Memory words (heart-marked) in this level's readable range. */
export function memoryWordsForLevel(levelId: number, bookLesson: number): Word[] {
  return wordsForLevel(levelId, bookLesson).filter((w) => (w.heartIndexes?.length ?? 0) > 0);
}

/**
 * The lightning round: 5 words she already reads accurately (mastery ≥ 1 —
 * fluency practice NEVER runs on shaky material), or null when the level
 * hasn't built up enough known words yet.
 */
export function speedRoundFor(
  levelId: number,
  progress: ProgressData,
  random: () => number = Math.random,
): RoundSpec | null {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return null;
  const pool = speedRoundPool(
    wordsForLevel(levelId, progress.bookLesson).map((w) => w.id),
    progress.words,
  );
  if (pool.length < 5) return null;
  return {
    mechanic: 'speed-round',
    speedWordIds: shuffle(pool, random).slice(0, 5),
    realm: level.realm,
  };
}

/** Rime family of a word: its graphemes from the last vowel-ish unit on ("cat" → "at"). */
export function rimeOf(word: Word): string | null {
  if (word.graphemes.length < 2) return null;
  if (word.heartIndexes?.length) return null; // rule-breakers don't teach patterns
  if (word.graphemes.some(isSplitGrapheme)) return null; // wrap-arounds sort visually wrong
  return word.graphemes.slice(-2).join('').toLowerCase();
}

/**
 * A family-sort round: two rime families from this level with ≥2 sortable
 * words each (4–6 cards total), or null when the level can't support one.
 */
export function familySortFor(
  levelId: number,
  progress: ProgressData,
  random: () => number = Math.random,
): RoundSpec | null {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return null;
  const byRime = new Map<string, Word[]>();
  for (const w of wordsForLevel(levelId, progress.bookLesson)) {
    const rime = rimeOf(w);
    if (!rime) continue;
    (byRime.get(rime) ?? byRime.set(rime, []).get(rime)!).push(w);
  }
  const families = shuffle(
    [...byRime.entries()].filter(([, ws]) => ws.length >= 2),
    random,
  ).slice(0, 2);
  if (families.length < 2) return null;
  const wordIds = shuffle(
    families.flatMap(([, ws]) => shuffle(ws, random).slice(0, 3).map((w) => w.id)),
    random,
  );
  return {
    mechanic: 'family-sort',
    family: { families: [families[0]![0], families[1]![0]], wordIds },
    realm: level.realm,
  };
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
  // phrase/sentence stats share this map under 'phr:'/'sent:' prefixed keys —
  // exclude them here or they crowd out real words in the working set (their
  // trust-path latencies are seconds long, which reads as "struggling").
  const seenIds = Object.keys(progress.words).filter(
    (id) => !id.includes(':') && (progress.words[id]?.exposures ?? 0) > 0,
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

  // memory words get their own ritual: convert one word round to the
  // memory-word mechanic (weakest heart-word first), or teach a fresh one early
  const memPool = memoryWordsForLevel(levelId, progress.bookLesson).filter(
    (w) => (progress.words[w.id]?.mastery ?? 0) < 3,
  );
  if (memPool.length > 0) {
    const weakest = [...memPool].sort(
      (a, b) =>
        (progress.words[a.id]?.mastery ?? 0) - (progress.words[b.id]?.mastery ?? 0) ||
        (progress.words[a.id]?.exposures ?? 0) - (progress.words[b.id]?.exposures ?? 0),
    )[0]!;
    const existing = rounds.find((r) => r.wordId === weakest.id);
    if (existing) {
      existing.mechanic = 'memory-word';
      delete existing.distractorIds;
    } else {
      rounds.splice(Math.min(1, rounds.length), 0, {
        mechanic: 'memory-word',
        wordId: weakest.id,
        realm: level.realm,
      });
    }
  }

  // weave sentence rounds in at positions 3 and end — sentence comprehension
  // is the core loop, never an afterthought
  const [s1, s2] = sentences;
  if (s1) rounds.splice(Math.min(3, rounds.length), 0, { mechanic: 'sentence-picture', sentenceId: s1.id, realm: level.realm });
  if (s2) rounds.push({ mechanic: 'sentence-picture', sentenceId: s2.id, realm: level.realm });

  // one magic phrase mid-chunk — the bridge between words and sentences.
  // least-practised first; jitter is assigned once per phrase (not inside the
  // comparator — an inconsistent comparator makes sort order engine-defined)
  const phrasePool = phrasesForLevel(levelId, progress.bookLesson);
  if (phrasePool.length > 0) {
    const pick = phrasePool
      .map((p) => ({
        p,
        score: (progress.words[phraseStatKey(p.id)]?.exposures ?? 0) + random() * 0.5,
      }))
      .sort((a, b) => a.score - b.score)[0]!.p;
    rounds.splice(Math.min(5, rounds.length), 0, {
      mechanic: 'magic-phrase',
      phraseId: pick.id,
      realm: level.realm,
    });
  }

  // family-sort in roughly every other session (pattern play, not core drill)
  if (random() < 0.5) {
    const family = familySortFor(levelId, progress, random);
    if (family) rounds.splice(Math.min(2, rounds.length), 0, family);
  }

  // the lightning round caps the session — fluency is the finish line
  const speed = speedRoundFor(levelId, progress, random);
  if (speed) rounds.push(speed);

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
