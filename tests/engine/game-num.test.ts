// ============================================================
// engine/game-num.test.ts — 统一数值注册 + 懒求值（primitiveGain）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { Character, Expr, PlayerState, value } from '../../src/engine/types';
import type { GameNum } from '../../src/engine/game-num';
import { GameNumSystem } from '../../src/engine/game-num';
import { EventBus } from '../../src/engine/event-bus';
import { ValueSystem } from '../../src/engine/value-system';
import { matchesTag } from '../../src/engine/tag';

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

  test('spot subtree expands down to owned/baseLine/tag/enh leaves', () => {
    const spotNode = childrenOf(game.gameNumSystem.getGainNode(CREDIT))
      .find(c => c.id === 'spot:base:spot:credit_printer')!;
    expect(spotNode.kind).toBe('mul');
    expect(childrenOf(spotNode).map(c => c.id)).toEqual([
      'owned:base:spot:credit_printer',
      'baseLine:base:spot:credit_printer',
      'tag:base:spot:credit_printer',
      'enh:base:spot:credit_printer',
    ]);
    // baseLine → add[ baseYield(add[expr, levelLinear]), manager(managerBonus) ]
    const baseLine = childrenOf(spotNode).find(c => c.id === 'baseLine:base:spot:credit_printer')!;
    expect(baseLine.kind).toBe('add');
    expect(childrenOf(baseLine).map(c => c.kind)).toEqual(['add', 'managerBonus']);
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
    // 购买 能量饮料后勤 Enhancement（挂载 base:pack:energy_drink，+1 credit/tick）
    game.purchaseEnhancement('base:enh:energy_supply');
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
    const enh = [...game.registry.enhancements.values()].find(e =>
      !!e.productionMultiplier &&
      !game.state.unlockedEnhancements.includes(e.id) &&
      ((e.productionTags ?? []).length === 0 ||
        (e.productionTags ?? []).some(q => spotTags.some(t => matchesTag(t, q))))
    );
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
