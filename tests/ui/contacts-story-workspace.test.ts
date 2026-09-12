// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';
import { UI_HOST_REGISTRY } from '../../src/ui/ui-host-registry';
import '../../src/ui/service-definitions';

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
  });

  it('选择学生只改变 Contacts 内部状态，不嵌套 CharacterWorkspace', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openContactsWorkspace();
    controller.render();
    root.querySelector<HTMLButtonElement>('[data-select-variant="Hoshino"]')!.click();

    const workspace = controller.panelState.workspace;
    expect(workspace?.type).toBe('contacts');
    if (workspace?.type !== 'contacts') throw new Error('Contacts Workspace 未挂载');
    expect(workspace.selectedVariantId).toBe('Hoshino');
    expect(root.querySelector('[data-workspace-frame="contacts"]')).not.toBeNull();
    expect(root.querySelector('[data-workspace-frame="character"]')).toBeNull();
    expect(root.querySelectorAll('[data-workspace-frame="contacts"] [data-workspace-frame]')).toHaveLength(0);
    expect(root.querySelector('.char-panel')).not.toBeNull();
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
    expect(root.querySelector('[data-workspace-frame="character"]')).toBeNull();
    expect(root.querySelectorAll('[data-workspace-frame="story"] [data-workspace-owner="story"]')).toHaveLength(3);

    root.querySelector<HTMLButtonElement>('[data-story-archive]')!.click();
    expect(controller.panelState.workspace?.type).toBe('story');
    expect(root.querySelector('[data-workspace-frame="story"]')).not.toBeNull();
    expect(root.querySelector('[data-story-archive-back]')).not.toBeNull();
    expect(root.querySelector('.center-panel')).toBeNull();
  });

  it('Story 返回 Contacts 时保留 Contacts 的学生选择', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openContactsWorkspace('Hoshino');
    controller.render();
    controller.openStoryWorkspace({ selectedEntryId: 'story:demo', conversationOwner: 'Hoshino' });
    controller.render();

    expect(controller.panelState.workspace?.type).toBe('story');
    controller.disposeWorkspace();

    const workspace = controller.panelState.workspace;
    expect(workspace?.type).toBe('contacts');
    if (workspace?.type !== 'contacts') throw new Error('返回后未恢复 Contacts Workspace');
    expect(workspace.selectedVariantId).toBe('Hoshino');
    expect(workspace.conversationVariantId).toBe('Hoshino');
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
