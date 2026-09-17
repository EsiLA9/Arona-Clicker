import { describe, expect, test } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { defaultDatapack } from '../../src/arona-clicker/content';
import type { PackManagerSnapshot, StoredPack } from '../../src/data-services/datapack/pack-manager';
import type { Datapack } from '../../src/data-services/contracts/datapack';

class CountingRuntime extends AronaClickerRuntime {
  reloadCount = 0;

  override reloadPreservingState(datapacks: Datapack[]): void {
    this.reloadCount += 1;
    super.reloadPreservingState(datapacks);
  }
}

function legacyInvalidPack(): StoredPack {
  return {
    id: 'addition-test@0.1.0',
    manifest: { modName: 'addition-test', name: 'Addition Test', version: '0.1.0', dependencies: [] },
    datapack: {
      name: 'Addition Test', version: '0.1.0', inits: [], areas: [],
      spots: [{
        id: 'addition-test:spot:scanner', areaId: 'base:area:schale_main', name: 'Scanner', description: '',
      } as never],
      enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], characters: [], funcletDefs: [],
    },
    images: [], sourceKind: 'zip', importedAt: 1,
  };
}

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
        modName: 'demo', name: 'Demo', version: '1.0.0', inits: [], areas: [], spots: [], enhancements: [],
        activeStories: [], passiveStories: [], stories: [], items: [], characters: [],
         funcletDefs: [],
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

  test('启用集含失效非 base 包时自动停用该包并保留包库记录', () => {
    const invalidPack = legacyInvalidPack();
    let saved: PackManagerSnapshot | null = null;
    const initial: PackManagerSnapshot = {
      packs: [invalidPack],
      enabledIds: ['base@1.0.0', 'addition-test@0.1.0'],
      order: ['base@1.0.0', 'addition-test@0.1.0'],
    };
    const game = new AronaClickerRuntime({
      packStore: {
        load: () => initial,
        save: snapshot => { saved = snapshot; },
        clear: () => { saved = null; },
      },
    });

    expect(() => game.applyEnabledPacks()).not.toThrow();
    expect(game.registry.inits.has('base:init:schale_office')).toBe(true);
    expect(game.registry.spots.has('addition-test:spot:scanner')).toBe(false);
    expect(game.getPackCatalog().entries.find(entry => entry.id === invalidPack.id)?.enabled).toBe(false);
    expect(game.packManager.listPacks().map(pack => pack.id)).toEqual(['base@1.0.0', invalidPack.id]);
    expect((saved as PackManagerSnapshot | null)?.enabledIds).toEqual(['base@1.0.0']);
  });

  test('异步恢复后也会持久化自动停用结果', async () => {
    const invalidPack = legacyInvalidPack();
    let snapshot: PackManagerSnapshot = {
      packs: [invalidPack],
      enabledIds: ['base@1.0.0', invalidPack.id],
      order: ['base@1.0.0', invalidPack.id],
    };
    const store = {
      load: async () => snapshot,
      save: async (next: PackManagerSnapshot) => { snapshot = next; },
      clear: async () => undefined,
    };
    const game = new AronaClickerRuntime();
    await game.restorePackManager(store);

    expect(() => game.applyEnabledPacks()).not.toThrow();
    expect(snapshot.enabledIds).toEqual(['base@1.0.0']);
    expect(game.getPackCatalog().entries.find(entry => entry.id === invalidPack.id)?.enabled).toBe(false);
  });

  test('默认产品包包含卡池所引用的角色差分', () => {
    const game = new AronaClickerRuntime();

    expect(() => game.init([defaultDatapack])).not.toThrow();
    expect(game.registry.characterVariants.has('Arona')).toBe(true);
  });

  test('一个临时 Mod 可批量应用多个 Spot，并保留挂起 Spot 的 Draft 记录', () => {
    const game = new CountingRuntime();
    game.init([defaultDatapack]);
    const draft = {
      modName: 'draft-mod',
      displayName: 'Draft Mod',
      version: '1.0.0',
      author: '',
      description: '',
      spots: [
        {
          idName: 'spot-a', areaId: 'base:area:schale_main', name: 'Spot A', description: '', purchaseOptions: [{ id: 'free', costs: [] }],
        },
        {
          idName: 'spot-b', areaId: 'base:area:schale_main', name: 'Spot B', description: '', purchaseOptions: [{ id: 'free', costs: [] }],
        },
      ],
      suspendedSpotIds: [],
    };

    expect(game.applyRuntimeMod(draft)).toMatchObject({ ok: true });
    expect(game.reloadCount).toBe(1);
    expect(game.registry.spots.has('draft-mod:spot:spot-a')).toBe(true);
    expect(game.registry.spots.has('draft-mod:spot:spot-b')).toBe(true);
    expect(game.getRuntimeMod()?.spots).toHaveLength(2);

    expect(game.applyRuntimeMod({ ...draft, suspendedSpotIds: ['spot-a'] })).toMatchObject({ ok: true });
    expect(game.reloadCount).toBe(2);
    expect(game.registry.spots.has('draft-mod:spot:spot-a')).toBe(false);
    expect(game.registry.spots.has('draft-mod:spot:spot-b')).toBe(true);
    expect(game.getRuntimeMod()?.spots).toHaveLength(2);
    expect(game.getRuntimeMod()?.suspendedSpotIds).toEqual(['spot-a']);

    expect(game.applyRuntimeMod(draft)).toMatchObject({ ok: true });
    expect(game.reloadCount).toBe(3);
    expect(game.registry.spots.has('draft-mod:spot:spot-a')).toBe(true);
  });

  test('临时 Mod 的重复 Spot ID 在重载前失败并保留旧 Runtime', () => {
    const game = new AronaClickerRuntime();
    game.init([defaultDatapack]);
    const spot = {
      idName: 'spot-a', areaId: 'base:area:schale_main', name: 'Spot A', description: '', purchaseOptions: [{ id: 'free', costs: [] }],
    };
    const valid = { modName: 'draft-mod', displayName: 'Draft Mod', version: '1.0.0', author: '', description: '', spots: [spot], suspendedSpotIds: [] };
    expect(game.applyRuntimeMod(valid).ok).toBe(true);
    const result = game.applyRuntimeMod({ ...valid, spots: [spot, { ...spot, name: 'Duplicate' }] });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('重复 Spot ID');
    expect(game.registry.spots.get('draft-mod:spot:spot-a')?.name).toBe('Spot A');
    expect(game.getRuntimeMod()?.spots).toHaveLength(1);
  });

  test('登记并应用启用包到 reload 与图片资源', () => {
    const game = new AronaClickerRuntime();
    game.registerParsedPack({
      manifest: { modName: 'demo', name: 'Demo', version: '1.0.0', dependencies: [] },
      datapack: {
        name: 'Demo', version: '1.0.0', inits: [], areas: [], spots: [], enhancements: [],
        activeStories: [], passiveStories: [], stories: [], items: [], characters: [],
         funcletDefs: [],
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
      datapack: { name: 'Demo', version: '1.0.0', inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], characters: [],  funcletDefs: [] },
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

  test('异步恢复后应用启用集会持久化策略且下一次启动自动加载', async () => {
    const demoId = 'demo@1.0.0';
    const demoPack = {
      id: demoId,
      manifest: { modName: 'demo', name: 'Demo', version: '1.0.0', dependencies: [] },
      datapack: {
        modName: 'demo', name: 'Demo', version: '1.0.0', inits: [], areas: [], spots: [], enhancements: [],
        activeStories: [], passiveStories: [], stories: [], items: [], characters: [], funcletDefs: [],
      },
      images: [], sourceKind: 'zip' as const, importedAt: 1,
    };
    let snapshot: PackManagerSnapshot = {
      packs: [demoPack],
      enabledIds: ['base@1.0.0'],
      order: ['base@1.0.0', demoId],
    };
    const store = {
      load: async () => snapshot,
      save: async (next: PackManagerSnapshot) => { snapshot = next; },
      clear: async () => undefined,
    };
    const restored = new AronaClickerRuntime();
    await restored.restorePackManager(store);

    expect(restored.applyPackConfiguration({
      enabledIds: ['base@1.0.0', demoId],
      order: ['base@1.0.0', demoId],
    }).ok).toBe(true);
    await Promise.resolve();
    expect(snapshot.enabledIds).toEqual(['base@1.0.0', demoId]);

    const nextBoot = new AronaClickerRuntime();
    await nextBoot.restorePackManager(store);
    nextBoot.applyEnabledPacks();
    expect(nextBoot.registry.loadedModNames.has('demo')).toBe(true);
  });
});
