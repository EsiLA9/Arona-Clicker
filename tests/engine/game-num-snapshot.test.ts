// ============================================================
// engine/game-num-snapshot.test.ts — 行为快照（todoTask/taskGameNum/TASK.md）
//
// 作用：把 GameNum 区表 / 显式层级树 / flows 分发 / 失效的当前语义锁进测试，作为
//   Phase 1（删 childMulMap 投影）、Phase 5（精确失效）与 Phase 6（显式四级层级树）
//   的安全网。Phase 6 起 hierarchy 组内相加语义升级为逐级连乘，相关断言按新结构重锚定。
//
// 合成 fixture：最小 registry（2 init / 3 area / 4 spot）+ 可注入 fake Affector，
//   便于精确控制 tags 与挂载，不依赖 baseDatapack 的具体数据。
// ============================================================
import { describe, test, expect } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { EventBus } from '../../src/engine/core/event-bus';
import { ValueSystem } from '../../src/engine/expression/value-system';
import { GameNumSystem } from '../../src/engine/expression/game-num';
import { aggregateZone } from '../../src/engine/expression/game-num-eval';
import { tagPath, tagId } from '../../src/engine/core/tag';
import type { PlayerState } from '../../src/engine/types';
import type { AffectorEngine } from '../../src/engine/effect/affector-engine';

const CREDIT = 'credit';
const GOLD = 'gold';

const office = tagPath('office');
const creditTag = tagPath('credit');
const areaTag = tagPath('area_tag');
const initTag = tagPath('init_tag');

const constV = (n: number) => ({ id: `c${n}`, kind: 'const', value: n } as const);
const mulRecord = (id: string, value: number, extra: Partial<{ resource: string; multiplierId: string; min: number; max: number; source: string }> = {}) =>
  ({ id, category: 'mul' as const, value: constV(value), ...extra });
const flatRecord = (id: string, value: number) => ({ id, category: 'flat' as const, value: constV(value) });
const customRecord = (id: string, multiplierId: string, value: number) => ({ id, category: 'custom' as const, multiplierId, value: constV(value) });
const boundRecord = (id: string, min: number, max: number, source?: string) => ({ id, category: 'bound' as const, min, max, ...(source ? { source } : {}) });

interface Fixture {
  system: GameNumSystem;
  vs: ValueSystem;
  state: PlayerState;
}

/** 最小合成世界：s1/s2 在 areaA（initI），s3 在 areaB（initI），s4 在 areaC（initOther）。
 *  baseYield：s1=5, s2=10, s3=20, s4=40；s1/s2 带 office 标签，s1 另带 credit 标签。 */
function makeFixture(affector: unknown = { getActiveInstances: () => [], getPack: () => undefined }): Fixture {
  const bus = new EventBus();
  const vs = new ValueSystem();
  const spot = (id: string, areaId: string, baseYield: number, tags: string[][]) => ({
    id, areaId, baseYieldResource: CREDIT, baseYield: { type: 'const', value: baseYield }, tags,
  });
  const registry = {
    spots: new Map([
      ['s1', spot('s1', 'areaA', 5, [office, creditTag])],
      ['s2', spot('s2', 'areaA', 10, [office])],
      ['s3', spot('s3', 'areaB', 20, [])],
      ['s4', spot('s4', 'areaC', 40, [])],
    ]),
    areas: new Map([
      ['areaA', { id: 'areaA', initId: 'initI', tags: [areaTag] }],
      ['areaB', { id: 'areaB', initId: 'initI', tags: [] }],
      ['areaC', { id: 'areaC', initId: 'initOther', tags: [] }],
    ]),
    inits: new Map([
      ['initI', { id: 'initI', tags: [initTag] }],
      ['initOther', { id: 'initOther', tags: [] }],
    ]),
    enhancements: new Map(),
  };
  // T6：spot tag 读取走 effectiveSpotTags（无覆盖时回声明 tags）
  (registry as unknown as { effectiveSpotTags: (id: string) => string[][] }).effectiveSpotTags = (id: string) => {
    const s = registry.spots.get(id);
    return s?.tags ?? [];
  };
  const system = new GameNumSystem({
    valueSystem: vs,
    registry: registry as never,
    characterSystem: { getTagBonus: () => 1 } as never,
    affectorEngine: affector as never,
    eventBus: bus,
  });
  const state = {
    resources: { [CREDIT]: 0, [GOLD]: 0 },
    spotLevels: { s1: 1, s2: 1, s3: 1, s4: 1 },
    spotManagers: {},
    unlockedEnhancements: [],
    activeInit: 'initI',
    totalFrames: 0,
  } as unknown as PlayerState;
  system.buildAll(state);
  return { system, vs, state };
}

