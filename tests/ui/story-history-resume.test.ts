// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';
import { finishWelcome, makePack, supplyPack } from '../engine/story-test-fixtures';
import { and } from '../../src/engine/types';
import '../../src/ui/service-definitions';

const ENTRY = 'test:activestory:history';
const STORY = 'test:story:history';
const TEXT = '重复文本仍应按页显示';

describe('Story 历史恢复', () => {
  let game: GameInstance;
  let controller: UIController;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    game = new GameInstance();
    game.init([baseDatapack, makePack([
      { id: ENTRY, storyId: STORY, type: 'active', availableInits: [], triggerCondition: and(), replayable: true },
    ], [
      { id: STORY, name: '历史恢复', talklets: [
        { speaker: '阿罗娜', text: TEXT, typing: 0, thinking: 0, sendText: '继续' },
        { speaker: '阿罗娜', text: TEXT, typing: 0, thinking: 0, sendText: '完成' },
      ] },
    ]), supplyPack]);
    game.inits.startNewGame('base:init:schale_office');
    finishWelcome(game);
    controller = new UIController(game, document.querySelector('#app')!);
    controller.started = true;
  });

  afterEach(() => {
    controller.chat.reset();
    controller.destroy();
    game.stop();
    vi.useRealTimers();
    localStorage.clear();
  });

  it.each([null, 'Hoshino'])('返回游戏再打开 Story 保留当前页且不重复入流（owner=%s）', owner => {
    expect(game.story.startActiveStory(ENTRY, owner).success).toBe(true);
    controller.openStoryWorkspace({ selectedEntryId: ENTRY, conversationOwner: owner, mode: 'playing' });
    controller.render();
    const history = controller.activeStream();
    expect(history.map(entry => entry.text)).toEqual([TEXT]);

    controller.root.querySelector<HTMLButtonElement>('[data-story-workspace-leave]')!.click();
    controller.openStoryWorkspace({ selectedEntryId: ENTRY, conversationOwner: owner, mode: 'playing' });
    controller.render();
    expect(controller.activeStream()).toBe(history);
    expect(history.map(entry => entry.text)).toEqual([TEXT]);
  });

  it.each([null, 'Hoshino'])('保存并读取后当前页不重复，下一页相同文本正常入流（owner=%s）', owner => {
    expect(game.story.startActiveStory(ENTRY, owner).success).toBe(true);
    controller.openStoryWorkspace({ selectedEntryId: ENTRY, conversationOwner: owner, mode: 'playing' });
    controller.render();
    const saved = JSON.parse(JSON.stringify(controller.withHistories(game.save())));

    game.load(saved);
    controller.resetSessionPanel();
    controller.restoreHistories(saved);
    controller.render();
    controller.openStoryWorkspace({ conversationOwner: owner, mode: 'playing' });
    controller.render();
    expect(controller.activeStream().map(entry => entry.text)).toEqual([TEXT]);

    expect(game.story.advanceStory(undefined, owner).success).toBe(true);
    controller.refreshChatPanel();
    expect(controller.activeStream().map(entry => entry.text)).toEqual([TEXT, TEXT]);
    expect(new Set(controller.activeStream().map(entry => entry.id)).size).toBe(2);

    expect(game.story.advanceStory(undefined, owner).success).toBe(true);
    controller.refreshChatPanel();
    expect(game.story.replayStory(ENTRY, owner).success).toBe(true);
    controller.refreshChatPanel();
    expect(controller.activeStream().map(entry => entry.text)).toEqual([TEXT, TEXT, TEXT]);
  });

  it('全新 Controller 恢复历史时继续分配唯一消息 ID', () => {
    expect(game.story.startActiveStory(ENTRY).success).toBe(true);
    controller.render();
    const saved = JSON.parse(JSON.stringify(controller.withHistories(game.save())));
    controller.destroy();
    controller = new UIController(game, controller.root);
    controller.started = true;
    game.load(saved);
    controller.restoreHistories(saved);
    controller.render();
    expect(controller.activeStream()).toHaveLength(1);
    game.story.advanceStory();
    controller.refreshChatPanel();
    expect(new Set(controller.activeStream().map(entry => entry.id)).size).toBe(2);
  });

  it('相邻页台词相同时，存档中未送达的打字页仍正常投递', () => {
    const story = game.registry.stories.get(STORY)!;
    story.talklets[1].typing = 1;
    expect(game.story.startActiveStory(ENTRY).success).toBe(true);
    controller.render();
    game.story.advanceStory();
    controller.refreshChatPanel();
    expect(controller.activeStream().map(entry => entry.kind)).toEqual(['talk', 'typing']);
    const saved = JSON.parse(JSON.stringify(controller.withHistories(game.save())));
    game.load(saved);
    controller.resetSessionPanel();
    controller.restoreHistories(saved);
    controller.render();
    expect(controller.activeStream().map(entry => entry.kind)).toEqual(['talk', 'typing']);
    vi.advanceTimersByTime(1000);
    expect(controller.activeStream().map(entry => entry.text)).toEqual([TEXT, TEXT]);
  });

  it('已送达的连发页读档后继续推进，不重复投递本页', async () => {
    const story = game.registry.stories.get(STORY)!;
    delete story.talklets[0].sendText;
    expect(game.story.startActiveStory(ENTRY).success).toBe(true);
    controller.render();
    const saved = JSON.parse(JSON.stringify(controller.withHistories(game.save())));
    game.load(saved);
    controller.resetSessionPanel();
    controller.restoreHistories(saved);
    controller.render();
    expect(controller.activeStream()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(450);
    expect(game.getView().currentStory?.pageIndex).toBe(1);
    expect(controller.activeStream().map(entry => entry.text)).toEqual([TEXT, TEXT]);
  });

  it('insert 返回相同 Entry 页码时仍显示不同 StoryDef 的页面', () => {
    expect(game.story.startStory('test:story:supply_mission', 'passive').success).toBe(true);
    game.story.advanceStory();
    controller.render(); // 主剧情的第 1 页
    vi.advanceTimersByTime(900);
    expect(controller.activeStream()).toHaveLength(1);
    game.story.advanceStory(); // 插入子剧情第 0 页，不渲染
    game.story.advanceStory(); // 子剧情第 1 页，与刚显示的主剧情页码相同
    controller.refreshChatPanel();
    vi.advanceTimersByTime(900);
    expect(controller.activeStream().map(entry => entry.text)).toEqual([
      '对了，便利店那边有件事要顺路处理一下。',
      '谢谢！帮大忙了。',
    ]);
  });
});
