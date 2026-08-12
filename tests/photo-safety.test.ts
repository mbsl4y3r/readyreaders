/**
 * "Collections, not streaks. Nothing is ever lost." — the constitution.
 *
 * These are the two ways the game used to break that promise, both silently:
 * the album threw away her oldest photo the moment a seventh arrived, and the
 * whole save (photos AND a month of reading in one record) was written with a
 * `catch {}` around it, so a full iPad lost a session without a word.
 *
 * NEGATIVE CASES: each of these fails against the previous implementation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadProgress,
  saveProgress,
  savePhotos,
  loadPhotos,
  saveIsBlocked,
  type ProgressData,
} from '../src/services/progress';

/** A localStorage that can be told to refuse writes over a size budget. */
function fakeStorage(budget = Infinity) {
  const map = new Map<string, string>();
  return {
    store: map,
    budget,
    getItem: (k: string) => map.get(k) ?? null,
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    setItem(k: string, v: string) {
      const used = [...map.entries()]
        .filter(([key]) => key !== k)
        .reduce((n, [, val]) => n + val.length, 0);
      if (used + v.length > this.budget) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(k, v);
    },
  };
}

let storage: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal('localStorage', storage);
});

function photo(n: number, size = 40): string {
  return `data:image/png;base64,${String(n).repeat(size)}`;
}

function withPhotos(photos: string[]): ProgressData {
  const p = loadProgress();
  p.photos = photos;
  return p;
}

describe('the photo album never loses a photo behind her back', () => {
  // The six-photo cap itself lived in the booth scene (`while (photos.length
  // > 6) photos.shift()`), so this guards the storage layer that has to keep
  // them; the scene's own behaviour is checked by the live play run.
  it('stores an album of any size without trimming it', () => {
    const shots = Array.from({ length: 9 }, (_, i) => photo(i));
    const result = saveProgress(withPhotos(shots));
    expect(result.photosOk).toBe(true);
    expect(loadPhotos()).toHaveLength(9);
    expect(loadPhotos()[0]).toBe(photo(0));
  });

  it('round-trips the album through a reload', () => {
    saveProgress(withPhotos([photo(1), photo(2), photo(3)]));
    expect(loadProgress().photos).toEqual([photo(1), photo(2), photo(3)]);
  });

  it('reports a refused album instead of dropping the photo', () => {
    saveProgress(withPhotos([]));
    storage.budget = storage.store.get('readyreaders.v1')!.length + 50;
    const result = saveProgress(withPhotos([photo(1, 500)]));
    // her reading still saved…
    expect(result.ok).toBe(true);
    // …and the album failure is REPORTED, so the booth can tell her
    expect(result.photosOk).toBe(false);
  });

  it('migrates photos out of an old save that stored them inline', () => {
    // a pre-split record: photos embedded in the main save
    storage.store.set(
      'readyreaders.v1',
      JSON.stringify({ ...loadProgress(), photos: [photo(7), photo(8)] }),
    );
    const loaded = loadProgress();
    expect(loaded.photos).toEqual([photo(7), photo(8)]);
    // and they now live in the album record, not the main one
    expect(loadPhotos()).toEqual([photo(7), photo(8)]);
  });
});

describe('reading progress is never lost to the album', () => {
  /**
   * The sharpest negative case, and the only one that needs no new API: it
   * calls exactly what the old code exposed and checks the outcome she would
   * actually live with. Against the previous implementation photos and
   * progress shared one record, so this write threw, the `catch {}` ate it,
   * and the reload came back at lesson 1 — a whole session gone, silently.
   */
  it('NEGATIVE: a lesson still saves when the album is too big for storage', () => {
    storage.budget = 20_000;
    const p = withPhotos(Array.from({ length: 40 }, (_, i) => photo(i, 4000)));
    p.lesson = 42;
    saveProgress(p);
    expect(loadProgress().lesson).toBe(42);
  });

  it('NEGATIVE: a full album cannot stop a lesson from being saved', () => {
    const big = Array.from({ length: 40 }, (_, i) => photo(i, 4000));
    // room for the small record many times over, but nowhere near the album
    storage.budget = 20_000;
    const p = withPhotos(big);
    p.lesson = 42;
    p.pearls = 99;
    const result = saveProgress(p);
    expect(result.ok).toBe(true);
    expect(result.photosOk).toBe(false);
    // the thing that matters survived the reload
    const reloaded = loadProgress();
    expect(reloaded.lesson).toBe(42);
    expect(reloaded.pearls).toBe(99);
  });

  it('a blocked save is flagged, never swallowed', () => {
    storage.budget = 10; // nothing fits at all
    const result = saveProgress(withPhotos([]));
    expect(result.ok).toBe(false);
    // the old code caught the error and returned void — no one ever found out
    expect(saveIsBlocked()).toBe(true);
  });

  it('clears the blocked flag once a save succeeds again', () => {
    storage.budget = 10;
    saveProgress(withPhotos([]));
    expect(saveIsBlocked()).toBe(true);
    storage.budget = Infinity;
    saveProgress(withPhotos([]));
    expect(saveIsBlocked()).toBe(false);
  });

  it('savePhotos reports refusal rather than throwing', () => {
    storage.budget = 10;
    expect(savePhotos([photo(1, 500)])).toBe(false);
  });
});
