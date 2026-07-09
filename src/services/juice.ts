/**
 * "Juice" — the reward systems that sit on top of reading: the daily streak,
 * pet Inky's growth, arcade tickets, milestone stickers, seasonal flavor, and
 * the game-speed → difficulty factor. All pure-ish helpers over ProgressData so
 * they're easy to test; scenes call them and render the results.
 */
import type { ProgressData } from './progress';
import { LEVELS, SESSIONS_TO_PASS } from '../content/levels';

// ---- level progression (read to open the next island) -------------------

export interface LevelTripResult {
  /** The level id just unlocked (0 = none this trip). */
  unlockedLevel: number;
  /** Reading trips still needed to pass the current frontier (0 if none/maxed). */
  tripsLeft: number;
}

/**
 * Count one finished reading trip on a level. Finishing the FRONTIER level
 * SESSIONS_TO_PASS times opens the next island (and nudges the content marker
 * so the new island's words are available). Replaying earlier levels just
 * tallies plays without unlocking. Mutates progress.levelPlays / currentLevel /
 * bookLesson; returns what to celebrate.
 */
export function recordLevelTrip(progress: ProgressData, levelId: number): LevelTripResult {
  const plays = (progress.levelPlays[levelId] ?? 0) + 1;
  progress.levelPlays[levelId] = plays;
  if (levelId !== progress.currentLevel || progress.currentLevel >= 9) {
    return { unlockedLevel: 0, tripsLeft: 0 };
  }
  if (plays >= SESSIONS_TO_PASS) {
    progress.currentLevel = levelId + 1;
    const newRangeEnd = LEVELS[levelId]!.lessonRange[1]; // LEVELS is 0-indexed → new level
    if (progress.bookLesson < newRangeEnd) progress.bookLesson = newRangeEnd;
    return { unlockedLevel: progress.currentLevel, tripsLeft: 0 };
  }
  return { unlockedLevel: 0, tripsLeft: SESSIONS_TO_PASS - plays };
}

// ---- daily reading streak (the 🔥) --------------------------------------

