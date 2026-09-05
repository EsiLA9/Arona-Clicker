// ============================================================
// engine/game-num.test.ts — 统一数值注册 + 懒求值（primitiveGain）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { Expr, value } from '../../src/engine/types';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';
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
    game.inits.startNewGame(OFFICE);
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

  test('resource tree expands to the explicit four-level hierarchy (Phase 6)', () => {
    const root = game.gameNumSystem.getGainNode(CREDIT)!;
    // 根 = globalProduct + globalFlat(zone) + globalFlows
    expect(childrenOf(root).map(c => c.id)).toEqual([
      'globalProduct:base:resource:credit',
      'zone:global:*:flat',
      'flows:global:base:resource:credit',
    ]);
    const globalProduct = childrenOf(root)[0];
    expect(childrenOf(globalProduct).map(c => c.id)).toEqual([
      'initSum:base:resource:credit',
      'zone:global:*:mul',
    ]);
  });

  test('spot subtree expands down to owned/baseSum/zone leaves', () => {
    const system = game.gameNumSystem;
    const spotNode = system.spotSubtrees.get('base:spot:credit_printer')!;
    expect(spotNode).toMatchObject({ id: 'spot:base:spot:credit_printer:base:resource:credit', kind: 'add' });
    // spotFull = spotProduct(mul) + spotExtra(flat/flows 直加，不进乘区)
    expect(childrenOf(spotNode).map(c => c.id)).toEqual([
      'spotProduct:base:spot:credit_printer:base:resource:credit',
      'spotExtra:base:spot:credit_printer:base:resource:credit',
    ]);
    // spotProduct = spotBase(mul[owned, baseSum]) × zone(mul 区节点)
    const spotProduct = childrenOf(spotNode)[0];
    expect(spotProduct.kind).toBe('mul');
    const spotBase = childrenOf(spotProduct).find(c => c.kind === 'mul')!;
    expect(childrenOf(spotBase).map(c => c.id)).toEqual([
      'owned:base:spot:credit_printer',
      'baseSum:base:spot:credit_printer:base:resource:credit',
    ]);
    // baseSum → baseYield(add[expr, levelLinear])
    const baseSum = childrenOf(spotBase).find(c => c.id === 'baseSum:base:spot:credit_printer:base:resource:credit')!;
    expect(childrenOf(baseSum).map(c => c.kind)).toEqual(['add']);
    const baseYield = childrenOf(baseSum)[0];
    expect(childrenOf(baseYield).map(c => c.kind)).toEqual(['expr', 'levelLinear']);
    // DAG 共享：spotProduct 同为上级 areaBase 的子节点（base 链逐级连乘）
    const sharedProduct = system.spotProductNodes.get('base:spot:credit_printer@base:resource:credit')!;
    const areaBase = (system.parents.get(sharedProduct.id) ?? []).find(p => p.id.startsWith('areaBase:'))!;
    expect(childrenOf(areaBase).map(c => c.id)).toContain('spotProduct:base:spot:credit_printer:base:resource:credit');
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
    // 挂载 能源供给 Enhancement（挂载 base:affectorpack:energy_drink，+1 credit/tick）
    game.mutations.addEnhancement('base:enhancement:energy_supply');
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
      registry: {
        spots: new Map([[spot.id, spot]]),
        enhancements: new Map(),
        effectiveSpotTags: () => [],
      },
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
    game.inits.startNewGame(OFFICE);
  });
  afterEach(() => game.stop());

  const C = (id: string, v: number): GameNum => ({ id, kind: 'const', value: v });

  test('组合算子 add/sub/mul 求值', () => {
    const sys = game.gameNumSystem;
    expect(sys.evaluate({ id: 'a', kind: 'add', children: [C('1', 3), C('2', 4), C('3', 5)] }, game.state)).toBe(12);
    expect(sys.evaluate({ id: 's', kind: 'sub', children: [C('1', 10), C('2', 3), C('3', 2)] }, game.state)).toBe(5);
    expect(sys.evaluate({ id: 'm', kind: 'mul', children: [C('1', 2), C('2', 3), C('3', 4)] }, game.state)).toBe(24);
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
});

