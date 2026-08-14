/**
 * The Say-It round is the only mechanic that asks her to READ rather than
 * recognise, so the rules around it are load-bearing:
 *
 *  - it is only ever given for words she has already met
 *  - it NEVER gates a lesson, because it is self-reported ("I said it!") and
 *    a check-out that can be passed by tapping is not a check-out
 *  - a word she has met stops being served as feed-the-creature, which is a
 *    listen-and-match round she can win without reading
 */
import { describe, it, expect } from 'vitest';
import { planSession, planLesson, planCheckoutRetry } from '../src/engine/session-planner';
import { loadProgress, freshStat, type ProgressData } from '../src/services/progress';
import { WORDS } from '../src/content/words';

/**
 * A seeded PRNG. The planner shuffles with Math.random by default, so any
 * assertion about WHICH mechanics land in a session is a coin toss otherwise —
 * this test failed roughly two runs in three before it was pinned.
 */
function seeded(seed = 12345): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
import { buildManifest } from '../scripts/clip-manifest';

/** A save where every word up to `lesson` is already known (mastery 1+). */
function knowingReader(lesson = 35, mastery: 0 | 1 | 2 | 3 = 2): ProgressData {
  const p = loadProgress();
  p.bookLesson = lesson;
  p.lesson = lesson;
  p.placed = true;
  p.created = true;
  p.currentLevel = 4;
  for (const w of WORDS.filter((x) => x.lesson <= lesson)) {
    p.words[w.id] = { ...freshStat(), exposures: 6, firstTryCorrect: 4, ema: 2500, mastery };
  }
  return p;
}

describe('the say-it round', () => {
  it('is served for words she already knows', () => {
    const rounds = planSession(4, knowingReader(), seeded());
    expect(rounds.some((r) => r.mechanic === 'say-it')).toBe(true);
  });

  it('NEGATIVE: is never served for a word she has not met yet', () => {
    const blank = loadProgress();
    blank.bookLesson = 35;
    blank.currentLevel = 4;
    // no word stats at all — everything is brand new
    const rounds = planSession(4, blank, seeded());
    expect(rounds.filter((r) => r.mechanic === 'say-it')).toHaveLength(0);
  });

  it('NEGATIVE: never gates a lesson — a self-reported round cannot check out', () => {
    for (let lesson = 5; lesson <= 120; lesson += 7) {
      const rounds = planLesson(lesson, knowingReader(lesson), seeded(lesson));
      const gating = rounds.filter((r) => r.checkout);
      expect(gating.length).toBeGreaterThan(0);
      expect(gating.every((r) => r.mechanic !== 'say-it')).toBe(true);
    }
  });

  it('NEGATIVE: never gates a check-out retry either', () => {
    const p = knowingReader(40);
    const missed = WORDS.filter((w) => w.lesson <= 40)
      .slice(0, 3)
      .map((w) => w.id);
    const rounds = planCheckoutRetry(40, missed, p, seeded());
    expect(rounds.some((r) => r.checkout)).toBe(true);
    expect(rounds.filter((r) => r.checkout && r.mechanic === 'say-it')).toHaveLength(0);
  });

  it('replaces listen-and-match for known words rather than adding rounds', () => {
    // same seed on both sides: the only difference is what she already knows
    const known = planSession(4, knowingReader(), seeded());
    const fresh = planSession(4, (() => {
      const p = loadProgress();
      p.bookLesson = 35;
      p.currentLevel = 4;
      return p;
    })(), seeded());
    // the session does not get longer just because she got better
    expect(Math.abs(known.length - fresh.length)).toBeLessThanOrEqual(2);
    // and the match-by-ear round gives way to the read-it-yourself round
    const matchKnown = known.filter((r) => r.mechanic === 'feed-creature').length;
    const matchFresh = fresh.filter((r) => r.mechanic === 'feed-creature').length;
    expect(matchKnown).toBeLessThan(matchFresh);
  });

  it('every say-it round names a real, decodable word', () => {
    const byId = new Map(WORDS.map((w) => [w.id, w]));
    for (let level = 1; level <= 9; level++) {
      for (const r of planSession(level, knowingReader(120), seeded(level))) {
        if (r.mechanic !== 'say-it') continue;
        expect(r.wordId).toBeTruthy();
        expect(byId.has(r.wordId!)).toBe(true);
      }
    }
  });

  it('its one spoken prompt is in the recording manifest and never a letter sound', () => {
    const clip = buildManifest().find((c) => c.id === 'say-it-prompt');
    expect(clip).toBeDefined();
    expect(clip!.kind).toBe('ui');
    // it must not be a grapheme clip — those may never fall back to TTS
    expect(clip!.kind).not.toBe('graphemes');
  });
});
