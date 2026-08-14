import type { Story } from './types';

/**
 * Story pages — decodable mini-stories unlocked as levels are won.
 * Every page obeys the decodability rule at the story's lesson
 * (scripts/validate-content.ts enforces this like phrases/sentences).
 *
 * Gentle bedtime arcs only. Each `lesson` is at or below the last lesson
 * of the unlock level's range, so a story is always readable when it opens.
 */
export const STORIES: Story[] = [
  {
    id: 'st01',
    title: 'A Pup and a Duck',
    realm: 'cove',
    unlockLevel: 2,
    lesson: 14,
    pages: [
      {
        text: 'A pup sat on hot sand.',
        wordIds: ['a', 'pup', 'sat', 'on', 'hot', 'sand'],
        emojiScene: '🐕🏖️☀️',
      },
      {
        text: 'A duck got wet. It was fun.',
        wordIds: ['a', 'duck', 'got', 'wet', 'it', 'was', 'fun'],
        emojiScene: '🦆💦🎉',
      },
      {
        text: 'A pup and a duck had fun.',
        wordIds: ['a', 'pup', 'and', 'a', 'duck', 'had', 'fun'],
        emojiScene: '🐕🦆🎉',
      },
      {
        text: 'At last, a nap in a hut.',
        wordIds: ['at', 'last', 'a', 'nap', 'in', 'a', 'hut'],
        emojiScene: '🐕🦆😴🛖',
      },
    ],
  },
  {
    id: 'st02',
    title: 'The Fox and the Hen',
    realm: 'woods',
    unlockLevel: 3,
    lesson: 28,
    pages: [
      {
        text: 'A hen sat on the nest.',
        wordIds: ['a', 'hen', 'sat', 'on', 'the', 'nest'],
        emojiScene: '🐔🪺🌳',
      },
      {
        text: 'An egg fell off the nest.',
        wordIds: ['an', 'egg', 'fell', 'off', 'the', 'nest'],
        emojiScene: '🥚😮',
      },
      {
        text: 'A fox ran up the hill with the egg.',
        wordIds: ['a', 'fox', 'ran', 'up', 'the', 'hill', 'with', 'the', 'egg'],
        emojiScene: '🦊🥚⛰️',
      },
      {
        text: 'The fox put the egg back in the nest.',
        wordIds: ['the', 'fox', 'put', 'the', 'egg', 'back', 'in', 'the', 'nest'],
        emojiScene: '🦊🥚🪺',
      },
      {
        text: 'The chick is with the hen at last.',
        wordIds: ['the', 'chick', 'is', 'with', 'the', 'hen', 'at', 'last'],
        emojiScene: '🐤🐔💕',
      },
    ],
  },
  {
    id: 'st03',
    title: 'The Lost Ring',
    realm: 'woods',
    unlockLevel: 4,
    lesson: 41,
    pages: [
      {
        text: 'The king lost his ring.',
        wordIds: ['the', 'king', 'lost', 'his', 'ring'],
        emojiScene: '🤴💍❓',
      },
      {
        text: 'The king was sad and mad.',
        wordIds: ['the', 'king', 'was', 'sad', 'and', 'mad'],
        emojiScene: '🤴😢',
      },
      {
        text: 'The fox dug in the mud. The ring!',
        wordIds: ['the', 'fox', 'dug', 'in', 'the', 'mud', 'the', 'ring'],
        emojiScene: '🦊🟤💍',
      },
      {
        text: 'The fox ran fast with the ring.',
        wordIds: ['the', 'fox', 'ran', 'fast', 'with', 'the', 'ring'],
        emojiScene: '🦊💨💍',
      },
      {
        text: 'The king had his ring. The king sang and sang.',
        wordIds: ['the', 'king', 'had', 'his', 'ring', 'the', 'king', 'sang', 'and', 'sang'],
        emojiScene: '🤴💍🎵',
      },
    ],
  },
  {
    id: 'st04',
    title: 'The Elf and the Prince',
    realm: 'castle',
    unlockLevel: 5,
    lesson: 64,
    pages: [
      {
        text: 'The prince can not dance.',
        wordIds: ['the', 'prince', 'can', 'not', 'dance'],
        emojiScene: '🤴🚫🕺',
      },
      {
        text: 'The elf can help him.',
        wordIds: ['the', 'elf', 'can', 'help', 'him'],
        emojiScene: '🧝🤝🤴',
      },
      {
        text: 'Step and step. Twist and twist.',
        wordIds: ['step', 'and', 'step', 'twist', 'and', 'twist'],
        emojiScene: '🕺🌀🧝',
      },
      {
        text: 'At last the prince can dance!',
        wordIds: ['at', 'last', 'the', 'prince', 'can', 'dance'],
        emojiScene: '🤴🕺🎉',
      },
      {
        text: 'The king and the prince dance and dance.',
        wordIds: ['the', 'king', 'and', 'the', 'prince', 'dance', 'and', 'dance'],
        emojiScene: '🤴🕺👑🎵',
      },
    ],
  },
  {
    id: 'st05',
    title: 'The Rain Day Cake',
    realm: 'castle',
    unlockLevel: 6,
    lesson: 72,
    pages: [
      {
        text: 'The rain fell all day.',
        wordIds: ['the', 'rain', 'fell', 'all', 'day'],
        emojiScene: '🌧️🏰',
      },
      {
        text: 'Sam and Tam can not play.',
        wordIds: ['sam', 'and', 'tam', 'can', 'not', 'play'],
        emojiScene: '👦👧😞🌧️',
      },
      {
        text: 'Mom said, "Let us bake a cake!"',
        wordIds: ['mom', 'said', 'let', 'us', 'bake', 'a', 'cake'],
        emojiScene: '👩🎂✨',
      },
      {
        text: 'The cake is grand. What a day!',
        wordIds: ['the', 'cake', 'is', 'grand', 'what', 'a', 'day'],
        emojiScene: '🎂🎉👦👧',
      },
      {
        text: 'The rain went away. The sun is back.',
        wordIds: ['the', 'rain', 'went', 'away', 'the', 'sun', 'is', 'back'],
        emojiScene: '🌦️➡️☀️',
      },
    ],
  },
  {
    id: 'st06',
    title: 'The Queen of the Sea',
    realm: 'cove',
    unlockLevel: 7,
    lesson: 86,
    pages: [
      {
        text: 'The queen of the sea can see far.',
        wordIds: ['the', 'queen', 'of', 'the', 'sea', 'can', 'see', 'far'],
        emojiScene: '👸🌊🔭',
      },
      {
        text: 'She can see a sad whale. The whale is lost.',
        wordIds: ['she', 'can', 'see', 'a', 'sad', 'whale', 'the', 'whale', 'is', 'lost'],
        emojiScene: '🐋😢🌊',
      },
      {
        text: 'The queen said, "Stay with me. We can swim back."',
        wordIds: ['the', 'queen', 'said', 'stay', 'with', 'me', 'we', 'can', 'swim', 'back'],
        emojiScene: '👸🐋🏊',
      },
      {
        text: 'The queen and the whale swam and swam.',
        wordIds: ['the', 'queen', 'and', 'the', 'whale', 'swam', 'and', 'swam'],
        emojiScene: '👸🐋🌊💨',
      },
      {
        text: "At last! The whale is with the whale's mom.",
        wordIds: ['at', 'last', 'the', 'whale', 'is', 'with', 'the', 'whale', 'mom'],
        emojiScene: '🐋🐋💕',
      },
    ],
  },
  // ---- THE SERIAL ------------------------------------------------------
  // Every story above is a closed arc: she finishes it and there is nothing
  // left to wonder about. This one stops on a question and the answer sits
  // on the shelf, locked, two levels ahead — the only thing in the game that
  // makes her want to come back to find out what happened.
  {
    id: 'st07',
    title: 'The Box on the Hill',
    realm: 'woods',
    unlockLevel: 4,
    lesson: 41,
    serial: { key: 'box', part: 1, of: 2 },
    cliffhanger: true,
    pages: [
      {
        text: 'Jack and Jill ran up the hill.',
        wordIds: ['jack', 'and', 'jill', 'ran', 'up', 'the', 'hill'],
        emojiScene: '\u{1F466}\u{1F467}\u26F0\uFE0F',
      },
      {
        text: 'A big black box sat in the grass.',
        wordIds: ['a', 'big', 'black', 'box', 'sat', 'in', 'the', 'grass'],
        emojiScene: '\u{1F4E6}\u{1F33F}',
      },
      {
        text: 'The box had a lock on it.',
        wordIds: ['the', 'box', 'had', 'a', 'lock', 'on', 'it'],
        emojiScene: '\u{1F4E6}\u{1F512}',
      },
      {
        text: 'Jack got a rock. The lock fell off.',
        wordIds: ['jack', 'got', 'a', 'rock', 'the', 'lock', 'fell', 'off'],
        emojiScene: '\u{1FAA8}\u{1F513}',
      },
      {
        text: 'Then the box went bang!',
        wordIds: ['then', 'the', 'box', 'went', 'bang'],
        emojiScene: '\u{1F4E6}\u{1F4A5}',
      },
      {
        text: 'What is in the box?',
        wordIds: ['what', 'is', 'in', 'the', 'box'],
        emojiScene: '\u{1F4E6}\u2753',
      },
    ],
  },
  {
    id: 'st08',
    title: 'The Box on the Hill, Part 2',
    realm: 'woods',
    unlockLevel: 6,
    lesson: 64,
    serial: { key: 'box', part: 2, of: 2 },
    pages: [
      {
        text: 'Jack and Jill held the box.',
        wordIds: ['jack', 'and', 'jill', 'held', 'the', 'box'],
        emojiScene: '\u{1F466}\u{1F467}\u{1F4E6}',
      },
      {
        text: 'Crack! The lid split.',
        wordIds: ['crack', 'the', 'lid', 'split'],
        emojiScene: '\u{1F4E6}\u2728',
      },
      {
        text: 'It was not a rock. It was a chick!',
        wordIds: ['it', 'was', 'not', 'a', 'rock', 'it', 'was', 'a', 'chick'],
        emojiScene: '\u{1F425}',
      },
      {
        text: 'The chick was wet and glum.',
        wordIds: ['the', 'chick', 'was', 'wet', 'and', 'glum'],
        emojiScene: '\u{1F425}\u{1F4A7}',
      },
      {
        text: 'Jill held the chick. It felt snug.',
        wordIds: ['jill', 'held', 'the', 'chick', 'it', 'felt', 'snug'],
        emojiScene: '\u{1F467}\u{1F425}\u{1F49B}',
      },
      {
        text: 'Then the chick sang. What a gift!',
        wordIds: ['then', 'the', 'chick', 'sang', 'what', 'a', 'gift'],
        emojiScene: '\u{1F425}\u{1F3B5}\u{1F381}',
      },
    ],
  },
];
