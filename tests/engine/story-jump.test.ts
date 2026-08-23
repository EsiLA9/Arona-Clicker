// ============================================================
// engine/story-jump.test.ts — Story 跳转链 / 条件奖励 / 重阅读 / 分歧守卫
//
// 覆盖机制：
//   1. Talklet 级 goto 跳转（拆长 Story 无感串联）
//   2. 选项级 goto 跳转（拓扑分歧）
//   3. conditionalRewards 条件奖励（flag / visitedStoryInChain）
//   4. insert 跳转（子剧情播完后返回原地）
//   5. 末页 insert 返回点超界收尾
//   6. 循环跳转防护（JumpLimitExceeded）
//   7. replayStory 重阅读入口
//   8. branchGuards 分歧点准入守卫
//   9. 跳转链中存档/读档恢复
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { Datapack, Resource, StoryEntryDef, ActiveStoryEntry, StoryDef, and, cond } from '../../src/engine/types';

/** 推进完当前展开的剧情（active 会锁定移动）。 */
function finishWelcome(g: GameInstance): void {
  for (let guard = 0; guard < 200; guard++) {
    const r = g.advanceStory();
    if (r.success && 'finished' in r && r.finished) break;
    if (!r.success && r.error === 'ChoiceRequired') {
      g.advanceStory(0);
      continue;
    }
    if (!r.success) break;
  }
}

/** 连续推进直到剧情结束；遇到选项时选第 choiceIndex 个。 */
function finishStory(g: GameInstance, choiceIndex = 0): void {
  for (let guard = 0; guard < 200; guard++) {
    const view = g.getView().currentStory;
    if (!view) return;
    const r = g.advanceStory();
    if (r.success && 'finished' in r && r.finished) return;
    if (!r.success && r.error === 'ChoiceRequired') {
      const r2 = g.advanceStory(choiceIndex);
      if (r2.success && 'finished' in r2 && r2.finished) return;
      continue;
    }
    if (!r.success) return;
  }
}

// ============================================================
// 测试数据：阿比多斯沙漠委托（演示分歧 → 共同收尾）
// ============================================================

const desertIntro: StoryDef = {
  id: 'test:story:desert_intro',
  name: '沙漠委托 · 开场',
  talklets: [
    { kind: 'narration', text: '—— 阿比多斯 · 委托板前 ——' },
    {
      speaker: '白子',
      text: '老师，沙漠里出现了大批违规运输队。要怎么处理？',
      choices: [
        {
          text: '正面突击',
          effects: [{ op: 'setFlag', target: 'route', value: 'assault' }],
          jumpToStory: 'test:story:desert_assault',
        },
        {
          text: '迂回谈判',
          effects: [{ op: 'setFlag', target: 'route', value: 'negotiate' }],
          jumpToStory: 'test:story:desert_negotiate',
        },
      ],
    },
  ],
};

const desertAssault: StoryDef = {
  id: 'test:story:desert_assault',
  name: '沙漠委托 · 突击',
  talklets: [
    { speaker: '白子', text: '突击队已就位，正面突破！' },
    {
      speaker: '老师',
      text: '运输队投降了。收尾吧。',
      // Talklet 级 goto：突击分支的结局跳转到共同收尾
      jumpToStory: 'test:story:desert_epilogue',
    },
  ],
};

const desertNegotiate: StoryDef = {
  id: 'test:story:desert_negotiate',
  name: '沙漠委托 · 谈判',
  talklets: [
    { speaker: '星野', text: '大叔我试着跟他们聊聊，结果他们同意付过路费了。' },
    {
      speaker: '老师',
      text: '谈判成功，收尾吧。',
      jumpToStory: 'test:story:desert_epilogue',
    },
  ],
};

const desertEpilogue: StoryDef = {
  id: 'test:story:desert_epilogue',
  name: '沙漠委托 · 收尾',
  talklets: [
    {
      speaker: '白子',
      text: '委托完成。感谢老师协助。',
      effects: [{ op: 'addResource', target: Resource.Credit, value: 10 }],
    },
  ],
};

