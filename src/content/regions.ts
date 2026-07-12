/**
 * The Reading Road — 120 book lessons ("Anyone Can Read in 120 Lessons",
 * one lesson per day) laid over twelve themed regions of ten lessons each.
 * Crossing into a new region is the big celebration moment; the lesson-by-
 * lesson marker is the everyday progress. Candy Cliffs lands at region 4 —
 * right where motivation usually dips — on purpose.
 *
 * Regions 1–3 reuse the existing realm palettes so current art carries over.
 */
import type { RealmId } from './types';
import { THEMES, type RealmTheme } from './themes';

export interface Region {
  id: number; // 1..12
  /** Book lessons this region covers: [first, last], always ten. */
  lessonRange: [number, number];
  name: string;
  /** Region glyph for the road + celebrations. */
  emoji: string;
  /** Scene gradient + accent (same shape drawRealmBackground consumes). */
  bgTop: number;
  bgBottom: number;
  accent: number;
  /** Ambient emoji drifting in the background. */
  ambient: string[];
  /** The region's friendly host creature (greets her, stars in feed rounds). */
  creature: string;
  creatureName: string;
  /** The region's own 10-collectible album, awarded in order as lessons pass. */
  collectibles: string[];
  /** Save key for this region's album in progress.collections. */
  collectionKey: string;
}

const R = (
  id: number,
  name: string,
  emoji: string,
  bgTop: number,
  bgBottom: number,
  accent: number,
  ambient: string[],
  creature: string,
  creatureName: string,
  collectibles: string[],
): Region => ({
  id,
  lessonRange: [(id - 1) * 10 + 1, id * 10],
  name,
  emoji,
  bgTop,
  bgBottom,
  accent,
  ambient,
  creature,
  creatureName,
  collectibles,
  collectionKey: `region-${id}`,
});

export const REGIONS: Region[] = [
  R(1, 'Coral Cove', '🌊', 0x0b3d64, 0x072a47, 0x4fc3f7, ['🐟', '🫧', '🪸', '🐠'], '🐙', 'Ollie the Octopus', ['🐚', '🦪', '💎', '🫧', '🪸', '⭐', '🧜‍♀️', '🐬', '🐠', '🏺']),
  R(2, 'Whisker Woods', '🌲', 0x1b4332, 0x081c15, 0x95d5b2, ['🌲', '🍄', '🌿', '🦋'], '🦦', 'Willa the Otter', ['🐰', '🐿️', '🦔', '🐢', '🐥', '🦊', '🐇', '🦉', '🐾', '🦌']),
  R(3, 'Starlight Castle', '✨', 0x3c096c, 0x10002b, 0xe0aaff, ['✨', '🌙', '⭐', '🏰'], '🐲', 'Sparky the Dragon', ['🔮', '👑', '🪄', '💫', '🦄', '🧚', '✨', '🏰', '🗝️', '🌟']),
  // the banger — sugar rush right where long journeys usually sag
  R(4, 'Candy Cliffs', '🍭', 0xb84a8c, 0x5e1f4a, 0xffb3dd, ['🍭', '🍬', '🧁', '🍩'], '🦄', 'Taffy the Unicorn', ['🍭', '🍬', '🧁', '🍩', '🍪', '🍦', '🎂', '🍫', '🍡', '🍰']),
  R(5, 'Rainbow Meadow', '🌈', 0x2f7d4f, 0x14402a, 0xffd166, ['🌈', '🌼', '🐞', '🦋'], '🐰', 'Poppy the Bunny', ['🌈', '🌼', '🐞', '🦋', '🌷', '🍀', '🐝', '🌻', '🌺', '🐛']),
  R(6, 'Star Sky', '🚀', 0x1a1f4d, 0x0a0c24, 0x8f9dff, ['🪐', '⭐', '☄️', '🌟'], '👽', 'Zizi the Stargazer', ['🚀', '🪐', '⭐', '☄️', '🌙', '👽', '🛸', '🌟', '🔭', '🌌']),
  R(7, 'Snowy Summit', '❄️', 0x3f6ea8, 0x1a2c4a, 0xcfe8ff, ['❄️', '⛄', '🌨️', '🧊'], '🐧', 'Pip the Penguin', ['❄️', '⛄', '🧊', '🎿', '🛷', '🐧', '🧣', '🧤', '⛷️', '🏔️']),
  R(8, 'Fairy Garden', '🧚', 0x4a2a6e, 0x1e0f33, 0xd7b7ff, ['🧚', '🌷', '🍄', '✨'], '🦉', 'Luna the Owl', ['🧚', '🍄', '🌸', '🍃', '🪷', '🌿', '🌜', '💐', '🦋', '✨']),
  R(9, 'Dino Valley', '🦕', 0x5a6e2a, 0x263312, 0xc9e265, ['🦕', '🌴', '🥚', '🌋'], '🦖', 'Rocky the Rex', ['🦕', '🦖', '🥚', '🌋', '🌴', '🦴', '🐊', '🪨', '🍖', '🌵']),
  R(10, 'Pirate Bay', '🏴‍☠️', 0x2a5a6e, 0x102633, 0xffcf7d, ['⛵', '🗺️', '🦜', '💰'], '🦜', 'Coco the Parrot', ['🏴‍☠️', '⚓', '🗺️', '💰', '🦜', '⛵', '🧭', '🪙', '🔱', '🏝️']),
  R(11, 'Cloud Kingdom', '☁️', 0x7d9fd6, 0x3a4f7d, 0xfff3d6, ['☁️', '🎈', '🪁', '🕊️'], '🦢', 'Skye the Swan', ['☁️', '🎈', '🪁', '🕊️', '🦢', '🌤️', '⛅', '💨', '🎐', '🪂']),
  R(12, 'Crystal Caves', '💎', 0x33245e, 0x120a2e, 0x9be8e0, ['💎', '🔮', '✨', '🪨'], '🐉', 'Gem the Cave Dragon', ['💎', '🔮', '🪨', '🦇', '🕯️', '⛏️', '🏮', '🪞', '💠', '🐉']),
];

export const REGION_COUNT = REGIONS.length;
export const TOTAL_LESSONS = 120;

export function regionForLesson(lesson: number): Region {
  const clamped = Math.min(TOTAL_LESSONS, Math.max(1, lesson));
  return REGIONS[Math.floor((clamped - 1) / 10)]!;
}

/**
 * Each region leans on one of the three base realms for the machinery the
 * mini-games expect (collectible pools, collection shelf). Rotating keeps all
 * three collection shelves filling across the whole road.
 */
export function baseRealmFor(region: Region): RealmId {
  return (['cove', 'woods', 'castle'] as const)[(region.id - 1) % 3]!;
}

/** A RealmTheme dressed in the region's own palette + host creature. */
export function themeForRegion(region: Region): RealmTheme {
  const base = THEMES[baseRealmFor(region)];
  return {
    ...base,
    name: region.name,
    bgTop: region.bgTop,
    bgBottom: region.bgBottom,
    accent: region.accent,
    accentCss: `#${region.accent.toString(16).padStart(6, '0')}`,
    creature: region.creature,
    creatureName: region.creatureName,
    ambient: region.ambient,
    // lesson sessions award straight into the region's own album
    collectibles: region.collectibles,
    collectionKey: region.collectionKey,
  };
}

/** True when `lesson` is a region's final lesson — crossing time next pass. */
export function isRegionFinale(lesson: number): boolean {
  return lesson % 10 === 0;
}
