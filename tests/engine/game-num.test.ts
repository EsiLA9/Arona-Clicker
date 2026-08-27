// ============================================================
// engine/game-num.test.ts — 统一数值注册 + 懒求值（primitiveGain）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { Character, Expr, PlayerState, value } from '../../src/engine/types';
import type { GameNum } from '../../src/engine/expression/game-num';
import { GameNumSystem } from '../../src/engine/expression/game-num';
import { EventBus } from '../../src/engine/core/event-bus';
import { ValueSystem } from '../../src/engine/expression/value-system';
import { matchesTag, tagPath, tagId } from '../../src/engine/core/tag';
import type { AffectorEngine } from '../../src/engine/effect/affector-engine';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';

const childrenOf = (node: GameNum | undefined): GameNum[] =>
  (node as { kind: 'add'; children: GameNum[] }).children ?? [];

describe('GameNum (primitiveGain 懒求值)', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('every resource registers a primitiveGain root', () => {
    expect(game.gameNumSystem.getResources()).toContain(CREDIT);
    expect(game.gameNumSystem.getResources()).toContain('base:resource:pyroxene');
    const root = game.gameNumSystem.getGainNode(CREDIT);
    expect(root).toMatchObject({ id: 'primitiveGain:base:resource:credit', kind: 'add' });
  });

  test('spot subtree expands down to owned/baseLine/zone leaves', () => {
    const spotNode = childrenOf(game.gameNumSystem.getGainNode(CREDIT))
      .find(c => c.id === 'spot:base:spot:credit_printer')!;
    expect(spotNode.kind).toBe('mul');
    expect(childrenOf(spotNode).map(c => c.id)).toEqual([
      'owned:base:spot:credit_printer',
      'baseLine:base:spot:credit_printer',
      'zone:spot:base:spot:credit_printer:mul:base:resource:credit',
    ]);
    // baseLine → add[ baseYield(add[expr, levelLinear]), zone(flat 区节点) ]
    const baseLine = childrenOf(spotNode).find(c => c.id === 'baseLine:base:spot:credit_printer')!;
    expect(baseLine.kind).toBe('add');
    expect(childrenOf(baseLine).map(c => c.kind)).toEqual(['add', 'zone']);
    // baseYield 含线性升级增量节点
    const baseYield = childrenOf(baseLine).find(c => c.id === 'baseYield:base:spot:credit_printer')!;
    expect(childrenOf(baseYield).map(c => c.kind)).toEqual(['expr', 'levelLinear']);
  });

  test('primitiveGain is lazily evaluated per tick for a resource', () => {
    // 只拥有 credit_printer（base 5 + 功能 2）
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources[CREDIT] = 0;

    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
    game.state.resources[CREDIT] = 0;
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(7);
  });

  test('unowned spots contribute zero via the owned leaf', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.resources[CREDIT] = 0;
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(0);
  });

  test('F-03: manager/tag nodes frozen inside the subtree', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.spotManagers['base:spot:credit_printer'] = Character.Arona;
    // managerBonus 恒 0、tagMultiplier 恒 1：仅 base 5 + 功能 2
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
  });

  test('affectorFlows leaf aggregates addResource into the same resource', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.resources[CREDIT] = 100;
    // 挂载 能源供给 Enhancement（挂载 base:pack:energy_drink，+1 credit/tick）
    game.mutations.addEnhancement('base:enh:energy_supply');
    game.state.resources[CREDIT] = 0;
    // 仅 enhancement affector +1（无 spot 产出）
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(1);
  });

  test('evaluateSpotYield returns the final per-spot value including its functionality', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.mutations.setSpotLevel('base:spot:credit_printer', 1);
    // base 5 + 功能 2（linearYield 每级 +2）= 7
    expect(game.gameNumSystem.evaluateSpotYield('base:spot:credit_printer', game.state)).toBe(7);

    // 升级到 3：base 5 + 线性 2×2 + 功能 3×2 = 15（P1-2 缓存经 spotLevelChanged 失效后刷新）
    game.mutations.setSpotLevel('base:spot:credit_printer', 3);
    expect(game.gameNumSystem.evaluateSpotYield('base:spot:credit_printer', game.state)).toBe(15);

    // 未拥有的 spot → 0
    game.mutations.setSpotLevel('base:spot:credit_printer', 0);
    expect(game.gameNumSystem.evaluateSpotYield('base:spot:credit_printer', game.state)).toBe(0);
  });

  test('F-03: production cache stable across frozen manager assignment', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.mutations.setSpotLevel('base:spot:credit_printer', 1);
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
    // manager 加成冻结：指派后产出不变（缓存语义仍经 mutation 入口失效）
    game.mutations.setManager('base:spot:credit_printer', Character.Arona);
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
  });

  test('P1-2: expressions reading resources bust the production cache on resourceChanged', () => {
    const bus = new EventBus();
    const RES = 'r1';
    const spot = {
      id: 's1',
      baseYieldResource: RES,
      baseYield: Expr.val(value('res', { resource: RES })),
      managerBonusYield: Expr.const(0),
    };
    const ctx = {
      valueSystem: new ValueSystem(),
      registry: { spots: new Map([[spot.id, spot]]), enhancements: new Map() },
      characterSystem: { getTagBonus: () => 1 },
      affectorEngine: { getActiveInstances: () => [], getPack: () => undefined },
      eventBus: bus,
    } as unknown as ConstructorParameters<typeof GameNumSystem>[0];
    const system = new GameNumSystem(ctx);
    system.buildAll();
    const state = {
      resources: { [RES]: 10 },
      spotLevels: { s1: 1 },
      spotManagers: {},
    } as unknown as PlayerState;

    // 首次求值缓存 base=10；资源余额变化后 resourceChanged 必须打掉缓存
    expect(system.evaluateResourceGain(RES, state)).toBe(10);
    state.resources[RES] = 42;
    bus.emit({ type: 'resourceChanged', resource: RES, delta: 32, newValue: 42 });
    expect(system.evaluateResourceGain(RES, state)).toBe(42);
  });

  test('P1: enhancement production multiplier applies and refreshes on unlock/remove', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    const SPOT = 'base:spot:credit_printer';
    const spotTags = game.registry.spots.get(SPOT)?.tags ?? [];
    // 找一个匹配的、当前未解锁的产出强化（P1-1 反向索引 + P1-2 缓存的失效键验证）
    const enh = [...game.registry.enhancements.values()].find(e => {
      if (!e.affectorPackIds?.length) return false;
      if (game.state.unlockedEnhancements.includes(e.id)) return false;
      return e.affectorPackIds.some(pid => {
        const pack = game.affectorEngine.getPack(pid);
        if (!pack) return false;
        return pack.entries.some(ent => (ent.zoneModifiers ?? []).some(z =>
          z.category === 'mul' &&
          (z.target.kind === 'entity'
            ? z.target.ref.id === '*' || z.target.ref.id === SPOT
            : (() => {
                const tag = z.target.tag;
                return tag.length === 0 || spotTags.some(t => matchesTag(t, tag));
              })())));
      });
    });
    if (!enh) return; // 数据包无匹配的未解锁产出强化则跳过
    const base = game.gameNumSystem.evaluateResourceGain(CREDIT, game.state);
    game.mutations.addEnhancement(enh.id);
    const afterAdd = game.gameNumSystem.evaluateResourceGain(CREDIT, game.state);
    expect(afterAdd).not.toBeCloseTo(base, 6); // 解锁后产出改变（索引+缓存包含新强化）
    game.mutations.removeEnhancement(enh.id);
    const afterRemove = game.gameNumSystem.evaluateResourceGain(CREDIT, game.state);
    expect(afterRemove).toBeCloseTo(base, 6); // 移除后恢复（缓存/索引正确失效）
  });
});

