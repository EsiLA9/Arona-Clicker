// ============================================================
// ui/controller.ts — UI 控制器（集成层门面）
// 疏散后作为门面：核心渲染/刷新/事件编排保留于此，
// 聊天流/滚动/选择页/IO 委托专门模块（chat-stream / scroll /
//   selector-page / import-export），事件订阅 / 主题注入 / 存读档 /
//   各域事件绑定拆至 controller-events / controller-theme /
//   controller-save / controller-actions-*。
// ============================================================

import { GameInstance } from '../arona-clicker/runtime-game-instance';
import type { SaveData } from '../arona-clicker/contracts/save-data';
import { SaveSystem } from '../data-services/persistence/storage';
import { createUIContext } from './context';
import { createGameCommands } from '../arona-clicker/runtime-commands';
import { renderAppShell, PanelState } from './components/app-shell';
import type { InitSelectMode } from './components/init-select';
import type { ChatEntry } from './components/story';
import { ToastService } from './components/toast';
import { ModalManager } from './modal';
import { PopoverManager } from './popovers';
import { ChatStream } from './chat-stream';
import { ScrollManager } from './scroll';
import { SelectorPage } from './selector-page';
import type { SelectionFace } from './components/global-enhancement-select';
import { ImportExportService } from './import-export';
import {
  computeRevealFingerprint,
  refreshRevealIfChanged as refreshRevealIfChangedImpl,
  refreshLight as refreshLightImpl,
  destroy as destroyImpl,
  resetSessionPanel as resetSessionPanelImpl,
  trimHistory as trimHistoryImpl,
  withHistories as withHistoriesImpl,
  restoreHistories as restoreHistoriesImpl,
  MAX_CHAT_HISTORY,
} from './controller-core';
import {
  openGachaModal as openGachaModalImpl,
  openSpotGachaModal as openSpotGachaModalImpl,
  bindGachaButtons as bindGachaButtonsImpl,
  openEnhancementManager as openEnhancementManagerImpl,
  openUserThemeEditor as openUserThemeEditorImpl,
} from './controller-modals';
import {
  initSelectMode as initSelectModeImpl,
  renderSelectorPage as renderSelectorPageImpl,
  renderInitSelect as renderInitSelectImpl,
  renderGlobalEnhancementSelect as renderGlobalEnhancementSelectImpl,
  replaceCurrentDetail as replaceCurrentDetailImpl,
  bindDetailActions as bindDetailActionsImpl,
  bindGlobalEnhancementDetailActions as bindGlobalEnhancementDetailActionsImpl,
  bindSelectorCommonActions as bindSelectorCommonActionsImpl,
  showBackToGame as showBackToGameImpl,
} from './controller-panels';
import { bindEvents } from './controller-events';
import { applyTheme as applyThemeImpl, backgroundView as backgroundViewImpl, presentationView as presentationViewImpl, restoreThemeFloat as restoreThemeFloatImpl, syncRuntimeTheme as syncRuntimeThemeImpl } from './controller-theme';
import { bindSaveActions } from './controller-save';
import { bindTopBarActions } from './controller-actions-topbar';
import { bindContactsActions } from './controller-actions-contacts';
import { bindThemeActions } from './controller-actions-theme';
import { bindStoryActions, logStoryFailure } from './controller-actions-story';
import { bindInventoryActions } from './controller-actions-inventory';
import type { GameCommands } from '../arona-clicker/contracts';
import type { PackCatalogReadModel } from '../arona-clicker/contracts';
import { renderLeftPanel } from './components/rail';
import { renderCenterPanel, renderChatTab, renderLogTab } from './components/center-panel';
import { renderRightPanel } from './components/right-panels';

export interface UIRefreshStats {
  fullRenders: number;
  panelRefreshes: number;
  lightRefreshes: number;
  themeApplications: number;
}

