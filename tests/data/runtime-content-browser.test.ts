import { describe, expect, test } from 'vitest';
import { extra } from '../../src/engine/types';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { ContentCatalogQueryPort } from '../../src/arona-clicker/contracts/runtime/content-catalog';
import { baseDatapack } from '../../src/data/test-datapack';
import { Registry } from '../../src/data-services/registry/registry';
import {
  createRuntimeContentBrowser,
  filterRuntimeContentDefinitions,
} from '../../src/data-services/registry/runtime-content-browser';

function emptyPack(
  modName: string,
  items: Datapack['items'],
  overrides: Partial<Pick<Datapack, 'characters' | 'charaProfiles'>> = { characters: [] },
): Datapack {
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
    items,
    funcletDefs: [],
    characters: overrides.characters ?? [],
    charaProfiles: overrides.charaProfiles,
  };
}

function createRegistry(): Registry {
  const baseItem = baseDatapack.items[0];
  if (!baseItem) throw new Error('base datapack must contain an item');

  const extensionItem = {
    ...baseItem,
    id: 'extension:item:loaded',
    name: '已加载扩展物品',
    extra: extra.dict({ missingRef: extra.str('unloaded:item:ghost') }),
  };
  const overriddenItem = { ...baseItem, name: '后加载覆盖物品' };

  const registry = new Registry();
  registry.load(baseDatapack);
  registry.load(emptyPack('extension', [extensionItem, overriddenItem]));
  return registry;
}

