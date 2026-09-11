// @vitest-environment happy-dom
// ============================================================
// controller-init-select.test.ts — 选择页交互：购买后局部刷新
// ============================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';
import { SaveSystem } from '../../src/data-services/persistence/storage';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';

describe('UIController Init 选择页', () => {
  let game: GameInstance;
  let root: HTMLElement;
  let controller: UIController;

  beforeEach(() => {
    localStorage.clear();
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    controller = new UIController(game, root);
    controller.mount();
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
    localStorage.clear();
  });

  /** 进入重选流程并渲染选择页。 */
  const showSelectPage = () => {
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = true;
    (controller as unknown as { renderInitSelect(): void }).renderInitSelect();
  };

  const snapshot = () => ({
    rowOwned: root.querySelector(`[data-init-select="${MILLENNIUM}"]`)?.textContent?.includes('已解锁') ?? false,
    copyHasPurchase: !!root.querySelector('.init-orb-copy [data-init-purchase]'),
    copyHasEnter: !!root.querySelector('.init-orb-copy [data-init]'),
  });

  it('购买选中项后行与详情立即刷新，不触发整页重渲染', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    showSelectPage();

    // 选中千禧年
    const row = root.querySelector<HTMLButtonElement>(`[data-init-select="${MILLENNIUM}"]`)!;
    row.click();
    expect(snapshot().copyHasPurchase).toBe(true);

    // 点击购买 CTA → 行文本与详情 CTA 应立即更新
    root.querySelector<HTMLButtonElement>('[data-init-purchase]')!.click();
    const after = snapshot();
    expect(after.rowOwned).toBe(true);
    expect(after.copyHasPurchase).toBe(false);
    expect(after.copyHasEnter).toBe(true);

    // 轮盘 DOM 未被整页重建：卡片节点引用保持不变（无飞入/丢绑定）
    expect(root.contains(row)).toBe(true);
  });

  it('轮盘聚焦切换时更新局部主题与下一背景槽，不触碰运行状态', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    game.inits.unlockInit(MILLENNIUM);
    showSelectPage();

    const viewport = root.querySelector<HTMLElement>('.selector-viewport')!;
    expect(root.querySelector('.selector-super-background > .selector-scene-background-stack')).not.toBeNull();
    expect(root.querySelector('.selector-viewport > .selector-scene-background-stack')).toBeNull();
    const currentBefore = root.querySelector<HTMLElement>('[data-selector-scene-slot="current"]')!;
    const beforeState = { ...game.state };
    const beforeKey = currentBefore.dataset.selectorTransitionKey;

    root.querySelector<HTMLButtonElement>(`[data-init-select="${MILLENNIUM}"]`)!.click();

    expect(controller.selectorPage.selectedInitId).toBe(MILLENNIUM);
    expect(viewport.dataset.selectorThemeKey).toContain(`init:${MILLENNIUM}`);
    expect(root.querySelector<HTMLElement>('[data-selector-scene-slot="next"]')?.dataset.selectorTransitionKey)
      .toContain(`init:${MILLENNIUM}`);
    expect(currentBefore.dataset.selectorTransitionKey).toBe(beforeKey);
    expect(game.state.activeInit).toBe(beforeState.activeInit);
    expect(game.state.totalFrames).toBe(beforeState.totalFrames);
  });

  it('选择页上部按钮随聚焦主题刷新背景，主题浮窗开合保持同一表现链', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    game.inits.unlockInit(MILLENNIUM);
    showSelectPage();

    const topbar = root.querySelector<HTMLElement>('.selector-topbar')!;
    const flip = topbar.querySelector<HTMLButtonElement>('[data-flip-selection-face]')!;
    const themeButton = topbar.querySelector<HTMLButtonElement>('#theme-palette-btn')!;
    const initialBackground = flip.querySelector<HTMLElement>(':scope > .presentation-host-background');
    expect(flip.classList.contains('presentation-host-target')).toBe(true);
    expect(flip.dataset.themeHostId).toBe('header.button');
    expect(initialBackground?.innerHTML).toContain('#3b82f6');

    root.querySelector<HTMLButtonElement>(`[data-init-select="${MILLENNIUM}"]`)!.click();
    expect(flip.querySelector<HTMLElement>(':scope > .presentation-host-background')?.innerHTML).toContain('#4f46e5');

    themeButton.click();
    expect(themeButton.dataset.themeState).toBe('active');
    expect(themeButton.querySelector<HTMLElement>(':scope > .presentation-host-background')?.innerHTML).toContain('#22d3ee');
    themeButton.click();
    expect(themeButton.dataset.themeState).toBe('inactive');
    expect(themeButton.dataset.themeHostId).toBe('header.button');
  });

  it('无存档进入 Init / GlobalEnhancement 轮盘时立即创建可读取的存档', () => {
    localStorage.clear();

    const freshGame = new GameInstance();
    freshGame.init([baseDatapack]);
    const freshRoot = document.createElement('div');
    document.body.appendChild(freshRoot);
    const freshController = new UIController(freshGame, freshRoot);

    freshController.mount();

    expect(SaveSystem.exists()).toBe(true);
    expect(SaveSystem.load()).not.toBeNull();

    SaveSystem.delete();
    freshController.openGlobalEnhancementSelect();
    expect(SaveSystem.exists()).toBe(true);
    expect(SaveSystem.load()).not.toBeNull();

    freshController.destroy();
    freshGame.stop();
  });

  it('有存档但尚未进入 Init 时仍停留轮盘，不启动游戏会话', () => {
    localStorage.clear();

    const pendingGame = new GameInstance();
    pendingGame.init([baseDatapack]);
    pendingGame.reset();
    SaveSystem.save(pendingGame.save());
    const pendingRoot = document.createElement('div');
    document.body.appendChild(pendingRoot);
    const pendingController = new UIController(pendingGame, pendingRoot);

    pendingController.mount();

    expect(pendingGame.state.activeInit).toBe('');
    expect(pendingController.started).toBe(false);
    expect(pendingRoot.querySelector('.selector-shell')).not.toBeNull();

    // Lobby 存档重新读取后仍不得启动 Tick 或跳过 Init 选择。
    pendingRoot.querySelector<HTMLButtonElement>('#load-game-init')!.click();
    expect(pendingGame.state.activeInit).toBe('');
    expect(pendingGame.running).toBe(false);
    expect(pendingController.started).toBe(false);
    expect(pendingRoot.querySelector('.selector-shell')).not.toBeNull();
    expect(document.body.querySelector(':scope > #ui-background-layer')).not.toBeNull();
    expect(pendingRoot.querySelector(':scope > .console-background')).toBeNull();

    pendingController.destroy();
    pendingGame.stop();
  });

  it('Lobby 可以进入数据包服务，返回游戏服务时仍回到 Init 选择页', () => {
    localStorage.clear();

    const lobbyGame = new GameInstance();
    lobbyGame.init([baseDatapack]);
    lobbyGame.reset();
    const lobbyRoot = document.createElement('div');
    document.body.appendChild(lobbyRoot);
    const lobbyController = new UIController(lobbyGame, lobbyRoot);
    lobbyController.mount();

    expect(lobbyRoot.querySelector('#theme-palette-btn')).not.toBeNull();
    expect(lobbyRoot.querySelector('#help-modal')).toBeNull();
    lobbyRoot.querySelector<HTMLButtonElement>('#theme-palette-btn')!.click();
    expect(lobbyRoot.querySelector('[data-theme-float]')?.classList.contains('open')).toBe(true);
    lobbyRoot.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();
    expect(lobbyRoot.querySelector('[data-workspace-frame="settings"]')).not.toBeNull();
    lobbyRoot.querySelector<HTMLButtonElement>('#help-modal')!.click();
    expect(document.querySelector('.app-modal')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('.app-modal .modal-close')?.click();
    lobbyRoot.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();
    expect(lobbyController.started).toBe(false);
    expect(lobbyGame.running).toBe(false);
    expect(lobbyRoot.querySelector('.service-workspace')).not.toBeNull();
    expect(lobbyRoot.querySelector('.service-workspace h2')?.textContent).toBe('全部数据包');

    lobbyRoot.querySelector<HTMLButtonElement>('[data-service="game"]')!.click();
    expect(lobbyRoot.querySelector('.selector-shell')).not.toBeNull();
    expect(lobbyController.started).toBe(false);

    lobbyController.destroy();
    lobbyGame.stop();
  });

  it('resetSessionPanel 彻底重置会话 UI：退出对话空间、清空学生聊天流与选中差分', () => {
    const panel = (controller as unknown as { panelState: any }).panelState;
    // 模拟上一会话残留：打开过星野对话空间并留了聊天记录
    panel.conversationVariantId = 'Hoshino';
    panel.selectedVariantId = 'Hoshino';
    panel.studentChats['Hoshino'] = [{ id: 1, kind: 'talk', text: '旧消息', timestamp: 0 }];
    panel.chatEntries = [{ id: 9, kind: 'talk', text: '一般聊天旧消息', timestamp: 0 }];

    (controller as unknown as { resetSessionPanel(): void }).resetSessionPanel();

    expect(panel.conversationVariantId).toBeNull();
    expect(panel.selectedVariantId).toBeNull();
    expect(panel.studentChats).toEqual({});
    expect(panel.chatEntries).toEqual([]);
    expect(panel.leftTab).toBe('area');
    expect(panel.centerTab).toBe('chat');
    expect(panel.rightTab).toBe('spot');
  });

  it('引擎层 startNewGame 产生干净的 per-Init 状态（资源/flag/剧情记录清空）', () => {
    game.mutations.changeResource('base:resource:credit', 12345);
    game.mutations.setFlag('some_flag', '1');
    // 再次开启新游戏（同一 Init）
    expect(game.inits.startNewGame(OFFICE)).toBe(true);
    const view = game.getView();
    expect(view.resources['base:resource:credit'] ?? 0).toBe(0); // 新会话资源归零
    expect(game.state.flags['some_flag']).toBeUndefined(); // 旧会话 flag 已清空
    expect(game.state.storyLog).toEqual([]); // 剧情完成记录清空（startNewGame 重置会话记录）
  });
});
