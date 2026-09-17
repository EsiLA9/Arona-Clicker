import { describe, expect, test } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { Registry } from '../../src/data-services/registry/registry';
import {
  applyAuthoringMutation,
  buildAuthoringDef,
  getContentPolicy,
  getFieldMaterialization,
  isContentAuthorable,
  listContentPolicies,
  policyFieldConsumers,
  requireContentPolicy,
  validateAuthoringFieldValue,
  validateAuthoringInput,
  type ContentKey,
} from '../../src/data-services/authoring/content-policy';
import { decodeSpotContent } from '../../src/data-services/authoring/content-policy-dsl';

/** Datapack 顶层内容键：策略表只允许登记这些键，用来抓拼写错误并报告未登记项。 */
const DATAPACK_CONTENT_KEYS: readonly ContentKey[] = [
  'inits',
  'areas',
  'spots',
  'enhancements',
  'activeStories',
  'passiveStories',
  'passivePools',
  'stories',
  'items',
  'dropTables',
  'affectorPacks',
  'triggerDefs',
  'funcletDefs',
  'characters',
  'characterVariants',
  'cultivateCurves',
  'favoriteItems',
  'uniqueWeapons',
  'traits',
  'gears',
  'gearConfig',
  'colorGroups',
  'colorEquipments',
  'themeDesigns',
  'gachaPools',
  'shops',
  'pics',
  'charaProfiles',
  'characterPersistConfig',
  'affectionConfig',
  'resourceDisplays',
  'tags',
  'extras',
];

const AREA = 'base:area:main';
const MOD = 'draft-mod';

const datapack: Datapack = {
  name: 'content policy fixture',
  version: '1.0.0',
  modName: 'base',
  inits: [{ id: 'base:init:main', name: 'Main', description: '', defaultAreas: [] }],
  areas: [{ id: AREA, initId: 'base:init:main', name: 'Main', description: '', defaultSpots: [] }],
  spots: [],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
};

const spotInput = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  idName: 'printer',
  areaId: AREA,
  name: 'Printer',
  description: 'A temporary printer',
  purchaseOptions: [{ id: 'free', costs: [] }],
  ...overrides,
});

describe('内容策略表：授权范围', () => {
  test('spots 获得 local-mutation 授权，未登记内容保持未授权', () => {
    expect(isContentAuthorable('spots')).toBe(true);
    expect(getContentPolicy('spots')?.apply).toBe('local-mutation');
    expect(isContentAuthorable('characters')).toBe(false);
    expect(getContentPolicy('characters')).toBeUndefined();
    expect(() => requireContentPolicy('characters')).toThrow(/未授权编辑/);
  });

  test('策略表键必须是 Datapack 顶层内容键，并显式报告未登记项', () => {
    const registered = listContentPolicies().map(policy => policy.key);
    const unknown = registered.filter(key => !DATAPACK_CONTENT_KEYS.includes(key));
    expect(unknown).toEqual([]);

    const unregistered = DATAPACK_CONTENT_KEYS.filter(key => !registered.includes(key));
    expect(unregistered).not.toContain('spots');
    expect(unregistered).toContain('characters');
    expect(registered.length + unregistered.length).toBe(DATAPACK_CONTENT_KEYS.length);
  });

  test('获得 local-mutation 授权的内容必须登记完整消费者并集', () => {
    for (const policy of listContentPolicies().filter(item => item.apply === 'local-mutation')) {
      expect(policyFieldConsumers(policy)).toContain('registry-record');
      expect(policy.state).toBe('retain');
    }
  });
});

