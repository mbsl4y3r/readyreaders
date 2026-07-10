# Evie's Reading Realms — Roadmap & Morning To-Do

_Last updated: 2026-07-08 (overnight arcade build)_

This is the "what's done / what's left / what **you** need to do" board. The
🌅 **section at the top is your morning list** — everything else is reference.

---

## 🌅 Matthew's list (updated after the book integration)

1. **Record the missing LETTER SOUNDS first** — these are the only clips with
   NO fallback (a missing one is just silent in build-a-word). 101 of 139 are
   unrecorded, but Evie only meets them as the road reaches them, so do them
   in this order (first lesson that needs each):
   - Soon (lessons 22–45): `es` (22) · `'s`, `n't` (32) · `ng` (37) · `nd`,
     `nt` (41) · `er`, `nch`, `nk` (43) · `ct`, `ft`, `pt`, `xt` (45)
   - Next (47–66): `sk sp st` · `lb ld lf lk` · `lm lp lt mp tch` ·
     `dge nce nge nse nc` · the blends (`bl br cl cr dr fl fr gl gr pl pr
     sl sm sn shr spl spr sc scr str sw gw thr tr tw dw`) · `a_e` (66)
   - Later (70+): vowel teams (`ai ay ey ei eigh au aw ar ee ea e_e ie uy
     i_e igh augh gh ough o_e oa old ow oo ou oi oy u_e ue ui eu ew ear ir
     or ur le tle ci si ti kn mb wr bt`)
   `npm run recorder` has them all queued with the say-the-pure-sound notes.
2. ~~Music with Gemini~~ **DONE 🎶** — arcade + all 9 region tracks are in;
   every land on the Reading Road now has its own music.
3. **(Optional) `newbest.mp3` sfx** — arcade high-score sting (Kenney Music
   Jingles); the synth chime covers it meanwhile.
4. **Keep chipping at word/phrase/sentence recordings** whenever — now 1,950
   clips total after the book integration (TTS covers all of these until
   recorded, so zero rush).

### Arcade voice lines to record (id → line, wacky announcer voice)

| Clip id | Line |
| --- | --- |
| `arcade-hub` | "Welcome to the Games Arcade! Pick a game and let's plaaay!" |
| `arcade-serpent` | "Coooral Serpent! Slither and slurp those bubbles — chomp chomp chomp!" |
| `arcade-bounce` | "Shell Bounce! Boing! Boing! Don't let that pearl get past ya!" |
| `arcade-flutter` | "Flutter Fiiish! Flap, flap, flap through the gaps — you got this!" |
| `arcade-crumble` | "Castle Crumble! Smash those bricks to smithereens — ka-boom!" |
| `arcade-hoppy` | "Hoppy Crossing! Hop, hop, hoppity-hop — watch out for the splash!" |
| `arcade-blaster` | "Star Blaster! Pew pew pew! Zap every last star-rock!" |
| `arcade-muncher` | "Pearl Muncher! Nom nom nom — gobble every pearl in the maze!" |
| `arcade-skeeball` | "Shell Roll! Give it a big ol roll — right into the rings!" |
| `arcade-racer` | "Reef Racer! Vroooom! Zoom around the coral — zoomy zoom!" |
| `arcade-putt` | "Pearl Putt! Tap it niiice and easy — plonk, right in the hole!" |
| `arcade-ascent` | "Acorn Ascent! Climb, climb, cliiimb — dodge those bonky acorns!" |
| `arcade-hollow` | "Hop Hollow! Boing over the logs and grab those yummy berries!" |
| `arcade-whack` | "Critter Whack! Bonk-a bonk-a bonk — get those silly critters!" |
| `arcade-bubblepop` | "Bubble Pop! Pop pop poppity-pop — get em all!" |
| `arcade-memory` | "Memory Shells! Flip, flip — find the matching pairs!" |
| `arcade-catch` | "Treasure Catch! Swish that net — catch all the goodies!" |
| `arcade-echo` | "Star Echo! Watch the twinkly stars, then tap them back — ready?" |
| `arcade-cluster` | "Coral Cluster! Aim it up and POP three-in-a-row — ka-bloosh!" |
| `arcade-versus` | "Shell Duel! Two players — bonk that pearl right past your buddy!" |

### Other new voice lines to record (normal warm voice)

| Clip id | Line |
| --- | --- |
| `level-up` | "You passed the level! A brand new island just opened!" |
| `sticker-book` | "Your sticker book! Look at all your shiny stickers!" |
| `photo-booth` | "Photo booth! Let's take a picture of you!" |
| `ticket-shop` | "The ticket shop! Spend your game tickets on treasures!" |

### 🆕 THE READING ROAD (how progression works now)

The whole game follows the book: **120 lessons over 12 themed regions** (10
lessons each — Coral Cove, Whisker Woods, Starlight Castle, **Candy Cliffs**,
Rainbow Meadow, Star Sky, Snowy Summit, Fairy Garden, Dino Valley, Pirate Bay,
Cloud Kingdom, Crystal Caves).

- Everyone starts at **lesson 1**; lessons 1–20 are the **catch-up zone** (pass
  as many per day as you like). From 21 on it's the book's formula: **one new
  lesson per day** (after passing, the big button becomes "🌙 Review time!").
- A lesson is passed by the **Check-Out**: its new words answered right on the
  FIRST tap (guess-tapping can't pass), with one forgiveness miss. A miss is
  gentle — the tricky words get re-drilled and she retries in the same session,
  or they're queued up front next time.
- Every 10th lesson **crosses into a new region** — the big celebration.
  Arcade games now unlock along the whole road (lesson 1 → 110). Finishing
  lesson 120 = "You read the WHOLE book!"
- The map IS the road: her region's 10 stops wind across it (⭐ = passed, her
  creature = today), one big **"▶️ Lesson N!"** button, and the next region
  peeking at the end of the path.
