/**
 * Achievement badges — long-term reading goals, all computed from progress
 * she already generates (no extra tracking beyond `badges`, which just
 * remembers which have been celebrated so each pops exactly once).
 */
import type { ProgressData } from '../services/progress';
import { starterCosmetics } from '../avatar/catalog';

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  /** One kid-facing line — a grown-up may read it aloud. */
  hint: string;
  /** Earned when this returns true. */
  check: (p: ProgressData) => boolean;
}

/** Word stats, excluding the ':'-prefixed phrase/sentence pseudo-entries. */
function wordCount(p: ProgressData, minMastery: number): number {
  return Object.entries(p.words).filter(
    ([k, s]) => !k.includes(':') && s.mastery >= minMastery,
  ).length;
}

function boughtCount(p: ProgressData): number {
  const starters = new Set(starterCosmetics());
  return p.cosmetics.filter((id) => !starters.has(id)).length;
}

export const BADGES: Badge[] = [
  { id: 'first-word', emoji: '🌟', label: 'First Word', hint: 'Read a word quickly', check: (p) => wordCount(p, 2) >= 1 },
  { id: 'ten-quick', emoji: '🎯', label: 'Ten Quick', hint: 'Read 10 words quickly', check: (p) => wordCount(p, 2) >= 10 },
  { id: 'quarter', emoji: '🏆', label: 'Word Champ', hint: 'Read 25 words quickly', check: (p) => wordCount(p, 2) >= 25 },
  { id: 'automatic', emoji: '🧠', label: 'Super Reader', hint: '10 words on automatic', check: (p) => wordCount(p, 3) >= 10 },
  { id: 'first-story', emoji: '📖', label: 'First Story', hint: 'Finish a story', check: (p) => p.storiesRead.length >= 1 },
  { id: 'bookworm', emoji: '📚', label: 'Bookworm', hint: 'Finish 3 stories', check: (p) => p.storiesRead.length >= 3 },
  { id: 'all-stories', emoji: '🏰', label: 'Storyteller', hint: 'Finish every story', check: (p) => p.storiesRead.length >= 6 },
  { id: 'speedy', emoji: '⚡', label: 'Speedy', hint: 'Finish a lightning round', check: (p) => p.speedBest > 0 },
  { id: 'lightning', emoji: '⚡', label: 'Lightning Fast', hint: 'Beat 4 seconds', check: (p) => p.speedBest > 0 && p.speedBest <= 4000 },
  { id: 'five-days', emoji: '🗓️', label: 'Five Sessions', hint: 'Read 5 times', check: (p) => p.sessions.length >= 5 },
  { id: 'ten-days', emoji: '🌈', label: 'Ten Sessions', hint: 'Read 10 times', check: (p) => p.sessions.length >= 10 },
  { id: 'explorer', emoji: '🗺️', label: 'Explorer', hint: 'Reach Level 3', check: (p) => p.currentLevel >= 3 },
  { id: 'adventurer', emoji: '👑', label: 'Adventurer', hint: 'Reach Level 6', check: (p) => p.currentLevel >= 6 },
  { id: 'dressed-up', emoji: '👗', label: 'Dressed Up', hint: 'Buy 5 wardrobe items', check: (p) => boughtCount(p) >= 5 },
  { id: 'fashionista', emoji: '💎', label: 'Fashionista', hint: 'Buy 20 wardrobe items', check: (p) => boughtCount(p) >= 20 },
];

export const BADGES_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

/** Badges whose condition is met but that haven't been celebrated yet. */
export function newlyEarned(p: ProgressData): Badge[] {
  const have = new Set(p.badges);
  return BADGES.filter((b) => !have.has(b.id) && b.check(p));
}
