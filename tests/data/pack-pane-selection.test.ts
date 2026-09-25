import { describe, expect, test } from 'vitest';
import {
  PackManager,
  PackManagerError,
  datapackPaneKey,
  type DatapackIdentity,
  type StoredPack,
} from '../../src/data-services/datapack/pack-manager';

function pack(id: string, modName: string, version = '1.0.0', value = id): StoredPack {
  return {
    id,
    manifest: { modName, name: modName, version, dependencies: [] },
    datapack: {
      modName,
      name: modName,
      version,
      inits: [],
      areas: [],
      spots: [{ id: value, areaId: 'base:area:main', name: value, description: '' } as never],
      enhancements: [],
      activeStories: [],
      passiveStories: [],
      stories: [],
      items: [],
      characters: [],
      funcletDefs: [],
    },
    images: [],
    sourceKind: 'zip',
    importedAt: 1,
  };
}

describe('Datapack Pane / Selection / RuntimeApplyPlan', () => {
  test('同身份 fixed 与 editing 形成一个 Pane，创建编辑态不改变选择', () => {
    const manager = new PackManager();
    manager.importPack(pack('demo@1', 'demo'));
    const paneKey = datapackPaneKey({ modId: 'demo', versionId: '1.0.0' });
    manager.setSelectedSlot(paneKey, 'fixed');
    const before = manager.selections();

    const editing = manager.createEditingPack('demo@1').pack;
    const pane = manager.panes()[0];
    expect(pane.paneKey).toBe(paneKey);
    expect(pane.fixedSlot?.kind).toBe('fixed');
    expect(pane.editingSlot?.kind).toBe('editing');
    expect(editing.datapack).not.toBe(pane.fixedSlot?.content);
    expect(manager.selections()).toEqual(before);
  });

  test('没有 fixed 时允许创建空 editing，但 fixed 存在时拒绝空创建', () => {
    const manager = new PackManager();
    const identity: DatapackIdentity = { modId: 'empty', versionId: '1.0.0' };
    const result = manager.createEmptyEditing(identity);
    expect(result.pack.datapack.spots).toEqual([]);
    expect(manager.selections()[0].selectedSlot).toBe('none');
    expect(() => manager.createEmptyEditing(identity)).toThrow('编辑态数据包已存在');

    manager.importFixed(pack('empty-fixed', 'empty', '1.0.0', 'fixed'));
    expect(() => manager.createEmptyEditing(identity)).toThrow('必须从已有内容复制');
  });

  test('编辑态可以 Fork 到新版本，目标只有 editing，不复制 fixed', () => {
    const manager = new PackManager();
    manager.importPack(pack('demo@1', 'demo'));
    const editing = manager.createEditingPack('demo@1').pack;
    const fork = manager.cloneAsEditing(editing.id, { modId: 'demo', versionId: '2.0.0' });
    const pane = manager.panes().find(item => item.paneKey === 'demo@2.0.0');
    expect(fork.kind).toBe('created');
    expect(pane?.fixedSlot).toBeUndefined();
    expect(pane?.editingSlot?.versionId).toBe('2.0.0');
    expect(manager.getPack('demo@1')?.manifest.version).toBe('1.0.0');
  });

  test('选择态持久化且与 Runtime 状态分离，Apply 失败保留旧 Runtime', () => {
    const manager = new PackManager();
    manager.importPack(pack('demo@1', 'demo', '1.0.0'));
    const editing = manager.createEditingPack('demo@1').pack;
    const paneKey = 'demo@1.0.0';
    manager.setSelectedSlot(paneKey, 'fixed');
    manager.applySelection({
      reload: () => undefined,
      clearImages: () => undefined,
      registerImages: () => undefined,
    });
    expect(manager.runtimeState().get(paneKey)).toBe('demo@1');

    manager.setSelectedSlot(paneKey, 'editing');
    expect(manager.runtimeState().get(paneKey)).toBe('demo@1');
    const restored = new PackManager(manager.snapshot());
    expect(restored.selections().find(item => item.paneKey === paneKey)?.selectedSlot).toBe('editing');
    expect(restored.runtimeState().size).toBe(0);

    expect(() => restored.applySelection({
      validate: () => { throw new Error('invalid content'); },
      reload: () => undefined,
      clearImages: () => undefined,
      registerImages: () => undefined,
    })).toThrow('invalid content');
    expect(restored.runtimeState().size).toBe(0);
    expect(restored.getPack(editing.id)?.editingMode).toBe('editing');
  });

  test('目标支持回滚快照时，reload 后的资源登记失败也恢复旧 Runtime', () => {
    const manager = new PackManager();
    manager.importPack(pack('demo@1', 'demo'));
    manager.setSelectedSlot('demo@1.0.0', 'fixed');
    let loaded = 'old';
    manager.applySelection({
      reload: () => { loaded = 'old'; },
      clearImages: () => undefined,
      registerImages: () => undefined,
    });
    manager.setSelectedSlot('demo@1.0.0', 'none');
    manager.setSelectedSlot('demo@1.0.0', 'fixed');
    expect(manager.runtimeState().get('demo@1.0.0')).toBe('demo@1');
    expect(() => manager.applySelection({
      capture: () => loaded,
      restore: snapshot => { loaded = snapshot as string; },
      reload: () => { loaded = 'new'; },
      clearImages: () => { throw new Error('image registration failed'); },
      registerImages: () => undefined,
    })).toThrow('image registration failed');
    expect(loaded).toBe('old');
    expect(manager.runtimeState().get('demo@1.0.0')).toBe('demo@1');
  });

  test('同一 ModId 的不同 VersionId 不能同时进入一次 Runtime Apply', () => {
    const manager = new PackManager();
    manager.importPack(pack('demo@1', 'demo', '1.0.0'));
    manager.importPack(pack('demo@2', 'demo', '2.0.0'));
    manager.setSelectedSlot('demo@1.0.0', 'fixed');
    manager.setSelectedSlot('demo@2.0.0', 'fixed');
    expect(() => manager.buildRuntimeApplyPlan()).toThrow(PackManagerError);
    expect(() => manager.buildRuntimeApplyPlan()).toThrow('ModId 冲突');
  });

  test('编辑态导出为 fixed 快照，不修改本地记录', () => {
    const manager = new PackManager();
    manager.importPack(pack('demo@1', 'demo'));
    const editing = manager.createEditingPack('demo@1').pack;
    const exported = manager.exportPack(editing.id, { versionId: '2.0.0' });
    expect(exported.editingMode).toBe('normal');
    expect(exported.sourceKind).toBe('zip');
    expect(exported.manifest.version).toBe('2.0.0');
    expect(manager.getPack(editing.id)?.editingMode).toBe('editing');
  });
});
