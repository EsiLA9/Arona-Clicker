import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/tick-system.test.ts
// ============================================================
import { describe, test, expect } from 'vitest';
import { Registry } from '../../src/data-services/registry/registry';
import { EventBus } from '../../src/engine/core/event-bus';
import { ValueSystem } from '../../src/engine/expression/value-system';
import { TickSystem } from '../../src/engine/system/tick-system';
import { GameNumSystem } from '../../src/engine/expression/game-num';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';
import { StateMutationService } from '../../src/arona-clicker/state/state-mutation-service';

const simpleDatapack: Datapack = {
  name: 'tick-test',
  version: '1.0.0',
  inits: [
    { id: 'test:init:init_t', name: 'T', description: '', defaultAreas: ['test:area:area_t'] },
  ],
  areas: [
    { id: 'test:area:area_t', initId: 'test:init:init_t', name: 'TA', description: '', defaultSpots: ['test:spot:spot_t'] },
  ],
  spots: [
    {
      id: 'test:spot:spot_t',
      areaId: 'test:area:area_t',
      name: 'Test Producer',
      description: '',
      baseCost: { type: 'const', value: 10 },
      baseCostResource: 'credit',
      baseYield: { type: 'const', value: 5 },
      baseYieldResource: 'credit',
      baseCapacity: 0,       // 无容量限制
      managerBonusYield: { type: 'const', value: 3 },
      levelUpgrades: [],
      tags: [],
    },
  ],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
  characterBonuses: [],
};

function tickState(level: number = 1): PlayerState {
  return {
    resources: { credit: 0 },
    spotLevels: { 'test:spot:spot_t': level },
    spotManagers: {},
    unlockedEnhancements: [],
    activeInit: 'test:init:init_t',
    totalFrames: 0,
    storyLog: [],
    inventory: {},
    flags: {},
    unlockedInits: ['test:init:init_t'],
  };
}

/** 为测试构造最小可用的 GameNumSystem（统一数值路径所需）。 */
function makeGameNumSystem(reg: Registry, vs: ValueSystem, bus: EventBus, state: PlayerState): GameNumSystem {
  const gns = new GameNumSystem({
    registry: reg,
    valueSystem: vs,
    affectorEngine: { getActiveInstances: () => [], getPack: () => undefined } as any,
    eventBus: bus,
  });
  gns.buildAll(state);
  return gns;
}

describe('TickSystem', () => {
  test('should produce resources on every unified tick', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const vs = new ValueSystem();
    reg.load(simpleDatapack);
    vs.setFuncletDefs(reg.funcletDefs as Map<string, any>);

    const state = tickState();
    const gns = makeGameNumSystem(reg, vs, bus, state);
    const ts = new TickSystem(vs, bus, gns, new StateMutationService(bus));
    ts.setState(state);

    // baseYield=5 is the output for one unified tick.
    ts.tick();
    expect(state.resources.credit).toBe(5);
    ts.tick();
    expect(state.resources.credit).toBe(10);
  });

  test('F-01: manager 存在不产生任何产出加成（冻结）', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const vs = new ValueSystem();
    reg.load(simpleDatapack);
    const state = tickState();
    state.spotManagers['test:spot:spot_t'] = Character.Shiroko;
    const gns = makeGameNumSystem(reg, vs, bus, state);
    const ts = new TickSystem(vs, bus, gns, new StateMutationService(bus));
    ts.setState(state);

    // managerBonusYield 声明 3，但已冻结：产出与无 manager 完全一致
    ts.tick();
    expect(state.resources.credit).toBe(5);
  });

  test('should skip unleveled spots', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const vs = new ValueSystem();
    reg.load(simpleDatapack);
    vs.setFuncletDefs(reg.funcletDefs as Map<string, any>);

    const state = tickState(0); // level = 0 → 未解锁
    const gns = makeGameNumSystem(reg, vs, bus, state);
    const ts = new TickSystem(vs, bus, gns, new StateMutationService(bus));
    ts.setState(state);

    for (let i = 0; i < 6; i++) ts.tick();
    expect(state.resources.credit).toBe(0);
  });

  test('should emit spotProduced event', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const vs = new ValueSystem();
    reg.load(simpleDatapack);
    vs.setFuncletDefs(reg.funcletDefs as Map<string, any>);

    const state = tickState();
    const gns = makeGameNumSystem(reg, vs, bus, state);
    const ts = new TickSystem(vs, bus, gns, new StateMutationService(bus));
    ts.setState(state);

    const events: any[] = [];
    bus.on('spotProduced', (e) => events.push(e));

    for (let i = 0; i < 3; i++) ts.tick();
    expect(events).toHaveLength(3);
    // 产出为 resource 级聚合（跨 spot），spotId 留空
    expect(events[0]).toMatchObject({ spotId: '', resource: 'credit', amount: 5 });
  });

  test('should emit tick event each frame', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const vs = new ValueSystem();
    reg.load(simpleDatapack);
    vs.setFuncletDefs(reg.funcletDefs as Map<string, any>);

    const state = tickState();
    const gns = makeGameNumSystem(reg, vs, bus, state);
    const ts = new TickSystem(vs, bus, gns, new StateMutationService(bus));
    ts.setState(state);

    const frames: number[] = [];
    bus.on('tick', (e) => frames.push((e as any).frame));

    ts.tick();
    ts.tick();
    ts.tick();

    expect(frames).toEqual([1, 2, 3]);
  });

  test('should settle a restored state on the next unified tick', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const vs = new ValueSystem();
    reg.load(simpleDatapack);
    vs.setFuncletDefs(reg.funcletDefs as Map<string, any>);

    const state1 = tickState();
    const gns1 = makeGameNumSystem(reg, vs, bus, state1);
    const ts1 = new TickSystem(vs, bus, gns1, new StateMutationService(bus));
    ts1.setState(state1);
    ts1.tick(); // frame 1 settles immediately

    // 新实例使用新状态，恢复计时器
    const state2 = tickState();
    const gns2 = makeGameNumSystem(reg, vs, bus, state2);
    const ts2 = new TickSystem(vs, bus, gns2, new StateMutationService(bus));
    ts2.setState(state2);
    ts2.tick(); // 下一帧仍然结算

    // state2 应该是产出状态
    expect(state2.resources.credit).toBe(5);
  });
});
