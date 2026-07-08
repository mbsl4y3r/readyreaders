/**
 * The single list of every voice clip the game can use: id, folder, the exact
 * line to record, and whether TTS may stand in until the recording exists
 * (never for graphemes). Drives gen-recording-script and audio-check.
 */
import { WORDS } from '../src/content/words';
import { PHRASES } from '../src/content/phrases';
import { SENTENCES } from '../src/content/sentences';
import { STORIES } from '../src/content/stories';
import { THEMES } from '../src/content/themes';
import { LEVELS } from '../src/content/levels';
import { ARCADE_GAMES, ARCADE_ANNOUNCE } from '../src/content/arcade-games';

export interface Clip {
  kind: 'graphemes' | 'ui' | 'words' | 'phrases' | 'sentences';
  id: string;
  scriptLine: string;
  note?: string;
  ttsFallback: boolean;
}

const GRAPHEME_NOTE =
  'Say the PURE sound, short and clipped — /sh/ not "shuh", /t/ not "tuh". Never the letter name.';

export function buildManifest(): Clip[] {
  const clips: Clip[] = [];

  // letter sounds: every grapheme any word actually uses
  const graphemes = new Set<string>();
  for (const w of WORDS) for (const g of w.graphemes) graphemes.add(g.toLowerCase());
  for (const g of [...graphemes].sort()) {
    const id = g.replace(/[^a-z_']/g, '');
    if (!id) continue;
    clips.push({
      kind: 'graphemes',
      id,
      scriptLine: `the sound of "${g}"`,
      note: GRAPHEME_NOTE,
      ttsFallback: false, // HARD RULE — no TTS for letter sounds, ever
    });
  }

  // UI narration — every static speakUI(...) id in src/ must appear here
  // (tests/clip-manifest.test.ts enforces this so new lines are never
  // silently missing from the family recording script)
  const ui: [string, string][] = [
    ['welcome', "Welcome to Evie's Reading Realms!"],
    ['lets-read', "Let's read!"],
    ['feed-me', 'Feed me the word:'],
    ['yum', 'Yum! Thank you!'],
    ['try-again', 'Hmm, try again!'],
    ['this-one', 'This word says… tap it!'],
    ['build-the-word', 'Build the word:'],
    ['next-sound', 'Find the next sound — this one!'],
    ['you-read-it', 'You built it!'],
    ['read-sentence', 'Read the sentence. Then tap "I read it!"'],
    ['pick-picture', 'Which picture matches? You pick!'],
    ['listen', 'Yes! Listen:'],
    ['listen-match', 'Listen, then tap the match:'],
    ['read-again-try', 'Read the sentence one more time, then try again!'],
    ['celebrate', 'You did it! A new treasure for your collection!'],
    // magic phrases
    ['read-phrase', 'Read the magic phrase. Then tap "I read it!"'],
    ['tap-heard', 'Tap the word you heard!'],
    ['listen-tap', 'Listen again, then tap it!'],
    ['this-word', 'This one! Tap it!'],
    ['phrases-hub', 'Magic phrases! Pick one to read!'],
    // memory words
    ['memory-word-intro', 'This is a memory word. The heart part breaks the rules — we just remember it!'],
    ['memory-word-build', 'Now you build it — you remember!'],
    ['memory-this-one', 'It goes like this — this one!'],
    ['you-remembered-it', 'You remembered it!'],
    // lightning round + word families
    ['lightning-round', 'Lightning round! Ready… set… read!'],
    ['lightning-done', 'You read five words — so fast!'],
    ['review-done', 'Great reviewing! Your reading is getting stronger!'],
    ['family-sort-intro', 'Sort the words into their families!'],
    ['this-family', 'It goes in this family! Tap it!'],
    ['family-sort-done', 'You sorted the whole family!'],
    // voyage, collection, stories
    ['voyage-anchor', 'Anchors away! Your reading adventure starts here!'],
    ['collection-book', 'Your collection book! Look at everything you found!'],
    ['badges', 'Your badges! Look what you earned!'],
    ['story-shelf', 'Story pages! Pick a story to read!'],
    ['story-locked', 'Keep adventuring — this story unlocks soon!'],
    ['story-the-end', 'The end! You read the whole story!'],
    // wardrobe
    ['wardrobe-welcome', "Evie's wardrobe! Let's play dress-up!"],
    ['new-outfit', 'Ooh! You look wonderful!'],
    ['need-pearls', 'Read to earn more pearls!'],
    ['wardrobe-nudge', "Let's go read to earn more pearls!"],
    // first-run character creator
    ['creator-welcome', "Let's make your very own Evie!"],
    ['creator-done', "Yay! Let's start your adventure!"],
    // one spoken prompt per creator step (a pre-reader plays this solo) —
    // keep these in sync with the PROMPTS/STEPS in src/scenes/creator.ts
    ['creator-step-skin', 'Pick your skin'],
    ['creator-step-hairStyle', 'Pick a hairstyle'],
    ['creator-step-hairColor', 'Choose a hair color'],
    ['creator-step-outfit', 'Dress up!'],
    ['creator-step-face', 'Add a face'],
    ['creator-step-petColor', 'Your pet Inky'],
    // Games Arcade — a grown-up records these in a wacky announcer voice
    ['arcade-hub', ARCADE_ANNOUNCE.hub!],
    ...ARCADE_GAMES.map(
      (g): [string, string] => [`arcade-${g.id}`, ARCADE_ANNOUNCE[g.id] ?? g.title],
    ),
    ...LEVELS.map(
      (l): [string, string] => [`level-${l.id}`, `${THEMES[l.realm].name}! Here we go!`],
    ),
    ...(['cove', 'woods', 'castle'] as const).map(
      (r): [string, string] => [`collection-tab-${r}`, `${THEMES[r].name}!`],
    ),
  ];
  for (const [id, line] of ui) clips.push({ kind: 'ui', id, scriptLine: line, ttsFallback: true });

  // story pages — the bedtime-story voice is worth recording well
  for (const story of STORIES) {
    story.pages.forEach((page, i) => {
      clips.push({
        kind: 'ui',
        id: `story-${story.id}-p${i + 1}`,
        scriptLine: page.text,
        note: `"${story.title}" page ${i + 1} — cozy storytime voice`,
        ttsFallback: true,
      });
    });
  }

  // words (by book lesson so the highest-value ones record first)
  for (const w of [...WORDS].sort((a, b) => a.lesson - b.lesson)) {
    clips.push({
      kind: 'words',
      id: w.id,
      scriptLine: w.text,
      note: `lesson ${w.lesson} — say it naturally, then leave a beat of silence`,
      ttsFallback: true,
    });
  }

  for (const p of PHRASES) {
    clips.push({ kind: 'phrases', id: p.id, scriptLine: p.text, ttsFallback: true });
  }

  for (const s of SENTENCES) {
    clips.push({
      kind: 'sentences',
      id: s.id,
      scriptLine: s.text,
      note: 'read smoothly with natural expression — this is the fluent model Evie imitates',
      ttsFallback: true,
    });
    if (s.rereadPrompt) {
      clips.push({ kind: 'ui', id: `reread-${s.id}`, scriptLine: s.rereadPrompt, ttsFallback: true });
    }
  }

  return clips;
}
