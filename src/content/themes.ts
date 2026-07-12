import type { RealmId } from './types';

export interface RealmTheme {
  id: RealmId;
  name: string;
  /** Scene background top/bottom gradient. */
  bgTop: number;
  bgBottom: number;
  accent: number;
  accentCss: string;
  /** The realm's creature (feed-the-creature host + greeter). */
  creature: string;
  creatureName: string;
  /** Pool of collectible emoji awarded at celebrations. */
  collectibles: string[];
  /** Album key in progress.collections ('treasures'/'pets'/'charms' or 'region-N'). */
  collectionKey: string;
  /** Ambient decoration emoji sprinkled in the background. */
  ambient: string[];
}

export const THEMES: Record<RealmId, RealmTheme> = {
  cove: {
    id: 'cove',
    name: 'Coral Cove',
    bgTop: 0x0b3d64,
    bgBottom: 0x072a47,
    accent: 0x4fc3f7,
    accentCss: '#4fc3f7',
    creature: '🐙',
    creatureName: 'Ollie the Octopus',
    collectibles: ['🐚', '🦪', '💎', '🫧', '🪸', '⭐', '🧜‍♀️', '🐬', '🐠', '🏺'],
    collectionKey: 'treasures',
    ambient: ['🐟', '🫧', '🪸', '🐠', '🌊'],
  },
  woods: {
    id: 'woods',
    name: 'Whisker Woods',
    bgTop: 0x1b4332,
    bgBottom: 0x081c15,
    accent: 0x95d5b2,
    accentCss: '#95d5b2',
    creature: '🦦',
    creatureName: 'Willa the Otter',
    collectibles: ['🐰', '🐿️', '🦔', '🐢', '🐥', '🦊', '🐇', '🦉', '🐾', '🦌'],
    collectionKey: 'pets',
    ambient: ['🌲', '🍄', '🌿', '🦋', '🌼'],
  },
  castle: {
    id: 'castle',
    name: 'Starlight Castle',
    bgTop: 0x3c096c,
    bgBottom: 0x10002b,
    accent: 0xe0aaff,
    accentCss: '#e0aaff',
    creature: '🐲',
    creatureName: 'Sparky the Dragon',
    collectibles: ['🔮', '👑', '🪄', '💫', '🦄', '🧚', '✨', '🏰', '🗝️', '🌟'],
    collectionKey: 'charms',
    ambient: ['✨', '🌙', '⭐', '🏰', '🧚'],
  },
};
