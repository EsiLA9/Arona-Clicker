import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/story-test-fixtures.ts — story 系列测试共享数据与工具
// （非 .test.ts，不会被 vitest 收集）
// ============================================================
import type { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { StoryEntryDef, ActiveStoryEntry } from '../../src/data-services/contracts/story-entry';
import { and } from '../../src/engine/types';
import { Resource } from '../../src/arona-clicker/types/ids';

/** 推进当前剧情直到完成；正文确认、按钮和选项都使用当前 node ticket。 */
export function finishWelcome(g: GameInstance, owner: string | null = null): void {
  finishStory(g, 0, owner);
}

/** 连续推进直到剧情结束；遇到选项时优先选第 choiceIndex 个可用候选。 */
export function finishStory(g: GameInstance, choiceIndex = 0, owner: string | null = null): void {
  for (let guard = 0; guard < 200; guard++) {
    const view = g.story.getCurrentStoryView(owner);
    if (!view) return;
    if (view.phase === 'delivery') {
      const result = g.story.advanceStory(undefined, owner, view.token);
      if (!result.success) return;
      continue;
    }

    const choices = view.page.choices;
    if (choices?.length) {
      const selectedIndex = view.availableChoiceIndexes.includes(choiceIndex)
        ? choiceIndex
        : view.availableChoiceIndexes[0];
      if (selectedIndex === undefined) return;
      const result = g.story.advanceStory(choices[selectedIndex]!.id, owner, view.token);
      if (!result.success) return;
      if (result.finished) return;
      continue;
    }

    const sent = g.story.clickSend(owner, view.token);
    if (sent.type === 'idle' || sent.type === 'choice') return;
    if (sent.type === 'completed' && !sent.advance.success) return;
  }
}

// ============================================================
// 测试数据：阿比多斯沙漠委托（演示分歧 → 共同收尾）
// ============================================================

export const desertIntro: StoryDef = { id: 'test:story:desert_intro', name: '沙漠委托 · 开场', stages: { 'p1': { advance: 'auto' }, 'p2': { advance: 'input' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '—— 阿比多斯 · 委托板前 ——' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '老师，沙漠里出现了大批违规运输队。要怎么处理？', speaker: '白子' } },
  { id: 'p2-choice', type: 'click', stageId: 'p2', interaction: { kind: 'choice', options: [{ id: 'option1', text: '正面突击', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'route', value: 'assault' }] }], transfer: { mode: 'goto', storyId: 'test:story:desert_assault' } } }, { id: 'option2', text: '迂回谈判', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'route', value: 'negotiate' }] }], transfer: { mode: 'goto', storyId: 'test:story:desert_negotiate' } } }] } },
] };

export const desertAssault: StoryDef = { id: 'test:story:desert_assault', name: '沙漠委托 · 突击', stages: { 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '突击队已就位，正面突破！', speaker: '白子' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '运输队投降了。收尾吧。', speaker: '老师' } },
  { id: 'p2-transfer', type: 'transfer', transfer: { mode: 'goto', storyId: 'test:story:desert_epilogue' } },
] };

export const desertNegotiate: StoryDef = { id: 'test:story:desert_negotiate', name: '沙漠委托 · 谈判', stages: { 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '大叔我试着跟他们聊聊，结果他们同意付过路费了。', speaker: '星野' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '谈判成功，收尾吧。', speaker: '老师' } },
  { id: 'p2-transfer', type: 'transfer', transfer: { mode: 'goto', storyId: 'test:story:desert_epilogue' } },
] };

export const desertEpilogue: StoryDef = { id: 'test:story:desert_epilogue', name: '沙漠委托 · 收尾', stages: { 'p1': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '委托完成。感谢老师协助。', speaker: '白子' } },
  { id: 'p1-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 10 }] } },
] };

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

export const supplyMain: StoryDef = { id: 'test:story:supply_main', name: '补给任务', stages: { 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' }, 'p3': { advance: 'auto' }, 'p4': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师，补给清单已经列好了。', speaker: '芹香' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '对了，便利店那边有件事要顺路处理一下。', speaker: '芹香' } },
  { id: 'p2-transfer', type: 'transfer', transfer: { mode: 'insert', storyId: 'test:story:supply_detail' } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '处理完了，继续补给任务。', speaker: '芹香' } },
  { id: 'p4-body', type: 'talklet', stageId: 'p4', content: { kind: 'talk', text: '全部清单核对完毕。', speaker: '老师' } },
  { id: 'p4-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] } },
] };

export const supplyDetail: StoryDef = { id: 'test:story:supply_detail', name: '便利店小插曲', stages: { 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '啊，芹香同学，正好你来了——找零多出来一张优惠券。', speaker: '店员' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '谢谢！帮大忙了。', speaker: '芹香' } },
] };

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

export const edgeMain: StoryDef = { id: 'test:story:edge_main', name: '边缘任务', stages: { 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师，这是最后一项检查了。', speaker: '阿罗娜' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '我顺路查一下服务器。', speaker: '阿罗娜' } },
  { id: 'p2-transfer', type: 'transfer', transfer: { mode: 'insert', storyId: 'test:story:edge_sub' } },
] };