describe('GameNum 算子扩展 / 通用数值容器 / 溯源分解', () => {
  let game: GameInstance;
  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });
  afterEach(() => game.stop());

  const C = (id: string, v: number): GameNum => ({ id, kind: 'const', value: v });

  test('组合算子 add/sub/mul/div/min/max/pow 求值', () => {
    const sys = game.gameNumSystem;
    expect(sys.evaluate({ id: 'a', kind: 'add', children: [C('1', 3), C('2', 4), C('3', 5)] }, game.state)).toBe(12);
    expect(sys.evaluate({ id: 's', kind: 'sub', children: [C('1', 10), C('2', 3), C('3', 2)] }, game.state)).toBe(5);
    expect(sys.evaluate({ id: 'm', kind: 'mul', children: [C('1', 2), C('2', 3), C('3', 4)] }, game.state)).toBe(24);
    expect(sys.evaluate({ id: 'd', kind: 'div', children: [C('1', 24), C('2', 3), C('3', 2)] }, game.state)).toBe(4);
    expect(sys.evaluate({ id: 'mi', kind: 'min', children: [C('1', 5), C('2', 2), C('3', 8)] }, game.state)).toBe(2);
    expect(sys.evaluate({ id: 'ma', kind: 'max', children: [C('1', 5), C('2', 2), C('3', 8)] }, game.state)).toBe(8);
    expect(sys.evaluate({ id: 'p', kind: 'pow', children: [C('1', 2), C('2', 3)] }, game.state)).toBe(8);
  });

  test('div 除零返回 0（不抛错、不 Infinity）', () => {
    const sys = game.gameNumSystem;
    expect(
      sys.evaluate({ id: 'd', kind: 'div', children: [C('1', 5), C('2', 0)] }, game.state),
    ).toBe(0);
  });

  test('一元 floor/ceil/round 与 clamp 区间夹取', () => {
    const sys = game.gameNumSystem;
    expect(sys.evaluate({ id: 'f', kind: 'floor', child: C('x', 2.9) }, game.state)).toBe(2);
    expect(sys.evaluate({ id: 'r', kind: 'round', child: C('x', 2.5) }, game.state)).toBe(3);
    expect(sys.evaluate({ id: 'c', kind: 'clamp', value: C('v', 15), min: C('lo', 0), max: C('hi', 10) }, game.state)).toBe(10);
    expect(sys.evaluate({ id: 'c2', kind: 'clamp', value: C('v', -3), min: C('lo', 0), max: C('hi', 10) }, game.state)).toBe(0);
  });

  test('cond 以 test 数值非零选择 then 分支', () => {
    const sys = game.gameNumSystem;
    expect(
      sys.evaluate({ id: 'if', kind: 'cond', test: C('t', 1), then: C('a', 100), else: C('b', 200) }, game.state),
    ).toBe(100);
    expect(
      sys.evaluate({ id: 'if2', kind: 'cond', test: C('t', 0), then: C('a', 100), else: C('b', 200) }, game.state),
    ).toBe(200);
  });

  test('expr 叶子透传 ValueExpression 新算子（clamp）', () => {
    const sys = game.gameNumSystem;
    const node: GameNum = {
      id: 'e',
      kind: 'expr',
      expr: Expr.clamp(Expr.val(value('const', { value: 5 })), Expr.const(0), Expr.const(3)),
    };
    expect(sys.evaluate(node, game.state)).toBe(3);
  });

  test('通用命名数值：register / evaluateByName / hasNamed', () => {
    const sys = game.gameNumSystem;
    const tree: GameNum = {
      id: 'cost:upgrade',
      kind: 'mul',
      children: [C('base', 10), C('lvl', 2)],
    };
    sys.register('cost:upgrade', tree);
    expect(sys.hasNamed('cost:upgrade')).toBe(true);
    expect(sys.getNamedNumbers()).toContain('cost:upgrade');
    expect(sys.evaluateByName('cost:upgrade', game.state)).toBe(20);
    expect(sys.evaluateByName('nonexistent', game.state)).toBe(0);
  });

  test('evaluateWithBreakdown 贡献明细与 evaluate 一致', () => {
    const sys = game.gameNumSystem;
    const tree: GameNum = {
      id: 'root',
      kind: 'mul',
      children: [
        C('a', 5),
        { id: 'b', kind: 'mul', children: [C('b1', 2), C('b2', 3)] },
      ],
    };
    const direct = sys.evaluate(tree, game.state);
    const bd = sys.evaluateWithBreakdown(tree, game.state);
    expect(bd.value).toBe(direct);
    expect(bd.value).toBe(30);
    const root = bd.contributions[0];
    expect(root.id).toBe('root');
    expect(root.kind).toBe('mul');
    expect(root.children).toHaveLength(2);
    expect(root.children![1].kind).toBe('mul');
    expect(root.children![1].children!.map(c => c.value)).toEqual([2, 3]);
  });

  test('evaluateByNameWithBreakdown 按 name 返回明细', () => {
    const sys = game.gameNumSystem;
    const tree: GameNum = { id: 'n', kind: 'add', children: [C('a', 4), C('b', 6)] };
    sys.register('sum:test', tree);
    const bd = sys.evaluateByNameWithBreakdown('sum:test', game.state);
    expect(bd?.value).toBe(10);
    expect(bd?.contributions[0].children?.map(c => c.value)).toEqual([4, 6]);
  });
});

