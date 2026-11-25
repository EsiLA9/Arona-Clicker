import type { StoryDirectoryNode } from '../../arona-clicker/content/story/story-directory';
import type { RegisteredStoryDirectory } from '../../data-services/registry/story-directory-validation';

export function mergeDirectoryDesigns(
  scoped: ReadonlyMap<string, RegisteredStoryDirectory>,
  applied: ReadonlyMap<string, RegisteredStoryDirectory>,
  scopedMod?: string,
) {
  const definitions = new Map([...applied].filter(([, row]) => row.modName !== scopedMod));
  for (const [id, row] of scoped) definitions.set(id, row);
  return definitions;
}

export function hierarchyDesignCounts(definitions: ReadonlyMap<string, RegisteredStoryDirectory>) {
  const counts = new Map<string, number>();
  for (const row of definitions.values()) {
    if (!row.definition.hierarchyString) continue;
    const key = hierarchyDesignKey(row.definition.initId, row.definition.hierarchyString);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function hierarchyDesignKey(initId: string, path: string) {
  return JSON.stringify([initId, path]);
}

const origins = {
  Manual: ['手动', '手动建立'],
  AutoCreated: ['自动', '自动生成'],
  Path: ['路径', '按路径生成'],
  History: ['历史', '从阅读记录恢复'],
  Unfiled: ['自动', '系统归档'],
} as const;

export function directoryStatus(node: StoryDirectoryNode, pathDesigns = 0) {
  const [short, origin] = node.source === 'Unfiled' && node.id.startsWith('@legacy/') ? ['兼容', '旧编排生成'] : origins[node.source];
  return { short, origin, designs: node.source === 'Path' ? pathDesigns : Number(Boolean(node.definition)),
    stories: node.stories.length, entries: node.entries.length };
}