- Parent corner: the "ROAD LESSON" stepper moves her anywhere on the road
  (catch-up days, sharing with another kid at a different spot, etc.).

---

## 🎮 The Games Arcade (new!)

Twelve original reskins of classic games — our own names + ocean/forest/castle
art + emoji sprites, **no copyrighted characters or assets**. All simple and
forgiving for a 6-year-old.

| Game | Our name | Unlocks at | Feel |
| --- | --- | --- | --- |
| Snake | 🐍 Coral Serpent | Level 1 | grow the sea snake, eat bubbles |
| Pong | 🏓 Shell Bounce | Level 1 | keep the pearl bouncing |
| Flappy Bird | 🐠 Flutter Fish | Level 2 | tap to swim through gaps |
| Breakout | 🧱 Castle Crumble | Level 2 | bounce the gem, break bricks |
| Frogger | 🐸 Hoppy Crossing | Level 3 | hop across the water |
| Asteroids | 🚀 Star Blaster | Level 3 | zap drifting star-rocks |
| Pac-Man | 🟡 Pearl Muncher | Level 4 | munch pearls in a reef maze |
| Skee-Ball | 🐚 Shell Roll | Level 5 | roll into the rings |
| Pole Position | 🏎️ Reef Racer | Level 6 | swerve around coral |
| Mini Putt | ⛳ Pearl Putt | Level 6 | putt the pearl in the hole |
| Donkey Kong | 🐿️ Acorn Ascent | Level 7 | climb, dodge acorns |
| Platformer | 🦔 Hop Hollow | Level 8 | hop logs, grab berries |
| Whack-a-Mole | 🔨 Critter Whack | Level 1 | bonk critters as they pop |
| Bubble popper | 🫧 Bubble Pop | Level 1 | tap rising bubbles |
| Concentration | 🧩 Memory Shells | Level 2 | flip shells, match pairs |
| Catch | 🧺 Treasure Catch | Level 3 | net falling treasures |
| Simon | 🌟 Star Echo | Level 4 | repeat the twinkle pattern |
| Snood / bubble shooter | 💠 Coral Cluster | Level 3 | aim up, match 3 to pop |
| Two-player Pong | 🆚 Shell Duel | Level 1 | you vs. a grown-up, bat the pearl |

**Two gates, both intentional:**

- **Unlock (reward for reading):** a cabinet is dark until Evie's frontier
  (`currentLevel`) reaches its unlock level — so finishing modules lights up
  new games. (Debug `bingo` unlocks all for testing.)
- **Play Pass (the pearl sink):** 10 🦪 buys a 5-minute pass to play any
  unlocked game. **Reading is still the only way to earn pearls**, so the arcade
  stays a reward and never replaces the reading.

---

## ✅ Shipped & live (on GitHub Pages)

- **Phase 0** — island map, 3 realms, adaptive session engine, build-a-word /
  feed-the-creature / sentence→picture, parent corner, progress persistence.
- **Phase 1** — placement voyage, magic phrases, memory-word builds, collection book.
- **Phases 2+3** — full 120-lesson content, lightning round, word families,
  story pages, art + PWA (add-to-home-screen) pass, session-cap sunset.
- **Phase 4** — wardrobe + pearl economy (reading is the only faucet).
- **Phase 5** — first-run character creator + ~80-item wardrobe (hairstyles,
  princess/mermaid/fairy/play outfits, colors, accessories, pet Inky).
- **Extras** — achievements/badges shelf, Review mode, redesigned parent
  dashboard, single-tap gear, reset gated by "1776", debug `bingo` unlock,
  audio serialization (one voice at a time, music ducking), book-marker-driven
  level unlocking, home-recording voice recorder tool (`npm run recorder`).
- **Phase 6** — the Games Arcade: hub + 12 mini-games, Play Pass pearl economy,
  per-game hi-scores, wacky announce voice hooks.
- **Phase 7** — playtest polish: Reef Racer rebuilt as a real
  pseudo-3D Pole-Position racer (forgiving joyride), 5 more games (Critter
  Whack, Bubble Pop, Memory Shells, Treasure Catch, Star Echo → 17 total),
  Play Pass shortened to 5 minutes, 10 new princess gowns/color dresses,
  compact 5-column arcade grid.
- **Phase 8 (latest)** — THE REAL BOOK, transcribed: all 182 photographed
  pages (lessons 12–120) machine-read and folded into the game. Lesson spine
  corrected against the book's teacher pages, word bank grew 477 → 1,154
  words, 89 → 218 sentences (verbatim from the book), and every lesson 21–120
  now drills the book's actual sound-of-the-day with check-outs built from its
  real word lists. Waiting on: photos of lessons 1–20 to make the early road
  just as faithful.

---

## 🔊 Audio status (drop-in, never blocks play)

- Music: per-area loops are **optional** — missing file = silence. Prompts for
  all tracks (incl. new `arcade.mp3`) in `docs/music-and-sfx.md`.
- SFX: 3 chimes (`good` / `gentle` / `fanfare`) — missing file = synth chime.
- Voice: family recordings preferred, TTS fallback for anything unrecorded
  (never for letter sounds). The clip manifest + a test keep the recording
  script honest — every spoken line has an entry to record.

---

## 💡 Possible next (not started — your call)

- Tune arcade difficulty per Evie's feedback.
- Per-game sound effects (wire specific Kenney sounds).
- An arcade "coin"/ticket streak reward for reading streaks.
- More stories / later-lesson phrases as she advances.
