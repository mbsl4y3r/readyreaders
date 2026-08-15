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
  /**
   * Play Passes earned by READING — one per lesson passed. The arcade used to
   * be a toll booth: every visit cost pearls, the same currency the wardrobe
   * runs on, so playing a game meant not buying an outfit and a child with no
   * pearls could not play at all. Reading is now the way in; pearls remain a
   * second door for a grown-up who wants to open it.
   */
  arcadeTokens: number;
  /**
   * The last region whose host creature has welcomed her (0 = none yet).
   * The greeting plays ONCE per region — a host who repeats itself on every
   * visit is exactly the nagging this game's audio rules exist to prevent.
   */
  greetedRegion: number;
  /** Reading-day streak — the 🔥. lastDate is an ISO yyyy-mm-dd. */
  streak: { lastDate: string; days: number; best: number };
  /** Arcade currency — earned by playing games, spent in the ticket shop. */
  tickets: number;
  /** Sticker ids earned from milestones (see services/juice STICKERS). */
  stickers: string[];
  /** Pet Inky's growth (xp from reading; level derived + persisted). */
  inky: { xp: number; level: number };
  /**
   * Saved Photo Mode snapshots as PNG data URLs, newest last. Uncapped —
   * nothing is ever deleted to make room. Persisted in their own record
   * (see PHOTO_KEY), not inside the main save.
   */
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
/**
 * Photos live in their OWN storage record.
 *
 * A snapshot is megabytes of base64 while the rest of a save is kilobytes, so
 * keeping them in one record meant a single photo could push the whole thing
 * past the quota and take a session's reading down with it — silently. Her
 * reading progress must never be at the mercy of a keepsake.
 */
const PHOTO_KEY = 'readyreaders.photos.v1';

/**
 * Storage refused the last write. NEVER swallowed: the parent corner shows a
 * warning with the export code, so a save that cannot happen is something a
 * grown-up finds out about rather than something a child discovers by losing
 * a week of reading.
 */
let saveBlocked = false;
/** True when the album had to be released to keep her reading safe. */
let photosEvicted = false;

export function saveIsBlocked(): boolean {
  return saveBlocked;
}
export function photosWereEvicted(): boolean {
  return photosEvicted;
}

export interface SaveResult {
  /** Her reading progress reached storage. */
  ok: boolean;
  /** The album reached storage. False means the caller must TELL her. */
  photosOk: boolean;
}

export function loadPhotos(): string[] {
  try {
    const raw = localStorage.getItem(PHOTO_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? (list as string[]).filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Write the album. Returns false when storage refused it — the caller must
 * say so out loud. Dropping her oldest photo to make room is exactly the
 * silent loss this game promises never to do.
 */
export function savePhotos(photos: string[]): boolean {
  try {
    localStorage.setItem(PHOTO_KEY, JSON.stringify(photos));
    return true;
  } catch {
    return false;
  }
}

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
    arcadeTokens: 0,
    greetedRegion: 0,
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
    data.arcadeTokens ??= 0;
    data.greetedRegion ??= 0;
    data.streak ??= { lastDate: '', days: 0, best: 0 };
    data.tickets ??= 0;
    data.stickers ??= [];
    data.inky ??= { xp: 0, level: 1 };
    // Photos used to live inside this record. Move any we find into the album
    // store — one-time, and it never discards: whichever side has them wins.
    {
      const embedded = Array.isArray(data.photos) ? data.photos : [];
      const stored = loadPhotos();
      data.photos = stored.length > 0 ? stored : embedded;
      if (stored.length === 0 && embedded.length > 0) savePhotos(embedded);
    }
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

/**
 * Persist. Reading progress goes in one small record, the album in another,
 * so a full album can never block a lesson from being saved.
 *
 * When storage is so full that even the small record is refused, the album is
 * released and the write retried: between a keepsake and a month of reading,
 * the reading wins. That is a real loss, so it is flagged rather than hidden —
 * `photosWereEvicted()` and `saveIsBlocked()` both surface in the parent
 * corner. Nothing here ever fails quietly.
 */
export function saveProgress(data: ProgressData): SaveResult {
  const { photos, ...core } = data;
  const record = JSON.stringify({ ...core, photos: [] });
  let ok = false;
  try {
    localStorage.setItem(KEY, record);
    ok = true;
  } catch {
    try {
      localStorage.removeItem(PHOTO_KEY);
      localStorage.setItem(KEY, record);
      ok = true;
      photosEvicted = true;
    } catch {
      ok = false;
    }
  }
  saveBlocked = !ok;
  const photosOk = photos.length === 0 ? true : savePhotos(photos);
  return { ok, photosOk };
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
    data.arcadeTokens ??= 0;
    data.greetedRegion ??= 0;
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
