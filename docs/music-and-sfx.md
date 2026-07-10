# Music & sound effects — drop-in guide

The game plays a looping background track per area and real sound-effect
files for its chimes **when the files exist** — and stays perfectly playable
without them (silence for music, a synthesized chime for sfx). So everything
below is drop-in: generate/download, rename, drop in the folder, commit.

Parents can switch music off any time: parent corner → the 🎵 toggle.

---

## Background music (generate with Gemini)

Ask Gemini for **instrumental** music only (its music generation can't do
sound effects yet — see the Kenney section for those). One track per file
below. Aim for **60–120 seconds**; the game loops it seamlessly, so ask for
a loopable track (no big intro/outro). Save as MP3 (m4a/wav also work) into
`public/audio/music/` with **exactly** these names:

| File | Where it plays | Paste this prompt into Gemini |
| --- | --- | --- |
| `map.mp3` | Island map (home base) | Gentle, warm instrumental loop for a children's reading game map screen. Cozy and inviting, like a storybook island morning: soft marimba and ukulele, light glockenspiel sparkles, quiet ocean-wave brush percussion. 80 bpm, major key, no vocals, no harsh sounds, calm but cheerful. Must loop seamlessly, 90 seconds. |
| `cove.mp3` | Coral Cove reading sessions | Underwater lullaby instrumental loop for a kids' game, mermaid lagoon feel: warm harp arpeggios, soft vibraphone, gentle watery chimes, slow rounded bass. Dreamy but awake, 75 bpm, major key, no vocals. Quiet enough to talk over — this plays under a child reading aloud. Seamless loop, 90 seconds. |
| `woods.mp3` | Whisker Woods reading sessions | Cozy woodland instrumental loop for a children's game: plucked acoustic guitar, soft flute, light hand percussion, occasional birdsong-like flourishes. Friendly forest afternoon, 85 bpm, major key, no vocals, gentle dynamics, must sit quietly under speech. Seamless loop, 90 seconds. |
| `castle.mp3` | Starlight Castle reading sessions | Magical starlit instrumental loop for a children's game: music box and celesta melody, soft string pad, twinkling chimes, very gentle. Wonder and calm, like a fairy castle at night, 70 bpm, major key, no vocals, quiet enough to talk over. Seamless loop, 90 seconds. |
| `story.mp3` | Story Pages (bedtime stories) | Very soft bedtime-story instrumental loop: slow music box, warm piano, faint string swell, extremely gentle and unhurried. 60 bpm, major key, no vocals, almost a lullaby — it plays while a six-year-old reads a story aloud. Seamless loop, 90 seconds. |
| `wardrobe.mp3` | Evie's Wardrobe (dress-up shop) | Playful dress-up boutique instrumental loop for a kids' game: light pizzicato strings, bouncy glockenspiel, soft swing rhythm, a little fancy and fun like trying on a crown. 95 bpm, major key, no vocals, cheerful but not busy. Seamless loop, 60 seconds. |
| `arcade.mp3` | Games Arcade (mini-games hub) | Upbeat, playful chiptune-flavored instrumental loop for a kids' game arcade: bouncy 8-bit style square-wave melody softened with marimba and glockenspiel, light bubbly percussion, happy and energetic but NOT frantic or harsh. 110 bpm, major key, no vocals. Retro-arcade fun but gentle for a six-year-old. Seamless loop, 60 seconds. |

Tips that improve Gemini's output:
- If a track comes back with a hard ending, ask it to "regenerate as a
  seamless loop with no intro or outro".
- If it's too busy, add "sparse arrangement, fewer instruments".
- Consistency across tracks: add "same cozy storybook style as before".

### Region tracks (optional, drop-in) — the Reading Road's 12 lands

The map and reading sessions now look for `region-<id>.mp3` first and fall
back to the base realm track (cove/woods/castle) when it doesn't exist — so
add these in any order, whenever. Regions 1–3 ARE the base realms (no file
needed). Same rules: instrumental, loopable, 60–90s, quiet under a child
reading aloud. Save into `public/audio/music/`:

