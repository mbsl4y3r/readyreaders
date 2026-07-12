/**
 * Progress persistence — localStorage, no backend.
 * Per-word latency/mastery stats drive the adaptive queue.
 * Export/import as a copy-paste code guards against iOS storage eviction.
 */
import { defaultAvatar, starterCosmetics, START_PEARLS, type AvatarConfig } from '../avatar/catalog';
import { REGIONS } from '../content/regions';

export interface WordStat {
  exposures: number;
  firstTryCorrect: number;
  /** Last 5 correct-response latencies, ms. */
  latencies: number[];
  /** Exponential moving average latency, ms (α = 0.4). 0 = no data yet. */
  ema: number;
  /** Personal best latency, ms. */
  best: number;
  /** Epoch days when last practiced. */
  lastSeen: number;
  /** 0 learning · 1 known · 2 quick · 3 automatic */
  mastery: 0 | 1 | 2 | 3;
}

export interface ProgressData {
  version: 1;
  /** Highest unlocked game level (1..9). */
  currentLevel: number;
  /** Finished reading trips per level id — passing the frontier opens the next. */
  levelPlays: Record<number, number>;
  /** Parent-set marker: which book lesson Evie is on. */
  bookLesson: number;
  /** The Reading Road: the lesson she's working on now (1..120, one per day). */
  lesson: number;
  /** yyyy-mm-dd of the last lesson pass — the one-new-lesson-a-day gate. */
  lastPassDate: string;
  /** Word ids missed at the last check-out — re-drilled before her retry. */
  checkoutMisses: string[];
  /** True once the placement voyage has confirmed the starting frontier. */
  placed: boolean;
  /** True once the first-run character creator has made Evie her own. */
  created: boolean;
  words: Record<string, WordStat>;
  /**
   * Collectible albums by key: the three legacy realm pools ('treasures',
   * 'pets', 'charms' — still fed by legacy level-mode sessions) plus one
   * 'region-1'…'region-12' album per Reading Road region.
   */
  collections: Record<string, string[]>;
  sessions: { date: string; rounds: number; minutes?: number }[];
  /** Best lightning-round total time, ms (0 = not yet played). */
  speedBest: number;
  /** Story pages already read (story ids) — the bookshelf remembers. */
  storiesRead: string[];
  /** Wardrobe currency — earned only by reading. */
  pearls: number;
  /** Achievement badge ids already earned + celebrated (see engine/achievements). */
  badges: string[];
  /** Best score per arcade game id (see content/arcade-games). */
  arcadeBest: Record<string, number>;
  /** Epoch ms until which the Games Arcade play pass is active (0 = none). */
  arcadePassUntil: number;
  /** Reading-day streak — the 🔥. lastDate is an ISO yyyy-mm-dd. */
  streak: { lastDate: string; days: number; best: number };
  /** Arcade currency — earned by playing games, spent in the ticket shop. */
  tickets: number;
  /** Sticker ids earned from milestones (see services/juice STICKERS). */
  stickers: string[];
  /** Pet Inky's growth (xp from reading; level derived + persisted). */
  inky: { xp: number; level: number };
  /** Saved Photo Mode snapshots as PNG data URLs (cap 6, newest last). */
  photos: string[];
  /** Story page ids that have one of Evie's own recordings (audio blobs in IndexedDB). */
  recordings: string[];
  /** Cosmetic item ids owned (see avatar/catalog.ts). */
  cosmetics: string[];
  /** What Evie and Inky are wearing right now. */
  avatar: AvatarConfig;
  settings: {
    sessionCapMin: number;
    /** Background music on/off (parent corner). */
    musicOn: boolean;
    /** Arcade pace — feeds ctx.difficulty so speed-based games adapt. */
    gameSpeed: 'chill' | 'normal' | 'zippy';
  };
}

const KEY = 'readyreaders.v1';

const LEGACY_POOLS = ['treasures', 'pets', 'charms'] as const;

function freshCollections(): Record<string, string[]> {
  const collections: Record<string, string[]> = {};
  for (const pool of LEGACY_POOLS) collections[pool] = [];
  for (const region of REGIONS) collections[region.collectionKey] = [];
  return collections;
}

/**
 * Ensure every album key exists, then run the ONE-TIME region-album migration:
 * a save from before per-region albums has finds only in the legacy pools, so
 * mirror them into the region albums sequentially — region 1's list fills
 * first (up to 10), then region 2's, and so on. That matches how they were
 * actually earned: one collectible per passed lesson, in lesson order. The
 * legacy pools are left untouched (legacy level-mode sessions still use them).
 */
