import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/affector-reconcile.test.ts — Phase 4 Affector 正确性
//
// 覆盖（docs-824/04h-affector-review.md）：
//  1. §1.3 per-tick 陷阱回归：effects 激活沿一次性执行，perTickEffects 每 tick 执行
//  2. §3.3 mount 幂等：重复挂载同一 pack@entity 不重复发放激活沿效果
//  3. §1.1/1.2 reconcileMounts：状态 ↔ 实例对账（补挂 / 卸载失效 / Spot 功能）
//  4. 存档往返：restoreFromSave 后 flows / zoneModifiers / 实例全部恢复
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { AffectorEngine } from '../../src/engine/effect/affector-engine';
import { ConditionSystem } from '../../src/engine/expression/condition-system';
import { EventBus } from '../../src/engine/core/event-bus';
import { Registry } from '../../src/data-services/registry/registry';
import { StateMutationService } from '../../src/arona-clicker/state/state-mutation-service';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { spot } from '../../src/arona-clicker/content/def-factory/spot';
import { area } from '../../src/arona-clicker/content/def-factory/area';
import { init } from '../../src/arona-clicker/content/def-factory/init';
import type { AffectorPackDef } from '../../src/engine/types';
import type { EnhancementDef } from '../../src/data-services/contracts/enhancement';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import type { ZoneModifierDecl } from '../../src/engine/expression/tag-effect';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const ITEM_X = 'test:item:x';
const ENH_X = 'test:enhancement:boost';

function emptyState(): PlayerState {
  return {
    resources: {},
    spotLevels: {},
    spotManagers: {},
    unlockedEnhancements: [],
    activeInit: '',
    totalFrames: 0,
    storyLog: [],
    inventory: {},
    flags: {},
    unlockedInits: [],
  };
}

function makeEngine(): { engine: AffectorEngine; mutations: StateMutationService; registry: Registry } {
  const registry = new Registry();
  const mutations = new StateMutationService(new EventBus());
  const engine = new AffectorEngine(registry, new ConditionSystem(), mutations);
  return { engine, mutations, registry };
}

function asDatapack(partial: Partial<Datapack>): Datapack {
  return {
    name: 'test:dp',
    version: '1',
    inits: [],
    areas: [],
    spots: [],
    items: [],
    enhancements: [],
    activeStories: [],
    passiveStories: [],
    stories: [],
    ...partial,
  } as unknown as Datapack;
}

// ------------------------------------------------------------
// 1. Phase 4.3：effects 激活沿一次性，perTickEffects 每 tick
// ------------------------------------------------------------

describe('Affector effects/perTickEffects 双通道（Phase 4.3）', () => {
  test('effects 中的 addItem 不再随每 tick 重复发放（旧陷阱回归）', () => {
    const state = emptyState();
    const { engine } = makeEngine();
    engine.setState(state);
    engine.load([
      {
        id: 'test:pack:trap',
        entries: [
          {
            id: 'e1',
            effects: [{ op: 'addItem', target: ITEM_X, value: 1 }],
            perTickEffects: [{ op: 'addResource', target: CREDIT, value: 1 }],
          },
        ],
      } as AffectorPackDef,
    ]);
    engine.mount('test:pack:trap', 'holder');
    expect(state.inventory[ITEM_X]).toBe(1);
    for (let i = 0; i < 3; i++) engine.applyActiveEffects();
    expect(state.inventory[ITEM_X]).toBe(1);
    expect(state.resources[CREDIT]).toBe(3);
  });

  test('未声明 perTickEffects 时每 tick 无持续产出', () => {
    const state = emptyState();
    const { engine } = makeEngine();
    engine.setState(state);
    engine.load([
      {
        id: 'test:pack:edge-only',
        entries: [{ id: 'e1', effects: [{ op: 'addResource', target: CREDIT, value: 10 }] }],
      } as AffectorPackDef,
    ]);
    engine.mount('test:pack:edge-only', 'holder');
    expect(state.resources[CREDIT]).toBe(10);
    engine.applyActiveEffects();
    engine.applyActiveEffects();
    expect(state.resources[CREDIT]).toBe(10);
  });
});

// ------------------------------------------------------------
// 2. Phase 4.5：mount 幂等
// ------------------------------------------------------------

describe('Affector mount 幂等（Phase 4.5）', () => {
  test('重复挂载同一 pack@entity 只 recheck，激活沿不重复发放', () => {
    const state = emptyState();
    const { engine } = makeEngine();
    engine.setState(state);
    engine.load([
      {
        id: 'test:pack:grant',
        entries: [{ id: 'e1', effects: [{ op: 'addResource', target: CREDIT, value: 10 }] }],
      } as AffectorPackDef,
    ]);
    const first = engine.mount('test:pack:grant', 'item_x')!;
    expect(state.resources[CREDIT]).toBe(10);
    const second = engine.mount('test:pack:grant', 'item_x')!;
    expect(second).toBe(first);
    expect(second.state).toBe('Active');
    expect(state.resources[CREDIT]).toBe(10);
  });
});

// ------------------------------------------------------------
// 3. Phase 4.1/4.2：reconcileMounts 状态 ↔ 实例对账
// ------------------------------------------------------------