| File | Region | Paste this prompt into Gemini |
| --- | --- | --- |
| `region-4.mp3` | 🍭 Candy Cliffs (the banger!) | Bouncy candy-land instrumental loop for a children's game: toy piano and celesta melody, pizzicato strings, bubbly percussion like popping candy, bright glockenspiel sparkles. Sweet, giggly and joyful — the most fun land in the game — but still gentle enough to talk over. 100 bpm, major key, no vocals. Seamless loop, 75 seconds. |
| `region-5.mp3` | 🌈 Rainbow Meadow | Sunny meadow instrumental loop for a kids' game: ukulele strums, light airy flute like birdsong, soft hand claps, warm glockenspiel. Feels like butterflies in a field of flowers after rain. 90 bpm, major key, no vocals, gentle under speech. Seamless loop, 75 seconds. |
| `region-6.mp3` | 🚀 Star Sky | Dreamy outer-space instrumental loop for a children's game: soft warm synth pads, slow twinkling arpeggios, gentle celesta, a feeling of floating among friendly stars. Wonder, not tension. 75 bpm, major key, no vocals, quiet under speech. Seamless loop, 90 seconds. |
| `region-7.mp3` | ❄️ Snowy Summit | Cozy winter instrumental loop for a kids' game: soft sleigh bells, music box melody, warm low strings like a blanket, gentle snowfall feel. Hot-cocoa cozy, never cold or sad. 80 bpm, major key, no vocals, quiet under speech. Seamless loop, 75 seconds. |
| `region-8.mp3` | 🧚 Fairy Garden | Tiny magical garden instrumental loop for a children's game: harp arpeggios, celesta, fluttering flute trills like fairy wings, delicate chimes. Sparkly, dainty, full of wonder. 85 bpm, major key, no vocals, gentle under speech. Seamless loop, 75 seconds. |
| `region-9.mp3` | 🦕 Dino Valley | Playful jungle-adventure instrumental loop for a kids' game: marimba melody, soft jungle hand drums, low friendly bassoon stomps like a baby dinosaur walking, bird-call flourishes. Adventurous but cuddly. 95 bpm, major key, no vocals, gentle under speech. Seamless loop, 75 seconds. |
| `region-10.mp3` | 🏴‍☠️ Pirate Bay | Gentle sea-shanty instrumental loop for a children's game: swaying 6/8 accordion, plucked fiddle, soft concertina, a hint of creaking-ship rhythm. Friendly treasure-hunt fun, never menacing. 90 bpm, major key, no vocals, quiet under speech. Seamless loop, 75 seconds. |
| `region-11.mp3` | ☁️ Cloud Kingdom | Floaty daydream instrumental loop for a kids' game: soft warm pads, slow harp glissandi, weightless vibraphone melody, like bouncing gently on clouds. Airy and calm. 70 bpm, major key, no vocals, quiet under speech. Seamless loop, 90 seconds. |
| `region-12.mp3` | 💎 Crystal Caves | Glittering crystal-cave instrumental loop for a children's game: glassy bells, vibraphone, echoing soft chimes with a touch of reverb like a sparkling cavern, slow warm bass. Magical, a little awe-struck — the road's grand finale land. 75 bpm, major key, no vocals, quiet under speech. Seamless loop, 90 seconds. |

## Sound effects (Kenney — free, CC0)

Gemini can't make sfx yet, so grab these from [kenney.nl/assets](https://kenney.nl/assets)
(all Kenney audio is CC0 — free for anything, no attribution required).
The game uses three effect names; drop files into `public/audio/sfx/`:

| File | Used for | Good picks from Kenney |
| --- | --- | --- |
| `good.mp3` | correct answer, small win | **Digital Audio** pack → any `powerUp*` you like (bright, short); or **UI Audio** → `switch_002` |
| `gentle.mp3` | soft "try again" nudge | **UI Audio** pack → `click_soft_002` / `rollover_002` (must feel kind, never a buzzer) |
| `fanfare.mp3` | session finished, big celebration | **Music Jingles** pack → one of the short win jingles (e.g. a `jingles_PIZZI*` "win" sting, ~2s) |
| `newbest.mp3` | new arcade high score 🏆 | **Music Jingles** pack → a bright, rising "level up / high score" sting (distinct from `fanfare`, ~1.5s) |

### Arcade flavor (optional, nice-to-have)

The Games Arcade reuses the same three chimes above — `good` fires when a game
ends, `fanfare` on a new high score, `gentle` on a locked cabinet — so it needs
**no new sfx files** to feel complete. If you want extra arcade juice later,
these Kenney CC0 packs are the ones to raid (we'd wire specific sounds in a
follow-up; for now they're just recommendations to audition):

- **Interface Sounds** / **UI Audio** — bright blips for taps, menu moves.
- **Digital Audio** / **Sci-Fi Sounds** — lasers/zaps for Star Blaster, coins/pearls for Pearl Muncher & Serpent.
- **Impact Sounds** — soft "boink"/thud for Shell Bounce, Castle Crumble bricks, Acorn Ascent.
- **Music Jingles** — a couple of extra 1–2s win stings if you want game-specific fanfares.

A great free arcade high-score jingle also lives in **Music Jingles** — perfect
for the "New best! 🏆" moment if you'd like it distinct from the reading fanfare.

**Heads-up on format:** Kenney ships `.ogg`, which **iPad Safari cannot
play**. Convert before dropping in (any of mp3 / m4a / wav works):

```bash
# with ffmpeg (Mac: brew install ffmpeg)
for f in *.ogg; do ffmpeg -i "$f" -q:a 2 "${f%.ogg}.mp3"; done
```

Then rename to the exact filenames above and commit:

```bash
git add public/audio/music public/audio/sfx && git commit -m "add music and sfx" && git push
```

## Volume notes

- Music plays at ~22% volume by design (under the voice clips); export
  tracks at a normal level and the game handles the rest.
- Keep sfx short (< 2.5s) and friendly — the "gentle" one especially must
  never sound like a wrong-answer buzzer; the game has no fail states.
