// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { freshProgress, loadProgress, exportCode, importCode } from '../src/services/progress';
import { REGIONS } from '../src/content/regions';

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
    data.collections['treasures']!.push('🐚');
    data.collections['region-1']!.push('🐚');

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

  it('fresh saves start placed on the Reading Road (lesson 1, voyage is a parent tool)', () => {
    expect(freshProgress().placed).toBe(true);
    expect(freshProgress().lesson).toBe(1);
    expect(freshProgress().bookLesson).toBe(1);
    expect(loadProgress().placed).toBe(true); // empty storage → fresh
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

describe('character-creation flag + avatar migration', () => {
  beforeEach(() => localStorage.clear());

  it('fresh saves start uncreated so boot routes to the creator', () => {
    expect(freshProgress().created).toBe(false);
    expect(freshProgress().avatar.face).toBeNull();
  });

  it('a placed save from before the creator counts as already created', () => {
    const data = freshProgress() as unknown as Record<string, unknown>;
    data['placed'] = true;
    delete data['created'];
    localStorage.setItem('readyreaders.v1', JSON.stringify(data));
    expect(loadProgress().created).toBe(true);
  });

  it('an un-placed pre-creator save still gets the creator', () => {
    const data = freshProgress() as unknown as Record<string, unknown>;
    data['placed'] = false;
    delete data['created'];
    localStorage.setItem('readyreaders.v1', JSON.stringify(data));
    expect(loadProgress().created).toBe(false);
  });

  it('backfills the new avatar face/glasses/earrings slots as null', () => {
    const data = freshProgress();
    const raw = data as unknown as { avatar: Record<string, unknown> };
    delete raw.avatar['face'];
    delete raw.avatar['glasses'];
    delete raw.avatar['earrings'];
    localStorage.setItem('readyreaders.v1', JSON.stringify(data));
    const loaded = loadProgress();
    expect(loaded.avatar.face).toBeNull();
    expect(loaded.avatar.glasses).toBeNull();
    expect(loaded.avatar.earrings).toBeNull();
  });
});

describe('per-region collection albums', () => {
  beforeEach(() => localStorage.clear());

  /** A save from before region albums: only the three legacy pools exist. */
  const legacyCollections = (treasures: number, pets: number, charms: number) => {
    const data = freshProgress() as unknown as Record<string, unknown>;
    data['collections'] = {
      treasures: REGIONS[0]!.collectibles.slice(0, treasures),
      pets: REGIONS[1]!.collectibles.slice(0, pets),
      charms: REGIONS[2]!.collectibles.slice(0, charms),
    };
    return data;
  };

  it('fresh saves carry the three legacy pools plus all twelve region albums, empty', () => {
    const c = freshProgress().collections;
    for (const key of ['treasures', 'pets', 'charms']) expect(c[key]).toEqual([]);
    for (const r of REGIONS) expect(c[r.collectionKey]).toEqual([]);
    expect(Object.keys(c)).toHaveLength(15);
  });

  it('backfills missing region albums as empty on load', () => {
    localStorage.setItem('readyreaders.v1', JSON.stringify(legacyCollections(0, 0, 0)));
    const c = loadProgress().collections;
    for (const r of REGIONS) expect(c[r.collectionKey]).toEqual([]);
  });

  it('migrates legacy finds into region albums sequentially, in region order', () => {
    // 14 legacy collectibles → region 1 fills its first ten, region 2 gets four
    localStorage.setItem('readyreaders.v1', JSON.stringify(legacyCollections(10, 4, 0)));
    const c = loadProgress().collections;
    expect(c['region-1']).toEqual(REGIONS[0]!.collectibles);
    expect(c['region-2']).toEqual(REGIONS[1]!.collectibles.slice(0, 4));
    for (const r of REGIONS.slice(2)) expect(c[r.collectionKey]).toEqual([]);
    // legacy pools stay untouched — legacy level-mode sessions still use them
    expect(c['treasures']).toEqual(REGIONS[0]!.collectibles);
    expect(c['pets']).toEqual(REGIONS[1]!.collectibles.slice(0, 4));
    expect(c['charms']).toEqual([]);
  });

  it('is one-time: a save with any region finds is left exactly as it was', () => {
    const data = legacyCollections(10, 4, 0);
    (data['collections'] as Record<string, string[]>)['region-5'] = ['🌈'];
    localStorage.setItem('readyreaders.v1', JSON.stringify(data));
    const c = loadProgress().collections;
    expect(c['region-1']).toEqual([]);
    expect(c['region-5']).toEqual(['🌈']);
  });

  it('importCode applies the same migration', () => {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(legacyCollections(10, 4, 0)))));
    const c = importCode(code)!.collections;
    expect(c['region-1']).toEqual(REGIONS[0]!.collectibles);
    expect(c['region-2']).toEqual(REGIONS[1]!.collectibles.slice(0, 4));
    expect(c['treasures']).toHaveLength(10);
  });
});
