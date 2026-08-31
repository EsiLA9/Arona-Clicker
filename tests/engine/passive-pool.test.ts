// ============================================================
// engine/passive-pool.test.ts — 被动闲聊池系统
// 覆盖：树状抽取（路径权重连乘）、gate 剪枝与 reactor 反射、
// 孤儿 entry 默认根池、环防护、无池退化平铺。
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { PassivePoolSystem } from '../../src/engine/system/passive-pool-system';
import { ConditionSystem } from '../../src/engine/expression/condition-system';
import { EventBus } from '../../src/engine/core/event-bus';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import type { Registry } from '../../src/engine/registry/registry';
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
// 聊天空间壁垒 / 冷却 / 阻断（本次需求）
// ============================================================
describe('PassivePoolSystem 壁垒·冷却·阻断', () => {
  test('壁垒：对话空间只抽 owner 命中的 entry，全局闲聊只抽 owner 为空者', () => {
    const entries = [
      entry('chat_global'),
      { ...entry('chat_hibiki'), owner: 'base:variant:hibiki' },
      { ...entry('chat_nozomi'), owner: 'base:variant:nozomi' },
    ];
    const { system } = setup([], entries);
    // 全局闲聊（owner=null）：只收到无 owner 的 chat_global
    for (let i = 0; i < 50; i++) expect(system.pick(makeState(), eligibleAll, { owner: null })).toBe('chat_global');
    // 对话空间 hibiki：只收其 owner 的 chat_hibiki
    for (let i = 0; i < 50; i++) expect(system.pick(makeState(), eligibleAll, { owner: 'base:variant:hibiki' })).toBe('chat_hibiki');
    // 对话空间 nozomi：只收其 owner 的 chat_nozomi
    for (let i = 0; i < 50; i++) expect(system.pick(makeState(), eligibleAll, { owner: 'base:variant:nozomi' })).toBe('chat_nozomi');
  });

  test('壁垒：池级 owner 不匹配则整枝剪除（仅该学生可见专属池）', () => {
    const pools: PassivePoolDef[] = [
      { id: 'root', children: [{ id: 'pool_hibi' }, { id: 'chat_global' }] },
      { id: 'pool_hibi', owner: 'base:variant:hibiki', children: [{ id: 'chat_hibiki' }] },
    ];
    const entries = [entry('chat_hibiki'), entry('chat_global')];
    const { system } = setup(pools, entries);
    expect(system.pick(makeState(), eligibleAll, { owner: null })).toBe('chat_global');
    expect(system.pick(makeState(), eligibleAll, { owner: 'base:variant:hibiki' })).toBe('chat_hibiki');
  });

  test('冷却：entry 被抽取后 cooldownFrames 帧内剪除，过期后恢复', () => {
    const entries = [entry('chat_a'), entry('chat_b')];
    // chat_a 冷却 100 帧
    const { system } = setup([], [{ ...entries[0], cooldownFrames: 100 }, entries[1]]);
    const state = makeState();
    // 模拟 chat_a 被抽中并写入冷却帧
    state.passiveCooldowns = { chat_a: 0 };
    state.totalFrames = 10; // 10 - 0 = 10 < 100 → 冷却中
    expect(system.pick(state, eligibleAll, { cooldowns: state.passiveCooldowns })).toBe('chat_b');
    // 推进到 100 帧后冷却结束
    state.totalFrames = 100; // 100 - 0 = 100 不 < 100 → 解除
    const picked = new Set<string>();
    for (let i = 0; i < 50; i++) picked.add(system.pick(state, eligibleAll, { cooldowns: state.passiveCooldowns })!);
    expect(picked).toEqual(new Set(['chat_a', 'chat_b']));
  });

  test('阻断：学生对话空间锁定后其 entry 被剪除，解除后恢复', () => {
    const entries = [
      entry('chat_global'),
      { ...entry('chat_hibiki'), owner: 'base:variant:hibiki' },
    ];
    const { system } = setup([], entries);
    // 锁定 hibiki 对话空间
    const blocks = { 'base:variant:hibiki': true };
    expect(system.pick(makeState(), eligibleAll, { owner: 'base:variant:hibiki', blocks })).toBeNull();
    // 解除后恢复
    expect(system.pick(makeState(), eligibleAll, { owner: 'base:variant:hibiki', blocks: {} })).toBe('chat_hibiki');
  });
});

