import { graphemesTaughtBy, memoryWordsTaughtBy } from './lessons';
import type { Word } from './types';

/**
 * The decodability rule — the game's single most important content constraint.
 *
 * A word is decodable at book lesson N when every grapheme unit in it has been
 * taught by lesson N. Memory words are exempt at their heart-marked graphemes
 * only, and only once the book has taught them.
 *
 * The book itself freely combines taught single letters into clusters before
 * the blend lessons ("sand", "hand" appear in lesson 4), so a cluster of
 * taught letters is decodable — blend lessons refine fluency, they don't gate.
 */

export interface DecodabilityIssue {
  wordId: string;
  problem: string;
}

export function checkWordAt(word: Word, lesson: number): DecodabilityIssue | null {
  const taught = graphemesTaughtBy(lesson);
  const memory = memoryWordsTaughtBy(lesson);
  const heartSet = new Set(word.heartIndexes ?? []);

  if (heartSet.size > 0 && !memory.has(word.text.toLowerCase())) {
    return {
      wordId: word.id,
      problem: `memory word "${word.text}" not taught by lesson ${lesson}`,
    };
  }

  for (let i = 0; i < word.graphemes.length; i++) {
    const g = word.graphemes[i]!.toLowerCase();
    if (heartSet.has(i)) continue; // the rule-breaking part — taught by heart
    if (!taught.has(g)) {
      return {
        wordId: word.id,
        problem: `grapheme "${g}" (position ${i}) not taught by lesson ${lesson}`,
      };
    }
  }
  return null;
}

/** A split grapheme ("a_e", "i_e", "o_e") wraps around later letters. */
export function isSplitGrapheme(g: string): boolean {
  return g.includes('_');
}

/**
 * Join graphemes into the spelled word, honoring split graphemes: the part
 * before the underscore sits in place, the part after lands at the end of
 * the word ("cake" = ["c","a_e","k"] → c·a…k + e).
 */
export function spellGraphemes(graphemes: string[]): string {
  let main = '';
  let tail = '';
  for (const g of graphemes) {
    const cut = g.indexOf('_');
    if (cut === -1) {
      main += g;
    } else {
      main += g.slice(0, cut);
      tail += g.slice(cut + 1);
    }
  }
  return main + tail;
}

/** Graphemes must spell the word exactly (ignoring case). */
export function checkSpelling(word: Word): DecodabilityIssue | null {
  const splits = word.graphemes.filter(isSplitGrapheme).length;
  if (splits > 1) {
    return {
      wordId: word.id,
      problem: `${splits} split graphemes — the wrap-around spelling rule only supports one`,
    };
  }
  const joined = spellGraphemes(word.graphemes).toLowerCase();
  if (joined !== word.text.toLowerCase()) {
    return {
      wordId: word.id,
      problem: `graphemes [${word.graphemes.join(',')}] join to "${joined}", not "${word.text}"`,
    };
  }
  return null;
}

/** Tokenize sentence/phrase text into lowercase word tokens (strips punctuation). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]s\b/g, '') // possessives handled as endings later
    .split(/[^a-z']+/)
    .filter(Boolean);
}
