/**
 * Content model for Evie's Reading Realms.
 *
 * The content spine is her physical 120-lesson phonics book. Every word,
 * phrase, and sentence in the game must be decodable using only graphemes
 * and memory words the book has taught by that point ("decodability rule").
 * scripts/validate-content.ts enforces this at build time.
 */

/** One lesson of the physical book. Practice lessons introduce nothing. */
export interface Lesson {
  id: number; // 1..120
  /** New letter-sound units taught in this lesson (single letters, digraphs, endings…). */
  newGraphemes: string[];
  /**
   * Irregular words the book explicitly teaches in this lesson —
   * the book calls these "memory words" ("it breaks the rules, you remember it").
   */
  memoryWords: string[];
  /** Short label for parent-facing UI, e.g. "sh, wash". */
  label: string;
}

export type RealmId = 'cove' | 'woods' | 'castle';

/** A game level groups a contiguous range of book lessons. */
export interface Level {
  id: number; // 1..9
  lessonRange: [from: number, to: number];
  realm: RealmId;
  title: string;
}

export interface Word {
  /** Unique id; lowercase text unless it collides (names keep capital, e.g. "Sam"). */
  id: string;
  text: string;
  /**
   * The word split into taught grapheme units, e.g. "ship" -> ["sh","i","p"],
   * "quack" -> ["qu","a","ck"]. joined graphemes must equal text (case-insensitive).
   */
  graphemes: string[];
  /**
   * For memory words: indexes into `graphemes` of the rule-breaking part(s).
   * e.g. "the" -> ["th","e"], heartIndexes [1] (the e says EEE).
   */
  heartIndexes?: number[];
  /** Native emoji glyph(s) shown as the word's picture AFTER decoding. Omit for abstract words. */
  emoji?: string;
  /** Book lesson at which the word first appears / becomes decodable. */
  lesson: number;
}

export interface Phrase {
  id: string;
  text: string;
  wordIds: string[];
  lesson: number;
}

/**
 * A decodable mini-story — Starlight Castle's story pages. Pure reward
 * reading: unlocked by reaching a level, no stats, no wrong answers.
 */
export interface Story {
  id: string;
  /** Shown on the cover; may use taught memory words. */
  title: string;
  realm: RealmId;
  /** The story appears once progress.currentLevel reaches this. */
  unlockLevel: number;
  /** Each page: a short decodable text; its emoji scene appears AFTER the read. */
  pages: { text: string; wordIds: string[]; emojiScene: string }[];
  /** Decodability lesson for the whole story (≥ the max any page needs). */
  lesson: number;
}

export interface Sentence {
  id: string;
  text: string;
  wordIds: string[];
  /** Emoji composition depicting the sentence, e.g. "👧🍖" for "Tam has ham." */
  correctEmoji: string;
  /** Two near-miss depictions. */
  distractorEmojis: [string, string];
  lesson: number;
  /** Optional playful reread direction, spoken after the picture is found. */
  rereadPrompt?: string;
}
