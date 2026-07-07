# Ready Readers — Evie's Reading Realms 🧜‍♀️📖✨

A phonics fluency game built for one very specific six-year-old. Evie can
decode words, but slowly — by the end of a sentence the meaning has slipped
away. This game exists to make word recognition *automatic* so sentence
comprehension clicks, and it follows the exact 120-lesson sequence of her
physical phonics book.

## How it teaches

- **The book is the content spine.** Every word, phrase, and sentence is
  decodable using only letter-sounds the book has taught by that lesson
  (plus its explicitly taught "memory words" like *was*, *the*, *of*).
  `npm run validate` enforces this at build time and fails the build on
  violations.
- **Word → phrase → sentence.** Fluency at three grain sizes; sentence
  comprehension ships in the very first playable loop (read → pick the
  matching picture → hear it read fluently → read it again with expression).
- **No guessing from pictures.** Pictures appear only *after* a word is
  decoded — reward, not crutch.
- **No fail states.** Wrong answers wiggle gently and invite another try;
  after two misses the game models the answer and moves on.
- **Collections, not streaks.** Treasures, pets, and charms accumulate;
  nothing is ever lost.

## The world

One island, three realms along a path: **Coral Cove** (mermaids, levels 1–2),
**Whisker Woods** (animal pets, levels 3–4), **Starlight Castle**
(fairies & magic, levels 5–6), then a second lap for the advanced phonics.
Each game level covers a range of book lessons; the parent screen has a
"book lesson" marker so the game never teaches far ahead of the book.

## Running it

```bash
npm install
npm run dev        # local dev server
npm test           # vitest (validator, adaptive model, progress)
npm run validate   # decodability check on all content
npm run build      # validate + typecheck + production build
```

Deploys to GitHub Pages automatically from `main` (see
`.github/workflows/deploy.yml`; enable Pages → "GitHub Actions" in repo
settings). On the iPad, open the site in Safari → Share → **Add to Home
Screen** for the full-screen app feel.

## Family voice recordings

The game is fully playable day one using text-to-speech for words and
sentences — but it's much better with your voices, and **letter sounds play
only from recordings** (TTS says letter *names*, which is exactly wrong).

```bash
npm run recording-script   # writes recording-script.md + clips.csv
npm run audio-check        # shows which clips are still missing
```

Record on a phone, one clip per line, name files exactly as listed, and drop
them into `public/audio/<folder>/`. Every clip you add upgrades the game
automatically — start with the letter sounds.

## Parent corner

Long-press the ⚙️ gear on the map for 2 seconds: set the book-lesson marker,
see word stats, export/import progress (copy-paste code), reset.

## Project layout

- `src/content/` — lessons (the book's 120-lesson sequence), words, phrases,
  sentences, realms. **This is where new content goes.**
- `scripts/validate-content.ts` — the decodability rule.
- `src/engine/` — adaptive mastery model + session planner (pure, tested).
- `src/games/` — the mini-games (feed-the-creature, build-a-word,
  sentence→picture; more coming in later phases).
- `src/scenes/` — Phaser scenes: splash, map, session, parent corner.
- `LICENSES.md` — every third-party asset and its license.
