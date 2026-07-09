import { describe, it, expect } from 'vitest';
import { freshProgress } from '../src/services/progress';
import {
  recordReadingDay,
  recordLevelTrip,
  addInkyXp,
  inkyLevelForXp,
  INKY_XP_PER_LEVEL,
  seasonFor,
  newlyEarnedStickers,
  speedFactor,
} from '../src/services/juice';
import { SESSIONS_TO_PASS } from '../src/content/levels';

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

describe('level progression (read to open the next island)', () => {
  it('opens the next level after passing the frontier the required number of times', () => {
    const p = freshProgress();
    expect(p.currentLevel).toBe(1);
    for (let i = 1; i < SESSIONS_TO_PASS; i++) {
      const r = recordLevelTrip(p, 1);
      expect(r.unlockedLevel).toBe(0);
      expect(r.tripsLeft).toBe(SESSIONS_TO_PASS - i);
      expect(p.currentLevel).toBe(1);
    }
    const last = recordLevelTrip(p, 1);
    expect(last.unlockedLevel).toBe(2);
    expect(p.currentLevel).toBe(2);
  });

  it('bumps the content marker so the new island has words, and ignores replays of old levels', () => {
    const p = freshProgress();
    p.currentLevel = 2;
    p.levelPlays = { 2: SESSIONS_TO_PASS - 1 };
    const r = recordLevelTrip(p, 2);
    expect(r.unlockedLevel).toBe(3);
    expect(p.bookLesson).toBe(30); // end of level 3's lesson range

    // replaying level 1 now (not the frontier) never unlocks anything
    const replay = recordLevelTrip(p, 1);
    expect(replay.unlockedLevel).toBe(0);
    expect(p.currentLevel).toBe(3);
  });

  it('never unlocks past level 9', () => {
    const p = freshProgress();
    p.currentLevel = 9;
    p.levelPlays = { 9: SESSIONS_TO_PASS };
    expect(recordLevelTrip(p, 9).unlockedLevel).toBe(0);
    expect(p.currentLevel).toBe(9);
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
