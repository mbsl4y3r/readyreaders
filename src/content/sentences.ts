import type { Sentence } from './types';

/**
 * Decodable sentences for the sentence→picture mechanic.
 * Sentences marked "book" are verbatim from Evie's book pages.
 *
 * Picture cards are emoji compositions. The correct picture requires reading
 * the WHOLE sentence — distractors are near-misses (same subject different
 * object, same object different subject, or a missing part).
 */

const S = (
  id: string,
  text: string,
  wordIds: string[],
  lesson: number,
  correctEmoji: string,
  distractorEmojis: [string, string],
  rereadPrompt?: string,
): Sentence => ({
  id,
  text,
  wordIds,
  lesson,
  correctEmoji,
  distractorEmojis,
  ...(rereadPrompt ? { rereadPrompt } : {}),
});

export const SENTENCES: Sentence[] = [
  // ---- Level 1 (book lessons 1–9; several verbatim from the book) ----
  S('s001', 'Max sat.', ['max', 'sat'], 4, '👦🪑', ['👦🏃', '👧🪑'], 'Read it again nice and smooth.'),
  S('s002', 'Tam has ham.', ['tam', 'has', 'ham'], 3, '👧🍖', ['👧👒', '👦🍖'], 'Read it like you are very hungry!'),
  S('s003', 'A man has a hat.', ['a', 'man', 'has', 'a', 'hat'], 3, '👨👒', ['👨👜', '👩👒']),
  S('s004', 'Sam has an ax.', ['sam', 'has', 'an', 'ax'], 3, '👦🪓', ['👦🐜', '👧🪓'], 'Read it in a big strong voice!'),
  S('s005', 'Dad had a hat.', ['dad', 'had', 'a', 'hat'], 4, '👨👒', ['👨🪭', '👧👒']),
  S('s006', 'Max had wax and sand.', ['max', 'had', 'wax', 'and', 'sand'], 4, '👦🕯️🏖️', ['👦🕯️', '👦🏖️'], 'Read it again nice and smooth.'),
  S('s007', 'Sam was sad.', ['sam', 'was', 'sad'], 5, '👦😢', ['👦😀', '👧😢'], 'Read it in a sad, sad voice.'),
  S('s008', 'Dan ran fast.', ['dan', 'ran', 'fast'], 8, '👦💨', ['👦😴', '👧💨'], 'Read it super fast!'),
  S('s009', 'A cat sat.', ['a', 'cat', 'sat'], 7, '🐱🪑', ['🐱🏃', '🐶🪑']),
  S('s010', 'A man has a van.', ['a', 'man', 'has', 'a', 'van'], 8, '👨🚐', ['👨🚚', '👩🚐']),

  // ---- Level 2 (book lessons 10–17) ----
  S('s011', 'Bill hid in a box.', ['bill', 'hid', 'in', 'a', 'box'], 14, '👦📦', ['👦🛏️', '👧📦'], 'Read it in a whisper, like hiding!'),
  S('s012', 'A dog sat on a log.', ['a', 'dog', 'sat', 'on', 'a', 'log'], 14, '🐶🪵', ['🐶🪨', '🐱🪵']),
  S('s013', 'A hen has an egg.', ['a', 'hen', 'has', 'an', 'egg'], 13, '🐔🥚', ['🐔🪺', '🦆🥚'], 'Read it like a clucky hen!'),
  S('s014', 'A bug is in a cup.', ['a', 'bug', 'is', 'in', 'a', 'cup'], 14, '🐛☕', ['🐛📦', '🐟☕']),
  S('s015', 'A fox ran up a hill.', ['a', 'fox', 'ran', 'up', 'a', 'hill'], 14, '🦊⛰️', ['🦊🪵', '🐶⛰️'], 'Read it like a sneaky fox.'),
  S('s016', 'A duck can quack.', ['a', 'duck', 'can', 'quack'], 14, '🦆💬', ['🦆😴', '🐔💬'], 'Read it like a silly duck!'),
  S('s017', 'Mom got a pup.', ['mom', 'got', 'a', 'pup'], 14, '👩🐕', ['👩🐱', '👦🐕'], 'Read it like it is the best gift ever!'),
  S('s018', 'Jill can kick.', ['jill', 'can', 'kick'], 13, '👧⚽', ['👧🤸', '👦⚽']),
  S('s019', 'A pup dug in the mud.', ['a', 'pup', 'dug', 'in', 'the', 'mud'], 19, '🐕🟤', ['🐕🛁', '🐱🟤'], 'Read it like a messy puppy!'),
  S('s020', 'The sun is hot.', ['the', 'sun', 'is', 'hot'], 19, '☀️🔥', ['☀️💧', '🌙🔥']),

  // ---- Level 3 (book lessons 18–30; several verbatim from the book) ----
  S('s021', 'Philip is sick, ill, and sad.', ['philip', 'is', 'sick', 'ill', 'and', 'sad'], 18, '👦🤒', ['👦😀', '👧🤒'], 'Read it in a poor sick voice.'),
  S('s022', 'Sick Philip was fed in bed.', ['sick', 'philip', 'was', 'fed', 'in', 'bed'], 18, '👦🤒🛏️', ['👦🤒🛁', '👧🤒🛏️']),
  S('s023', 'Phil will miss his pet cat.', ['phil', 'will', 'miss', 'his', 'pet', 'cat'], 18, '👦💭🐱', ['👦💭🐶', '👧💭🐱'], 'Read it in a missing-you voice.'),
  S('s024', 'Bill hid his quill in a big sack.', ['bill', 'hid', 'his', 'quill', 'in', 'a', 'big', 'sack'], 13, '👦🪶🛍️', ['👦🪶📦', '👦🖊️🛍️'], 'Read it in a whisper, like a secret.'),
  S('s025', 'Quick, Jill, fix it!', ['quick', 'jill', 'fix', 'it'], 13, '👧🔧💨', ['👧🧹', '👦🔧'], 'Read it like an emergency!'),
  S('s026', 'The fish is in the dish.', ['the', 'fish', 'is', 'in', 'the', 'dish'], 26, '🐟🍽️', ['🐟📦', '🐤🍽️']),
  S('s027', 'A chick is in the shell.', ['a', 'chick', 'is', 'in', 'the', 'shell'], 28, '🐤🐚', ['🐤🪺', '🐟🐚'], 'Read it like a tiny chick — peep peep!'),
  S('s028', 'Wash the dog in the bath.', ['wash', 'the', 'dog', 'in', 'the', 'bath'], 26, '🐶🛁🧼', ['🐶🛏️', '🐱🛁'], 'Read it like a bossy big sister.'),
  S('s029', 'The ship has a red flag.', ['the', 'ship', 'has', 'a', 'red', 'flag'], 26, '🚢🚩', ['🚢⬛', '🛶🚩']),
  S('s030', 'Mom can chop the log with an ax.', ['mom', 'can', 'chop', 'the', 'log', 'with', 'an', 'ax'], 28, '👩🪓🪵', ['👩🪓🐟', '👦🪓🪵'], 'Read it in a big strong voice!'),
  S('s031', 'The moth is on the path.', ['the', 'moth', 'is', 'on', 'the', 'path'], 19, '🦋🛤️', ['🦋🛁', '🐟🛤️']),
  S('s032', 'Quick, get the cat, Philip!', ['quick', 'get', 'the', 'cat', 'philip'], 19, '👦🐱💨', ['👦🐶💨', '👧🐱']),
];
