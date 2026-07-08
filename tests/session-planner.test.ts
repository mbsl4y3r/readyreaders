import { describe, it, expect } from 'vitest';
import {
  planSession,
  lessonCapFor,
  wordsForLevel,
  phrasesForLevel,
  memoryWordsForLevel,
  pickDistractors,
  speedRoundFor,
  familySortFor,
  rimeOf,
  levelMastered,
  planReview,
} from '../src/engine/session-planner';
import { freshProgress, freshStat } from '../src/services/progress';
import { highestLevelForBookLesson } from '../src/content/levels';
import { getWord, WORDS_BY_ID } from '../src/content/words';
import { SENTENCES } from '../src/content/sentences';
import { PHRASES } from '../src/content/phrases';

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

describe('phrase and memory-word pools', () => {
  it('phrasesForLevel stays inside the level range and the lesson cap', () => {
    const phrases = phrasesForLevel(2, 17); // level 2 = lessons 10-17, cap 17
    expect(phrases.length).toBeGreaterThan(0);
    for (const p of phrases) {
      expect(p.lesson).toBeGreaterThanOrEqual(10);
      expect(p.lesson).toBeLessThanOrEqual(17);
    }
    // marker way behind: level 3's pool is clipped to the from+1 floor cap
    for (const p of phrasesForLevel(3, 1)) {
      expect(p.lesson).toBeGreaterThanOrEqual(18);
      expect(p.lesson).toBeLessThanOrEqual(19);
    }
  });

  it('memoryWordsForLevel returns only heart-marked words inside the cap', () => {
    const mem = memoryWordsForLevel(1, 17); // "was" (lesson 5) lives here
    expect(mem.map((w) => w.id)).toContain('was');
    for (const w of mem) {
      expect(w.heartIndexes?.length ?? 0).toBeGreaterThan(0);
      expect(w.lesson).toBeGreaterThanOrEqual(1);
      expect(w.lesson).toBeLessThanOrEqual(9);
    }
    // "the" (lesson 19) reaches level 3 through the +2 lookahead at marker 17
    expect(memoryWordsForLevel(3, 17).map((w) => w.id)).toContain('the');
    for (const w of memoryWordsForLevel(3, 30)) {
      expect(w.heartIndexes?.length ?? 0).toBeGreaterThan(0);
      expect(w.lesson).toBeLessThanOrEqual(30);
    }
  });
});

describe('planSession phrase and memory rounds', () => {
  it('weaves in exactly one magic-phrase round when phrases exist', () => {
    for (const levelId of [1, 2, 3]) {
      const rounds = planSession(levelId, freshProgress(), rng);
      const phraseRounds = rounds.filter((r) => r.mechanic === 'magic-phrase');
      expect(phraseRounds).toHaveLength(1);
      const phrase = PHRASES.find((p) => p.id === phraseRounds[0]!.phraseId)!;
      expect(phrase).toBeDefined();
      expect(phrase.lesson).toBeLessThanOrEqual(17 + 2); // fresh marker + lookahead
    }
  });

  it('adds at most one memory-word round — a heart word, converted not doubled', () => {
    for (const levelId of [1, 2, 3]) {
      const rounds = planSession(levelId, freshProgress(), rng);
      const memory = rounds.filter((r) => r.mechanic === 'memory-word');
      expect(memory.length).toBeLessThanOrEqual(1);
      for (const m of memory) {
        const w = getWord(m.wordId!);
        expect(w.heartIndexes?.length ?? 0).toBeGreaterThan(0);
        // conversion, not duplication: no other round drills the same word
        expect(rounds.filter((r) => r !== m && r.wordId === m.wordId)).toHaveLength(0);
      }
    }
    // level 1 always has an unmastered heart word ("was") on a fresh save
    const rounds = planSession(1, freshProgress(), rng);
    expect(rounds.filter((r) => r.mechanic === 'memory-word')).toHaveLength(1);
  });
});

