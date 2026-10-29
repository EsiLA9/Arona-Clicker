// @vitest-environment happy-dom
// ============================================================
// controller-tab-linkage.test.ts — Workspace 内容选择与导航动作
// ============================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';

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

  const clickNavigation = (destination: string) => {
    root.querySelector<HTMLButtonElement>(`[data-workspace-navigation="${destination}"]`)!.click();
  };

  it('对话返回动作恢复一般聊天流', () => {
    // 模拟从通讯录/剧情进入学生对话空间
    panel.conversationVariantId = HOSHINO;
    panel.selectedVariantId = HOSHINO;
    panel.centerTab = 'chat';
    controller.render();
    expect(root.querySelector('.center-panel.conversation-panel')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-conversation-back]')!.click();

    expect(panel.leftTab).toBe('area');
    expect(panel.centerTab).toBe('chat');
    expect(panel.conversationVariantId).toBeNull();
    expect(panel.selectedVariantId).toBeNull();
    expect(root.querySelector('.center-panel.conversation-panel')).toBeNull();
    expect(root.querySelector('.center-panel .chat-pane')).not.toBeNull();
  });

  it('区域导航动作打开 Contacts / Story Workspace，不生成位置 Tab 协议', () => {
    expect(root.querySelector('[data-tab]')).toBeNull();
    const frame = root.querySelector<HTMLElement>('[data-workspace-frame="game"]')!;
    expect([...frame.querySelectorAll<HTMLElement>('[data-column-key]')].map(column => column.dataset.columnKey))
      .toEqual(['area-navigation', 'activity', 'tools']);
    for (const column of frame.querySelectorAll<HTMLElement>('[data-column-instance]')) {
      expect(column.querySelectorAll('.panel')).toHaveLength(0);
    }
    clickNavigation('contacts');
    expect(panel.workspace?.type).toBe('contacts');
    expect(root.querySelector('[data-workspace-frame="contacts"]')).not.toBeNull();
    expect(panel.centerTab).toBe('chat');

    root.querySelector<HTMLButtonElement>('[data-contacts-workspace-leave]')!.click();
    clickNavigation('story');
    expect(panel.workspace?.type).toBe('story');
    expect(root.querySelector('[data-workspace-frame="story"]')).not.toBeNull();
    expect(panel.centerTab).toBe('chat');
    expect(panel.leftTab).toBe('area');
    expect(panel.centerTab).not.toBe('contacts-draft');
    expect(panel.centerTab).not.toBe('archive-draft');
  });

  it('切换右栏只刷新右栏，不重建左栏与中栏', () => {
    const leftBefore = root.querySelector('.left-panel');
    const centerBefore = root.querySelector('.center-panel');
    const frameBefore = root.querySelector('[data-workspace-frame="game"]');
    const toolsBefore = root.querySelector<HTMLElement>('[data-column-key="tools"]')!;
    const fullBefore = controller.getRefreshStats().fullRenders;

    root.querySelector<HTMLButtonElement>('[data-column-action="tools:enh"]')!.click();

    expect(root.querySelector('.left-panel')).toBe(leftBefore);
    expect(root.querySelector('.center-panel')).toBe(centerBefore);
    expect(root.querySelector('[data-workspace-frame="game"]')).toBe(frameBefore);
    const toolsAfter = root.querySelector<HTMLElement>('[data-column-key="tools"]')!;
    expect(toolsAfter.dataset.columnDefinition).toBe('enhancements');
    expect(toolsAfter.dataset.columnKey).toBe('tools');
    expect(toolsAfter).not.toBe(toolsBefore);
    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect(controller.getRefreshStats().panelRefreshes).toBeGreaterThan(0);
  });

  it('activity 展示组在 Chat / Log 间切换 definition 并保留左右栏', () => {
    const frame = root.querySelector('[data-workspace-frame="game"]');
    const left = root.querySelector('.left-panel');
    const tools = root.querySelector('[data-column-key="tools"]');
    root.querySelector<HTMLButtonElement>('[data-column-action="activity:log"]')!.click();
    expect(panel.centerTab).toBe('log');
    expect(root.querySelector('[data-workspace-frame="game"]')).toBe(frame);
    expect(root.querySelector('.left-panel')).toBe(left);
    expect(root.querySelector('[data-column-key="tools"]')).toBe(tools);
    expect(root.querySelector<HTMLElement>('[data-column-key="activity"]')?.dataset.columnDefinition).toBe('log');
  });
});
