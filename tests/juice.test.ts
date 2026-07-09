import { describe, it, expect } from 'vitest';
import { freshProgress } from '../src/services/progress';
import {
  recordReadingDay,
  addInkyXp,
  inkyLevelForXp,
  INKY_XP_PER_LEVEL,
  seasonFor,
  newlyEarnedStickers,
  speedFactor,
} from '../src/services/juice';

describe('reading streak', () => {
  it('advances once per day, ignores repeat reads, resets after a gap', () => {
    const p = freshProgress();
    expect(recordReadingDay(p, '2026-07-09').days).toBe(1);
    expect(recordReadingDay(p, '2026-07-09').advanced).toBe(false); // same day
    expect(recordReadingDay(p, '2026-07-10').days).toBe(2); // next day
    expect(recordReadingDay(p, '2026-07-20').days).toBe(1); // gap → reset
    expect(p.streak.best).toBe(2);
  });

  it('pays a pearl bonus exactly on a milestone day', () => {
    const p = freshProgress();
    p.streak = { lastDate: '2026-07-08', days: 2, best: 2 };
    const before = p.pearls;
    const r = recordReadingDay(p, '2026-07-09'); // reaches 3
    expect(r.days).toBe(3);
    expect(r.milestone).toBe(3);
    expect(p.pearls).toBe(before + 5);
  });
});

describe('pet Inky growth', () => {
  it('levels up on XP thresholds and gifts a pet cosmetic at level 3', () => {
    expect(inkyLevelForXp(0)).toBe(1);
    expect(inkyLevelForXp(INKY_XP_PER_LEVEL * 2)).toBe(3);

    const p = freshProgress();
    const r = addInkyXp(p, INKY_XP_PER_LEVEL * 2); // jump to level 3
    expect(r.level).toBe(3);
    expect(r.leveledUp).toBe(true);
    expect(r.gift).toBe('petbow');
    expect(p.cosmetics).toContain('petbow');
  });
});

describe('seasons', () => {
  it('maps months to seasons, December is the holidays', () => {
    expect(seasonFor(new Date(2026, 11, 15))).toBe('holiday');
    expect(seasonFor(new Date(2026, 0, 15))).toBe('winter');
    expect(seasonFor(new Date(2026, 3, 15))).toBe('spring');
    expect(seasonFor(new Date(2026, 6, 15))).toBe('summer');
    expect(seasonFor(new Date(2026, 9, 15))).toBe('autumn');
  });
});

describe('stickers + difficulty', () => {
  it('earns the first-game sticker once a game has a best score', () => {
    const p = freshProgress();
    expect(newlyEarnedStickers(p).some((s) => s.id === 'first-game')).toBe(false);
    p.arcadeBest['serpent'] = 5;
    expect(newlyEarnedStickers(p).some((s) => s.id === 'first-game')).toBe(true);
  });

  it('maps game speed to a difficulty factor', () => {
    expect(speedFactor('chill')).toBeLessThan(1);
    expect(speedFactor('normal')).toBe(1);
    expect(speedFactor('zippy')).toBeGreaterThan(1);
  });
});
