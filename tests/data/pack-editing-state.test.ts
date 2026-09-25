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

  test('同一 ModId + VersionId 的普通态和编辑态可以保存，但编辑态不能直接加入启用集', () => {
    const manager = new PackManager();
    manager.importPack(pack());
    const editing = manager.createEditingPack('demo@1.0.0').pack;

    expect(manager.listPacks().map(item => item.id)).toEqual(['demo@1.0.0', editing.id]);
    expect(() => manager.setEnabled(editing.id, true)).toThrow('编辑态数据包不能直接加入启用集');
  });

  test('同一保存三元组内容不同会阻止覆盖', () => {
    const manager = new PackManager();
    manager.importPack(pack());
    expect(() => manager.importPack(pack('different-record', 'changed'))).toThrow('数据包保存冲突');
  });

  test('同一保存三元组内容相同视为幂等', () => {
    const manager = new PackManager();
    const original = pack();
    manager.importPack(original);
    const result = manager.importPack({ ...original, id: 'another-record' });
    expect(result.kind).toBe('idempotent');
    expect(manager.listPacks()).toHaveLength(1);
  });
});

describe('AronaClickerRuntime 编辑态数据包接线', () => {
  test('普通包复制出的编辑态可打开，并在预览时替换同 ModId 普通包', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const authorPack = pack('author@1.0.0');
    game.packManager.importPack({ ...authorPack, manifest: { ...authorPack.manifest, modName: 'author', name: 'Author' }, datapack: { ...authorPack.datapack, modName: 'author', name: 'Author', spots: [] } });
    game.packManager.setEnabled('author@1.0.0', true);
    game.applyEnabledPacks();

    const copy = game.createEditingPack('author@1.0.0');
    expect(copy.ok).toBe(true);
    const editingId = copy.packRecordId!;
    expect(game.getPackCatalog().entries.find(entry => entry.id === editingId)?.editingMode).toBe('editing');
    expect(game.packManager.snapshot().enabledIds).not.toContain(editingId);

    const opened = game.openEditingPack(editingId);
    expect(opened.ok).toBe(true);
    expect(game.getRuntimeMod()?.targetPackRecordId).toBe(editingId);
    expect([...game.registry.loadedModNames]).toContain('author');
    expect(game.packManager.snapshot().enabledIds).toContain('author@1.0.0');
    const wrongTarget = game.applyRuntimeWorldDraft({ modName: 'author', targetPackRecordId: 'author@1.0.0', inits: [], areas: [] });
    expect(wrongTarget.ok).toBe(false);
    expect(wrongTarget.diagnostics[0]?.code).toBe('target-must-be-editing');
    expect(game.applyRuntimeWorldDraft({ modName: 'author', targetPackRecordId: editingId, inits: [], areas: [] }).ok).toBe(true);
    expect(game.getPackRecord(editingId)?.datapack.modName).toBe('author');
  });
});
