import { describe, expect, it } from 'vitest';
import { baseDatapack } from '../../../src/data/test-datapack';
import { Registry } from '../../../src/data-services/registry/registry';
import { characterStoryDirectoryId, type StoryDirectoryDef } from '../../../src/data-services/contracts/story-directory';
import { mergeFragments, parseFragment } from '../../../src/data-services/datapack/fragment-parser';
import { emptyStoryAuthoring } from '../../../src/data-services/authoring/story-authoring';
import type { StoryEntryDef } from '../../../src/data-services/contracts/story-entry';
import { AronaClickerRuntime } from '../../../src/arona-clicker/runtime/runtime';
import { buildStoryDirectory, storyHierarchyNodeId, type StoryDirectoryNode } from '../../../src/arona-clicker/content/story/story-directory';
import { finishStory, finishWelcome, makePack, settleStoryPresentation, supplyDetail, supplyEntry, supplyMain } from './story-test-fixtures';

const initId = baseDatapack.inits[0].id;
const character = baseDatapack.characters[0];
const roleId = characterStoryDirectoryId(initId, character.id);
const root: StoryDirectoryDef = { id: 'test:story-directory:root', initId, title: '公开卷', description: '卷首语', public: true };
const chapter: StoryDirectoryDef = { id: 'test:story-directory:chapter', initId, parentId: root.id, title: '第一章' };
const hidden: StoryDirectoryDef = { id: 'test:story-directory:hidden', initId, parentId: root.id, title: '隐藏章' };
const explicitEntry: StoryEntryDef = { ...supplyEntry, directoryPlacements: [{ initId, directoryId: chapter.id }] };
const unseen: StoryEntryDef = { ...supplyEntry, id: 'test:story:behind_chapter', directoryPlacements: [{ initId, directoryId: hidden.id }] };
const unfiled: StoryEntryDef = { ...supplyEntry, id: 'test:story:no_folder' };
const authoredPack = {
  ...makePack([explicitEntry, unseen, unfiled], [{ ...supplyMain, initId, directoryId: root.id }, supplyDetail]),
  modName: 'test',
  storyDirectories: [root, chapter, hidden],
};
const find = (nodes: readonly StoryDirectoryNode[], id: string): StoryDirectoryNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = find(node.children, id);
    if (child) return child;
  }
};

