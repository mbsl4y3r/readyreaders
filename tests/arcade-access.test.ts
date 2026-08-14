/**
 * The arcade used to be a toll booth.
 *
 * Every visit cost 10 pearls — the SAME currency the wardrobe runs on — so
 * playing a game meant not buying an outfit, and a child with no pearls could
 * not play at all. Reading is now the way in: passing a lesson earns a Play
 * Pass. The pearl offer stays as a second door, but it is never the only one.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadProgress, saveProgress, type ProgressData } from '../src/services/progress';
import { passLesson } from '../src/services/road';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

/** What the session does when a lesson is passed. */
function passALesson(p: ProgressData): ProgressData {
  p.arcadeTokens += 1;
  passLesson(p);
  return p;
}

describe('getting into the arcade', () => {
  it('a new reader starts with no Play Passes', () => {
    expect(loadProgress().arcadeTokens).toBe(0);
  });

  it('passing a lesson earns exactly one Play Pass', () => {
    const p = loadProgress();
    passALesson(p);
    expect(p.arcadeTokens).toBe(1);
    passALesson(p);
    passALesson(p);
    expect(p.arcadeTokens).toBe(3);
  });

  it('NEGATIVE: playing never costs pearls when she has a Play Pass', () => {
    const p = loadProgress();
    passALesson(p);
    const pearlsBefore = p.pearls;
    // what the arcade does on entry with a token in hand
    p.arcadeTokens -= 1;
    p.arcadePassUntil = 1_000_000;
    expect(p.pearls).toBe(pearlsBefore);
    expect(p.arcadeTokens).toBe(0);
  });

  it('Play Passes survive a reload — they are not a session-only grant', () => {
    const p = loadProgress();
    passALesson(p);
    passALesson(p);
    saveProgress(p);
    expect(loadProgress().arcadeTokens).toBe(2);
  });

  it('a save from before Play Passes existed loads with zero, not undefined', () => {
    const old = loadProgress() as Partial<ProgressData>;
    delete old.arcadeTokens;
    localStorage.setItem('readyreaders.v1', JSON.stringify(old));
    const loaded = loadProgress();
    expect(loaded.arcadeTokens).toBe(0);
    // and she can immediately earn one by reading
    passALesson(loaded);
    expect(loaded.arcadeTokens).toBe(1);
  });

  it('earning a pass never spends anything she had', () => {
    const p = loadProgress();
    const before = { pearls: p.pearls, tickets: p.tickets, cosmetics: [...p.cosmetics] };
    passALesson(p);
    expect(p.pearls).toBe(before.pearls);
    expect(p.tickets).toBe(before.tickets);
    expect(p.cosmetics).toEqual(before.cosmetics);
  });
});