export class UIController {
  /** UI 写操作的能力边界；迁移期由 AronaClickerRuntime 直接实现。 */
  readonly commands: GameCommands;
  /** 每个聊天沙盒（含一般聊天）持久化的历史条数上限。 */
  static readonly MAX_CHAT_HISTORY = MAX_CHAT_HISTORY;
  /** @internal 供 controller-core 读取。 */
  refreshTimer: ReturnType<typeof setInterval> | null = null;
  /** @internal 供 controller-core 读取。 */
  started = false;
  /** 奖励通知延迟入流时长（毫秒）：Story 末尾留一拍，避免奖励信息贴着最后一页弹出。 */
  static readonly REWARD_REVEAL_DELAY_MS = 800;
  /** @internal 供 controller-core / controller-panels 读写。 */
  panelState: PanelState = {
    service: 'game',
    leftTab: 'area',
    centerTab: 'chat',
    rightTab: 'spot',
    chatEntries: [],
    chatTexts: [],
    selectedVariantId: null,
    conversationVariantId: null,
    studentChats: {},
    studentChatTexts: {},
    storyNavPath: [],
    storyGate: null,
    openingBanner: null,
  };
  /** 弹窗母版实例（body 级，独立于 #app 重建）。 */
  readonly modal = new ModalManager();
  /** 全局 Toast 通知（body 级，独立于 #app 重建）。 */
  readonly toast = new ToastService();
  /** @internal 上次的揭示状态指纹：揭示条件变化时才重建 UI。 */
  revealFingerprint = '';
  /** @internal 揭示评估节流（避免 tick 高频事件反复重算）。 */
  lastRevealCheck = 0;
  /** @internal 标记当前是否来自软重启（endInit → 重选 Init）：决定点击 Init 卡片时用 resumeInit 还是 startNewGame。 */
  pendingRestart = false;
  /** 悬浮详情弹层（body 级，事件委托一次绑定）。 */
  readonly popovers: PopoverManager;
  /** @internal 待落账的奖励通知（storyRewarded 排队，延迟入流见 scheduleRewardChats）。 */
  pendingRewardChats: string[] = [];
  /** @internal 待落账的进入 Area 通知（render 时先于剧情内容入流）。 */
  pendingTravelChats: string[] = [];
  /** @internal 奖励通知延迟入流计时器（Story 末尾留一拍）。 */
  rewardTimer: ReturnType<typeof setTimeout> | null = null;
  /** @internal 合并同一事件循环内由 EventBus 与点击处理器产生的重复重建。 */
  private renderScheduled = false;
  private refreshStats: UIRefreshStats = { fullRenders: 0, panelRefreshes: 0, lightRefreshes: 0, themeApplications: 0 };
  /** @internal 主题浮窗：跨 render 全量重建 #app 保留其开关键与位置（供 controller-theme / controller-actions-topbar 读写）。 */
  themeFloatOpen = false;
  /** @internal 主题浮窗位置（同上）。 */
  themeFloatPos: { x: number; y: number } | null = null;

  // --- 疏散出去的领域模块 ---
  /** 聊天流（ID 计数 / 剧情指纹 / 路由 / 同步）。 */
  readonly chat = new ChatStream();
  /** 聊天流 / 面板滚动状态。 */
  readonly scroll = new ScrollManager();
  /** 选择页轮盘交互（Init ⇄ GlobalEnhancement 左右滑动、共享一圆）。 */
  readonly selectorPage: SelectorPage;
  /** 数据包导入 / 日志导出。 */
  readonly io: ImportExportService;