describe('Init story directory', () => {
  it('joins Story, Entry and independent descriptions by Init and path without requiring a definition', () => {
    const registry = new Registry();
    registry.load(baseDatapack);
    const hierarchyString = '角色故事/白子/天台';
    const entry: StoryEntryDef = { ...supplyEntry, directoryPlacements: [{ initId, hierarchyString }] };
    const story = { ...supplyMain, initId, hierarchyString };
    const content = { ...makePack([entry], [story, supplyDetail]), modName: 'test' };
    registry.load(content);
    const id = storyHierarchyNodeId(hierarchyString);
    let tree = buildStoryDirectory(registry, initId);
    expect(tree.nodes.get(id)).toMatchObject({ initId, hierarchyString, title: '天台', stories: [story] });
    expect(tree.entryFolders.get(entry.id)).toBe(tree.nodes.get(id));
    expect(tree.roots.find(row => row.hierarchyString === '角色故事')?.children[0].title).toBe('白子');
    expect(buildStoryDirectory(registry, 'different-init').nodes.has(id)).toBe(false);
    const descriptions = [
      { id: 'zine:story-hierarchy:view', initId, hierarchyString, title: '候选资料', public: true },
      { id: 'album:story-hierarchy:view', initId, hierarchyString, title: '天台档案', description: '卷首语' },
    ];
    for (const definition of descriptions) {
      registry.load({ ...makePack([], []), modName: definition.id.split(':')[0], storyDirectories: [definition] });
    }
    tree = buildStoryDirectory(registry, initId);
    expect(tree.nodes.get(id)).toMatchObject({ title: '天台档案', definition: descriptions[1] });
    expect(tree.entryFolders.get(entry.id)?.id).toBe(id);
    expect(registry.storyDirectories.size).toBe(2);
    const theme = { id: 'zine:themedesign:rooftop', name: '天台主题', theme: { tokens: { primary: '#123456' } } };
    const featured = { ...descriptions[0], primary: 'design' as const, themeDesignId: theme.id };
    const zine = { ...makePack([], []), modName: 'zine' };
    expect(() => registry.load({ ...zine, storyDirectories: [featured] })).toThrow('目录资料无效');
    registry.load({ ...zine, storyDirectories: [featured], themeDesigns: [theme] });
    expect(buildStoryDirectory(registry, initId).entryFolders.get(entry.id)).toMatchObject({ id, definition: featured });
    registry.load({ ...zine, storyDirectories: [{ ...featured, primary: 'path' }] });
    expect(buildStoryDirectory(registry, initId).entryFolders.get(entry.id)).toMatchObject({ id, title: '天台', definition: undefined });
    expect(() => registry.load({ ...content, stories: [{ ...story, hierarchyString: 'a/../b' }, supplyDetail] })).toThrow('层级路径无效');
    expect(() => registry.load({ ...content, passiveStories: [{ ...entry,
      directoryPlacements: [{ initId, hierarchyString, directoryId: chapter.id }],
    }] } as typeof content)).toThrow('层级路径无效');
  });

  it('keeps explicit, automatic and unfiled placements in one tree and round-trips serialized directory data', () => {
    const registry = new Registry();
    const automatic: StoryEntryDef = { ...supplyEntry, id: 'test:story:role_entry', storyId: 'test:story:role_body', owner: character.id };
    const pack = mergeFragments([parseFragment('content.json', JSON.stringify(authoredPack))]);
    registry.load(baseDatapack);
    registry.load({ ...pack, modName: 'test' });
    registry.load({ ...makePack([automatic], [{ ...supplyMain, id: automatic.storyId, nodes: [supplyMain.nodes[0]] }]), modName: 'base' });
    const { nodes, entryFolders } = buildStoryDirectory(registry, initId);
    expect(nodes.get(root.id)?.stories.map(story => story.id)).toEqual([supplyMain.id]);
    expect(entryFolders.get(explicitEntry.id)?.id).toBe(chapter.id);
    expect(entryFolders.get(automatic.id)).toMatchObject({ id: roleId, source: 'AutoCreated', modName: 'base', title: character.displayName });
    expect(entryFolders.get(unfiled.id)?.id).toBe('@unfiled');
    expect(pack.storyDirectories).toEqual(authoredPack.storyDirectories);
    const anotherInit = baseDatapack.inits.find(init => init.id !== initId);
    if (anotherInit) {
      const other = buildStoryDirectory(registry, anotherInit.id);
      expect(other.nodes.has(root.id)).toBe(false);
      expect(other.entryFolders.get(explicitEntry.id)?.id).toBe('@unfiled');
    }
  });

  it('rejects foreign role edits, closed external placements, invalid Init assignments and cycles', () => {
    const registry = new Registry();
    registry.load(baseDatapack);
    registry.load(authoredPack);
    const foreign = (entry: StoryEntryDef) => ({
      ...makePack([entry], [{ ...supplyMain, id: entry.storyId, nodes: [supplyMain.nodes[0]] }]), modName: 'foreign',
    });
    const external: StoryEntryDef = { ...explicitEntry, id: 'foreign:story:entry', storyId: 'foreign:story:body' };
    expect(() => registry.load(foreign(external))).toThrow('未授权');
    expect(() => registry.load({ ...makePack([], []), modName: 'foreign', storyDirectories: [
      { id: roleId, initId, characterId: character.id, title: '外部改写' },
    ] })).toThrow('角色所属 Mod');
    expect(() => registry.load({ ...authoredPack, storyDirectories: [{ ...root, parentId: chapter.id }, chapter, hidden] })).toThrow('循环');
    expect(() => registry.load({ ...authoredPack, passiveStories: [
      { ...explicitEntry, availableInits: ['base:init:absent'] } as (typeof authoredPack.passiveStories)[number],
    ] })).toThrow();
    registry.load({ ...makePack([], []), modName: 'test', storyDirectories: [{ ...chapter, acceptExternalEntries: true }] });
    registry.load(foreign(external));
    expect(buildStoryDirectory(registry, initId).entryFolders.get(external.id)?.id).toBe(chapter.id);
  });

  it('retains a real read across pack disable, a save round trip, and re-enable without exposing the unseen branch', () => {
    const game = new AronaClickerRuntime();
    const recordId = 'test@1.0.0';
    try {
      game.init([baseDatapack]);
      game.packManager.setEnabled('gameplay-b@1.0.0', false);
      game.packManager.importPack({ id: recordId, manifest: { modName: 'test', name: 'Directory Test', version: '1.0.0', dependencies: [] },
        datapack: { ...authoredPack, version: '1.0.0' }, sourceKind: 'zip', importedAt: 1, images: [] });
      game.packManager.setEnabled(recordId, true);
      game.applyEnabledPacks();
      finishWelcome(game);
      expect(find(game.story.getStoryDirectory(), root.id)).toMatchObject({ read: 0, completed: 0 });
      expect(find(game.story.getStoryDirectory(), hidden.id)).toBeUndefined();
      expect(game.story.startStory(explicitEntry.id, 'passive').success).toBe(true);
      settleStoryPresentation(game);
      expect(game.state.storyDirectoryPaths?.[explicitEntry.id]?.folders.map(folder => folder.id)).toEqual([root.id, chapter.id]);
      finishStory(game);
      expect(find(game.story.getStoryDirectory(), root.id)).toMatchObject({ read: 1, completed: 1 });
      game.packManager.setEnabled(recordId, false);
      game.applyEnabledPacks();
      finishWelcome(game);
      game.load(game.save());
      expect(find(game.story.getStoryDirectory(), chapter.id)?.entries).toEqual([
        expect.objectContaining({ id: explicitEntry.id, progress: 'completed', historical: true, canReplay: false }),
      ]);
      expect(find(game.story.getStoryDirectory(), hidden.id)).toBeUndefined();
      game.packManager.setEnabled(recordId, true);
      game.applyEnabledPacks();
      expect(find(game.story.getStoryDirectory(), root.id)).toMatchObject({ read: 1, completed: 1 });
      expect(find(game.story.getStoryDirectory(), chapter.id)?.entries).toEqual([
        expect.objectContaining({ id: explicitEntry.id, progress: 'completed', canReplay: true }),
      ]);
    } finally { game.stop(); }
  });

  it('checks and saves placements against an editable directory before the Mod is loaded', () => {
    const game = new AronaClickerRuntime();
    try {
      game.init([baseDatapack]);
      const copy = game.createEmptyEditingPack({ modId: 'directory-qa', versionId: '1.0.0' });
      expect(copy.ok).toBe(true);
      const packId = copy.packRecordId!;
      const directory = { ...root, id: 'directory-qa:story-directory:volume' };
      expect(game.saveStoryDirectoryToPack(packId, directory).ok).toBe(true);
      const story = { ...supplyMain, id: 'directory-qa:story:body', nodes: [supplyMain.nodes[0]], initId, directoryId: directory.id,
        publicDescription: '正文简介\n第二行' };
      const entry: StoryEntryDef = { ...explicitEntry, id: 'directory-qa:story:source', storyId: story.id,
        publicDescription: '入口简介',
        directoryPlacements: [{ initId, directoryId: directory.id }] };
      const patch = { ...emptyStoryAuthoring(), stories: [story], passiveStories: [entry] } as ReturnType<typeof emptyStoryAuthoring>;
      expect(game.validateStoryAuthoring(patch, packId)).toMatchObject({ ok: true });
      expect(game.getPackRecord(packId)?.datapack.stories).toHaveLength(0);
      expect(game.saveStoryAuthoringToPack(packId, patch)).toMatchObject({ ok: true });
      expect(game.getPackRecord(packId)?.datapack.stories[0].directoryId).toBe(directory.id);
      expect(game.getPackRecord(packId)?.datapack.stories[0].publicDescription).toBe(story.publicDescription);
      expect(game.getPackRecord(packId)?.datapack.passiveStories[0].publicDescription).toBe('入口简介');
      expect(game.getPackRecord(packId)?.datapack.passiveStories[0].directoryPlacements).toEqual(entry.directoryPlacements);
      expect(game.saveStoryDirectoryToPack(packId, directory, true)).toMatchObject({ ok: false });
      expect(game.registry.storyDirectories.has(directory.id)).toBe(false);
      game.packManager.setEnabled(packId, true);
      game.applyEnabledPacks();
      expect(find(game.story.getStoryDirectory(), directory.id)).toMatchObject({ definition: { description: '卷首语' }, entries: [] });
      const hierarchyString = '新卷/第一章';
      const position = [{ initId, hierarchyString }];
      const { directoryId: oldDirectory, ...body } = story;
      const save = game.saveStoryAuthoringToPack(packId, { ...patch, stories: [{ ...body, hierarchyString }],
        passiveStories: [{ ...patch.passiveStories[0], directoryPlacements: position }] });
      expect(save, save.message).toMatchObject({ ok: true });
      const description: StoryDirectoryDef = { id: 'directory-qa:story-hierarchy:chapter', initId, hierarchyString, public: true };
      expect(game.saveStoryDirectoryToPack(packId, description)).toMatchObject({ ok: true });
      game.applyEnabledPacks();
      expect(find(game.story.getStoryDirectory(), storyHierarchyNodeId(hierarchyString))).toMatchObject({ definition: description });
      expect(game.saveStoryDirectoryToPack(packId, description, true)).toMatchObject({ ok: true });
      expect(game.getPackRecord(packId)?.datapack.passiveStories[0].directoryPlacements).toEqual(position);
      game.applyEnabledPacks();
      expect(buildStoryDirectory(game.registry, initId).entryFolders.get(entry.id)).toMatchObject({ id: storyHierarchyNodeId(hierarchyString), title: '第一章' });
    } finally { game.stop(); }
  });

  it('validates a directory batch before writing and refuses removal referenced by an unloaded pack', () => {
    const game = new AronaClickerRuntime();
    try {
      game.init([baseDatapack]);
      const id = game.createEmptyEditingPack({ modId: 'directory-owner', versionId: '1.0.0' }).packRecordId!;
      const volume = { ...root, id: 'directory-owner:story-directory:volume', acceptExternalEntries: true };
      const spare = { ...chapter, id: 'directory-owner:story-directory:spare', parentId: undefined };
      const directories = () => game.getPackRecord(id)!.datapack.storyDirectories;
      expect(game.saveStoryDirectoryToPack(id, [volume, spare]).ok).toBe(true);
      expect(game.saveStoryDirectoryToPack(id, [{ ...volume, parentId: spare.id }, { ...spare, parentId: volume.id }])).toMatchObject({ ok: false });
      expect(directories()).toEqual([volume, spare]);
      const foreignEntry = { ...explicitEntry, id: 'directory-reader:story:entry',
        directoryPlacements: [{ initId, directoryId: volume.id }] };
      game.registerParsedPack({
        manifest: { modName: 'directory-reader', name: '外部收录包', version: '1.0.0', dependencies: ['base', 'directory-owner'] },
        datapack: { ...makePack([foreignEntry], []), modName: 'directory-reader' },
        images: [], jsonFileCount: 1, ignoredCount: 0,
      });
      expect(game.registry.storyEntries.has(foreignEntry.id)).toBe(false);
      expect(game.saveStoryDirectoryToPack(id, volume, true)).toMatchObject({ ok: false, message: expect.stringContaining(foreignEntry.id) });
      expect(directories()).toEqual([volume, spare]);
    } finally { game.stop(); }
  });
});