describe('speed round', () => {
  /** A save where every level-1 word is known (mastery 1+). */
  const knownProgress = () => {
    const progress = freshProgress();
    for (const w of wordsForLevel(1, 17)) {
      progress.words[w.id] = { ...freshStat(), exposures: 3, firstTryCorrect: 3, mastery: 1 };
    }
    return progress;
  };

  it('never fires on a fresh save — fluency practice needs known words first', () => {
    expect(speedRoundFor(1, freshProgress(), rng)).toBeNull();
    const rounds = planSession(1, freshProgress(), rng);
    expect(rounds.filter((r) => r.mechanic === 'speed-round')).toHaveLength(0);
  });

  it('picks 5 known words once the level has them, and caps the session', () => {
    const spec = speedRoundFor(1, knownProgress(), rng);
    expect(spec).not.toBeNull();
    expect(spec!.speedWordIds).toHaveLength(5);
    expect(new Set(spec!.speedWordIds).size).toBe(5);

    const rounds = planSession(1, knownProgress(), rng);
    const speed = rounds.filter((r) => r.mechanic === 'speed-round');
    expect(speed).toHaveLength(1);
    expect(rounds.at(-1)!.mechanic).toBe('speed-round'); // fluency is the finish line
  });

  it('excludes mastery-0 words even when others qualify', () => {
    const progress = knownProgress();
    progress.words['sat'] = { ...freshStat(), exposures: 2, mastery: 0 };
    for (let i = 0; i < 20; i++) {
      const spec = speedRoundFor(1, progress, rng);
      expect(spec!.speedWordIds).not.toContain('sat');
    }
  });
});

describe('family sort', () => {
  it('rimeOf groups by the last two graphemes and skips rule-breakers', () => {
    expect(rimeOf(getWord('cat'))).toBe('at');
    expect(rimeOf(getWord('man'))).toBe('an');
    expect(rimeOf(getWord('was'))).toBeNull(); // memory word — no pattern lesson
  });

  it('builds two families with 2–3 words each, all genuinely ending in their family', () => {
    const spec = familySortFor(1, freshProgress(), rng);
    expect(spec).not.toBeNull();
    const { families, wordIds } = spec!.family!;
    expect(families[0]).not.toBe(families[1]);
    expect(wordIds.length).toBeGreaterThanOrEqual(4);
    expect(wordIds.length).toBeLessThanOrEqual(6);
    for (const id of wordIds) {
      const w = getWord(id);
      expect(families.some((f) => w.text.toLowerCase().endsWith(f))).toBe(true);
    }
  });
});

describe('highestLevelForBookLesson (island opens with the book marker)', () => {
  it('opens the next level once the marker reaches its first lesson', () => {
    expect(highestLevelForBookLesson(1)).toBe(1);
    expect(highestLevelForBookLesson(9)).toBe(1);
    expect(highestLevelForBookLesson(10)).toBe(2); // level 2 starts at lesson 10
    expect(highestLevelForBookLesson(17)).toBe(2); // fresh-save default → levels 1–2
    expect(highestLevelForBookLesson(18)).toBe(3);
    expect(highestLevelForBookLesson(120)).toBe(9);
  });
});

describe('levelMastered (gentle unlock)', () => {
  it('is false on a fresh save and true once 65% of words are known', () => {
    expect(levelMastered(1, freshProgress())).toBe(false);

    const progress = freshProgress();
    const words = wordsForLevel(1, progress.bookLesson);
    // mark exactly ~70% at mastery ≥1 (known)
    const n = Math.ceil(words.length * 0.7);
    words.slice(0, n).forEach((w) => {
      progress.words[w.id] = { ...freshStat(), exposures: 3, firstTryCorrect: 2, mastery: 1 };
    });
    expect(levelMastered(1, progress)).toBe(true);

    // only ~40% known → still locked
    const partial = freshProgress();
    words.slice(0, Math.floor(words.length * 0.4)).forEach((w) => {
      partial.words[w.id] = { ...freshStat(), exposures: 3, firstTryCorrect: 2, mastery: 1 };
    });
    expect(levelMastered(1, partial)).toBe(false);
  });
});

describe('planReview', () => {
  it('falls back to a normal session before anything is seen', () => {
    const rounds = planReview(freshProgress(), rng);
    expect(rounds.length).toBeGreaterThanOrEqual(6);
  });

  it('drills only already-seen words — never introduces new ones', () => {
    const progress = freshProgress();
    const seen = wordsForLevel(1, progress.bookLesson).slice(0, 6);
    seen.forEach((w) => {
      progress.words[w.id] = { ...freshStat(), exposures: 4, firstTryCorrect: 3, mastery: 2 };
    });
    const seenIds = new Set(seen.map((w) => w.id));
    const rounds = planReview(progress, rng);
    const wordRounds = rounds.filter((r) => r.wordId);
    expect(wordRounds.length).toBeGreaterThan(0);
    for (const r of wordRounds) {
      expect(seenIds.has(r.wordId!), `review used unseen word ${r.wordId}`).toBe(true);
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
