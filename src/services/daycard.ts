/**
 * The day card — how a grown-up finds out.
 *
 * The parent corner is entirely pull: you have to remember it exists, open it,
 * and read a stats strip. Nothing ever reaches the other parent, so the person
 * who is not holding the iPad never learns that she read anything at all.
 *
 * This builds one short, shareable summary of a day's reading. It names the
 * words that became automatic, because "she read for 12 minutes" is a chore
 * report and "she can now read 'jump' without stopping to sound it out" is
 * the thing worth telling someone.
 *
 * Pure text, derived from progress — no tracking, no account, nothing leaves
 * the iPad unless a grown-up taps share.
 */
import type { ProgressData } from './progress';
import { WORDS_BY_ID } from '../content/words';
import { TOTAL_LESSONS } from '../content/regions';

/** Words she reads fast enough that recognition is automatic (mastery 3). */
export function automaticWords(progress: ProgressData): string[] {
  return Object.entries(progress.words)
    .filter(([key, stat]) => !key.includes(':') && stat.mastery === 3)
    .map(([key]) => WORDS_BY_ID.get(key)?.text)
    .filter((text): text is string => Boolean(text))
    .sort();
}

/** Minutes and rounds logged for one calendar day (yyyy-mm-dd). */
export function dayTotals(progress: ProgressData, date: string): { minutes: number; rounds: number } {
  return progress.sessions
    .filter((s) => s.date === date)
    .reduce(
      (acc, s) => ({ minutes: acc.minutes + (s.minutes ?? 0), rounds: acc.rounds + s.rounds }),
      { minutes: 0, rounds: 0 },
    );
}

/**
 * The shareable card. `date` is a yyyy-mm-dd key; `label` is how it should
 * read to a human (the caller formats it, so this stays locale-free and
 * testable).
 *
 * Returns null when there is nothing to report — an empty day is not worth a
 * message, and sending "she read for 0 minutes" would be worse than silence.
 */
export function dayCardText(
  progress: ProgressData,
  date: string,
  label = date,
  maxWords = 6,
): string | null {
  const { minutes, rounds } = dayTotals(progress, date);
  if (rounds === 0) return null;

  const lines = [`📖 Reading Realms — ${label}`];
  const time = minutes > 0 ? `${minutes} min` : null;
  lines.push([time, `${rounds} ${rounds === 1 ? 'round' : 'rounds'}`].filter(Boolean).join(' · '));
  lines.push(`Lesson ${Math.min(progress.lesson, TOTAL_LESSONS)} of ${TOTAL_LESSONS}`);

  const automatic = automaticWords(progress);
  if (automatic.length > 0) {
    const shown = automatic.slice(0, maxWords).join(', ');
    const rest = automatic.length - Math.min(maxWords, automatic.length);
    lines.push(
      `⭐ Reads these without stopping: ${shown}${rest > 0 ? ` (+${rest} more)` : ''}`,
    );
  }
  if (progress.streak.days > 1) lines.push(`🔥 ${progress.streak.days} days in a row`);
  return lines.join('\n');
}