describe('reconcileMounts 状态对账（Phase 4.1/4.2）', () => {
  const sharedPack: AffectorPackDef = {
    id: 'test:pack:own',
    entries: [{ id: 'e1', effects: [{ op: 'addResource', target: CREDIT, value: 7 }] }],
  };
  const entityDp = asDatapack({
    items: [
      {
        id: ITEM_X,
        name: 'X',
        description: '',
        maxStack: 9,
        rarity: 'common',
        type: 'key',
        affectorPackIds: [sharedPack],
      },
    ],
    enhancements: [
      {
        id: ENH_X,
        name: 'Boost',
        description: '',
        effects: [],
        autoApply: true,
        affectorPackIds: [sharedPack],
      } as EnhancementDef,
    ],
  });

  test('补挂：inventory / unlockedEnhancements 中的实体按需挂载并执行激活沿', () => {
    const state = emptyState();
    state.inventory[ITEM_X] = 2;
    state.unlockedEnhancements.push(ENH_X);
    const { engine, registry } = makeEngine();
    engine.setState(state);
    registry.load(entityDp);
    engine.reconcileMounts();
    expect(engine.getInstance(`test:pack:own@${ITEM_X}`)?.state).toBe('Active');
    expect(engine.getInstance(`test:pack:own@${ENH_X}`)?.state).toBe('Active');
    expect(state.resources[CREDIT]).toBe(14);
  });

  test('卸载失效：物品移除后实例 Removed，其余保留', () => {
    const state = emptyState();
    state.inventory[ITEM_X] = 2;
    state.unlockedEnhancements.push(ENH_X);
    const { engine, registry } = makeEngine();
    engine.setState(state);
    registry.load(entityDp);
    engine.reconcileMounts();
    delete state.inventory[ITEM_X];
    engine.reconcileMounts();
    expect(engine.getInstance(`test:pack:own@${ITEM_X}`)?.state).toBe('Removed');
    expect(engine.getInstance(`test:pack:own@${ENH_X}`)?.state).toBe('Active');
    expect(engine.getActiveInstances().map(i => i.instanceId)).toEqual([`test:pack:own@${ENH_X}`]);
  });

  test('Spot 功能：已解锁 Spot 的 linearYield 功能按级对账挂载', () => {
    const SPOT = 'test:spot:printer';
    const { engine, registry } = makeEngine();
    const state = emptyState();
    engine.setState(state);
    registry.load(
      asDatapack({
        inits: [
          init('test:init:a')
            .name('A')
            .desc('测试')
            .areas('test:area:a')
            .build(),
        ],
        areas: [
          area('test:area:a', 'test:init:a')
            .name('A')
            .desc('测试')
            .spots(SPOT)
            .build(),
        ],
        spots: [
          spot(SPOT, 'test:area:a')
            .name('Printer')
            .desc('测试')
            .cost(0)
            .yield(1)
            .capacity(100)
            .linearYield('test:fn:linear', CREDIT, 2)
            .build(),
        ],
      }),
    );
    state.spotLevels[SPOT] = 3;
    engine.reconcileMounts();
    const instance = engine.getInstance(`test:fn:linear@${SPOT}@${SPOT}`);
    expect(instance?.state).toBe('Active');
    state.spotLevels[SPOT] = 0;
    engine.reconcileMounts();
    expect(engine.getInstance(`test:fn:linear@${SPOT}@${SPOT}`)?.state).toBe('Removed');
  });
});

// ------------------------------------------------------------
// 4. 存档往返：restoreFromSave 恢复 Affector（Phase 4.1）
// ------------------------------------------------------------

describe('存档往返恢复 Affector（Phase 4.1）', () => {
  const boostPack: AffectorPackDef = {
    id: 'test:pack:boost',
    entries: [
      {
        id: 'e1',
        effects: [],
        zoneModifiers: [
          {
            target: { kind: 'entity', ref: { kind: 'spot', id: '*' } },
            category: 'mul',
            value: 1.5,
            resource: CREDIT,
          } as ZoneModifierDecl,
        ],
        flows: [{ resource: CREDIT, value: 5 }],
      },
    ],
  };
  const extraDp = asDatapack({
    enhancements: [
      {
        id: ENH_X,
        name: 'Boost',
        description: '',
        effects: [],
        autoApply: true,
        affectorPackIds: [boostPack],
      } as EnhancementDef,
    ],
  });

  let gameA: GameInstance;
  let base: number;

  beforeEach(() => {
    gameA = new GameInstance();
    gameA.init([baseDatapack, extraDp]);
    gameA.inits.startNewGame(OFFICE);
    for (const key of Object.keys(gameA.state.spotLevels)) delete gameA.state.spotLevels[key];
    gameA.state.spotLevels['base:spot:credit_printer'] = 1;
    base = gameA.gameNumSystem.evaluateResourceGain(CREDIT, gameA.state);
  });

  afterEach(() => {
    gameA.stop();
    gameB?.stop();
  });

  let gameB: GameInstance | undefined;

  test('读档后 flows / zoneModifiers / 实例全部恢复', () => {
    // base 7 = spot 子树 5（baseYield）+ linearYield 功能 flows 2（根级加法，不进乘区）
    expect(base).toBe(7);
    expect(gameA.mutations.addEnhancement(ENH_X)).toBe(true);
    const after = gameA.gameNumSystem.evaluateResourceGain(CREDIT, gameA.state);
    // zone mul 只乘 spot 子树：5×1.5 + 功能 flows 2 + boost flows 5 = 14.5
    expect(after).toBeCloseTo(5 * 1.5 + 2 + 5, 6);

    const save = gameA.save();
    gameA.stop();

    gameB = new GameInstance();
    gameB.init([baseDatapack, extraDp]);
    gameB.load(save);
    expect(
      gameB.affectorEngine.getActiveInstances().some(i => i.packId === 'test:pack:boost'),
    ).toBe(true);
    expect(gameB.gameNumSystem.evaluateResourceGain(CREDIT, gameB.state)).toBeCloseTo(5 * 1.5 + 2 + 5, 6);

    gameB.state.resources[CREDIT] = 0;
    gameB.tick();
    expect(gameB.state.resources[CREDIT]).toBeCloseTo(5 * 1.5 + 2 + 5, 6);
  });
});