/** Milestones that pay a pearl bonus, and the bonus size. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
export const STREAK_BONUS_PEARLS = 5;

/** yyyy-mm-dd for `now` (local date). */
export function todayStr(now = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const t = Date.UTC(y, m - 1, d) - 86_400_000;
  const dt = new Date(t);
  const mm = `${dt.getUTCMonth() + 1}`.padStart(2, '0');
  const dd = `${dt.getUTCDate()}`.padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export interface StreakResult {
  advanced: boolean;
  days: number;
  milestone: number | null;
  bonusPearls: number;
}

/**
 * Mark today as a reading day. First read of a day advances the streak (or
 * resets it to 1 after a gap); repeat reads the same day do nothing. Mutates
 * progress.streak (and pearls on a milestone). Returns what happened.
 */
export function recordReadingDay(progress: ProgressData, today = todayStr()): StreakResult {
  const s = progress.streak;
  if (s.lastDate === today) {
    return { advanced: false, days: s.days, milestone: null, bonusPearls: 0 };
  }
  s.days = s.lastDate === dayBefore(today) ? s.days + 1 : 1;
  s.lastDate = today;
  if (s.days > s.best) s.best = s.days;
  const milestone = STREAK_MILESTONES.includes(s.days) ? s.days : null;
  const bonusPearls = milestone ? STREAK_BONUS_PEARLS : 0;
  progress.pearls += bonusPearls;
  return { advanced: true, days: s.days, milestone, bonusPearls };
}

// ---- pet Inky's growth ---------------------------------------------------

export const INKY_XP_PER_SESSION = 4;
export const INKY_XP_PER_STORY = 3;
export const INKY_MAX_LEVEL = 10;
/** XP to reach each next level (flat-ish, gentle). */
export const INKY_XP_PER_LEVEL = 12;

/** Free pet cosmetics gifted when Inky reaches a level (id must exist in catalog). */
export const INKY_LEVEL_GIFTS: Record<number, string> = {
  3: 'petbow',
  5: 'petstar',
  7: 'party',
  9: 'minicrown',
};

export function inkyLevelForXp(xp: number): number {
  return Math.min(INKY_MAX_LEVEL, 1 + Math.floor(xp / INKY_XP_PER_LEVEL));
}

/** Fraction (0..1) toward the next level, for a progress bar. 1 at max level. */
export function inkyLevelProgress(xp: number): number {
  if (inkyLevelForXp(xp) >= INKY_MAX_LEVEL) return 1;
  return (xp % INKY_XP_PER_LEVEL) / INKY_XP_PER_LEVEL;
}

export interface InkyResult {
  leveledUp: boolean;
  level: number;
  gift: string | null;
}

/** Add XP to Inky; mutates progress.inky and (on a gift level) cosmetics. */
export function addInkyXp(progress: ProgressData, amount: number): InkyResult {
  const before = progress.inky.level;
  progress.inky.xp += amount;
  const level = inkyLevelForXp(progress.inky.xp);
  progress.inky.level = level;
  let gift: string | null = null;
  if (level > before) {
    for (let l = before + 1; l <= level; l++) {
      const g = INKY_LEVEL_GIFTS[l];
      if (g && !progress.cosmetics.includes(g)) {
        progress.cosmetics.push(g);
        gift = g;
      }
    }
  }
  return { leveledUp: level > before, level, gift };
}

/** A friendly title Inky earns as it grows — shown by its portrait. */
export function inkyTitle(level: number): string {
  const titles = [
    'Little Inky', 'Little Inky', 'Curious Inky', 'Brave Inky', 'Clever Inky',
    'Sparkly Inky', 'Star Inky', 'Super Inky', 'Royal Inky', 'Legendary Inky',
  ];
  return titles[Math.min(titles.length - 1, Math.max(0, level - 1))]!;
}

// ---- arcade tickets ------------------------------------------------------

export const TICKETS_PER_PLAY = 1;
export const TICKETS_NEW_BEST = 3;

/**
 * The ticket shop: premium cosmetics you buy with arcade tickets instead of
 * reading pearls. Ids reference existing catalog items so the avatar painter
 * needs no new work — tickets are just a second path to the fancy stuff.
 */
export const TICKET_SHOP: { id: string; tickets: number }[] = [
  { id: 'star', tickets: 12 },
  { id: 'heartgem', tickets: 14 },
  { id: 'petwizard', tickets: 14 },
  { id: 'tiara', tickets: 18 },
  { id: 'wand', tickets: 20 },
  { id: 'gown-gold', tickets: 24 },
  { id: 'crown', tickets: 30 },
  { id: 'tail-rainbow', tickets: 36 },
];

// ---- game speed → difficulty --------------------------------------------

export function speedFactor(gameSpeed: ProgressData['settings']['gameSpeed']): number {
  return gameSpeed === 'chill' ? 0.8 : gameSpeed === 'zippy' ? 1.25 : 1;
}

// ---- seasonal flavor (date-driven, no persistence) ----------------------

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'holiday';

export interface SeasonTheme {
  name: string;
  emoji: string[];
  tintTop: number;
  tintBottom: number;
}

export const SEASON_THEMES: Record<Season, SeasonTheme> = {
  spring: { name: 'Spring', emoji: ['🌸', '🌷', '🦋'], tintTop: 0x2a5d4a, tintBottom: 0x123a2c },
  summer: { name: 'Summer', emoji: ['☀️', '🐚', '🍉'], tintTop: 0x1f6a8a, tintBottom: 0x0b3a52 },
  autumn: { name: 'Autumn', emoji: ['🍂', '🍁', '🌰'], tintTop: 0x5d3a1f, tintBottom: 0x2e1c0e },
  winter: { name: 'Winter', emoji: ['❄️', '⛄', '🌨️'], tintTop: 0x2a3f6a, tintBottom: 0x121d3a },
  holiday: { name: 'Holidays', emoji: ['🎁', '⭐', '❄️'], tintTop: 0x5a1f2a, tintBottom: 0x2a0e14 },
};

export function seasonFor(now = new Date()): Season {
  const m = now.getMonth() + 1; // 1..12
  const day = now.getDate();
  if (m === 12) return 'holiday'; // December is the holidays
  if (m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'autumn';
}

// ---- milestone stickers --------------------------------------------------

export interface Sticker {
  id: string;
  emoji: string;
  label: string;
  earned: (p: ProgressData) => boolean;
}

/** How many distinct arcade games have a recorded best score. */
function gamesPlayed(p: ProgressData): number {
  return Object.values(p.arcadeBest).filter((v) => v > 0).length;
}

export const STICKERS: Sticker[] = [
  { id: 'first-game', emoji: '🕹️', label: 'First Game', earned: (p) => gamesPlayed(p) >= 1 },
  { id: 'game-explorer', emoji: '🎮', label: 'Game Explorer', earned: (p) => gamesPlayed(p) >= 5 },
  { id: 'game-master', emoji: '🏆', label: 'Game Master', earned: (p) => gamesPlayed(p) >= 12 },
  { id: 'streak-3', emoji: '🔥', label: '3-Day Streak', earned: (p) => p.streak.best >= 3 },
  { id: 'streak-7', emoji: '🌟', label: '7-Day Streak', earned: (p) => p.streak.best >= 7 },
  { id: 'ticket-saver', emoji: '🎟️', label: 'Ticket Saver', earned: (p) => (p.tickets + spentTickets(p)) >= 20 },
  { id: 'photographer', emoji: '📸', label: 'Photographer', earned: (p) => p.photos.length >= 1 },
  { id: 'storyteller', emoji: '🎤', label: 'Storyteller', earned: (p) => p.recordings.length >= 1 },
  { id: 'inky-pal', emoji: '🐙', label: "Inky's Pal", earned: (p) => p.inky.level >= 5 },
  { id: 'inky-legend', emoji: '💜', label: 'Inky Legend', earned: (p) => p.inky.level >= INKY_MAX_LEVEL },
  { id: 'dress-up', emoji: '👗', label: 'Dress-Up Star', earned: (p) => p.cosmetics.length >= 40 },
  { id: 'bookworm', emoji: '📚', label: 'Bookworm', earned: (p) => p.storiesRead.length >= 3 },
];

// tickets are spent, so "earned 20 total" can't read the live balance alone;
// we don't track lifetime tickets separately, so approximate with balance only.
function spentTickets(_p: ProgressData): number {
  return 0;
}

export const STICKERS_BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

/** Stickers earned but not yet recorded in progress.stickers. */
export function newlyEarnedStickers(progress: ProgressData): Sticker[] {
  const have = new Set(progress.stickers);
  return STICKERS.filter((s) => !have.has(s.id) && s.earned(progress));
}