describe('GameNum tag 效果（自下而上聚合）/ Affector 桥接', () => {
  let game: GameInstance;
  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
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
      id: 't1', category: 'flat', value: { id: 'v', kind: 'const', value: 10 },
    });
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(17);
  });

  test('tagMultiplier 通用乘区（无记录→1 不影响基线）', () => {
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
    game.gameNumSystem.registerTagEffect(game.state, officeKey, {
      id: 't2', category: 'mul', value: { id: 'v', kind: 'const', value: 1.5 },
    });
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(9.5);
  });

  test('自下而上：多 tag 直接加成求和', () => {
    game.gameNumSystem.registerTagEffect(game.state, officeKey, { id: 'a', category: 'flat', value: { id: 'v', kind: 'const', value: 3 } });
    game.gameNumSystem.registerTagEffect(game.state, creditKey, { id: 'b', category: 'flat', value: { id: 'v', kind: 'const', value: 4 } });
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7 + 3 + 4);
  });

  test('buildZoneNode 生成 tag 乘区节点并支持夹取（bound/custom 折叠入 mul）', () => {
    const zone = game.gameNumSystem.buildZoneNode({ kind: 'spot', id: 'base:spot:credit_printer' }, 'mul', 'base:resource:credit');
    expect(game.gameNumSystem.evaluate(zone, game.state)).toBe(1); // 无 mul 记录 → 1
    game.gameNumSystem.registerTagEffect(game.state, officeKey, {
      id: 'cm', category: 'custom', multiplierId: 'vip', value: { id: 'v', kind: 'const', value: 2 },
    });
    game.gameNumSystem.registerTagEffect(game.state, creditKey, {
      id: 'bd', category: 'bound', min: 1, max: 3,
    });
    expect(game.gameNumSystem.evaluate(zone, game.state)).toBe(2); // clamp(2, [1,3]) = 2
  });

  test('removeTagEffect / removeTagEffectsBySource 撤销效果', () => {
    game.gameNumSystem.registerTagEffect(game.state, officeKey, { id: 'x', category: 'flat', value: { id: 'v', kind: 'const', value: 9 }, source: 'srcA' });
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(16);
    game.gameNumSystem.removeTagEffect(game.state, officeKey, 'x');
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
    game.gameNumSystem.registerTagEffect(game.state, officeKey, { id: 'y', category: 'flat', value: { id: 'v', kind: 'const', value: 5 }, source: 'srcB' });
    game.gameNumSystem.removeTagEffectsBySource(game.state, 'srcB');
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(7);
  });

  test('evaluateWithBreakdown 包含 zone 区贡献明细', () => {
    game.gameNumSystem.registerTagEffect(game.state, officeKey, { id: 'f', category: 'flat', value: { id: 'v', kind: 'const', value: 8 } });
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
        entries: [{ id: 'e1', effects: [], zoneModifiers: [{ target: { kind: 'tag', tag: ['office'] }, category: 'mul', value: 2 }] }],
      }),
    } as unknown as AffectorEngine;
    game.gameNumSystem.syncAffectorZoneEffects(fakeAffector, game.state);
    const records = Object.values(game.state.tagEffects ?? {}).flat();
    expect(records.some(r => r.source?.startsWith('affector:') && r.category === 'mul')).toBe(true);
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, game.state)).toBe(12); // 树内 5×2 + 树外 2
  });

  test('Affector tag modifier uses the pack namespace for a bare tag', () => {
    const fakeAffector = {
      getActiveInstances: () => [
        { instanceId: 'extension-pack@spot', packId: 'extension:affectorpack:pack', mountEntityId: 'spot', state: 'Active', activeEntryIds: ['e1'] },
      ],
      getPack: (id: string) => ({
        id,
        entries: [{ id: 'e1', effects: [], zoneModifiers: [{ target: { kind: 'tag', tag: ['office'] }, category: 'mul', value: 2 }] }],
      }),
    } as unknown as AffectorEngine;
    game.gameNumSystem.syncAffectorZoneEffects(fakeAffector, game.state);
    expect(game.state.tagEffects?.['extension:office']).toHaveLength(1);
    expect(game.state.tagEffects?.['base:office']).toBeUndefined();
  });
});
