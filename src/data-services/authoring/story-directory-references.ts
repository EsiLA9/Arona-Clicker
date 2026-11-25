import type { StoryDef } from '../contracts/story';
import type { StoryDirectoryDef } from '../contracts/story-directory';
import type { StoryEntryDef } from '../contracts/story-entry';

export interface StoryDirectoryReference {
  kind: 'directory' | 'story' | 'entry';
  id: string;
  title: string;
}

export function storyDirectoryReferences(id: string, source: {
  storyDirectories?: readonly StoryDirectoryDef[];
  stories: readonly Pick<StoryDef, 'id' | 'name' | 'directoryId'>[];
  activeStories: readonly StoryEntryDef[];
  passiveStories: readonly StoryEntryDef[];
}): StoryDirectoryReference[] {
  return [
    ...(source.storyDirectories ?? []).filter(row => row.parentId === id)
      .map(row => ({ kind: 'directory' as const, id: row.id, title: row.title || row.id })),
    ...source.stories.filter(row => row.directoryId === id)
      .map(row => ({ kind: 'story' as const, id: row.id, title: row.name || row.id })),
    ...[...source.activeStories, ...source.passiveStories].filter(row => row.directoryPlacements?.some(placement => placement.directoryId === id))
      .map(row => ({ kind: 'entry' as const, id: row.id, title: row.openingTitle || row.id })),
  ];
}