const officeKey = tagId(office);
const creditKey = tagId(creditTag);
const areaKey = tagId(areaTag);
const initKey = tagId(initTag);
const s1Scope = { kind: 'spot' as const, id: 's1' };
const areaAScope = { kind: 'area' as const, id: 'areaA' };
const initIScope = { kind: 'init' as const, id: 'initI' };

describe('Phase 0 快照：zone 聚合语义（state 表聚合）', () => {
  test('空区：flat → 0，mul → 1', () => {
    const { system, state } = makeFixture();
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'flat', CREDIT), state)).toBe(0);
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', CREDIT), state)).toBe(1);
  });

  test('flat 多 tag 自下而上求和', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, officeKey, flatRecord('f1', 3));
    system.registerTagEffect(state, creditKey, flatRecord('f2', 4));
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'flat', CREDIT), state)).toBe(7);
    // s2 只有 office 标签 → 只吃 f1
    expect(system.evaluate(system.buildZoneNode({ kind: 'spot', id: 's2' }, 'flat', CREDIT), state)).toBe(3);
  });

  test('mul 单记录：区值 = 1 + (f - 1)', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, officeKey, mulRecord('m1', 1.5));
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', CREDIT), state)).toBe(1.5);
  });

  test('mul 多记录同组：1 + Σ(f-1)（加法语义，非连乘）', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, officeKey, mulRecord('m1', 1.5));
    system.registerTagEffect(state, officeKey, mulRecord('m2', 2));
    // 同 tag 两条 mul 都进 defaultMul 组：1 + 0.5 + 1 = 2.5
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', CREDIT), state)).toBe(2.5);
  });

  test('custom 按 multiplierId 分组：同组连乘、跨组连乘', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, officeKey, customRecord('c1', 'vip', 2));
    system.registerTagEffect(state, officeKey, customRecord('c2', 'vip', 3));
    system.registerTagEffect(state, officeKey, customRecord('c3', 'gold', 4));
    // vip 组 2×3 = 6，gold 组 4 → 6 × 4 = 24（组内/组间均连乘，分桶语义）
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', CREDIT), state)).toBe(24);
  });

  test('bound 跨 source 合并：min 取 max、max 取 min', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, officeKey, boundRecord('b1', 1, 5, 'srcA'));
    system.registerTagEffect(state, creditKey, boundRecord('b2', 2, 4, 'srcB'));
    system.registerTagEffect(state, officeKey, mulRecord('m1', 2));
    // bound 合并为 [2,4]，mul 2 落区间内 → 2
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', CREDIT), state)).toBe(2);
  });

  test('bound 非法区间（min > max）不夹取', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, officeKey, boundRecord('b1', 3, 1));
    system.registerTagEffect(state, officeKey, mulRecord('m1', 2));
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', CREDIT), state)).toBe(2);
  });

  test('record.resource 限定：只影响对应资源的 zone 节点', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, officeKey, mulRecord('m1', 2, { resource: CREDIT }));
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', CREDIT), state)).toBe(2);
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', GOLD), state)).toBe(1);
  });

  test('registerTagEffect 同 id 覆盖旧记录（不重复累计）', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, officeKey, mulRecord('m1', 2));
    system.registerTagEffect(state, officeKey, mulRecord('m1', 3));
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', CREDIT), state)).toBe(3);
  });

  test('removeTagEffect 撤销后区值回落', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, officeKey, mulRecord('m1', 2, { source: 'srcA' }));
    system.removeTagEffect(state, officeKey, 'm1');
    expect(system.evaluate(system.buildZoneNode(s1Scope, 'mul', CREDIT), state)).toBe(1);
  });
});

