import type Phaser from 'phaser';
import type { RealmTheme } from '../content/themes';
import type { RoundSpec, RoundResult } from '../engine/rounds';

export interface GameContext {
  theme: RealmTheme;
}

/**
 * A mini-game round: builds its objects into the scene, resolves with the
 * result when done, and cleans up after itself. The session scene owns the
 * loop; the round owns everything inside it.
 */
export type RunRound = (
  scene: Phaser.Scene,
  spec: RoundSpec,
  ctx: GameContext,
) => Promise<RoundResult>;
