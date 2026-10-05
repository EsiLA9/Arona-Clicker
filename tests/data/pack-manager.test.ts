import { describe, expect, test } from 'vitest';
import { PackManager, PackManagerError, type StoredPack } from '../../src/data-services/datapack/pack-manager';
import { JsonPackSnapshotStore } from '../../src/data-services/datapack/pack-storage';

function pack(id: string, modName: string, version = '1.0.0'): StoredPack {
  return {
    id,
    manifest: { modName, name: modName, version, dependencies: [] },
    datapack: { name: modName, version, inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], characters: [], funcletDefs: [] },
    images: [], sourceKind: 'zip', importedAt: 1,
  };
}

describe('PackManager', () => {
  test('首次发布的可选内置包可默认启用，之后保留玩家停用选择', () => {
    const base = { ...pack('base@1.0.0', 'base'), sourceKind: 'bundle' as const };
    const demo = {
      ...pack('gameplay-b@1.0.0', 'gameplay-b'),
      sourceKind: 'bundle' as const,
      manifest: { ...pack('gameplay-b@1.0.0', 'gameplay-b').manifest, dependencies: ['base'] },
    };
    const defaults = [base, demo];
    const firstInstall = new PackManager(undefined, undefined, defaults, ['gameplay-b@1.0.0']);
    expect(firstInstall.configuration().enabledIds).toEqual(['base@1.0.0', 'gameplay-b@1.0.0']);

    firstInstall.setEnabled('gameplay-b@1.0.0', false);
    const restored = new PackManager(firstInstall.snapshot(), undefined, defaults, ['gameplay-b@1.0.0']);
    expect(restored.configuration().enabledIds).toEqual(['base@1.0.0']);
  });

  test('已有 Pane 明确选择 none 时不默认启用新内置包', () => {
    const base = { ...pack('base@1.0.0', 'base'), sourceKind: 'bundle' as const };
    const demo = {
      ...pack('gameplay-b@1.0.0', 'gameplay-b'),
      sourceKind: 'bundle' as const,
      manifest: { ...pack('gameplay-b@1.0.0', 'gameplay-b').manifest, dependencies: ['base'] },
    };
    const manager = new PackManager({
      packs: [],
      enabledIds: [],
      order: [],
      selectedSlots: { 'gameplay-b@1.0.0': 'none' },
    }, undefined, [base, demo], ['gameplay-b@1.0.0']);
    expect(manager.configuration().enabledIds).toEqual(['base@1.0.0']);
  });

  test('固定来源按路径保存重复身份，首次只自动启用唯一 finished 来源', () => {
    const manager = new PackManager();
    const finished = { ...pack('dev:example-finished', 'example'), sourceKind: 'folder' as const, sourcePath: 'example@1.0@finished/', editingMode: 'normal' as const };
    const editing = { ...pack('dev:example-editing', 'example'), sourceKind: 'folder' as const, sourcePath: 'example@1.0@editing/', editingMode: 'editing' as const };
    manager.reconcileDevelopmentPacks([finished, editing]);
    expect(manager.listPacks().map(item => item.id)).toEqual(['dev:example-finished', 'dev:example-editing']);
    expect(manager.configuration().enabledIds).toEqual(['dev:example-finished']);
  });

  test('重复 ModName 来源不自动启用，已保存的停用选择在启动对账后保留', () => {
    const manager = new PackManager();
    const first = { ...pack('dev:first', 'example'), sourcePath: 'first.zip' };
    const second = { ...pack('dev:second', 'example', '2.0.0'), sourcePath: 'second.zip' };
    manager.reconcileDevelopmentPacks([first, second]);
    expect(manager.configuration().enabledIds).toEqual([]);

    const unique = { ...pack('dev:unique', 'unique'), sourcePath: 'unique.zip' };
    manager.reconcileDevelopmentPacks([unique]);
    expect(manager.configuration().enabledIds).toEqual(['dev:unique']);
    manager.setEnabled('dev:unique', false);
    manager.reconcileDevelopmentPacks([unique]);
    expect(manager.configuration().enabledIds).toEqual([]);
  });

  test('更新同来源内容保留启用选择，来源消失时移除其包库记录', () => {
    const manager = new PackManager();
    const original = { ...pack('dev:source', 'example'), sourcePath: 'example.zip' };
    manager.reconcileDevelopmentPacks([original]);
    const updated = { ...original, datapack: { ...original.datapack, name: 'Changed' } };
    manager.reconcileDevelopmentPacks([updated]);
    expect(manager.getPack(original.id)?.datapack.name).toBe('Changed');
    expect(manager.configuration().enabledIds).toEqual([original.id]);
    manager.reconcileDevelopmentPacks([]);
    expect(manager.getPack(original.id)).toBeUndefined();
    expect(manager.configuration()).toEqual({ enabledIds: [], order: [] });
  });

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

  test('草案校验失败时不改变正式启用集', () => {
    const manager = new PackManager();
    manager.importPack(pack('a', 'same-mod'));
    manager.importPack(pack('b', 'same-mod', '2.0.0'));
    const before = manager.configuration();
    expect(() => manager.validateConfiguration({ enabledIds: ['a', 'b'], order: ['a', 'b'] })).toThrow('modName 冲突');
    expect(manager.configuration()).toEqual(before);
  });

  test('base 槽位必需但可由另一个 base 记录替换', () => {
    const bundled = { ...pack('base@1', 'base'), sourceKind: 'bundle' as const };
    const editing = { ...pack('base@2-editing', 'base', '2.0.0'), sourceKind: 'editing' as const, editingMode: 'editing' as const };
    const manager = new PackManager(undefined, undefined, [bundled]);
    manager.importPack(editing);
    expect(() => manager.validateConfiguration({ enabledIds: [], order: ['base@1', 'base@2-editing'] })).toThrow('必须保留一个 base');
    expect(() => manager.validateConfiguration({ enabledIds: ['base@1', 'base@2-editing'], order: ['base@1', 'base@2-editing'] })).toThrow('modName 冲突');
    expect(() => manager.validateConfiguration({ enabledIds: ['base@2-editing'], order: ['base@2-editing', 'base@1'] })).not.toThrow();
    expect(manager.configuration().enabledIds).toEqual(['base@1']);
  });

  test('恢复快照时新增的发布 base 版本不会抢占用户已选版本', () => {
    const previous = { ...pack('base@1.0.0', 'base', '1.0.0'), sourceKind: 'bundle' as const };
    const selected = { ...pack('base@1.1.0-editing', 'base', '1.1.0'), sourceKind: 'editing' as const, editingMode: 'editing' as const };
    const nextRelease = { ...pack('base@2.0.0', 'base', '2.0.0'), sourceKind: 'bundle' as const };
    const restored = new PackManager({
      packs: [previous, selected],
      enabledIds: [selected.id],
      order: [selected.id, previous.id],
    }, undefined, [nextRelease]);

    expect(restored.configuration().enabledIds).toEqual([selected.id]);
    expect(restored.getPack(nextRelease.id)?.manifest.version).toBe('2.0.0');
    expect(restored.enabledPacks()).toEqual([selected.datapack]);
  });

  test('恢复快照时新发布版替换旧 bundle，保留编辑态副本', () => {
    const previous = { ...pack('base@1.0.0', 'base', '1.0.0'), sourceKind: 'bundle' as const };
    const editing = {
      ...pack('editing:base@1.0.0', 'base', '1.0.1'),
      sourceKind: 'editing' as const,
      editingMode: 'editing' as const,
    };
    const current = { ...pack('base@1.0.2', 'base', '1.0.2'), sourceKind: 'bundle' as const };
    const restored = new PackManager({
      packs: [previous, editing],
      enabledIds: [previous.id],
      order: [previous.id, editing.id],
    }, undefined, [current]);

    expect(restored.getPack(previous.id)).toBeUndefined();
    expect(restored.getPack(editing.id)).toBeDefined();
    expect(restored.configuration().enabledIds).toEqual([current.id]);
  });

  test('恢复快照时同身份发布 bundle 刷新为当前打包内容，保留编辑态副本与选择', () => {
    const oldBundle = {
      ...pack('base@1.0.0', 'base', '1.0.0'),
      sourceKind: 'bundle' as const,
      datapack: { ...pack('base@1.0.0', 'base').datapack, name: 'old-bundle' },
    };
    const editing = {
      ...pack('editing:base@1.0.0', 'base', '1.0.0'),
      sourceKind: 'editing' as const,
      editingMode: 'editing' as const,
      datapack: { ...oldBundle.datapack, name: 'editing-copy' },
    };
    const currentBundle = {
      ...pack('base@1.0.0', 'base', '1.0.0'),
      sourceKind: 'bundle' as const,
      importedAt: 2,
      datapack: { ...pack('base@1.0.0', 'base').datapack, name: 'current-bundle' },
    };
    const restored = new PackManager({
      packs: [oldBundle, editing],
      enabledIds: [oldBundle.id],
      order: [oldBundle.id, editing.id],
    }, undefined, [currentBundle]);

    expect(restored.getPack(oldBundle.id)?.datapack.name).toBe('current-bundle');
    expect(restored.getPack(oldBundle.id)?.importedAt).toBe(oldBundle.importedAt);
    expect(restored.getPack(editing.id)?.datapack.name).toBe('editing-copy');
    expect(restored.configuration().enabledIds).toEqual([oldBundle.id]);
  });

  test('草案校验要求依赖位于启用序列内', () => {
    const root = pack('root', 'root-mod');
    root.manifest.dependencies.push('dep-mod');
    const dependency = pack('dep', 'dep-mod');
    const manager = new PackManager(undefined, undefined, []);
    manager.importPack(root);
    manager.importPack(dependency);
    expect(() => manager.validateConfiguration({ enabledIds: ['root'], order: ['root', 'dep'] })).toThrow('缺少启用依赖');
  });

  test('草案应用成功后才提交正式启用集', () => {
    const manager = new PackManager();
    manager.importPack(pack('a', 'alpha'));
    manager.importPack(pack('b', 'beta'));
    const calls: string[] = [];
    manager.applyConfiguration({ enabledIds: ['b'], order: ['b', 'a'] }, {
      reload: datapacks => calls.push('reload:' + datapacks.map(item => item.name).join(',')),
      clearImages: () => calls.push('clear'),
      registerImages: modName => calls.push('images:' + modName),
    });
    expect(calls).toEqual(['reload:beta', 'clear', 'images:beta']);
    expect(manager.configuration()).toEqual({ enabledIds: ['b'], order: ['b', 'a'] });
  });

  test('草案应用 reload 失败时保留旧正式启用集', () => {
    const manager = new PackManager();
    manager.importPack(pack('a', 'alpha'));
    manager.setEnabled('a', true);
    expect(() => manager.applyConfiguration({ enabledIds: [], order: ['a'] }, {
      reload: () => { throw new Error('reload failed'); },
      clearImages: () => undefined,
      registerImages: () => undefined,
    })).toThrow('reload failed');
    expect(manager.configuration()).toEqual({ enabledIds: ['a'], order: ['a'] });
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
