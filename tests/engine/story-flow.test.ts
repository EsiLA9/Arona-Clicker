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
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { finishWelcome, clickGatePack, clickWorkGatePack, whisperClickPack, gotoClickPack } from './story-test-fixtures';

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

    // 经 clickSend 完成点击（total=1 → 一次即确认）→ 跳转成功
    const send = game.story.getSendState();
    if (send.mode !== 'advance' || !send.clickWork) throw new Error('expected advance+clickWork');
    expect(send.clickWork).toEqual({ total: 1, done: 0 });
    const r = game.story.clickSend();
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:click_gate_target');
  });

  test('clickWork 多击 + goto：需填满并再确认一次才跳转', () => {
    game.init([baseDatapack, clickWorkGatePack]);
    finishWelcome(game);

    expect(game.story.startActiveStory('test:story:clickwork_gate').success).toBe(true);
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:clickwork_gate_main');

    // 未完成点击：直接推进被拒
    expect(game.story.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });

    // 第一次点击 → working（1/2）
    expect(game.story.clickSend()).toMatchObject({ type: 'working', clicksDone: 1, clicksTotal: 2 });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:clickwork_gate_main');

    // 第二次点击 → working（2/2 填满）
    expect(game.story.clickSend()).toMatchObject({ type: 'working', clicksDone: 2, clicksTotal: 2 });
    // 填满后直接 advanceStory 仍被拒（未确认）
    expect(game.story.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });

    // 第三次点击 → 确认 → 跳转
    const r = game.story.clickSend();
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:clickwork_gate_target');
  });

  test('insert 子剧情末页为 click：返回原地前必须先完成点击（不省略）', () => {
    game.init([baseDatapack, whisperClickPack]);
    finishWelcome(game);

    expect(game.story.startActiveStory('test:story:whisper_click').success).toBe(true);
    // main t0（insert 跳转页）→ 进入子剧情 t0（click 页）
    expect(game.story.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:whisper_click_sub');
    expect(game.getView().currentStory!.page.kind).toBe('click');

    // 未完成点击直接推进 → ClickRequired（不省略 click、不提前弹栈返回）
    expect(game.story.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:whisper_click_sub');

    // 完成点击 → 弹栈返回 main t1
    const r = game.story.clickSend();
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:whisper_click_main');
    expect(game.getView().currentStory!.pageIndex).toBe(1);
  });

  test('goto 目标末页为 click：链完结前必须先完成点击（不省略）', () => {
    game.init([baseDatapack, gotoClickPack]);
    finishWelcome(game);

    expect(game.story.startActiveStory('test:story:goto_click').success).toBe(true);
    // main t0（goto 跳转页）→ 进入目标 t0（click 页）
    expect(game.story.advanceStory()).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('test:story:goto_click_target');

    // 未完成点击直接推进 → ClickRequired（不省略 click、不直接完结）
    expect(game.story.advanceStory()).toMatchObject({ success: false, error: 'ClickRequired' });
    expect(game.getView().currentStory).not.toBeNull();

    // 完成点击 → 链完结
    const r = game.story.clickSend();
    expect(r.type).toBe('completed');
    expect(game.getView().currentStory).toBeNull();
  });

  test('choice 页 text 默认阻塞：确认文本后才显示选项', () => {
    game.init([baseDatapack]);
    // 从头用 clickSend 推进欢迎剧情到选项页（page5）：逐页阻塞，每页一次点击
    expect(game.story.clickSend().type).toBe('completed'); // page0 → page1(sendText)
    expect(game.story.clickSend().type).toBe('completed'); // page1 → page2(老师)
    expect(game.story.clickSend().type).toBe('completed'); // page2 → page3(clickWork)
    const work = game.story.getSendState();
    if (work.mode !== 'advance' || !work.clickWork) throw new Error('expected advance with clickWork');
    for (let i = 0; i < work.clickWork.total; i++) expect(game.story.clickSend().type).toBe('working');
    expect(game.story.clickSend().type).toBe('completed'); // 填满后再点一次：page3 → page4(旁白)
    expect(game.story.clickSend().type).toBe('completed'); // page4 → page5(choice)

    // choice 页未确认：mode='choice' 且 confirmed=false（选项被 text 阻塞）
    expect(game.story.getSendState()).toMatchObject({ mode: 'choice', confirmed: false });

    // 点击"继续"→ 确认文本 → 返回 choice（UI 随后渲染选项）
    expect(game.story.clickSend()).toEqual({ type: 'choice' });
    expect(game.story.getSendState()).toMatchObject({ mode: 'choice', confirmed: true });

    // 已确认后点击保持 choice（不推进）
    expect(game.story.clickSend()).toEqual({ type: 'choice' });

    // 选择选项 → 正常推进
    expect(game.story.advanceStory(0)).toMatchObject({ success: true, finished: false });
    // 离开选项页后确认状态重置
    expect(game.story.getSendState()).not.toMatchObject({ mode: 'choice' });
  });

  test('millennium 演示：click 阻塞逐步推进 + insert 子剧情逐句点击 + choice text 阻塞', () => {
    game.init([baseDatapack]);
    finishWelcome(game);

    // 启动千禧年危机（active entry，availableInits 限 millennium init → 用 replayStory 绕过）
    expect(game.story.replayStory('base:activestory:millennium_game_crisis').success).toBe(true);

    // t0 旁白（普通页）→ advance 模式，逐页阻塞
    expect(game.story.getSendState()).toMatchObject({ mode: 'advance' });
    // 点击 → 推进 t0 → t1（桃依，sendText 交互页）
    expect(game.story.clickSend().type).toBe('completed');
    expect(game.getView().currentStory!.pageIndex).toBe(1);
    // 点击发送"冷静一下，桃依。"→ 推进到 t2（美依，普通 talk + insert 跳转页，不再吸收）
    const step1 = game.story.clickSend();
    expect(step1.type).toBe('completed');
    expect(step1.type === 'completed' && step1.absorbed).toEqual([]);
    expect(game.getView().currentStory!.pageIndex).toBe(2);
    expect(game.getView().currentStory!.page.speaker).toBe('美依');
    expect(game.getView().currentStory!.page.kind).toBeUndefined();

    // 点击 → insert 跳转到 whisper t0（普通 talk 页，逐页阻塞）
    expect(game.story.clickSend().type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('base:story:millennium_game_crisis_whisper');
    expect(game.getView().currentStory!.pageIndex).toBe(0);
    expect(game.getView().currentStory!.page.speaker).toBe('美依');

    // 逐句点击 whisper 两页
    expect(game.story.clickSend().type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('base:story:millennium_game_crisis_whisper');
    expect(game.getView().currentStory!.pageIndex).toBe(1);
    expect(game.getView().currentStory!.page.speaker).toBe('桃依');
    // 最后一页点击 → 子剧情完结 → 弹栈返回 intro t3（老师的话 + choices）
    const step4 = game.story.clickSend();
    expect(step4.type).toBe('completed');
    expect(game.getView().currentStory!.storyDefId).toBe('base:story:millennium_game_crisis_intro');
    expect(game.getView().currentStory!.pageIndex).toBe(3);

    // choice 页 text 阻塞：先确认文本，后出现选项
    expect(game.story.getSendState()).toMatchObject({ mode: 'choice', confirmed: false });
    expect(game.story.clickSend()).toEqual({ type: 'choice' });
    expect(game.story.getSendState()).toMatchObject({ mode: 'choice', confirmed: true });

    // 选"亲自上手调试" → goto 跳转到 debug 分支（守卫仅保护 bribe 分支，不受影响）
    expect(game.story.advanceStory(0)).toMatchObject({ success: true, finished: false });
    expect(game.getView().currentStory!.storyDefId).toBe('base:story:millennium_game_crisis_debug');
  });
});
