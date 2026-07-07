// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { freshProgress, exportCode, importCode } from '../src/services/progress';

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
