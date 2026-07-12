# Reading Realms — Design Overhaul Plan

_A comprehensive, reviewable plan. Prepared from a 16-screen design audit
(one agent per screen, each judged against the frontend-design skill).
Nothing here is built yet — this is for you and your agents to review, adjust,
and approve before we execute._

---

## 1. The honest diagnosis

The game is **functional, kind, and cohesive** — but visually it lands on the
generic "AI kids-game" default: a dark gradient, a pale-gold title set in the
reading font, drifting emoji, and flat translucent rounded panels. All 16 screen
audits — done independently — reached the *same* verdict and proposed the *same*
core fixes. That convergence is the good news: the problems are systemic, so a
small set of shared changes lifts the entire game at once.

Three systemic issues show up on every screen:

1. **Chrome uses the reading font.** Titles, buttons, scores, and labels are all
   set in Andika — the early-reader face we chose for *decodable words*. It has
   no display personality, so nothing feels branded. _(Single biggest cheap win.)_
2. **No surface system.** Every panel is a translucent dark rectangle; text
   floats on muddy gradients. There's no consistent "material."
3. **Weak hierarchy + noise.** The one real action competes with clutter (the map
   buries "Lesson 35!" under 10 identical edge icons), and random drifting emoji
   add a screensaver haze that reads as AI-generated.

---

## 2. The design language: "Storybook Atlas"

**Thesis.** The game's spine is a *journey* — the Reading Road through 12 themed
lands. So the whole game should feel like **a hand-crafted picture-book adventure
atlas** you travel through. Every screen is a "page spread": one focal
illustration, generous margins, one obvious action.

**Signature (spend boldness here; keep everything else quiet):**
> **"Everything is a cut-paper sticker."**
The avatars are already hand-drawn vector art with a soft outline + drop shadow.
Extend that exact craft to *all* chrome — buttons, cards, tabs, road milestones,
icons — so the UI looks like cut-paper stickers laid on a storybook page. It's
ownable, ties the UI to art we already have, and nothing else looks like it.

**The one hero moment:** the **Reading Road** itself — today a faint 9px line at
16% opacity. Turn it into a real adventure trail: a dotted/stitched path winding
through an illustrated land, each stop a chunky sticker medallion (passed = gold
star coin; today = the child's pet marker under a little "YOU ARE HERE" flag,
gently bobbing), the next region peeking as a landmark. Board-game energy.

### Tokens

**Color** — regions paint the backdrop; **UI sits on warm storybook paper** so
text always reads and the region supplies the color (not a muddy dark gradient).
| token | hex | use |
|---|---|---|
| `paper` | `#FBF3E3` | card/panel fill — "the page" |
| `paper-edge` | `#E7D6B8` | sticker outline / card border |
| `ink` | `#3B2A1E` | primary text (warm, never pure black) |
| `ink-soft` | `#7A6A58` | secondary text |
| `gold` | `#F5B841` | primary CTA + rewards ONLY (used sparingly) |
| `gold-edge` | `#C98A1E` | CTA outline / shadow |
| `coral` | `#F0876B` | secondary accent / gentle danger |
| `teal` | `#3FB8A6` | "correct" / equipped / go |

Each region keeps its own `bgTop/bgBottom/accent` (already in `regions.ts`) but
gets brightened toward its true identity (Candy Cliffs = candy pinks/pastels, not
aubergine dusk) and a light "land" treatment. **Dodging the AI cream-serif
default:** we pair paper with *chunky rounded forms + thick sticker outlines + a
playful display face* — not editorial serif — so it reads as a child's storybook,
not a magazine.

**Type — a real 3-role system** (right now one font does everything):
- **Display** (titles, buttons, region names, scores): a chunky rounded playful
  face — **Fredoka** or **Baloo 2** (bundle one `woff2`). The single biggest lift.
- **Reading** (words/sentences the child decodes): keep **Andika**, forever. It is
  a pedagogical choice for early-reader letterforms — never change it for
  decodable content.
- **Numerals** (pearls, prices, scores, Lv): display face, tabular, inside a coin
  chip so counts read as game currency.
- Scale: Title 44–56 / Section 28–32 / Body 20–22 / Caption 16–18, with real
  weight jumps.

**Components — the sticker kit** (built once in `ui/kit.ts`, propagates to all
~15 scenes):
- **StickerButton** — rounded, thick paper-edge outline + soft layered drop
  shadow, gentle press-down. Variants: primary (gold), secondary (paper), icon-coin.
- **PaperCard / makePanel** — paper fill, 2px paper-edge, soft shadow, generous padding.
- **CoinChip** — currency/score: a coin glyph + tabular display numeral on a pill.
- **Tab** — sticker pill; selected = gold fill + lift, unselected = quiet paper (no alpha-dim).
- **Milestone** — the road stop medallion (passed / today / locked states).
- **displayText()** helper (alongside `readingText()`), and `bob()` / `breathe()`
  motion helpers + a shared `prefers-reduced-motion` flag.

