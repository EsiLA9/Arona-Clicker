import { describe, expect, test } from 'vitest';
import { PackManager, PackManagerError, type StoredPack } from '../../src/data-services/datapack/pack-manager';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { baseDatapack } from '../../src/data/test-datapack';

function pack(id = 'demo@1.0.0', value = 'original'): StoredPack {
  return {
    id,
    manifest: { modName: 'demo', name: 'Demo', version: '1.0.0', dependencies: [] },
    datapack: {
      name: 'Demo', version: '1.0.0', inits: [], areas: [],
      spots: [{ id: value, areaId: 'base:area:main', name: value, description: '' } as never],
      enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], characters: [], funcletDefs: [],
    },
    images: [], sourceKind: 'zip', importedAt: 1, editingMode: 'normal',
  };
}

describe('Datapack normal/editing records', () => {
  test('普通态完整复制为编辑态，来源保持不变', () => {
    const manager = new PackManager();
    manager.importPack(pack());

    const result = manager.createEditingPack('demo@1.0.0');
    expect(result.kind).toBe('created');
    expect(result.pack.editingMode).toBe('editing');
    expect(result.pack.sourceKind).toBe('editing');
    expect(result.pack.sourcePackRecordId).toBe('demo@1.0.0');
    expect(result.pack.manifest.modName).toBe('demo');
    expect(result.pack.datapack).not.toBe(manager.getPack('demo@1.0.0')?.datapack);
    expect(manager.getPack('demo@1.0.0')?.editingMode).toBe('normal');
    expect(manager.listPacks()).toHaveLength(2);
  });

  test('同一 ModId + VersionId 的普通态和编辑态可以保存，编辑态可进入启用集且仍受 ModName 唯一约束', () => {
    const manager = new PackManager();
    manager.importPack(pack());
    const editing = manager.createEditingPack('demo@1.0.0').pack;

    expect(manager.listPacks().map(item => item.id)).toEqual(['demo@1.0.0', editing.id]);
    manager.setEnabled(editing.id, true);
    expect(manager.enabledPacks()).toEqual([editing.datapack]);
    expect(() => manager.setEnabled('demo@1.0.0', true)).toThrow('modName 冲突');
  });

  test('创建编辑态要求新 Version，并且编辑态转普通态保留为新记录', () => {
    const manager = new PackManager();
    manager.importPack(pack());
    expect(() => manager.createEditingPack('demo@1.0.0', undefined, '1.0.0')).toThrow('必须使用不同于来源的新 Version');
    const editing = manager.createEditingPack('demo@1.0.0', undefined, '1.1.0').pack;
    expect(editing.manifest.version).toBe('1.1.0');
    expect(editing.editingMode).toBe('editing');

    const normal = manager.convertEditingPackToNormal(editing.id);
    expect(normal.manifest.version).toBe('1.1.0');
    expect(normal.editingMode).toBe('normal');
    expect(normal.id).not.toBe(editing.id);
    expect(manager.listPacks()).toHaveLength(3);
    manager.setEnabled(editing.id, true);
    expect(manager.enabledPacks()).toContain(editing.datapack);
  });

  test('相同 ModName、Version 和 Editing 状态可作为独立未启用记录保存', () => {
    const manager = new PackManager();
    manager.importPack(pack());
    manager.importPack(pack('different-record', 'changed'));
    expect(manager.listPacks().map(item => item.id)).toEqual(['demo@1.0.0', 'different-record']);
  });

  test('不同记录身份的同内容数据包仍保留为两条包库记录', () => {
    const manager = new PackManager();
    const original = pack();
    manager.importPack(original);
    const result = manager.importPack({ ...original, id: 'another-record' });
    expect(result.kind).toBe('added');
    expect(manager.listPacks()).toHaveLength(2);
  });
});

describe('AronaClickerRuntime 编辑态数据包接线', () => {
  test('启用序列中的编辑态可打开与保存，并保留原有 Mod 顺序', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    game.packManager.setEnabled('gameplay-b@1.0.0', false);
    const authorPack = pack('author@1.0.0');
    game.packManager.importPack({ ...authorPack, manifest: { ...authorPack.manifest, modName: 'author', name: 'Author' }, datapack: { ...authorPack.datapack, modName: 'author', name: 'Author', spots: [] } });
    const laterPack = pack('later@1.0.0');
    game.packManager.importPack({ ...laterPack, manifest: { ...laterPack.manifest, modName: 'later', name: 'Later' }, datapack: { ...laterPack.datapack, modName: 'later', name: 'Later', spots: [] } });
    game.packManager.setEnabled('author@1.0.0', true);
    game.packManager.setEnabled('later@1.0.0', true);
    game.applyEnabledPacks();

    const copy = game.createEditingPack('author@1.0.0');
    expect(copy.ok).toBe(true);
    const editingId = copy.packRecordId!;
    expect(game.getPackCatalog().entries.find(entry => entry.id === editingId)?.capabilities?.enableable).toBe(true);
    const baseId = game.getPackCatalog().entries.find(entry => entry.modName === 'base')!.id;
    const gameplayBDemoId = game.getPackCatalog().entries.find(entry => entry.modName === 'gameplay-b')!.id;
    game.packManager.reorder([baseId, gameplayBDemoId, 'author@1.0.0', editingId, 'later@1.0.0']);
    game.packManager.setEnabled('author@1.0.0', false);
    game.packManager.setEnabled(editingId, true);
    game.applyEnabledPacks();
    expect(game.getPackCatalog().entries.find(entry => entry.id === editingId)?.editingMode).toBe('editing');
    expect(game.packManager.snapshot().enabledIds).toContain(editingId);

    expect([...game.registry.loadedModNames]).toEqual(['base', 'author', 'later']);
    const opened = game.openEditingPack(editingId);
    expect(opened.ok).toBe(true);
    expect(game.getRuntimeMod()?.targetPackRecordId).toBe(editingId);
    expect([...game.registry.loadedModNames]).toContain('author');
    expect(game.packManager.snapshot().enabledIds).toContain(editingId);
    const wrongTarget = game.applyRuntimeWorldDraft({ modName: 'author', targetPackRecordId: 'author@1.0.0', inits: [], areas: [] });
    expect(wrongTarget.ok).toBe(false);
    expect(wrongTarget.diagnostics[0]?.code).toBe('target-must-be-editing');
    expect(game.applyRuntimeWorldDraft({ modName: 'author', targetPackRecordId: editingId, inits: [], areas: [] }).ok).toBe(true);
    expect(game.getPackRecord(editingId)?.datapack.modName).toBe('author');
    expect([...game.registry.loadedModNames]).toEqual(['base', 'author', 'later']);
  });
});
