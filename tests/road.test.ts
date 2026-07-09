import { describe, it, expect } from 'vitest';
import { freshProgress } from '../src/services/progress';
import {
  FREE_PASS_THROUGH,
  CHECKOUT_MIN_WORDS,
  canStartLessonToday,
  checkoutWordsFor,
  evaluateCheckout,
  passLesson,
  roadDone,
} from '../src/services/road';
import { planLesson, planCheckoutRetry } from '../src/engine/session-planner';
import { WORDS } from '../src/content/words';

const rng = (() => {
  let seed = 7;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
})();

describe('the daily lesson gate', () => {
  it('is always open in the catch-up zone, once a day after it', () => {
    const p = freshProgress();
    p.lastPassDate = '2026-07-09';
    p.lesson = 5;
    expect(canStartLessonToday(p, '2026-07-09')).toBe(true); // free zone

    p.lesson = FREE_PASS_THROUGH + 1;
    expect(canStartLessonToday(p, '2026-07-09')).toBe(false); // already passed today
    expect(canStartLessonToday(p, '2026-07-10')).toBe(true); // new day
  });
});

describe('check-out scoring (first-tap only, one forgiveness miss)', () => {
  it('passes on all-correct and on a single miss, fails on two', () => {
    const ok = { wordId: 'a', firstTry: true };
    const miss = { wordId: 'b', firstTry: false };
    expect(evaluateCheckout([ok, ok, ok]).passed).toBe(true);
    expect(evaluateCheckout([ok, miss, ok]).passed).toBe(true);
    const two = evaluateCheckout([ok, miss, { wordId: 'c', firstTry: false }]);
    expect(two.passed).toBe(false);
    expect(two.missedIds).toEqual(['b', 'c']);
    expect(evaluateCheckout([]).passed).toBe(false); // no gate, no pass
  });
});

describe('check-out words', () => {
  it("quizzes the lesson's own new words when it has enough", () => {
    const p = freshProgress();
    const words = checkoutWordsFor(1, p, rng);
    expect(words.length).toBeGreaterThanOrEqual(CHECKOUT_MIN_WORDS);
    for (const w of words) expect(w.lesson).toBe(1);
  });

  it('thin lessons borrow earlier review words so the gate is never empty', () => {
    const p = freshProgress();
    // find a lesson with no new words in our data
    const counts = new Map<number, number>();
    for (const w of WORDS) counts.set(w.lesson, (counts.get(w.lesson) ?? 0) + 1);
    let thin = 0;
    for (let l = 21; l <= 120; l++) {
      if (!counts.has(l)) {
        thin = l;
        break;
      }
    }
    expect(thin).toBeGreaterThan(0);
    const words = checkoutWordsFor(thin, p, rng);
    expect(words.length).toBeGreaterThanOrEqual(CHECKOUT_MIN_WORDS);
    for (const w of words) expect(w.lesson).toBeLessThan(thin);
  });
});

describe('passing a lesson', () => {
  it('advances the road, stamps the day, and keeps legacy markers in step', () => {
    const p = freshProgress();
    p.lesson = 17;
    p.checkoutMisses = ['sat'];
    const r = passLesson(p, '2026-07-09');
    expect(r.passedLesson).toBe(17);
    expect(r.crossedInto).toBeNull();
    expect(p.lesson).toBe(18);
    expect(p.lastPassDate).toBe('2026-07-09');
    expect(p.checkoutMisses).toEqual([]);
    expect(p.bookLesson).toBe(17);
    expect(p.currentLevel).toBeGreaterThanOrEqual(3); // lesson 18 opens level 3 content
  });

  it('crosses regions on every tenth lesson and finishes at 120', () => {
    const p = freshProgress();
    p.lesson = 10;
    expect(passLesson(p, '2026-07-09').crossedInto?.name).toBe('Whisker Woods');

    p.lesson = 40;
    expect(passLesson(p, '2026-07-10').crossedInto?.name).toBe('Rainbow Meadow');

    p.lesson = 120;
    const last = passLesson(p, '2026-07-11');
    expect(last.finishedRoad).toBe(true);
    expect(last.crossedInto).toBeNull();
    expect(roadDone(p)).toBe(true);
  });
});

describe('planLesson', () => {
  it('always ends with a check-out over the lesson targets', () => {
    const p = freshProgress();
    const rounds = planLesson(1, p, rng);
    const checkout = rounds.filter((r) => r.checkout);
    expect(checkout.length).toBeGreaterThanOrEqual(CHECKOUT_MIN_WORDS);
    // the check-out is the tail of the session
    expect(rounds.slice(-checkout.length).every((r) => r.checkout)).toBe(true);
    // every gated word was practiced earlier in the same session
    for (const c of checkout) {
      expect(
        rounds.some((r) => !r.checkout && r.wordId === c.wordId),
        `checkout word ${c.wordId} was never practiced first`,
      ).toBe(true);
    }
  });

  it('re-drills stored misses up front', () => {
    const p = freshProgress();
    p.checkoutMisses = ['sat'];
    const rounds = planLesson(2, p, rng);
    const first = rounds.find((r) => r.wordId === 'sat');
    expect(first).toBeDefined();
    expect(first!.mechanic).toBe('build-word');
  });

  it('retry re-drills the misses then re-gates the full target set', () => {
    const p = freshProgress();
    const rounds = planCheckoutRetry(1, ['sat'], p, rng);
    expect(rounds[0]).toMatchObject({ mechanic: 'build-word', wordId: 'sat' });
    const gate = rounds.filter((r) => r.checkout);
    expect(gate.length).toBeGreaterThanOrEqual(CHECKOUT_MIN_WORDS);
  });
});
