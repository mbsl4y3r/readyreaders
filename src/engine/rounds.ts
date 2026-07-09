import type { RealmId } from '../content/types';

export type MechanicId =
  | 'build-word'
  | 'feed-creature'
  | 'sentence-picture'
  | 'magic-phrase'
  | 'memory-word'
  | 'speed-round'
  | 'family-sort';

export interface RoundSpec {
  mechanic: MechanicId;
  /** Word rounds (build-word, feed-creature, memory-word). */
  wordId?: string;
  /** Written-choice distractor word ids (feed-the-creature). */
  distractorIds?: string[];
  /** Sentence rounds. */
  sentenceId?: string;
  /** Magic-phrase rounds. */
  phraseId?: string;
  /** Speed rounds: 5 already-known words, read against the clock. */
  speedWordIds?: string[];
  /** Family-sort rounds: two rime families and the word cards to sort. */
  family?: { families: [string, string]; wordIds: string[] };
  /** Check-out rounds gate a Reading Road lesson: only first-tap answers count. */
  checkout?: boolean;
  realm: RealmId;
}

export interface RoundResult {
  itemId: string;
  correct: boolean;
  firstTry: boolean;
  latencyMs: number;
  /** The game had to model the answer after repeated misses. */
  assisted: boolean;
}
