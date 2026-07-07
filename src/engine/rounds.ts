import type { RealmId } from '../content/types';

export type MechanicId =
  | 'build-word'
  | 'feed-creature'
  | 'sentence-picture'
  | 'magic-phrase'
  | 'memory-word';

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