describe('Phase 6 快照：显式层级树（Area/Init 乘区逐级连乘）', () => {
  test('area tag mul 作用于其下所有 spot 的 base 链', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, areaKey, mulRecord('am', 2));
    // areaA: (5+10)×2=30；areaB 20；areaC 40 → initI 50 + initOther 40 = 90
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(90);
    // spot 视图只含自身乘区，不再包含上极乘区（新语义）
    expect(system.evaluate(system.spotSubtrees.get('s1')!, state)).toBe(5);
    expect(system.evaluate(system.spotSubtrees.get('s2')!, state)).toBe(10);
    expect(system.evaluate(system.spotSubtrees.get('s3')!, state)).toBe(20);
    expect(system.evaluate(system.spotSubtrees.get('s4')!, state)).toBe(40);
    // area 乘区值经区节点精确读取
    expect(system.evaluate(system.buildZoneNode(areaAScope, 'mul'), state)).toBe(2);
  });

  test('init tag mul 作用于该 init 全部 area 的 base 链（跨 area）', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, initKey, mulRecord('im', 3));
    // initI: (15+20)×3=105；initOther 40 → 145
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(145);
    expect(system.evaluate(system.spotSubtrees.get('s1')!, state)).toBe(5);
    expect(system.evaluate(system.spotSubtrees.get('s4')!, state)).toBe(40); // initOther 不受影响
    expect(system.evaluate(system.buildZoneNode(initIScope, 'mul'), state)).toBe(3);
  });

  test('area 与 init 乘区逐级连乘（替代旧 hierarchy 组内相加）', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, areaKey, mulRecord('am', 2));
    system.registerTagEffect(state, initKey, mulRecord('im', 3));
    // base 链逐级连乘：s1 5×2×3、s2 10×2×3、s3 20×3、s4 40 → 30+60+60+40 = 190
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(190);
  });

  test('entity 精确引用 area/init 键同样逐级连乘', () => {
    const { system, state } = makeFixture();
    system.registerEntityEffect(state, 'area:areaA', mulRecord('am', 2));
    system.registerEntityEffect(state, 'init:initI', mulRecord('im', 3));
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(190);
  });

  test('层级视图与乘区各归其位（getSpotMultiplier 已删，读区节点）', () => {
    const { system, state } = makeFixture();
    system.registerTagEffect(state, areaKey, mulRecord('am', 2));
    system.registerTagEffect(state, initKey, mulRecord('im', 3));
    // spot 自身视图不含上极乘区；上极乘区经区节点精确读取
    expect(system.evaluate(system.spotSubtrees.get('s1')!, state)).toBe(5);
    expect(system.evaluate(system.buildZoneNode(areaAScope, 'mul'), state)).toBe(2);
    expect(system.evaluate(system.buildZoneNode(initIScope, 'mul'), state)).toBe(3);
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(190);
  });
});

