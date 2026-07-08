import { describe, it, expect } from 'vitest';
import { BADGES, BADGES_BY_ID, newlyEarned } from '../src/engine/achievements';
import { freshProgress, freshStat } from '../src/services/progress';
import { starterCosmetics } from '../src/avatar/catalog';

describe('achievements', () => {
  it('a fresh player has earned nothing', () => {
    expect(newlyEarned(freshProgress()).length).toBe(0);
  });

  it('every badge id is unique', () => {
    expect(BADGES_BY_ID.size).toBe(BADGES.length);
  });

  it('earns story badges as stories are read', () => {
    const p = freshProgress();
    p.storiesRead = ['st01'];
    const ids = newlyEarned(p).map((b) => b.id);
    expect(ids).toContain('first-story');
    expect(ids).not.toContain('bookworm');

    p.storiesRead = ['st01', 'st02', 'st03'];
    expect(newlyEarned(p).map((b) => b.id)).toContain('bookworm');
  });

  it('earns word badges from quick-mastery counts (ignoring phrase/sentence keys)', () => {
    const p = freshProgress();
    for (let i = 0; i < 10; i++) {
      p.words[`w${i}`] = { ...freshStat(), exposures: 4, firstTryCorrect: 4, mastery: 2 };
    }
    p.words['sent:s001'] = { ...freshStat(), exposures: 4, mastery: 3 }; // must not count
    const ids = newlyEarned(p).map((b) => b.id);
    expect(ids).toContain('first-word');
    expect(ids).toContain('ten-quick');
  });

  it('does not re-earn a badge already recorded', () => {
    const p = freshProgress();
    p.storiesRead = ['st01'];
    p.badges = ['first-story'];
    expect(newlyEarned(p).map((b) => b.id)).not.toContain('first-story');
  });

  it('wardrobe badges count only bought (non-starter) items', () => {
    const p = freshProgress();
    p.cosmetics = [...starterCosmetics()]; // owns only the free set
    expect(newlyEarned(p).map((b) => b.id)).not.toContain('dressed-up');
    p.cosmetics = [...starterCosmetics(), 'bob', 'pony', 'curls', 'tail-coral', 'gown-rose'];
    expect(newlyEarned(p).map((b) => b.id)).toContain('dressed-up');
  });
});
