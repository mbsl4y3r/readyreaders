import { describe, it, expect } from 'vitest';
import {
  checkWordAt,
  checkSpelling,
  tokenize,
  spellGraphemes,
  isSplitGrapheme,
} from '../src/content/decodability';
import { graphemesTaughtBy, memoryWordsTaughtBy, LESSONS } from '../src/content/lessons';
import type { Word } from '../src/content/types';

const word = (text: string, graphemes: string[], over: Partial<Word> = {}): Word => ({
  id: text.toLowerCase(),
  text,
  graphemes,
  lesson: 1,
  ...over,
});

describe('lesson-derived grapheme sets', () => {
  it('has 120 lessons', () => {
    expect(LESSONS).toHaveLength(120);
  });

  it('only the a-vowel exists before lesson 13', () => {
    const taught = graphemesTaughtBy(12);
    expect(taught.has('a')).toBe(true);
    expect(taught.has('e')).toBe(false);
    expect(taught.has('i')).toBe(false);
    expect(taught.has('o')).toBe(false);
    expect(taught.has('u')).toBe(false);
  });

  it('digraphs arrive at their book lessons', () => {
    expect(graphemesTaughtBy(18).has('ph')).toBe(true);
    expect(graphemesTaughtBy(18).has('th')).toBe(false);
    expect(graphemesTaughtBy(19).has('th')).toBe(true);
    expect(graphemesTaughtBy(25).has('sh')).toBe(false);
    expect(graphemesTaughtBy(26).has('sh')).toBe(true);
  });

  it('memory words accumulate ("was" at 5, "the" at 19)', () => {
    expect(memoryWordsTaughtBy(4).has('was')).toBe(false);
    expect(memoryWordsTaughtBy(5).has('was')).toBe(true);
    expect(memoryWordsTaughtBy(18).has('the')).toBe(false);
    expect(memoryWordsTaughtBy(19).has('the')).toBe(true);
  });
});

describe('decodability rule', () => {
  it('rejects a word whose grapheme is not yet taught', () => {
    const ship = word('ship', ['sh', 'i', 'p']);
    expect(checkWordAt(ship, 25)).not.toBeNull(); // sh taught at 26
    expect(checkWordAt(ship, 26)).toBeNull();
  });

  it('rejects a memory word before the book teaches it', () => {
    const the = word('the', ['th', 'e'], { heartIndexes: [1] });
    expect(checkWordAt(the, 18)).not.toBeNull();
    expect(checkWordAt(the, 19)).toBeNull();
  });

  it('heart-marked graphemes are exempt, the rest still checked', () => {
    // fake memory word using an untaught non-heart grapheme
    const bad = word('shwas', ['sh', 'w', 'a', 's'], { heartIndexes: [0] });
    expect(checkWordAt(bad, 5)).not.toBeNull(); // sh is hearted but... not a real memory word
  });

  it('catches graphemes that do not spell the word', () => {
    expect(checkSpelling(word('cat', ['c', 'a', 't']))).toBeNull();
    expect(checkSpelling(word('cat', ['c', 'a']))).not.toBeNull();
    expect(checkSpelling(word('Sam', ['S', 'a', 'm']))).toBeNull(); // case-insensitive
  });
});

describe('tokenize', () => {
  it('strips punctuation and lowercases', () => {
    expect(tokenize('Quick, Jill, fix it!')).toEqual(['quick', 'jill', 'fix', 'it']);
    expect(tokenize('A man has a hat.')).toEqual(['a', 'man', 'has', 'a', 'hat']);
  });
});

describe('split graphemes (transforming e)', () => {
  it('spellGraphemes wraps the post-underscore part to the word end', () => {
    expect(isSplitGrapheme('a_e')).toBe(true);
    expect(isSplitGrapheme('sh')).toBe(false);
    expect(spellGraphemes(['c', 'a_e', 'k'])).toBe('cake');
    expect(spellGraphemes(['s', 'm', 'i_e', 'l'])).toBe('smile');
    expect(spellGraphemes(['h', 'o_e', 'm'])).toBe('home');
    expect(spellGraphemes(['c', 'a', 't'])).toBe('cat'); // no-op without a split
  });

  it('checkSpelling accepts wrap-around words and rejects double splits', () => {
    expect(checkSpelling(word('cake', ['c', 'a_e', 'k']))).toBeNull();
    expect(checkSpelling(word('cake', ['c', 'a_e', 't']))).not.toBeNull();
    expect(checkSpelling(word('cakie', ['c', 'a_e', 'k', 'i_e']))).not.toBeNull();
  });

  it('split graphemes gate on their own lesson like any unit', () => {
    const cake = word('cake', ['c', 'a_e', 'k'], { lesson: 66 });
    expect(checkWordAt(cake, 65)).not.toBeNull(); // a_e taught at 66
    expect(checkWordAt(cake, 66)).toBeNull();
  });
});
