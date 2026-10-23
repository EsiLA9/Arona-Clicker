import { describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import { Registry } from '../../src/data-services/registry/registry';
import { createRuntimeContentBrowser } from '../../src/data-services/registry/runtime-content-browser';

function rulesPack(modName: string, suffix: string): Datapack {
  return {
    modName,
    name: modName,
    version: '1.0.0',
    inits: [],
    areas: [],
    spots: [],
    enhancements: [],
    activeStories: [],
    passiveStories: [],
    stories: [],
    items: [],
    funcletDefs: [],
    characters: [],
    affectorPacks: [{
      id: `${modName}:affectorpack:${suffix}`,
      entries: [{ id: `${modName}:entry:${suffix}`, effects: [] }],
    }],
    triggerDefs: [{
      id: `${modName}:trigger:${suffix}`,
      on: { kind: 'tick', every: 5 },
      effects: [],
    }],
  };
}

describe('RuntimeContentBrowser rules sources', () => {
  test('当前 Runtime 已加载的 AffectorPack 与 TriggerDef 进入目录，reload 后旧规则消失', () => {
    const game = new GameInstance();
    const rules = rulesPack('rules-addon', 'loaded');
    const overridingRules = rulesPack('rules-addon', 'loaded');
    overridingRules.affectorPacks![0] = {
      ...overridingRules.affectorPacks![0]!,
      entries: [{ id: 'rules-addon:entry:override', effects: [] }],
    };
    overridingRules.triggerDefs![0] = {
      ...overridingRules.triggerDefs![0]!,
      on: { kind: 'resource', resource: 'base:resource:credit' },
    };
    game.init([baseDatapack, rules, overridingRules], { enterDefaultInit: false });

    const loaded = game.runtimeContentBrowser.getView();
    expect(loaded.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: { definitionKind: 'affectorPacks', fullId: 'rules-addon:affectorpack:loaded' },
      }),
      expect.objectContaining({
        ref: { definitionKind: 'triggerDefs', fullId: 'rules-addon:trigger:loaded' },
      }),
    ]));
    expect(loaded.entries.filter(entry => entry.ref.fullId === 'rules-addon:affectorpack:loaded')).toHaveLength(1);
    expect(loaded.entries.filter(entry => entry.ref.fullId === 'rules-addon:trigger:loaded')).toHaveLength(1);
    expect(game.runtimeContentBrowser.getDefinition({
      definitionKind: 'affectorPacks',
      fullId: 'rules-addon:affectorpack:loaded',
    })?.raw).toEqual(expect.objectContaining({ entries: [{ id: 'rules-addon:entry:override', effects: [] }] }));

    game.reload([baseDatapack], { enterDefaultInit: false });
    const reloaded = game.runtimeContentBrowser.getView();
    expect(reloaded.entries.some(entry => entry.ref.fullId === 'rules-addon:affectorpack:loaded')).toBe(false);
    expect(reloaded.entries.some(entry => entry.ref.fullId === 'rules-addon:trigger:loaded')).toBe(false);
  });

  test('规则枚举入口返回冻结副本，清空后不保留旧定义', () => {
    const game = new GameInstance();
    game.init([baseDatapack, rulesPack('rules-addon', 'snapshot')], { enterDefaultInit: false });

    const packs = game.affectorEngine.getPacks();
    const triggers = game.triggerSystem.getDefinitions();
    expect(Object.isFrozen(packs)).toBe(true);
    expect(Object.isFrozen(packs[0])).toBe(true);
    expect(Object.isFrozen(packs[0]?.entries)).toBe(true);
    expect(Object.isFrozen(triggers)).toBe(true);
    expect(Object.isFrozen(triggers[0])).toBe(true);
    expect(() => {
      (packs[0]!.entries as unknown as unknown[]).push({ id: 'injected', effects: [] });
    }).toThrow();
    expect(() => {
      (triggers as unknown as unknown[]).push({ id: 'injected', on: { kind: 'tick' }, effects: [] });
    }).toThrow();

    game.affectorEngine.clear();
    game.triggerSystem.clear();
    expect(game.affectorEngine.getPacks()).toHaveLength(0);
    expect(game.triggerSystem.getDefinitions()).toHaveLength(0);
  });

  test('规则源 revision 稳定时复用快照，revision 改变时刷新并安全克隆详情', () => {
    const registry = new Registry();
    let revision = 1;
    let calls = 0;
    const definitions = [{ id: 'rules-addon:trigger:cached', on: { kind: 'tick' }, effects: [] }];
    const browser = createRuntimeContentBrowser(registry, {
      triggerDefs: {
        getRevision: () => revision,
        getEntries: () => {
          calls += 1;
          return definitions;
        },
      },
    });

    browser.getView();
    browser.listDefinitions({ kind: 'triggerDefs' });
    browser.getDefinition({ definitionKind: 'triggerDefs', fullId: 'rules-addon:trigger:cached' });
    browser.getReferences({ definitionKind: 'triggerDefs', fullId: 'rules-addon:trigger:cached' });
    expect(calls).toBe(1);

    const detail = browser.getDefinition({ definitionKind: 'triggerDefs', fullId: 'rules-addon:trigger:cached' });
    expect(detail).not.toBeNull();
    expect(Object.isFrozen(detail!.raw)).toBe(true);
    expect(() => {
      (detail!.raw as { id: string }).id = 'changed';
    }).toThrow();

    definitions[0] = { id: 'rules-addon:trigger:next', on: { kind: 'tick' }, effects: [] };
    revision += 1;
    expect(browser.getDefinition({ definitionKind: 'triggerDefs', fullId: 'rules-addon:trigger:cached' })).toBeNull();
    expect(browser.getDefinition({ definitionKind: 'triggerDefs', fullId: 'rules-addon:trigger:next' })).not.toBeNull();
    expect(calls).toBe(2);
  });
});
