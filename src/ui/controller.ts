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
import {
  renderAppShell,
  PanelState,
  type ContactsWorkspaceState,
  type OperationWorkspaceState,
  type StoryWorkspaceState,
  type WorkspaceReturnContext,
} from './components/app-shell';
import type { InitSelectMode } from './components/init-select';
import type { ChatEntry } from './components/story';
import { ToastService } from './components/toast';
import { ModalManager } from './modal';
import { PopoverManager } from './popovers';
import { ChatStream } from './chat-stream';
import { ScrollManager } from './scroll';
import { captureFocusWithin, restoreFocusWithin, type FocusSnapshot } from './focus';
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
  openSpotShopModal as openSpotShopModalImpl,
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
import { applyTheme as applyThemeImpl, backgroundView as backgroundViewImpl, presentationView as presentationViewImpl, restoreThemeFloat as restoreThemeFloatImpl, selectorBaseBackgroundView, selectorBasePresentationView, syncRuntimeTheme as syncRuntimeThemeImpl } from './controller-theme';
import { bindSaveActions } from './controller-save';
import { bindTopBarActions } from './controller-actions-topbar';
import { bindContactsActions } from './controller-actions-contacts';
import { bindThemeActions } from './controller-actions-theme';
import { bindEntityPresentationActions } from './controller-actions-presentation';
import { bindStoryActions, logStoryFailure } from './controller-actions-story';
import { bindInventoryActions } from './controller-actions-inventory';
import { bindOperationActions, type OperationFocusTarget } from './controller-actions-operation';
import type { GameCommands } from '../arona-clicker/contracts';
import type { PackCatalogReadModel } from '../arona-clicker/contracts';
import type { OperationView } from '../arona-clicker/contracts/operation-view';
import { renderAreaNavItem, renderLeftPanel, type AreaNavKind } from './components/rail';
import { renderCenterPanel, renderChatTab, renderLogTab } from './components/center-panel';
import { renderRightPanel } from './components/right-panels';
import { renderSpotCard } from './components/production';
import { getSpotReveal } from './components/tooltip';
import { renderEnhancementCard, visibleEnhancementCardIds } from './components/enhancements';
import { renderShopWorkspace } from './components/shop';
import { renderInventoryWorkspace } from './components/inventory-workspace';
import { renderCharacterWorkspace } from './components/character-workspace';
import { renderContactsWorkspace } from './components/contacts-workspace';
import { renderStoryWorkspace } from './components/story-workspace';
import { renderOperationWorkspace } from './components/operation-workspace';
import { renderSettingsWorkspace } from './components/settings-workspace';
import { renderServiceWorkspace, type ServiceWorkspaceId } from './components/service-workspace';
import { createDefaultUIBehaviorRegistry, type UIBehaviorRegistry } from './update/ui-behaviors';
import { createCodexShellState, type CodexShellState } from './runtime-editor/codex';
import type { InspectorTab } from './runtime-editor/codex-details';
import { UISurfaceRuntime, type UISurfaceToken } from './update/ui-surface';
import { UIUpdateDispatcher, type UIUpdateSink } from './update/ui-update-dispatcher';
import type { UIBehaviorId, UIElementTarget, UIUpdate, UIUpdateApplyResult, UIUpdateRequest } from './update/ui-update-types';
import {
  createDatapackWorkspaceState,
  resetDatapackWorkspaceState,
  selectDatapackPack as selectDatapackPackState,
  synchronizeDatapackWorkspaceState,
} from './workspace/datapack-workspace-state';
import { flushRuntimeEditorDraft } from './runtime-editor/actions';
import { restoreRuntimeEditorDraft, seedDebugEditing } from './runtime-editor/debug';
import { RuntimeEditorDraftPersistence } from './runtime-editor/persistence';
import {
  backWorkspaceNavigation,
  createWorkspaceNavigation,
  enterWorkspaceNavigation,
  normalizeWorkspaceRoute,
  replaceWorkspaceNavigation,
  routeFromLegacyState,
  sameWorkspaceRoute,
  type WorkspaceRouteRef,
  type WorkspaceLocation,
  type WorkspaceRoute,
} from './workspace/workspace-router';

const SHOP_REGION_HOST_IDS = [
  'leftPanel.shop.feed',
  'centerPanel.shop.catalog',
  'rightPanel.shop.settlement',
] as const;
const OPERATION_WORKSPACE_REGION_HOST_ID = 'workspace.operation';

function elementMatchesMarkup(current: HTMLElement, html: string): boolean {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const next = template.content.firstElementChild;
  if (!next) return false;
  const currentComparable = current.cloneNode(true) as HTMLElement;
  const nextComparable = next.cloneNode(true) as HTMLElement;
  for (const node of [currentComparable, nextComparable]) {
    node.querySelectorAll<HTMLElement>('[data-theme-hover-text-mode]').forEach(element => {
      element.removeAttribute('data-theme-hover-text-mode');
    });
  }
  return currentComparable.isEqualNode(nextComparable);
}

function operationMorphKey(node: Node): string | null {
  if (!(node instanceof HTMLElement)) return null;
  if (node.hasAttribute('data-operation-student')) return `student:${node.dataset.operationStudent}`;
  if (node.hasAttribute('data-operation-action-list')) return `action-list:${node.dataset.operationActionList}`;
  if (node.hasAttribute('data-operation-action')) return `action:${node.dataset.actorId}:${node.dataset.actionId}`;
  if (node.hasAttribute('data-operation-target')) return `target:${node.dataset.actorId}:${node.dataset.actionId}:${node.dataset.targetActorId}`;
  if (node.hasAttribute('data-operation-clear')) return `clear:${node.dataset.actorId}`;
  if (node.hasAttribute('data-operation-intent')) return `intent:${node.dataset.operationIntent}`;
  if (node.hasAttribute('data-operation-resolution')) return `resolution:${node.dataset.operationResolution}`;
  if (node.hasAttribute('data-operation-commit')) return 'commit';
  if (node.hasAttribute('data-operation-back')) return 'back';
  if (node.hasAttribute('data-operation-command-notice')) return 'command-notice';
  if (node.hasAttribute('data-operation-log-empty')) return 'log-empty';
  return null;
}

function operationMorphCompatible(current: Node, next: Node): boolean {
  if (current.nodeType !== next.nodeType) return false;
  if (current instanceof Element && next instanceof Element) return current.tagName === next.tagName;
  return current.nodeType === Node.TEXT_NODE || current.nodeType === Node.COMMENT_NODE;
}

function morphOperationNode(current: Node, next: Node): void {
  if (current.nodeType === Node.TEXT_NODE) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  if (!(current instanceof HTMLElement) || !(next instanceof HTMLElement)) return;
  for (const attribute of [...current.attributes]) {
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of [...next.attributes]) {
    if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  }
  const originalChildren = [...current.childNodes];
  const used = new Set<Node>();
  [...next.childNodes].forEach((nextChild, index) => {
    const key = operationMorphKey(nextChild);
    const keyed = key ? originalChildren.find(child => !used.has(child) && operationMorphKey(child) === key) : undefined;
    const positional = originalChildren[index];
    const candidate = keyed ?? (positional && !used.has(positional) && operationMorphCompatible(positional, nextChild) ? positional : undefined);
    if (candidate && operationMorphCompatible(candidate, nextChild)) {
      morphOperationNode(candidate, nextChild);
      current.appendChild(candidate);
      used.add(candidate);
    } else {
      const clone = nextChild.cloneNode(true);
      current.appendChild(clone);
      used.add(clone);
    }
  });
  for (const child of originalChildren) {
    if (!used.has(child) && child.parentNode === current) current.removeChild(child);
  }
}

export interface UIRefreshStats {
  fullRenders: number;
  panelRefreshes: number;
  lightRefreshes: number;
  themeApplications: number;
  workspaceRenders: number;
  regionRefreshes: number;
  elementRefreshes: number;
  elementMisses: number;
  behaviorPatches: number;
  behaviorMisses: number;
  droppedUpdates: number;
}

