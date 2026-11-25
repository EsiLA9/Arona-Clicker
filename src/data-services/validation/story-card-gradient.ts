import type { StoryCardGradient } from '../contracts/story-card-gradient';

export function isStoryCardGradient(value: unknown): value is StoryCardGradient {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 2) return false;
  const { start, end } = value as Partial<StoryCardGradient>;
  return [start, end].every(color => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color));
}
