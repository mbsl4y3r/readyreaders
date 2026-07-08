/**
 * The wardrobe catalog — every cosmetic Evie can earn, what it costs in
 * pearls, and the avatar configuration the painter renders from.
 *
 * Design rules:
 * - Skin tones are IDENTITY, not merchandise: always free, never in the shop.
 * - One tasteful starter look is free (waves + chestnut + seafoam tail +
 *   violet Inky) so the wardrobe is never empty-handed.
 * - Pearls come from READING only — sessions, stories, personal bests —
 *   which structurally keeps the wardrobe a reward, not the game.
 * - `starter` items are the palette the first-run character creator offers
 *   for free; the fancier pieces stay shop-only so there's always more to
 *   earn (rainbow tail, gold gown, crowns, glasses…).
 */

export type SkinId = 'shell' | 'sand' | 'amber' | 'cocoa';
export type HairStyleId =
  | 'waves'
  | 'bun'
  | 'braids'
  | 'bob'
  | 'pony'
  | 'curls'
  | 'pixie'
  | 'longstraight'
  | 'spacebuns'
  | 'sidebraid';
export type HairColorId =
  | 'chestnut'
  | 'midnight'
  | 'sunshine'
  | 'ember'
  | 'rose'
  | 'lilac'
  | 'aqua'
  | 'silver'
  | 'auburn'
  | 'honey';
/**
 * Outfits render by prefix: tail-* mermaid, gown-* princess, fairy-* winged
 * fairy dress, play-* everyday clothes (legs + shoes).
 */
export type OutfitId =
  | 'tail-seafoam'
  | 'tail-coral'
  | 'tail-violet'
  | 'tail-midnight'
  | 'tail-gold'
  | 'tail-rainbow'
  | 'tail-sunset'
  | 'tail-pearl'
  | 'gown-rose'
  | 'gown-sky'
  | 'gown-mint'
  | 'gown-berry'
  | 'gown-violet'
  | 'gown-gold'
  | 'gown-winter'
  | 'gown-starlight'
  | 'fairy-rose'
  | 'fairy-violet'
  | 'fairy-mint'
  | 'play-sunny'
  | 'play-berry'
  | 'play-denim';
export type HeadwearId =
  | 'flower'
  | 'starclip'
  | 'bowhair'
  | 'tiara'
  | 'crown'
  | 'flowercrown'
  | 'headband'
  | 'sunhat'
  | 'earmuffs';
export type NecklaceId = 'pearls' | 'locket' | 'heartgem' | 'ribbon' | 'starbead';
export type HeldId = 'seastar' | 'wand' | 'book' | 'bouquet' | 'balloon' | 'lantern';
export type FaceId = 'freckles' | 'sunfreckles' | 'blushhearts';
export type GlassesId = 'round' | 'star' | 'heart';
export type EarringId = 'studs' | 'pearl' | 'stars' | 'hearts';
// Pet colors carry a `pet-` prefix so their ids never collide with a same-named
// hair color (there is a 'rose'/'midnight' in BOTH palettes). Ownership lives in
// one flat id set (progress.cosmetics), so a shared id would let owning the free
// creator pick in one category silently unlock the shop-only item in the other.
export type PetColorId = 'violet' | 'pet-rose' | 'sea' | 'coral' | 'gold' | 'pet-midnight';
export type PetHatId = 'petbow' | 'petflower' | 'party' | 'minicrown' | 'petstar' | 'petwizard';

export interface AvatarConfig {
  skin: SkinId;
  hairStyle: HairStyleId;
  hairColor: HairColorId;
  outfit: OutfitId;
  headwear: HeadwearId | null;
  necklace: NecklaceId | null;
  held: HeldId | null;
  face: FaceId | null;
  glasses: GlassesId | null;
  earrings: EarringId | null;
  petColor: PetColorId;
  petHat: PetHatId | null;
}

export function defaultAvatar(): AvatarConfig {
  return {
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
  };
}

export type CosmeticCategory =
  | 'hairStyle'
  | 'hairColor'
  | 'outfit'
  | 'headwear'
  | 'necklace'
  | 'held'
  | 'face'
  | 'glasses'
  | 'earrings'
  | 'petColor'
  | 'petHat';

export interface CosmeticItem {
  id: string;
  category: CosmeticCategory;
  /** Short, kid-facing (a grown-up may read it aloud — keep it fun). */
  label: string;
  /** Pearl price; 0 = starter item, owned from the first visit. */
  price: number;
  /** Chip glyph for the shop UI. */
  emoji: string;
  /** Offered free in the first-run character creator. */
  starter?: boolean;
}

