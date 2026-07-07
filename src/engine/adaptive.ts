/**
 * The adaptive fluency model. Pure functions (no Phaser, no storage) so the
 * whole thing is unit-testable.
 *
 * Mastery ladder per word:
 *   0 learning  → 1 known      after 2 first-try corrects
 *   1 known     → 2 quick      when latency EMA < 4s
 *   2 quick     → 3 automatic  when EMA < 2s over ≥3 first-try exposures
 *   any miss drops one rung (floor 0)
 *
 * Tune these constants after watching Evie play.
 */
import type { WordStat } from '../services/progress';
import { epochDays, freshStat } from '../services/progress';

export const EMA_ALPHA = 0.4;
export const KNOWN_MS = 4000;
export const AUTOMATIC_MS = 2000;
export const AUTOMATIC_MIN_EXPOSURES = 3;
export const STALE_DAYS = 4;

export interface RoundOutcome {
  correct: boolean;
  firstTry: boolean;
  latencyMs: number;
  /** True when the game had to model the answer (second miss). */
  assisted: boolean;
}

export function updateStat(prev: WordStat, outcome: RoundOutcome, now = Date.now()): WordStat {
  const stat: WordStat = {
    ...prev,
    latencies: [...prev.latencies],
    exposures: prev.exposures + 1,
    lastSeen: epochDays(now),
  };

  if (outcome.correct && outcome.firstTry && !outcome.assisted) {
    stat.firstTryCorrect += 1;
    stat.latencies.push(outcome.latencyMs);
    if (stat.latencies.length > 5) stat.latencies.shift();
    stat.ema =
      stat.ema === 0
        ? outcome.latencyMs
        : Math.round(EMA_ALPHA * outcome.latencyMs + (1 - EMA_ALPHA) * stat.ema);
    if (stat.best === 0 || outcome.latencyMs < stat.best) stat.best = outcome.latencyMs;

    // climb the ladder
    if (stat.mastery === 0 && stat.firstTryCorrect >= 2) stat.mastery = 1;
    if (stat.mastery === 1 && stat.ema > 0 && stat.ema < KNOWN_MS) stat.mastery = 2;
    if (
      stat.mastery === 2 &&
      stat.ema > 0 &&
      stat.ema < AUTOMATIC_MS &&
      stat.firstTryCorrect >= AUTOMATIC_MIN_EXPOSURES
    ) {
      stat.mastery = 3;
    }
  } else if (!outcome.correct || outcome.assisted) {
    stat.mastery = Math.max(0, stat.mastery - 1) as WordStat['mastery'];
  }

  return stat;
}

export interface QueueOptions {
  /** Words eligible as NEW material (at the frontier). */
  newIds: string[];
  /** Words already seen (candidates for working set / review). */
  seenIds: string[];
  stats: Record<string, WordStat | undefined>;
  slots?: number;
  now?: number;
  /** Deterministic shuffle for tests. */
  random?: () => number;
}

/**
 * Compose a chunk's word queue: ~3 new + ~4 working set (weakest first)
 * + ~2 stale automatic words (spaced repetition) + ~1 easy confidence word.
 */
export function planQueue(opts: QueueOptions): string[] {
  const slots = opts.slots ?? 10;
  const now = opts.now ?? Date.now();
  const random = opts.random ?? Math.random;
  const stats = (id: string): WordStat => opts.stats[id] ?? freshStat();
  const today = epochDays(now);

  const queue: string[] = [];
  const used = new Set<string>();
  const take = (ids: string[], n: number) => {
    for (const id of ids) {
      if (queue.length >= slots || n <= 0) break;
      if (used.has(id)) continue;
      queue.push(id);
      used.add(id);
      n--;
    }
  };

  // 1. new material (unseen or barely seen frontier words)
  const fresh = opts.newIds.filter((id) => stats(id).exposures === 0);
  take(shuffle(fresh, random), 3);

  // 2. working set: seen, not yet automatic — weakest (lowest mastery, slowest) first
  const working = opts.seenIds
    .filter((id) => stats(id).exposures > 0 && stats(id).mastery < 3)
    .sort((a, b) => {
      const sa = stats(a);
      const sb = stats(b);
      return sa.mastery - sb.mastery || sb.ema - sa.ema;
    });
  take(working, 4);

  // 3. spaced repetition: automatic but stale — automaticity decays
  const stale = opts.seenIds.filter(
    (id) => stats(id).mastery === 3 && today - stats(id).lastSeen > STALE_DAYS,
  );
  take(shuffle(stale, random), 2);

  // 4. one easy confidence word
  const easy = opts.seenIds
    .filter((id) => stats(id).mastery >= 2)
    .sort((a, b) => stats(a).ema - stats(b).ema);
  take(easy, 1);

  // backfill from any remaining candidates
  take(working, slots);
  take(shuffle([...opts.newIds], random), slots);
  take(shuffle([...opts.seenIds], random), slots);

  return shuffle(queue, random);
}

/** Speed rounds must NEVER include mastery-0 words (fluency practice on accurate material only). */
export function speedRoundPool(
  candidateIds: string[],
  stats: Record<string, WordStat | undefined>,
): string[] {
  return candidateIds.filter((id) => (stats[id]?.mastery ?? 0) >= 1);
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
