// @vitest-environment happy-dom
// ============================================================
// controller-tab-linkage.test.ts — 左 Tab ↔ 中栏联动
// 点击 left:area 必须把中栏转为 Init 的一般聊天流：
// 退出对话空间（通讯录/剧情的聊天沙盒）、替换通讯录/档案临时页。
// ============================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';

const OFFICE = 'base:init:schale_office';
const HOSHINO = 'Hoshino';

describe('UIController 左 Tab ↔ 中栏联动', () => {
  let game: GameInstance;
  let root: HTMLElement;
  let controller: UIController;
  let panel: any;

  beforeEach(() => {
    localStorage.clear();
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    controller = new UIController(game, root);
    controller.mount();
    controller.startNewGame(OFFICE);
    game.mutations.acquireCharacter(HOSHINO, 'gacha');
    panel = (controller as unknown as { panelState: any }).panelState;
  });

  afterEach(() => {
    game.stop();
    localStorage.clear();
  });

  const clickLeftTab = (tabId: string) => {
    root.querySelector<HTMLButtonElement>(`[data-tab="left:${tabId}"]`)!.click();
  };

  it('点击 left:area 退出对话空间，中栏转为 Init 一般聊天流', () => {
    // 模拟从通讯录/剧情进入学生对话空间
    panel.conversationVariantId = HOSHINO;
    panel.selectedVariantId = HOSHINO;
    panel.centerTab = 'chat';
    controller.render();
    expect(root.querySelector('.center-panel.conversation-panel')).not.toBeNull();

    clickLeftTab('area');

    expect(panel.leftTab).toBe('area');
    expect(panel.centerTab).toBe('chat');
    expect(panel.conversationVariantId).toBeNull();
    expect(panel.selectedVariantId).toBeNull();
    expect(root.querySelector('.center-panel.conversation-panel')).toBeNull();
    expect(root.querySelector('.center-panel .chat-pane')).not.toBeNull();
  });

  it('点击 left:area 替换通讯录/档案临时页', () => {
    clickLeftTab('contacts');
    expect(panel.centerTab).toBe('contacts-draft');
    expect(root.querySelector('.center-panel')?.textContent).toContain('通讯录临时页');

    clickLeftTab('area');
    expect(panel.centerTab).toBe('chat');
    expect(root.querySelector('.center-panel .chat-pane')).not.toBeNull();

    // 故事 Tab 的"档案"入口 → 档案临时页 → left:area 回聊天
    clickLeftTab('story');
    root.querySelector<HTMLButtonElement>('[data-story-archive]')!.click();
    expect(panel.centerTab).toBe('archive-draft');
    clickLeftTab('area');
    expect(panel.centerTab).toBe('chat');
    expect(root.querySelector('.center-panel .chat-pane')).not.toBeNull();
  });

  it('切换右栏只刷新右栏，不重建左栏与中栏', () => {
    const leftBefore = root.querySelector('.left-panel');
    const centerBefore = root.querySelector('.center-panel');
    const fullBefore = controller.getRefreshStats().fullRenders;

    root.querySelector<HTMLButtonElement>('[data-tab="right:enh"]')!.click();

    expect(root.querySelector('.left-panel')).toBe(leftBefore);
    expect(root.querySelector('.center-panel')).toBe(centerBefore);
    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect(controller.getRefreshStats().panelRefreshes).toBeGreaterThan(0);
  });
});
