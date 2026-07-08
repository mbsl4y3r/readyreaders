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

## Sound effects (Kenney — free, CC0)

Gemini can't make sfx yet, so grab these from [kenney.nl/assets](https://kenney.nl/assets)
(all Kenney audio is CC0 — free for anything, no attribution required).
The game uses three effect names; drop files into `public/audio/sfx/`:

| File | Used for | Good picks from Kenney |
| --- | --- | --- |
| `good.mp3` | correct answer, small win | **Digital Audio** pack → any `powerUp*` you like (bright, short); or **UI Audio** → `switch_002` |
| `gentle.mp3` | soft "try again" nudge | **UI Audio** pack → `click_soft_002` / `rollover_002` (must feel kind, never a buzzer) |
| `fanfare.mp3` | session finished, big celebration | **Music Jingles** pack → one of the short win jingles (e.g. a `jingles_PIZZI*` "win" sting, ~2s) |

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
