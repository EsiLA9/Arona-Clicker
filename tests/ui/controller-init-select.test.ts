// @vitest-environment happy-dom
// ============================================================
// controller-init-select.test.ts — 选择页交互：购买后局部刷新
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
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
    controller.selectorPage.reset();
    controller.destroy();
    game.stop();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /** 进入重选流程并渲染选择页。 */
  const showSelectPage = () => {
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = true;
    (controller as unknown as { renderInitSelect(): void }).renderInitSelect();
  };

  /** 图上节点是 SVG <g>：用冒泡 click 走与真实指针一致的选择路径。 */
  const clickNode = (selector: string): SVGElement => {
    const node = root.querySelector<SVGElement>(selector)!;
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return node;
  };

  const snapshot = () => ({
    rowOwned: root.querySelector(`[data-init-select="${MILLENNIUM}"]`)?.classList.contains('is-owned') ?? false,
    copyHasPurchase: !!root.querySelector('.selector-detail [data-init-purchase]'),
    copyHasEnter: !!root.querySelector('.selector-detail [data-init]'),
  });

  it('右侧详情可收起与展开，选择其他节点后保留收起偏好与原画布', () => {
    game.inits.unlockInit(MILLENNIUM);
    showSelectPage();
    const graph = root.querySelector('[data-selector-graph]');
    const workbench = root.querySelector<HTMLElement>('[data-selector-workbench]')!;
    const body = root.querySelector('[data-selector-workbench-body]');
    const toggle = root.querySelector<HTMLButtonElement>('[data-selector-workbench-toggle]')!;
    toggle.click();
    expect(workbench.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('展开详情');
    expect(root.querySelector('[data-selector-workbench-body]')).toBe(body);
    expect(document.activeElement).toBe(toggle);
    clickNode(`[data-init-select="${MILLENNIUM}"]`);
    expect(workbench.hidden).toBe(true);
    toggle.click();
    expect(workbench.hidden).toBe(false);
    expect(root.querySelector('[data-selector-graph]')).toBe(graph);
    expect(root.querySelector('.selector-workbench-title')?.textContent).toBe('千禧年学院');
  });

  it('中转页只预览所选 Init，隐藏图与详情；返回保留相机、节点、滚动、焦点和业务状态', () => {
    showSelectPage();
    const viewport = root.querySelector('[data-selector-graph-viewport]');
    const topbar = root.querySelector('.selector-topbar');
    const graph = root.querySelector<HTMLElement>('[data-selector-graph]')!;
    const world = root.querySelector('[data-selector-graph-world]')!;
    const workbench = root.querySelector<HTMLElement>('[data-selector-workbench]')!;
    const body = root.querySelector<HTMLElement>('[data-selector-workbench-body]')!;
    const toggle = root.querySelector<HTMLElement>('[data-selector-workbench-toggle]')!;
    const slider = root.querySelector<HTMLInputElement>('[data-selector-zoom-slider]')!;
    slider.value = '145'; slider.dispatchEvent(new Event('input', { bubbles: true }));
    const camera = world.getAttribute('transform');
    const cta = body.querySelector<HTMLButtonElement>('[data-init]')!;
    body.scrollTop = 140;
    const before = JSON.stringify(game.state);
    const started = controller.started;
    cta.click();
    const overview = root.querySelector<HTMLElement>('[data-selector-init-overview]')!;
    expect(overview.hidden).toBe(false);
    expect(overview.textContent).toContain('夏莱办公室');
    expect(graph.hidden && workbench.hidden && toggle.hidden).toBe(true);
    expect(root.querySelector('[data-selector-init-overview-title]')).toBe(document.activeElement);
    expect(controller.started).toBe(started);
    expect((controller as unknown as { pendingRestart: boolean }).pendingRestart).toBe(true);
    expect(JSON.stringify(game.state)).toBe(before);
    slider.value = '220'; slider.dispatchEvent(new Event('input', { bubbles: true }));
    clickNode(`[data-init-select="${MILLENNIUM}"]`);
    expect(controller.selectorPage.selectedInitId).toBe(OFFICE);
    expect(world.getAttribute('transform')).toBe(camera);
    root.querySelector<HTMLButtonElement>('[data-selector-init-overview-back]')!.click();
    expect(overview.hidden).toBe(true);
    expect(graph.hidden || workbench.hidden || toggle.hidden).toBe(false);
    expect(root.querySelector('[data-selector-graph-viewport]')).toBe(viewport);
    expect(root.querySelector('.selector-topbar')).toBe(topbar);
    expect(world.getAttribute('transform')).toBe(camera);
    expect(body.scrollTop).toBe(140);
    expect(document.activeElement).toBe(cta);
    expect(JSON.stringify(game.state)).toBe(before);
  });

  it('中转页 Escape 可返回，重复进入与减少动态效果仍保持正确状态', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    showSelectPage();
    const cta = root.querySelector<HTMLButtonElement>('[data-init]')!;
    cta.click();
    const title = root.querySelector<HTMLElement>('[data-selector-init-overview-title]')!;
    cta.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(root.querySelectorAll('[data-init-confirm]')).toHaveLength(1);
    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root.querySelector<HTMLElement>('[data-selector-init-overview]')!.hidden).toBe(true);
    expect(document.activeElement).toBe(cta);
    cta.click();
    expect(root.querySelector<HTMLElement>('[data-selector-init-overview]')!.hidden).toBe(false);
  });

  it('活动世界线的中转页只使用 Init 背景，返回后恢复星图的 Area 投影策略', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    controller.startNewGame(OFFICE);
    controller.render();
    controller.openGlobalEnhancementSelect();
    controller.selectorPage.select({ kind: 'init', entityId: OFFICE }, { animate: false });
    const before = JSON.stringify(game.state);
    expect(root.querySelector<HTMLElement>('.selector-workspace')!.dataset.selectorThemeKey).toContain(`|${game.state.currentAreaId}`);
    root.querySelector<HTMLButtonElement>('[data-init]')!.click();
    const workspace = root.querySelector<HTMLElement>('.selector-workspace')!;
    const background = root.querySelector<HTMLElement>('[data-selector-scene-slot="current"]')!;
    expect(workspace.dataset.selectorThemeKey?.endsWith('|')).toBe(true);
    expect(background.innerHTML).not.toContain('/assets/Hoshino.png');
    expect(background.innerHTML).not.toContain('triangles');
    root.querySelector<HTMLButtonElement>('[data-selector-init-overview-back]')!.click();
    expect(workspace.dataset.selectorThemeKey).toContain(`|${game.state.currentAreaId}`);
    expect(JSON.stringify(game.state)).toBe(before);
  });

  it('中转页禁止预览未解锁节点，失效的确认按钮不能进入世界线', () => {
    showSelectPage();
    controller.selectorPage.select({ kind: 'init', entityId: MILLENNIUM }, { animate: false });
    controller.selectorPage.openInitOverview(MILLENNIUM);
    expect(root.querySelector<HTMLElement>('[data-selector-init-overview]')!.hidden).toBe(true);
    controller.selectorPage.select({ kind: 'init', entityId: OFFICE }, { animate: false });
    root.querySelector<HTMLButtonElement>('[data-init]')!.click();
    const confirm = root.querySelector<HTMLButtonElement>('[data-init-confirm]')!;
    root.querySelector<HTMLButtonElement>('[data-selector-init-overview-back]')!.click();
    const resume = vi.spyOn(controller, 'resumeInit');
    confirm.click();
    expect(resume).not.toHaveBeenCalled();
  });

  it('新建世界线也先显示中转页，只有确认进入才发起新建命令，重复确认只执行一次', async () => {
    (controller as unknown as { pendingRestart: boolean }).pendingRestart = false;
    (controller as unknown as { renderInitSelect(): void }).renderInitSelect();
    const start = vi.spyOn(controller, 'startNewGame');
    root.querySelector<HTMLButtonElement>('[data-init]')!.click();
    expect(start).not.toHaveBeenCalled();
    const confirm = root.querySelector<HTMLButtonElement>('[data-init-confirm]')!;
    confirm.click();
    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(start).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(controller.started).toBe(true);
    expect(root.querySelector('.selector-shell')).toBeNull();
  });

  it('购买选中项后节点与工作台立即刷新，不触发整页重渲染', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    showSelectPage();

    // 选中千禧年节点
    const row = clickNode(`[data-init-select="${MILLENNIUM}"]`);
    expect(snapshot().copyHasPurchase).toBe(true);

    // 点击购买 CTA → 节点状态与工作台 CTA 应立即更新
    root.querySelector<HTMLButtonElement>('[data-init-purchase]')!.click();
    const after = snapshot();
    expect(after.rowOwned).toBe(true);
    expect(after.copyHasPurchase).toBe(false);
    expect(after.copyHasEnter).toBe(true);

    // 画布未被整页重建：节点元素引用保持不变（无丢绑定 / 位置跳变）
    expect(root.contains(row)).toBe(true);
  });

  it('节点选中时更新局部主题与下一背景槽，不触碰运行状态', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    game.inits.unlockInit(MILLENNIUM);
    showSelectPage();

    const workspace = root.querySelector<HTMLElement>('.selector-workspace')!;
    expect(root.querySelector('.selector-super-background > .selector-scene-background-stack')).not.toBeNull();
    expect(root.querySelector('.selector-workspace > .selector-scene-background-stack')).toBeNull();
    const currentBefore = root.querySelector<HTMLElement>('[data-selector-scene-slot="current"]')!;
    const beforeState = { ...game.state };
    const beforeKey = currentBefore.dataset.selectorTransitionKey;

    clickNode(`[data-init-select="${MILLENNIUM}"]`);

    expect(controller.selectorPage.selectedInitId).toBe(MILLENNIUM);
    expect(workspace.dataset.selectorThemeKey).toContain(`init:${MILLENNIUM}`);
    expect(root.querySelector<HTMLElement>('[data-selector-scene-slot="next"]')?.dataset.selectorTransitionKey)
      .toContain(`init:${MILLENNIUM}`);
    expect(currentBefore.dataset.selectorTransitionKey).toBe(beforeKey);
    expect(game.state.activeInit).toBe(beforeState.activeInit);
    expect(game.state.totalFrames).toBe(beforeState.totalFrames);
  });

  it('Init 主题只显示在外部选择页，不进入游戏内运行时主题', () => {
    const runtime = game.colorSystem.runtimeTheme();
    const activeLayers = game.colorSystem.runtimeThemeDiagnostics().layers;

    expect(activeLayers.some(layer => layer.scope === 'init')).toBe(false);
    expect(runtime.background.some(layer => layer.id === 'init-atmosphere')).toBe(false);
    expect(document.querySelector('#ui-background-layer')?.innerHTML).not.toContain('init-atmosphere');

    showSelectPage();

    const current = root.querySelector<HTMLElement>('[data-selector-scene-slot="current"]');
    expect(current?.innerHTML).toContain('linear-gradient(135deg, #93c5fd 0%, #eff6ff 100%)');
  });

  it('普通游戏页的对话学生不再叠加到当前场景主题', () => {
    controller.panelState.conversationVariantId = 'Hoshino';
    controller.render();

    const runtime = game.colorSystem.runtimeTheme();
    const layers = game.colorSystem.runtimeThemeDiagnostics().layers;
    expect(layers.length).toBeLessThanOrEqual(1);
    expect(layers.some(layer => layer.scope === 'student' || layer.scope === 'init')).toBe(false);
    if (game.state.currentAreaId) {
      expect(runtime.layers).toContain(`area:${game.state.currentAreaId}`);
    }
  });

  it('离开活动场景到选择页时只投影全局主题与焦点主题，不继承旧 Area/剧情层', () => {
    game.colorSystem.pushSceneTheme({
      id: 'selector-stale-area',
      scope: 'area',
      background: [{ id: 'selector-stale-area-layer', kind: 'solid', value: '#deadbe' }],
    });
    game.colorSystem.pushEphemeralTheme({
      id: 'selector-stale-story',
      scope: 'ephemeral',
      background: [{ id: 'selector-stale-story-layer', kind: 'solid', value: '#badc0d' }],
    });
    game.mutations.setUserTheme({
      version: 1,
      palette: ['#123456'],
      tokens: { primary: '#112233', bg: '#223344', bgAlt: '#334455' },
      presentation: { hosts: [{
        id: 'global',
        layers: [{ id: 'selector-global-user-layer', kind: 'solid', value: '#11aa33' }],
        layerOrder: ['system-color-background', 'selector-global-user-layer'],
      }] },
    }, true);
    game.colorSystem.syncSelectedThemeFromState(game.state, true);

    showSelectPage();

    const current = root.querySelector<HTMLElement>('[data-selector-scene-slot="current"]')!;
    const shell = root.querySelector<HTMLElement>('.selector-shell')!;
    const outer = document.querySelector<HTMLElement>('#ui-background-layer')!;
    expect(current.innerHTML).toContain('#11aa33');
    expect(current.innerHTML).not.toContain('#deadbe');
    expect(current.innerHTML).not.toContain('#badc0d');
    expect(outer.innerHTML).not.toContain('#deadbe');
    expect(outer.innerHTML).not.toContain('#badc0d');
    expect(outer.style.getPropertyValue('--ac-primary')).toBe('#112233');
    expect(shell.style.getPropertyValue('--theme-node-primary')).toBeTruthy();
  });

  it('从 Init 的结束游戏入口撤离时，选择页显示 Init 主题而不叠加当前 Area 主题', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    game.inits.unlockInit(MILLENNIUM);
    controller.startNewGame(MILLENNIUM);
    controller.selectorPage.restoreInitSelection(MILLENNIUM);
    controller.render();

    expect(game.colorSystem.runtimeThemeTokens().primary).toBe('#6366f1');
    root.querySelector<HTMLButtonElement>('[data-restart-init]')!.click();

    const shell = root.querySelector<HTMLElement>('.selector-shell')!;
    const workspace = root.querySelector<HTMLElement>('.selector-workspace')!;
    const current = root.querySelector<HTMLElement>('[data-selector-scene-slot="current"]')!;
    expect(controller.started).toBe(false);
    expect((controller as unknown as { pendingRestart: boolean }).pendingRestart).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-selector-init-overview]')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-selector-graph]')!.hidden).toBe(true);
    expect(shell.style.getPropertyValue('--theme-node-primary')).toBe('#4f46e5');
    expect(workspace.dataset.selectorThemeKey?.endsWith('|')).toBe(true);
    expect(current.innerHTML).toContain('#4f46e5');
  });

  it('Schale 撤离后聚焦另一 Init 时，current/next 背景槽都不带旧 Area 资产', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    game.inits.unlockInit(MILLENNIUM);
    controller.startNewGame(OFFICE);
    controller.selectorPage.restoreInitSelection(OFFICE);
    controller.render();
    root.querySelector<HTMLButtonElement>('[data-restart-init]')!.click();

    const current = root.querySelector<HTMLElement>('[data-selector-scene-slot="current"]')!;
    expect(current.innerHTML).not.toContain('/assets/Hoshino.png');
    expect(current.innerHTML).not.toContain('triangles');

    root.querySelector<HTMLButtonElement>('[data-selector-init-overview-back]')!.click();
    clickNode(`[data-init-select="${MILLENNIUM}"]`);
    const next = root.querySelector<HTMLElement>('[data-selector-scene-slot="next"]')!;
    expect(next.innerHTML).not.toContain('/assets/Hoshino.png');
    expect(next.innerHTML).not.toContain('triangles');
  });

  it('从 Restart 选择页恢复另一 Init 后，再构建目标 Init 与 Area 运行时主题', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    controller.startNewGame(OFFICE);
    game.inits.unlockInit(MILLENNIUM);
    controller.render();
    root.querySelector<HTMLButtonElement>('[data-restart-init]')!.click();
    root.querySelector<HTMLButtonElement>('[data-selector-init-overview-back]')!.click();
    clickNode(`[data-init-select="${MILLENNIUM}"]`);
    root.querySelector<HTMLButtonElement>(`[data-init="${MILLENNIUM}"]`)!.click();

    expect(controller.started).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-selector-init-overview]')!.hidden).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-init-confirm]')!.click();

    expect(game.state.activeInit).toBe(MILLENNIUM);
    expect(controller.started).toBe(true);
    expect(root.querySelector('.selector-shell')).toBeNull();
    expect(game.colorSystem.runtimeThemeTokens().primary).toBe('#6366f1');
    const outer = document.querySelector<HTMLElement>('#ui-background-layer')!;
    expect(outer.innerHTML).not.toContain('/assets/Hoshino.png');
    expect(outer.innerHTML).not.toContain('triangles');
  });

  it('选择页上部按钮随聚焦主题刷新背景，主题浮窗开合保持同一表现链', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100);
    game.inits.unlockInit(MILLENNIUM);
    showSelectPage();

    const topbar = root.querySelector<HTMLElement>('.selector-topbar')!;
    const themeButton = topbar.querySelector<HTMLButtonElement>('#theme-palette-btn')!;
    const initialBackground = themeButton.querySelector<HTMLElement>(':scope > .presentation-host-background');
    expect(themeButton.classList.contains('presentation-host-target')).toBe(true);
    expect(themeButton.dataset.themeHostId).toBe('header.button');
    expect(initialBackground?.innerHTML).toContain('#3b82f6');

    clickNode(`[data-init-select="${MILLENNIUM}"]`);
    expect(themeButton.querySelector<HTMLElement>(':scope > .presentation-host-background')?.innerHTML).toContain('#4f46e5');

    themeButton.click();
    expect(themeButton.dataset.themeState).toBe('active');
    expect(themeButton.querySelector<HTMLElement>(':scope > .presentation-host-background')?.innerHTML).toContain('#22d3ee');
    themeButton.click();
    expect(themeButton.dataset.themeState).toBe('inactive');
    expect(themeButton.dataset.themeHostId).toBe('header.button');
  });

  it('无存档进入 Init / GlobalEnhancement 选择页时立即创建可读取的存档', () => {
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

  it('有存档但尚未进入 Init 时仍停留选择页，不启动游戏会话', () => {
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
    expect(lobbyRoot.querySelector('.service-workspace h2')?.textContent).toBe('经典数据包');

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