// ============================================================
// 阻断态全链路：PassiveStoryEntry.block 播完后锁定对话空间，条件满足后重启
// ============================================================
describe('对话空间阻断态全链路（GameInstance）', () => {
  let game: GameInstance;
  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
  });
  afterEach(() => game.stop());

  function finishWelcome(): void {
    let guard = 0;
    while (game.getView().currentStory && guard++ < 50) {
      const r = game.story.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') game.story.advanceStory(0);
    }
  }

  // 用临时数据包注入一个带 block 的被动闲聊（要求学生到达某区域/满足某 flag 才解锁对话空间）
  test('block 闲聊播完后锁定对话空间，满足 block 条件后由 tick 重启', () => {
    finishWelcome();
    // 复用已有被动闲聊 entry（其 storyId 指向真实 Story），覆盖注册以加 owner + block
    const owner = 'base:variant:hibiki';
    const baseEntry = game.registry.passiveStories.get('base:passivestory:schale_tea')!;
    const blockEntry: PassiveStoryEntry = {
      ...baseEntry,
      owner,
      block: { type: 'AND', conditions: [{ target: 'flag', key: 'met_at_roof', comparator: '==', value: 1 }] },
    };
    (game.registry.passiveStories as Map<string, PassiveStoryEntry>).set(blockEntry.id, blockEntry);

    // 抽中并播完 → 应写入 studentBlocks[owner]（聊天沙盒游标内推进）
    const res = game.story.triggerPassiveStory('base:init:schale_office', owner);
    expect(res.success).toBe(true);
    let r = game.story.advanceStory(undefined, owner);
    while (r.success && 'finished' in r && !r.finished) r = game.story.advanceStory(undefined, owner);
    expect(r.success && 'finished' in r && r.finished).toBe(true);

    expect(game.state.studentBlocks?.[owner]).toBeDefined();
    expect(game.state.studentBlocks?.[owner].entryId).toBe('base:passivestory:schale_tea');

    // 该学生对话空间此刻被阻断：pick 返回 null
    expect(game.passivePoolSystem.pick(game.state, () => true, { owner, blocks: game.state.studentBlocks ?? {} })).toBeNull();

    // 满足条件（玩家到达天台 → 置 flag）
    game.mutations.setFlag('met_at_roof', '1');
    game.tick(); // 复检阻断态

    // 阻断已解除
    expect(game.state.studentBlocks?.[owner]).toBeUndefined();
    expect(game.passivePoolSystem.pick(game.state, () => true, { owner, blocks: game.state.studentBlocks ?? {} })).toBe('base:passivestory:schale_tea');
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
    game.inits.startNewGame('base:init:schale_office');
  });
  afterEach(() => game.stop());

  /** 排干自动展开的欢迎剧情，进入剧情空闲状态。 */
  function finishWelcome(): void {
    let guard = 0;
    while (game.getView().currentStory && guard++ < 50) {
      const r = game.story.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') game.story.advanceStory(0);
    }
  }

  /** 在星野聊天空间播完天台邀约（hoshino_conv_2 → hoshino_rooftop_hint 已读），武装天台 Trigger。 */
  function readRooftopInvite(g: GameInstance): void {
    const r = g.story.startStory('base:passivestory:hoshino_conv_2', 'passive', 'Hoshino');
    expect(r.success).toBe(true);
    let rg = 0;
    while (g.getStoryView('Hoshino') && rg++ < 20) g.story.advanceStory(undefined, 'Hoshino');
    expect(g.state.storyLog.some(s => s.storyId === 'base:story:hoshino_rooftop_hint')).toBe(true);
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
    expect(game.passivePoolSystem.isAvailable('base:passivepool:schale_office_topic', game.state)).toBe(true);
    expect(game.passivePoolSystem.isAvailable('base:passivepool:schale_night_owl', game.state)).toBe(false);
    const initial = pickable();
    expect(initial.has('base:passivestory:schale_tea')).toBe(true);

    // 归零全部 office 标签设施 → tagCollectedChanged → 专题池关闭
    for (const [spotId, level] of Object.entries(game.state.spotLevels)) {
      if ((game.registry.spots.get(spotId)?.tags ?? []).some(t => t[0] === 'office') && level > 0) {
        game.mutations.setSpotLevel(spotId, 0);
      }
    }
    expect(game.tagStatService.collectedCount('spots', 'office')).toBe(0);
    expect(game.passivePoolSystem.isAvailable('base:passivepool:schale_office_topic', game.state)).toBe(false);
    const closed = pickable();
    expect(closed.has('base:passivestory:schale_vending')).toBe(false);
    expect(closed.has('base:passivestory:schale_tea')).toBe(true);

    // 重新解锁 → 专题池即时恢复（无需手动 recheck）
    game.mutations.setSpotLevel('base:spot:credit_printer', 1);
    expect(game.passivePoolSystem.isAvailable('base:passivepool:schale_office_topic', game.state)).toBe(true);
    const reopened = pickable();
    expect(reopened.has('base:passivestory:schale_vending')).toBe(true);
    expect(reopened.has('base:passivestory:schale_tea')).toBe(true);
  });

  test('night_mode flag 开启后深夜池可抽（经事件反射）', () => {
    game.mutations.setFlag('night_mode', '1');
    const seen = pickable(80);
    expect(seen.has('base:passivestory:schale_night')).toBe(true);
  });

  // 复现：千禧年 Init 下，小鸟游星野对话空间（owner='Hoshino'）只抽其专属闲聊，
  // 绝不能抽中无 owner 的全局闲聊（如 base:story:schale_sunset）。
  test('壁垒·真实数据：星野对话空间抽取不泄漏外部闲聊', () => {
    game.inits.startNewGame('base:init:millennium');
    let guard = 0;
    while (game.getView().currentStory && guard++ < 50) {
      const r = game.story.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') game.story.advanceStory(0);
    }
    const owner = 'Hoshino';
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const candidate = game.passivePoolSystem.pick(game.state, () => true, { owner });
      if (candidate) seen.add(candidate);
    }
    // 专属闲聊应可被抽中
    expect(seen.has('base:passivestory:hoshino_conv_1')).toBe(true);
    // 外部无 owner 全局闲聊绝不可泄漏
    expect(seen.has('base:passivestory:schale_sunset')).toBe(false);
    expect(seen.has('base:passivestory:schale_tea')).toBe(false);
  });

  // 回归：外部 ActiveStoryEntry 播放时，聊天空间（owner 非空）的专属抽取不被阻塞。
  // 对话空间是角色的独立沙盒——外部 active 主线不应阻挠本空间点发送抽专属。
  test('壁垒·沙盒：外部 active 主线播放时 Hoshino 空间抽取专属不被阻塞', () => {
    finishWelcome();
    // 启动一条外部 active 主线（不属于任何聊天空间）
    const ext = game.story.startActiveStory('base:activestory:run_chain_1');
    expect(ext.success).toBe(true);
    expect(game.getView().currentStory).toBeTruthy();

    // 一般聊天：按钮是外部 active 的推进态
    expect(game.story.getSendState().mode).toBe('advance');

    // Hoshino 对话空间：外部 active 不属于该角色 → 按钮转 idle，且抽取专属不被阻塞
    expect(game.story.getSendState('Hoshino').mode).toBe('idle');
    const r = game.story.clickSend('Hoshino');
    expect(r.type).toBe('idle');
    expect((r as { started?: boolean }).started).toBe(true);
    // 聊天沙盒游标上是 Hoshino 专属闲聊
    expect(game.getStoryView('Hoshino')!.storyId).toMatch(/hoshino_conv|hoshino_bond_invite/);
    // 外部 active 主线仍保留在全局游标（并行，未被内部故事打断）
    expect(game.getView().currentStory!.storyId).toBe('base:activestory:run_chain_1');
  });

  // 多沙盒持久化：聊天沙盒游标与全局游标互不干扰，且都随存档保存/恢复。
  test('多沙盒·存档：聊天沙盒游标与全局游标并行，save/load 各自恢复', () => {
    finishWelcome();
    // 全局游标：外部 active 主线
    expect(game.story.startActiveStory('base:activestory:run_chain_1').success).toBe(true);
    // 聊天沙盒：Hoshino 专属闲聊
    expect(game.story.triggerPassiveStory('base:init:schale_office', 'Hoshino').success).toBe(true);
    const hoshinoId = game.getStoryView('Hoshino')!.storyId;
    expect(hoshinoId).toMatch(/hoshino_conv|hoshino_bond_invite/);
    expect(game.getView().currentStory!.storyId).toBe('base:activestory:run_chain_1');

    // 存档 → 新实例读档
    const saved = game.save();
    const g2 = new GameInstance();
    g2.init([baseDatapack]);
    g2.load(saved);
    // 聊天沙盒游标恢复
    expect(g2.getStoryView('Hoshino')).not.toBeNull();
    expect(g2.getStoryView('Hoshino')!.storyId).toBe(hoshinoId);
    // 全局游标恢复（并行互不丢失）
    expect(g2.getView().currentStory).not.toBeNull();
    expect(g2.getView().currentStory!.storyId).toBe('base:activestory:run_chain_1');
  });

  // 打断控制：天台剧情声明 leaveArea:false / interruptible:false，
  // 播放中锁定移动且不被移动打断（演出中途不可离场）。
  test('打断控制：天台剧情 leaveArea:false 锁定移动且不被打断', () => {
    finishWelcome();
    expect(game.story.startStory('base:passivestory:hoshino_conv_2', 'passive').success).toBe(true);
    // 播放中尝试移动（当前在 schale_main → 天台）→ 被 leaveArea:false 锁定
    expect(game.getView().currentStory).not.toBeNull();
    const move = game.travelToArea('base:area:schale_rooftop');
    expect(move.success).toBe(false);
    // interruptible:false：移动不会打断该剧情（即使强行触发 clearPassive）
    expect(game.getView().currentStory).not.toBeNull();
  });

  // 复现缺陷：天台 Trigger 不得外露——未在星野聊天空间播过天台邀约（hoshino_rooftop_hint 未读）前，
  // 进入天台绝不能触发天台相遇剧情（Trigger 的 hasReadStory 门槛拦下）。
  test('天台 Trigger·门槛：未读邀约前进入天台不触发天台相遇', () => {
    finishWelcome();
    // 当前在 schale_main，前往天台（相邻）
    const move = game.travelToArea('base:area:schale_rooftop');
    expect(move.success).toBe(true);
    // 门槛未满足 → 不命中，不写 once 标记、不启动天台相遇
    expect(game.state.triggersCompleted).not.toContain('base:trigger:hoshino_rooftop_story');
    expect(game.getView().currentStory).toBeNull();
  });

  // 复现用户场景：完整新游戏 → 排干初始剧情 → 聊天空间读邀约 → 前往天台 → 触发天台剧情。
  test('天台 Trigger·完整流程：new game → 排干 welcome → 读邀约 → 前往天台触发剧情', () => {
    const g = new GameInstance();
    g.init([baseDatapack]);
    g.inits.startNewGame('base:init:schale_office');
    // 排干初始 welcome 剧情
    let guard = 0;
    while (g.getView().currentStory && guard++ < 50) {
      const r = g.story.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') g.story.advanceStory(0);
    }
    expect(g.getView().currentStory).toBeNull();
    // 播完聊天空间邀约 → hoshino_rooftop_hint 已读 → 天台 Trigger 激活
    readRooftopInvite(g);
    // 确认天台在夏莱 Init 可达
    const move = g.travelToArea('base:area:schale_rooftop');
    expect(move.success).toBe(true);
    expect(g.state.currentAreaId).toBe('base:area:schale_rooftop');
    // 触发天台相遇剧情
    expect(g.state.triggersCompleted).toContain('base:trigger:hoshino_rooftop_story');
    expect(g.getView().currentStory).not.toBeNull();
    expect(g.getView().currentStory!.storyDefId).toBe('base:story:hoshino_rooftop_meet');
  });

  // 关键复现：玩家前往天台时全局游标已有被动闲聊在播放，天台 Trigger 仍应抢占触发
  // （否则 storyStarter 会因 AlreadyActive 失败，天台剧情不触发）。
  test('天台 Trigger·抢占：邀约已读且全局游标有被动闲聊时前往天台仍触发剧情', () => {
    const g = new GameInstance();
    g.init([baseDatapack]);
    g.inits.startNewGame('base:init:schale_office');
    let guard = 0;
    while (g.getView().currentStory && guard++ < 50) {
      const r = g.story.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') g.story.advanceStory(0);
    }
    readRooftopInvite(g);
    // 在一般聊天触发一条外部 passive 闲聊，占住全局游标
    const ext = g.story.triggerPassiveStory('base:init:schale_office');
    expect(ext.success).toBe(true);
    expect(g.getView().currentStory).not.toBeNull();
    const extId = g.getView().currentStory!.storyId;
    expect(extId).not.toMatch(/hoshino_conv/);

    // 前往天台 → 天台 Trigger（force）抢占该闲聊并启动天台剧情
    const move = g.travelToArea('base:area:schale_rooftop');
    expect(move.success).toBe(true);
    expect(g.state.triggersCompleted).toContain('base:trigger:hoshino_rooftop_story');
    expect(g.getView().currentStory).not.toBeNull();
    expect(g.getView().currentStory!.storyDefId).toBe('base:story:hoshino_rooftop_meet');
  });

  // 关键复现：玩家已通过星野聊天空间播放过天台邀约（hoshino_rooftop_hint 已读）后，
  // 前往天台仍应触发独立的「天台相遇」剧情（force 跳过已读，且演出与邀约解耦不重复）。
  test('天台 Trigger·已读：先播完聊天空间邀约后前往天台仍触发天台相遇', () => {
    const g = new GameInstance();
    g.init([baseDatapack]);
    g.inits.startNewGame('base:init:schale_office');
    let guard = 0;
    while (g.getView().currentStory && guard++ < 50) {
      const r = g.story.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') g.story.advanceStory(0);
    }
    // 播完聊天空间邀约（hoshino_conv_2）→ hoshino_rooftop_hint 已读
    readRooftopInvite(g);
    // 前往天台 → 天台 Trigger（force 跳过已读）仍应触发独立的天台相遇
    const move = g.travelToArea('base:area:schale_rooftop');
    expect(move.success).toBe(true);
    expect(g.state.triggersCompleted).toContain('base:trigger:hoshino_rooftop_story');
    expect(g.getView().currentStory).not.toBeNull();
    expect(g.getView().currentStory!.storyDefId).toBe('base:story:hoshino_rooftop_meet');
  });

  // 回归：渲染守卫按 entry.id 反查 owner（story.storyId 是对外 Entry.id），
  // 星野专属 entry 的 owner 唯一命中 Hoshino，Talklet 不被误判为外部而正常渲染
  // （复现「Hoshino 聊天空间未渲染 Talklet」）。
  test('壁垒·专属演出：Hoshino 专属 entry 的 owner 反查命中 Hoshino（Talklet 可被渲染）', () => {
    finishWelcome();
    // 触发星野专属闲聊
    const r = game.story.triggerPassiveStory('base:init:schale_office', 'Hoshino');
    expect(r.success).toBe(true);
    const entryId = game.getStoryView('Hoshino')!.storyId; // StoryView.storyId = Entry.id（聊天沙盒游标）
    // pick 权重随机，conv_1/conv_2/bond_invite 皆属星野专属；核心是 owner 归属命中 Hoshino
    expect(entryId).toMatch(/^base:passivestory:hoshino_(conv_|bond_invite)/);
    // 渲染守卫反查（entry.id === story.storyId）应命中 owner='Hoshino'，而非全局无主 entry
    const owning = [...game.registry.passiveStories.values()]
      .filter(e => e.id === entryId)
      .map(e => e.owner);
    expect(owning).toEqual(['Hoshino']);
  });

  // 夏莱 Area 阻塞：天台剧情（hoshino_conv_2）block 条件 = 位于夏莱天台区域。
  // 播完后锁定星野对话空间；玩家到达天台（travelToArea）后 recheckStudentBlocks 解除。
  test('壁垒·Area 阻塞：天台剧情锁定星野空间，到达夏莱天台区域后重启', () => {
    finishWelcome();
    // 初始在夏莱主厅（非天台）
    expect(game.getView().currentAreaId).toBe('base:area:schale_main');
    // 模拟天台剧情播完后锁定了星野对话空间（block 条件 = 位于夏莱天台）
    game.mutations.setStudentBlock('Hoshino', 'base:passivestory:hoshino_conv_2');
    expect(game.state.studentBlocks?.['Hoshino']?.entryId).toBe('base:passivestory:hoshino_conv_2');
    // 未到天台 → 阻断保持
    game.tick();
    expect(game.state.studentBlocks?.['Hoshino']).toBeTruthy();

    // 到达夏莱天台 → recheckStudentBlocks 判定 area 条件满足 → 解除阻断
    const travel = game.travelToArea('base:area:schale_rooftop');
    expect(travel.success).toBe(true);
    expect(game.getView().currentAreaId).toBe('base:area:schale_rooftop');
    expect(game.state.studentBlocks?.['Hoshino']).toBeUndefined();
  });

  // 复现：外部 passive story 进行中时进入 Hoshino 对话空间，按钮状态按 owner 隔离，
  // 抽取只抽 Hoshino 专属，绝不推进/延续外部故事（消除内容污染）。
  test('壁垒·owner 隔离：外部故事进行中，角色空间按钮转 idle 且抽取只出专属', () => {
    finishWelcome();
    // 一般聊天触发外部 passive story（无 owner，作为进行中故事）
    const ext = game.story.triggerPassiveStory('base:init:schale_office');
    expect(ext.success).toBe(true);
    const extEntryId = game.getView().currentStory!.storyId;
    expect(extEntryId).not.toMatch(/hoshino_conv/);

    // 一般聊天（owner=null）：按钮是外部故事的推进态
    expect(game.story.getSendState().mode).toBe('advance');

    // 进入 Hoshino 对话空间：外部故事不属于该角色 → 按钮转 idle
    const convState = game.story.getSendState('Hoshino');
    expect(convState.mode).toBe('idle');

    // 在 Hoshino 空间点发送：并行抽取 Hoshino 专属闲聊（不打断外部故事）
    const r = game.story.clickSend('Hoshino');
    expect(r.type).toBe('idle');
    expect((r as { started?: boolean }).started).toBe(true);
    const newEntryId = game.getStoryView('Hoshino')!.storyId; // 聊天沙盒游标
    expect(newEntryId).toMatch(/hoshino_conv|hoshino_bond_invite/);
    // 外部故事仍保留在全局游标（并行不打断）
    expect(game.getView().currentStory!.storyId).toBe(extEntryId);
  });

  test('完成「日程表攻防」后深夜模式链路全通（Talklet 效果 → flag → 池 gate）', () => {
    finishWelcome();
    const api = game.story;
    const rewarded: { flags: string[] }[] = [];
    game.eventBus.on('storyRewarded', e => {
      if (e.type === 'storyRewarded') rewarded.push({ flags: e.flags });
    });
    expect(game.passivePoolSystem.isAvailable('base:passivepool:schale_night_owl', game.state)).toBe(false);

    // 完成两页闲聊（第二页 Talklet 效果置 night_mode）
    expect(api.startStory('base:passivestory:schale_planner', 'passive').success).toBe(true);
    let r = game.story.advanceStory();
    while (r.success && 'finished' in r && !r.finished) r = game.story.advanceStory();
    expect(r.success && 'finished' in r && r.finished).toBe(true);

    expect(game.state.flags['night_mode']).toBe('1');
    expect(rewarded.some(e => e.flags.includes('night_mode'))).toBe(true);
    expect(game.passivePoolSystem.isAvailable('base:passivepool:schale_night_owl', game.state)).toBe(true);

    // 抽选树确实可达深夜剧情（谓词限定只允许 night 命中）
    expect(game.passivePoolSystem.pick(game.state, e => e.id === 'base:passivestory:schale_night')).toBe('base:passivestory:schale_night');
    // triggerPassiveStory 全链路也能抽到（多次抽样）
    const seen = pickable(80);
    expect(seen.has('base:passivestory:schale_night')).toBe(true);
  });

  // Talklet 移动·Init 归属：travelToArea（checkAdjacency=false）到不属于当前 Init 的 Area → 跳过。
  // 即便跳过拓扑，Init 归属校验仍生效。
  test('Talklet 移动·Init 归属：移动到非本 Init 的 Area 被跳过', () => {
    finishWelcome();
    const current = game.getView().currentAreaId;
    // 模拟 Story 移动（checkAdjacency=false）到千禧年区域 → 不属于夏莱 Init → 跳过
    const r = (game as unknown as { travelToArea(id: string, s: boolean, c: boolean): { success: boolean } })
      .travelToArea('base:area:millennium_canteen', true, false);
    expect(r.success).toBe(false);
    expect(game.getView().currentAreaId).toBe(current); // 位置不变
  });
});
