import type { Datapack } from '../contracts/datapack';
import { characterStoryDirectoryId, isStoryHierarchy, parseCharacterStoryDirectoryId, type StoryDirectoryDef } from '../contracts/story-directory';
import type { StoryEntryDef } from '../contracts/story-entry';
import type { StoryDef } from '../contracts/story';

export interface RegisteredStoryDirectory {
  readonly definition: StoryDirectoryDef;
  readonly modName: string;
}

export function preferStoryDirectoryDescription(candidate: StoryDirectoryDef, current?: StoryDirectoryDef): boolean {
  if (!current) return true;
  if (Boolean(candidate.primary) !== Boolean(current.primary)) return Boolean(candidate.primary);
  return candidate.id < current.id;
}

export function validateStoryDirectories(
  pack: Datapack,
  registered: ReadonlyMap<string, RegisteredStoryDirectory>,
  initIds: ReadonlySet<string>,
  characterMods: ReadonlyMap<string, string>,
  pictureIds: ReadonlySet<string>,
  themeDesignIds: ReadonlySet<string>,
): void {
  const mod = pack.modName ?? 'base';
  const inits = new Set([...initIds, ...(pack.inits ?? []).map(init => init.id)]);
  const characters = new Map(characterMods);
  for (const character of pack.characters ?? []) if (!characters.has(character.id)) characters.set(character.id, mod);
  const pictures = new Set([...pictureIds, ...(pack.pics ?? []).map(pic => pic.id)]);
  const themes = new Set([...themeDesignIds, ...(pack.themeDesigns ?? []).map(theme => theme.id)]);
  const directories = new Map(registered);
  const seen = new Set<string>();
  for (const directory of pack.storyDirectories ?? []) {
    if (!directory || typeof directory.id !== 'string' || !inits.has(directory.initId)) throw new Error('故事目录缺少有效的 ID 或 Init。');
    const { id, initId, characterId, parentId, title, description, coverPicId, order } = directory;
    const previous = directories.get(id);
    if (seen.has(id) || (previous && (previous.modName !== mod || previous.definition.initId !== initId || previous.definition.characterId !== characterId))) {
      throw new Error(`故事目录 ID 重复、属于其他 Mod 或改变了固定归属：${id}`);
    }
    seen.add(id);
    if (directory.hierarchyString !== undefined) {
      if (!isStoryHierarchy(directory.hierarchyString) || characterId !== undefined || parentId !== undefined
        || !id.startsWith(`${mod}:story-hierarchy:`) || !/^[a-z0-9_-]+$/.test(id.split(':')[2]) || id.split(':').length !== 3
        || directory.acceptExternalEntries !== undefined) throw new Error(`故事层级资料无效：${id}`);
    } else if (characterId !== undefined) {
      if (typeof characterId !== 'string' || characters.get(characterId) !== mod || id !== characterStoryDirectoryId(initId, characterId) || parentId !== undefined) {
        throw new Error(`角色目录必须由角色所属 Mod 配置，且使用固定位置：${id}`);
      }
    } else if (!id.startsWith(`${mod}:story-directory:`) || !/^[a-z0-9_-]+$/.test(id.split(':')[2]) || id.split(':').length !== 3 || typeof title !== 'string' || !title.trim()) {
      throw new Error(`手动故事目录必须使用所属 Mod 的故事目录 ID，并填写标题：${id}`);
    }
    if (directory.primary !== undefined && (directory.hierarchyString === undefined
      || directory.primary !== 'design' && directory.primary !== 'path')) throw new Error(`故事目录主资料无效：${id}`);
    if ((parentId !== undefined && (typeof parentId !== 'string' || !parentId))
      || (title !== undefined && (typeof title !== 'string' || !title.trim()))
      || (description !== undefined && typeof description !== 'string')
      || (coverPicId !== undefined && !pictures.has(coverPicId))
      || (directory.themeDesignId !== undefined && !themes.has(directory.themeDesignId))
      || (order !== undefined && !Number.isFinite(order))
      || (directory.public !== undefined && typeof directory.public !== 'boolean')
      || (directory.acceptExternalEntries !== undefined && typeof directory.acceptExternalEntries !== 'boolean')) {
      throw new Error(`故事目录资料无效：${id}`);
    }
    directories.set(id, { definition: directory, modName: mod });
  }
  for (const id of seen) {
    const { definition } = directories.get(id)!;
    const ancestors = new Set([id]);
    let parentId = definition.parentId;
    while (parentId) {
      if (ancestors.has(parentId)) throw new Error(`故事目录不能循环引用：${id}`);
      ancestors.add(parentId);
      const parent = resolveStoryDirectory(parentId, directories, characters);
      if (!parent || parent.initId !== definition.initId || parent.modName !== mod) throw new Error(`故事目录父级不存在、跨 Init 或属于其他 Mod：${id} → ${parentId}`);
      parentId = directories.get(parentId)?.definition.parentId;
    }
  }
  validateStoryDirectoryPlacements(pack.stories ?? [], [...pack.activeStories ?? [], ...pack.passiveStories ?? []], directories, characters, inits, () => mod);
}