describe('GameNum tag 效果（自下而上聚合）/ Affector 桥接', () => {
  let game: GameInstance;
  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources[CREDIT] = 0;
  });
  afterEach(() => game.stop());

  const officeKey = tagId(['office']);
  const creditKey = tagId(['credit']);
  // credit_printer tags = [credit, office]；基线产出 5(base) + 2(linearYield affectorFlows) = 7

  test('tagFlat 自下而上直接加成进入产出', () => {
    game.gameNumSystem.registerTagEffect(game.state, officeKey, {
      id: 't1', category: 'flat', value: { id: 'v', kind: 'const', value: 10 }, life: 'init',
    });
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(17);
  });

  test('tagMultiplier 通用乘区（无记录→1 不影响基线）', () => {
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
    game.gameNumSystem.registerTagEffect(game.state, officeKey, {
      id: 't2', category: 'mul', value: { id: 'v', kind: 'const', value: 1.5 }, life: 'init',
    });
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(9.5);
  });

  test('自下而上：多 tag 直接加成求和', () => {
    game.gameNumSystem.registerTagEffect(game.state, officeKey, { id: 'a', category: 'flat', value: { id: 'v', kind: 'const', value: 3 }, life: 'init' });
    game.gameNumSystem.registerTagEffect(game.state, creditKey, { id: 'b', category: 'flat', value: { id: 'v', kind: 'const', value: 4 }, life: 'init' });
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7 + 3 + 4);
  });

  test('buildZoneNode 生成 tag 乘区节点并支持夹取（bound/custom 折叠入 mul）', () => {
    const zone = game.gameNumSystem.buildZoneNode({ kind: 'spot', id: 'base:spot:credit_printer' }, 'mul', 'base:resource:credit');
    expect(game.gameNumSystem.evaluate(zone, game.state)).toBe(1); // 无 mul 记录 → 1
    game.gameNumSystem.registerTagEffect(game.state, officeKey, {
      id: 'cm', category: 'custom', multiplierId: 'vip', value: { id: 'v', kind: 'const', value: 2 }, life: 'init',
    });
    game.gameNumSystem.registerTagEffect(game.state, creditKey, {
      id: 'bd', category: 'bound', min: 1, max: 3, life: 'init',
    });
    expect(game.gameNumSystem.evaluate(zone, game.state)).toBe(2); // clamp(2, [1,3]) = 2
  });

  test('removeTagEffect / removeTagEffectsBySource 撤销效果', () => {
    game.gameNumSystem.registerTagEffect(game.state, officeKey, { id: 'x', category: 'flat', value: { id: 'v', kind: 'const', value: 9 }, source: 'srcA', life: 'init' });
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(16);
    game.gameNumSystem.removeTagEffect(game.state, officeKey, 'x');
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
    game.gameNumSystem.registerTagEffect(game.state, officeKey, { id: 'y', category: 'flat', value: { id: 'v', kind: 'const', value: 5 }, source: 'srcB', life: 'init' });
    game.gameNumSystem.removeTagEffectsBySource(game.state, 'srcB');
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
  });

  test('evaluateWithBreakdown 包含 zone 区贡献明细', () => {
    game.gameNumSystem.registerTagEffect(game.state, officeKey, { id: 'f', category: 'flat', value: { id: 'v', kind: 'const', value: 8 }, life: 'init' });
    const flatNode = game.gameNumSystem.buildZoneNode({ kind: 'spot', id: 'base:spot:credit_printer' }, 'flat', 'base:resource:credit');
    const bd = game.gameNumSystem.evaluateWithBreakdown(flatNode, game.state);
    expect(bd.value).toBe(8);
    expect(bd.contributions[0].kind).toBe('zone');
    expect(bd.contributions[0].label).toBe('zone:spot:base:spot:credit_printer:flat:base:resource:credit');
  });

  test('Affector zoneModifiers 经 syncAffectorZoneEffects 写入 tagEffects 并生效', () => {
    const fakeAffector = {
      getActiveInstances: () => [
        { instanceId: 'pack@spot', packId: 'pack', mountEntityId: 'spot', state: 'Active', activeEntryIds: ['e1'] },
      ],
      getPack: (id: string) => ({
        id,
        entries: [{ id: 'e1', effects: [], zoneModifiers: [{ target: { kind: 'tag', tag: ['office'] }, category: 'mul', value: 2, life: 'init' }] }],
      }),
    } as unknown as AffectorEngine;
    game.gameNumSystem.syncAffectorZoneEffects(fakeAffector, game.state);
    const records = Object.values(game.state.tagEffects ?? {}).flat();
    expect(records.some(r => r.source?.startsWith('affector:') && r.category === 'mul')).toBe(true);
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(12); // 树内 5×2 + 树外 2
  });
});
