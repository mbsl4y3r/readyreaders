import { describe, it, expect } from 'vitest';
import { REGIONS, regionForLesson, isRegionFinale, TOTAL_LESSONS } from '../src/content/regions';

describe('the Reading Road regions', () => {
  it('twelve regions tile the 120 lessons exactly, ten each, in order', () => {
    expect(REGIONS).toHaveLength(12);
    let next = 1;
    for (const r of REGIONS) {
      expect(r.lessonRange[0]).toBe(next);
      expect(r.lessonRange[1]).toBe(next + 9);
      next = r.lessonRange[1] + 1;
    }
    expect(next - 1).toBe(TOTAL_LESSONS);
  });

  it('maps lessons to regions (candy is the region-4 banger)', () => {
    expect(regionForLesson(1).name).toBe('Coral Cove');
    expect(regionForLesson(10).id).toBe(1);
    expect(regionForLesson(11).id).toBe(2);
    expect(regionForLesson(35).name).toBe('Candy Cliffs');
    expect(regionForLesson(120).id).toBe(12);
    expect(regionForLesson(999).id).toBe(12); // clamped
  });

  it('flags each region-final lesson for the big crossing celebration', () => {
    expect(isRegionFinale(10)).toBe(true);
    expect(isRegionFinale(40)).toBe(true);
    expect(isRegionFinale(41)).toBe(false);
    expect(isRegionFinale(119)).toBe(false);
  });
});
