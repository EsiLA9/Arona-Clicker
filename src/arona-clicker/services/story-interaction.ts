import type { PassiveStoryEntry } from '../../data-services/contracts/story-entry';
import type { Talklet } from '../../data-services/contracts/story';

export function isInteractivePage(page: Talklet): boolean {
  return page.kind === 'click'
    || (page.choices ?? []).length > 0
    || !!page.sendText
    || !!page.clickWork;
}

export function shouldEchoReply(page: Talklet): boolean {
  if (page.kind === 'click') return false;
  if (page.muteReply) return false;
  return !!page.sendText && page.sendText.trim().length > 0;
}

export function rollClickWorkTotal(base: number, rand?: number): number {
  return base + (rand ? Math.floor(Math.random() * rand) : 0);
}

export function eligiblePassiveStories(
  entries: readonly PassiveStoryEntry[],
  filter: (entry: PassiveStoryEntry) => boolean,
): PassiveStoryEntry[] {
  return entries.filter(filter);
}

export function pickPassiveStory<T extends { weight: number }>(candidates: readonly T[]): T | undefined {
  if (candidates.length === 0) return undefined;
  const totalWeight = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected = candidates[candidates.length - 1];
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll < 0) {
      selected = candidate;
      break;
    }
  }
  return selected;
}