**Motion — deliberate, not sprinkled.** Page-load settle (staggered `popIn`),
today-stop bob, primary-button breathe. **Delete the random drifting emoji**
(the `drawRealmBackground` ambient loop) → 2–3 intentional region parallax layers
(set design). Everything gated behind reduced-motion.

**Layout.** One page grid: consistent 24px margins, a title zone, a focal zone,
one primary action bottom-center, and a consistent Home sticker (top-left) on
every non-map screen.

---

## 3. The foundation (do this first — it lifts every screen)

**~90% of the audit's "M/S" upgrades are the same five edits to `ui/kit.ts`.**
Ship these once and all 15 scenes improve for free:

1. **Bundle a display font** + add `displayText()`; point `makeButton` labels and
   scene titles at it (keep `readingText`/Andika for decodable words only).
2. **Rebuild `drawButtonBg` into the StickerButton** — paper fill, paper-edge
   stroke, soft layered shadow, primary/secondary/icon variants, keep the press-down.
3. **Add `makePanel` (PaperCard)**, **`CoinChip`**, and **`Tab`** primitives.
4. **Swap cold defaults** → paper/ink tokens (button fill `#fff`→`paper`, text
   `#26323f`→`ink`, `readingText` default `#fff`→`ink`).
5. **Give `drawRealmBackground` a paper mode** + delete the ambient-emoji drift
   loop; add `bob()`/`breathe()` + a reduced-motion flag.

_Estimate: ~1 focused build. Deliverable: the whole game stops looking templated._

---

## 4. Per-screen upgrades

Ordered by traffic. Each screen's headline moves (full detail lives in the audit
journal); most are delivered by the §3 foundation — the per-screen work is the
hero moment + layout.

### Map / home — _the hero screen_
- Rebuild the **Reading Road as the adventure trail** (dotted path + Milestone
  medallions + pet "you are here" marker + next-land peek). **[L]**
- Collapse the **10 edge icons into one tidy toolbelt** so the road + Lesson
  button own the screen. **[L]**
- Paper/display/token pass (foundation); brighten Candy Cliffs to true candy;
  reserve gold for the Lesson button; promote the *region name* to the headline
  (that's where you're standing), demote "Reading Realms" to a small eyebrow. **[M]**

### Session (reading round) — _highest-traffic after map_
- Put the decode **on a paper card** (prompt + word cards on paper; region color
  becomes a light wash/land silhouette behind). **[L]**
- Word choice cards → **PaperCard stickers**; progress pips → gold star coins. **[M]**
- Prompt in display face at Section scale; small "Lesson 35" eyebrow. **[S]**
- (Stretch) the region creature (Taffy) as a hand-drawn sticker vs. raw emoji. **[L]**

### Creator — _already partly polished today_
- Foundation pass (paper cards, display font, sticker buttons); hair-color chips →
  real color swatch coins; drop the drifting emoji. **[M]**

### Wardrobe
- Rack → opaque PaperCard; tabs → sticker Tabs (gold selected); purse/prices →
  CoinChips; **replace emoji tab/category icons with drawn cut-paper icons**. **[M–L]**
- Reserve gold (off the title/panel); equipped ✓ → teal.

### Collection Book
- Paper "album" page; each collectible a **cut-paper sticker medallion**
  (earned = full-color coin, locked = blank socket). Tabs → sticker pills. **[M]**
- ⚠️ **Content gap:** only 3 realm tabs (Coral/Woods/Castle) — the game now has
  **12 regions**. Needs a rethink (grouped/scrolling realms). **[M]**

### Sticker Book — _the screen literally about stickers_
- The signature's home turf: paper **open-book spread**, earned = cut-paper
  StickerSlot with white halo, locked = embossed empty socket; count → CoinChip +
  12-dot collect-o-meter. **[M]**

### Achievements
- Sticker-album page; earned = foil medallion sticker, locked = quiet paper;
  group the 15 badges into real families (Words/Stories/Speed/…). **[M–L]**

### Arcade (hub + games)
- Cabinets → PaperCard stickers with a theme marquee band; **fix the play-pass
  timer** (renders a giant raw number → clamp to `mm:ss`); pass state as a clear
  paper pill ("Play pass: 10 pearls" / "Playing — 4:59"); locked = sticker lock
  medallion over dimmed art; 4-col grid, centered. **[M]**

### Story Pages
- Cards → **book-cover stickers** (cloth spine band tinted by realm accent, creature
  in a framed medallion); locked → gold lock coin + "Lv 5" chip. **[M–L]**