describe('字段级失效台账', () => {
  test('每个可写字段都必须登记失效声明，且不登记未授权字段', () => {
    for (const policy of listContentPolicies()) {
      const declared = policy.materialization.map(entry => entry.field);
      expect(new Set(declared).size).toBe(declared.length);

      const writable = [
        ...policy.fields.map(field => field.key),
        ...(policy.extensions ?? []).map(extension => extension.inputKey),
      ];
      expect([...declared].sort()).toEqual([...writable].sort());

      for (const field of policy.fields) {
        const entry = getFieldMaterialization(policy, field.key);
        expect(entry?.consumers.length).toBeGreaterThan(0);
      }
    }
  });

  test('需要失效的字段必须写得出触发方，否则不得开放编辑', () => {
    for (const policy of listContentPolicies()) {
      for (const entry of policy.materialization) {
        if (entry.invalidate === 'none') continue;
        expect(typeof entry.trigger).toBe('string');
        expect(entry.trigger?.length).toBeGreaterThan(0);
      }
    }
  });

  test('Spot 的失效台账与现有热路径一致', () => {
    const policy = requireContentPolicy('spots');

    expect(getFieldMaterialization(policy, 'baseYield')).toBeUndefined();
    expect(getFieldMaterialization(policy, 'yieldPerLevel')).toBeUndefined();
    expect(getFieldMaterialization(policy, 'areaId')).toMatchObject({ invalidate: 'index' });
    expect(getFieldMaterialization(policy, 'name')).toMatchObject({ consumers: ['ui-dynamic'], invalidate: 'none' });
    expect(getFieldMaterialization(policy, 'maxLevel')).toMatchObject({ consumers: ['spot-service', 'ui-dynamic'], invalidate: 'none' });
    expect(getFieldMaterialization(policy, 'functionalities')).toMatchObject({
      consumers: ['registry-record', 'affector', 'game-num', 'ui-dynamic'],
      invalidate: 'remount',
    });
    expect(getFieldMaterialization(policy, 'tier')).toBeUndefined();
    expect(getFieldMaterialization(policy, 'tags')).toMatchObject({ invalidate: 'index' });
    expect(getFieldMaterialization(policy, 'revealTriggers')).toMatchObject({ consumers: ['visibility', 'ui-dynamic'], invalidate: 'index' });
    expect(policyFieldConsumers(policy)).toEqual(expect.arrayContaining(['game-num', 'area-index', 'spot-service', 'ui-dynamic']));
  });
});

