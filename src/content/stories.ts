import type { Story } from './types';

/**
 * Story pages — decodable mini-stories unlocked as levels are won.
 * Every page obeys the decodability rule at the story's lesson
 * (scripts/validate-content.ts enforces this like phrases/sentences).
 */
export const STORIES: Story[] = [];
