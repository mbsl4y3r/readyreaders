/**
 * Tomorrow's Treasure — the thing that brings her back.
 *
 * The research recipe for a child returning tomorrow needs "a specific
 * unopened thing left VISIBLY at session end". A line of text that says
 * "a new lesson opens tomorrow" is a promise, not a thing. This module
 * names one concrete, wrapped reward and pins it to a lesson, so the same
 * treasure is shown at session end AND sits on the Reading Road map until
 * she opens it by reading.
 *
 * Design rules:
 * - DETERMINISTIC. The gift for a lesson is derived, never rolled, so the
 *   treasure promised last night is the same treasure waiting this morning.
 *   (Deriving instead of storing also means no save-schema migration.)
 * - NOTHING IS EVER LOST (constitution). Miss the check-out and the gift
 *   simply stays wrapped on that stop, waiting. It is never taken away and
 *   never expires.
 * - It is a REWARD, never a gate: no fail state, no cost, no streak.
 */
import { COSMETICS, type CosmeticItem } from '../avatar/catalog';
import type { ProgressData } from './progress';

export interface Gift {
  /** Cosmetic id, or 'pearls' once she owns the whole wardrobe. */
  id: string;
  /** Glyph for the wrapped/opened treasure. */
  emoji: string;
  /** Kid-facing name — a grown-up may read it aloud. */
  label: string;
  /** The lesson that opens it. */
  lesson: number;
  kind: 'cosmetic' | 'pearls';
}

/** Pearls granted when every cosmetic is already hers — the wardrobe is finite. */
export const GIFT_PEARLS = 15;

/** Small stable hash so a lesson always maps to the same slot in the pool. */
function hashLesson(lesson: number): number {
  let h = lesson * 2654435761;
  h ^= h >>> 13;
  return Math.abs(h);
}

/**
 * The treasure that opens by passing `lesson`.
 *
 * Picks from cosmetics she does not own yet, scoped to her character's track,
 * cheapest-first so early lessons hand out small delights and later ones the
 * showpieces. Returns a pearl gift once she owns everything.
 */
export function giftForLesson(progress: ProgressData, lesson: number): Gift {
  const owned = new Set(progress.cosmetics);
  const track = progress.avatar.character;
  const pool: CosmeticItem[] = COSMETICS.filter(
    (c) => c.price > 0 && !owned.has(c.id) && (c.track === undefined || c.track === track),
  ).sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));

  if (pool.length === 0) {
    return { id: 'bonus-pearls', emoji: '🦪', label: `${GIFT_PEARLS} pearls`, lesson, kind: 'pearls' };
  }
  // Bias toward the cheaper half so the drip stays frequent, but keep it
  // deterministic per lesson.
  const span = Math.max(1, Math.ceil(pool.length / 2));
  const item = pool[hashLesson(lesson) % span]!;
  return { id: item.id, emoji: item.emoji, label: item.label, lesson, kind: 'cosmetic' };
}

/**
 * Grant the treasure for a passed lesson. Mutates progress; the caller saves.
 * Returns the gift so the celebration can show what was just opened.
 */
export function claimGift(progress: ProgressData, lesson: number): Gift {
  const gift = giftForLesson(progress, lesson);
  if (gift.kind === 'pearls') progress.pearls += GIFT_PEARLS;
  else if (!progress.cosmetics.includes(gift.id)) progress.cosmetics.push(gift.id);
  return gift;
}