describe('内容策略表：字段授权', () => {
  test('未登记字段被拒绝，并给出策略表路径', () => {
    const policy = requireContentPolicy('spots');
    const problem = validateAuthoringInput(policy, spotInput({ theme: {} }));

    expect(problem).toMatchObject({ code: 'invalid-field', path: 'spot.theme' });
    expect(problem?.message).toContain('未授权');
  });

  test('全部登记字段合法时通过校验', () => {
    expect(validateAuthoringInput(requireContentPolicy('spots'), spotInput())).toBeUndefined();
  });

  test('可选字段缺省不报错', () => {
    const policy = requireContentPolicy('spots');
    expect(validateAuthoringInput(policy, spotInput({ maxLevel: undefined, conditionText: undefined }))).toBeUndefined();
  });

  test('Spot 支付方案必须显式声明；空数组表示无购买途径', () => {
    const policy = requireContentPolicy('spots');
    const { purchaseOptions: _omitted, ...withoutPayments } = spotInput();
    expect(validateAuthoringInput(policy, withoutPayments)).toMatchObject({
      code: 'invalid-field',
      path: 'spot.purchaseOptions',
    });
    expect(validateAuthoringInput(policy, spotInput({ purchaseOptions: [] }))).toBeUndefined();
    expect(validateAuthoringInput(policy, spotInput({
      levelUpgrades: [{ level: 2, effects: [] }],
    }))).toMatchObject({
      code: 'invalid-field',
      path: 'spot.levelUpgrades[0].paymentOptions',
    });
  });

  test('字段值语义由 kind 决定：数值、非空字符串、实体 ID、局部名', () => {
    const policy = requireContentPolicy('spots');

    expect(validateAuthoringInput(policy, spotInput({ maxLevel: Number.NaN }))).toMatchObject({
      code: 'invalid-field',
      path: 'spot.maxLevel',
    });
    expect(validateAuthoringInput(policy, spotInput({ baseCost: -1 }))).toMatchObject({
      code: 'invalid-field',
      path: 'spot.baseCost',
    });
    expect(validateAuthoringInput(policy, spotInput({ baseCostResource: '  ' }))).toMatchObject({
      code: 'invalid-field',
      path: 'spot.baseCostResource',
    });
    expect(validateAuthoringInput(policy, spotInput({ description: '' }))).toBeUndefined();
    expect(validateAuthoringInput(policy, spotInput({ areaId: 'base:init:main' }))).toMatchObject({
      code: 'invalid-field',
      path: 'spot.areaId',
    });
    expect(validateAuthoringFieldValue(policy, 'idName', 'Bad Name')).toMatchObject({
      code: 'invalid-content-id',
      path: 'idName',
    });
    expect(validateAuthoringFieldValue(policy, 'secret', 1)).toMatchObject({
      code: 'invalid-field',
      path: 'spot.secret',
    });
  });

  test('int 与可选数值语义：空输入视为未设置，非法整数被拒绝', () => {
    const policy = requireContentPolicy('spots');

    expect(validateAuthoringInput(policy, spotInput({ maxLevel: '' }))).toBeUndefined();
    expect(validateAuthoringInput(policy, spotInput({ maxLevel: 5, upgradeCostGrowth: 1.5 }))).toMatchObject({ path: 'spot.upgradeCostGrowth' });
    expect(validateAuthoringInput(policy, spotInput({ maxLevel: -1 }))).toMatchObject({
      code: 'invalid-field',
      path: 'spot.maxLevel',
    });
    expect(validateAuthoringInput(policy, spotInput({ yieldPerLevel: 1.5 }))).toMatchObject({
      code: 'invalid-field',
      path: 'spot.yieldPerLevel',
    });
    expect(validateAuthoringInput(policy, spotInput({ baseYield: '' }))).toMatchObject({
      code: 'invalid-field',
      path: 'spot.baseYield',
    });
  });

  test('功能扩展支持多资源与多种类型，空列表不生成虚假功能', () => {
    const policy = requireContentPolicy('spots');
    const input = spotInput({
      functionalities: [
        { id: 'credit', kind: 'flow', resource: 'base:resource:credit', amount: 2 },
        { id: 'energy', kind: 'linearYield', resource: 'base:resource:energy', amountPerLevel: 3 },
      ],
    });
    expect(validateAuthoringInput(policy, input, {
      resourceIds: new Set(['base:resource:credit', 'base:resource:energy']),
    })).toBeUndefined();
    expect(buildAuthoringDef(policy, MOD, input)).toMatchObject({
      functionalities: [
        { id: 'runtime:resource:credit', kind: 'flow', resource: 'base:resource:credit', amount: 2 },
        { id: 'runtime:resource:energy', kind: 'linearYield', resource: 'base:resource:energy', amountPerLevel: 3 },
      ],
    });
    expect(buildAuthoringDef(policy, MOD, spotInput({ functionalities: [] }))).not.toHaveProperty('functionalities');
  });

  test('功能扩展对未知类型、未知资源、重复 ID、非法数值与未知键 fail closed', () => {
    const policy = requireContentPolicy('spots');
    const base = { id: 'a', kind: 'flow', resource: 'base:resource:credit', amount: 1 };
    expect(validateAuthoringInput(policy, spotInput({ functionalities: [{ ...base, kind: 'unknown' }] }))).toMatchObject({ path: 'spot.functionalities[0].kind' });
    expect(validateAuthoringInput(policy, spotInput({ functionalities: [{ ...base, resource: 'unknown' }] }), { resourceIds: new Set(['base:resource:credit']) })).toMatchObject({ path: 'spot.functionalities[0].resource' });
    expect(validateAuthoringInput(policy, spotInput({ functionalities: [base, { ...base }] }))).toMatchObject({ path: 'spot.functionalities[1].id' });
    expect(validateAuthoringInput(policy, spotInput({ functionalities: [{ ...base, amount: 0 }] }))).toMatchObject({ path: 'spot.functionalities[0].amount' });
    expect(validateAuthoringInput(policy, spotInput({ functionalities: [{ ...base, extra: 1 }] }))).toMatchObject({ path: 'spot.functionalities[0].extra' });
  });

  test('支付方案支持 Resource / Item 混合费用、等级独立方案与条件', () => {
    const policy = requireContentPolicy('spots');
    const input = spotInput({
      purchaseOptions: [{
        id: 'credit',
        label: '信用点与票券',
        condition: { type: 'AND', conditions: [{ target: 'flag', key: 'event', comparator: '==', value: 1 }] },
        costs: [
          { type: 'resource', resourceId: 'base:resource:credit', amount: 10 },
          { type: 'item', itemId: 'base:item:ticket', amount: 2 },
        ],
      }],
      levelUpgrades: [{
        level: 2,
        paymentOptions: [{ id: 'energy', costs: [{ type: 'resource', resourceId: 'base:resource:energy', amount: 3 }] }],
        effects: [],
      }],
    });
    expect(validateAuthoringInput(policy, input, {
      resourceIds: new Set(['base:resource:credit', 'base:resource:energy']),
      itemIds: new Set(['base:item:ticket']),
    })).toBeUndefined();

    const def = buildAuthoringDef(policy, MOD, input) as Record<string, any>;
    expect(def.purchaseOptions).toEqual([expect.objectContaining({
      id: 'credit',
      costs: [
        { type: 'resource', resourceId: 'base:resource:credit', amount: { type: 'const', value: 10 } },
        { type: 'item', itemId: 'base:item:ticket', amount: { type: 'const', value: 2 } },
      ],
    })]);
    expect(def.levelUpgrades[0].paymentOptions[0].costs[0].amount).toEqual({ type: 'const', value: 3 });

    expect(decodeSpotContent(def as any)).toMatchObject({
      purchaseOptions: input.purchaseOptions,
      levelUpgrades: input.levelUpgrades,
    });
  });

  test('支付方案拒绝未知资产、重复 ID 与物品小数金额', () => {
    const policy = requireContentPolicy('spots');
    const context = { resourceIds: new Set(['base:resource:credit']), itemIds: new Set(['base:item:ticket']) };
    expect(validateAuthoringInput(policy, spotInput({ purchaseOptions: [
      { id: 'credit', costs: [{ type: 'resource', resourceId: 'unknown', amount: 1 }] },
    ] }), context)).toMatchObject({ path: 'spot.purchaseOptions[0].costs[0].resourceId' });
    expect(validateAuthoringInput(policy, spotInput({ purchaseOptions: [
      { id: 'token', costs: [{ type: 'item', itemId: 'base:item:ticket', amount: 1.5 }] },
    ] }), context)).toMatchObject({ path: 'spot.purchaseOptions[0].costs[0].amount' });
    expect(validateAuthoringInput(policy, spotInput({ purchaseOptions: [
      { id: 'same', costs: [] }, { id: 'same', costs: [] },
    ] }), context)).toMatchObject({ path: 'spot.purchaseOptions[1].id' });
  });
});

