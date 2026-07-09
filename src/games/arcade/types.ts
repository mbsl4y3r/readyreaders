/**
 * The tiny contract every arcade mini-game speaks. Games are NOT Phaser
 * scenes — they mount into the single ArcadeScene host, which owns the frame
 * (title, score HUD, back button, game-over overlay) and forwards the update
 * loop. A game only has to: build its visuals into `ctx.layer`, advance itself
 * each frame in `update`, report score changes and the final score, and tear
 * down anything it hooked (input listeners, timers, tweens) in `destroy`.
 *
 * Deliberately no Phaser physics/scene machinery — motion is hand-rolled in
 * `update(time, delta)` so games stay old-iPad friendly, deterministic, and
 * self-contained. Everything visual goes into `ctx.layer`, which the host
 * destroys wholesale on exit, so `destroy` only needs to unhook listeners.
 */
import type Phaser from 'phaser';
import type { RealmTheme } from '../../content/themes';

export interface ArcadeCtx {
  /** All display objects go in here; the host destroys it when the game ends. */
  layer: Phaser.GameObjects.Container;
  /** Playfield size (below the HUD strip). Origin (0,0) is top-left of canvas. */
  width: number;
  height: number;
  /** Top inset reserved for the HUD — keep gameplay below this y. */
  hudBottom: number;
  /** Realm palette to tint the game (accent, background). */
  theme: RealmTheme;
  /** Game-speed factor from settings: ~0.8 chill · 1 normal · 1.25 zippy.
   *  Speed-based games multiply their velocities/spawn-rates by this. */
  difficulty: number;
  /** Call whenever the running score changes — updates the HUD. */
  onScore(score: number): void;
  /** Call once when the game ends. `score` is final; the host shows the overlay. */
  onGameOver(score: number): void;
}

export interface ArcadeGame {
  /** Advance one frame. `delta` is ms since the last frame. */
  update(time: number, delta: number): void;
  /** Unhook input listeners / stop timers this game created. Visuals auto-freed. */
  destroy(): void;
}

export type RunArcadeGame = (scene: Phaser.Scene, ctx: ArcadeCtx) => ArcadeGame;
