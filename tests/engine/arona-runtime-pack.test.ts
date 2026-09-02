import { describe, expect, test } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import type { PackManagerSnapshot } from '../../src/data-services/datapack/pack-manager';

describe('AronaClickerRuntime PackManager 接线', () => {
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
    expect(restored.packManager.listPacks().map(pack => pack.id)).toEqual(['demo@1.0.0']);
    restored.setPackEnabled('demo@1.0.0', true);
    await Promise.resolve();
    expect((snapshot as PackManagerSnapshot | null)?.enabledIds).toEqual(['demo@1.0.0']);
  });
});