describe('内容策略表：Def 构建与受控提交', () => {
  test('buildAuthoringDef 产出完整 Def，包含自增 id、常量表达式与默认值', () => {
    const def = buildAuthoringDef(requireContentPolicy('spots'), MOD, spotInput()) as Record<string, unknown>;

    expect(def).toEqual({
      id: `${MOD}:spot:printer`,
      areaId: AREA,
      name: 'Printer',
      description: 'A temporary printer',
      levelUpgrades: [],
      tags: [],
      purchaseOptions: [{ id: 'free', costs: [] }],
    });
  });

  test('未设置的可选字段整键省略，设置时才写入 Def', () => {
    const policy = requireContentPolicy('spots');
    const withoutOptional = buildAuthoringDef(policy, MOD, spotInput()) as Record<string, unknown>;
    expect(Object.keys(withoutOptional)).not.toContain('maxLevel');
    expect(Object.keys(withoutOptional)).not.toContain('yieldPerLevel');

    const withOptional = buildAuthoringDef(policy, MOD, spotInput({
      maxLevel: 5,
      purchaseOptions: [{ id: 'credit', costs: [{ type: 'resource', resourceId: 'base:resource:credit', amount: 2 }] }],
    })) as Record<string, unknown>;
    expect(withOptional).toMatchObject({ maxLevel: 5, purchaseOptions: [{ id: 'credit' }] });
    expect(withOptional).not.toHaveProperty('baseCost');
    expect(withOptional).not.toHaveProperty('upgradeCostBase');
  });

  test('applyAuthoringMutation 委托 Registry 提交并返回可回滚 receipt', () => {
    const registry = new Registry();
    registry.load(datapack);
    const def = buildAuthoringDef(requireContentPolicy('spots'), MOD, spotInput());

    const receipt = applyAuthoringMutation(registry, {
      table: 'spots',
      operation: 'create',
      ownerModName: MOD,
      defId: `${MOD}:spot:printer`,
      def,
    });

    expect(registry.spots.has(`${MOD}:spot:printer`)).toBe(true);
    expect(receipt).toMatchObject({ table: 'spots', operation: 'create', defId: `${MOD}:spot:printer` });
    expect(receipt.previousDef).toBeUndefined();
    expect(receipt.currentDef).toEqual(def);

    receipt.rollback();
    expect(registry.spots.has(`${MOD}:spot:printer`)).toBe(false);
  });

  test('未授权内容无法通过通用通道提交', () => {
    const registry = new Registry();
    registry.load(datapack);

    expect(() => applyAuthoringMutation(registry, {
      table: 'characters',
      operation: 'create',
      ownerModName: MOD,
      defId: `${MOD}:character:arona`,
      def: {},
    })).toThrow(/未授权编辑/);
  });
});
