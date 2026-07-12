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

/**
 * Which reader this is. Chosen once at the start (first creator step) and
 * changeable in the parent corner. It swaps the outfit universe (mermaid/
 * princess/fairy vs. superhero/jobs) and the pet (Inky the octopus vs. Rex the
 * little T-rex). Everything else — skin, hair, face, glasses — is shared.
 */
export type CharacterId = 'girl' | 'boy';

export type SkinId = 'shell' | 'sand' | 'amber' | 'cocoa';
export type HairStyleId =
  // girl / longer styles
  | 'waves'
  | 'bun'
  | 'braids'
  | 'bob'
  | 'pony'
  | 'curls'
  | 'pixie'
  | 'longstraight'
  | 'spacebuns'
  | 'sidebraid'
  // short styles (offered to the boy path; unisex — anyone may wear them)
  | 'crop'
  | 'spiky'
  | 'buzz'
  | 'curlytop'
  | 'flow'
  | 'mohawk';
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
 * Outfits render by prefix family:
 *   GIRL — tail-* mermaid, gown-* princess, fairy-* winged dress, play-* everyday
 *   BOY  — hero-* caped superhero suit, job-* real-life uniform, sport-* everyday
 * The painter dispatches on the prefix; the wardrobe filters by track so a boy
 * never sees a gown and a girl never sees a firefighter coat.
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
  | 'play-denim'
  // boy — superhero caped suits (color + chest emblem)
  | 'hero-bolt'
  | 'hero-flame'
  | 'hero-frost'
  | 'hero-thunder'
  | 'hero-storm'
  | 'hero-solar'
  | 'hero-shadow'
  | 'hero-aqua'
  // boy — real-life jobs
  | 'job-fire'
  | 'job-police'
  | 'job-build'
  | 'job-space'
  | 'job-doctor'
  | 'job-army'
  | 'job-chef'
  | 'job-racer'
  // boy — everyday
  | 'sport-blue'
  | 'sport-red'
  | 'sport-dino';
export type HeadwearId =
  | 'flower'
  | 'starclip'
  | 'bowhair'
  | 'tiara'
  | 'crown'
  | 'flowercrown'
  | 'headband'
  | 'sunhat'
  | 'earmuffs'
  // boy — signature job/hero toppers (mix-and-match, separate from the outfit)
  | 'heromask'
  | 'firehelmet'
  | 'policecap'
  | 'hardhat'
  | 'ballcap'
  | 'spacehelmet';
export type NecklaceId = 'pearls' | 'locket' | 'heartgem' | 'ribbon' | 'starbead';
export type HeldId = 'seastar' | 'wand' | 'book' | 'bouquet' | 'balloon' | 'lantern';
export type FaceId = 'freckles' | 'sunfreckles' | 'blushhearts';
export type GlassesId = 'round' | 'star' | 'heart';
export type EarringId = 'studs' | 'pearl' | 'stars' | 'hearts';
// Pet colors carry a `pet-` prefix so their ids never collide with a same-named
// hair color (there is a 'rose'/'midnight' in BOTH palettes). Ownership lives in
// one flat id set (progress.cosmetics), so a shared id would let owning the free
// creator pick in one category silently unlock the shop-only item in the other.
export type PetColorId =
  | 'violet'
  | 'pet-rose'
  | 'sea'
  | 'coral'
  | 'gold'
  | 'pet-midnight'
  | 'forest'
  | 'sky';
export type PetHatId =
  | 'petbow'
  | 'petflower'
  | 'party'
  | 'minicrown'
  | 'petstar'
  | 'petwizard'
  | 'petcap'
  | 'petspikes';

