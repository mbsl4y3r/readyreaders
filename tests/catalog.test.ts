import { describe, it, expect } from 'vitest';
import {
  COSMETICS,
  COSMETICS_BY_ID,
  OPTIONAL_CATEGORIES,
  CREATION_CATEGORIES,
  starterItems,
  starterCosmetics,
  defaultAvatar,
  defaultBoyAvatar,
  type CharacterId,
  type CosmeticCategory,
} from '../src/avatar/catalog';

describe('wardrobe catalog integrity', () => {
  it('has unique ids within each category (ids can repeat across categories)', () => {
    const seen = new Set<string>();
    for (const c of COSMETICS) {
      const key = `${c.category}/${c.id}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('every AvatarConfig slot maps to a real catalog item', () => {
    const a = defaultAvatar();
    const slots: [CosmeticCategory, string | null][] = [
      ['hairStyle', a.hairStyle],
      ['hairColor', a.hairColor],
      ['outfit', a.outfit],
      ['petColor', a.petColor],
    ];
    for (const [cat, id] of slots) {
      const item = COSMETICS_BY_ID.get(id!);
      expect(item, `${cat} default "${id}" missing`).toBeDefined();
      expect(item!.category).toBe(cat);
    }
  });

  it('the free starter set owns exactly the price-0 items', () => {
    const owned = new Set(starterCosmetics());
    for (const c of COSMETICS) {
      expect(owned.has(c.id)).toBe(c.price === 0);
    }
  });

  it('the default avatar wears only owned (free) cosmetics', () => {
    const owned = new Set(starterCosmetics());
    const a = defaultAvatar();
    for (const id of [a.hairStyle, a.hairColor, a.outfit, a.petColor]) {
      expect(owned.has(id)).toBe(true);
    }
  });

  it('every creation category offers at least two starter choices for both characters', () => {
    for (const character of ['girl', 'boy'] as CharacterId[]) {
      for (const cat of CREATION_CATEGORIES) {
        expect(
          starterItems(cat, character).length,
          `${cat} needs starter options for ${character}`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('the boy default avatar wears only owned (free) cosmetics', () => {
    const owned = new Set(starterCosmetics());
    const a = defaultBoyAvatar();
    for (const id of [a.hairStyle, a.hairColor, a.outfit, a.petColor]) {
      expect(owned.has(id), `boy default "${id}" must be free`).toBe(true);
    }
  });

  it('optional categories cover every slot that may be empty', () => {
    for (const cat of ['headwear', 'necklace', 'held', 'face', 'glasses', 'earrings', 'petHat'] as const) {
      expect(OPTIONAL_CATEGORIES).toContain(cat);
    }
  });

  it('offers a generous catalog (tons of options)', () => {
    expect(COSMETICS.length).toBeGreaterThanOrEqual(75);
  });
});
