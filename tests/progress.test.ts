// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { freshProgress, loadProgress, exportCode, importCode } from '../src/services/progress';

describe('progress export/import', () => {
  it('round-trips through the copy-paste code', () => {
    const data = freshProgress();
    data.bookLesson = 23;
    data.currentLevel = 3;
    data.words['ship'] = {
      exposures: 4,
      firstTryCorrect: 3,
      latencies: [2100, 1800],
      ema: 1900,
      best: 1800,
      lastSeen: 19900,
      mastery: 2,
    };
    data.collections.treasures.push('🐚');

    const roundTripped = importCode(exportCode(data));
    expect(roundTripped).toEqual(data);
  });

  it('rejects garbage codes', () => {
    expect(importCode('not-a-code')).toBeNull();
    expect(importCode('aGVsbG8=')).toBeNull(); // valid base64, not progress JSON
  });
});

describe('placement voyage flag', () => {
  beforeEach(() => localStorage.clear());

  /** A v1 save from before `placed` existed. */
  const legacySave = (sessions: { date: string; rounds: number }[]) => {
    const data = freshProgress() as unknown as Record<string, unknown>;
    delete data['placed'];
    data['sessions'] = sessions;
    return data;
  };

  it('fresh saves start unplaced so boot routes to the voyage', () => {
    expect(freshProgress().placed).toBe(false);
    expect(loadProgress().placed).toBe(false); // empty storage → fresh
  });

  it('a pre-voyage save that has been played counts as already placed', () => {
    localStorage.setItem(
      'readyreaders.v1',
      JSON.stringify(legacySave([{ date: '2026-07-01', rounds: 8 }])),
    );
    expect(loadProgress().placed).toBe(true);
  });

  it('a pre-voyage save with no sessions still gets the voyage', () => {
    localStorage.setItem('readyreaders.v1', JSON.stringify(legacySave([])));
    expect(loadProgress().placed).toBe(false);
  });

  it('importCode applies the same migration', () => {
    const played = btoa(JSON.stringify(legacySave([{ date: '2026-07-01', rounds: 8 }])));
    expect(importCode(played)?.placed).toBe(true);
    const unplayed = btoa(JSON.stringify(legacySave([])));
    expect(importCode(unplayed)?.placed).toBe(false);
  });
});

describe('phase 2 field migrations', () => {
  beforeEach(() => localStorage.clear());

  it('fresh saves carry speedBest 0 and an empty bookshelf', () => {
    expect(freshProgress().speedBest).toBe(0);
    expect(freshProgress().storiesRead).toEqual([]);
  });

  it('phase-1 saves gain the new fields on load and on import', () => {
    const data = freshProgress() as unknown as Record<string, unknown>;
    delete data['speedBest'];
    delete data['storiesRead'];
    localStorage.setItem('readyreaders.v1', JSON.stringify(data));
    const loaded = loadProgress();
    expect(loaded.speedBest).toBe(0);
    expect(loaded.storiesRead).toEqual([]);

    const imported = importCode(btoa(JSON.stringify(data)));
    expect(imported?.speedBest).toBe(0);
    expect(imported?.storiesRead).toEqual([]);
  });
});
