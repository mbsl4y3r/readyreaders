import { describe, it, expect } from 'vitest';
import { giftForLesson, claimGift, GIFT_PEARLS } from '../src/services/tomorrow';
import { COSMETICS } from '../src/avatar/catalog';
import type { ProgressData } from '../src/services/progress';

function save(over: Partial<ProgressData> = {}): ProgressData {
  return {
    version: 1,
    currentLevel: 1,
    levelPlays: {},
    bookLesson: 35,
    lesson: 35,
    lastPassDate: '',
    checkoutMisses: [],
    placed: true,
    created: true,
    words: {},
    collections: {},
    sessions: [],
    speedBest: 0,
    storiesRead: [],
    pearls: 0,
    badges: [],
    arcadeBest: {},
    arcadePassUntil: 0,
    streak: { lastDate: '', days: 0, best: 0 },
    tickets: 0,
    stickers: [],
    inky: { xp: 0, level: 1 },
    photos: [],
    recordings: [],
    cosmetics: [],
    avatar: {
      character: 'girl',
      skin: 'shell',
      hairStyle: 'waves',
      hairColor: 'chestnut',
      outfit: 'tail-seafoam',
      headwear: null,
      necklace: null,
      held: null,
      face: null,
      glasses: null,
      earrings: null,
      petColor: 'violet',
      petHat: null,
    },
    settings: { sessionCapMin: 18, musicOn: false, gameSpeed: 'normal' },
    ...over,
  } as ProgressData;
}

describe("tomorrow's treasure", () => {
  it('is deterministic — the treasure promised last night is the one waiting today', () => {
    const p = save();
    const a = giftForLesson(p, 36);
    const b = giftForLesson(p, 36);
    const c = giftForLesson(save(), 36);
    expect(a).toEqual(b);
    expect(a).toEqual(c);
  });

  it('gives different lessons different treasures (it is not one repeated prize)', () => {
    const p = save();
    const ids = new Set([36, 37, 38, 39, 40, 41].map((l) => giftForLesson(p, l).id));
    expect(ids.size).toBeGreaterThan(1);
  });

  it('NEGATIVE: never promises something she already owns', () => {
    let p = save();
    // claim ten lessons in a row; each prize must be new at the time it is given
    const granted: string[] = [];
    for (const lesson of [31, 32, 33, 34, 35, 36, 37, 38, 39, 40]) {
      const g = giftForLesson(p, lesson);
      expect(granted).not.toContain(g.id);
      claimGift(p, lesson);
      granted.push(g.id);
    }
    // and the wardrobe never gains a duplicate entry
    expect(new Set(p.cosmetics).size).toBe(p.cosmetics.length);
  });

  it('claiming grants the item, and claiming twice does not duplicate it', () => {
    const p = save();
    const gift = giftForLesson(p, 36);
    claimGift(p, 36);
    expect(p.cosmetics).toContain(gift.id);
    const count = p.cosmetics.filter((c) => c === gift.id).length;
    claimGift(p, 36); // a re-entered celebration must not double-grant
    expect(p.cosmetics.filter((c) => c === gift.id).length).toBe(count);
  });

  it('NEGATIVE: a girl is never promised a boy-only item, and vice versa', () => {
    const byId = new Map(COSMETICS.map((c) => [c.id, c]));
    for (const character of ['girl', 'boy'] as const) {
      const p = save({ avatar: { ...save().avatar, character } });
      for (let lesson = 1; lesson <= 120; lesson++) {
        const g = giftForLesson(p, lesson);
        const item = byId.get(g.id);
        if (item?.track) expect(item.track).toBe(character);
      }
    }
  });

  it('falls back to pearls once the whole wardrobe is hers — never crashes, never empty', () => {
    const p = save({ cosmetics: COSMETICS.map((c) => c.id) });
    const gift = giftForLesson(p, 36);
    expect(gift.kind).toBe('pearls');
    claimGift(p, 36);
    expect(p.pearls).toBe(GIFT_PEARLS);
  });

  it('every lesson on the road has a real treasure with a speakable name', () => {
    const p = save();
    for (let lesson = 1; lesson <= 120; lesson++) {
      const g = giftForLesson(p, lesson);
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.emoji.length).toBeGreaterThan(0);
      expect(g.lesson).toBe(lesson);
    }
  });
});