const I = (
  id: string,
  category: CosmeticCategory,
  label: string,
  price: number,
  emoji: string,
  starter = false,
): CosmeticItem => ({ id, category, label, price, emoji, starter });

export const COSMETICS: CosmeticItem[] = [
  // hair styles
  I('waves', 'hairStyle', 'Ocean Waves', 0, '🌊', true),
  I('bob', 'hairStyle', 'Breezy Bob', 8, '💇‍♀️', true),
  I('pony', 'hairStyle', 'High Pony', 8, '🎀', true),
  I('curls', 'hairStyle', 'Bouncy Curls', 8, '🌀', true),
  I('longstraight', 'hairStyle', 'Long & Sleek', 8, '💧', true),
  I('bun', 'hairStyle', 'Royal Bun', 10, '👸'),
  I('braids', 'hairStyle', 'Twin Braids', 10, '🧵'),
  I('pixie', 'hairStyle', 'Pixie Cut', 10, '✂️'),
  I('spacebuns', 'hairStyle', 'Space Buns', 12, '🪐'),
  I('sidebraid', 'hairStyle', 'Side Braid', 12, '🌾'),
  // hair colors
  I('chestnut', 'hairColor', 'Chestnut', 0, '🌰', true),
  I('midnight', 'hairColor', 'Midnight', 6, '🌙', true),
  I('sunshine', 'hairColor', 'Sunshine', 6, '☀️', true),
  I('ember', 'hairColor', 'Ember Red', 6, '🍁', true),
  I('auburn', 'hairColor', 'Auburn', 6, '🦊', true),
  I('honey', 'hairColor', 'Honey', 6, '🍯', true),
  I('rose', 'hairColor', 'Rose Pink', 8, '🌸'),
  I('lilac', 'hairColor', 'Lilac', 8, '💜'),
  I('aqua', 'hairColor', 'Mermaid Aqua', 8, '🧜‍♀️'),
  I('silver', 'hairColor', 'Silver', 8, '🩶'),
  // outfits — mermaid tails
  I('tail-seafoam', 'outfit', 'Seafoam Tail', 0, '🧜‍♀️', true),
  I('tail-coral', 'outfit', 'Coral Tail', 10, '🪸', true),
  I('tail-violet', 'outfit', 'Violet Tail', 10, '🔮'),
  I('tail-midnight', 'outfit', 'Midnight Tail', 12, '🌌'),
  I('tail-sunset', 'outfit', 'Sunset Tail', 12, '🌅'),
  I('tail-pearl', 'outfit', 'Pearl Tail', 14, '🦪'),
  I('tail-gold', 'outfit', 'Golden Tail', 16, '⭐'),
  I('tail-rainbow', 'outfit', 'Rainbow Tail', 20, '🌈'),
  // outfits — princess gowns
  I('gown-rose', 'outfit', 'Rose Gown', 12, '🌹', true),
  I('gown-sky', 'outfit', 'Sky Gown', 12, '☁️', true),
  I('gown-mint', 'outfit', 'Mint Gown', 12, '🍃'),
  I('gown-berry', 'outfit', 'Berry Gown', 14, '🫐'),
  I('gown-violet', 'outfit', 'Twilight Gown', 14, '✨'),
  I('gown-winter', 'outfit', 'Winter Gown', 14, '❄️'),
  I('gown-starlight', 'outfit', 'Starlight Gown', 16, '🌟'),
  I('gown-gold', 'outfit', 'Sunbeam Gown', 18, '👑'),
  // outfits — fairy dresses (with wings)
  I('fairy-rose', 'outfit', 'Rose Fairy', 14, '🧚‍♀️', true),
  I('fairy-violet', 'outfit', 'Dusk Fairy', 14, '🦋'),
  I('fairy-mint', 'outfit', 'Leaf Fairy', 16, '🍀'),
  // outfits — everyday play clothes
  I('play-sunny', 'outfit', 'Sunny Playsuit', 12, '🌼', true),
  I('play-berry', 'outfit', 'Berry Dress', 12, '🍓'),
  I('play-denim', 'outfit', 'Denim & Tee', 12, '⭐'),
  // headwear
  I('flower', 'headwear', 'Hair Bloom', 8, '🌺'),
  I('starclip', 'headwear', 'Star Clip', 8, '⭐'),
  I('bowhair', 'headwear', 'Big Bow', 8, '🎀'),
  I('headband', 'headwear', 'Headband', 6, '💗'),
  I('sunhat', 'headwear', 'Sun Hat', 8, '👒'),
  I('earmuffs', 'headwear', 'Cozy Earmuffs', 8, '🎧'),
  I('flowercrown', 'headwear', 'Flower Crown', 12, '💐'),
  I('tiara', 'headwear', 'Coral Tiara', 14, '💎'),
  I('crown', 'headwear', 'Queen Crown', 18, '👑'),
  // necklaces
  I('pearls', 'necklace', 'Pearl Strand', 6, '📿'),
  I('ribbon', 'necklace', 'Ribbon Choker', 6, '🎗️'),
  I('locket', 'necklace', 'Shell Locket', 8, '🐚'),
  I('starbead', 'necklace', 'Star Beads', 8, '⭐'),
  I('heartgem', 'necklace', 'Heart Gem', 10, '💖'),
  // held
  I('book', 'held', 'Story Book', 6, '📖'),
  I('seastar', 'held', 'Sea Star', 8, '⭐'),
  I('bouquet', 'held', 'Bouquet', 8, '💐'),
  I('balloon', 'held', 'Balloon', 8, '🎈'),
  I('lantern', 'held', 'Star Lantern', 10, '🏮'),
  I('wand', 'held', 'Magic Wand', 12, '🪄'),
  // face
  I('freckles', 'face', 'Freckles', 0, '🙂', true),
  I('sunfreckles', 'face', 'Sun Freckles', 6, '☀️', true),
  I('blushhearts', 'face', 'Heart Blush', 8, '💕'),
  // glasses
  I('round', 'glasses', 'Round Glasses', 8, '👓'),
  I('star', 'glasses', 'Star Shades', 10, '🤩'),
  I('heart', 'glasses', 'Heart Shades', 10, '😍'),
  // earrings
  I('studs', 'earrings', 'Little Studs', 5, '⚪'),
  I('pearl', 'earrings', 'Pearl Drops', 6, '🤍'),
  I('stars', 'earrings', 'Star Studs', 7, '⭐'),
  I('hearts', 'earrings', 'Heart Studs', 7, '💗'),
  // pet colors
  I('violet', 'petColor', 'Violet Inky', 0, '🟣', true),
  I('pet-rose', 'petColor', 'Rosy Inky', 8, '🩷', true),
  I('sea', 'petColor', 'Sea-green Inky', 8, '🩵', true),
  I('coral', 'petColor', 'Coral Inky', 8, '🪸'),
  I('gold', 'petColor', 'Golden Inky', 10, '⭐'),
  I('pet-midnight', 'petColor', 'Midnight Inky', 10, '🌌'),
  // pet hats
  I('petbow', 'petHat', 'Inky Ribbon', 5, '🎀'),
  I('petflower', 'petHat', 'Inky Bloom', 5, '🌼'),
  I('petstar', 'petHat', 'Inky Star', 6, '⭐'),
  I('party', 'petHat', 'Party Hat', 7, '🎉'),
  I('petwizard', 'petHat', 'Wizard Hat', 8, '🧙'),
  I('minicrown', 'petHat', 'Mini Crown', 9, '👑'),
];

