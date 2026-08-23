// ============================================================
// engine/passive-pool.test.ts — 被动闲聊池系统
// 覆盖：树状抽取（路径权重连乘）、gate 剪枝与 reactor 反射、
// 孤儿 entry 默认根池、环防护、无池退化平铺。
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { PassivePoolSystem } from '../../src/engine/passive-pool-system';
import { ConditionSystem } from '../../src/engine/condition-system';
import { EventBus } from '../../src/engine/event-bus';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import type { Registry } from '../../src/engine/registry';
import type { PassivePoolDef, PassiveStoryEntry, PlayerState } from '../../src/engine/types';

function entry(id: string, weight = 1): PassiveStoryEntry {
  return {
    id, storyId: id, type: 'passive', availableInits: [], repeatable: true,
    weight, triggerCondition: { type: 'AND', conditions: [] },
  };
}

function makeState(): PlayerState {
  return {
    resources: {}, spotLevels: {}, spotManagers: {}, unlockedEnhancements: [],
    activeInit: '', totalFrames: 0, storyLog: [], inventory: {}, flags: {},
  } as unknown as PlayerState;
}

function setup(pools: PassivePoolDef[], entries: PassiveStoryEntry[]) {
  const bus = new EventBus();
  const cs = new ConditionSystem();
  const registry = {
    passivePools: new Map(pools.map(p => [p.id, p])),
    passiveStories: new Map(entries.map(e => [e.id, e])),
  } as unknown as Registry;
  const system = new PassivePoolSystem(registry, cs, bus);
  return { system, bus, cs };
}

const eligibleAll = () => true;

describe('PassivePoolSystem 树状抽取', () => {
  test('路径权重连乘：gate 剪除的分支不参与候选', () => {
    const pools: PassivePoolDef[] = [
      {
        id: 'root',
        children: [
          { id: 'sub_summer', weight: 3 },
          { id: 'sub_daily', weight: 1 },
        ],
      },
      { id: 'sub_summer', children: [{ id: 'chat_beach' }] },
      { id: 'sub_daily', children: [{ id: 'chat_tea' }] },
    ];
    const entries = [entry('chat_beach'), entry('chat_tea')];
    const { system } = setup(pools, entries);
    // 无 gate：两个叶子都可达（权重 3 与 1）
    const picked = new Set<string>();
    for (let i = 0; i < 200; i++) picked.add(system.pick(makeState(), eligibleAll)!);
    expect(picked).toEqual(new Set(['chat_beach', 'chat_tea']));
  });

  test('gate 不过整枝剪除；reactor 反射：事件翻转条件后无需手动重算', () => {
    const pools: PassivePoolDef[] = [
      {
        id: 'root',
        children: [
          { id: 'sub_event', weight: 3 },
          { id: 'sub_normal', weight: 1 },
        ],
      },
      {
        id: 'sub_event',
        condition: { type: 'AND', conditions: [{ target: 'flag', key: 'summer_open', comparator: '==', value: 1 }] },
        children: [{ id: 'chat_beach' }],
      },
      { id: 'sub_normal', children: [{ id: 'chat_tea' }] },
    ];
    const entries = [entry('chat_beach'), entry('chat_tea')];
    const { system, bus } = setup(pools, entries);
    const state = makeState();

    // gate 未满足：只可能抽到 chat_tea
    for (let i = 0; i < 50; i++) expect(system.pick(state, eligibleAll)).toBe('chat_tea');

    // setFlag 经事件总线广播 flagChanged → 池标脏 → 下次查询重算（无需手动 recheck）
    state.flags['summer_open'] = '1';
    bus.emit({ type: 'flagChanged', flag: 'summer_open', value: '1' });
    const picked = new Set<string>();
    for (let i = 0; i < 300; i++) picked.add(system.pick(state, eligibleAll)!);
    // P(300 次全不中某叶子) < 1e-10，断言稳定
    expect(picked).toEqual(new Set(['chat_beach', 'chat_tea']));
  });

  test('孤儿 entry 自动归入默认根池；显式引用的不重复出现', () => {
    const pools: PassivePoolDef[] = [
      { id: 'root', children: [{ id: 'chat_office' }] },
    ];
    const entries = [entry('chat_office'), entry('chat_orphan')];
    const { system } = setup(pools, entries);
    const picked = new Set<string>();
    for (let i = 0; i < 200; i++) picked.add(system.pick(makeState(), eligibleAll)!);
    expect(picked).toEqual(new Set(['chat_office', 'chat_orphan']));
  });

  test('环防护：池互相引用不死循环', () => {
    const pools: PassivePoolDef[] = [
      { id: 'a', children: [{ id: 'b' }] },
      { id: 'b', children: [{ id: 'a' }, { id: 'chat_x' }] },
    ];
    const entries = [entry('chat_x')];
    const { system } = setup(pools, entries);
    expect(system.pick(makeState(), eligibleAll)).toBe('chat_x');
  });

  test('无池声明时退化为平铺模型（默认根池承载全部）', () => {
    const entries = [entry('e1'), entry('e2', 0)]; // weight=0 的叶子不可抽
    const { system } = setup([], entries);
    for (let i = 0; i < 20; i++) expect(system.pick(makeState(), eligibleAll)).toBe('e1');
  });

  test('叶子资格谓词剪除后无候选返回 null', () => {
    const entries = [entry('e1')];
    const { system } = setup([], entries);
    expect(system.pick(makeState(), () => false)).toBeNull();
  });
});

