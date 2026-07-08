/**
 * Progress persistence — localStorage, no backend.
 * Per-word latency/mastery stats drive the adaptive queue.
 * Export/import as a copy-paste code guards against iOS storage eviction.
 */
import { defaultAvatar, starterCosmetics, START_PEARLS, type AvatarConfig } from '../avatar/catalog';

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
  /** Parent-set marker: which book lesson Evie is on. */
  bookLesson: number;
  /** True once the placement voyage has confirmed the starting frontier. */
  placed: boolean;
  /** True once the first-run character creator has made Evie her own. */
  created: boolean;
  words: Record<string, WordStat>;
  collections: {
    treasures: string[];
    pets: string[];
    charms: string[];
  };
  sessions: { date: string; rounds: number; minutes?: number }[];
  /** Best lightning-round total time, ms (0 = not yet played). */
  speedBest: number;
  /** Story pages already read (story ids) — the bookshelf remembers. */
  storiesRead: string[];
  /** Wardrobe currency — earned only by reading. */
  pearls: number;
  /** Cosmetic item ids owned (see avatar/catalog.ts). */
  cosmetics: string[];
  /** What Evie and Inky are wearing right now. */
  avatar: AvatarConfig;
  settings: {
    sessionCapMin: number;
    /** Background music on/off (parent corner). */
    musicOn: boolean;
  };
}

const KEY = 'readyreaders.v1';

export function freshProgress(): ProgressData {
  return {
    version: 1,
    currentLevel: 1,
    bookLesson: 17,
    placed: false,
    created: false,
    words: {},
    collections: { treasures: [], pets: [], charms: [] },
    sessions: [],
    speedBest: 0,
    storiesRead: [],
    pearls: START_PEARLS,
    cosmetics: starterCosmetics(),
    avatar: defaultAvatar(),
    settings: { sessionCapMin: 18, musicOn: true },
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
    // saves from before the placement voyage existed were already mid-journey
    data.placed ??= data.sessions.length > 0;
    data.speedBest ??= 0;
    data.storiesRead ??= [];
    data.pearls ??= START_PEARLS;
    data.cosmetics ??= starterCosmetics();
    data.avatar ??= defaultAvatar();
    data.created ??= data.placed; // players from before the creator skip it
    data.avatar.face ??= null;
    data.avatar.glasses ??= null;
    data.avatar.earrings ??= null;
    data.settings.musicOn ??= true;
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
    data.placed ??= data.sessions.length > 0;
    data.speedBest ??= 0;
    data.storiesRead ??= [];
    data.pearls ??= START_PEARLS;
    data.cosmetics ??= starterCosmetics();
    data.avatar ??= defaultAvatar();
    data.created ??= data.placed;
    data.avatar.face ??= null;
    data.avatar.glasses ??= null;
    data.avatar.earrings ??= null;
    data.settings.musicOn ??= true;
    return data;
  } catch {
    return null;
  }
}
