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
 */

export type SkinId = 'shell' | 'sand' | 'amber' | 'cocoa';
export type HairStyleId = 'waves' | 'bun' | 'braids' | 'bob' | 'pony';
export type HairColorId = 'chestnut' | 'midnight' | 'sunshine' | 'ember' | 'rose' | 'lilac';
/** tail-* renders mermaid mode, gown-* renders princess mode. */
export type OutfitId =
  | 'tail-seafoam'
  | 'tail-coral'
  | 'tail-violet'
  | 'tail-midnight'
  | 'tail-gold'
  | 'tail-rainbow'
  | 'gown-rose'
  | 'gown-sky'
  | 'gown-mint'
  | 'gown-berry'
  | 'gown-violet'
  | 'gown-gold';
export type HeadwearId = 'flower' | 'starclip' | 'bowhair' | 'tiara' | 'crown';
export type NecklaceId = 'pearls' | 'locket' | 'heartgem';
export type HeldId = 'seastar' | 'wand';
export type PetColorId = 'violet' | 'rose' | 'sea';
export type PetHatId = 'petbow' | 'petflower' | 'party' | 'minicrown';

export interface AvatarConfig {
  skin: SkinId;
  hairStyle: HairStyleId;
  hairColor: HairColorId;
  outfit: OutfitId;
  headwear: HeadwearId | null;
  necklace: NecklaceId | null;
  held: HeldId | null;
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
}

const I = (
  id: string,
  category: CosmeticCategory,
  label: string,
  price: number,
  emoji: string,
): CosmeticItem => ({ id, category, label, price, emoji });

export const COSMETICS: CosmeticItem[] = [
  // hair styles
  I('waves', 'hairStyle', 'Ocean Waves', 0, '🌊'),
  I('bob', 'hairStyle', 'Breezy Bob', 8, '💇‍♀️'),
  I('pony', 'hairStyle', 'High Pony', 8, '🎀'),
  I('bun', 'hairStyle', 'Royal Bun', 10, '👸'),
  I('braids', 'hairStyle', 'Twin Braids', 10, '🧵'),
  // hair colors
  I('chestnut', 'hairColor', 'Chestnut', 0, '🌰'),
  I('midnight', 'hairColor', 'Midnight', 6, '🌙'),
  I('sunshine', 'hairColor', 'Sunshine', 6, '☀️'),
  I('ember', 'hairColor', 'Ember Red', 6, '🍁'),
  I('rose', 'hairColor', 'Rose Pink', 8, '🌸'),
  I('lilac', 'hairColor', 'Lilac', 8, '💜'),
  // outfits — mermaid tails
  I('tail-seafoam', 'outfit', 'Seafoam Tail', 0, '🧜‍♀️'),
  I('tail-coral', 'outfit', 'Coral Tail', 10, '🪸'),
  I('tail-violet', 'outfit', 'Violet Tail', 10, '🔮'),
  I('tail-midnight', 'outfit', 'Midnight Tail', 12, '🌌'),
  I('tail-gold', 'outfit', 'Golden Tail', 16, '⭐'),
  I('tail-rainbow', 'outfit', 'Rainbow Tail', 20, '🌈'),
  // outfits — princess gowns
  I('gown-rose', 'outfit', 'Rose Gown', 12, '🌹'),
  I('gown-sky', 'outfit', 'Sky Gown', 12, '☁️'),
  I('gown-mint', 'outfit', 'Mint Gown', 12, '🍃'),
  I('gown-berry', 'outfit', 'Berry Gown', 14, '🫐'),
  I('gown-violet', 'outfit', 'Twilight Gown', 14, '✨'),
  I('gown-gold', 'outfit', 'Sunbeam Gown', 18, '👑'),
  // headwear
  I('flower', 'headwear', 'Hair Bloom', 8, '🌺'),
  I('starclip', 'headwear', 'Star Clip', 8, '⭐'),
  I('bowhair', 'headwear', 'Big Bow', 8, '🎀'),
  I('tiara', 'headwear', 'Coral Tiara', 14, '💎'),
  I('crown', 'headwear', 'Queen Crown', 18, '👑'),
  // necklaces
  I('pearls', 'necklace', 'Pearl Strand', 6, '📿'),
  I('locket', 'necklace', 'Shell Locket', 8, '🐚'),
  I('heartgem', 'necklace', 'Heart Gem', 10, '💖'),
  // held
  I('seastar', 'held', 'Sea Star', 8, '⭐'),
  I('wand', 'held', 'Magic Wand', 12, '🪄'),
  // pet colors
  I('violet', 'petColor', 'Violet Inky', 0, '🟣'),
  I('rose', 'petColor', 'Rosy Inky', 8, '🩷'),
  I('sea', 'petColor', 'Sea-green Inky', 8, '🩵'),
  // pet hats
  I('petbow', 'petHat', 'Inky Ribbon', 5, '🎀'),
  I('petflower', 'petHat', 'Inky Bloom', 5, '🌼'),
  I('party', 'petHat', 'Party Hat', 7, '🎉'),
  I('minicrown', 'petHat', 'Mini Crown', 9, '👑'),
];

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
  'petHat',
];

// ---- the pearl economy (reading is the only faucet) ----
/** Pearls in a brand-new save so the first wardrobe visit isn't empty-handed. */
export const START_PEARLS = 10;
/** Finishing a session chunk. */
export const PEARLS_PER_SESSION = 5;
/** Finishing a story for the first time. */
export const PEARLS_PER_STORY = 3;
/** Setting a new lightning-round personal best. */
export const PEARLS_SPEED_BEST = 2;
