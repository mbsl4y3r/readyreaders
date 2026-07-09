/**
 * The Games Arcade catalog — Evie's reward for reading. Every game is our own
 * gentle reskin of a classic (original names + our ocean/forest/castle art),
 * never copyrighted characters or assets.
 *
 * Two systems gate the arcade, both by design:
 *  - UNLOCK (progression reward): a cabinet stays dark until Evie's Reading
 *    Road marker reaches its `unlockLesson` — so new games light up all the
 *    way along the 120-lesson journey.
 *  - PLAY PASS (the pearl sink): reading earns pearls; ten pearls buys a
 *    ten-minute pass to play any unlocked game freely. Reading is still the
 *    only pearl faucet, so the arcade can never become the game.
 */
import type { RealmId } from './types';

export interface ArcadeGameDef {
  /** Stable id — matches the file in games/arcade, the runner key, and arcadeBest. */
  id: string;
  /** Our original name (no copyrighted titles). */
  title: string;
  /** Cabinet glyph. */
  emoji: string;
  /** One kid-facing line for the cabinet. */
  blurb: string;
  /** Which classic it reskins (dev-facing note, never shown to Evie). */
  reskins: string;
  /** Realm palette + the Reading Road lesson that lights the cabinet up. */
  realm: RealmId;
  unlockLesson: number;
  /** HUD label for the score number (all games are higher-is-better). */
  scoreLabel: string;
}

/** Ten pearls for a five-minute pass — the arcade's price of admission. */
export const PASS_PEARLS = 10;
export const PASS_MS = 5 * 60 * 1000;

export const ARCADE_GAMES: ArcadeGameDef[] = [
  {
    id: 'serpent',
    title: 'Coral Serpent',
    emoji: '🐍',
    blurb: 'Grow the sea snake — gobble the bubbles!',
    reskins: 'Snake',
    realm: 'cove',
    unlockLesson: 1,
    scoreLabel: 'bubbles',
  },
  {
    id: 'bounce',
    title: 'Shell Bounce',
    emoji: '🏓',
    blurb: 'Bat the pearl back and forth!',
    reskins: 'Pong',
    realm: 'cove',
    unlockLesson: 1,
    scoreLabel: 'rallies',
  },
  {
    id: 'flutter',
    title: 'Flutter Fish',
    emoji: '🐠',
    blurb: 'Tap to swim through the gaps!',
    reskins: 'Flappy Bird',
    realm: 'cove',
    unlockLesson: 12,
    scoreLabel: 'gaps',
  },
  {
    id: 'crumble',
    title: 'Castle Crumble',
    emoji: '🧱',
    blurb: 'Bounce the gem, knock the bricks!',
    reskins: 'Breakout',
    realm: 'castle',
    unlockLesson: 20,
    scoreLabel: 'bricks',
  },
  {
    id: 'hoppy',
    title: 'Hoppy Crossing',
    emoji: '🐸',
    blurb: 'Hop across the logs and lily pads!',
    reskins: 'Frogger',
    realm: 'woods',
    unlockLesson: 35,
    scoreLabel: 'flowers',
  },
  {
    id: 'blaster',
    title: 'Star Blaster',
    emoji: '🚀',
    blurb: 'Zap the drifting star-rocks!',
    reskins: 'Asteroids',
    realm: 'castle',
    unlockLesson: 40,
    scoreLabel: 'stars',
  },
  {
    id: 'muncher',
    title: 'Pearl Muncher',
    emoji: '🟡',
    blurb: 'Munch every pearl in the reef maze!',
    reskins: 'Pac-Man',
    realm: 'cove',
    unlockLesson: 82,
    scoreLabel: 'pearls',
  },
  {
    id: 'skeeball',
    title: 'Shell Roll',
    emoji: '🐚',
    blurb: 'Roll the shell into the rings!',
    reskins: 'Skee-Ball',
    realm: 'cove',
    unlockLesson: 52,
    scoreLabel: 'points',
  },
  {
    id: 'racer',
    title: 'Reef Racer',
    emoji: '🏎️',
    blurb: 'Swerve around the coral — go go go!',
    reskins: 'Pole Position',
    realm: 'cove',
    unlockLesson: 66,
    scoreLabel: 'meters',
  },
  {
    id: 'putt',
    title: 'Pearl Putt',
    emoji: '⛳',
    blurb: 'Putt the pearl into the hole!',
    reskins: 'Mini Putt',
    realm: 'woods',
    unlockLesson: 74,
    scoreLabel: 'holes',
  },
  {
    id: 'ascent',
    title: 'Acorn Ascent',
    emoji: '🐿️',
    blurb: 'Climb the tree, dodge the acorns!',
    reskins: 'Donkey Kong',
    realm: 'woods',
    unlockLesson: 96,
    scoreLabel: 'floors',
  },
  {
    id: 'hollow',
    title: 'Hop Hollow',
    emoji: '🦔',
    blurb: 'Hop the logs, collect the berries!',
    reskins: 'Platformer',
    realm: 'woods',
    unlockLesson: 110,
    scoreLabel: 'berries',
  },
  // ---- round-2 additions ------------------------------------------------
  {
    id: 'whack',
    title: 'Critter Whack',
    emoji: '🔨',
    blurb: 'Bonk the critters as they pop up!',
    reskins: 'Whack-a-Mole',
    realm: 'woods',
    unlockLesson: 4,
    scoreLabel: 'bonks',
  },
  {
    id: 'bubblepop',
    title: 'Bubble Pop',
    emoji: '🫧',
    blurb: 'Pop the bubbles before they float away!',
    reskins: 'Bubble popper',
    realm: 'cove',
    unlockLesson: 8,
    scoreLabel: 'pops',
  },
  {
    id: 'memory',
    title: 'Memory Shells',
    emoji: '🧩',
    blurb: 'Flip the shells, find the matching pairs!',
    reskins: 'Concentration',
    realm: 'cove',
    unlockLesson: 16,
    scoreLabel: 'pairs',
  },
  {
    id: 'catch',
    title: 'Treasure Catch',
    emoji: '🧺',
    blurb: 'Swish the net, catch the treasures!',
    reskins: 'Catch',
    realm: 'cove',
    unlockLesson: 25,
    scoreLabel: 'treasures',
  },
  {
    id: 'echo',
    title: 'Star Echo',
    emoji: '🌟',
    blurb: 'Watch the twinkles, then tap them back!',
    reskins: 'Simon',
    realm: 'castle',
    unlockLesson: 58,
    scoreLabel: 'rounds',
  },
  {
    id: 'cluster',
    title: 'Coral Cluster',
    emoji: '💠',
    blurb: 'Aim up and match 3 to pop the cluster!',
    reskins: 'Snood / bubble shooter',
    realm: 'cove',
    unlockLesson: 46,
    scoreLabel: 'pops',
  },
  {
    id: 'versus',
    title: 'Shell Duel',
    emoji: '🆚',
    blurb: 'Two players! Bat the pearl past each other!',
    reskins: 'Two-player Pong',
    realm: 'cove',
    unlockLesson: 30,
    scoreLabel: 'rallies',
  },
];