describe('Phase 0 快照：双聚合路径对拍（Phase 1 安全网）', () => {
  const zoneOf = (system: GameNumSystem, scope: { kind: 'spot' | 'area' | 'init'; id: string }, part: 'flat' | 'mul', resource?: string) =>
    system.buildZoneNode(scope, part, resource);

  test('单条 mul：childMulMap 与 aggregateZone 一致', () => {
    const { system, vs, state } = makeFixture();
    system.registerTagEffect(state, officeKey, mulRecord('m1', 1.5));
    const node = zoneOf(system, s1Scope, 'mul', CREDIT);
    expect(system.evaluate(node, state)).toBe(aggregateZone(state, s1Scope, [office], CREDIT, 'mul', vs));
  });

  test('flat 多条：两路径一致（求和）', () => {
    const { system, vs, state } = makeFixture();
    system.registerTagEffect(state, officeKey, flatRecord('f1', 3));
    system.registerTagEffect(state, creditKey, flatRecord('f2', 4));
    const node = zoneOf(system, s1Scope, 'flat', CREDIT);
    expect(system.evaluate(node, state)).toBe(aggregateZone(state, s1Scope, [office, creditTag], CREDIT, 'flat', vs));
  });

  test('custom 跨组 + mul：两路径一致', () => {
    const { system, vs, state } = makeFixture();
    system.registerTagEffect(state, officeKey, mulRecord('m1', 1.5));
    system.registerTagEffect(state, officeKey, customRecord('c1', 'vip', 2));
    system.registerTagEffect(state, officeKey, customRecord('c2', 'gold', 3));
    const node = zoneOf(system, s1Scope, 'mul', CREDIT);
    expect(system.evaluate(node, state)).toBe(aggregateZone(state, s1Scope, [office], CREDIT, 'mul', vs));
  });

  test('bound 跨 source：两路径一致', () => {
    const { system, vs, state } = makeFixture();
    system.registerTagEffect(state, officeKey, boundRecord('b1', 1, 5, 'srcA'));
    system.registerTagEffect(state, creditKey, boundRecord('b2', 2, 4, 'srcB'));
    system.registerTagEffect(state, officeKey, mulRecord('m1', 2));
    const node = zoneOf(system, s1Scope, 'mul', CREDIT);
    expect(system.evaluate(node, state)).toBe(aggregateZone(state, s1Scope, [office, creditTag], CREDIT, 'mul', vs));
  });

  test('resource 限定：两路径一致', () => {
    const { system, vs, state } = makeFixture();
    system.registerTagEffect(state, officeKey, mulRecord('m1', 2, { resource: CREDIT }));
    const node = zoneOf(system, s1Scope, 'mul', CREDIT);
    expect(system.evaluate(node, state)).toBe(aggregateZone(state, s1Scope, [office], CREDIT, 'mul', vs));
    expect(system.evaluate(zoneOf(system, s1Scope, 'mul', GOLD), state))
      .toBe(aggregateZone(state, s1Scope, [office], GOLD, 'mul', vs));
  });

  test('area/init zone 单条 mul：两路径一致', () => {
    const { system, vs, state } = makeFixture();
    system.registerTagEffect(state, areaKey, mulRecord('am', 2));
    system.registerTagEffect(state, initKey, mulRecord('im', 3));
    expect(system.evaluate(zoneOf(system, areaAScope, 'mul'), state))
      .toBe(aggregateZone(state, areaAScope, [areaTag], undefined, 'mul', vs));
    expect(system.evaluate(zoneOf(system, initIScope, 'mul'), state))
      .toBe(aggregateZone(state, initIScope, [initTag], undefined, 'mul', vs));
  });

  test('同组多条 mul：两路径统一为加法 1+Σ(f-1)', () => {
    const { system, vs, state } = makeFixture();
    system.registerTagEffect(state, officeKey, mulRecord('m1', 1.5));
    system.registerTagEffect(state, officeKey, mulRecord('m2', 2));
    const node = zoneOf(system, s1Scope, 'mul', CREDIT);
    const viaMap = system.evaluate(node, state);
    const viaTable = aggregateZone(state, s1Scope, [office], CREDIT, 'mul', vs);
    expect(viaMap).toBe(viaTable);
    expect(viaMap).toBe(2.5); // 1 + 0.5 + 1
  });

  test('同 multiplierId 多条 custom：两路径统一为组内连乘 Πf', () => {
    const { system, vs, state } = makeFixture();
    system.registerTagEffect(state, officeKey, customRecord('c1', 'vip', 2));
    system.registerTagEffect(state, officeKey, customRecord('c2', 'vip', 3));
    const node = zoneOf(system, s1Scope, 'mul', CREDIT);
    const viaMap = system.evaluate(node, state);
    const viaTable = aggregateZone(state, s1Scope, [office], CREDIT, 'mul', vs);
    expect(viaMap).toBe(viaTable);
    expect(viaMap).toBe(6); // 2 × 3
  });

  test('通配 entity 键：统一后两路径均生效（桥接层把 * 展开为逐实体键，无数据影响）', () => {
    const { system, vs, state } = makeFixture();
    system.registerEntityEffect(state, 'area:*', mulRecord('w', 2));
    const node = system.buildZoneNode(areaAScope, 'mul');
    const viaMap = system.evaluate(node, state);
    const viaTable = aggregateZone(state, areaAScope, [areaTag], undefined, 'mul', vs);
    expect(viaMap).toBe(viaTable);
    expect(viaMap).toBe(2);
  });
});

// KNOWN DIVERGENCE 已统一：分桶乘区语义下，buildZoneNode（生产路径）与 aggregateZone（表路径）
// 结果一致，见上方「双聚合路径对拍」三个新用例（同组 mul=加法 / 同 multiplierId custom=连乘 / 通配键生效）。

