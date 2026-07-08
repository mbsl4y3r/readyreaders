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

  // ---- Level 4 (book lessons 31–45) ----
  S('s033', 'A frog can jump and swim.', ['a', 'frog', 'can', 'jump', 'and', 'swim'], 31, '🐸🤸🏊', ['🐸😴', '🐟🤸'], 'Read it like a bouncy frog!'),
  S('s034', 'The king can sing a song.', ['the', 'king', 'can', 'sing', 'a', 'song'], 37, '🤴🎤🎵', ['🤴😴', '👸🎤🎵'], 'Sing it like a king!'),
  S('s035', 'Tam and Max want ham.', ['tam', 'and', 'max', 'want', 'ham'], 41, '👧👦🍖', ['👧🍖', '👧👦🥚']),
  S('s036', 'Her wand is pink.', ['her', 'wand', 'is', 'pink'], 43, '🪄🩷', ['🪄🟥', '💍🩷'], 'Read it like a magic spell!'),
  S('s037', 'Max got a pink drink.', ['max', 'got', 'a', 'pink', 'drink'], 43, '👦🩷🥤', ['👦☕', '👧🩷🥤']),
  S('s038', 'Mom and Dad had lunch.', ['mom', 'and', 'dad', 'had', 'lunch'], 43, '👩👨🥪', ['👩🥪', '👨👦🥪']),
  S('s039', 'A bug sat on a branch.', ['a', 'bug', 'sat', 'on', 'a', 'branch'], 43, '🐛🌿', ['🐛🪨', '🐜🌿']),
  S('s040', 'The gift is soft.', ['the', 'gift', 'is', 'soft'], 45, '🎁🧸', ['🎁🪨', '📦🧸']),
  S('s041', 'Sam can lift the raft.', ['sam', 'can', 'lift', 'the', 'raft'], 45, '👦🏋️🛶', ['👦🏋️📦', '👧🏋️🛶'], 'Read it in a big strong voice!'),

  // ---- Level 5 (book lessons 46–65) ----
  S('s042', 'The elf hid on the shelf.', ['the', 'elf', 'hid', 'on', 'the', 'shelf'], 49, '🧝📚', ['🧝🛏️', '👦📚'], 'Read it in a tiny elf voice!'),
  S('s043', 'Dan and Jill walk and talk.', ['dan', 'and', 'jill', 'walk', 'and', 'talk'], 49, '👦👧🚶💬', ['👦👧🏃', '👦👧😴']),
  S('s044', 'The pup can fetch the hat.', ['the', 'pup', 'can', 'fetch', 'the', 'hat'], 51, '🐕👒💨', ['🐕🧦', '🐱👒'], 'Read it like an excited puppy!'),
  S('s045', 'The sun can melt it.', ['the', 'sun', 'can', 'melt', 'it'], 51, '☀️🫠', ['☀️🧊', '🌙🫠']),
  S('s046', 'One duck sat on the bridge.', ['one', 'duck', 'sat', 'on', 'the', 'bridge'], 53, '🦆🌉', ['🦆🪵', '🐔🌉']),
  S('s047', 'The prince can dance and sing.', ['the', 'prince', 'can', 'dance', 'and', 'sing'], 53, '🤴🕺🎵', ['🤴😴', '👸💃🎵'], 'Read it like a fancy prince!'),
  S('s048', 'Tam and Sam had fudge.', ['tam', 'and', 'sam', 'had', 'fudge'], 53, '👧👦🍫', ['👧🍫', '👧👦🍪']),
  S('s049', 'The clock on the shelf is black.', ['the', 'clock', 'on', 'the', 'shelf', 'is', 'black'], 55, '🕐⬛', ['🕐🟥', '🔔⬛']),
  S('s050', 'Her dress is fresh and pink.', ['her', 'dress', 'is', 'fresh', 'and', 'pink'], 57, '👗🩷', ['👗⬛', '👖🩷']),
  S('s051', 'Smell the fresh spring grass.', ['smell', 'the', 'fresh', 'spring', 'grass'], 61, '👃🌿🌸', ['👃🍫', '👀🌿'], 'Take a big sniff as you read!'),

  // ---- Level 6 (book lessons 66–77) ----
  S('s052', 'The snake is in the lake.', ['the', 'snake', 'is', 'in', 'the', 'lake'], 66, '🐍🏞️', ['🐍🏖️', '🐊🏞️'], 'Read it in a hissy snake voice!'),
  S('s053', 'Mom made a cake.', ['mom', 'made', 'a', 'cake'], 66, '👩🎂', ['👩🧁', '👧🎂']),
  S('s054', 'The whale made a big wave.', ['the', 'whale', 'made', 'a', 'big', 'wave'], 66, '🐋🌊', ['🐋😴', '🐟🌊'], 'Read it in a big whale voice!'),
  S('s055', 'Max and Tam are brave.', ['max', 'and', 'tam', 'are', 'brave'], 66, '👦👧💪', ['👦👧🙈', '👦💪']),
  S('s056', 'The train is in the rain.', ['the', 'train', 'is', 'in', 'the', 'rain'], 70, '🚂🌧️', ['🚂☀️', '🚗🌧️']),
  S('s057', 'The snail said, "Wait!"', ['the', 'snail', 'said', 'wait'], 70, '🐌✋', ['🐌💤', '🐢✋'], 'Read it slooowly like a snail.'),
  S('s058', 'Jill can play all day.', ['jill', 'can', 'play', 'all', 'day'], 72, '👧🛝', ['👧😴', '👦🛝']),
  S('s059', 'The ship can sail away.', ['the', 'ship', 'can', 'sail', 'away'], 72, '🚢💨', ['🚢⚓', '⛵💨']),
  S('s060', 'A hawk sat on a branch at dawn.', ['a', 'hawk', 'sat', 'on', 'a', 'branch', 'at', 'dawn'], 76, '🦅🌿🌅', ['🦅🌿🌙', '🦆🌿🌅']),
  S('s061', 'Dad can draw a whale.', ['dad', 'can', 'draw', 'a', 'whale'], 76, '👨🖍️🐋', ['👨🖍️🐍', '👧🖍️🐋']),

  // ---- Level 7 (book lessons 78–95) ----
  S('s062', 'The star is far, far away.', ['the', 'star', 'is', 'far', 'far', 'away'], 80, '⭐🌌', ['🌙🌌', '⭐🏠'], 'Read it in a dreamy voice.'),
  S('s063', 'The queen fed the sheep.', ['the', 'queen', 'fed', 'the', 'sheep'], 82, '👸🐑', ['👸🐄', '🤴🐑'], 'Read it in a royal voice!'),
  S('s064', 'He has a red car.', ['he', 'has', 'a', 'red', 'car'], 84, '👨🟥🚗', ['👨🚐', '👩🟥🚗']),
  S('s065', 'She can see the green tree.', ['she', 'can', 'see', 'the', 'green', 'tree'], 84, '👧👀🌳', ['👧👀🌵', '👦👀🌳']),
  S('s066', 'The shark is in the dark sea.', ['the', 'shark', 'is', 'in', 'the', 'dark', 'sea'], 86, '🦈🌊🌑', ['🦈🌊☀️', '🐬🌊🌑'], 'Read it in a deep, dark voice.'),
  S('s067', 'We can eat a peach on the beach.', ['we', 'can', 'eat', 'a', 'peach', 'on', 'the', 'beach'], 86, '🍑🏖️😋', ['🍑🏠', '🍎🏖️']),
  S('s068', 'Pete had a dream.', ['pete', 'had', 'a', 'dream'], 87, '👦💭', ['👦📖', '👧💭'], 'Read it in a sleepy voice.'),
  S('s069', 'My pie is sweet.', ['my', 'pie', 'is', 'sweet'], 92, '🥧🍭', ['🥧🌶️', '🍕🍭']),
  S('s070', 'A fly is in the sky.', ['a', 'fly', 'is', 'in', 'the', 'sky'], 92, '🪰☁️', ['🪰🏠', '🐦☁️']),
  S('s071', 'Mom can buy a bun and milk.', ['mom', 'can', 'buy', 'a', 'bun', 'and', 'milk'], 94, '👩🥯🥛', ['👩🥯', '👩🥛🍞']),

  // ---- Level 8 (book lessons 96–115) ----
  S('s072', 'She can ride a bike.', ['she', 'can', 'ride', 'a', 'bike'], 96, '👧🚲', ['👧🛴', '👦🚲'], 'Read it fast like a race!'),
  S('s073', 'My kite can fly high.', ['my', 'kite', 'can', 'fly', 'high'], 98, '🪁☁️', ['🪁🌳', '🎈☁️']),
  S('s074', 'The light is bright at night.', ['the', 'light', 'is', 'bright', 'at', 'night'], 98, '💡🌙✨', ['💡🌅', '🕯️🌙']),
  S('s075', 'The dog dug up a bone.', ['the', 'dog', 'dug', 'up', 'a', 'bone'], 103, '🐶🦴', ['🐶🥾', '🐱🦴'], 'Read it like a happy dog!'),
  S('s076', 'The goat is on the boat.', ['the', 'goat', 'is', 'on', 'the', 'boat'], 105, '🐐🛥️', ['🐐🚂', '🐄🛥️'], 'Read it like a silly goat!'),
  S('s077', 'Look at the moon.', ['look', 'at', 'the', 'moon'], 107, '👀🌕', ['👀☀️', '👀⭐'], 'Read it in a hushed night voice.'),
  S('s078', 'A cow can shout out loud.', ['a', 'cow', 'can', 'shout', 'out', 'loud'], 109, '🐄📣', ['🐄😴', '🐖📣'], 'Shout it out — MOO!'),
  S('s079', 'The boy has a blue toy.', ['the', 'boy', 'has', 'a', 'blue', 'toy'], 113, '👦🟦🧸', ['👦🟥🧸', '👧🟦🧸']),
  S('s080', 'The cute mule ate the fruit.', ['the', 'cute', 'mule', 'ate', 'the', 'fruit'], 113, '🫏🍉', ['🫏🌿', '🐴🍉']),
  S('s081', 'A rose grew at home.', ['a', 'rose', 'grew', 'at', 'home'], 115, '🌹🏠', ['🌻🏠', '🌹⛺']),

  // ---- Level 9 (book lessons 116–120) ----
  S('s082', 'The earth is my home.', ['the', 'earth', 'is', 'my', 'home'], 116, '🌍🏠', ['🌕🏠', '🌍🚀'], 'Read it in a proud voice!'),
  S('s083', 'A little bird sat on the girl.', ['a', 'little', 'bird', 'sat', 'on', 'the', 'girl'], 117, '🐦👧', ['🐦🌳', '🦋👧'], 'Read it in a tiny bird voice!'),
  S('s084', 'The turtle is purple.', ['the', 'turtle', 'is', 'purple'], 117, '🐢🟪', ['🐢🟩', '🐸🟪'], 'Read it slooowly like a turtle.'),
  S('s085', 'The lamb is little and sweet.', ['the', 'lamb', 'is', 'little', 'and', 'sweet'], 119, '🐑💕', ['🐐💕', '🐑😴']),
  S('s086', 'Light the candle at night.', ['light', 'the', 'candle', 'at', 'night'], 117, '🕯️🌙', ['🕯️☀️', '💡🌙'], 'Read it in a soft bedtime voice.'),
  S('s087', 'The girl had a special day.', ['the', 'girl', 'had', 'a', 'special', 'day'], 118, '👧🎉', ['👧😢', '👦🎉']),
  S('s088', 'She can write with a pen.', ['she', 'can', 'write', 'with', 'a', 'pen'], 119, '👧✍️', ['👧📖', '👦✍️']),
  S('s089', 'The knight had corn on a fork.', ['the', 'knight', 'had', 'corn', 'on', 'a', 'fork'], 119, '🛡️🌽🍴', ['🛡️🥧🍴', '🤴🌽🍴'], 'Read it like a noble knight!'),
];