  constructor(
    /** @internal 供 controller-core / controller-modals / controller-panels 使用。 */
    readonly game: GameInstance,
    /** @internal 供 controller-core / controller-modals / controller-panels 使用。 */
    readonly root: HTMLElement,
  ) {
    this.commands = createGameCommands(game);
    // 未读计数（对话空间语义）：通讯录角色行气泡 = 该学生就绪队列条数（尾巴 + 台阶）
    this.panelState.getUnread = (variantId: string) =>
      this.game.rosterSystem.isOwned(this.game.state, variantId)
        ? this.game.story.readyStepCount(variantId)
        : 0;
    // 页级打字提示到期只更新聊天面板；其它面板无需随门控计时器重建
    this.chat.onChange = () => this.refreshChatPanel();
    // 链式连发（§4）：无按钮要求的左侧页送达后自动推进一页（引擎 clickSend 每次恰好
    // 推进一页；选项/按动/回复页不满足连发谓词，不会进入自动推进）
    this.chat.onAutoAdvance = (streamKey) => {
      const owner = streamKey === '#global' ? undefined : streamKey;
      const view = owner ? this.game.getStoryView(owner) : this.game.getView().currentStory;
      if (!view) return; // 剧情已结束：链终止
      const result = this.commands.clickSend(owner);
      logStoryFailure(this, result);
      if (result.type === 'completed') {
        this.chat.pushAbsorbedTo(streamKey, this.panelState, result.absorbed ?? []);
      }
      this.scheduleRender();
    };
    // 绑定到 document.body：弹窗（app-modal）挂在 body 级，图鉴条目的悬停详情也要生效
    this.popovers = new PopoverManager(document.body, this.game);
    this.selectorPage = new SelectorPage({
      game: this.game,
      root: this.root,
      popovers: this.popovers,
      selectorContext: () => createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this)),
      initSelectMode: () => initSelectModeImpl(this),
      showBackToGame: () => showBackToGameImpl(this),
      bindDetailActions: () => bindDetailActionsImpl(this),
      bindGlobalEnhancementDetailActions: () => bindGlobalEnhancementDetailActionsImpl(this),
      bindSelectorCommonActions: () => bindSelectorCommonActionsImpl(this),
      renderSelectorPage: (face: SelectionFace) => renderSelectorPageImpl(this, face),
    });
    this.io = new ImportExportService({
      game: this.game,
      modal: this.modal,
      toast: this.toast,
      resetSessionPanel: () => resetSessionPanelImpl(this),
      setStarted: () => { this.started = true; },
      clearPendingRestart: () => { this.pendingRestart = false; },
      render: () => this.render(),
    });
  }

  mount(): void {
    // EventBus 广播 → 揭示条件判断 → 变化则反射到 UI（无需玩家交互才刷新）
    bindEvents(this);
    // 无存档或存档尚未选择 Init 时展示世界线选择；只有已进入 Init 的存档才恢复游戏。
    if (!SaveSystem.exists()) {
      // GameInstance.init 会先进入默认 Init；选择大厅不应把它误认为已进入世界线。
      this.commands.reset();
      renderInitSelectImpl(this);
    } else {
      const data = SaveSystem.load<SaveData>();
      if (data) {
        this.commands.load(data);
        restoreHistoriesImpl(this, data);
      }
      if (data?.playerState.activeInit) {
        this.started = true;
        this.commands.start();
        this.render();
      } else {
        renderInitSelectImpl(this);
      }
    }
    this.refreshTimer = setInterval(() => {
      if (this.started) refreshLightImpl(this);
    }, 1000);
    // 全局快捷键：Ctrl+Shift+D → Enhancement 条件诊断
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.game.enhancements.dumpEnhancementDebug();
        this.toast.show('Enhancement 条件诊断已写入日志', 'info');
        this.render();
      }
    });
  }

  destroy(): void {
    if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    if (this.rewardTimer !== null) clearTimeout(this.rewardTimer);
    this.rewardTimer = null;
  }

  /**
   * 奖励通知延迟入流（Story 末尾留一拍）：排队后等一小拍统一落账并重渲染。
   * 落账前校验活跃流演出已彻底结束（游标清空）——完结瞬间被推送的尾巴等内容
   * 仍在播放时顺延重试，避免奖励行插在后续剧情内容中间。
   */
  private scheduleRewardChats(): void {
    if (this.pendingRewardChats.length === 0 || this.rewardTimer !== null) return;
    this.rewardTimer = setTimeout(() => {
      this.rewardTimer = null;
      const convId = this.panelState.conversationVariantId;
      const playing = convId ? this.game.getStoryView(convId) : this.game.getView().currentStory;
      if (playing) {
        this.scheduleRewardChats();
        return;
      }
      this.flushRewardChatsNow();
      this.refreshChatPanel();
    }, UIController.REWARD_REVEAL_DELAY_MS);
  }

  /** 立即落账待入流奖励（存档前调用防丢；计时中途调用先撤计时器）。 */
  private flushRewardChatsNow(): void {
    if (this.rewardTimer !== null) {
      clearTimeout(this.rewardTimer);
      this.rewardTimer = null;
    }
    for (const text of this.pendingRewardChats) {
      this.pushChat({ kind: 'reward', text });
    }
    this.pendingRewardChats = [];
  }

  /** 揭示状态指纹：计算全部实体的当前揭示级别（委托 controller-core）。 */
  computeRevealFingerprint(): string {
    return computeRevealFingerprint(this);
  }

  /** EventBus 事件驱动的揭示刷新（委托 controller-core）。 */
  refreshRevealIfChanged(): void {
    refreshRevealIfChangedImpl(this);
  }

  /** 轻量刷新：每 Tick 只更新资源数字节点，不重建 #app DOM（委托 controller-core）。 */
  refreshLight(): void {
    this.refreshStats.lightRefreshes += 1;
    this.publishRefreshStats();
    refreshLightImpl(this);
  }

  /** 开发检查用刷新计数；只返回快照，不参与界面逻辑。 */
  getRefreshStats(): UIRefreshStats {
    return { ...this.refreshStats };
  }

  /** 同步当前聊天门控状态后，仅刷新中心聊天面板。 */
  refreshChatPanel(): void {
    if (!this.started) {
      this.render();
      return;
    }
    // 与全量 render 保持一致：移动通知必须先于新剧情页进入当前流。
    for (const text of this.pendingTravelChats) this.pushChat({ kind: 'reward', text });
    this.pendingTravelChats = [];
    this.chat.syncCurrentStory(this.panelState, this.game);
    this.panelState.sendGate = this.chat.activeGate(this.panelState)
      ?? (this.chat.bannerBlocking(this.panelState) ? 'typing' : null);
    this.panelState.openingBanner = this.chat.activeBanner(this.panelState);
    this.scheduleRewardChats();
    const center = this.root.querySelector<HTMLElement>('.center-panel');
    const chatPane = center?.querySelector<HTMLElement>('.chat-pane');
    if (center && chatPane && this.panelState.centerTab === 'chat' && !this.panelState.conversationVariantId) {
      this.scroll.captureChat(this.root);
      const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
      chatPane.outerHTML = renderChatTab(
        context,
        this.panelState.chatEntries,
        this.panelState.chatTexts,
        this.game.story.getSendState(),
        this.panelState.sendGate ?? null,
        this.panelState.storyGate ?? null,
        this.panelState.openingBanner ?? null,
      );
      const nextPane = center.querySelector<HTMLElement>('.chat-pane');
      if (nextPane) bindStoryActions(this, nextPane);
      this.scroll.restoreChat(this.root, {
        centerTab: this.panelState.centerTab,
        conversationVariantId: this.panelState.conversationVariantId,
        activeStreamLength: this.activeStream().length,
      });
      this.scroll.observeChatStream(this.root);
      this.applyTheme(false);
      return;
    }
    this.refreshPanels(['center']);
  }

  /** 日志流所在面板可见时，只替换日志列表区域。 */
  refreshLogPanel(): void {
    if (!this.started || this.panelState.centerTab !== 'log') return;
    const center = this.root.querySelector<HTMLElement>('.center-panel');
    const log = center?.querySelector<HTMLElement>('.log-panel');
    if (!center || !log) return;
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    log.outerHTML = renderLogTab(context);
    bindTopBarActions(this, center);
  }

  /** 全量重建 #app DOM（供 controller-core / controller-modals 触发）。 */
  scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    queueMicrotask(() => {
      if (!this.renderScheduled) return;
      this.renderScheduled = false;
      this.render();
    });
  }

  /** 只替换发生变化的工作区面板，保留其它面板、焦点与事件状态。 */
  refreshPanels(panels: Array<'left' | 'center' | 'right'>): void {
    if (!this.started || !this.root.querySelector('.workspace')) {
      this.render();
      return;
    }
    this.refreshStats.panelRefreshes += 1;
    this.publishRefreshStats();
    this.popovers.retainIfAnchored();
    this.scroll.capturePanel(this.root);
    this.scroll.captureChat(this.root);
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const uniquePanels = [...new Set(panels)];
    for (const panel of uniquePanels) {
      const current = this.root.querySelector<HTMLElement>(`.${panel}-panel`);
      if (!current) continue;
      let html: string;
      if (panel === 'left') {
        html = renderLeftPanel(context, this.panelState);
      } else if (panel === 'center') {
        const conversation = this.panelState.conversationVariantId
          ? {
              variantId: this.panelState.conversationVariantId,
              entries: this.panelState.studentChats[this.panelState.conversationVariantId] ?? [],
              chatTexts: this.panelState.studentChatTexts[this.panelState.conversationVariantId] ?? [],
            }
          : undefined;
        html = renderCenterPanel(
          context,
          this.panelState.centerTab,
          this.panelState.chatEntries,
          this.panelState.chatTexts,
          this.game.story.getSendState(this.panelState.conversationVariantId ?? undefined),
          conversation,
          this.panelState.sendGate ?? null,
          this.panelState.storyGate ?? null,
          this.panelState.openingBanner ?? null,
        );
      } else {
        html = renderRightPanel(context, this.panelState.rightTab, this.panelState.selectedVariantId);
      }
      current.outerHTML = html;
    }
    for (const panel of uniquePanels) {
      const next = this.root.querySelector<HTMLElement>(`.${panel}-panel`);
      if (!next) continue;
      bindTopBarActions(this, next);
      bindContactsActions(this, next);
      bindThemeActions(this, next);
      bindStoryActions(this, next);
      bindInventoryActions(this, next);
    }
    this.scroll.restoreChat(this.root, {
      centerTab: this.panelState.centerTab,
      conversationVariantId: this.panelState.conversationVariantId,
      activeStreamLength: this.activeStream().length,
    });
    this.scroll.observeChatStream(this.root);
    this.scroll.restorePanel(this.root);
    this.applyTheme(false);
  }

  /** 全量重建 #app DOM（供 controller-core / controller-modals 触发）。 */
  render(): void {
    this.refreshStats.fullRenders += 1;
    this.publishRefreshStats();
    this.renderScheduled = false;
    // 交互触发重建前处理 hover 弹层：锚点被重建移除才关闭；
    // body 级弹窗（如图鉴）内的锚点不受 #app 重建影响，浮层保留
    this.popovers.retainIfAnchored();
    // 进入 Area 的「移动到了」迷你条目先于剧情内容入流：移动触发的故事与通知
    // 落在同一次 render，通知必须先落账（否则故事首内容会排在通知之前）
    for (const text of this.pendingTravelChats) {
      this.pushChat({ kind: 'reward', text });
    }
    this.pendingTravelChats = [];
    // 当前剧情页先同步进聊天流（以指纹去重），再重建 DOM
    this.chat.syncCurrentStory(this.panelState, this.game);
    // 底部按钮门控阶段（§4）：同步后按当前活跃流计算，供 renderSendButton 隐藏回复文案；
    // 开幕横幅展示/淡出期间呈阻断态（点击由 data-send 处理器忽略）
    this.panelState.sendGate = this.chat.activeGate(this.panelState)
      ?? (this.chat.bannerBlocking(this.panelState) ? 'typing' : null);
    // 开幕标题横幅：按当前活跃流读取（showBanner 状态由 openingTitleShown 事件写入）
    this.panelState.openingBanner = this.chat.activeBanner(this.panelState);
    // 奖励通知在台词/回复气泡之后落账（排队见 storyRewarded 订阅）；
    // Story 末尾留一拍：延迟入流，避免奖励信息贴着最后一页台词瞬间弹出
    this.scheduleRewardChats();
    // DOM 重建前先捕获各面板滚动位置（条件变化触发的揭示刷新不得把列表拽回顶层）
    this.scroll.capturePanel(this.root);
    // 聊天流滚动状态单独按比例捕获（跨流恢复）
    this.scroll.captureChat(this.root);
    // 先同步运行时主题层再生成 DOM：层级优先级色胶囊等依赖运行时层状态的 UI
    // 若晚于 DOM 生成（applyTheme 内），会读到上一帧的层 → 换色后落后一拍
    this.syncRuntimeTheme();
    this.ensureDatapackWorkspaceState();
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    if (!this.started && this.panelState.service === 'game') {
      // activeInit 为空时，游戏页就是 Lobby/Init 选择页；服务页仍走通用 App Shell。
      renderInitSelectImpl(this);
      return;
    }
    this.root.innerHTML = renderAppShell(context, this.panelState);
    this.popovers.bind();
    this.bindActions();
    this.scroll.restoreChat(this.root, {
      centerTab: this.panelState.centerTab,
      conversationVariantId: this.panelState.conversationVariantId,
      activeStreamLength: this.activeStream().length,
    });
    // 贴底时观察流尺寸：最新条目里的图片异步加载撑开后自动再滚到底
    this.scroll.observeChatStream(this.root);
    this.scroll.restorePanel(this.root);
    this.applyTheme(false);
    // 主题浮窗跨 render 重建存活（开关 + 位置）
    this.restoreThemeFloat();
    // 同步揭示指纹，避免下一次事件重复重建
    this.revealFingerprint = this.computeRevealFingerprint();
  }

  /**
   * 主题浮窗跨 render 重建 #app 的存活：render 全量重建会销毁浮窗 DOM，
   * 这里在重建后依据持久化的开关键与位置重新打开并归位（委托 controller-theme）。
   */
  private restoreThemeFloat(): void {
    restoreThemeFloatImpl(this);
  }

  /**
   * 激活主题 → CSS 变量注入：场景栈合并 + 语义层展开（委托 controller-theme）。
   */
  private applyTheme(syncRuntime = true): void {
    this.refreshStats.themeApplications += 1;
    this.publishRefreshStats();
    applyThemeImpl(this, syncRuntime);
  }

  ensureDatapackWorkspaceState(): void {
    const host = this.game as GameInstance & Partial<PackCatalogReadModel>;
    const catalog = host.getPackCatalog?.();
    if (!catalog) return;
    if (this.panelState.datapackWorkspace) {
      const workspace = this.panelState.datapackWorkspace;
      const known = new Set(catalog.entries.map(entry => entry.id));
      const order = workspace.draftOrder.filter(id => known.has(id));
      for (const entry of catalog.entries) if (!order.includes(entry.id)) order.push(entry.id);
      workspace.draftOrder = order;
      workspace.draftEnabledIds = workspace.draftEnabledIds.filter(id => known.has(id));
      if (workspace.selectedPackId && !known.has(workspace.selectedPackId)) workspace.selectedPackId = catalog.entries[0]?.id ?? null;
      return;
    }
    const configuration = host.getPackConfiguration?.();
    this.panelState.datapackWorkspace = {
      section: 'all',
      selectedPackId: catalog.entries[0]?.id ?? null,
      draftEnabledIds: [...(configuration?.enabledIds ?? catalog.entries.filter(entry => entry.enabled).map(entry => entry.id))],
      draftOrder: [...(configuration?.order ?? catalog.entries.map(entry => entry.id))],
      validation: null,
      lastResult: null,
    };
  }

  resetDatapackDraft(): void {
    const host = this.game as GameInstance & Partial<PackCatalogReadModel>;
    const catalog = host.getPackCatalog?.();
    if (!catalog) return;
    const configuration = host.getPackConfiguration?.();
    this.panelState.datapackWorkspace = {
      section: this.panelState.datapackWorkspace?.section ?? 'all',
      selectedPackId: this.panelState.datapackWorkspace?.selectedPackId ?? catalog.entries[0]?.id ?? null,
      draftEnabledIds: [...(configuration?.enabledIds ?? catalog.entries.filter(entry => entry.enabled).map(entry => entry.id))],
      draftOrder: [...(configuration?.order ?? catalog.entries.map(entry => entry.id))],
      validation: null,
      lastResult: null,
    };
  }

  private publishRefreshStats(): void {
    this.root.dataset.uiRefreshFull = String(this.refreshStats.fullRenders);
    this.root.dataset.uiRefreshPanels = String(this.refreshStats.panelRefreshes);
    this.root.dataset.uiRefreshLight = String(this.refreshStats.lightRefreshes);
    this.root.dataset.uiRefreshTheme = String(this.refreshStats.themeApplications);
  }

  /** 同步运行时主题层（player/area/student）到当前状态：须在生成依赖它的 UI 之前调用（委托 controller-theme）。 */
  private syncRuntimeTheme(): void {
    syncRuntimeThemeImpl(this);
  }

  /** Init 选择界面模式：由当前流程决定（新建 vs 重启/重选），替代从 activeInit 推断。 */
  initSelectMode(): InitSelectMode {
    return initSelectModeImpl(this);
  }

  /** 全量渲染选择页（Init ⇄ GlobalEnhancement 左右滑动、共享一圆）。 */
  renderInitSelect(): void {
    renderInitSelectImpl(this);
  }

  /** 全量渲染 GlobalEnhancement 选择页（轨道默认停在强化面）。 */
  renderGlobalEnhancementSelect(): void {
    renderGlobalEnhancementSelectImpl(this);
  }

  /** 局部替换当前面详情文案块（不动轮盘 DOM，旋转状态得以保留）。 */
  replaceCurrentDetail(): void {
    replaceCurrentDetailImpl(this);
  }

  /** 绑定 Init 面详情 CTA（进入 / 购买）。 */
  bindDetailActions(): void {
    bindDetailActionsImpl(this);
  }

  /** 绑定 GlobalEnhancement 面详情 CTA（购买 / 停用）。 */
  bindGlobalEnhancementDetailActions(): void {
    bindGlobalEnhancementDetailActionsImpl(this);
  }

  /** 绑定选择页顶栏共用交互（翻面 / 读档 / 返回游戏）。 */
  bindSelectorCommonActions(): void {
    bindSelectorCommonActionsImpl(this);
  }

  /** 选择页翻面：左右滑动到另一侧（共享圆盘的两面，CSS transition 平滑过渡）。 */
  flipSelectionFace(): void {
    this.selectorPage.slideTo(
      this.selectorPage.currentFace === 'global-enh' ? 'init' : 'global-enh',
    );
  }

  /** 从强化面板进入全局强化选择页（mid-game 热插拔入口）。 */
  openGlobalEnhancementSelect(): void {
    this.renderGlobalEnhancementSelect();
  }

  /**
   * 重置会话 UI：三种进入世界线的方式（新游戏 / 保存式重启 / 不保存式重启 / 读档）
   * 都回到一致的默认页面（左=区域、中=聊天、右=Spot），聊天流清空。
   */
  resetSessionPanel(): void {
    this.themeFloatOpen = false;
    resetSessionPanelImpl(this);
  }

  /** 截断聊天历史到上限（保留最近 N 条）。 */
  trimHistory(entries: ChatEntry[]): ChatEntry[] {
    return trimHistoryImpl(this, entries);
  }

  /** 保存前：把各聊天沙盒 + 一般聊天历史（限 N 条）写入 SaveData。 */
  withHistories(data: SaveData): SaveData {
    this.flushRewardChatsNow(); // 存档前先落账，延迟中的奖励通知不丢
    return withHistoriesImpl(this, data);
  }

  /** 读档后：把持久化的聊天历史恢复到各沙盒（需在 resetSessionPanel 清空之后调用）。 */
  restoreHistories(data: SaveData): void {
    restoreHistoriesImpl(this, data);
  }

  /** 新游戏进入世界线（不继承旧状态）。 */
  startNewGame(initId: string): void {
    this.themeFloatOpen = false;
    const started = this.commands.startNewGame(initId);
    if (!started) {
      this.game.devLog.record(`无法开始世界线：${initId}`, { source: 'init', level: 'error' });
      this.toast.show('无法开始世界线', 'error');
      return;
    }
    this.started = true;
    this.panelState.service = 'game';
    this.commands.start();
    resetSessionPanelImpl(this);
    const init = this.game.world.inits.get(initId);
    this.toast.show(`进入世界线 <b>${init?.name ?? initId}</b>`, 'success');
      this.scheduleRender();
  }

  /** 软重启后恢复进入世界线（保留跨 Init 进度与统计，有快照则恢复）。 */
  resumeInit(initId: string): void {
    this.themeFloatOpen = false;
    // 玩家选择 Init 时才真正执行 restartInit（保存快照 + 清 per-init 状态）
    this.commands.restartInit();
    const resumed = this.commands.resumeInit(initId);
    if (!resumed) {
      this.game.devLog.record(`无法恢复世界线：${initId}`, { source: 'init', level: 'error' });
      this.toast.show('无法恢复世界线', 'error');
      return;
    }
    this.started = true;
    this.panelState.service = 'game';
    this.commands.start();
    resetSessionPanelImpl(this);
    const init = this.game.world.inits.get(initId);
    this.toast.show(`回到世界线 <b>${init?.name ?? initId}</b>`, 'success');
    this.render();
  }

  /** 当前活跃聊天流（对话空间打开时 = 该学生的流；否则 = 一般聊天流）。 */
  activeStream(): ChatEntry[] {
    return this.chat.activeStream(this.panelState);
  }

  /** 记录聊天流条目，维持上限（路由到当前活跃流：一般聊天 / 学生对话空间）。 */
  pushChat(entry: Omit<ChatEntry, 'id' | 'timestamp'>): void {
    this.chat.push(this.panelState, entry);
  }

  /** #app 内全部 data-* 事件绑定（按域委托 controller-actions-*，render 后调用）。 */
  private bindActions(): void {
    bindTopBarActions(this);
    bindContactsActions(this);
    bindThemeActions(this);
    bindStoryActions(this);
    bindInventoryActions(this);
    bindSaveActions(this);
  }

  /** 招募补给弹窗：卡池列表 + 抽取按钮（委托 controller-modals）。 */
  openGachaModal(): void {
    openGachaModalImpl(this);
  }

  /** Spot 招募弹窗：专有卡池 / 通用卡池 经 Switch 切换（委托 controller-modals）。 */
  openSpotGachaModal(spotId: string): void {
    openSpotGachaModalImpl(this, spotId);
  }

  /** 绑定抽取按钮（root 内与弹窗内共用，委托 controller-modals）。 */
  bindGachaButtons(buttons: NodeListOf<HTMLButtonElement>): void {
    bindGachaButtonsImpl(this, buttons);
  }

  /** 打开"当前游戏 · 强化管理"弹窗：查看 + 移除已购买的 Enhancement（委托 controller-modals）。 */
  openEnhancementManager(): void {
    openEnhancementManagerImpl(this);
  }

  openUserThemeEditor(): void { openUserThemeEditorImpl(this); }

  /** 仅重新注入当前运行时主题变量，供编辑器颜色预览使用。 */
  refreshTheme(): void { this.applyTheme(); }
}