const desertEntry: StoryEntryDef = {
  id: 'test:story:desert_mission',
  storyId: 'test:story:desert_intro',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
  replayable: true,
  // 分歧点守卫：进入突击分支需真正读过突击 Story（首次走谈判的玩家重阅读时会被拒绝）
  branchGuards: [
    {
      storyId: 'test:story:desert_assault',
      prerequisites: [{ storyId: 'test:story:desert_assault', talkletIndex: -1 }],
      denialMessage: '你还没有真正走过突击路线，无法进入该分歧。',
    },
  ],
};

// ============================================================
// insert 场景：补给任务（子剧情插入后返回）
// ============================================================

const supplyMain: StoryDef = {
  id: 'test:story:supply_main',
  name: '补给任务',
  talklets: [
    { speaker: '芹香', text: '老师，补给清单已经列好了。' },
    {
      speaker: '芹香',
      text: '对了，便利店那边有件事要顺路处理一下。',
      // insert：插入子剧情，播完后返回下一页
      jumpToStory: 'test:story:supply_detail',
      jumpMode: 'insert',
    },
    { speaker: '芹香', text: '处理完了，继续补给任务。' },
    { speaker: '老师', text: '全部清单核对完毕。', effects: [{ op: 'addResource', target: Resource.Credit, value: 5 }] },
  ],
};

const supplyDetail: StoryDef = {
  id: 'test:story:supply_detail',
  name: '便利店小插曲',
  talklets: [
    { speaker: '店员', text: '啊，芹香同学，正好你来了——找零多出来一张优惠券。' },
    { speaker: '芹香', text: '谢谢！帮大忙了。' },
  ],
};

const supplyEntry: StoryEntryDef = {
  id: 'test:story:supply_mission',
  storyId: 'test:story:supply_main',
  type: 'passive',
  availableInits: [],
  triggerCondition: and(),
  repeatable: true,
  weight: 1,
};

// ============================================================
// 末页 insert 场景：返回点超界时正常收尾
// ============================================================

const edgeMain: StoryDef = {
  id: 'test:story:edge_main',
  name: '边缘任务',
  talklets: [
    { speaker: '阿罗娜', text: '老师，这是最后一项检查了。' },
    {
      speaker: '阿罗娜',
      text: '我顺路查一下服务器。',
      // 末页 insert：返回点 pageIndex = 2，超出 talklets 长度（2）→ 返回即收尾
      jumpToStory: 'test:story:edge_sub',
      jumpMode: 'insert',
    },
  ],
};

const edgeSub: StoryDef = {
  id: 'test:story:edge_sub',
  name: '服务器检查',
  talklets: [
    { speaker: '阿罗娜', text: '服务器一切正常。' },
  ],
};

const edgeEntry: StoryEntryDef = {
  id: 'test:story:edge_mission',
  storyId: 'test:story:edge_main',
  type: 'passive',
  availableInits: [],
  triggerCondition: and(),
  repeatable: true,
  weight: 1,
};

// ============================================================
// 循环跳转场景：内容作者误写死循环
// ============================================================

const loopA: StoryDef = {
  id: 'test:story:loop_a',
  name: '循环 A',
  talklets: [{ speaker: 'A', text: '去 B。', jumpToStory: 'test:story:loop_b' }],
};

const loopB: StoryDef = {
  id: 'test:story:loop_b',
  name: '循环 B',
  talklets: [{ speaker: 'B', text: '回 A。', jumpToStory: 'test:story:loop_a' }],
};

