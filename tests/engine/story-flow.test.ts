// ============================================================
// engine/story-flow.test.ts — Story 主流程（click 门控 / clickSend 推进）
//
// 覆盖机制：
//   1. click 页 + goto：未完成点击返回 ClickRequired
//   2. clickWork 多击 + goto：填满并再确认一次才跳转
//   3. insert 子剧情末页 click：返回原地前先完成点击
//   4. goto 目标末页 click：链完结前先完成点击
//   5. choice 页 text 默认阻塞
//   6. millennium 演示：click 阻塞 + insert + choice text 阻塞
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { ActiveStoryEntry } from '../../src/data-services/contracts/story-entry';
import { baseDatapack } from '../../src/data/test-datapack';
import { and } from '../../src/engine/types';
import { finishWelcome, clickGatePack, clickWorkGatePack, whisperClickPack, gotoClickPack, makePack } from './story-test-fixtures';

function currentStory(game: GameInstance) {
  const view = game.story.getCurrentStoryView();
  if (!view) throw new Error('expected current StoryNode wait point');
  return view;
}

function deliver(game: GameInstance) {
  const view = currentStory(game);
  if (view.phase !== 'delivery') throw new Error(`expected delivery, got ${view.phase}`);
  return game.story.advanceStory(undefined, null, view.token);
}

function click(game: GameInstance) {
  const view = currentStory(game);
  if (view.phase !== 'input') throw new Error(`expected input, got ${view.phase}`);
  return game.story.clickSend(null, view.token);
}

