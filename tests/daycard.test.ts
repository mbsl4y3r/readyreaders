/**
 * The day card is the only thing in the game that reaches the parent who is
 * NOT holding the iPad. It has to say something worth reading, and it must
 * never invent a day that did not happen.
 */
import { describe, it, expect } from 'vitest';
import { dayCardText, automaticWords, dayTotals } from '../src/services/daycard';
import { loadProgress, freshStat, type ProgressData } from '../src/services/progress';
import { WORDS } from '../src/content/words';

function reader(over: Partial<ProgressData> = {}): ProgressData {
  const p = loadProgress();
  p.lesson = 35;
  p.sessions = [{ date: '2026-08-13', rounds: 9, minutes: 12 }];
  return Object.assign(p, over);
}

/** Mark the first n words automatic (mastery 3). */
function withAutomatic(p: ProgressData, n: number): ProgressData {
  for (const w of WORDS.slice(0, n)) {
    p.words[w.id] = { ...freshStat(), exposures: 8, ema: 900, mastery: 3 };
  }
  return p;
}

describe('the day card', () => {
  it('NEGATIVE: says nothing at all on a day with no reading', () => {
    expect(dayCardText(reader({ sessions: [] }), '2026-08-13')).toBeNull();
    // and a day that exists but is not TODAY must not be reported as today
    expect(dayCardText(reader(), '2026-08-14')).toBeNull();
  });

  it('reports the minutes and rounds actually logged for that day', () => {
    const p = reader({
      sessions: [
        { date: '2026-08-13', rounds: 4, minutes: 5 },
        { date: '2026-08-13', rounds: 5, minutes: 7 },
        { date: '2026-08-12', rounds: 9, minutes: 30 }, // yesterday must not leak in
      ],
    });
    expect(dayTotals(p, '2026-08-13')).toEqual({ minutes: 12, rounds: 9 });
    const card = dayCardText(p, '2026-08-13')!;
    expect(card).toContain('12 min');
    expect(card).toContain('9 rounds');
    expect(card).not.toContain('30');
  });

  it('NAMES the words she can now read without stopping', () => {
    const card = dayCardText(withAutomatic(reader(), 3), '2026-08-13')!;
    const names = automaticWords(withAutomatic(reader(), 3));
    expect(names.length).toBe(3);
    for (const word of names) expect(card).toContain(word);
    expect(card).toMatch(/without stopping/);
  });

  it('keeps the list short and counts the rest, so it stays readable', () => {
    const card = dayCardText(withAutomatic(reader(), 20), '2026-08-13', 'Thu 13 Aug', 6)!;
    expect(card).toContain('+14 more');
    expect(card.split('\n').length).toBeLessThanOrEqual(6);
  });

  it('NEGATIVE: never counts sentence or phrase stats as words she can read', () => {
    const p = withAutomatic(reader(), 2);
    // prefixed keys are sentences/phrases, not words — they must not be named
    p.words['sent:s01'] = { ...freshStat(), mastery: 3 };
    p.words['phr:p01'] = { ...freshStat(), mastery: 3 };
    const names = automaticWords(p);
    expect(names).toHaveLength(2);
    expect(names.some((n) => n.includes(':'))).toBe(false);
  });

  it('mentions a streak only once it is actually a streak', () => {
    const one = dayCardText(reader({ streak: { lastDate: '2026-08-13', days: 1, best: 1 } }), '2026-08-13')!;
    expect(one).not.toContain('in a row');
    const five = dayCardText(reader({ streak: { lastDate: '2026-08-13', days: 5, best: 5 } }), '2026-08-13')!;
    expect(five).toContain('5 days in a row');
  });

  it('always says where she is in the book', () => {
    expect(dayCardText(reader(), '2026-08-13')).toContain('Lesson 35 of 120');
  });
});
