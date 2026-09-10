import { describe, expect, test } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { defaultDatapack } from '../../src/arona-clicker/content';
import type { PackManagerSnapshot } from '../../src/data-services/datapack/pack-manager';

describe('AronaClickerRuntime PackManager 接线', () => {
  test('base 作为内置数据包进入包库并始终参与启用集', () => {
    const game = new AronaClickerRuntime();
    const base = game.getPackCatalog().entries.find(entry => entry.modName === 'base');

    expect(base).toMatchObject({ id: 'base@1.0.0', sourceKind: 'builtin', enabled: true, capabilities: { required: true, removable: false, enableable: false } });
    expect(() => game.setPackEnabled('base@1.0.0', false)).toThrow('内置数据包不可停用');
    expect(() => game.packManager.removePack('base@1.0.0')).toThrow('内置数据包不可删除');
  });

  test('未启用包可从包库移除；已启用包、内置包与未知包被拒绝', () => {
    const game = new AronaClickerRuntime();
    const parsed = {
      manifest: { modName: 'demo', name: 'Demo', version: '1.0.0', dependencies: [] },
      datapack: {
        name: 'Demo', version: '1.0.0', inits: [], areas: [], spots: [], enhancements: [],
        activeStories: [], passiveStories: [], stories: [], items: [], characters: [],
        characterBonuses: [], funcletDefs: [],
      },
      images: [], jsonFileCount: 1, ignoredCount: 0,
    };
    game.registerParsedPack(parsed);
    expect(game.getPackCatalog().entries.map(entry => entry.id)).toContain('demo@1.0.0');

    game.removePack('demo@1.0.0');
    expect(game.getPackCatalog().entries.map(entry => entry.id)).not.toContain('demo@1.0.0');

    game.registerParsedPack(parsed);
    game.setPackEnabled('demo@1.0.0', true);
    expect(() => game.removePack('demo@1.0.0')).toThrow('请先将该数据包移出启用集');
    expect(() => game.removePack('base@1.0.0')).toThrow('内置数据包不可删除');
    expect(() => game.removePack('missing@1.0.0')).toThrow('不存在的数据包');
  });

  test('默认启动通过启用集加载 base，而不是绕过 PackManager', () => {
    const game = new AronaClickerRuntime();
    game.applyEnabledPacks();

    expect(game.registry.inits.has('base:init:schale_office')).toBe(true);
    expect(game.packManager.snapshot().enabledIds).toEqual(['base@1.0.0']);
    expect(game.state.activeInit).toBe('');
    expect(game.running).toBe(false);
  });

  test('默认产品包包含卡池所引用的角色差分', () => {
    const game = new AronaClickerRuntime();

    expect(() => game.init([defaultDatapack])).not.toThrow();
    expect(game.registry.characterVariants.has('Arona')).toBe(true);
  });

  test('登记并应用启用包到 reload 与图片资源', () => {
    const game = new AronaClickerRuntime();
    game.registerParsedPack({
      manifest: { modName: 'demo', name: 'Demo', version: '1.0.0', dependencies: [] },
      datapack: {
        name: 'Demo', version: '1.0.0', inits: [], areas: [], spots: [], enhancements: [],
        activeStories: [], passiveStories: [], stories: [], items: [], characters: [],
        characterBonuses: [], funcletDefs: [],
        pics: [{ id: 'demo:avatar(pic):x', src: 'zip:x.png' }],
      },
      images: [{ path: 'x.png', url: 'data:image/png;base64,x' }],
      jsonFileCount: 1,
      ignoredCount: 0,
    });
    game.packManager.setEnabled('demo@1.0.0', true);
    game.applyEnabledPacks();

    expect(game.registry.pics.has('demo:avatar(pic):x')).toBe(true);
    expect(game.pics.urlOf('demo:avatar(pic):x')).toBe('data:image/png;base64,x');
  });

  test('支持异步恢复与保存包库快照', async () => {
    let snapshot: PackManagerSnapshot | null = null;
    const store = {
      load: async () => snapshot,
      save: async (value: PackManagerSnapshot) => { snapshot = value; },
      clear: async () => { snapshot = null; },
    };
    const source = new AronaClickerRuntime();
    source.registerParsedPack({
      manifest: { modName: 'demo', name: 'Demo', version: '1.0.0', dependencies: [] },
      datapack: { name: 'Demo', version: '1.0.0', inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], characters: [], characterBonuses: [], funcletDefs: [] },
      images: [], jsonFileCount: 1, ignoredCount: 0,
    });
    await source.savePackManager(store);
    const restored = new AronaClickerRuntime();
    await restored.restorePackManager(store);
    expect(restored.packManager.listPacks().map(pack => pack.id)).toEqual(['base@1.0.0', 'demo@1.0.0']);
    restored.setPackEnabled('demo@1.0.0', true);
    await Promise.resolve();
    expect((snapshot as PackManagerSnapshot | null)?.enabledIds).toEqual(['base@1.0.0', 'demo@1.0.0']);
  });
});