export interface AvatarConfig {
  /** Girl (mermaid/princess + Inky) or boy (superhero/jobs + Rex). */
  character: CharacterId;
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

/** The girl starter look (also the migration default for pre-character saves). */
export function defaultAvatar(): AvatarConfig {
  return {
    character: 'girl',
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

/** The boy starter look — a caped superhero with Rex the little T-rex. */
export function defaultBoyAvatar(): AvatarConfig {
  return {
    character: 'boy',
    skin: 'shell',
    hairStyle: 'crop',
    hairColor: 'chestnut',
    outfit: 'hero-bolt',
    headwear: null,
    necklace: null,
    held: null,
    face: null,
    glasses: null,
    earrings: null,
    petColor: 'forest',
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
  /**
   * Which character sees this in the creator/wardrobe. Omitted = both (skin,
   * hair, faces, glasses, most pet colors). 'girl'/'boy' scope the outfit
   * universes and their signature toppers so each reader sees only their world.
   */
  track?: CharacterId;
}

const I = (
  id: string,
  category: CosmeticCategory,
  label: string,
  price: number,
  emoji: string,
  starter = false,
  track?: CharacterId,
): CosmeticItem => ({ id, category, label, price, emoji, starter, ...(track ? { track } : {}) });

export const COSMETICS: CosmeticItem[] = [
  // hair styles — longer/femme (girl); bob/curls/pixie are shared; short (boy)
  I('waves', 'hairStyle', 'Ocean Waves', 0, '🌊', true, 'girl'),
  I('pony', 'hairStyle', 'High Pony', 8, '🎀', true, 'girl'),
  I('longstraight', 'hairStyle', 'Long & Sleek', 8, '💧', true, 'girl'),
  I('bun', 'hairStyle', 'Royal Bun', 10, '👸', false, 'girl'),
  I('braids', 'hairStyle', 'Twin Braids', 10, '🧵', false, 'girl'),
  I('spacebuns', 'hairStyle', 'Space Buns', 12, '🪐', false, 'girl'),
  I('sidebraid', 'hairStyle', 'Side Braid', 12, '🌾', false, 'girl'),
  I('bob', 'hairStyle', 'Breezy Bob', 8, '💇', true),
  I('curls', 'hairStyle', 'Bouncy Curls', 8, '🌀', true),
  I('pixie', 'hairStyle', 'Pixie Cut', 10, '✂️'),
  I('crop', 'hairStyle', 'Short Crop', 0, '✂️', true, 'boy'),
  I('spiky', 'hairStyle', 'Spiky', 0, '⚡', true, 'boy'),
  I('buzz', 'hairStyle', 'Buzz Cut', 0, '🪒', true, 'boy'),
  I('curlytop', 'hairStyle', 'Curly Top', 0, '🌀', true, 'boy'),
  I('flow', 'hairStyle', 'Swept Flow', 10, '🏄', false, 'boy'),
  I('mohawk', 'hairStyle', 'Mohawk', 12, '🦅', false, 'boy'),
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
  // outfits — mermaid tails (GIRL)
  I('tail-seafoam', 'outfit', 'Seafoam Tail', 0, '🧜‍♀️', true, 'girl'),
  I('tail-coral', 'outfit', 'Coral Tail', 10, '🪸', true, 'girl'),
  I('tail-violet', 'outfit', 'Violet Tail', 10, '🔮', false, 'girl'),
  I('tail-midnight', 'outfit', 'Midnight Tail', 12, '🌌', false, 'girl'),
  I('tail-sunset', 'outfit', 'Sunset Tail', 12, '🌅', false, 'girl'),
  I('tail-pearl', 'outfit', 'Pearl Tail', 14, '🦪', false, 'girl'),
  I('tail-gold', 'outfit', 'Golden Tail', 16, '⭐', false, 'girl'),
  I('tail-rainbow', 'outfit', 'Rainbow Tail', 20, '🌈', false, 'girl'),
  // outfits — princess gowns (GIRL)
  I('gown-rose', 'outfit', 'Rose Gown', 12, '🌹', true, 'girl'),
  I('gown-sky', 'outfit', 'Sky Gown', 12, '☁️', true, 'girl'),
  I('gown-mint', 'outfit', 'Mint Gown', 12, '🍃', false, 'girl'),
  I('gown-berry', 'outfit', 'Berry Gown', 14, '🫐', false, 'girl'),
  I('gown-violet', 'outfit', 'Twilight Gown', 14, '✨', false, 'girl'),
  I('gown-winter', 'outfit', 'Winter Gown', 14, '❄️', false, 'girl'),
  I('gown-starlight', 'outfit', 'Starlight Gown', 16, '🌟', false, 'girl'),
  I('gown-gold', 'outfit', 'Sunbeam Gown', 18, '👑', false, 'girl'),
  // more color dresses & princess gowns (round 2) (GIRL)
  I('gown-sunset', 'outfit', 'Sunset Gown', 14, '🌅', true, 'girl'),
  I('gown-peach', 'outfit', 'Peach Gown', 14, '🍑', true, 'girl'),
  I('gown-aqua', 'outfit', 'Aqua Gown', 14, '🌊', false, 'girl'),
  I('gown-lavender', 'outfit', 'Lavender Gown', 14, '💜', false, 'girl'),
  I('gown-bluebell', 'outfit', 'Bluebell Gown', 14, '🔔', false, 'girl'),
  I('gown-buttercup', 'outfit', 'Buttercup Gown', 14, '🌻', false, 'girl'),
  I('gown-blossom', 'outfit', 'Blossom Gown', 16, '🌸', false, 'girl'),
  I('gown-emerald', 'outfit', 'Emerald Gown', 16, '💚', false, 'girl'),
  I('gown-ruby', 'outfit', 'Ruby Gown', 16, '❤️', false, 'girl'),
  I('gown-cocoa', 'outfit', 'Cocoa Gown', 14, '🤎', false, 'girl'),
  // outfits — fairy dresses with wings (GIRL)
  I('fairy-rose', 'outfit', 'Rose Fairy', 14, '🧚‍♀️', true, 'girl'),
  I('fairy-violet', 'outfit', 'Dusk Fairy', 14, '🦋', false, 'girl'),
  I('fairy-mint', 'outfit', 'Leaf Fairy', 16, '🍀', false, 'girl'),
  // outfits — everyday play clothes (GIRL)
  I('play-sunny', 'outfit', 'Sunny Playsuit', 12, '🌼', true, 'girl'),
  I('play-berry', 'outfit', 'Berry Dress', 12, '🍓', false, 'girl'),
  I('play-denim', 'outfit', 'Denim & Tee', 12, '⭐', false, 'girl'),
  // outfits — superhero caped suits (BOY)
  I('hero-bolt', 'outfit', 'Captain Bolt', 0, '⚡', true, 'boy'),
  I('hero-flame', 'outfit', 'Blaze', 0, '🔥', true, 'boy'),
  I('hero-aqua', 'outfit', 'Tidal', 10, '🌊', true, 'boy'),
  I('hero-storm', 'outfit', 'Green Comet', 10, '💫', true, 'boy'),
  I('hero-frost', 'outfit', 'Frostbite', 12, '❄️', false, 'boy'),
  I('hero-thunder', 'outfit', 'Thunderclap', 12, '🌩️', false, 'boy'),
  I('hero-solar', 'outfit', 'Solar Flare', 16, '☀️', false, 'boy'),
  I('hero-shadow', 'outfit', 'Night Shadow', 18, '🌑', false, 'boy'),
  // outfits — real-life jobs (BOY)
  I('job-fire', 'outfit', 'Firefighter', 0, '🚒', true, 'boy'),
  I('job-police', 'outfit', 'Police Officer', 10, '🚓', true, 'boy'),
  I('job-build', 'outfit', 'Builder', 10, '🚧', true, 'boy'),
  I('job-space', 'outfit', 'Astronaut', 14, '🚀', false, 'boy'),
  I('job-doctor', 'outfit', 'Doctor', 12, '🩺', false, 'boy'),
  I('job-army', 'outfit', 'Soldier', 14, '🎖️', false, 'boy'),
  I('job-chef', 'outfit', 'Chef', 12, '🍳', false, 'boy'),
  I('job-racer', 'outfit', 'Race Driver', 16, '🏎️', false, 'boy'),
  // outfits — everyday (BOY)
  I('sport-blue', 'outfit', 'Blue Jersey', 12, '👕', true, 'boy'),
  I('sport-red', 'outfit', 'Red Jersey', 12, '🅰️', false, 'boy'),
  I('sport-dino', 'outfit', 'Dino Tee', 12, '🦖', true, 'boy'),
  // headwear — girl-coded (only the girl sees these)
  I('flower', 'headwear', 'Hair Bloom', 8, '🌺', false, 'girl'),
  I('bowhair', 'headwear', 'Big Bow', 8, '🎀', false, 'girl'),
  I('flowercrown', 'headwear', 'Flower Crown', 12, '💐', false, 'girl'),
  I('tiara', 'headwear', 'Coral Tiara', 14, '💎', false, 'girl'),
  // headwear — shared (both readers)
  I('starclip', 'headwear', 'Star Clip', 8, '⭐'),
  I('headband', 'headwear', 'Headband', 6, '💗'),
  I('sunhat', 'headwear', 'Sun Hat', 8, '👒'),
  I('earmuffs', 'headwear', 'Cozy Earmuffs', 8, '🎧'),
  I('crown', 'headwear', 'Gold Crown', 18, '👑'),
  // headwear — boy signature toppers (only the boy sees these)
  I('heromask', 'headwear', 'Hero Mask', 8, '🦸', false, 'boy'),
  I('ballcap', 'headwear', 'Ball Cap', 6, '🧢', false, 'boy'),
  I('firehelmet', 'headwear', 'Fire Helmet', 8, '⛑️', false, 'boy'),
  I('policecap', 'headwear', 'Police Cap', 8, '👮', false, 'boy'),
  I('hardhat', 'headwear', 'Hard Hat', 8, '👷', false, 'boy'),
  I('spacehelmet', 'headwear', 'Space Helmet', 12, '🪐', false, 'boy'),
  // necklaces (girl-coded)
  I('pearls', 'necklace', 'Pearl Strand', 6, '📿', false, 'girl'),
  I('ribbon', 'necklace', 'Ribbon Choker', 6, '🎗️', false, 'girl'),
  I('locket', 'necklace', 'Shell Locket', 8, '🐚', false, 'girl'),
  I('starbead', 'necklace', 'Star Beads', 8, '⭐', false, 'girl'),
  I('heartgem', 'necklace', 'Heart Gem', 10, '💖', false, 'girl'),
  // held — bouquet/wand girl-coded, the rest shared
  I('book', 'held', 'Story Book', 6, '📖'),
  I('seastar', 'held', 'Sea Star', 8, '⭐'),
  I('balloon', 'held', 'Balloon', 8, '🎈'),
  I('lantern', 'held', 'Star Lantern', 10, '🏮'),
  I('bouquet', 'held', 'Bouquet', 8, '💐', false, 'girl'),
  I('wand', 'held', 'Magic Wand', 12, '🪄', false, 'girl'),
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
  // pet colors — the label reads for whichever pet is on screen (Inky/Rex);
  // 'forest'/'sky' are the dino-friendly greens & blues, free for the boy start.
  I('violet', 'petColor', 'Violet', 0, '🟣', true),
  I('pet-rose', 'petColor', 'Rosy', 8, '🩷', true, 'girl'),
  I('sea', 'petColor', 'Sea-green', 8, '🩵', true),
  I('coral', 'petColor', 'Coral', 8, '🪸'),
  I('gold', 'petColor', 'Golden', 10, '⭐'),
  I('pet-midnight', 'petColor', 'Midnight', 10, '🌌'),
  I('forest', 'petColor', 'Forest', 0, '🟢', true, 'boy'),
  I('sky', 'petColor', 'Sky Blue', 8, '🔵', true, 'boy'),
  // pet hats — girl-coded bow/bloom, then shared fun, then boy-coded
  I('petbow', 'petHat', 'Pet Ribbon', 5, '🎀', false, 'girl'),
  I('petflower', 'petHat', 'Pet Bloom', 5, '🌼', false, 'girl'),
  I('petstar', 'petHat', 'Pet Star', 6, '⭐'),
  I('party', 'petHat', 'Party Hat', 7, '🎉'),
  I('petwizard', 'petHat', 'Wizard Hat', 8, '🧙'),
  I('minicrown', 'petHat', 'Mini Crown', 9, '👑'),
  I('petcap', 'petHat', 'Pet Cap', 5, '🧢', false, 'boy'),
  I('petspikes', 'petHat', 'Spikes', 6, '🦕', false, 'boy'),
];

// Ids are globally unique (pet colors are `pet-` prefixed), so this keyed-by-id
// lookup is unambiguous — no last-wins collapse of two same-named categories.
export const COSMETICS_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

/** Item ids owned before any pearls are spent (every price-0 item). */
export function starterCosmetics(): string[] {
  return COSMETICS.filter((c) => c.price === 0).map((c) => c.id);
}

/** Every cosmetic id — for the debug "unlock all" beta-test mode. */
export function allCosmeticIds(): string[] {
  return COSMETICS.map((c) => c.id);
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

/** Does this item belong in `character`'s world? (untracked = both.) */
export function visibleTo(item: CosmeticItem, character: CharacterId): boolean {
  return !item.track || item.track === character;
}

/**
 * Starter items in a category, scoped to the reader — what the creator shows
 * for that step. The boy sees hero/job/sport starters where the girl sees
 * tails/gowns; shared items (skin tones, most faces) appear for both.
 */
export function starterItems(category: CosmeticCategory, character: CharacterId): CosmeticItem[] {
  return COSMETICS.filter(
    (c) => c.category === category && c.starter && visibleTo(c, character),
  );
}

/** Every item in a category the reader may see in the wardrobe (owned or not). */
export function itemsForCharacter(
  category: CosmeticCategory,
  character: CharacterId,
): CosmeticItem[] {
  return COSMETICS.filter((c) => c.category === category && visibleTo(c, character));
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