describe('Runtime content browser', () => {
  test('只从当前 Registry 的有效内容建立 loaded-only 目录', () => {
    const registry = createRegistry();
    const gameReadModelRegistry: ContentCatalogQueryPort = registry;
    const browser = createRuntimeContentBrowser(gameReadModelRegistry);
    const view = browser.getView();

    expect(view.loadedMods.map(mod => mod.modName)).toEqual(['base', 'extension']);
    expect(view.entries.some(entry => entry.ref.fullId === 'extension:item:loaded')).toBe(true);
    expect(browser.getDefinition({ definitionKind: 'items', fullId: 'unloaded:item:ghost' })).toBeNull();
    expect(view.loadedMods.some(mod => mod.modName === 'unloaded')).toBe(false);
  });

  test('覆盖后的有效 Map 与 singleton 都可通过通用目录读取', () => {
    const registry = createRegistry();
    const browser = createRuntimeContentBrowser(registry);
    const view = browser.getView();

    const item = browser.getDefinition({
      definitionKind: 'items',
      fullId: baseDatapack.items[0]!.id,
    });
    expect(item).not.toBeNull();
    expect((item!.raw as { readonly name: string }).name).toBe('后加载覆盖物品');
    expect(view.entries.filter(entry => entry.ref.fullId === baseDatapack.items[0]!.id)).toHaveLength(1);

    const gearConfigKind = view.kinds.find(kind => kind.kind === 'gearConfig');
    expect(gearConfigKind?.shape).toBe('singleton');
    expect(browser.getDefinition({ definitionKind: 'gearConfig', fullId: null })).not.toBeNull();
    expect(view.kinds.find(kind => kind.kind === 'items')?.shape).toBe('map');

    for (const kind of [
      'inits', 'areas', 'spots', 'enhancements', 'stories', 'activeStories', 'passiveStories',
      'passivePools', 'items', 'dropTables', 'funcletDefs', 'characters', 'characterVariants',
      'cultivateCurves', 'favoriteItems', 'uniqueWeapons', 'traits', 'gears', 'gearConfig',
      'gachaPools', 'shops', 'colorGroups', 'colorEquipments', 'themeDesigns',
      'affectionConfig', 'resourceDisplays', 'tagDefs', 'pics',
      'charaProfiles', 'extras',
    ]) {
      expect(view.kinds.some(descriptor => descriptor.kind === kind)).toBe(true);
    }
  });

  test('容器形状包含 array、map、singleton 与 unknown 兜底', () => {
    const browser = createRuntimeContentBrowser({
      arrayKind: ['value'],
      mapKind: new Map([['extension:map:value', { name: 'map' }]]),
      singletonKind: { name: 'singleton' },
      unknownKind: new Date(0),
    });
    const kinds = new Map(browser.getView().kinds.map(kind => [kind.kind, kind]));

    expect(kinds.get('arrayKind')?.shape).toBe('array');
    expect(kinds.get('mapKind')?.shape).toBe('map');
    expect(kinds.get('singletonKind')?.shape).toBe('singleton');
    expect(kinds.get('unknownKind')?.shape).toBe('unknown');
    expect(browser.getDefinition({ definitionKind: 'arrayKind', fullId: null })?.fields[0]?.valueType).toBe('string');
    expect(browser.getDefinition({ definitionKind: 'unknownKind', fullId: null })?.raw).toEqual({
      $type: 'unknown',
      value: '[object Date]',
    });
  });

  test('引用诊断区分 missing 与 ambiguous，并支持纯函数搜索', () => {
    const registry = createRegistry();
    const browser = createRuntimeContentBrowser(registry);
    const loadedItem = browser.getDefinition({ definitionKind: 'items', fullId: 'extension:item:loaded' });
    expect(loadedItem?.outgoingReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'unloaded:item:ghost', status: 'missing' }),
    ]));

    const variantId = [...registry.characterVariants.keys()][0];
    expect(variantId).toBeTruthy();
    const variant = browser.getDefinition({ definitionKind: 'characterVariants', fullId: variantId! });
    expect(variant?.outgoingReferences.some(reference => reference.status === 'resolved')).toBe(true);

    const sharedId = 'extension:shared:target';
    const sharedCharacter = { ...baseDatapack.characters[0]!, id: sharedId };
    const sharedProfile = { ...baseDatapack.charaProfiles![0]!, id: sharedId };
    const ambiguousRegistry = new Registry();
    ambiguousRegistry.load(baseDatapack);
    ambiguousRegistry.load(emptyPack('extension', [
      {
        ...baseDatapack.items[0]!,
        id: 'extension:item:ambiguous',
        extra: extra.dict({ ambiguousRef: extra.str(sharedId) }),
      },
    ], {
      characters: [sharedCharacter],
      charaProfiles: [sharedProfile],
    }));
    const ambiguous = createRuntimeContentBrowser(ambiguousRegistry).getDefinition({
      definitionKind: 'items',
      fullId: 'extension:item:ambiguous',
    });
    expect(ambiguous?.outgoingReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: sharedId, status: 'ambiguous' }),
    ]));

    const matches = filterRuntimeContentDefinitions(browser.getView().entries, {
      text: 'unloaded:item:ghost',
      hasDiagnostics: false,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.ref.fullId).toBe('extension:item:loaded');
    expect(loadedItem?.summary.diagnosticCount).toBe(0);
    expect(loadedItem?.summary.referenceCoverage?.candidateCount).toBeGreaterThan(0);
  });

  test('已知字段的缺失引用仍保留目标类型和关系语义', () => {
    const browser = createRuntimeContentBrowser({
      spots: new Map([['demo:spot:missing-area', { areaId: 'demo:area:missing' }]]),
    });
    const detail = browser.getDefinition({ definitionKind: 'spots', fullId: 'demo:spot:missing-area' });
    const reference = detail?.outgoingReferences[0];
    expect(reference).toEqual(expect.objectContaining({
      value: 'demo:area:missing',
      relation: '所属 Area',
      targetKind: 'areas',
      confidence: 'declared',
      status: 'missing',
    }));
  });

  test('实体与资源使用统一静态关系查询入口，不触发额外快照构建', () => {
    const registry = createRegistry();
    const browser = createRuntimeContentBrowser(registry);
    const itemRef = { definitionKind: 'items', fullId: 'extension:item:loaded' } as const;
    const entityRelations = browser.getEntityRelations(itemRef);
    const genericRelations = browser.getReferences(itemRef);
    expect(entityRelations).toBeDefined();
    expect(entityRelations.incoming).toBe(genericRelations.incoming);
    expect(entityRelations.outgoing).toBe(genericRelations.outgoing);

    const resourceRelations = browser.getResourceRelations('base:resource:credit');
    expect(resourceRelations.incoming.some(reference => reference.value === 'base:resource:credit')).toBe(true);
    expect(browser.getResourceRelations('missing:resource:none')).toEqual({ outgoing: [], incoming: [] });
  });

  test('详情返回安全克隆，不暴露 Registry 原对象或写入口', () => {
    const registry = createRegistry();
    const browser = createRuntimeContentBrowser(registry);
    const itemId = 'extension:item:loaded';
    const detail = browser.getDefinition({ definitionKind: 'items', fullId: itemId });

    expect(detail).not.toBeNull();
    expect(Object.isFrozen(detail!.raw)).toBe(true);
    expect(Object.isFrozen(detail!.fields)).toBe(true);
    expect(() => {
      (detail!.raw as { name: string }).name = '越界写入';
    }).toThrow();
    expect(registry.items.get(itemId)?.name).toBe('已加载扩展物品');
  });

  test('目标类型过滤、普通说明与状态键保持独立语义', () => {
    const browser = createRuntimeContentBrowser({
      spots: new Map([['demo:spot:a', { areaId: 'demo:area:b', description: 'text:looks:qualified',
        effects: [{ op: 'setFlag', target: 'demo:flag:key', value: 1 }] }]]),
      areas: new Map([['demo:area:b', { name: '区域 B' }]]),
      items: new Map([['demo:area:b', { name: '同 ID 物品' }]]),
    });
    const detail = browser.getDefinition({ definitionKind: 'spots', fullId: 'demo:spot:a' })!;
    const area = detail.outgoingReferences.find(edge => edge.path === '$.areaId');
    expect(area).toMatchObject({ status: 'resolved', confidence: 'declared', scope: 'global',
      target: { definitionKind: 'areas', fullId: 'demo:area:b' } });
    expect(detail.outgoingReferences.filter(edge => edge.confidence === 'declared')).toHaveLength(1);
    expect(detail.summary.diagnosticCount).toBe(0);
  });

  test('可靠来源变更使缓存失效，不按命名空间筛选或计数', () => {
    let owner = 'addon';
    const shared = { name: '同对象定义' };
    const registry = { loadedModNames: new Set(['base', 'addon']),
      characterVariants: new Map([['base:variant:v', shared]]),
      resourceDisplays: new Map([['base:resource:credit', { label: '信用点' }]]),
      characterVariantOwnerOf: () => owner,
      resourceDisplayOwnerOf: () => 'addon',
    };
    const browser = createRuntimeContentBrowser(registry);
    const first = browser.getView();
    expect(browser.listDefinitions({ modName: 'base' })).toHaveLength(0);
    expect(first.loadedMods.find(mod => mod.modName === 'addon')?.definitionCount).toBe(2);
    expect(first.entries.every(entry => entry.sourceMod === 'addon')).toBe(true);
    owner = 'base';
    const second = browser.getView();
    expect(second).not.toBe(first);
    expect(browser.listDefinitions({ modName: 'base' })).toHaveLength(1);
    expect(second.loadedMods.find(mod => mod.modName === 'addon')?.definitionCount).toBe(1);
    registry.characterVariants.clear();
    expect(browser.getDefinition({ definitionKind: 'characterVariants', fullId: 'base:variant:v' })).toBeNull();
  });
});


test('查询和字段树不会执行定义getter，且循环字段可安全阅读', () => {
  let reads = 0;
  const item: Record<string, unknown> = { id: 'test:item:safe' };
  Object.defineProperty(item, 'name', { enumerable: true, get: () => { reads++; throw new Error('accessor'); } });
  item.extra = { parent: item };
  const browser = createRuntimeContentBrowser({ items: new Map([[item.id, item]]) });
  expect(browser.getView().entries).toHaveLength(1);
  const detail = browser.getDefinition({ definitionKind: 'items', fullId: 'test:item:safe' });
  expect(detail?.raw).toMatchObject({ extra: { parent: { $type: 'unknown', value: '<cycle>' } } });
  expect(detail?.fields.length).toBeGreaterThan(0);
  expect(reads).toBe(0);
});
