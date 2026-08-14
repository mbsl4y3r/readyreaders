/**
 * The serial is the only unfinished story in the game.
 *
 * Every other story is a closed arc: she reads it, it ends, and there is
 * nothing left to wonder about overnight. This one stops on a question — so
 * the invariants that matter are that the question is really left open, and
 * that the answer actually exists and unlocks later. A cliffhanger with no
 * part two is not a hook, it is a broken promise.
 */
import { describe, it, expect } from 'vitest';
import { STORIES } from '../src/content/stories';
import { WORDS_BY_ID } from '../src/content/words';

const serials = STORIES.filter((s) => s.serial);

describe('the serialized story', () => {
  it('exists, and every part belongs to the same serial', () => {
    expect(serials.length).toBeGreaterThan(1);
    const keys = new Set(serials.map((s) => s.serial!.key));
    expect(keys.size).toBe(1);
  });

  it('has every part it promises, numbered in order', () => {
    const of = serials[0]!.serial!.of;
    expect(serials).toHaveLength(of);
    expect(serials.map((s) => s.serial!.part).sort()).toEqual(
      Array.from({ length: of }, (_, i) => i + 1),
    );
  });

  it('NEGATIVE: the last part is NOT a cliffhanger — the promise is paid off', () => {
    const last = serials.find((s) => s.serial!.part === s.serial!.of)!;
    expect(last.cliffhanger).toBeFalsy();
  });

  it('every part except the last stops on a cliffhanger', () => {
    for (const s of serials.filter((x) => x.serial!.part < x.serial!.of)) {
      expect(s.cliffhanger, `${s.id} should leave her wondering`).toBe(true);
    }
  });

  it('later parts unlock later, so the answer is something to read TOWARD', () => {
    const byPart = [...serials].sort((a, b) => a.serial!.part - b.serial!.part);
    for (let i = 1; i < byPart.length; i++) {
      expect(byPart[i]!.unlockLevel).toBeGreaterThan(byPart[i - 1]!.unlockLevel);
    }
  });

  it('the cliffhanger page actually asks something', () => {
    for (const s of serials.filter((x) => x.cliffhanger)) {
      const last = s.pages[s.pages.length - 1]!;
      expect(last.text.trim().endsWith('?'), `${s.id} ends: "${last.text}"`).toBe(true);
    }
  });

  it('NEGATIVE: every word in every part is decodable at that part\'s lesson', () => {
    // validate-content enforces this too; asserting it here means a future
    // edit to the serial cannot quietly slip in a word she cannot sound out
    for (const s of serials) {
      for (const page of s.pages) {
        for (const id of page.wordIds) {
          const word = WORDS_BY_ID.get(id);
          expect(word, `${s.id}: unknown word id "${id}"`).toBeTruthy();
          expect(word!.lesson, `${s.id}: "${word!.text}" needs lesson ${word!.lesson}`)
            .toBeLessThanOrEqual(s.lesson);
        }
      }
    }
  });
});