describe('Phase 6 快照：flows 层级分发（按 mountEntityId）', () => {
  // 实例 i1 挂 s1（entry e1 产 credit 3 / gold 5，e2 产 credit 7，e3 未激活），
  // i2 挂 s2（entry e1 产 credit 3 / gold 5）。
  const flowsAffector = {
    getActiveInstances: () => [
      { instanceId: 'i1', packId: 'p1', mountEntityId: 's1', activeEntryIds: ['e1', 'e2'] },
      { instanceId: 'i2', packId: 'p2', mountEntityId: 's2', activeEntryIds: ['e1'] },
    ],
    getPack: (id: string) => ({
      id,
      entries: [
        { id: 'e1', effects: [], flows: [{ resource: CREDIT, value: 3 }, { resource: GOLD, value: 5 }] },
        { id: 'e2', effects: [], flows: [{ resource: CREDIT, value: { type: 'const', value: 7 } }] },
        { id: 'e3', effects: [], flows: [{ resource: CREDIT, value: 100 }] },
      ],
    }),
  } as unknown as AffectorEngine;

  test('spot 挂载的 flows 分发到对应 spot 的 spotExtra 节点', () => {
    const { system, state } = makeFixture(flowsAffector);
    // s1 视图 = base 5 + flows(3+7)=10 → 15；s2 = 10+3=13；s3/s4 无挂载
    expect(system.evaluate(system.spotSubtrees.get('s1')!, state)).toBe(15);
    expect(system.evaluate(system.spotSubtrees.get('s2')!, state)).toBe(13);
    expect(system.evaluate(system.spotSubtrees.get('s3')!, state)).toBe(20);
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(15 + 13 + 20 + 40);
  });

  test('跨资源 flows 进入对应资源树的 spot 节点', () => {
    const { system, state } = makeFixture(flowsAffector);
    // gold 树中 s1..s4 的 base 恒 0，仅承载挂载的 gold flows：s1 5 + s2 5
    expect(system.evaluateResourceGain(GOLD, state)).toBe(10);
  });

  test('未激活 entry 不参与 flows 求值', () => {
    const { system, state } = makeFixture(flowsAffector);
    // e3（100 credit）未激活：s1 视图不含 100
    expect(system.evaluate(system.spotSubtrees.get('s1')!, state)).toBe(15);
  });

  test('未拥有 spot 的 flows 仍产出（flows 不受 owned 门控）', () => {
    const { system, state } = makeFixture(flowsAffector);
    for (const key of Object.keys(state.spotLevels)) (state as any).spotLevels[key] = 0;
    system.invalidateProduction();
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(13); // 无 spot 产出，仅 flows
    expect(system.evaluateResourceGain(GOLD, state)).toBe(10);
  });
});

describe('Phase 0 快照：失效行为', () => {
  test('求值缓存后直接改 state 需 invalidateProduction 才反映新值', () => {
    const { system, state } = makeFixture();
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(75); // 5+10+20+40
    (state as any).spotLevels.s1 = 0;
    // 未经失效：仍返回旧缓存
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(75);
    system.invalidateProduction();
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(70);
  });

  test('registerTagEffect 内部 markDirty：注册后无需手动失效立即生效', () => {
    const { system, state } = makeFixture();
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(75);
    system.registerTagEffect(state, officeKey, mulRecord('m1', 2));
    // s1/s2 命中 office → 5×2 + 10×2 + 20 + 40 = 90
    expect(system.evaluateResourceGain(CREDIT, state)).toBe(90);
  });

  test('多帧 tick 数值持续正确（事件驱动失效，Phase 5 起无每帧 invalidate）', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources['base:resource:credit'] = 0;
    for (let i = 0; i < 5; i++) game.tick();
    expect(game.state.resources['base:resource:credit']).toBe(35); // 5 帧 × 7
    game.stop();
  });

  test('事件驱动失效：spotLevelChanged 后立即反映新值', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.mutations.setSpotLevel('base:spot:credit_printer', 1);
    expect(game.gameNumSystem.evaluateResourceGain('base:resource:credit', game.state)).toBe(7);
    game.mutations.setSpotLevel('base:spot:credit_printer', 3);
    // 1+(3-1)×2 线性 + 功能 3×2 → 5 + 4 + 6 = 15
    expect(game.gameNumSystem.evaluateResourceGain('base:resource:credit', game.state)).toBe(15);
    game.stop();
  });
});