export function validateStoryDirectoryPlacements(
  stories: readonly StoryDef[],
  entries: readonly StoryEntryDef[],
  directories: ReadonlyMap<string, RegisteredStoryDirectory>,
  characterMods: ReadonlyMap<string, string>,
  initIds: ReadonlySet<string>,
  ownerOf: (id: string, kind: 'story' | 'entry') => string | undefined,
): void {
  for (const story of stories) {
    if (story.hierarchyString !== undefined) {
      if (!isStoryHierarchy(story.hierarchyString) || story.directoryId !== undefined
        || (story.initId !== undefined && !initIds.has(story.initId))) throw new Error(`Story 层级路径无效：${story.id}`);
    }
    if (story.directoryId === undefined) continue;
    const directory = resolveStoryDirectory(story.directoryId, directories, characterMods);
    if (!directory || !initIds.has(directory.initId) || directory.initId !== story.initId || directory.modName !== ownerOf(story.id, 'story')) {
      throw new Error(`Story 目录不存在、跨 Init 或属于其他 Mod：${story.id} → ${story.directoryId}`);
    }
  }
  for (const entry of entries) {
    if (entry.directoryPlacements === undefined) continue;
    if (!Array.isArray(entry.directoryPlacements)) throw new Error(`StoryEntry 目录位置应为数组：${entry.id}`);
    const inits = new Set<string>();
    for (const placement of entry.directoryPlacements) {
      if (!placement || !initIds.has(placement.initId) || inits.has(placement.initId)
        || (entry.availableInits.length && !entry.availableInits.includes(placement.initId))
        || (placement.order !== undefined && !Number.isFinite(placement.order))) {
        throw new Error(`StoryEntry 目录位置无效或重复：${entry.id}`);
      }
      inits.add(placement.initId);
      if (placement.hierarchyString !== undefined) {
        if (!isStoryHierarchy(placement.hierarchyString) || placement.directoryId !== undefined) throw new Error(`StoryEntry 层级路径无效：${entry.id}`);
        continue;
      }
      const directory = placement.directoryId && resolveStoryDirectory(placement.directoryId, directories, characterMods);
      const owner = ownerOf(entry.id, 'entry');
      if (!directory || directory.initId !== placement.initId || (!owner || (directory.modName !== owner && !directory.acceptExternalEntries))) {
        throw new Error(`StoryEntry 目录位置无效、重复或未授权：${entry.id} → ${placement?.directoryId}`);
      }
    }
  }
}

function resolveStoryDirectory(
  id: string,
  directories: ReadonlyMap<string, RegisteredStoryDirectory>,
  characterMods: ReadonlyMap<string, string>,
): { initId: string; modName: string; acceptExternalEntries?: boolean } | undefined {
  const declared = directories.get(id);
  if (declared && declared.definition.hierarchyString === undefined) return { ...declared.definition, modName: declared.modName };
  const auto = typeof id === 'string' && parseCharacterStoryDirectoryId(id);
  const modName = auto && characterMods.get(auto.characterId);
  if (auto && modName) return { initId: auto.initId, modName };
}
