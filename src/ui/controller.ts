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
import { applyTheme as applyThemeImpl, restoreThemeFloat as restoreThemeFloatImpl, syncRuntimeTheme as syncRuntimeThemeImpl } from './controller-theme';
import { bindSaveActions } from './controller-save';
import { bindTopBarActions } from './controller-actions-topbar';
import { bindContactsActions } from './controller-actions-contacts';
import { bindThemeActions } from './controller-actions-theme';
import { bindStoryActions, logStoryFailure } from './controller-actions-story';
import { bindInventoryActions } from './controller-actions-inventory';
import type { GameCommands } from '../arona-clicker/contracts';

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
    // 页级打字提示（§4）到期落内容后重建 DOM，让省略号气泡替换为消息本体
    this.chat.onChange = () => this.render();
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
      this.render();
    };
    // 绑定到 document.body：弹窗（app-modal）挂在 body 级，图鉴条目的悬停详情也要生效
    this.popovers = new PopoverManager(document.body, this.game);
    this.selectorPage = new SelectorPage({
      game: this.game,
      root: this.root,
      popovers: this.popovers,
      initSelectMode: () => initSelectModeImpl(this),
      showBackToGame: () => showBackToGameImpl(this),
      bindDetailActions: () => bindDetailActionsImpl(this),
      bindGlobalEnhancementDetailActions: () => bindGlobalEnhancementDetailActionsImpl(this),
      bindSelectorCommonActions: () => bindSelectorCommonActionsImpl(this),
      renderSelectorPage: (face: SelectionFace) => renderSelectorPageImpl(this, face),
    });
    this.io = new ImportExportService({
      game: this.game,
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
    // 无存档时先展示世界线选择；有存档则直接进入游戏。
    if (!SaveSystem.exists()) {
      renderInitSelectImpl(this);
    } else {
      const data = SaveSystem.load<SaveData>();
      if (data) {
      this.commands.load(data);
        restoreHistoriesImpl(this, data);
      }
      this.started = true;
      this.commands.start();
      this.render();
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
      this.render();
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
    refreshLightImpl(this);
  }

  /** 全量重建 #app DOM（供 controller-core / controller-modals 触发）。 */
  render(): void {
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
    const context = createUIContext(this.game);
    // 先同步运行时主题层再生成 DOM：层级优先级色胶囊等依赖运行时层状态的 UI
    // 若晚于 DOM 生成（applyTheme 内），会读到上一帧的层 → 换色后落后一拍
    this.syncRuntimeTheme();
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
    this.applyTheme();
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
  private applyTheme(): void {
    applyThemeImpl(this);
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

  /** 新游戏进入世界线（保留跨 Init 进度）。 */
  startNewGame(initId: string): void {
    this.themeFloatOpen = false;
    const started = this.commands.startNewGame(initId);
    if (!started) {
      this.game.devLog.record(`无法开始世界线：${initId}`, { source: 'init', level: 'error' });
      this.toast.show('无法开始世界线', 'error');
      return;
    }
    this.started = true;
    this.commands.start();
    resetSessionPanelImpl(this);
    const init = this.game.world.inits.get(initId);
    this.toast.show(`进入世界线 <b>${init?.name ?? initId}</b>`, 'success');
    this.render();
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
}
