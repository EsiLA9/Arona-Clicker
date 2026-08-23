// ============================================================
// engine/tick-system.test.ts
// ============================================================
import { describe, test, expect } from 'vitest';
import { Registry } from '../../src/engine/registry';
import { EventBus } from '../../src/engine/event-bus';
import { ValueSystem } from '../../src/engine/value-system';
import { TickSystem } from '../../src/engine/tick-system';
import { PlayerState, Datapack, Character } from '../../src/engine/types';

const simpleDatapack: Datapack = {
  name: 'tick-test',
  version: '1.0.0',
  inits: [
    { id: 'init_t', name: 'T', description: '', defaultAreas: ['area_t'] },
  ],
  areas: [
    { id: 'area_t', initId: 'init_t', name: 'TA', description: '', defaultSpots: ['spot_t'] },
  ],
  spots: [
    {
      id: 'spot_t',
      areaId: 'area_t',
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
    spotLevels: { spot_t: level },
    spotManagers: {},
    unlockedEnhancements: [],
    activeInit: 'init_t',
    totalFrames: 0,
    storyLog: [],
    inventory: {},
    flags: {},
    unlockedInits: ['init_t'],
  };
}

describe('TickSystem', () => {
  test('should produce resources on every unified tick', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const vs = new ValueSystem();
    reg.load(simpleDatapack);
    vs.setFuncletDefs(reg.funcletDefs as Map<string, any>);

    const ts = new TickSystem(reg, vs, bus);
    const state = tickState();
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
    const ts = new TickSystem(reg, vs, bus);
    const state = tickState();
    state.spotManagers.spot_t = Character.Shiroko;
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

    const ts = new TickSystem(reg, vs, bus);
    const state = tickState(0); // level = 0 → 未解锁
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

    const ts = new TickSystem(reg, vs, bus);
    const state = tickState();
    ts.setState(state);

    const events: any[] = [];
    bus.on('spotProduced', (e) => events.push(e));

    for (let i = 0; i < 3; i++) ts.tick();
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ spotId: 'spot_t', resource: 'credit', amount: 5 });
  });

  test('should emit tick event each frame', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const vs = new ValueSystem();
    reg.load(simpleDatapack);
    vs.setFuncletDefs(reg.funcletDefs as Map<string, any>);

    const ts = new TickSystem(reg, vs, bus);
    const state = tickState();
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
    const ts1 = new TickSystem(reg, vs, bus);
    ts1.setState(state1);
    ts1.tick(); // frame 1 settles immediately

    // 新实例使用新状态，恢复计时器
    const state2 = tickState();
    const ts2 = new TickSystem(reg, vs, bus);
    ts2.setState(state2);
    ts2.tick(); // 下一帧仍然结算

    // state2 应该是产出状态
    expect(state2.resources.credit).toBe(5);
  });
});