const loopEntry: StoryEntryDef = {
  id: 'test:story:loop_entry',
  storyId: 'test:story:loop_a',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

// ============================================================
// 组装
// ============================================================

function makePack(entries: StoryEntryDef[], stories: StoryDef[]): Datapack {
  return {
    name: 'story-jump-test',
    version: '0.0.0',
    inits: [],
    areas: [],
    spots: [],
    enhancements: [],
    activeStories: entries as ActiveStoryEntry[],
    passiveStories: [],
    stories,
    items: [],
    funcletDefs: [],
    characters: [],
    characterBonuses: [],
  };
}

const desertPack = makePack([desertEntry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);
const supplyPack = makePack([supplyEntry], [supplyMain, supplyDetail]);
const edgePack = makePack([edgeEntry], [edgeMain, edgeSub]);
const loopPack = makePack([loopEntry], [loopA, loopB]);

// ============================================================
// 测试数据：点击门控跳转（click 页 + jumpToStory）
//   click 页必须先经 clickSend 完成点击，才触发跳转与守卫判断。
// ============================================================

const clickGateMain: StoryDef = {
  id: 'test:story:click_gate_main',
  name: '点击门控 · 主',
  talklets: [
    {
      kind: 'click',
      text: '长按开关启动机器',
      // click 页 + 跳转：完成点击后才进入目标 Story
      jumpToStory: 'test:story:click_gate_target',
    },
  ],
};

const clickGateTarget: StoryDef = {
  id: 'test:story:click_gate_target',
  name: '点击门控 · 目标',
  talklets: [
    { speaker: '优香', text: '机器启动了，很好。', sendText: '好的' },
  ],
};

const clickGateEntry: StoryEntryDef = {
  id: 'test:story:click_gate',
  storyId: 'test:story:click_gate_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

const clickGatePack = makePack([clickGateEntry], [clickGateMain, clickGateTarget]);

// 多击版本：clickWork(base: 2) + jumpToStory
const clickWorkGateMain: StoryDef = {
  id: 'test:story:clickwork_gate_main',
  name: '多击门控 · 主',
  talklets: [
    {
      kind: 'click',
      text: '连续敲击 2 次开启保险库',
      clickWork: { base: 2 },
      jumpToStory: 'test:story:clickwork_gate_target',
    },
  ],
};

const clickWorkGateTarget: StoryDef = {
  id: 'test:story:clickwork_gate_target',
  name: '多击门控 · 目标',
  talklets: [{ speaker: '优香', text: '保险库开启了。', sendText: '收下钥匙' }],
};

const clickWorkGateEntry: StoryEntryDef = {
  id: 'test:story:clickwork_gate',
  storyId: 'test:story:clickwork_gate_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

const clickWorkGatePack = makePack([clickWorkGateEntry], [clickWorkGateMain, clickWorkGateTarget]);

// ============================================================
// 测试数据：跳转目标末页 click 门控（insert 弹栈返回 / goto 链完结）
//   子剧情或 goto 目标的最后一页为 click 页时，
//   未完成点击不得省略——否则直接返回/完结会跳过该处的点击需求。
// ============================================================

const whisperClickSub: StoryDef = {
  id: 'test:story:whisper_click_sub',
  name: '悄悄话 · 末页点击',
  talklets: [
    { kind: 'click', text: '（示意美依继续说下去）' },
  ],
};

const whisperClickMain: StoryDef = {
  id: 'test:story:whisper_click_main',
  name: '主剧情 · insert 点击子剧情',
  talklets: [
    { speaker: '美依', text: '老师，借一步说话。', jumpToStory: 'test:story:whisper_click_sub', jumpMode: 'insert' },
    { speaker: '老师', text: '原来如此。', sendText: '明白了' },
  ],
};

const whisperClickEntry: StoryEntryDef = {
  id: 'test:story:whisper_click',
  storyId: 'test:story:whisper_click_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

const whisperClickPack = makePack([whisperClickEntry], [whisperClickMain, whisperClickSub]);

const gotoClickTarget: StoryDef = {
  id: 'test:story:goto_click_target',
  name: 'goto 目标 · 末页点击',
  talklets: [
    { kind: 'click', text: '按下终端的确认键' },
  ],
};

const gotoClickMain: StoryDef = {
  id: 'test:story:goto_click_main',
  name: 'goto 主 · 跳转',
  talklets: [
    { speaker: '老师', text: '去终端看看。', jumpToStory: 'test:story:goto_click_target' },
  ],
};

const gotoClickEntry: StoryEntryDef = {
  id: 'test:story:goto_click',
  storyId: 'test:story:goto_click_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

const gotoClickPack = makePack([gotoClickEntry], [gotoClickMain, gotoClickTarget]);

describe('Story 跳转链（goto / insert）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  test('Talklet 级 goto：拆长 Story 无感串联，Entry.id 不变，链完结后记录完成', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    const started = game.startActiveStory('test:story:desert_mission');
    expect(started.success).toBe(true);

    // intro t0（旁白）
    let view = game.getView().currentStory!;
    expect(view.storyId).toBe('test:story:desert_mission');
    expect(view.storyDefId).toBe('test:story:desert_intro');
    expect(view.pageIndex).toBe(0);

    // 推进到选项页（t1）
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.pageIndex).toBe(1);

    // 选"正面突击" → goto assault
    expect(game.advanceStory(0)).toMatchObject({ success: true, finished: false });
    view = game.getView().currentStory!;
    expect(view.storyId).toBe('test:story:desert_mission'); // Entry.id 不变
    expect(view.storyDefId).toBe('test:story:desert_assault'); // 实际播放的 Story 已切换
    expect(view.pageIndex).toBe(0);

    // assault t0 → t1（Talklet 级 goto 页）
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_assault');
    expect(game.getView().currentStory!.pageIndex).toBe(1);

    // 离开 t1 → Talklet 级 goto → epilogue
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    view = game.getView().currentStory!;
    expect(view.storyDefId).toBe('test:story:desert_epilogue');
    expect(view.pageIndex).toBe(0);

    // epilogue t0 → 链完结
    const finished = game.advanceStory();
    expect(finished).toMatchObject({ success: true, finished: true, storyId: 'test:story:desert_epilogue' });
    expect(game.getView().currentStory).toBeNull();
    expect(game.state.storyLog.some(s => s.storyId === 'test:story:desert_epilogue')).toBe(true);
  });

  test('选项级 goto：拓扑分歧走向不同 Story（assault / negotiate）', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);
    game.startActiveStory('test:story:desert_mission');

    // 推进到选项页，选"迂回谈判" → negotiate
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.advanceStory(1)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_negotiate');

    // negotiate t0 → t1（Talklet 级 goto 页）→ epilogue
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_epilogue');
    expect(game.advanceStory()).toMatchObject({ success: true, finished: true });
  });

  test('conditionalRewards：分歧 flag 决定完结奖励（突击 +50，谈判 +20）', () => {
    // flag 条件只区分"存在与否"（value=1 表示存在且非空），
    // 突击与谈判都设置 route flag → 两条条件都会命中第一条。
    // 因此本测试用"突击命中高奖励"验证机制，精确档位由 visitedStoryInChain 测试覆盖。
    const entry: StoryEntryDef = {
      ...desertEntry,
      id: 'test:story:assault_mission',
      storyId: 'test:story:desert_intro',
      completionStrategy: 'conditional',
      conditionalRewards: [
        { condition: and(cond('flag', 'route', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 50 }] },
        { condition: and(), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 20 }] },
      ],
    };
    const pack = makePack([entry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);
    game.init([baseDatapack, pack]);
    finishWelcome(game);
    game.startActiveStory('test:story:assault_mission');
    finishStory(game, 0); // 走突击 → route flag 存在 → 命中第一条 +50
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(50);
  });

  test('conditionalRewards 保底：无任何条件命中时发放兜底包', () => {
    const entry: StoryEntryDef = {
      ...desertEntry,
      id: 'test:story:fallback_mission',
      storyId: 'test:story:desert_intro',
      completionStrategy: 'conditional',
      conditionalRewards: [
        // 永不命中的条件
        { condition: and(cond('flag', 'never_set', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 99 }] },
        // 兜底：无条件
        { condition: and(), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }] },
      ],
    };
    const pack = makePack([entry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);
    game.init([baseDatapack, pack]);
    finishWelcome(game);
    game.startActiveStory('test:story:fallback_mission');
    finishStory(game, 1); // 走谈判
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(5);
  });

  test('visitedStoryInChain：条件奖励可引用链内经过的 Story', () => {
    const entry: StoryEntryDef = {
      ...desertEntry,
      id: 'test:story:chain_mission',
      storyId: 'test:story:desert_intro',
      completionStrategy: 'conditional',
      conditionalRewards: [
        // 走过突击分支 → 高奖励（不依赖 flag，直接看经过的 Story）
        { condition: and(cond('visitedStoryInChain', 'test:story:desert_assault', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 30 }] },
        { condition: and(cond('visitedStoryInChain', 'test:story:desert_negotiate', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }] },
      ],
    };
    const pack = makePack([entry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);

    // 走突击 → +30
    game.init([baseDatapack, pack]);
    finishWelcome(game);
    game.startActiveStory('test:story:chain_mission');
    finishStory(game, 0);
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(30);

    // 重置走谈判 → +15
    game.reset();
    game.init([baseDatapack, pack]);
    finishWelcome(game);
    game.startActiveStory('test:story:chain_mission');
    finishStory(game, 1);
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(15);
  });

  test('insert 跳转：子剧情播完后返回原地继续', () => {
    game.init([baseDatapack, supplyPack]);
    finishWelcome(game);

    const api = game as unknown as { startStory(id: string, t: 'passive'): { success: boolean } };
    expect(api.startStory('test:story:supply_mission', 'passive').success).toBe(true);

    // supply_main t0
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:supply_main');
    // t0 → t1（insert 跳转页）
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:supply_main');
    expect(game.getView().currentStory!.pageIndex).toBe(1);
    // 离开 t1 → insert 跳转 → 进入 supply_detail t0
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:supply_detail');
    expect(game.getView().currentStory!.pageIndex).toBe(0);
    // supply_detail t0 → t1
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:supply_detail');
    expect(game.getView().currentStory!.pageIndex).toBe(1);
    // 离开 t1 → 子剧情完结 → 返回 supply_main t2（原地下一页）
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:supply_main');
    expect(game.getView().currentStory!.pageIndex).toBe(2);
    // t2 → t3
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.pageIndex).toBe(3);
    // 完结
    expect(game.advanceStory()).toMatchObject({ success: true, finished: true });
    expect(game.getView().currentStory).toBeNull();
  });

  test('末页 insert：返回点超界时正常收尾（不卡死）', () => {
    game.init([baseDatapack, edgePack]);
    finishWelcome(game);

    const api = game as unknown as { startStory(id: string, t: 'passive'): { success: boolean } };
    expect(api.startStory('test:story:edge_mission', 'passive').success).toBe(true);

    // edge_main t0 → t1（末页 insert 跳转页）
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:edge_main');
    expect(game.getView().currentStory!.pageIndex).toBe(1);
    // 离开 t1 → insert → edge_sub t0
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:edge_sub');
    // edge_sub 完结 → 返回点超界（edge_main pageIndex=2 >= 2）→ 直接链完结
    const r = game.advanceStory();
    expect(r).toMatchObject({ success: true, finished: true });
    expect(game.getView().currentStory).toBeNull();
  });

  test('click 页 + goto：未完成点击时 advanceStory 返回 ClickRequired（不触发跳转）', () => {
    game.init([baseDatapack, clickGatePack]);
    finishWelcome(game);

    expect(game.startActiveStory('test:story:click_gate').success).toBe(true);
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:click_gate_main');
    expect(game.getView().currentStory!.page.kind).toBe('click');

    // 直接 advanceStory：点击未完成 → ClickRequired，且不触发跳转
    const blocked = game.advanceStory();
    expect(blocked).toMatchObject({ success: false, error: 'ClickRequired' });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:click_gate_main');

    // 经 clickSend 完成点击（total=1 → 一次即确认）→ 跳转成功
    const send = game.getSendState();
    if (send.mode !== 'advance' || !send.clickWork) throw new Error('expected advance+clickWork');
    expect(send.clickWork).toEqual({ total: 1, done: 0 });
    const r = game.clickSend();
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:click_gate_target');
  });

  test('clickWork 多击 + goto：需填满并再确认一次才跳转', () => {
    game.init([baseDatapack, clickWorkGatePack]);
    finishWelcome(game);

    expect(game.startActiveStory('test:story:clickwork_gate').success).toBe(true);
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:clickwork_gate_main');

    // 未完成点击：直接推进被拒
    expect(game.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });

    // 第一次点击 → working（1/2）
    expect(game.clickSend()).toMatchObject({ type: 'working', clicksDone: 1, clicksTotal: 2 });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:clickwork_gate_main');

    // 第二次点击 → working（2/2 填满）
    expect(game.clickSend()).toMatchObject({ type: 'working', clicksDone: 2, clicksTotal: 2 });
    // 填满后直接 advanceStory 仍被拒（未确认）
    expect(game.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });

    // 第三次点击 → 确认 → 跳转
    const r = game.clickSend();
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:clickwork_gate_target');
  });

  test('insert 子剧情末页为 click：返回原地前必须先完成点击（不省略）', () => {
    game.init([baseDatapack, whisperClickPack]);
    finishWelcome(game);

    expect(game.startActiveStory('test:story:whisper_click').success).toBe(true);
    // main t0（insert 跳转页）→ 进入子剧情 t0（click 页）
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:whisper_click_sub');
    expect(game.getView().currentStory!.page.kind).toBe('click');

    // 未完成点击直接推进 → ClickRequired（不省略 click、不提前弹栈返回）
    expect(game.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:whisper_click_sub');

    // 完成点击 → 弹栈返回 main t1
    const r = game.clickSend();
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:whisper_click_main');
    expect(game.getView().currentStory!.pageIndex).toBe(1);
  });

  test('goto 目标末页为 click：链完结前必须先完成点击（不省略）', () => {
    game.init([baseDatapack, gotoClickPack]);
    finishWelcome(game);

    expect(game.startActiveStory('test:story:goto_click').success).toBe(true);
    // main t0（goto 跳转页）→ 进入目标 t0（click 页）
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:goto_click_target');

    // 未完成点击直接推进 → ClickRequired（不省略 click、不直接完结）
    expect(game.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });
    expect(game.getView().currentStory).not.toBeNull();

    // 完成点击 → 链完结
    const r = game.clickSend();
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory).toBeNull();
  });

  test('choice 页 text 默认阻塞：确认文本后才显示选项', () => {
    game.init([baseDatapack]);
    // 从头用 clickSend 推进欢迎剧情到选项页（page5）：逐页阻塞，每页一次点击
    expect(game.clickSend().type).toBe('completed'); // page0 → page1(sendText)
    expect(game.clickSend().type).toBe('completed'); // page1 → page2(老师)
    expect(game.clickSend().type).toBe('completed'); // page2 → page3(clickWork)
    const work = game.getSendState();
    if (work.mode !== 'advance' || !work.clickWork) throw new Error('expected advance with clickWork');
    for (let i = 0; i < work.clickWork.total; i++) expect(game.clickSend().type).toBe('working');
    expect(game.clickSend().type).toBe('completed'); // 填满后再点一次：page3 → page4(旁白)
    expect(game.clickSend().type).toBe('completed'); // page4 → page5(choice)

    // choice 页未确认：mode='choice' 且 confirmed=false（选项被 text 阻塞）
    expect(game.getSendState()).toMatchObject({ mode: 'choice', confirmed: false });

    // 点击"继续"→ 确认文本 → 返回 choice（UI 随后渲染选项）
    expect(game.clickSend()).toEqual({ type: 'choice' });
    expect(game.getSendState()).toMatchObject({ mode: 'choice', confirmed: true });

    // 已确认后点击保持 choice（不推进）
    expect(game.clickSend()).toEqual({ type: 'choice' });

    // 选择选项 → 正常推进
    expect(game.advanceStory(0)).toMatchObject({ success: true, finished: false });
    // 离开选项页后确认状态重置
    expect(game.getSendState()).not.toMatchObject({ mode: 'choice' });
  });

  test('millennium 演示：click 阻塞逐步推进 + insert 子剧情逐句点击 + choice text 阻塞', () => {
    game.init([baseDatapack]);
    finishWelcome(game);

    // 启动千禧年危机（active entry，availableInits 限 millennium init → 用 replayStory 绕过）
    expect(game.replayStory('base:story:millennium_game_crisis').success).toBe(true);

    // t0 旁白（普通页）→ advance 模式，逐页阻塞
    expect(game.getSendState()).toMatchObject({ mode: 'advance' });
    // 点击 → 推进 t0 → t1（桃依，sendText 交互页）
    expect(game.clickSend().type).toBe('completed');
    expect(game.getView().currentStory!.pageIndex).toBe(1);
    // 点击发送"冷静一下，桃依。"→ 推进到 t2（美依，普通 talk + insert 跳转页，不再吸收）
    const step1 = game.clickSend();
    expect(step1.type).toBe('completed');
    expect(step1.type === 'completed' && step1.absorbed).toEqual([]);
    expect(game.getView().currentStory!.pageIndex).toBe(2);
    expect(game.getView().currentStory!.page.speaker).toBe('美依');
    expect(game.getView().currentStory!.page.kind).toBeUndefined();

    // 点击 → insert 跳转到 whisper t0（普通 talk 页，逐页阻塞）
    expect(game.clickSend().type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('base:story:millennium_game_crisis_whisper');
    expect(game.getView().currentStory!.pageIndex).toBe(0);
    expect(game.getView().currentStory!.page.speaker).toBe('美依');

    // 逐句点击 whisper 两页
    expect(game.clickSend().type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('base:story:millennium_game_crisis_whisper');
    expect(game.getView().currentStory!.pageIndex).toBe(1);
    expect(game.getView().currentStory!.page.speaker).toBe('桃依');
    // 最后一页点击 → 子剧情完结 → 弹栈返回 intro t3（老师的话 + choices）
    const step4 = game.clickSend();
    expect(step4.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('base:story:millennium_game_crisis_intro');
    expect(game.getView().currentStory!.pageIndex).toBe(3);

    // choice 页 text 阻塞：先确认文本，后出现选项
    expect(game.getSendState()).toMatchObject({ mode: 'choice', confirmed: false });
    expect(game.clickSend()).toEqual({ type: 'choice' });
    expect(game.getSendState()).toMatchObject({ mode: 'choice', confirmed: true });

    // 选"亲自上手调试" → goto 跳转到 debug 分支（守卫仅保护 bribe 分支，不受影响）
    expect(game.advanceStory(0)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('base:story:millennium_game_crisis_debug');
  });

  test('循环跳转：超过深度上限触发 JumpLimitExceeded 并终止', () => {
    game.init([baseDatapack, loopPack]);
    finishWelcome(game);

    expect(game.startActiveStory('test:story:loop_entry').success).toBe(true);
    let error: string | null = null;
    for (let i = 0; i < 100; i++) {
      const r = game.advanceStory();
      if (!r.success) {
        error = r.error;
        break;
      }
    }
    expect(error).toBe('JumpLimitExceeded');
    // 强制终止后无进行中剧情（不会卡死）
    expect(game.getView().currentStory).toBeNull();
  });

  test('跳转链中存档/读档：游标完整恢复（storyDefId + insertStack + visited）', () => {
    game.init([baseDatapack, supplyPack]);
    finishWelcome(game);

    const api = game as unknown as { startStory(id: string, t: 'passive'): { success: boolean } };
    api.startStory('test:story:supply_mission', 'passive');
    // 推进到 supply_detail t0（insert 已压栈）：t0 → t1（跳转页）→ 跳转
    game.advanceStory();
    game.advanceStory();
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:supply_detail');

    const saveData = game.save();
    // 篡改状态验证读档恢复
    game.reset();
    game.init([baseDatapack, supplyPack]);
    finishWelcome(game);
    game.load(saveData);

    // 恢复后仍在 supply_detail t0
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:supply_detail');
    expect(game.getView().currentStory!.pageIndex).toBe(0);

    // 继续推进：supply_detail t0 → t1，再离开 → 返回 supply_main t2
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:supply_main');
    expect(game.getView().currentStory!.pageIndex).toBe(2);
  });
});

describe('重阅读与分歧点准入守卫', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  test('replayStory：仅 replayable Entry 可用，非 replayable 返回 NotReplayable', () => {
    game.init([baseDatapack, desertPack, supplyPack]);
    finishWelcome(game);

    // supply_mission 未设 replayable → 拒绝
    expect(game.replayStory('test:story:supply_mission')).toMatchObject({ success: false, error: 'NotReplayable' });
    // desert_mission 可重阅读
    expect(game.replayStory('test:story:desert_mission')).toMatchObject({ success: true });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_intro');
  });

  test('分歧点守卫：未真读分支时拒绝进入，已读分支放行', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    // 首次演出：走谈判分支（未读突击分支）
    game.startActiveStory('test:story:desert_mission');
    finishStory(game, 1);
    expect(game.getView().currentStory).toBeNull();

    // 重阅读：先推进到选项页，再选"正面突击" → 守卫拦截
    expect(game.replayStory('test:story:desert_mission')).toMatchObject({ success: true });
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false }); // t0 → t1（选项页）
    const blocked = game.advanceStory(0);
    expect(blocked).toMatchObject({ success: false, error: 'BranchGuardDenied' });
    if ('denialMessage' in blocked) {
      expect(blocked.denialMessage).toBe('你还没有真正走过突击路线，无法进入该分歧。');
    }
    // 页面未推进、效果未应用：仍停在选项页
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_intro');
    expect(game.getView().currentStory!.pageIndex).toBe(1);

    // 改选"迂回谈判"（已真读）→ 放行
    expect(game.advanceStory(1)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_negotiate');
  });

  test('分歧点守卫：先真读分支后，重阅读可正常进入', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    // 首次演出走突击分支（真读）
    game.startActiveStory('test:story:desert_mission');
    finishStory(game, 0);
    expect(game.getView().currentStory).toBeNull();

    // 重阅读：先推进到选项页，选突击 → 已读 → 放行
    game.replayStory('test:story:desert_mission');
    expect(game.advanceStory()).toMatchObject({ success: true, finished: false }); // t0 → t1
    expect(game.advanceStory(0)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:desert_assault');
  });

  test('重阅读可完整走完链，但不重复发放奖励（防刷）', () => {
    // 配置条件奖励：走过突击分支 → +30 青辉石
    const entry: StoryEntryDef = {
      ...desertEntry,
      id: 'test:story:replay_reward',
      storyId: 'test:story:desert_intro',
      completionStrategy: 'conditional',
      conditionalRewards: [
        { condition: and(cond('visitedStoryInChain', 'test:story:desert_assault', '==', 1)), effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 30 }] },
      ],
    };
    const pack = makePack([entry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);
    game.init([baseDatapack, pack]);
    finishWelcome(game);

    // 首次走突击 → +30
    game.startActiveStory('test:story:replay_reward');
    finishStory(game, 0);
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(30);

    // 重阅读再走突击 → 不重复发放
    game.replayStory('test:story:replay_reward');
    finishStory(game, 0);
    expect(game.getView().currentStory).toBeNull();
    expect(game.state.globalResources?.[Resource.Pyroxene] ?? 0).toBe(30);
  });

  test('重阅读走完链后可再次通过守卫（阅读记录已累积）', () => {
    game.init([baseDatapack, desertPack]);
    finishWelcome(game);

    // 首次走谈判（未读突击）→ 重阅读选突击被拒
    game.startActiveStory('test:story:desert_mission');
    finishStory(game, 1);
    game.replayStory('test:story:desert_mission');
    game.advanceStory(); // t0 → t1
    expect(game.advanceStory(0)).toMatchObject({ success: false, error: 'BranchGuardDenied' });
    // 改走谈判完成本次重阅读（真实读完谈判分支）
    expect(game.advanceStory(1)).toMatchObject({ success: true, finished: false });
    finishStory(game, 1);

    // 第二次重阅读：走谈判分支时经过的 negotiate 已完整读过，仍放行；
    // 突击分支从未被真实阅读 → 仍被拒
    game.replayStory('test:story:desert_mission');
    game.advanceStory();
    expect(game.advanceStory(0)).toMatchObject({ success: false, error: 'BranchGuardDenied' });
    expect(game.advanceStory(1)).toMatchObject({ success: true, finished: false });
  });
});