function normalizeCollections(data: ProgressData): void {
  data.collections ??= freshCollections();
  for (const pool of LEGACY_POOLS) data.collections[pool] ??= [];
  for (const region of REGIONS) data.collections[region.collectionKey] ??= [];

  const regionFinds = REGIONS.some((r) => data.collections[r.collectionKey]!.length > 0);
  let remaining = LEGACY_POOLS.reduce((sum, pool) => sum + data.collections[pool]!.length, 0);
  if (regionFinds || remaining === 0) return;
  for (const region of REGIONS) {
    if (remaining <= 0) break;
    const take = Math.min(10, remaining);
    data.collections[region.collectionKey] = region.collectibles.slice(0, take);
    remaining -= take;
  }
}

export function freshProgress(): ProgressData {
  return {
    version: 1,
    currentLevel: 1,
    levelPlays: {},
    // the Reading Road: every new reader starts at lesson 1 (free advancement
    // through the early lessons lets a child who's further along catch up fast)
    bookLesson: 1,
    lesson: 1,
    lastPassDate: '',
    checkoutMisses: [],
    // placement voyage is a parent tool now, not an onboarding gate
    placed: true,
    created: false,
    words: {},
    collections: freshCollections(),
    sessions: [],
    speedBest: 0,
    storiesRead: [],
    pearls: START_PEARLS,
    badges: [],
    arcadeBest: {},
    arcadePassUntil: 0,
    streak: { lastDate: '', days: 0, best: 0 },
    tickets: 0,
    stickers: [],
    inky: { xp: 0, level: 1 },
    photos: [],
    recordings: [],
    cosmetics: starterCosmetics(),
    avatar: defaultAvatar(),
    settings: { sessionCapMin: 18, musicOn: true, gameSpeed: 'normal' },
  };
}

export function freshStat(): WordStat {
  return {
    exposures: 0,
    firstTryCorrect: 0,
    latencies: [],
    ema: 0,
    best: 0,
    lastSeen: 0,
    mastery: 0,
  };
}

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshProgress();
    const data = JSON.parse(raw) as ProgressData;
    if (data.version !== 1) return freshProgress();
    data.levelPlays ??= {};
    data.lesson ??= 1;
    data.lastPassDate ??= '';
    data.checkoutMisses ??= [];
    // saves from before the placement voyage existed were already mid-journey
    data.placed ??= data.sessions.length > 0;
    data.speedBest ??= 0;
    data.storiesRead ??= [];
    data.pearls ??= START_PEARLS;
    data.badges ??= [];
    data.arcadeBest ??= {};
    data.arcadePassUntil ??= 0;
    data.streak ??= { lastDate: '', days: 0, best: 0 };
    data.tickets ??= 0;
    data.stickers ??= [];
    data.inky ??= { xp: 0, level: 1 };
    data.photos ??= [];
    data.recordings ??= [];
    data.cosmetics ??= starterCosmetics();
    data.avatar ??= defaultAvatar();
    data.created ??= data.placed; // players from before the creator skip it
    data.avatar.character ??= 'girl'; // pre-character saves are the original girl
    data.avatar.face ??= null;
    data.avatar.glasses ??= null;
    data.avatar.earrings ??= null;
    data.settings.musicOn ??= true;
    data.settings.gameSpeed ??= 'normal';
    normalizeCollections(data);
    return data;
  } catch {
    return freshProgress();
  }
}

export function saveProgress(data: ProgressData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full/blocked — game keeps playing, progress just won't persist
  }
}

export function resetProgress(): ProgressData {
  const fresh = freshProgress();
  saveProgress(fresh);
  return fresh;
}

export function statFor(data: ProgressData, wordId: string): WordStat {
  return (data.words[wordId] ??= freshStat());
}

export function epochDays(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

/** Export progress as a copy-paste code (base64 JSON). */
export function exportCode(data: ProgressData): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

export function importCode(code: string): ProgressData | null {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as ProgressData;
    if (data.version !== 1 || typeof data.words !== 'object') return null;
    data.levelPlays ??= {};
    data.lesson ??= 1;
    data.lastPassDate ??= '';
    data.checkoutMisses ??= [];
    data.placed ??= data.sessions.length > 0;
    data.speedBest ??= 0;
    data.storiesRead ??= [];
    data.pearls ??= START_PEARLS;
    data.badges ??= [];
    data.arcadeBest ??= {};
    data.arcadePassUntil ??= 0;
    data.streak ??= { lastDate: '', days: 0, best: 0 };
    data.tickets ??= 0;
    data.stickers ??= [];
    data.inky ??= { xp: 0, level: 1 };
    data.photos ??= [];
    data.recordings ??= [];
    data.cosmetics ??= starterCosmetics();
    data.avatar ??= defaultAvatar();
    data.created ??= data.placed;
    data.avatar.character ??= 'girl';
    data.avatar.face ??= null;
    data.avatar.glasses ??= null;
    data.avatar.earrings ??= null;
    data.settings.musicOn ??= true;
    data.settings.gameSpeed ??= 'normal';
    normalizeCollections(data);
    return data;
  } catch {
    return null;
  }
}
