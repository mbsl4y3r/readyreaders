/**
 * The single list of every voice clip the game can use: id, folder, the exact
 * line to record, and whether TTS may stand in until the recording exists
 * (never for graphemes). Drives gen-recording-script and audio-check.
 */
import { WORDS } from '../src/content/words';
import { PHRASES } from '../src/content/phrases';
import { SENTENCES } from '../src/content/sentences';
import { THEMES } from '../src/content/themes';
import { LEVELS } from '../src/content/levels';

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

  // UI narration
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
    ...LEVELS.map(
      (l): [string, string] => [`level-${l.id}`, `${THEMES[l.realm].name}! Here we go!`],
    ),
  ];
  for (const [id, line] of ui) clips.push({ kind: 'ui', id, scriptLine: line, ttsFallback: true });

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
