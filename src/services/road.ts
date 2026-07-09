/**
 * The Reading Road engine — how Evie moves through the book's 120 lessons.
 *
 * The model (agreed with the family):
 * - Everyone starts at lesson 1. Lessons 1..FREE_PASS_THROUGH can be passed
 *   as fast as she likes (catch-up zone); beyond that it's the book's formula,
 *   one new lesson per day (parents can override in the parent corner).
 * - A lesson is PASSED by the check-out: its target words answered right on
 *   the FIRST tap (elimination-tapping can't pass), with one forgiveness miss.
 *   A miss is never a fail state: the missed words get re-drilled and she can
 *   retry in the same session, or next time — whichever comes first.
 * - Every tenth lesson crosses into a new themed region (see content/regions),
 *   which is the big celebration moment.
 */
import { WORDS } from '../content/words';
import type { Word } from '../content/types';
import { highestLevelForBookLesson } from '../content/levels';
import { regionForLesson, isRegionFinale, TOTAL_LESSONS, type Region } from '../content/regions';
import type { ProgressData } from './progress';
import { todayStr } from './juice';

/** Lessons she may pass without the one-a-day gate — the catch-up zone. */
export const FREE_PASS_THROUGH = 20;
/** The check-out forgives this many first-tap misses. */
export const CHECKOUT_ALLOWED_MISSES = 1;
/** Check-outs quiz at least this many words (thin lessons borrow review words). */
export const CHECKOUT_MIN_WORDS = 3;
/** ...and at most this many (big lessons sample). */
export const CHECKOUT_MAX_WORDS = 5;

/** True when the road has been finished — lesson sits past the last one. */
export function roadDone(progress: ProgressData): boolean {
  return progress.lesson > TOTAL_LESSONS;
}

/** May she START a new lesson today? (Replays and reviews are always open.) */
export function canStartLessonToday(progress: ProgressData, today = todayStr()): boolean {
  if (roadDone(progress)) return false;
  if (progress.lesson <= FREE_PASS_THROUGH) return true;
  return progress.lastPassDate !== today;
}

/**
 * The words a lesson's check-out quizzes. The lesson's own new words first;
 * thin lessons (our data or the book introduces none) borrow her weakest
 * recently-seen words so every day still has an honest gate.
 */
export function checkoutWordsFor(
  lesson: number,
  progress: ProgressData,
  random: () => number = Math.random,
): Word[] {
  const fresh = WORDS.filter((w) => w.lesson === lesson);
  const picked = shuffle(fresh, random).slice(0, CHECKOUT_MAX_WORDS);
  if (picked.length >= CHECKOUT_MIN_WORDS) return picked;

  // top up from earlier material: weakest mastery first, most recent lesson
  // first among ties, so the gate reviews what actually needs reviewing
  const pool = WORDS.filter((w) => w.lesson < lesson && !picked.some((p) => p.id === w.id))
    .map((w) => ({
      w,
      score:
        (progress.words[w.id]?.mastery ?? 0) * 100 - w.lesson + random(),
    }))
    .sort((a, b) => a.score - b.score)
    .map((e) => e.w);
  return [...picked, ...pool.slice(0, CHECKOUT_MIN_WORDS - picked.length)];
}

export interface CheckoutResult {
  passed: boolean;
  missedIds: string[];
}

/** Score a check-out from per-word first-tap results. */
export function evaluateCheckout(results: { wordId: string; firstTry: boolean }[]): CheckoutResult {
  const missedIds = results.filter((r) => !r.firstTry).map((r) => r.wordId);
  return {
    passed: results.length > 0 && missedIds.length <= CHECKOUT_ALLOWED_MISSES,
    missedIds,
  };
}

export interface PassResult {
  /** The lesson just passed. */
  passedLesson: number;
  /** The region just ENTERED when the pass crossed a region border (else null). */
  crossedInto: Region | null;
  /** True when that was lesson 120 — the road is complete. */
  finishedRoad: boolean;
}

/**
 * Record a lesson pass: advances the road, stamps the daily gate, clears the
 * re-drill list, and keeps the legacy markers (bookLesson / currentLevel) in
 * step so stories, phrases, and collections all open with the road.
 */
export function passLesson(progress: ProgressData, today = todayStr()): PassResult {
  const passedLesson = progress.lesson;
  progress.lesson = passedLesson + 1;
  progress.lastPassDate = today;
  progress.checkoutMisses = [];
  if (progress.bookLesson < passedLesson) progress.bookLesson = passedLesson;
  const level = highestLevelForBookLesson(Math.min(TOTAL_LESSONS, progress.lesson));
  if (progress.currentLevel < level) progress.currentLevel = level;
  const finishedRoad = passedLesson >= TOTAL_LESSONS;
  const crossedInto =
    !finishedRoad && isRegionFinale(passedLesson) ? regionForLesson(passedLesson + 1) : null;
  return { passedLesson, crossedInto, finishedRoad };
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