describe('Story 主流程（click 门控推进）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
  });

  afterEach(() => {
    game.stop();
  });

  test('click 页 + goto：未完成点击时 advanceStory 返回 ClickRequired（不触发跳转）', () => {
    game.init([baseDatapack, clickGatePack]);
    finishWelcome(game);

    expect(game.story.startActiveStory('test:story:click_gate').success).toBe(true);
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:click_gate_main');
    expect(game.getView().currentStory!.page.kind).toBe('click');

    // 直接 advanceStory：点击未完成 → ClickRequired，且不触发跳转
    const blocked = game.story.advanceStory();
    expect(blocked).toMatchObject({ success: false, error: 'ClickRequired' });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:click_gate_main');

    // N=1 的按击工作完成后，流程到达独立确认 Click。
    const send = game.story.getSendState();
    if (send.mode !== 'advance' || !send.clickWork) throw new Error('expected advance+clickWork');
    expect(send.clickWork).toEqual({ total: 1, done: 0 });
    const r = click(game);
    expect(r.type).toBe('completed');
    expect(currentStory(game)).toMatchObject({ nodeId: 'p1-confirm-click', phase: 'input' });
    expect(click(game).type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:click_gate_target');
  });

  test('press=N 恰好完成 N 次，再由显式确认 Click 执行 goto', () => {
    game.init([baseDatapack, clickWorkGatePack]);
    finishWelcome(game);

    expect(game.story.startActiveStory('test:story:clickwork_gate').success).toBe(true);
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:clickwork_gate_main');

    // 未完成点击：直接推进被拒
    expect(game.story.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });

    // 第一次点击 → working（1/2）
    expect(click(game)).toMatchObject({ type: 'working', clicksDone: 1, clicksTotal: 2 });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:clickwork_gate_main');

    // 第二次点击恰好完成工作量并到达独立确认 Click。
    expect(click(game).type).toBe('completed');
    expect(currentStory(game)).toMatchObject({ nodeId: 'p1-confirm-click', phase: 'input' });
    // 确认 Click 仍不能用 advanceStory 绕过。
    expect(game.story.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });

    // 确认输入 → 跳转
    const r = click(game);
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:clickwork_gate_target');
  });

  test('insert 子剧情末页为 click：返回原地前必须先完成点击（不省略）', () => {
    game.init([baseDatapack, whisperClickPack]);
    finishWelcome(game);

    expect(game.story.startActiveStory('test:story:whisper_click').success).toBe(true);
    // 正文 delivery ack 后，insert 自动进入子剧情的第一个 Click。
    expect(deliver(game)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:whisper_click_sub');
    expect(game.getView().currentStory!.page.kind).toBe('click');

    // 未完成点击直接推进 → ClickRequired（不省略 click、不提前弹栈返回）
    expect(game.story.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:whisper_click_sub');

    // 完成点击 → 弹栈返回 main t1
    expect(click(game).type).toBe('completed');
    expect(currentStory(game)).toMatchObject({ nodeId: 'p1-confirm-click', phase: 'input' });
    const r = click(game);
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:whisper_click_main');
    expect(currentStory(game)).toMatchObject({ nodeId: 'p2-body', phase: 'delivery' });
  });

  test('goto 目标末页为 click：链完结前必须先完成点击（不省略）', () => {
    game.init([baseDatapack, gotoClickPack]);
    finishWelcome(game);

    expect(game.story.startActiveStory('test:story:goto_click').success).toBe(true);
    // 正文 delivery ack 后，goto 自动进入目标的第一个 Click。
    expect(deliver(game)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:goto_click_target');

    // 未完成点击直接推进 → ClickRequired（不省略 click、不直接完结）
    expect(game.story.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });
    expect(game.getView().currentStory).not.toBeNull();

    // 完成点击 → 链完结
    expect(click(game).type).toBe('completed');
    expect(currentStory(game)).toMatchObject({ nodeId: 'p1-confirm-click', phase: 'input' });
    const r = click(game);
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory).toBeNull();
  });

  test('正文确认与 choice 是两个显式 Click 阶段', () => {
    const entryId = 'test:story:explicit_choice';
    const story: StoryDef = {
      id: 'test:story:explicit_choice_doc', name: '明确确认与选择',
      stages: { confirm: { advance: 'input' }, choice: { advance: 'input' } },
      nodes: [
        { id: 'prompt', type: 'talklet', stageId: 'confirm', content: { kind: 'talk', text: '选一条路线。', speaker: '测试' } },
        { id: 'confirm', type: 'click', stageId: 'confirm', interaction: { kind: 'button', text: '我看完了。' } },
        { id: 'route', type: 'click', stageId: 'choice', interaction: { kind: 'choice', options: [
          { id: 'left', text: '左边' }, { id: 'right', text: '右边' },
        ] } },
      ],
    };
    const entry: ActiveStoryEntry = { id: entryId, storyId: story.id, type: 'active', availableInits: [], triggerCondition: and() };
    game.init([baseDatapack, makePack([entry], [story])]);
    finishWelcome(game);
    expect(game.story.startActiveStory(entryId).success).toBe(true);

    expect(deliver(game)).toMatchObject({ success: true, finished: false });
    expect(currentStory(game)).toMatchObject({ nodeId: 'confirm', phase: 'input' });
    expect(game.story.getSendState()).toMatchObject({ mode: 'advance' });
    expect(click(game).type).toBe('completed');
    expect(currentStory(game)).toMatchObject({ nodeId: 'route', phase: 'input' });
    expect(game.story.getSendState()).toMatchObject({ mode: 'choice', confirmed: true });
    expect(game.story.clickSend(null, currentStory(game).token)).toEqual({ type: 'choice' });
    const route = currentStory(game);
    const selected = game.story.advanceStory(route.page.choices![1]!.id, null, route.token);
    expect(selected).toMatchObject({ success: true, finished: true });
  });

  test('millennium 演示：click 阻塞逐步推进 + insert 子剧情逐句点击 + choice text 阻塞', () => {
    game.init([baseDatapack]);
    finishWelcome(game);

    // 启动千禧年危机（active entry，availableInits 限 millennium init → 用 replayStory 绕过）
    expect(game.story.replayStory('base:activestory:millennium_game_crisis').success).toBe(true);

    // 依次送达 intro 旁白、桃依正文与按钮；按钮后送达美依正文。
    expect(currentStory(game)).toMatchObject({ storyDefId: 'base:story:millennium_game_crisis_intro', nodeId: 'p1-body', phase: 'delivery' });
    expect(deliver(game)).toMatchObject({ success: true, finished: false });
    expect(currentStory(game)).toMatchObject({ nodeId: 'p2-body', phase: 'delivery', page: { speaker: '桃依' } });
    expect(deliver(game)).toMatchObject({ success: true, finished: false });
    expect(currentStory(game)).toMatchObject({ nodeId: 'p2-button', phase: 'input' });
    expect(click(game).type).toBe('completed');
    expect(currentStory(game)).toMatchObject({ nodeId: 'p3-body', page: { speaker: '美依' }, phase: 'delivery' });
    expect(deliver(game)).toMatchObject({ success: true, finished: false });
    expect(currentStory(game)).toMatchObject({ storyDefId: 'base:story:millennium_game_crisis_whisper', nodeId: 'p1-body', phase: 'delivery', page: { speaker: '美依' } });
    expect(deliver(game)).toMatchObject({ success: true, finished: false });
    expect(currentStory(game)).toMatchObject({ storyDefId: 'base:story:millennium_game_crisis_whisper', nodeId: 'p2-body', phase: 'delivery', page: { speaker: '桃依' } });
    expect(deliver(game)).toMatchObject({ success: true, finished: false });
    expect(currentStory(game)).toMatchObject({ storyDefId: 'base:story:millennium_game_crisis_intro', nodeId: 'p4-body', phase: 'delivery', page: { speaker: '老师' } });
    expect(deliver(game)).toMatchObject({ success: true, finished: false });
    const choice = currentStory(game);
    expect(choice).toMatchObject({ storyDefId: 'base:story:millennium_game_crisis_intro', nodeId: 'p4-choice', phase: 'input' });
    expect(game.story.getSendState()).toMatchObject({ mode: 'choice', confirmed: true });

    // 选择 option1 → goto 调试分支；使用稳定optionId而非过滤后位置。
    expect(game.story.advanceStory(choice.page.choices![0]!.id, null, choice.token)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('base:story:millennium_game_crisis_debug');
  });
});