export interface UIRefreshObservation {
  scope: 'behavior' | 'element' | 'region' | 'workspace' | 'app';
  reason: string;
  surfaceKey: string;
  generation: number;
  outcome: UIUpdateApplyResult | 'dropped';
  fallbackReason?: string;
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
    workspaceNavigation: createWorkspaceNavigation(),
  };
  /** @internal 调试入口是否已打开某条编辑态包记录；与 Workspace 显隐状态分离。 */
  debugEditingSeeded = false;
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
  /** @internal 待落账通知存在时，避免连续 Tick 重复触发 full render。 */
  notificationFallbackRendered = false;
  /** @internal 奖励通知延迟入流计时器（Story 末尾留一拍）。 */
  rewardTimer: ReturnType<typeof setTimeout> | null = null;
  /** @internal 合并同一事件循环内由 EventBus 与点击处理器产生的重复重建。 */
  private renderScheduled = false;
  /** @internal Runtime Editor 批量提交期间暂缓揭示驱动的 UI 刷新。 */
  private contentRefreshBatchDepth = 0;
  private refreshStats: UIRefreshStats = {
    fullRenders: 0,
    panelRefreshes: 0,
    lightRefreshes: 0,
    themeApplications: 0,
    workspaceRenders: 0,
    regionRefreshes: 0,
    elementRefreshes: 0,
    elementMisses: 0,
    behaviorPatches: 0,
    behaviorMisses: 0,
    droppedUpdates: 0,
  };
  private readonly refreshObservations: UIRefreshObservation[] = [];
  private pendingOperationRefresh: {
    view: OperationView | null;
    focus: OperationFocusTarget | null;
    notice: string | null;
  } | null = null;
  private operationFocusAfterRender: 'commit' | 'entry' | null = null;
  private lastLogEntryId = -1;
  /** @internal 主题浮窗：跨 render 全量重建 #app 保留其开关键与位置（供 controller-theme / controller-actions-topbar 读写）。 */
  themeFloatOpen = false;
  /** @internal 主题浮窗位置（同上）。 */
  themeFloatPos: { x: number; y: number } | null = null;
  /** @internal Runtime Editor body-level floating workspace visibility. */
  runtimeEditorPanelOpen = false;
  /** @internal Runtime Editor mini launcher visibility. */
  runtimeEditorLauncherOpen = false;
  /** @internal Runtime Editor mini launcher position; null uses the CSS safe default. */
  runtimeEditorLauncherPos: { x: number; y: number } | null = null;
  /** @internal 当前通用 Editor Workspace 页面，不等同于编辑态是否存在。 */
  runtimeEditorSurface: 'mod' | 'browser' | 'codex' | 'definition' | 'spot' = 'mod';
  /** Runtime 图鉴交互状态；仅属于 UI，不进入 Runtime、PlayerState 或编辑态 Draft。 */
  runtimeEditorCodexState: CodexShellState = createCodexShellState();
  runtimeEditorCodexInspectorTab: InspectorTab = 'overview';
  /** @internal 调试入口是否已把目标编辑态包内容 hydrate 到编辑器。 */
  debugEditingHydrated = false;
  /** @internal 当前编辑态是否来自本地恢复；恢复态不能被调试 Runtime hydrate 覆盖。 */
  runtimeEditorDraftRestored = false;
  /** 用户明确关闭编辑态后，调试开关也不得在下一次 render 立即重建它。 */
  runtimeEditorExplicitlyClosed = false;
  /** Runtime Editor 编辑态的独立长效保存，不进入玩家 SaveData。 */
  readonly runtimeEditorPersistence = new RuntimeEditorDraftPersistence(undefined, message => {
    const editor = this.panelState.runtimeDatapackEditor;
    if (editor) editor.notice = message;
  });
  private runtimeEditorPersistenceBound = false;
  private readonly runtimeEditorPageHideHandler = (): void => { flushRuntimeEditorDraft(this); };
  private readonly runtimeEditorBeforeUnloadHandler = (): void => { flushRuntimeEditorDraft(this); };
  private readonly runtimeEditorVisibilityHandler = (): void => {
    if (document.visibilityState === 'hidden') flushRuntimeEditorDraft(this);
  };

  // --- 疏散出去的领域模块 ---
  /** 聊天流（ID 计数 / 剧情指纹 / 路由 / 同步）。 */
  readonly chat = new ChatStream();
  /** 聊天流 / 面板滚动状态。 */
  readonly scroll = new ScrollManager();
  /** 选择页轮盘交互（Init ⇄ GlobalEnhancement 左右滑动、共享一圆）。 */
  readonly selectorPage: SelectorPage;
  /** 数据包导入 / 日志导出。 */
  readonly io: ImportExportService;
  /** 当前逻辑 Surface 的稳定身份与挂载代数。 */
  readonly surfaceRuntime: UISurfaceRuntime;
  /** DOM 行为补丁注册表；只负责已挂载节点的最小更新。 */
  readonly uiBehaviors: UIBehaviorRegistry;
  /** UI 更新请求的去重、优先级与过期丢弃边界。 */
  readonly updates: UIUpdateDispatcher;

  constructor(
    /** @internal 供 controller-core / controller-modals / controller-panels 使用。 */
    readonly game: GameInstance,
    /** @internal 供 controller-core / controller-modals / controller-panels 使用。 */
    readonly root: HTMLElement,
  ) {
    this.commands = createGameCommands(game);
    this.surfaceRuntime = new UISurfaceRuntime(this.panelState);
    this.uiBehaviors = createDefaultUIBehaviorRegistry();
    const updateSink: UIUpdateSink = {
      getCurrentSurfaceToken: () => this.getCurrentSurfaceToken(),
      isSurfaceCurrent: token => this.isSurfaceCurrent(token),
      apply: update => this.applyUIUpdate(update),
      applyBatch: updates => this.applyUIUpdates(updates),
      onDrop: update => this.onDroppedUIUpdate(update),
    };
    this.updates = new UIUpdateDispatcher(updateSink);
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
      selectorContext: () => createUIContext(
        this.game,
        selectorBaseBackgroundView(this),
        selectorBasePresentationView(this),
        { includeResumedArea: !this.pendingRestart },
      ),
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
      onPackImported: packId => this.selectDatapackPack(packId),
      render: () => this.render(),
    });
  }

  mount(): void {
    // EventBus 广播 → 揭示条件判断 → 变化则反射到 UI（无需玩家交互才刷新）
    bindEvents(this);
    restoreRuntimeEditorDraft(this);
    if (!this.runtimeEditorPersistenceBound) {
      window.addEventListener('pagehide', this.runtimeEditorPageHideHandler);
      window.addEventListener('beforeunload', this.runtimeEditorBeforeUnloadHandler);
      document.addEventListener('visibilitychange', this.runtimeEditorVisibilityHandler);
      this.runtimeEditorPersistenceBound = true;
    }
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
    flushRuntimeEditorDraft(this);
    if (this.runtimeEditorPersistenceBound) {
      window.removeEventListener('pagehide', this.runtimeEditorPageHideHandler);
      window.removeEventListener('beforeunload', this.runtimeEditorBeforeUnloadHandler);
      document.removeEventListener('visibilitychange', this.runtimeEditorVisibilityHandler);
      this.runtimeEditorPersistenceBound = false;
    }
    this.runtimeEditorPersistence.dispose();
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

  /**
   * Story 即将开始时的奖励交接：不能让新演出把上一场奖励继续挡在延迟队列里。
   * 调用方随后会刷新聊天面板，因此这里只负责撤销计时器并把奖励按顺序入流。
   */
  deliverPendingRewardsBeforeStory(): void {
    if (this.pendingRewardChats.length === 0) return;
    this.flushRewardChatsNow();
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

  /** 当前逻辑 Surface 的 token；读取前同步一次路由状态，避免状态已切换但尚未 render。 */
  getCurrentSurfaceToken(): UISurfaceToken {
    this.surfaceRuntime.sync(this.panelState);
    return this.surfaceRuntime.current();
  }

  /** 只有 token、generation 与最近一次 DOM mount 均一致时，更新才允许落到当前 DOM。 */
  isSurfaceCurrent(token: UISurfaceToken): boolean {
    this.surfaceRuntime.sync(this.panelState);
    return this.surfaceRuntime.isCurrent(token);
  }

  /** 请求一次行为/区域/结构更新；同一事件循环内会自动合并。 */
  requestUIUpdate(request: UIUpdateRequest): void {
    this.updates.request(request);
  }

  /** 已挂载 Operation 内的单次命令提交一份 detached View，并只更新该工作区区域。 */
  requestOperationWorkspaceRefresh(
    view: OperationView | null,
    focus: OperationFocusTarget | null,
    notice: string | null = null,
  ): void {
    const workspace = this.panelState.workspace;
    if (workspace?.type !== 'operation' || (view && view.runId !== workspace.runId)) return;
    this.pendingOperationRefresh = { view, focus, notice };
    this.requestUIUpdate({
      type: 'region',
      hostId: OPERATION_WORKSPACE_REGION_HOST_ID,
      reason: 'operation-command',
    });
    this.flushUIUpdates();
  }

  /** 立即执行单个行为补丁；Tick 等高频路径使用它避免重建 DOM。 */
  applyUIBehavior(behavior: UIBehaviorId, key: string, reason: string, hostId?: string): UIUpdateApplyResult {
    return this.updates.applyNow({ type: 'behavior', behavior, key, reason, hostId });
  }

  /** 立即执行单个元素级更新；内容揭示变化使用它替换单张 Spot 卡片。 */
  applyUIElement(target: UIElementTarget, key: string, reason: string, hostId?: string): UIUpdateApplyResult {
    return this.updates.applyNow({ type: 'element', target, key, reason, hostId });
  }

  /** Runtime Editor 批量提交开始：事件仍可广播，但揭示 UI 不在批次中间重复刷新。 */
  beginContentRefreshBatch(): void {
    this.contentRefreshBatchDepth += 1;
  }

  /** Runtime Editor 批量提交结束；成功方随后执行一次明确的 render。 */
  endContentRefreshBatch(): void {
    this.contentRefreshBatchDepth = Math.max(0, this.contentRefreshBatchDepth - 1);
  }

  /** @internal 供 controller-core 避免批量内容提交中的重复刷新。 */
  isContentRefreshBatchActive(): boolean {
    return this.contentRefreshBatchDepth > 0;
  }

  /** 将当前区域内的 Spot 卡片按元素范围刷新；卡片集合变化时返回 false，交给 Panel fallback。 */
  refreshCurrentSpotCards(reason: string): boolean {
    if (!this.started || this.panelState.service !== 'game' || this.panelState.rightTab !== 'spot') return false;
    const currentAreaId = this.game.getView().currentAreaId;
    if (!currentAreaId) return false;
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const expectedIds = this.game.world.spotsOfArea(currentAreaId)
      .filter(spotId => {
        const spot = this.game.world.spots.get(spotId);
        return Boolean(spot && getSpotReveal(context, spot).stage !== 'invisible');
      });
    const currentIds = [...this.root.querySelectorAll<HTMLElement>('[data-ui-spot-card]')]
      .map(node => node.dataset.uiSpotCard)
      .filter((spotId): spotId is string => Boolean(spotId));
    if (expectedIds.length !== currentIds.length || expectedIds.some(spotId => !currentIds.includes(spotId))) return false;
    return expectedIds.every(spotId => this.applyUIElement('spot.card', spotId, reason, 'rightPanel.spot') === 'applied');
  }

  /** 将当前区域导航的揭示/锁定状态按单个按钮刷新；可达集合变化时回退左 Panel。 */
  refreshCurrentAreaNav(reason: string): boolean {
    if (!this.started || this.panelState.service !== 'game' || this.panelState.leftTab !== 'area') return false;
    const view = this.game.getView();
    const currentAreaId = view.currentAreaId;
    if (!currentAreaId || !this.game.world.areas.has(currentAreaId)) return false;
    const adjacent = this.game.availableAreaIds(currentAreaId)
      .filter(areaId => this.game.world.areas.get(areaId)?.initId === view.activeInit);
    const expected = [`current:${currentAreaId}`, ...adjacent.map(areaId => `reachable:${areaId}`)].sort();
    const actual = [...this.root.querySelectorAll<HTMLElement>('[data-ui-area-nav]')]
      .map(node => node.dataset.uiAreaNav)
      .filter((key): key is string => Boolean(key))
      .sort();
    if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) return false;
    return expected.every(key => this.applyUIElement('area.nav', key, reason, 'leftPanel.area') === 'applied');
  }

  /** 将强化卡片按元素刷新；可见卡片集合变化时回退右 Panel。 */
  refreshCurrentEnhancementCards(reason: string): boolean {
    if (!this.started || this.panelState.service !== 'game' || this.panelState.rightTab !== 'enh') return false;
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const expected = visibleEnhancementCardIds(context).sort();
    const actual = [...this.root.querySelectorAll<HTMLElement>('[data-ui-enhancement-card]')]
      .map(node => node.dataset.uiEnhancementCard)
      .filter((key): key is string => Boolean(key))
      .sort();
    if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) return false;
    return expected.every(key => this.applyUIElement('enhancement.card', key, reason, 'rightPanel.enh') === 'applied');
  }

  /** Runtime Spot 批量 Apply 后只刷新当前 Game 中受影响的可见 Spot 区域。 */
  refreshRuntimeSpotContent(reason = 'runtime-editor-spot-apply'): void {
    if (!this.started || this.panelState.service !== 'game' || this.panelState.workspace) return;
    if (this.panelState.rightTab !== 'spot') return;
    if (!this.refreshCurrentSpotCards(reason)) this.refreshPanels(['right']);
  }

  /** 外部实体表现变化的最小可见范围刷新；不可见实体不触发全量 render。 */
  refreshEntityPresentation(entityKey: string, reason = 'entity-presentation-changed'): boolean {
    const separator = entityKey.indexOf(':');
    if (separator <= 0) return false;
    const kind = entityKey.slice(0, separator);
    const id = entityKey.slice(separator + 1);
    const workspace = this.panelState.workspace;
    if (workspace) {
      const visibleVariant = kind === 'variant'
        && ((workspace.type === 'character' && workspace.variantId === id)
          || (workspace.type === 'contacts' && (workspace.selectedVariantId === id || workspace.conversationVariantId === id))
          || (workspace.type === 'story' && workspace.conversationOwner === id));
      if (visibleVariant) this.render();
      return true;
    }
    if (!this.started || this.panelState.service !== 'game') return true;

    if (kind === 'spot') {
      if (this.panelState.rightTab !== 'spot') return true;
      const card = [...this.root.querySelectorAll<HTMLElement>('[data-ui-spot-card]')]
        .find(node => node.dataset.uiSpotCard === id);
      return !card || this.applyUIElement('spot.card', id, reason, 'rightPanel.spot') === 'applied';
    }
    if (kind === 'enhancement') {
      if (this.panelState.rightTab !== 'enh') return true;
      const card = [...this.root.querySelectorAll<HTMLElement>('[data-ui-enhancement-card]')]
        .find(node => node.dataset.uiEnhancementCard === id);
      return !card || this.applyUIElement('enhancement.card', id, reason, 'rightPanel.enh') === 'applied';
    }
    if (kind === 'area') {
      if (this.panelState.leftTab !== 'area') return true;
      if (this.game.getView().currentAreaId === id) {
        this.refreshPanels(['left']);
        return true;
      }
      const nav = [...this.root.querySelectorAll<HTMLElement>('[data-ui-area-nav]')]
        .find(node => node.dataset.area === id);
      return !nav || this.applyUIElement(
        'area.nav',
        nav.dataset.uiAreaNav ?? '',
        reason,
        'leftPanel.area',
      ) === 'applied';
    }
    if (kind === 'variant') {
      if (this.panelState.conversationVariantId === id) {
        this.refreshPanels(['center']);
        return true;
      }
      if (this.panelState.rightTab === 'character' && this.panelState.selectedVariantId === id) {
        this.refreshPanels(['right']);
      }
    }
    return true;
  }

  /** Shop 交互需要在动作返回前保持同步可见，同时仍通过统一 dispatcher 执行。 */
  flushUIUpdates(): void {
    this.updates.flushNow();
  }

  /** 请求 Shop 三栏中的指定区域更新；不跨越 workspace 根节点。 */
  requestShopWorkspaceRefresh(hostIds: readonly string[], reason: string): void {
    if (this.panelState.workspace?.type !== 'shop') return;
    for (const hostId of [...new Set(hostIds)]) {
      if (!SHOP_REGION_HOST_IDS.includes(hostId as typeof SHOP_REGION_HOST_IDS[number])) continue;
      this.requestUIUpdate({ type: 'region', hostId, reason });
    }
  }

  /** 开发检查用刷新计数；只返回快照，不参与界面逻辑。 */
  getRefreshStats(): UIRefreshStats {
    return { ...this.refreshStats };
  }

  /** 最近的 UI 更新观测，供开发诊断使用；不代表浏览器 Layout / Paint 成本。 */
  getRefreshObservations(): UIRefreshObservation[] {
    return this.refreshObservations.map(observation => ({ ...observation }));
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
    if (this.panelState.workspace?.type === 'contacts' || this.panelState.workspace?.type === 'story') {
      this.refreshPanels(['center']);
      return;
    }
    const center = this.root.querySelector<HTMLElement>('.center-panel');
    const chatPane = center?.querySelector<HTMLElement>('.chat-pane');
    if (center && chatPane && this.panelState.centerTab === 'chat' && !this.panelState.conversationVariantId) {
      this.scroll.captureChat(this.root);
      const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
      const focusSnapshot = captureFocusWithin(chatPane);
      this.popovers.dismissBeforeRootMutation(chatPane);
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
      if (nextPane) {
        bindStoryActions(this, nextPane);
        restoreFocusWithin(nextPane, focusSnapshot);
      }
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
  refreshLogPanel(force = true): void {
    if (!this.started || this.panelState.centerTab !== 'log') return;
    const center = this.root.querySelector<HTMLElement>('.center-panel');
    const log = center?.querySelector<HTMLElement>('.log-panel');
    if (!center || !log) return;
    const newestLogEntryId = this.game.getDevLogs()[0]?.id ?? 0;
    if (!force && newestLogEntryId === this.lastLogEntryId) return;
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const focusSnapshot = captureFocusWithin(log);
    this.popovers.dismissBeforeRootMutation(log);
    log.outerHTML = renderLogTab(context);
    restoreFocusWithin(center.querySelector<HTMLElement>('.log-panel')!, focusSnapshot);
    this.lastLogEntryId = newestLogEntryId;
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
    // Workspace 接管三栏时，普通 panel renderer 不能局部覆盖 workspace。
    // Shop 已有自己的 Host 区域；其它 workspace 暂时保留全量 fallback。
    if (this.panelState.workspace?.type === 'shop') {
      const hostIds = panels.map(panel => `${panel}Panel.shop.${panel === 'left' ? 'feed' : panel === 'center' ? 'catalog' : 'settlement'}`);
      this.requestShopWorkspaceRefresh(hostIds, 'refresh-panels');
      this.flushUIUpdates();
      return;
    }
    if (this.panelState.workspace?.type === 'character' && panels.length === 1 && panels[0] === 'right') {
      const refreshed = this.refreshCharacterWorkspaceRegion('right');
      if (refreshed) return;
    }
    if (this.panelState.workspace?.type === 'character' && panels.length > 0) {
      const refreshed = this.refreshCharacterWorkspaceRegions(panels);
      if (refreshed) return;
    }
    if (this.panelState.workspace?.type === 'contacts' && panels.length > 0) {
      const refreshed = this.refreshContactsWorkspaceRegions(panels);
      if (refreshed) return;
    }
    if (this.panelState.workspace?.type === 'story' && panels.length === 1 && (panels[0] === 'left' || panels[0] === 'center')) {
      const refreshed = this.refreshStoryWorkspaceRegion(panels[0]);
      if (refreshed) return;
    }
    if (this.panelState.workspace?.type === 'story' && panels.length > 1) {
      const refreshed = this.refreshStoryWorkspaceRegions(panels);
      if (refreshed) return;
    }
    if (['settings', 'datapack', 'saves', 'records'].includes(this.panelState.service ?? '') && panels.length > 0) {
      const refreshed = panels.map(panel => this.refreshSettingsServiceRegion(panel));
      if (refreshed.every(Boolean)) return;
    }
    if (this.panelState.workspace) {
      this.render();
      return;
    }
    if (this.panelState.service === 'inventory' && panels.length === 1 && panels[0] === 'right') {
      const refreshed = this.refreshInventoryWorkspaceRegion('right');
      if (refreshed) return;
    }
    if (!this.panelState.workspace && panels.length === 1) {
      const refreshed = this.refreshSettingsServiceRegion(panels[0]);
      if (refreshed) return;
    }
    if (!this.started || this.panelState.service !== 'game') {
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
    const focusSnapshots = new Map<'left' | 'center' | 'right', FocusSnapshot | null>();
    for (const panel of uniquePanels) {
      const currentHost = this.findThemeHost(this.root, `${panel}Panel`);
      const current = currentHost?.querySelector<HTMLElement>(`[data-game-panel="${panel}"]`);
      if (!current) continue;
      focusSnapshots.set(panel, captureFocusWithin(current));
      this.popovers.dismissBeforeRootMutation(current);
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
      const nextHost = this.findThemeHost(this.root, `${panel}Panel`);
      const next = nextHost?.querySelector<HTMLElement>(`[data-game-panel="${panel}"]`);
      if (!next) continue;
      bindTopBarActions(this, next);
      bindContactsActions(this, next);
      bindThemeActions(this, next);
      bindEntityPresentationActions(this, next);
      bindStoryActions(this, next);
      bindInventoryActions(this, next);
      restoreFocusWithin(next, focusSnapshots.get(panel) ?? null);
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

  /** 当前正式 Workspace 的结构刷新入口；不让业务动作借 Game 列查询来决定目标。 */
  refreshWorkspace(): void {
    this.render();
  }

  /** 全量重建 #app DOM（供 controller-core / controller-modals 触发）。 */
  render(): void {
    this.surfaceRuntime.sync(this.panelState);
    this.refreshStats.fullRenders += 1;
    if (this.panelState.workspace) this.refreshStats.workspaceRenders += 1;
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
    this.scroll.captureWorkspace(this.root);
    this.popovers.dismissBeforeRootMutation();
    // 聊天流滚动状态单独按比例捕获（跨流恢复）
    this.scroll.captureChat(this.root);
    // 先同步运行时主题层再生成 DOM：层级优先级色胶囊等依赖运行时层状态的 UI
    // 若晚于 DOM 生成（applyTheme 内），会读到上一帧的层 → 换色后落后一拍
    this.syncRuntimeTheme();
    this.ensureDatapackWorkspaceState();
    this.ensureDebugEditingState();
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    if (!this.started && this.panelState.service === 'game' && !this.panelState.workspace) {
      // activeInit 为空时，游戏页就是 Lobby/Init 选择页；服务页仍走通用 App Shell。
      renderInitSelectImpl(this);
      this.surfaceRuntime.markMounted();
      return;
    }
    this.panelState.runtimeEditorPanelOpen = this.runtimeEditorPanelOpen;
    this.root.innerHTML = renderAppShell(context, this.panelState);
    this.surfaceRuntime.markMounted();
    this.lastLogEntryId = this.game.getDevLogs()[0]?.id ?? 0;
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
    this.scroll.restoreWorkspace(this.root);
    const focusAfterRender = this.operationFocusAfterRender;
    this.operationFocusAfterRender = null;
    const operationFocus = focusAfterRender === 'commit'
      ? this.root.querySelector<HTMLElement>('[data-operation-commit]:not(:disabled)')
        ?? this.root.querySelector<HTMLElement>('[data-operation-commit-dock]')
      : focusAfterRender === 'entry'
        ? this.root.querySelector<HTMLElement>('[data-operation-start], [data-operation-resume-run]')
        : null;
    if (operationFocus) {
      if (!operationFocus.hasAttribute('tabindex') && operationFocus.matches('[data-operation-commit-dock]')) operationFocus.tabIndex = -1;
      operationFocus.focus({ preventScroll: true });
    }
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
      synchronizeDatapackWorkspaceState(workspace, catalog.entries);
      return;
    }
    const configuration = host.getPackConfiguration?.();
    this.panelState.datapackWorkspace = createDatapackWorkspaceState(catalog.entries, configuration);
  }

  /** 调试入口只预先打开已有编辑态包，不创建无记录归属的全局编辑态。 */
  ensureDebugEditingState(): void {
    seedDebugEditing(this);
  }

  private refreshInventoryWorkspaceRegion(panel: 'right'): boolean {
    const hostId = `${panel}Panel.service.inventory.inspector`;
    const current = this.findThemeHost(this.root, hostId);
    if (!current) return false;

    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const template = document.createElement('template');
    template.innerHTML = renderInventoryWorkspace(context, this.panelState).trim();
    const next = this.findThemeHost(template.content, hostId);
    if (!next) return false;

    const scrollOwner = current.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
    const scrollTop = scrollOwner?.scrollTop ?? 0;
    const focusSnapshot = captureFocusWithin(current);
    this.popovers.dismissBeforeRootMutation(current);
    current.outerHTML = next.outerHTML;
    const replacement = this.findThemeHost(this.root, hostId);
    if (!replacement) return false;

    bindInventoryActions(this, replacement);
    bindTopBarActions(this, replacement);
    const nextScrollOwner = replacement.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
    if (nextScrollOwner) nextScrollOwner.scrollTop = scrollTop;
    restoreFocusWithin(replacement, focusSnapshot);
    this.refreshStats.regionRefreshes += 1;
    this.publishRefreshStats();
    this.applyTheme(false);
    return true;
  }

  private refreshSettingsServiceRegion(panel: 'left' | 'center' | 'right'): boolean {
    const service = this.panelState.service;
    if (service !== 'settings' && service !== 'datapack' && service !== 'saves' && service !== 'records') return false;
    const column = panel === 'left' ? 'navigation' : panel === 'center' ? 'main' : 'inspector';
    const hostId = service === 'datapack' && panel === 'left'
      ? 'leftPanel.service.datapack.workspace'
      : `${panel}Panel.service.${service}.${column}`;
    const current = this.findThemeHost(this.root, hostId);
    if (!current) return false;

    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const html = service === 'settings'
      ? renderSettingsWorkspace(context, this.panelState)
      : renderServiceWorkspace(context, service as ServiceWorkspaceId, this.panelState);
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const next = this.findThemeHost(template.content, hostId);
    if (!next) return false;

    const scrollOwner = current.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
    const scrollTop = scrollOwner?.scrollTop ?? 0;
    const focusSnapshot = captureFocusWithin(current);
    this.popovers.dismissBeforeRootMutation(current);
    current.outerHTML = next.outerHTML;
    const replacement = this.findThemeHost(this.root, hostId);
    if (!replacement) return false;

    bindTopBarActions(this, replacement);
    bindSaveActions(this, replacement);
    bindInventoryActions(this, replacement);
    bindEntityPresentationActions(this, replacement);
    const nextScrollOwner = replacement.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
    if (nextScrollOwner) nextScrollOwner.scrollTop = scrollTop;
    restoreFocusWithin(replacement, focusSnapshot);
    this.refreshStats.regionRefreshes += 1;
    this.publishRefreshStats();
    this.applyTheme(false);
    return true;
  }

  private refreshCharacterWorkspaceRegion(panel: 'right'): boolean {
    const workspace = this.panelState.workspace;
    if (workspace?.type !== 'character') return false;
    const hostId = `${panel}Panel.character.progression`;
    const current = this.findThemeHost(this.root, hostId);
    if (!current) return false;

    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const template = document.createElement('template');
    template.innerHTML = renderCharacterWorkspace(context, workspace, this.panelState).trim();
    const next = this.findThemeHost(template.content, hostId);
    if (!next) return false;

    const scrollOwner = current.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
    const scrollTop = scrollOwner?.scrollTop ?? 0;
    const focusSnapshot = captureFocusWithin(current);
    this.popovers.dismissBeforeRootMutation(current);
    current.outerHTML = next.outerHTML;
    const replacement = this.findThemeHost(this.root, hostId);
    if (!replacement) return false;

    bindTopBarActions(this, replacement);
    bindContactsActions(this, replacement);
    bindInventoryActions(this, replacement);
    bindEntityPresentationActions(this, replacement);
    const nextScrollOwner = replacement.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
    if (nextScrollOwner) nextScrollOwner.scrollTop = scrollTop;
    restoreFocusWithin(replacement, focusSnapshot);
    this.refreshStats.regionRefreshes += 1;
    this.publishRefreshStats();
    this.applyTheme(false);
    return true;
  }

  private refreshCharacterWorkspaceRegions(panels: ReadonlyArray<'left' | 'center' | 'right'>): boolean {
    const workspace = this.panelState.workspace;
    if (workspace?.type !== 'character') return false;
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const template = document.createElement('template');
    template.innerHTML = renderCharacterWorkspace(context, workspace, this.panelState).trim();
    const hostIds = panels.map(panel => `${panel}Panel.character.${panel === 'left' ? 'contacts' : panel === 'center' ? 'story' : 'progression'}`);
    const targets = hostIds.map(hostId => ({
      hostId,
      current: this.findThemeHost(this.root, hostId),
      next: this.findThemeHost(template.content, hostId),
    }));
    if (targets.some(target => !target.current || !target.next)) return false;
    const focusSnapshots = new Map<string, FocusSnapshot | null>();
    const scrollTops = new Map<string, number>();
    for (const target of targets) {
      focusSnapshots.set(target.hostId, captureFocusWithin(target.current!));
      scrollTops.set(target.hostId, target.current!.querySelector<HTMLElement>('[data-scroll-owner="content-region"]')?.scrollTop ?? 0);
      this.popovers.dismissBeforeRootMutation(target.current!);
    }
    if (panels.includes('center')) this.scroll.captureChat(this.root);
    for (const target of targets) target.current!.outerHTML = target.next!.outerHTML;
    for (const target of targets) {
      const replacement = this.findThemeHost(this.root, target.hostId);
      if (!replacement) return false;
      bindTopBarActions(this, replacement);
      bindContactsActions(this, replacement);
      bindInventoryActions(this, replacement);
      bindStoryActions(this, replacement);
      bindEntityPresentationActions(this, replacement);
      const nextScrollOwner = replacement.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
      if (nextScrollOwner) nextScrollOwner.scrollTop = scrollTops.get(target.hostId) ?? 0;
      restoreFocusWithin(replacement, focusSnapshots.get(target.hostId) ?? null);
    }
    if (panels.includes('center')) {
      this.scroll.restoreChat(this.root, {
        centerTab: this.panelState.centerTab,
        conversationVariantId: this.panelState.conversationVariantId,
        activeStreamLength: this.activeStream().length,
      });
      this.scroll.observeChatStream(this.root);
    }
    this.refreshStats.regionRefreshes += 1;
    this.publishRefreshStats();
    this.applyTheme(false);
    return true;
  }

  private refreshContactsWorkspaceRegions(panels: ReadonlyArray<'left' | 'center' | 'right'>): boolean {
    const workspace = this.panelState.workspace;
    if (workspace?.type !== 'contacts') return false;

    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const template = document.createElement('template');
    template.innerHTML = renderContactsWorkspace(context, workspace, this.panelState).trim();
    const hostIds = panels.map(panel => `${panel}Panel.service.contacts.${panel === 'left' ? 'navigation' : panel === 'center' ? 'main' : 'inspector'}`);
    const targets = hostIds.map(hostId => ({
      hostId,
      current: this.findThemeHost(this.root, hostId),
      next: this.findThemeHost(template.content, hostId),
    }));
    if (targets.some(target => !target.current || !target.next)) return false;
    const focusSnapshots = new Map<string, FocusSnapshot | null>();
    const scrollTops = new Map<string, number>();
    for (const target of targets) {
      focusSnapshots.set(target.hostId, captureFocusWithin(target.current!));
      scrollTops.set(target.hostId, target.current!.querySelector<HTMLElement>('[data-scroll-owner="content-region"]')?.scrollTop ?? 0);
      this.popovers.dismissBeforeRootMutation(target.current!);
    }
    if (panels.includes('center')) this.scroll.captureChat(this.root);
    for (const target of targets) target.current!.outerHTML = target.next!.outerHTML;
    for (const target of targets) {
      const replacement = this.findThemeHost(this.root, target.hostId);
      if (!replacement) return false;
      bindTopBarActions(this, replacement);
      bindContactsActions(this, replacement);
      bindInventoryActions(this, replacement);
      bindStoryActions(this, replacement);
      bindEntityPresentationActions(this, replacement);
      const nextScrollOwner = replacement.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
      if (nextScrollOwner) nextScrollOwner.scrollTop = scrollTops.get(target.hostId) ?? 0;
      restoreFocusWithin(replacement, focusSnapshots.get(target.hostId) ?? null);
    }
    if (panels.includes('center')) {
      this.scroll.restoreChat(this.root, {
        centerTab: this.panelState.centerTab,
        conversationVariantId: this.panelState.conversationVariantId,
        activeStreamLength: this.activeStream().length,
      });
      this.scroll.observeChatStream(this.root);
    }
    this.refreshStats.regionRefreshes += 1;
    this.publishRefreshStats();
    this.applyTheme(false);
    return true;
  }

  private refreshStoryWorkspaceRegion(panel: 'left' | 'center'): boolean {
    const workspace = this.panelState.workspace;
    if (workspace?.type !== 'story') return false;
    const hostId = `${panel}Panel.service.story.${panel === 'left' ? 'navigation' : 'main'}`;
    const current = this.findThemeHost(this.root, hostId);
    if (!current) return false;

    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const template = document.createElement('template');
    template.innerHTML = renderStoryWorkspace(context, workspace, this.panelState).trim();
    const next = this.findThemeHost(template.content, hostId);
    if (!next) return false;

    const focusSnapshot = captureFocusWithin(current);
    if (panel === 'center') this.scroll.captureChat(this.root);
    this.popovers.dismissBeforeRootMutation(current);
    current.outerHTML = next.outerHTML;
    const replacement = this.findThemeHost(this.root, hostId);
    if (!replacement) return false;

    bindTopBarActions(this, replacement);
    bindContactsActions(this, replacement);
    bindInventoryActions(this, replacement);
    bindStoryActions(this, replacement);
    bindEntityPresentationActions(this, replacement);
    restoreFocusWithin(replacement, focusSnapshot);
    if (panel === 'center') {
      this.scroll.restoreChat(this.root, {
        centerTab: this.panelState.centerTab,
        conversationVariantId: this.panelState.conversationVariantId,
        activeStreamLength: this.activeStream().length,
      });
      this.scroll.observeChatStream(this.root);
    }
    this.refreshStats.regionRefreshes += 1;
    this.publishRefreshStats();
    this.applyTheme(false);
    return true;
  }

  private refreshStoryWorkspaceRegions(panels: ReadonlyArray<'left' | 'center' | 'right'>): boolean {
    const workspace = this.panelState.workspace;
    if (workspace?.type !== 'story') return false;
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const template = document.createElement('template');
    template.innerHTML = renderStoryWorkspace(context, workspace, this.panelState).trim();
    const hostIds = panels.map(panel => `${panel}Panel.service.story.${panel === 'left' ? 'navigation' : panel === 'center' ? 'main' : 'inspector'}`);
    const targets = hostIds.map(hostId => ({
      hostId,
      current: this.findThemeHost(this.root, hostId),
      next: this.findThemeHost(template.content, hostId),
    }));
    if (targets.some(target => !target.current || !target.next)) return false;
    const focusSnapshots = new Map<string, FocusSnapshot | null>();
    const scrollTops = new Map<string, number>();
    for (const target of targets) {
      focusSnapshots.set(target.hostId, captureFocusWithin(target.current!));
      scrollTops.set(target.hostId, target.current!.querySelector<HTMLElement>('[data-scroll-owner="content-region"]')?.scrollTop ?? 0);
      this.popovers.dismissBeforeRootMutation(target.current!);
    }
    if (panels.includes('center')) this.scroll.captureChat(this.root);
    for (const target of targets) target.current!.outerHTML = target.next!.outerHTML;
    for (const target of targets) {
      const replacement = this.findThemeHost(this.root, target.hostId);
      if (!replacement) return false;
      bindTopBarActions(this, replacement);
      bindContactsActions(this, replacement);
      bindInventoryActions(this, replacement);
      bindStoryActions(this, replacement);
      bindEntityPresentationActions(this, replacement);
      const nextScrollOwner = replacement.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
      if (nextScrollOwner) nextScrollOwner.scrollTop = scrollTops.get(target.hostId) ?? 0;
      restoreFocusWithin(replacement, focusSnapshots.get(target.hostId) ?? null);
    }
    if (panels.includes('center')) {
      this.scroll.restoreChat(this.root, {
        centerTab: this.panelState.centerTab,
        conversationVariantId: this.panelState.conversationVariantId,
        activeStreamLength: this.activeStream().length,
      });
      this.scroll.observeChatStream(this.root);
    }
    this.refreshStats.regionRefreshes += 1;
    this.publishRefreshStats();
    this.applyTheme(false);
    return true;
  }

  /** 导入完成后将工作区定位到新包（存在工作区时）。 */
  selectDatapackPack(packId: string): void {
    const workspace = this.panelState.datapackWorkspace;
    if (!workspace) return;
    selectDatapackPackState(workspace, packId);
  }

  resetDatapackDraft(): void {
    const host = this.game as GameInstance & Partial<PackCatalogReadModel>;
    const catalog = host.getPackCatalog?.();
    if (!catalog) return;
    const configuration = host.getPackConfiguration?.();
    this.panelState.datapackWorkspace = resetDatapackWorkspaceState(catalog.entries, configuration, this.panelState.datapackWorkspace);
  }

  private publishRefreshStats(): void {
    this.root.dataset.uiRefreshFull = String(this.refreshStats.fullRenders);
    this.root.dataset.uiRefreshPanels = String(this.refreshStats.panelRefreshes);
    this.root.dataset.uiRefreshLight = String(this.refreshStats.lightRefreshes);
    this.root.dataset.uiRefreshTheme = String(this.refreshStats.themeApplications);
    this.root.dataset.uiRefreshWorkspace = String(this.refreshStats.workspaceRenders);
    this.root.dataset.uiRefreshRegion = String(this.refreshStats.regionRefreshes);
    this.root.dataset.uiRefreshElement = String(this.refreshStats.elementRefreshes);
    this.root.dataset.uiRefreshElementMiss = String(this.refreshStats.elementMisses);
    this.root.dataset.uiRefreshBehavior = String(this.refreshStats.behaviorPatches);
    this.root.dataset.uiRefreshBehaviorMiss = String(this.refreshStats.behaviorMisses);
    this.root.dataset.uiRefreshDropped = String(this.refreshStats.droppedUpdates);
  }

  private applyUIUpdate(update: UIUpdate): UIUpdateApplyResult {
    if (update.type === 'behavior') {
      const applied = this.uiBehaviors.apply(update.behavior, {
        controller: this,
        root: this.root,
        token: update.token,
        key: update.key,
      });
      if (applied) this.refreshStats.behaviorPatches += 1;
      else this.refreshStats.behaviorMisses += 1;
      this.publishRefreshStats();
      const outcome = applied ? 'applied' : 'not-found';
      this.recordUIUpdate(update, outcome, applied ? undefined : 'behavior-target-missing');
      return outcome;
    }
    if (update.type === 'element') {
      const applied = update.target === 'spot.card'
        ? this.refreshSpotCard(update.key)
        : update.target === 'enhancement.card'
          ? this.refreshEnhancementCard(update.key)
          : update.target === 'area.nav'
            ? this.refreshAreaNavItem(update.key)
            : false;
      if (applied) this.refreshStats.elementRefreshes += 1;
      else this.refreshStats.elementMisses += 1;
      this.publishRefreshStats();
      const outcome = applied ? 'applied' : 'not-found';
      this.recordUIUpdate(update, outcome, applied ? undefined : 'element-target-missing');
      return outcome;
    }
    if (update.type === 'region') {
      if (this.panelState.workspace?.type === 'operation' && update.hostId === OPERATION_WORKSPACE_REGION_HOST_ID) {
        const applied = this.refreshOperationWorkspaceRegion();
        if (applied) this.refreshStats.regionRefreshes += 1;
        this.publishRefreshStats();
        const outcome = applied ? 'applied' : 'not-found';
        this.recordUIUpdate(update, outcome, applied ? undefined : 'operation-region-missing');
        return outcome;
      }
      if (!this.panelState.workspace && this.panelState.service === 'game' && update.hostId === 'centerPanel.chat') {
        this.refreshChatPanel();
        this.refreshStats.regionRefreshes += 1;
        this.publishRefreshStats();
        this.recordUIUpdate(update, 'applied');
        return 'applied';
      }
      if (this.panelState.workspace?.type !== 'shop' || !SHOP_REGION_HOST_IDS.includes(update.hostId as typeof SHOP_REGION_HOST_IDS[number])) {
        this.recordUIUpdate(update, 'unsupported', 'region-host-unsupported');
        return 'unsupported';
      }
      const applied = this.refreshShopRegions([update.hostId]);
      const outcome = applied ? 'applied' : 'not-found';
      this.recordUIUpdate(update, outcome, applied ? undefined : 'region-host-missing');
      return outcome;
    }
    this.render();
    this.recordUIUpdate(update, 'applied');
    return 'applied';
  }

  private applyUIUpdates(updates: readonly UIUpdate[]): readonly UIUpdateApplyResult[] {
    const shopRegions = updates.filter((update): update is Extract<UIUpdate, { type: 'region' }> =>
      update.type === 'region'
      && this.panelState.workspace?.type === 'shop'
      && SHOP_REGION_HOST_IDS.includes(update.hostId as typeof SHOP_REGION_HOST_IDS[number]),
    );
    const refreshedShopRegions = shopRegions.length > 0
      ? this.refreshShopRegions([...new Set(shopRegions.map(update => update.hostId))])
      : false;
    return updates.map(update => {
      if (shopRegions.includes(update as Extract<UIUpdate, { type: 'region' }>)) {
        const outcome = refreshedShopRegions ? 'applied' : 'not-found';
        this.recordUIUpdate(update, outcome, refreshedShopRegions ? undefined : 'region-host-missing');
        return outcome;
      }
      return this.applyUIUpdate(update);
    });
  }

  private onDroppedUIUpdate(update: UIUpdate): void {
    this.refreshStats.droppedUpdates += 1;
    this.publishRefreshStats();
    this.recordUIUpdate(update, 'dropped', 'stale-surface');
  }

  private recordUIUpdate(update: UIUpdate, outcome: UIRefreshObservation['outcome'], fallbackReason?: string): void {
    const scope = update.type === 'structure' ? update.scope : update.type;
    this.refreshObservations.push({
      scope,
      reason: update.reason,
      surfaceKey: update.token.key,
      generation: update.token.generation,
      outcome,
      ...(fallbackReason ? { fallbackReason } : {}),
    });
    if (this.refreshObservations.length > 200) this.refreshObservations.shift();
  }

  private refreshSpotCard(spotId: string): boolean {
    const current = this.findSpotCard(spotId);
    if (!current) return false;
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const html = renderSpotCard(context, spotId);
    if (!html) return false;
    if (elementMatchesMarkup(current, html)) return true;
    const focusSnapshot = captureFocusWithin(current);
    this.popovers.dismissBeforeRootMutation(current);
    current.outerHTML = html;
    const replacement = this.findSpotCard(spotId);
    if (!replacement) return false;
    bindInventoryActions(this, replacement);
    bindContactsActions(this, replacement);
    bindEntityPresentationActions(this, replacement);
    restoreFocusWithin(replacement, focusSnapshot);
    this.applyTheme(false);
    return true;
  }

  private findSpotCard(spotId: string): HTMLElement | null {
    return [...this.root.querySelectorAll<HTMLElement>('[data-ui-spot-card]')]
      .find(node => node.dataset.uiSpotCard === spotId) ?? null;
  }

  private refreshEnhancementCard(enhancementId: string): boolean {
    const current = this.findEnhancementCard(enhancementId);
    if (!current) return false;
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const html = renderEnhancementCard(context, enhancementId);
    if (!html) return false;
    if (elementMatchesMarkup(current, html)) return true;
    const focusSnapshot = captureFocusWithin(current);
    this.popovers.dismissBeforeRootMutation(current);
    current.outerHTML = html;
    const replacement = this.findEnhancementCard(enhancementId);
    if (!replacement) return false;
    bindContactsActions(this, replacement);
    bindInventoryActions(this, replacement);
    bindEntityPresentationActions(this, replacement);
    restoreFocusWithin(replacement, focusSnapshot);
    this.applyTheme(false);
    return true;
  }

  private findEnhancementCard(enhancementId: string): HTMLElement | null {
    return [...this.root.querySelectorAll<HTMLElement>('[data-ui-enhancement-card]')]
      .find(node => node.dataset.uiEnhancementCard === enhancementId) ?? null;
  }

  private refreshAreaNavItem(key: string): boolean {
    const separator = key.indexOf(':');
    if (separator <= 0) return false;
    const kind = key.slice(0, separator) as AreaNavKind;
    if (kind !== 'current' && kind !== 'reachable') return false;
    const areaId = key.slice(separator + 1);
    const current = [...this.root.querySelectorAll<HTMLElement>('[data-ui-area-nav]')]
      .find(node => node.dataset.uiAreaNav === key);
    if (!current) return false;
    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const html = renderAreaNavItem(context, areaId, kind);
    if (!html) return false;
    if (elementMatchesMarkup(current, html)) return true;
    const focusSnapshot = captureFocusWithin(current);
    this.popovers.dismissBeforeRootMutation(current);
    current.outerHTML = html;
    const replacement = [...this.root.querySelectorAll<HTMLElement>('[data-ui-area-nav]')]
      .find(node => node.dataset.uiAreaNav === key);
    if (replacement) restoreFocusWithin(replacement, focusSnapshot);
    return true;
  }

  private refreshShopRegions(hostIds: readonly string[]): boolean {
    const workspace = this.panelState.workspace;
    if (workspace?.type !== 'shop') return false;
    const uniqueHostIds = [...new Set(hostIds)].filter(hostId =>
      SHOP_REGION_HOST_IDS.includes(hostId as typeof SHOP_REGION_HOST_IDS[number]),
    );
    if (uniqueHostIds.length === 0) return false;

    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const template = document.createElement('template');
    template.innerHTML = renderShopWorkspace(context, workspace).trim();
    let replaced = 0;
    for (const hostId of uniqueHostIds) {
      const current = this.findThemeHost(this.root, hostId);
      const next = this.findThemeHost(template.content, hostId);
      if (!current || !next) continue;
      const scrollOwner = current.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
      const scrollTop = scrollOwner?.scrollTop ?? 0;
      const focusSnapshot = captureFocusWithin(current);
      this.popovers.dismissBeforeRootMutation(current);
      current.outerHTML = next.outerHTML;
      const replacement = this.findThemeHost(this.root, hostId);
      if (replacement) {
        bindContactsActions(this, replacement);
        bindEntityPresentationActions(this, replacement);
        const nextScrollOwner = replacement.querySelector<HTMLElement>('[data-scroll-owner="content-region"]');
        if (nextScrollOwner) nextScrollOwner.scrollTop = scrollTop;
        restoreFocusWithin(replacement, focusSnapshot);
      }
      replaced += 1;
    }
    if (replaced === 0) return false;
    this.refreshStats.regionRefreshes += 1;
    this.publishRefreshStats();
    this.applyTheme(false);
    return replaced === uniqueHostIds.length;
  }

  private refreshOperationWorkspaceRegion(): boolean {
    const pending = this.pendingOperationRefresh;
    const workspace = this.panelState.workspace;
    if (!pending || workspace?.type !== 'operation' || (pending.view && pending.view.runId !== workspace.runId)) return false;
    const current = this.root.querySelector<HTMLElement>('[data-workspace-frame="operation"]');
    if (!current) return false;

    const context = createUIContext(this.game, backgroundViewImpl(this), presentationViewImpl(this));
    const template = document.createElement('template');
    template.innerHTML = renderOperationWorkspace(context, pending.view, pending.notice).trim();
    const next = template.content.querySelector<HTMLElement>('[data-workspace-frame="operation"]');
    if (!next) return false;

    const oldStream = current.querySelector<HTMLElement>('[data-operation-log]');
    const oldScrollTop = oldStream?.scrollTop ?? 0;
    const oldAtBottom = oldStream
      ? oldStream.scrollHeight - oldStream.clientHeight <= 0
        || oldStream.scrollTop + oldStream.clientHeight >= oldStream.scrollHeight - 24
      : true;
    this.popovers.dismissBeforeRootMutation(current);
    morphOperationNode(current, next);
    if (!current.isConnected) return false;

    const nextStream = current.querySelector<HTMLElement>('[data-operation-log]');
    if (nextStream) {
      const max = Math.max(0, nextStream.scrollHeight - nextStream.clientHeight);
      nextStream.scrollTop = oldAtBottom ? max : Math.min(oldScrollTop, max);
    }

    let focusTarget: HTMLElement | null = null;
    const focus = pending.focus;
    if (focus?.type === 'action') {
      focusTarget = [...current.querySelectorAll<HTMLButtonElement>('[data-operation-action]')]
        .find(button => button.dataset.actorId === focus.actorId && button.dataset.actionId === focus.actionId) ?? null;
    } else if (focus?.type === 'target') {
      focusTarget = [...current.querySelectorAll<HTMLButtonElement>('[data-operation-target]')]
        .find(button => button.dataset.actorId === focus.actorId
          && button.dataset.actionId === focus.actionId
          && button.dataset.targetActorId === focus.targetActorId) ?? null;
    } else if (focus?.type === 'clear') {
      focusTarget = [...current.querySelectorAll<HTMLButtonElement>('[data-operation-clear]')]
        .find(button => button.dataset.actorId === focus.actorId) ?? null;
      focusTarget ??= [...current.querySelectorAll<HTMLButtonElement>('[data-operation-action]')]
        .find(button => button.dataset.actorId === focus.actorId) ?? null;
    } else if (focus?.type === 'commit') {
      focusTarget = current.querySelector<HTMLButtonElement>('[data-operation-commit], [data-operation-scene-stage], [data-operation-scene-commit], [data-operation-reward], [data-operation-route]:not(:disabled)') ?? null;
    }
    if (focusTarget instanceof HTMLButtonElement && focusTarget.disabled) focusTarget = null;
    focusTarget ??= current.querySelector<HTMLElement>('[data-operation-command-notice]');
    focusTarget ??= current.querySelector<HTMLElement>('[data-operation-commit-dock]');
    if (focusTarget) {
      if (focusTarget.matches('[data-operation-commit-dock]')) focusTarget.tabIndex = -1;
      focusTarget.focus({ preventScroll: true });
    }

    this.pendingOperationRefresh = null;
    this.applyTheme(false);
    return true;
  }

  private findThemeHost(root: ParentNode, hostId: string): HTMLElement | null {
    return [...root.querySelectorAll<HTMLElement>('[data-theme-host-id]')]
      .find(node => node.dataset.themeHostId === hostId) ?? null;
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
    this.disposeShopWorkspace();
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
    this.navigateToService('game');
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
    this.navigateToService('game');
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
    bindEntityPresentationActions(this);
    bindStoryActions(this);
    bindInventoryActions(this);
    bindSaveActions(this);
    bindOperationActions(this);
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

  disposeShopWorkspace(): void {
    this.disposeWorkspace();
  }

  private workspaceRouteRef(): WorkspaceRouteRef | null {
    const workspace = this.panelState.workspace;
    if (!workspace) return null;
    if (workspace.type === 'shop') return { type: 'shop', sessionId: `${workspace.spotId}:${workspace.shopId}` };
    if (workspace.type === 'character') return { type: 'character', variantId: workspace.variantId };
    if (workspace.type === 'contacts') return { type: 'contacts' };
    if (workspace.type === 'story') return { type: 'story', sessionId: workspace.conversationOwner ?? undefined };
    return { type: 'operation', runId: workspace.runId };
  }

  private currentWorkspaceRoute(): WorkspaceRoute {
    return routeFromLegacyState({ service: this.panelState.service, workspace: this.workspaceRouteRef() });
  }

  workspaceLocation(): WorkspaceLocation {
    return {
      route: this.currentWorkspaceRoute(),
      leftTab: this.panelState.leftTab,
      centerTab: this.panelState.centerTab,
      rightTab: this.panelState.rightTab,
      selectedVariantId: this.panelState.selectedVariantId,
      conversationVariantId: this.panelState.conversationVariantId,
    };
  }

  private setWorkspaceRouteMirror(route: WorkspaceRoute): void {
    this.panelState.service = route.kind === 'service' ? route.page : 'game';
  }

  /** 顶层服务路由切换：清除互斥 Workspace，避免 service + workspace 组合态残留。 */
  navigateToService(service: NonNullable<PanelState['service']>): void {
    const route = routeFromLegacyState({ service, workspace: null });
    this.panelState.workspace = undefined;
    this.panelState.service = service;
    this.panelState.workspaceNavigation = createWorkspaceNavigation(route);
  }

  /** 进入新的 Workspace，并记录一个可选的单层返回位置。 */
  enterWorkspaceRoute(route: WorkspaceRoute): void {
    const previous = this.panelState.workspaceNavigation ?? createWorkspaceNavigation(this.currentWorkspaceRoute());
    this.panelState.workspaceNavigation = enterWorkspaceNavigation(previous, route, this.workspaceLocation());
    this.setWorkspaceRouteMirror(route);
  }

  /** 在当前 Workspace 内替换轻量定位，不新增返回层。 */
  replaceWorkspaceRoute(route: WorkspaceRoute): void {
    const previous = this.panelState.workspaceNavigation ?? createWorkspaceNavigation(this.currentWorkspaceRoute());
    this.panelState.workspaceNavigation = replaceWorkspaceNavigation(previous, route);
    this.setWorkspaceRouteMirror(route);
  }

  /** 退出当前临时工作区并恢复进入前的游戏面板。 */
  disposeWorkspace(): void {
    const workspace = this.panelState.workspace;
    if (!workspace) return;
    if (workspace.type === 'operation') this.operationFocusAfterRender = 'entry';
    if (workspace.type === 'shop') {
      workspace.session.clear();
      this.game.colorSystem.popEphemeralTheme(workspace.themeId);
    }
    const navigation = this.panelState.workspaceNavigation ?? createWorkspaceNavigation(this.currentWorkspaceRoute());
    const returnContext = navigation.returnTo ?? workspace.returnContext;
    const targetNavigation = navigation.returnTo
      ? backWorkspaceNavigation(navigation)
      : { current: normalizeWorkspaceRoute(returnContext.route) };
    const targetRoute = targetNavigation.current;
    if (targetRoute.kind === 'contacts') {
      this.panelState.workspace = {
        type: 'contacts',
        selectedVariantId: returnContext.selectedVariantId,
        conversationVariantId: returnContext.conversationVariantId,
        returnContext: {
          route: { kind: 'game' },
          leftTab: returnContext.leftTab,
          centerTab: returnContext.centerTab,
          rightTab: returnContext.rightTab,
          selectedVariantId: returnContext.selectedVariantId,
          conversationVariantId: returnContext.conversationVariantId,
        },
      };
      this.panelState.service = 'game';
      this.panelState.leftTab = 'area';
      this.panelState.centerTab = 'chat';
      this.panelState.rightTab = 'character';
      this.panelState.selectedVariantId = returnContext.selectedVariantId;
      this.panelState.conversationVariantId = returnContext.conversationVariantId;
      this.panelState.workspaceNavigation = createWorkspaceNavigation(targetRoute);
    } else if (targetRoute.kind === 'story') {
      this.panelState.workspace = {
        type: 'story',
        navPath: [],
        subroute: 'overview',
        selectedEntryId: null,
        conversationOwner: targetRoute.sessionId ?? null,
        mode: 'overview',
        returnContext: {
          route: { kind: 'game' },
          leftTab: returnContext.leftTab,
          centerTab: returnContext.centerTab,
          rightTab: returnContext.rightTab,
          selectedVariantId: returnContext.selectedVariantId,
          conversationVariantId: returnContext.conversationVariantId,
        },
      };
      this.panelState.service = 'game';
      this.panelState.leftTab = 'area';
      this.panelState.centerTab = 'chat';
      this.panelState.rightTab = 'spot';
      this.panelState.storyNavPath = [];
      this.panelState.selectedVariantId = returnContext.selectedVariantId;
      this.panelState.conversationVariantId = targetRoute.sessionId ?? null;
      this.panelState.workspaceNavigation = createWorkspaceNavigation(targetRoute);
    } else {
      this.panelState.workspace = undefined;
      this.panelState.leftTab = returnContext.leftTab;
      this.panelState.centerTab = returnContext.centerTab;
      this.panelState.rightTab = returnContext.rightTab;
      this.panelState.selectedVariantId = returnContext.selectedVariantId;
      this.panelState.conversationVariantId = returnContext.conversationVariantId;
      this.panelState.service = targetRoute.kind === 'service' ? targetRoute.page : 'game';
      this.panelState.workspaceNavigation = createWorkspaceNavigation(targetRoute);
    }
    this.panelState.storyGate = null;
    this.refreshTheme();
    this.render();
  }

  private createWorkspaceReturnContext(): WorkspaceReturnContext {
    const current = this.panelState.workspace;
    if (current?.type === 'contacts') {
      return {
        route: { kind: 'contacts' },
        leftTab: 'area',
        centerTab: 'chat',
        rightTab: 'character',
        selectedVariantId: current.selectedVariantId,
        conversationVariantId: current.conversationVariantId,
      };
    }
    if (current?.type === 'story') {
      return {
        route: { kind: 'story', sessionId: current.conversationOwner ?? undefined },
        leftTab: 'area',
        centerTab: 'chat',
        rightTab: 'spot',
        selectedVariantId: this.panelState.selectedVariantId,
        conversationVariantId: current.conversationOwner,
      };
    }
    return {
      route: { kind: 'game' },
      leftTab: this.panelState.leftTab,
      centerTab: this.panelState.centerTab,
      rightTab: this.panelState.rightTab,
      selectedVariantId: this.panelState.selectedVariantId,
      conversationVariantId: this.panelState.conversationVariantId,
    };
  }

  /** 进入正式 ContactsWorkspace；不选择学生也是合法状态。 */
  openContactsWorkspace(selectedVariantId?: string | null): ContactsWorkspaceState {
    const current = this.panelState.workspace?.type === 'contacts' ? this.panelState.workspace : undefined;
    const selected = selectedVariantId === undefined ? current?.selectedVariantId ?? null : selectedVariantId;
    const conversation = selectedVariantId === undefined ? current?.conversationVariantId ?? null : selectedVariantId;
    const workspace: ContactsWorkspaceState = {
      type: 'contacts',
      selectedVariantId: selected,
      conversationVariantId: conversation,
      returnContext: current?.returnContext ?? this.createWorkspaceReturnContext(),
    };
    if (current) this.replaceWorkspaceRoute({ kind: 'contacts' });
    else this.enterWorkspaceRoute({ kind: 'contacts' });
    this.panelState.workspace = workspace;
    this.panelState.leftTab = 'area';
    this.panelState.centerTab = 'chat';
    this.panelState.rightTab = 'character';
    this.panelState.selectedVariantId = selected;
    this.panelState.conversationVariantId = conversation;
    this.panelState.storyGate = null;
    return workspace;
  }

  /** Contacts 内部选择学生；不会把页面升级为 CharacterWorkspace。 */
  selectContactsVariant(variantId: string): void {
    const workspace = this.panelState.workspace?.type === 'contacts'
      ? this.panelState.workspace
      : this.openContactsWorkspace();
    workspace.selectedVariantId = variantId;
    workspace.conversationVariantId = variantId;
    this.panelState.selectedVariantId = variantId;
    this.panelState.conversationVariantId = variantId;
    this.panelState.rightTab = 'character';
  }

  /** 进入正式 StoryWorkspace；owner 只作为对话 sandbox key。 */
  openStoryWorkspace(options: {
    selectedEntryId?: string | null;
    conversationOwner?: string | null;
    mode?: StoryWorkspaceState['mode'];
  } = {}): StoryWorkspaceState {
    const current = this.panelState.workspace?.type === 'story' ? this.panelState.workspace : undefined;
    const owner = options.conversationOwner === undefined
      ? current?.conversationOwner ?? null
      : options.conversationOwner;
    const workspace: StoryWorkspaceState = {
      type: 'story',
      navPath: current?.navPath.slice() ?? [],
      subroute: 'overview',
      selectedEntryId: options.selectedEntryId === undefined ? current?.selectedEntryId ?? null : options.selectedEntryId,
      conversationOwner: owner,
      mode: options.mode ?? current?.mode ?? 'overview',
      returnContext: current?.returnContext ?? this.createWorkspaceReturnContext(),
    };
    if (current) this.replaceWorkspaceRoute({ kind: 'story', sessionId: owner ?? undefined });
    else this.enterWorkspaceRoute({ kind: 'story', sessionId: owner ?? undefined });
    this.panelState.workspace = workspace;
    this.panelState.leftTab = 'area';
    this.panelState.centerTab = 'chat';
    this.panelState.rightTab = 'spot';
    this.panelState.storyNavPath = workspace.navPath.slice();
    this.panelState.conversationVariantId = owner;
    this.panelState.storyGate = null;
    return workspace;
  }

  /** 进入独立 Operation Surface；只保存稳定 Run ID 和返回位置，不复制 Runtime View。 */
  openOperationWorkspace(runId: string): OperationWorkspaceState {
    const current = this.panelState.workspace?.type === 'operation' ? this.panelState.workspace : undefined;
    const workspace: OperationWorkspaceState = {
      type: 'operation',
      runId,
      returnContext: current?.returnContext ?? this.createWorkspaceReturnContext(),
    };
    if (current) this.replaceWorkspaceRoute({ kind: 'operation', runId });
    else this.enterWorkspaceRoute({ kind: 'operation', runId });
    this.panelState.workspace = workspace;
    this.panelState.service = 'game';
    this.panelState.leftTab = 'area';
    this.panelState.centerTab = 'chat';
    this.panelState.rightTab = 'spot';
    this.panelState.storyGate = null;
    this.operationFocusAfterRender = 'commit';
    return workspace;
  }

  /** 进入角色服务工作区；角色列表、故事流与成长面板由该工作区统一接管。 */
  openCharacterWorkspace(variantId: string): void {
    const current = this.panelState.workspace;
    const returnContext = current?.type === 'character'
      ? current.returnContext
      : {
          leftTab: this.panelState.leftTab,
          centerTab: this.panelState.centerTab,
          rightTab: this.panelState.rightTab,
          selectedVariantId: this.panelState.selectedVariantId,
          conversationVariantId: this.panelState.conversationVariantId,
        };
    if (current?.type === 'character') this.replaceWorkspaceRoute({ kind: 'character', variantId });
    else this.enterWorkspaceRoute({ kind: 'character', variantId });
    this.panelState.workspace = {
      type: 'character',
      variantId,
      conversationVariantId: variantId,
      returnContext,
    };
    this.panelState.selectedVariantId = variantId;
    this.panelState.conversationVariantId = variantId;
  }

  openSpotShopModal(spotId: string): void {
    openSpotShopModalImpl(this, spotId);
  }

  openUserThemeEditor(): void { openUserThemeEditorImpl(this); }

  /** 仅重新注入当前运行时主题变量，供编辑器颜色预览使用。 */
  refreshTheme(): void { this.applyTheme(); }
}