### Photo Booth
- Paper studio ground; **frame becomes the signature** — a cut-paper instant-photo
  mount, snaps drop into the gallery as taped polaroids; Snap = the one gold CTA. **[M–L]**

### Ticket Shop
- Foundation pass; **replace system-emoji product art with the real cosmetic art**
  on sticker medallions, and **fix label/art mismatches** (Coral Tiara shows 💎;
  Sunbeam Gown + Gold Crown share 👑); all-owned = a hero "collected everything!"
  banner. **[M–L]**

### Phrases Hub
- Foundation pass; mastery pips → gold star coins; add a read-cue speaker sticker
  per phrase; name the current land. **[M]**

### Voyage (placement)
- Foundation pass; turn the slider into a **sea-lane voyage route** with the boat
  as the "today" marker and realm buoys — the road thesis applied to the parent
  tool. **[M–L]**

### Parent corner — _keep it grown-up, just on-brand_
- Paper tokens + display font + shared StickerButton/PaperCard; stat strip → row
  of CoinChips; demote "Reset all progress" to a quiet coral chip (keep 1776 gate);
  labelled sticker toggles for Music/Speed/Reader. **[M]**

### Boot / splash — _first impression_
- Paper "book cover"; wordmark in the display face + gold sticker; **Start
  medallion** (StickerButton) instead of a bare emoji star; replace the raw
  🦸📖🧜‍♀️ emoji with the game's own chibi avatars; orchestrated load settle;
  hint the road behind the title. **[M]**

---

## 5. Content & consistency fixes (surfaced during the audit)

Non-visual bugs worth fixing in the same pass:
- **Collection book** shows only 3 legacy realms; the game has 12 regions now.
- **Sticker names** hardcode "Inky" ("Inky's Pal", "Inky Legend") — should be
  pet-aware (Rex for the boy).
- **Arcade play-pass timer** renders a raw seconds number — clamp/format to `mm:ss`.
- **Map wardrobe icon** is 👗 (girl-coded) — make it neutral for both readers.
- **Ticket shop** art/label mismatches (see Arcade/Ticket sections).

---

## 6. Phased execution roadmap

| Phase | Scope | Effort | Delivers |
|---|---|---|---|
| **P1 — Foundation** | The `ui/kit.ts` refresh: display font, StickerButton, PaperCard, CoinChip, Tab, paper backgrounds, motion helpers, tokens. | 1 build | The whole game stops looking templated (biggest visible jump). |
| **P2 — The hero** | Rebuild the Reading Road map as the adventure trail + toolbelt. | 1 build | The signature screen becomes memorable. |
| **P3 — High-traffic** | Session (paper reading surface), wardrobe, creator finish, boot. | 1–2 builds | The daily-loop screens feel crafted. |
| **P4 — The rest** | Collection, sticker book, achievements, arcade, story, phrases, ticket shop, photo booth, voyage, parent. | 2 builds | Consistency everywhere; fold in §5 content fixes. |
| **P5 — Per-region art** | Give each of the 12 lands real "set design" (parallax + landmarks) so regions feel like places. | ongoing | Depth + reason to keep travelling. |

Each phase ships independently and is fully verifiable (browser screenshots +
tests), so you can review after every phase and redirect.

---

## 7. Risks & open decisions (for you + your agents)

1. **Display font** — pick one: **Fredoka** vs **Baloo 2** (both free, rounded,
   kid-friendly, offline-bundleable). Recommend **Fredoka**. Needs one `woff2`
   (~40KB) preloaded before scene render.
2. **Andika stays** for every decodable word/sentence — non-negotiable
   (pedagogy). The plan only changes *chrome* type.
3. **Performance** — paper cards + layered shadows are canvas redraws; the avatar
   painter already does heavier work, so this is safe, but we'll re-verify FPS on
   the map (most objects).
4. **Don't regress gameplay** — hit areas, the check-out/decodability logic, audio
   serialization, and the two-reader system must be untouched; visual-only.
5. **Reduced-motion** — add and honor it (accessibility + calmer option for some kids).
6. **Scope dial** — this is a maximalist craft direction. If you'd rather, we can
   stop after P1–P2 (foundation + hero), which is ~70% of the perceived lift for
   ~40% of the work.

---

## 8. What we deliberately keep

- The **decode-first** design of every reading mechanic, and Andika for words.
- The **forgiving, no-fail** tone (no buzzers, gentle nudges, everything a tap).
- The **layout skeletons** — most screens already have the right bones (one
  title, one focal area, one action); we're re-materializing, not re-architecting.
- The **two-reader system, Reading Road engine, arcade, and all content** — this
  is a paint-and-polish pass, not a rebuild.
- Big kid-friendly **tap targets** (≥64px) and the parent corner's grown-up restraint.