export const ARCADE_BY_ID = new Map(ARCADE_GAMES.map((g) => [g.id, g]));

/**
 * Wacky launch lines — a grown-up records these in a silly announcer voice
 * (Evie's idea!). `hub` plays on entering the arcade; each game id plays when
 * its cabinet starts. Kept here so the clip manifest and the scene share one
 * source of truth. Ids in the manifest are `arcade-hub` and `arcade-<id>`.
 */
export const ARCADE_ANNOUNCE: Record<string, string> = {
  hub: "Welcome to the Games Arcade! Pick a game and let's plaaay!",
  serpent: 'Coooral Serpent! Slither and slurp those bubbles — chomp chomp chomp!',
  bounce: "Shell Bounce! Boing! Boing! Don't let that pearl get past ya!",
  flutter: 'Flutter Fiiish! Flap, flap, flap through the gaps — you got this!',
  crumble: 'Castle Crumble! Smash those bricks to smithereens — ka-boom!',
  hoppy: 'Hoppy Crossing! Hop, hop, hoppity-hop — watch out for the splash!',
  blaster: 'Star Blaster! Pew pew pew! Zap every last star-rock!',
  muncher: 'Pearl Muncher! Nom nom nom — gobble every pearl in the maze!',
  skeeball: 'Shell Roll! Give it a big ol roll — right into the rings!',
  racer: 'Reef Racer! Vroooom! Zoom around the coral — zoomy zoom!',
  putt: 'Pearl Putt! Tap it niiice and easy — plonk, right in the hole!',
  ascent: 'Acorn Ascent! Climb, climb, cliiimb — dodge those bonky acorns!',
  hollow: 'Hop Hollow! Boing over the logs and grab those yummy berries!',
  whack: 'Critter Whack! Bonk-a bonk-a bonk — get those silly critters!',
  bubblepop: 'Bubble Pop! Pop pop poppity-pop — get em all!',
  memory: 'Memory Shells! Flip, flip — find the matching pairs!',
  catch: 'Treasure Catch! Swish that net — catch all the goodies!',
  echo: 'Star Echo! Watch the twinkly stars, then tap them back — ready?',
  cluster: 'Coral Cluster! Aim it up and POP three-in-a-row — ka-bloosh!',
  versus: 'Shell Duel! Two players — bonk that pearl right past your buddy!',
};

/** True if the play pass is currently active. */
export function passActive(arcadePassUntil: number, now: number): boolean {
  return arcadePassUntil > now;
}
