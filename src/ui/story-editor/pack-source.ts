import type { ContentCatalogQueryPort } from '../../arona-clicker/contracts/runtime/content-catalog';
import type { GameReadModel, PackCatalogEntry } from '../../arona-clicker/contracts/runtime/runtime';
import type { Datapack } from '../../data-services/contracts/datapack';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { UIContext } from '../runtime/context';
import { displayName } from '../../engine/core/display-name';
import type { StoryDraft, StoryEditorState } from './model';

export function storyPackSource(entry: PackCatalogEntry): NonNullable<StoryDraft['packSource']> {
  return { packRecordId: entry.packRecordId ?? entry.id, modName: entry.modName, dependencies: entry.dependencies ?? [], digest: entry.contentDigest,
    label: `${entry.name} · ${entry.version} · ${entry.editingMode === 'editing' ? '编辑态' : '普通态'}` };
}

export function storySourceGame(game: GameReadModel, state: StoryEditorState): GameReadModel {
  const registry = state.sourceRegistry;
  if (!registry) return game;
  return new Proxy(game, {
    get(target, key) {
      if (key === 'registry') return registry;
      if (key === 'pics' && state.sourcePics) return state.sourcePics;
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function storySourceContext(ctx: UIContext, state: StoryEditorState): UIContext {
  if (!state.sourceRegistry) return ctx;
  const game = storySourceGame(ctx.game, state);
  return { ...ctx, game, nameOf: (type, id) => displayName(game.registry, type, id) };
}

/** Let authors inspect installed files even when a dependency cannot be loaded into a Registry. */
export function storyPackCatalog(packs: readonly Datapack[]): ContentCatalogQueryPort {
  const index = <T>(rows: (pack: Datapack) => readonly T[] | undefined, key: (row: T) => string) =>
    new Map(packs.flatMap(pack => (rows(pack) ?? []).map(row => [key(row), row] as const)));
  const id = <T extends { id: string }>(row: T) => row.id;
  const activeStories = index(pack => pack.activeStories, id);
  const passiveStories = index(pack => pack.passiveStories, id);
  const owner = (key: string, has: (pack: Datapack) => boolean) => {
    const pack = [...packs].reverse().find(has);
    return pack && (pack.modName ?? 'base');
  };
  return {
    stories: index(pack => pack.stories, id),
    activeStories, passiveStories,
    storyEntries: new Map<string, StoryEntryDef>([...activeStories, ...passiveStories]),
    passivePools: index(pack => pack.passivePools, id),
    storyDirectories: index(pack => pack.storyDirectories?.map(definition => ({ definition, modName: pack.modName ?? 'base' })), row => row.definition.id),
    storyDirectoryCharacterOwner: key => owner(key, pack => pack.characters.some(row => row.id === key)),
    storyDirectoryContentOwner: (key, kind) => owner(key, pack => (kind === 'story' ? pack.stories : [...pack.activeStories, ...pack.passiveStories]).some(row => row.id === key)),
    inits: index(pack => pack.inits, id),
    areas: index(pack => pack.areas, id),
    areaMaps: index(pack => pack.areaMaps, id),
    spots: index(pack => pack.spots, id),
    enhancements: index(pack => pack.enhancements, id),
    funcletDefs: index(pack => pack.funcletDefs, id),
    items: index(pack => pack.items, id),
    characters: index(pack => pack.characters, id),
    characterVariants: index(pack => pack.characterVariants, id),
    pics: index(pack => pack.pics, id),
    gachaPools: index(pack => pack.gachaPools, id),
    shops: index(pack => pack.shops, id),
    operationEvents: index(pack => pack.operationEvents, id),
    studentOperationProfiles: index(pack => pack.studentOperationProfiles, id),
    colorGroups: index(pack => pack.colorGroups, id),
    colorEquipments: index(pack => pack.colorEquipments, id),
    resourceDisplays: index(pack => pack.resourceDisplays, row => row.resourceId),
  };
}
