import { describe, it, expect } from 'vitest';
import {
  updateStat,
  planQueue,
  speedRoundPool,
  KNOWN_MS,
  AUTOMATIC_MS,
} from '../src/engine/adaptive';
import { freshStat, type WordStat } from '../src/services/progress';

const outcome = (over: Partial<Parameters<typeof updateStat>[1]> = {}) => ({
  correct: true,
  firstTry: true,
  latencyMs: 1500,
  assisted: false,
  ...over,
});

describe('mastery ladder', () => {
  it('climbs 0→1 after two first-try corrects', () => {
    let s = freshStat();
    s = updateStat(s, outcome({ latencyMs: 8000 }));
    expect(s.mastery).toBe(0);
    s = updateStat(s, outcome({ latencyMs: 8000 }));
    expect(s.mastery).toBe(1);
  });

  it('climbs to quick when EMA drops under the known threshold', () => {
    let s = freshStat();
    s = updateStat(s, outcome({ latencyMs: KNOWN_MS - 500 }));
    s = updateStat(s, outcome({ latencyMs: KNOWN_MS - 500 }));
    expect(s.mastery).toBe(2);
  });

  it('reaches automatic only with enough fast first-try exposures', () => {
    let s = freshStat();
    for (let i = 0; i < 3; i++) s = updateStat(s, outcome({ latencyMs: AUTOMATIC_MS - 500 }));
    expect(s.mastery).toBe(3);
  });

  it('a miss drops one rung and never below 0', () => {
    let s = freshStat();
    for (let i = 0; i < 3; i++) s = updateStat(s, outcome({ latencyMs: 1200 }));
    expect(s.mastery).toBe(3);
    s = updateStat(s, outcome({ correct: false, firstTry: false }));
    expect(s.mastery).toBe(2);
    for (let i = 0; i < 5; i++) s = updateStat(s, outcome({ correct: false, firstTry: false }));
    expect(s.mastery).toBe(0);
  });

  it('assisted rounds count as exposure but not progress', () => {
    let s = freshStat();
    s = updateStat(s, outcome({ assisted: true, firstTry: false }));
    expect(s.exposures).toBe(1);
    expect(s.firstTryCorrect).toBe(0);
    expect(s.mastery).toBe(0);
  });
});

describe('queue composition', () => {
  const rng = () => 0.5;

  it('mixes new, working-set, and review words', () => {
    const stats: Record<string, WordStat> = {
      seen1: { ...freshStat(), exposures: 3, mastery: 1, ema: 5000 },
      seen2: { ...freshStat(), exposures: 5, mastery: 2, ema: 3000 },
      auto1: { ...freshStat(), exposures: 9, mastery: 3, ema: 1500, lastSeen: 0 },
    };
    const queue = planQueue({
      newIds: ['new1', 'new2', 'new3', 'new4'],
      seenIds: ['seen1', 'seen2', 'auto1'],
      stats,
      slots: 8,
      random: rng,
      now: 10 * 86_400_000, // day 10 — auto1 is stale
    });
    expect(queue.length).toBeGreaterThan(0);
    expect(queue).toContain('seen1'); // weakest working-set word always practices
    expect(queue).toContain('auto1'); // stale automatic word comes back (spaced repetition)
    expect(queue.filter((id) => id.startsWith('new')).length).toBeGreaterThanOrEqual(3);
    expect(new Set(queue).size).toBe(queue.length); // no duplicates
  });
});

describe('speed round invariant', () => {
  it('NEVER includes mastery-0 words', () => {
    const stats: Record<string, WordStat> = {
      learning: { ...freshStat(), exposures: 1, mastery: 0 },
      known: { ...freshStat(), exposures: 4, mastery: 1 },
      auto: { ...freshStat(), exposures: 9, mastery: 3 },
    };
    const pool = speedRoundPool(['learning', 'known', 'auto', 'unseen'], stats);
    expect(pool).toEqual(['known', 'auto']);
    expect(pool).not.toContain('learning');
    expect(pool).not.toContain('unseen');
  });
});
