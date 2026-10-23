// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { UI_HOST_REGISTRY } from '../../src/ui/runtime/ui-host-registry';
import '../../src/ui/runtime/service-definitions';

describe('Contacts / Story Workspace ownership', () => {
  let game: GameInstance;
  let controller: UIController;
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    controller = new UIController(game, root);
    controller.started = true;
  });

  afterEach(() => {
    controller.destroy();
    game.stop();
    localStorage.clear();
  });

  it('通过 Game 入口进入 Contacts 后立即拥有独立三栏', () => {
    controller.render();
    root.querySelector<HTMLButtonElement>('[data-tab="left:contacts"]')!.click();

    expect(root.querySelector('[data-workspace-frame="contacts"]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-frame="game"]')).toBeNull();
    expect(root.querySelectorAll('[data-workspace-frame="contacts"] [data-workspace-column]')).toHaveLength(3);
    expect(root.querySelectorAll('[data-workspace-frame="contacts"] [data-workspace-owner="contacts"]')).toHaveLength(3);
    expect(root.querySelector('.contacts-empty, .workspace-placeholder')).not.toBeNull();
    expect(root.querySelector('.center-panel, .right-panel')).toBeNull();
    expect(root.querySelector('[data-workspace-frame="contacts"] .eyebrow')).toBeNull();
    const frame = root.querySelector<HTMLElement>('[data-workspace-frame="contacts"]')!;
    const titlebars = [
      ['left', 'leftPanel.tabs', '通讯录'],
      ['center', 'centerPanel.tabs', '学生故事'],
      ['right', 'rightPanel.tabs', '角色信息'],
    ] as const;
    expect(frame.querySelectorAll('.panel-tabs-region')).toHaveLength(3);
    for (const [slot, hostId, title] of titlebars) {
      const titlebar = frame.querySelector<HTMLElement>(`[data-workspace-column="${slot}"] .panel-tabs-region`);
      expect(titlebar).not.toBeNull();
      expect(titlebar?.classList.contains('ui-cluster')).toBe(true);
      expect(titlebar?.classList.contains(`ui-cluster--${slot}-tabs-region`)).toBe(true);
      expect(titlebar?.classList.contains('presentation-host-target')).toBe(true);
      expect(titlebar?.dataset.themeHostId).toBe(hostId);
      expect(titlebar?.textContent).toContain(title);
      expect(titlebar?.querySelector('.eyebrow')).toBeNull();
      expect(titlebar?.querySelector('.workspace-page-header')).toBeNull();
    }
    const leftTitlebar = frame.querySelector<HTMLElement>('[data-workspace-column="left"] .panel-tabs-region');
    const centerTitlebar = frame.querySelector<HTMLElement>('[data-workspace-column="center"] .panel-tabs-region');
    const rightTitlebar = frame.querySelector<HTMLElement>('[data-workspace-column="right"] .panel-tabs-region');
    const back = leftTitlebar?.querySelector<HTMLButtonElement>('[data-contacts-workspace-leave]');
    expect(centerTitlebar?.querySelector('[data-contacts-workspace-leave]')).toBeNull();
    expect(rightTitlebar?.querySelector('[data-contacts-workspace-leave]')).toBeNull();
    expect(back?.getAttribute('aria-label')).toBe('返回上一页');
    expect(back?.getAttribute('title')).toBe('返回上一页');
    expect(back?.textContent?.trim()).toBe('');
    expect(back?.querySelector('svg[viewBox="0 0 24 24"][aria-hidden="true"][focusable="false"] path')?.getAttribute('d')).toBe('M15 18 9 12 15 6');
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'contacts' });
    expect(controller.panelState.workspaceNavigation?.returnTo?.route).toEqual({ kind: 'game' });

    back?.click();
    expect(root.querySelector('[data-workspace-frame="game"]')).not.toBeNull();
    expect(root.querySelector('.topbar')).not.toBeNull();
  });

  it('选择学生只改变 Contacts 内部状态，不嵌套 CharacterWorkspace', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openContactsWorkspace();
    controller.render();
    const before = controller.getRefreshStats();
    root.querySelector<HTMLButtonElement>('[data-select-variant="Hoshino"]')!.click();

    const workspace = controller.panelState.workspace;
    expect(workspace?.type).toBe('contacts');
    if (workspace?.type !== 'contacts') throw new Error('Contacts Workspace 未挂载');
    expect(workspace.selectedVariantId).toBe('Hoshino');
    expect(root.querySelector('[data-workspace-frame="contacts"]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-frame="character"]')).toBeNull();
    expect(root.querySelectorAll('[data-workspace-frame="contacts"] [data-workspace-frame]')).toHaveLength(0);
    expect(root.querySelector('.char-panel')).not.toBeNull();
    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
  });

  it('Contacts 右侧检查面板刷新不重建 Workspace 根节点，并保留焦点与滚动', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openContactsWorkspace('Hoshino');
    controller.render();

    const frame = root.querySelector('[data-workspace-frame="contacts"]');
    const right = root.querySelector<HTMLElement>('[data-theme-host-id="rightPanel.service.contacts.inspector"]')!;
    const focused = right.querySelector<HTMLButtonElement>('button');
    expect(focused).not.toBeNull();
    focused!.focus();
    const scrollOwner = right.querySelector<HTMLElement>('[data-scroll-owner="content-region"]')!;
    scrollOwner.scrollTop = 79;
    const before = controller.getRefreshStats();

    controller.refreshPanels(['right']);

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(before.regionRefreshes);
    expect(root.querySelector('[data-workspace-frame="contacts"]')).toBe(frame);
    expect(document.activeElement?.tagName).toBe('BUTTON');
    expect(root.querySelector<HTMLElement>('[data-theme-host-id="rightPanel.service.contacts.inspector"] [data-scroll-owner="content-region"]')?.scrollTop).toBe(79);
  });

  it('有 owner 的故事仍留在 StoryWorkspace，Archive 是显式子路由', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openStoryWorkspace({
      selectedEntryId: 'story:demo',
      conversationOwner: 'Hoshino',
      mode: 'overview',
    });
    controller.render();

    expect(root.querySelector('[data-workspace-frame="story"]')).not.toBeNull();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'story', sessionId: 'Hoshino' });
    expect(root.querySelector('[data-workspace-frame="character"]')).toBeNull();
    expect(root.querySelectorAll('[data-workspace-frame="story"] [data-workspace-owner="story"]')).toHaveLength(3);
    const frame = root.querySelector<HTMLElement>('[data-workspace-frame="story"]')!;
    const titlebars = [
      ['left', 'leftPanel.tabs', '故事导航'],
      ['center', 'centerPanel.tabs', '故事内容'],
      ['right', 'rightPanel.tabs', '故事详情'],
    ] as const;
    expect(frame.querySelectorAll('.panel-tabs-region')).toHaveLength(3);
    for (const [slot, hostId, title] of titlebars) {
      const titlebar = frame.querySelector<HTMLElement>(`[data-workspace-column="${slot}"] .panel-tabs-region`);
      expect(titlebar).not.toBeNull();
      expect(titlebar?.classList.contains('ui-cluster')).toBe(true);
      expect(titlebar?.classList.contains(`ui-cluster--${slot}-tabs-region`)).toBe(true);
      expect(titlebar?.classList.contains('presentation-host-target')).toBe(true);
      expect(titlebar?.dataset.themeHostId).toBe(hostId);
      expect(titlebar?.textContent).toContain(title);
      expect(titlebar?.querySelector('.eyebrow')).toBeNull();
    }
    const leftTitlebar = frame.querySelector<HTMLElement>('[data-workspace-column="left"] .panel-tabs-region');
    const centerTitlebar = frame.querySelector<HTMLElement>('[data-workspace-column="center"] .panel-tabs-region');
    const rightTitlebar = frame.querySelector<HTMLElement>('[data-workspace-column="right"] .panel-tabs-region');
    const back = leftTitlebar?.querySelector<HTMLButtonElement>('[data-story-workspace-leave]');
    expect(centerTitlebar?.querySelector('[data-story-workspace-leave]')).toBeNull();
    expect(rightTitlebar?.querySelector('[data-story-workspace-leave]')).toBeNull();
    expect(back?.getAttribute('aria-label')).toBe('返回上一页');
    expect(back?.textContent?.trim()).toBe('');
    expect(back?.querySelector('svg path')?.getAttribute('d')).toBe('M15 18 9 12 15 6');

    root.querySelector<HTMLButtonElement>('[data-story-archive]')!.click();
    expect(controller.panelState.workspace?.type).toBe('story');
    expect(root.querySelector('[data-workspace-frame="story"]')).not.toBeNull();
    expect(root.querySelector('[data-story-archive-back]')).not.toBeNull();
    expect(root.querySelector('.center-panel')).toBeNull();
    expect(root.querySelector('[data-workspace-frame="story"] .eyebrow')).toBeNull();
    expect(root.querySelector('[data-workspace-frame="story"] .workspace-placeholder h2')?.textContent).toBe('故事档案');

    root.querySelector<HTMLButtonElement>('[data-story-workspace-leave]')?.click();
    expect(root.querySelector('[data-workspace-frame="game"]')).not.toBeNull();
  });

  it('无 owner 的故事聊天沿用区域聊天的 panel-body 内边距容器', () => {
    controller.openStoryWorkspace({ selectedEntryId: 'story:demo' });
    controller.render();

    const center = root.querySelector('[data-workspace-frame="story"] .story-workspace__center');
    const body = center?.querySelector(':scope > .presentation-host-content .panel-body');
    expect(body).not.toBeNull();
    expect(body?.querySelector(':scope > .chat-pane')).not.toBeNull();
    expect(body?.querySelector('.send-button .send-bubble')).not.toBeNull();
  });

  it('Story 中心聊天刷新不重建 Workspace 根节点，并保留焦点', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openStoryWorkspace({ selectedEntryId: 'story:demo', conversationOwner: 'Hoshino' });
    controller.render();

    const frame = root.querySelector('[data-workspace-frame="story"]');
    const center = root.querySelector<HTMLElement>('[data-theme-host-id="centerPanel.service.story.main"]')!;
    const focused = center.querySelector<HTMLButtonElement>('button');
    expect(focused).not.toBeNull();
    focused!.focus();
    const before = controller.getRefreshStats();

    controller.refreshPanels(['center']);

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(before.regionRefreshes);
    expect(root.querySelector('[data-workspace-frame="story"]')).toBe(frame);
    expect(document.activeElement?.tagName).toBe('BUTTON');
  });

  it('Story 左侧导航刷新不重建 Workspace 根节点，并保留焦点', () => {
    controller.openStoryWorkspace();
    controller.render();

    const frame = root.querySelector('[data-workspace-frame="story"]');
    const left = root.querySelector<HTMLElement>('[data-theme-host-id="leftPanel.service.story.navigation"]')!;
    const focused = left.querySelector<HTMLButtonElement>('button');
    expect(focused).not.toBeNull();
    focused!.focus();
    const before = controller.getRefreshStats();

    controller.refreshPanels(['left']);

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(before.regionRefreshes);
    expect(root.querySelector('[data-workspace-frame="story"]')).toBe(frame);
    expect(document.activeElement?.tagName).toBe('BUTTON');
  });

  it('Story 对话返回同时刷新左侧与中心 Host，不重建 Workspace 根节点', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openStoryWorkspace({ selectedEntryId: 'story:demo', conversationOwner: 'Hoshino' });
    controller.render();

    const frame = root.querySelector('[data-workspace-frame="story"]');
    const before = controller.getRefreshStats();
    controller.refreshPanels(['left', 'center']);

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(before.regionRefreshes);
    expect(root.querySelector('[data-workspace-frame="story"]')).toBe(frame);
  });

  it('Contacts 中心聊天刷新不重建 Workspace 根节点，并保留焦点', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openContactsWorkspace('Hoshino');
    controller.render();

    const frame = root.querySelector('[data-workspace-frame="contacts"]');
    const center = root.querySelector<HTMLElement>('[data-theme-host-id="centerPanel.service.contacts.main"]')!;
    const focused = center.querySelector<HTMLButtonElement>('button');
    expect(focused).not.toBeNull();
    focused!.focus();
    const before = controller.getRefreshStats();

    controller.refreshPanels(['center']);

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(before.regionRefreshes);
    expect(root.querySelector('[data-workspace-frame="contacts"]')).toBe(frame);
    expect(document.activeElement?.tagName).toBe('BUTTON');
  });

  it('Contacts 多面板刷新一次性替换请求的 Host，不重建 Workspace 根节点', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openContactsWorkspace('Hoshino');
    controller.render();

    const frame = root.querySelector('[data-workspace-frame="contacts"]');
    const before = controller.getRefreshStats();

    controller.refreshPanels(['left', 'center']);

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(before.regionRefreshes);
    expect(root.querySelector('[data-workspace-frame="contacts"]')).toBe(frame);
  });

  it('Story 返回 Contacts 时保留 Contacts 的学生选择', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openContactsWorkspace('Hoshino');
    controller.render();
    controller.openStoryWorkspace({ selectedEntryId: 'story:demo', conversationOwner: 'Hoshino' });
    controller.render();

    expect(controller.panelState.workspace?.type).toBe('story');
    expect(controller.panelState.workspaceNavigation?.returnTo?.route).toEqual({ kind: 'contacts' });
    root.querySelector<HTMLButtonElement>('[data-story-workspace-leave]')!.click();

    const workspace = controller.panelState.workspace;
    expect(workspace?.type).toBe('contacts');
    if (workspace?.type !== 'contacts') throw new Error('返回后未恢复 Contacts Workspace');
    expect(workspace.selectedVariantId).toBe('Hoshino');
    expect(workspace.conversationVariantId).toBe('Hoshino');
    expect(controller.panelState.workspaceNavigation).toEqual({ current: { kind: 'contacts' } });
    expect(root.querySelector('[data-workspace-frame="contacts"]')).not.toBeNull();
  });

  it('Workspace 切换使旧 Surface token 失效，并清理 Story 导航状态', () => {
    controller.render();
    const oldToken = controller.getCurrentSurfaceToken();
    controller.openStoryWorkspace();
    const workspace = controller.panelState.workspace;
    if (workspace?.type !== 'story') throw new Error('Story Workspace 未挂载');
    workspace.navPath = ['main'];
    controller.render();

    expect(controller.isSurfaceCurrent(oldToken)).toBe(false);
    expect(controller.getCurrentSurfaceToken().key).toContain('story');

    controller.resetSessionPanel();
    expect(controller.panelState.storyNavPath).toEqual([]);
    expect(controller.panelState.workspace).toBeUndefined();
    expect(controller.panelState.workspaceNavigation).toEqual({ current: { kind: 'game' } });
  });

  it('新 Workspace Host 使用物理列父级和明确 owner', () => {
    const expected = [
      ['leftPanel.service.contacts.navigation', 'leftPanel'],
      ['centerPanel.service.contacts.main', 'centerPanel'],
      ['rightPanel.service.contacts.inspector', 'rightPanel'],
      ['leftPanel.service.story.navigation', 'leftPanel'],
      ['centerPanel.service.story.main', 'centerPanel'],
      ['rightPanel.service.story.inspector', 'rightPanel'],
    ] as const;
    for (const [id, parent] of expected) {
      expect(UI_HOST_REGISTRY.get(id)).toMatchObject({ parent, workspaceOwner: id.includes('.contacts.') ? 'contacts' : 'story' });
    }
  });
});