// ============================================================
// 集成：基础数据包夏莱办公室池树（GameInstance 全链路）
// ============================================================
describe('基础数据包池树（schale_office）', () => {
  let game: GameInstance;
  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame('base:init:schale_office');
  });
  afterEach(() => game.stop());

  /** 排干自动展开的欢迎剧情，进入剧情空闲状态。 */
  function finishWelcome(): void {
    let guard = 0;
    while (game.getView().currentStory && guard++ < 50) {
      const r = game.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') game.advanceStory(0);
    }
  }

  const pickable = (times = 200): Set<string> => {
    const seen = new Set<string>();
    for (let i = 0; i < times; i++) {
      const id = game.passivePoolSystem.pick(game.state, e => e.weight > 0);
      if (id) seen.add(id);
    }
    return seen;
  };

  test('初始仅日常池可抽；office 设施归零关闭专题池，重开即时恢复', () => {
    // 初始：默认设施（信用点制造机等带 office 标签）已拥有 → 专题池开放
    expect(game.passivePoolSystem.isAvailable('base:pool:schale_office_topic', game.state)).toBe(true);
    expect(game.passivePoolSystem.isAvailable('base:pool:schale_night_owl', game.state)).toBe(false);
    const initial = pickable();
    expect(initial.has('base:story:schale_tea')).toBe(true);

    // 归零全部 office 标签设施 → tagCollectedChanged → 专题池关闭
    for (const [spotId, level] of Object.entries(game.state.spotLevels)) {
      if ((game.registry.spots.get(spotId)?.tags ?? []).some(t => t[0] === 'office') && level > 0) {
        game.mutations.setSpotLevel(spotId, 0);
      }
    }
    expect(game.tagStatService.collectedCount('spots', 'office')).toBe(0);
    expect(game.passivePoolSystem.isAvailable('base:pool:schale_office_topic', game.state)).toBe(false);
    const closed = pickable();
    expect(closed.has('base:story:schale_vending')).toBe(false);
    expect(closed.has('base:story:schale_tea')).toBe(true);

    // 重新解锁 → 专题池即时恢复（无需手动 recheck）
    game.mutations.setSpotLevel('base:spot:credit_printer', 1);
    expect(game.passivePoolSystem.isAvailable('base:pool:schale_office_topic', game.state)).toBe(true);
    const reopened = pickable();
    expect(reopened.has('base:story:schale_vending')).toBe(true);
    expect(reopened.has('base:story:schale_tea')).toBe(true);
  });

  test('night_mode flag 开启后深夜池可抽（经事件反射）', () => {
    game.mutations.setFlag('night_mode', '1');
    const seen = pickable(80);
    expect(seen.has('base:story:schale_night')).toBe(true);
  });

  test('完成「日程表攻防」后深夜模式链路全通（Talklet 效果 → flag → 池 gate）', () => {
    finishWelcome();
    const api = game as unknown as { startStory(id: string, t: 'passive'): { success: boolean } };
    const rewarded: { flags: string[] }[] = [];
    game.eventBus.on('storyRewarded', e => {
      if (e.type === 'storyRewarded') rewarded.push({ flags: e.flags });
    });
    expect(game.passivePoolSystem.isAvailable('base:pool:schale_night_owl', game.state)).toBe(false);

    // 完成两页闲聊（第二页 Talklet 效果置 night_mode）
    expect(api.startStory('base:story:schale_planner', 'passive').success).toBe(true);
    let r = game.advanceStory();
    while (r.success && 'finished' in r && !r.finished) r = game.advanceStory();
    expect(r.success && 'finished' in r && r.finished).toBe(true);

    expect(game.state.flags['night_mode']).toBe('1');
    expect(rewarded.some(e => e.flags.includes('night_mode'))).toBe(true);
    expect(game.passivePoolSystem.isAvailable('base:pool:schale_night_owl', game.state)).toBe(true);

    // 抽选树确实可达深夜剧情（谓词限定只允许 night 命中）
    expect(game.passivePoolSystem.pick(game.state, e => e.id === 'base:story:schale_night')).toBe('base:story:schale_night');
    // triggerPassiveStory 全链路也能抽到（多次抽样）
    const seen = pickable(80);
    expect(seen.has('base:story:schale_night')).toBe(true);
  });
});