export const edgeSub: StoryDef = { id: 'test:story:edge_sub', name: '服务器检查', stages: { 'p1': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '服务器一切正常。', speaker: '阿罗娜' } },
] };

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

export const loopA: StoryDef = { id: 'test:story:loop_a', name: '循环 A', stages: { 'p1': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '去 B。', speaker: 'A' } },
  { id: 'p1-transfer', type: 'transfer', transfer: { mode: 'goto', storyId: 'test:story:loop_b' } },
] };

export const loopB: StoryDef = { id: 'test:story:loop_b', name: '循环 B', stages: { 'p1': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '回 A。', speaker: 'B' } },
  { id: 'p1-transfer', type: 'transfer', transfer: { mode: 'goto', storyId: 'test:story:loop_a' } },
] };

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

export const clickGateMain: StoryDef = { id: 'test:story:click_gate_main', name: '点击门控 · 主', stages: { 'p1': { advance: 'input' }, 'p1-confirm': { advance: 'input' } }, nodes: [
  { id: 'p1-work', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '长按开关启动机器', press: { base: 1, } } },
  { id: 'p1-confirm-click', type: 'click', stageId: 'p1-confirm', interaction: { kind: 'button', text: '长按开关启动机器', result: { transfer: { mode: 'goto', storyId: 'test:story:click_gate_target' } } } },
] };

export const clickGateTarget: StoryDef = { id: 'test:story:click_gate_target', name: '点击门控 · 目标', stages: { 'p1': { advance: 'input' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '机器启动了，很好。', speaker: '优香' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '好的', reply: { kind: 'talk', text: '好的' } } },
] };

export const clickGateEntry: StoryEntryDef = {
  id: 'test:story:click_gate',
  storyId: 'test:story:click_gate_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

export const clickGatePack = makePack([clickGateEntry], [clickGateMain, clickGateTarget]);

// 多击版本：clickWork(base: 2) + jumpToStory
export const clickWorkGateMain: StoryDef = { id: 'test:story:clickwork_gate_main', name: '多击门控 · 主', stages: { 'p1': { advance: 'input' }, 'p1-confirm': { advance: 'input' } }, nodes: [
  { id: 'p1-work', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '连续敲击 2 次开启保险库', press: { base: 2, } } },
  { id: 'p1-confirm-click', type: 'click', stageId: 'p1-confirm', interaction: { kind: 'button', text: '连续敲击 2 次开启保险库', result: { transfer: { mode: 'goto', storyId: 'test:story:clickwork_gate_target' } } } },
] };

export const clickWorkGateTarget: StoryDef = { id: 'test:story:clickwork_gate_target', name: '多击门控 · 目标', stages: { 'p1': { advance: 'input' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '保险库开启了。', speaker: '优香' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '收下钥匙', reply: { kind: 'talk', text: '收下钥匙' } } },
] };

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

export const whisperClickSub: StoryDef = { id: 'test:story:whisper_click_sub', name: '悄悄话 · 末页点击', stages: { 'p1': { advance: 'input' }, 'p1-confirm': { advance: 'input' } }, nodes: [
  { id: 'p1-work', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '（示意美依继续说下去）', press: { base: 1, } } },
  { id: 'p1-confirm-click', type: 'click', stageId: 'p1-confirm', interaction: { kind: 'button', text: '（示意美依继续说下去）' } },
] };

export const whisperClickMain: StoryDef = { id: 'test:story:whisper_click_main', name: '主剧情 · insert 点击子剧情', stages: { 'p1': { advance: 'auto' }, 'p2': { advance: 'input' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师，借一步说话。', speaker: '美依' } },
  { id: 'p1-transfer', type: 'transfer', transfer: { mode: 'insert', storyId: 'test:story:whisper_click_sub' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '原来如此。', speaker: '老师' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '明白了', reply: { kind: 'talk', text: '明白了' } } },
] };

export const whisperClickEntry: StoryEntryDef = {
  id: 'test:story:whisper_click',
  storyId: 'test:story:whisper_click_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

export const whisperClickPack = makePack([whisperClickEntry], [whisperClickMain, whisperClickSub]);

export const gotoClickTarget: StoryDef = { id: 'test:story:goto_click_target', name: 'goto 目标 · 末页点击', stages: { 'p1': { advance: 'input' }, 'p1-confirm': { advance: 'input' } }, nodes: [
  { id: 'p1-work', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '按下终端的确认键', press: { base: 1, } } },
  { id: 'p1-confirm-click', type: 'click', stageId: 'p1-confirm', interaction: { kind: 'button', text: '按下终端的确认键' } },
] };

export const gotoClickMain: StoryDef = { id: 'test:story:goto_click_main', name: 'goto 主 · 跳转', stages: { 'p1': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '去终端看看。', speaker: '老师' } },
  { id: 'p1-transfer', type: 'transfer', transfer: { mode: 'goto', storyId: 'test:story:goto_click_target' } },
] };

export const gotoClickEntry: StoryEntryDef = {
  id: 'test:story:goto_click',
  storyId: 'test:story:goto_click_main',
  type: 'active',
  availableInits: [],
  triggerCondition: and(),
};

export const gotoClickPack = makePack([gotoClickEntry], [gotoClickMain, gotoClickTarget]);