// Ids are globally unique (pet colors are `pet-` prefixed), so this keyed-by-id
// lookup is unambiguous — no last-wins collapse of two same-named categories.
export const COSMETICS_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

/** Item ids owned before any pearls are spent (every price-0 item). */
export function starterCosmetics(): string[] {
  return COSMETICS.filter((c) => c.price === 0).map((c) => c.id);
}

/** Categories where "none" (bare) is a valid choice — a take-it-off chip. */
export const OPTIONAL_CATEGORIES: CosmeticCategory[] = [
  'headwear',
  'necklace',
  'held',
  'face',
  'glasses',
  'earrings',
  'petHat',
];

// ---- character creation ----
/**
 * The first-run creator offers a generous FREE palette (its picks become
 * owned, on the house) while the fancier catalog stays shop-only. Skin is
 * always fully choosable; these are the cosmetic categories the creator
 * walks through, in order.
 */
export const CREATION_CATEGORIES: CosmeticCategory[] = [
  'hairStyle',
  'hairColor',
  'outfit',
  'face',
  'petColor',
];

/** Starter items in a category — what the creator shows for that step. */
export function starterItems(category: CosmeticCategory): CosmeticItem[] {
  return COSMETICS.filter((c) => c.category === category && c.starter);
}

// ---- the pearl economy (reading is the only faucet) ----
/** Pearls in a brand-new save so the first wardrobe visit isn't empty-handed. */
export const START_PEARLS = 10;
/** Finishing a session chunk. */
export const PEARLS_PER_SESSION = 5;
/** Finishing a story for the first time. */
export const PEARLS_PER_STORY = 3;
/** Setting a new lightning-round personal best. */
export const PEARLS_SPEED_BEST = 2;
