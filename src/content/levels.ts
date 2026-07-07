import type { Level } from './types';

/** The book's 120 lessons grouped into 9 game levels across the three realms. */
export const LEVELS: Level[] = [
  { id: 1, lessonRange: [1, 9], realm: 'cove', title: 'Shallow Waters' },
  { id: 2, lessonRange: [10, 17], realm: 'cove', title: 'Pearl Lagoon' },
  { id: 3, lessonRange: [18, 30], realm: 'woods', title: 'Fern Hollow' },
  { id: 4, lessonRange: [31, 45], realm: 'woods', title: 'Badger Burrow' },
  { id: 5, lessonRange: [46, 65], realm: 'castle', title: 'Sparkle Stairs' },
  { id: 6, lessonRange: [66, 77], realm: 'castle', title: 'Moonbeam Tower' },
  { id: 7, lessonRange: [78, 95], realm: 'cove', title: 'Deep Reef' },
  { id: 8, lessonRange: [96, 115], realm: 'woods', title: 'Owl Ridge' },
  { id: 9, lessonRange: [116, 120], realm: 'castle', title: 'Star Throne' },
];

export function levelForLesson(lesson: number): Level {
  const level = LEVELS.find(
    (l) => lesson >= l.lessonRange[0] && lesson <= l.lessonRange[1],
  );
  if (!level) throw new Error(`No level covers lesson ${lesson}`);
  return level;
}
