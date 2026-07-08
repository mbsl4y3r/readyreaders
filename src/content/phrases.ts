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

  // Level 4 (lessons 31–45)
  P('p030', 'a frog on a log', ['a', 'frog', 'on', 'a', 'log'], 31),
  P('p031', 'jump and swim', ['jump', 'and', 'swim'], 31),
  P('p032', 'a king can sing', ['a', 'king', 'can', 'sing'], 37),
  P('p033', 'a long song', ['a', 'long', 'song'], 37),
  P('p034', 'a wand and a ring', ['a', 'wand', 'and', 'a', 'ring'], 41),
  P('p035', 'a pink drink', ['a', 'pink', 'drink'], 43),
  P('p036', 'lunch with her sister', ['lunch', 'with', 'her', 'sister'], 43),
  P('p037', 'a soft gift', ['a', 'soft', 'gift'], 45),

  // Level 5 (lessons 46–65)
  P('p040', 'walk and talk', ['walk', 'and', 'talk'], 49),
  P('p041', 'help her', ['help', 'her'], 51),
  P('p042', 'fetch the hat', ['fetch', 'the', 'hat'], 51),
  P('p043', 'one big hug', ['one', 'big', 'hug'], 53),
  P('p044', 'a prince can dance', ['a', 'prince', 'can', 'dance'], 53),
  P('p045', 'a clock on the shelf', ['a', 'clock', 'on', 'the', 'shelf'], 55),
  P('p046', 'a fresh dress', ['a', 'fresh', 'dress'], 57),
  P('p047', 'a strong king', ['a', 'strong', 'king'], 62),

  // Level 6 (lessons 66–77)
  P('p050', 'a snake in the lake', ['a', 'snake', 'in', 'the', 'lake'], 66),
  P('p051', 'cake on a plate', ['cake', 'on', 'a', 'plate'], 66),
  P('p052', 'rain on the train', ['rain', 'on', 'the', 'train'], 70),
  P('p053', 'a snail on the path', ['a', 'snail', 'on', 'the', 'path'], 70),
  P('p054', 'sail away', ['sail', 'away'], 72),
  P('p055', 'play all day', ['play', 'all', 'day'], 72),
  P('p056', 'yawn at dawn', ['yawn', 'at', 'dawn'], 76),
  P('p057', 'draw a hawk', ['draw', 'a', 'hawk'], 76),

  // Level 7 (lessons 78–95)
  P('p060', 'a shark in the dark', ['a', 'shark', 'in', 'the', 'dark'], 80),
  P('p061', 'a car at the farm', ['a', 'car', 'at', 'the', 'farm'], 80),
  P('p062', 'a queen and a king', ['a', 'queen', 'and', 'a', 'king'], 82),
  P('p063', 'see the sea', ['see', 'the', 'sea'], 86),
  P('p064', 'a peach on the beach', ['a', 'peach', 'on', 'the', 'beach'], 86),
  P('p065', 'a sweet dream', ['a', 'sweet', 'dream'], 86),
  P('p066', 'try my pie', ['try', 'my', 'pie'], 92),
  P('p067', 'a happy sheep', ['a', 'happy', 'sheep'], 92),

  // Level 8 (lessons 96–115)
  P('p070', 'ride a bike', ['ride', 'a', 'bike'], 96),
  P('p071', 'a kite in the sky', ['a', 'kite', 'in', 'the', 'sky'], 96),
  P('p072', 'a bright night light', ['a', 'bright', 'night', 'light'], 98),
  P('p073', 'run home', ['run', 'home'], 103),
  P('p074', 'a goat on a boat', ['a', 'goat', 'on', 'a', 'boat'], 105),
  P('p075', 'the moon and a spoon', ['the', 'moon', 'and', 'a', 'spoon'], 107),
  P('p076', 'shout it out', ['shout', 'it', 'out'], 109),
  P('p077', 'a cute mule', ['a', 'cute', 'mule'], 113),

  // Level 9 (lessons 116–120)
  P('p080', 'corn on a fork', ['corn', 'on', 'a', 'fork'], 116),
  P('p081', 'a little bird', ['a', 'little', 'bird'], 117),
  P('p082', 'a purple turtle', ['a', 'purple', 'turtle'], 117),
  P('p083', 'light the candle', ['light', 'the', 'candle'], 117),
  P('p084', 'a special day', ['a', 'special', 'day'], 118),
  P('p085', 'write my name', ['write', 'my', 'name'], 119),
  P('p086', 'a girl and a lamb', ['a', 'girl', 'and', 'a', 'lamb'], 119),
];
