import { describe, expect, test } from 'vitest';
import { PackManager, PackManagerError, type StoredPack } from '../../src/data-services/datapack/pack-manager';
import { JsonPackSnapshotStore } from '../../src/data-services/datapack/pack-storage';

function pack(id: string, modName: string): StoredPack {
  return {
    id,
    manifest: { modName, name: modName, version: '1.0.0', dependencies: [] },
    datapack: { name: modName, version: '1.0.0', inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], characters: [], characterBonuses: [], funcletDefs: [] },
    images: [], sourceKind: 'zip', importedAt: 1,
  };
}

describe('PackManager', () => {
  test('通过快照存储恢复包库、启用集与顺序', () => {
    const storage = new JsonPackSnapshotStore(new MemoryStorage());
    const manager = new PackManager(undefined, storage);
    manager.importPack(pack('a', 'alpha'));
    manager.setEnabled('a', true);
    const restored = new PackManager(undefined, storage);
    expect(restored.snapshot().enabledIds).toEqual(['a']);
    expect(restored.listPacks().map(item => item.id)).toEqual(['a']);
  });

  test('导入、启用、排序与快照', () => {
    const manager = new PackManager();
    manager.importPack(pack('a', 'alpha'));
    manager.importPack(pack('b', 'beta'));
    manager.setEnabled('b', true);
    manager.setEnabled('a', true);
    manager.reorder(['b', 'a']);
    expect(manager.enabledPacks().map(item => item.name)).toEqual(['beta', 'alpha']);
    expect(manager.snapshot().enabledIds).toEqual(['b', 'a']);
  });

  test('启用同 modName 的两个包时拒绝并回滚', () => {
    const manager = new PackManager();
    manager.importPack(pack('v1', 'same-mod'));
    manager.importPack(pack('v2', 'same-mod'));
    manager.setEnabled('v1', true);
    expect(() => manager.setEnabled('v2', true)).toThrow(PackManagerError);
    expect(manager.snapshot().enabledIds).toEqual(['v1']);
  });

  test('删除包会同步清理启用集与排序', () => {
    const manager = new PackManager();
    manager.importPack(pack('a', 'alpha'));
    manager.setEnabled('a', true);
    manager.removePack('a');
    expect(manager.snapshot()).toEqual({ packs: [], enabledIds: [], order: [] });
  });

  test('按启用集顺序应用到 Runtime，并按 manifest modName 登记图片', () => {
    const manager = new PackManager();
    const alpha = pack('a', 'alpha');
    const beta = pack('b', 'beta');
    manager.importPack(alpha);
    manager.importPack(beta);
    manager.setEnabled('a', true);
    manager.setEnabled('b', true);
    manager.reorder(['b', 'a']);
    const calls: string[] = [];
    manager.applyEnabled({
      reload: datapacks => calls.push('reload:' + datapacks.map(item => item.name).join(',')),
      clearImages: () => calls.push('clear'),
      registerImages: modName => calls.push('images:' + modName),
    });
    expect(calls).toEqual(['reload:beta,alpha', 'clear', 'images:beta', 'images:alpha']);
  });

  test('预校验失败时不 reload、不触碰图片资源', () => {
    const manager = new PackManager();
    manager.importPack(pack('a', 'alpha'));
    manager.setEnabled('a', true);
    const calls: string[] = [];
    expect(() => manager.applyEnabled({
      validate: () => { throw new Error('invalid pack'); },
      reload: () => calls.push('reload'),
      clearImages: () => calls.push('clear'),
      registerImages: () => calls.push('images'),
    })).toThrow('invalid pack');
    expect(calls).toEqual([]);
  });

  test('依赖提示区分已启用、已安装未启用与缺失', () => {
    const manager = new PackManager();
    const root = pack('root', 'root-mod');
    const dependency = pack('dep', 'dep-mod');
    root.manifest.dependencies.push('dep-mod', 'missing-mod');
    manager.importPack(root);
    manager.importPack(dependency);
    manager.setEnabled('root', true);
    expect(manager.dependencyHints()).toEqual([
      { packId: 'root', dependency: 'dep-mod', status: 'available' },
      { packId: 'root', dependency: 'missing-mod', status: 'missing' },
    ]);
    manager.setEnabled('dep', true);
    expect(manager.dependencyHints()[0].status).toBe('enabled');
  });
});

class MemoryStorage {
  private values = new Map<string, string>();
  get(key: string): string | null { return this.values.get(key) ?? null; }
  set(key: string, value: string): void { this.values.set(key, value); }
  remove(key: string): void { this.values.delete(key); }
}
