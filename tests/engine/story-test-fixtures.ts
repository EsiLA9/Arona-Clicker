import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/story-test-fixtures.ts — story 系列测试共享数据与工具
// （非 .test.ts，不会被 vitest 收集）
// ============================================================
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { StoryEntryDef, ActiveStoryEntry } from '../../src/data-services/contracts/story-entry';
import { and } from '../../src/engine/types';
import { Resource } from '../../src/arona-clicker/types/ids';

/** 推进完当前展开的剧情（active 会锁定移动）。 */
export function finishWelcome(g: GameInstance): void {
  for (let guard = 0; guard < 200; guard++) {
    const r = g.story.advanceStory();
    if (r.success && 'finished' in r && r.finished) break;
    if (!r.success && r.error === 'ChoiceRequired') {
      g.story.advanceStory(0);
      continue;
    }
    if (!r.success) break;
  }
}

/** 连续推进直到剧情结束；遇到选项时选第 choiceIndex 个。 */
export function finishStory(g: GameInstance, choiceIndex = 0): void {
  for (let guard = 0; guard < 200; guard++) {
    const view = g.getView().currentStory;
    if (!view) return;
    const r = g.story.advanceStory();
    if (r.success && 'finished' in r && r.finished) return;
    if (!r.success && r.error === 'ChoiceRequired') {
      const r2 = g.story.advanceStory(choiceIndex);
      if (r2.success && 'finished' in r2 && r2.finished) return;
      continue;
    }
    if (!r.success) return;
  }
}

// ============================================================
// 测试数据：阿比多斯沙漠委托（演示分歧 → 共同收尾）
// ============================================================

export const desertIntro: StoryDef = {
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

export const desertAssault: StoryDef = {
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

export const desertNegotiate: StoryDef = {
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

export const desertEpilogue: StoryDef = {
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

export const desertEntry: StoryEntryDef = {
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

export const supplyMain: StoryDef = {
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

export const supplyDetail: StoryDef = {
  id: 'test:story:supply_detail',
  name: '便利店小插曲',
  talklets: [
    { speaker: '店员', text: '啊，芹香同学，正好你来了——找零多出来一张优惠券。' },
    { speaker: '芹香', text: '谢谢！帮大忙了。' },
  ],
};

export const supplyEntry: StoryEntryDef = {
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

export const edgeMain: StoryDef = {
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

export const edgeSub: StoryDef = {
  id: 'test:story:edge_sub',
  name: '服务器检查',
  talklets: [
    { speaker: '阿罗娜', text: '服务器一切正常。' },
  ],
};

export const edgeEntry: StoryEntryDef = {
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

export const loopA: StoryDef = {
  id: 'test:story:loop_a',
  name: '循环 A',
  talklets: [{ speaker: 'A', text: '去 B。', jumpToStory: 'test:story:loop_b' }],
};

export const loopB: StoryDef = {
  id: 'test:story:loop_b',
  name: '循环 B',
  talklets: [{ speaker: 'B', text: '回 A。', jumpToStory: 'test:story:loop_a' }],
};

export const loopEntry: StoryEntryDef = {
  id: 'test:story:loop_entry',
  storyId: 'test:story:loop_a',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

// ============================================================
// 组装
// ============================================================

export function makePack(entries: StoryEntryDef[], stories: StoryDef[]): Datapack {
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
    
  };
}

export const desertPack = makePack([desertEntry], [desertIntro, desertAssault, desertNegotiate, desertEpilogue]);
export const supplyPack = makePack([supplyEntry], [supplyMain, supplyDetail]);
export const edgePack = makePack([edgeEntry], [edgeMain, edgeSub]);
export const loopPack = makePack([loopEntry], [loopA, loopB]);

// ============================================================
// 测试数据：点击门控跳转（click 页 + jumpToStory）
//   click 页必须先经 clickSend 完成点击，才触发跳转与守卫判断。
// ============================================================

export const clickGateMain: StoryDef = {
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

export const clickGateTarget: StoryDef = {
  id: 'test:story:click_gate_target',
  name: '点击门控 · 目标',
  talklets: [
    { speaker: '优香', text: '机器启动了，很好。', sendText: '好的' },
  ],
};

export const clickGateEntry: StoryEntryDef = {
  id: 'test:story:click_gate',
  storyId: 'test:story:click_gate_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

export const clickGatePack = makePack([clickGateEntry], [clickGateMain, clickGateTarget]);

// 多击版本：clickWork(base: 2) + jumpToStory
export const clickWorkGateMain: StoryDef = {
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

export const clickWorkGateTarget: StoryDef = {
  id: 'test:story:clickwork_gate_target',
  name: '多击门控 · 目标',
  talklets: [{ speaker: '优香', text: '保险库开启了。', sendText: '收下钥匙' }],
};

export const clickWorkGateEntry: StoryEntryDef = {
  id: 'test:story:clickwork_gate',
  storyId: 'test:story:clickwork_gate_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

export const clickWorkGatePack = makePack([clickWorkGateEntry], [clickWorkGateMain, clickWorkGateTarget]);

// ============================================================
// 测试数据：跳转目标末页 click 门控（insert 弹栈返回 / goto 链完结）
//   子剧情或 goto 目标的最后一页为 click 页时，
//   未完成点击不得省略——否则直接返回/完结会跳过该处的点击需求。
// ============================================================

export const whisperClickSub: StoryDef = {
  id: 'test:story:whisper_click_sub',
  name: '悄悄话 · 末页点击',
  talklets: [
    { kind: 'click', text: '（示意美依继续说下去）' },
  ],
};

export const whisperClickMain: StoryDef = {
  id: 'test:story:whisper_click_main',
  name: '主剧情 · insert 点击子剧情',
  talklets: [
    { speaker: '美依', text: '老师，借一步说话。', jumpToStory: 'test:story:whisper_click_sub', jumpMode: 'insert' },
    { speaker: '老师', text: '原来如此。', sendText: '明白了' },
  ],
};

export const whisperClickEntry: StoryEntryDef = {
  id: 'test:story:whisper_click',
  storyId: 'test:story:whisper_click_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

export const whisperClickPack = makePack([whisperClickEntry], [whisperClickMain, whisperClickSub]);

export const gotoClickTarget: StoryDef = {
  id: 'test:story:goto_click_target',
  name: 'goto 目标 · 末页点击',
  talklets: [
    { kind: 'click', text: '按下终端的确认键' },
  ],
};

export const gotoClickMain: StoryDef = {
  id: 'test:story:goto_click_main',
  name: 'goto 主 · 跳转',
  talklets: [
    { speaker: '老师', text: '去终端看看。', jumpToStory: 'test:story:goto_click_target' },
  ],
};

export const gotoClickEntry: StoryEntryDef = {
  id: 'test:story:goto_click',
  storyId: 'test:story:goto_click_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

export const gotoClickPack = makePack([gotoClickEntry], [gotoClickMain, gotoClickTarget]);
