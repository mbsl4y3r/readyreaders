import type { Phrase } from './types';

/**
 * Short decodable phrases — the bridge between single words and sentences
 * (Magic Phrases mechanic). `lesson` is the latest lesson of any word used.
 */

const P = (id: string, text: string, wordIds: string[], lesson: number): Phrase => ({
  id,
  text,
  wordIds,
  lesson,
});

export const PHRASES: Phrase[] = [
  // Level 1 (lessons 1–9)
  P('p001', 'a sad lad', ['a', 'sad', 'lad'], 6),
  P('p002', 'ham and jam', ['ham', 'and', 'jam'], 7),
  P('p003', 'a fast van', ['a', 'fast', 'van'], 8),
  P('p004', 'a cat and a rat', ['a', 'cat', 'and', 'a', 'rat'], 8),
  P('p005', 'Dad and Sam', ['dad', 'and', 'sam'], 4),
  P('p006', 'a man ran fast', ['a', 'man', 'ran', 'fast'], 8),
  P('p007', 'a mad yak', ['a', 'mad', 'yak'], 9),

  // Level 2 (lessons 10–17)
  P('p010', 'a big pig', ['a', 'big', 'pig'], 13),
  P('p011', 'a red bed', ['a', 'red', 'bed'], 13),
  P('p012', 'a snack in a sack', ['a', 'snack', 'in', 'a', 'sack'], 13),
  P('p013', 'up a hill', ['up', 'a', 'hill'], 14),
  P('p014', 'a wet dog', ['a', 'wet', 'dog'], 14),
  P('p015', 'fun in the sun', ['fun', 'in', 'the', 'sun'], 19),
  P('p016', 'a duck and a pup', ['a', 'duck', 'and', 'a', 'pup'], 14),
  P('p017', 'a big egg', ['a', 'big', 'egg'], 13),
  P('p018', 'a hot bun', ['a', 'hot', 'bun'], 14),
  P('p019', 'mud on a truck', ['mud', 'on', 'a', 'truck'], 14),

  // Level 3 (lessons 18–30)
  P('p020', 'the big fish', ['the', 'big', 'fish'], 26),
  P('p021', 'a ship and a shell', ['a', 'ship', 'and', 'a', 'shell'], 26),
  P('p022', 'chop the log', ['chop', 'the', 'log'], 28),
  P('p023', 'wash the dog', ['wash', 'the', 'dog'], 26),
  P('p024', 'shut the shed', ['shut', 'the', 'shed'], 26),
  P('p025', 'a chick in a nest', ['a', 'chick', 'in', 'a', 'nest'], 28),
  P('p026', 'with them', ['with', 'them'], 19),
  P('p027', 'on the path', ['on', 'the', 'path'], 19),
  P('p028', 'a thin moth', ['a', 'thin', 'moth'], 19),
  P('p029', 'rich with cash', ['rich', 'with', 'cash'], 28),
];
