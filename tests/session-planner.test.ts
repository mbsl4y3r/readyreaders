import { describe, it, expect } from 'vitest';
import {
  planSession,
  lessonCapFor,
  wordsForLevel,
  pickDistractors,
} from '../src/engine/session-planner';
import { freshProgress } from '../src/services/progress';
import { getWord, WORDS_BY_ID } from '../src/content/words';
import { SENTENCES } from '../src/content/sentences';

const rng = (() => {
  let seed = 42;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
})();

describe('book-marker gating', () => {
  it('caps new material at bookLesson + lookahead', () => {
    expect(lessonCapFor(3, 17)).toBe(19); // level 3 = lessons 18-30; Evie on 17 → cap 19
    expect(lessonCapFor(3, 30)).toBe(30); // never past the level's range
    expect(lessonCapFor(1, 17)).toBe(9); // level 1 range is 1-9
  });

  it('a level ahead of the marker still has some words', () => {
    const words = wordsForLevel(3, 1); // marker way behind
    expect(words.length).toBeGreaterThan(0);
    expect(Math.max(...words.map((w) => w.lesson))).toBeLessThanOrEqual(19);
  });
});

describe('planSession', () => {
  it('produces word rounds plus sentence rounds, all within the lesson cap', () => {
    const progress = freshProgress(); // bookLesson 17
    const rounds = planSession(2, progress, rng);
    expect(rounds.length).toBeGreaterThanOrEqual(6);

    const sentenceRounds = rounds.filter((r) => r.mechanic === 'sentence-picture');
    expect(sentenceRounds.length).toBeGreaterThanOrEqual(1); // never deferred

    for (const r of rounds) {
      if (r.wordId) {
        const w = getWord(r.wordId);
        expect(w.lesson).toBeLessThanOrEqual(17 + 2);
      }
      if (r.sentenceId) {
        const s = SENTENCES.find((x) => x.id === r.sentenceId)!;
        expect(s.lesson).toBeLessThanOrEqual(17 + 2);
      }
    }
  });

  it('feed rounds carry two real distractors', () => {
    const rounds = planSession(1, freshProgress(), rng);
    for (const r of rounds.filter((r) => r.mechanic === 'feed-creature')) {
      expect(r.distractorIds).toHaveLength(2);
      for (const id of r.distractorIds!) {
        expect(WORDS_BY_ID.has(id)).toBe(true);
        expect(id).not.toBe(r.wordId);
      }
    }
  });
});

describe('pickDistractors', () => {
  it('prefers minimal pairs (shared first/last grapheme, similar length)', () => {
    const pool = ['ship', 'shop', 'shut', 'fish', 'bath', 'dog'].map(getWord);
    const picked = pickDistractors(getWord('ship'), pool, rng);
    expect(picked).toHaveLength(2);
    // shop shares onset+length with ship and should always beat "dog"
    expect(picked).toContain('shop');
    expect(picked).not.toContain('dog');
  });
});
