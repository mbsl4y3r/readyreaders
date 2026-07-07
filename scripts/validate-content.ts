/**
 * Build-time enforcement of the decodability rule.
 * Fails the build if any word/phrase/sentence uses graphemes or memory words
 * the book hasn't taught by its declared lesson. Run via `npm run validate`
 * (also the prebuild gate).
 */
import { LESSONS } from '../src/content/lessons';
import { WORDS, WORDS_BY_ID } from '../src/content/words';
import { PHRASES } from '../src/content/phrases';
import { SENTENCES } from '../src/content/sentences';
import { LEVELS } from '../src/content/levels';
import { checkWordAt, checkSpelling, tokenize } from '../src/content/decodability';

const errors: string[] = [];

// -- lessons sanity --
if (LESSONS.length !== 120) errors.push(`Expected 120 lessons, got ${LESSONS.length}`);
LESSONS.forEach((l, i) => {
  if (l.id !== i + 1) errors.push(`Lesson at index ${i} has id ${l.id}, expected ${i + 1}`);
});

// -- levels cover 1..120 contiguously --
{
  let expected = 1;
  for (const level of LEVELS) {
    if (level.lessonRange[0] !== expected) {
      errors.push(`Level ${level.id} starts at lesson ${level.lessonRange[0]}, expected ${expected}`);
    }
    expected = level.lessonRange[1] + 1;
  }
  if (expected !== 121) errors.push(`Levels end at lesson ${expected - 1}, expected 120`);
}

// -- words --
const seenIds = new Set<string>();
for (const word of WORDS) {
  if (seenIds.has(word.id)) errors.push(`Duplicate word id "${word.id}"`);
  seenIds.add(word.id);

  const spelling = checkSpelling(word);
  if (spelling) errors.push(`word "${word.id}": ${spelling.problem}`);

  const decodable = checkWordAt(word, word.lesson);
  if (decodable) errors.push(`word "${word.id}" (lesson ${word.lesson}): ${decodable.problem}`);
}

// -- phrases & sentences --
function checkTextItem(kind: string, id: string, text: string, wordIds: string[], lesson: number) {
  const tokens = tokenize(text);
  if (tokens.length !== wordIds.length) {
    errors.push(
      `${kind} ${id}: text has ${tokens.length} tokens [${tokens.join(' ')}] but ${wordIds.length} wordIds`,
    );
    return;
  }
  tokens.forEach((token, i) => {
    const wordId = wordIds[i]!;
    const word = WORDS_BY_ID.get(wordId);
    if (!word) {
      errors.push(`${kind} ${id}: unknown word id "${wordId}"`);
      return;
    }
    if (word.text.toLowerCase() !== token) {
      errors.push(`${kind} ${id}: token "${token}" does not match word "${word.text}"`);
    }
    if (word.lesson > lesson) {
      errors.push(
        `${kind} ${id} (lesson ${lesson}): word "${word.text}" not decodable until lesson ${word.lesson}`,
      );
    }
  });
}

for (const p of PHRASES) checkTextItem('phrase', p.id, p.text, p.wordIds, p.lesson);
for (const s of SENTENCES) {
  checkTextItem('sentence', s.id, s.text, s.wordIds, s.lesson);
  if (s.distractorEmojis.length !== 2) {
    errors.push(`sentence ${s.id}: needs exactly 2 distractor emojis`);
  }
  if (s.distractorEmojis.includes(s.correctEmoji)) {
    errors.push(`sentence ${s.id}: a distractor duplicates the correct picture`);
  }
}

if (errors.length > 0) {
  console.error(`\n✗ Content validation failed with ${errors.length} error(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(
    `✓ Content valid: ${LESSONS.length} lessons, ${WORDS.length} words, ${PHRASES.length} phrases, ${SENTENCES.length} sentences`,
  );
}
