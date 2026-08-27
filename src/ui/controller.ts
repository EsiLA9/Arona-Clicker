// ============================================================
// ui/controller.ts — UI 控制器（集成层）
// 疏散后作为门面：核心渲染/刷新/事件绑定保留于此，
// 聊天流/滚动/选择页/IO 委托给专门模块（chat-stream / scroll /
// init-select-page / import-export）。
// ============================================================

import { GameInstance, type SaveData } from '../engine/game-instance';
import { DEFAULT_LAYER_ORDER, type ThemeOrderScope } from '../engine/core/theme-runtime';
import { Character, StoryAdvanceResult, StoryStartResult, Resource } from '../engine/types';
import { SaveSystem } from '../save/storage';
import { createUIContext } from './context';
import { openCollectionModal } from './components/collection-modal';
import { renderAppShell, PanelState } from './components/app-shell';
import type { InitSelectMode } from './components/init-select';
import { storyErrorText, ChatEntry } from './components/story';
import { buildThemeVars, heroGradient, THEME_NODES, type ThemeVarName } from './theme-tree';
import { ToastService } from './components/toast';
import { enhPurchaseErrorText, travelErrorText, itemUseErrorText } from './components/errors';
import { ModalManager } from './modal';
import { PopoverManager } from './popovers';
import { entityKeyOf, hexToRgbTriplet } from '../engine/system/color-system';
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

export class UIController {
  /** 每个聊天沙盒（含一般聊天）持久化的历史条数上限。 */
  static readonly MAX_CHAT_HISTORY = MAX_CHAT_HISTORY;
  /** @internal 供 controller-core 读取。 */
  refreshTimer: ReturnType<typeof setInterval> | null = null;
  /** @internal 供 controller-core / controller-panels 读取。 */
  started = false;
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
  /** @internal 待落账的奖励通知（storyRewarded 排队，render 时统一入流）。 */
  pendingRewardChats: string[] = [];
  /** @internal 主题浮窗：跨 render 全量重建 #app 保留其开关键与位置（避免被其它 DOM 刷新干掉）。 */
  private themeFloatOpen = false;
  private themeFloatPos: { x: number; y: number } | null = null;

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
    this.game.eventBus.onAny(event => {
      // 生产类高频事件由 refreshLight 覆盖数值，不参与揭示评估
      if (event.type === 'tick' || event.type === 'spotProduced') return;
      refreshRevealIfChangedImpl(this);
    });
    // 剧情完结奖励结算 → 排队（不立即渲染）：等点击处理器推完玩家回复气泡、
    // render 内同步完最后一页台词后，再统一落账，保证聊天流顺序正确
    this.game.eventBus.on('storyRewarded', event => {
      if (event.type !== 'storyRewarded') return;
      const ctx = createUIContext(this.game);
      const summary = event.effects.map(effect => {
        if (effect.op === 'addResource' && effect.target) {
          return `${ctx.nameOf('resource', effect.target)} +${effect.value}`;
        }
        return effect.op;
      }).join('、');
      const parts = [
        event.source === 'conditional' ? '条件达成' : event.source === 'first' ? '首次完成' : '再次完成',
        summary || '无奖励',
        ...(event.flags.length > 0 ? [`解锁标记 ${event.flags.join('、')}`] : []),
      ];
      this.pendingRewardChats.push(parts.join(' · '));
    });
    // 池 gate 解锁 → 奖励样式通知（如「日程表攻防」开启深夜闲聊）
    this.game.eventBus.on('poolGateChanged', event => {
      if (event.type !== 'poolGateChanged' || !event.available) return;
      const ctx = createUIContext(this.game);
      this.pendingRewardChats.push(`解锁闲聊池 · ${ctx.nameOf('pool', event.poolId)}`);
    });
    // Story 的 travelToArea effect 移动（notice=true）→ 显示「移动到了 XX」迷你条目（REWARD 风格、无小字符）
    this.game.eventBus.on('storyAreaTraveled', event => {
      if (event.type !== 'storyAreaTraveled') return;
      const ctx = createUIContext(this.game);
      this.pendingRewardChats.push(`移动到了 ${ctx.nameOf('area', event.areaId)}`);
    });
    // 聊天流演出服务（Talklet）：清理全部聊天内容
    this.game.eventBus.on('chatFlowCleared', () => {
      this.chat.clearAll(this.panelState);
    });
    // 聊天流演出服务（Talklet）：删除全部可变位置的演出文本（保留聊天历史）
    this.game.eventBus.on('chatTextClearedAll', () => {
      this.chat.clearAllTexts(this.panelState);
    });
    // Story 开始前默认清理：避免中途进入（如羁绊卡片 startCardStory）时残留上一场的演出文本
    this.game.eventBus.on('storyTriggered', () => {
      this.chat.clearAllTexts(this.panelState);
    });
    // Story 完结默认清理：结束后自动删除全部演出文本覆盖层（与 clearAllChatText 一致）
    this.game.eventBus.on('storyCompleted', () => {
      this.chat.clearAllTexts(this.panelState);
    });
    // 聊天流演出服务（Talklet）：显示演出专用文本（临时 id + 百分比坐标，可嵌入标准 Talklet）
    this.game.eventBus.on('chatTextShown', event => {
      if (event.type !== 'chatTextShown') return;
      this.chat.pushChatText(this.panelState, {
        id: event.id,
        text: event.text,
        talklet: event.talklet,
        x: event.x ?? 0,
        y: event.y ?? 1,
        align: event.align ?? 'left',
        kind: event.kind,
        style: event.style,
        title: event.title,
        buttonText: event.buttonText,
        targetStoryId: event.targetStoryId,
        timestamp: Date.now(),
      });
    });
    // 聊天流演出服务（Talklet）：按临时 id 擦除演出专用文本
    this.game.eventBus.on('chatTextCleared', event => {
      if (event.type !== 'chatTextCleared') return;
      this.chat.clearChatText(this.panelState, event.id);
    });
    // 无存档时先展示世界线选择；有存档则直接进入游戏。
    if (!SaveSystem.exists()) {
      renderInitSelectImpl(this);
    } else {
      const data = SaveSystem.load();
      if (data) {
        this.game.load(data);
        restoreHistoriesImpl(this, data);
      }
      this.started = true;
      this.game.start();
      this.render();
    }
    this.refreshTimer = setInterval(() => {
      if (this.started) refreshLightImpl(this);
    }, 1000);
    // 全局快捷键：Ctrl+Shift+D → Enhancement 条件诊断
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.game.dumpEnhancementDebug();
        this.toast.show('Enhancement 条件诊断已写入日志', 'info');
        this.render();
      }
    });
  }

  destroy(): void {
    if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
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
    // 当前剧情页先同步进聊天流（以指纹去重），再重建 DOM
    this.chat.syncCurrentStory(this.panelState, this.game);
    // 奖励通知在台词/回复气泡之后落账（排队见 storyRewarded 订阅）
    for (const text of this.pendingRewardChats) {
      this.pushChat({ kind: 'reward', text });
    }
    this.pendingRewardChats = [];
    // DOM 重建前先捕获各面板滚动位置（条件变化触发的揭示刷新不得把列表拽回顶层）
    this.scroll.capturePanel(this.root);
    // 聊天流滚动状态单独按比例捕获（跨流恢复）
    this.scroll.captureChat(this.root);
    const context = createUIContext(this.game);
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
   * 这里在重建后依据持久化的开关键与位置重新打开并归位，使其不被其它 DOM 刷新干掉。
   */
  private restoreThemeFloat(): void {
    const float = this.root.querySelector<HTMLElement>('[data-theme-float]');
    if (!float) return;
    if (this.themeFloatOpen) {
      float.classList.add('open');
      if (this.themeFloatPos) {
        float.style.left = `${this.themeFloatPos.x}px`;
        float.style.top = `${this.themeFloatPos.y}px`;
        float.style.right = 'auto';
      }
    } else {
      float.classList.remove('open');
    }
  }

  /**
   * 激活主题 → CSS 变量注入。
   * 运行时主题：玩家全局层 + 场景层（当前 Area / 对话学生）按优先级合并。
   */
  private applyTheme(): void {
    const style = document.documentElement.style;
    const removeInjected = () => {
      for (const key of [...style]) {
        // 清理所有引擎 / 语义层注入：--ac-*、背景节点自身、以及背景感知文字色（ink-on/muted-on）
        if (key.startsWith('--ac-') || key.startsWith('--ink-on-') || key.startsWith('--muted-on-')) {
          style.removeProperty(key);
        }
      }
      for (const name of Object.keys(THEME_NODES) as ThemeVarName[]) {
        style.removeProperty(`--${name}`);
      }
      style.removeProperty('--hero-gradient');
    };
    removeInjected();
    // 重建运行时场景层（保留玩家基色与临时演出层）：
    // 先清空 area/student 场景栈，再按当前场景（学生对话 > Area）重推。
    this.game.colorSystem.popSceneTheme('area');
    this.game.colorSystem.popSceneTheme('student');
    this.game.colorSystem.syncPlayerThemeFromState(this.game.state);
    // 剧情未播放时清除剧情临时演出层（setTheme 仅在演出期间生效）
    if (!this.game.getView().currentStory) {
      this.game.colorSystem.clearStoryTheme();
    }
    const areaId = this.game.getView().currentAreaId;
    if (areaId) {
      const area = this.game.registry.areas.get(areaId);
      // 实体主题槽覆盖（设计/自定义）优先，否则声明默认
      const override = area
        ? this.game.colorSystem.entityThemeOverride(this.game.state, entityKeyOf('area', areaId))
        : null;
      const theme = override ?? area?.theme;
      if (theme) {
        this.game.colorSystem.pushSceneTheme({ scope: 'area', colorId: theme.colorId, tokens: theme.tokens });
      }
    }
    const convId = this.panelState.conversationVariantId;
    if (convId) {
      const variant = this.game.registry.characterVariants.get(convId);
      if (variant) {
        const entry = this.game.state.roster?.[convId];
        const equipped = entry?.equippedEquipment ?? null;
        const override = this.game.colorSystem.entityThemeOverride(
          this.game.state,
          entityKeyOf('variant', convId),
          equipped,
        );
        if (override) {
          // 实体主题槽覆盖（设计/装备/自定义）：直接采用
          this.game.colorSystem.pushSceneTheme({ scope: 'student', colorId: override.colorId, tokens: override.tokens });
        } else {
          // 学生层：优先用其 ColorGroup（装备 > 差分声明）的主色位 Color 驱动参考树；
          // variant.theme 作为显式覆盖层（仍可被作者手动指定 Color 覆盖）。
          let studentColorId: string | undefined = variant.theme?.colorId;
          const groupId = equipped
            ? this.game.colorEquipmentSystem.groupOf(equipped)?.id
            : variant.colorGroupId;
          if (!studentColorId && groupId) {
            const group = this.game.registry.colorGroups.get(groupId);
            const slot = group?.slots.find(s => s.role === 'primary') ?? group?.slots[0];
            if (slot) studentColorId = slot.colorId;
          }
          this.game.colorSystem.pushSceneTheme({
            scope: 'student',
            colorId: studentColorId,
            tokens: variant.theme?.tokens,
          });
        }
      }
    }
    const resolved = this.game.colorSystem.runtimeTheme();
    if (resolved.layers.length === 0) return; // 无任何层：移除覆盖，回退到 :root fallback
    const tokens = resolved.tokens;
    // 引擎强制设色层：合并后的 token 注入为 --ac-*
    for (const [key, value] of Object.entries(tokens)) {
      style.setProperty(`--ac-${key}`, value);
    }
    style.setProperty('--ac-primary-rgb', hexToRgbTriplet(tokens['primary'] ?? '#3b9eff'));
    // 界面语义层：由色彩树展开，引擎 --ac-* 优先、否则自动衍生；
    // 传入真实 tokens 使背景节点上的文字色（--ink-on-*）按背景明暗正确选白/黑
    const vars = buildThemeVars(tokens['primary'] ?? '#3b9eff', {}, tokens);
    for (const [key, value] of Object.entries(vars)) {
      style.setProperty(`--${key}`, value);
    }
    // area-hero 横幅渐变（跟随主题 primary 的光晕）
    style.setProperty('--hero-gradient', heroGradient(tokens['primary'] ?? '#3b9eff', tokens));
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
    return withHistoriesImpl(this, data);
  }

  /** 读档后：把持久化的聊天历史恢复到各沙盒（需在 resetSessionPanel 清空之后调用）。 */
  restoreHistories(data: SaveData): void {
    restoreHistoriesImpl(this, data);
  }

  /** 新游戏进入世界线（保留跨 Init 进度）。 */
  startNewGame(initId: string): void {
    this.themeFloatOpen = false;
    const started = this.game.startNewGame(initId);
    if (!started) {
      this.game.devLog.record(`无法开始世界线：${initId}`, { source: 'init', level: 'error' });
      this.toast.show('无法开始世界线', 'error');
      return;
    }
    this.started = true;
    this.game.start();
    resetSessionPanelImpl(this);
    const init = this.game.registry.inits.get(initId);
    this.toast.show(`进入世界线 <b>${init?.name ?? initId}</b>`, 'success');
    this.render();
  }

  /** 软重启后恢复进入世界线（保留跨 Init 进度与统计，有快照则恢复）。 */
  resumeInit(initId: string): void {
    this.themeFloatOpen = false;
    // 玩家选择 Init 时才真正执行 restartInit（保存快照 + 清 per-init 状态）
    this.game.restartInit();
    const resumed = this.game.resumeInit(initId);
    if (!resumed) {
      this.game.devLog.record(`无法恢复世界线：${initId}`, { source: 'init', level: 'error' });
      this.toast.show('无法恢复世界线', 'error');
      return;
    }
    this.started = true;
    this.game.start();
    resetSessionPanelImpl(this);
    const init = this.game.registry.inits.get(initId);
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

  private bindActions(): void {
    this.root.querySelector('#tick-now')?.addEventListener('click', () => {
      this.game.tick();
      this.render();
    });
    this.root.querySelector('#collection-modal')?.addEventListener('click', () => {
      openCollectionModal(this.modal, this.game);
    });
    this.root.querySelector('#import-datapack')?.addEventListener('click', () => {
      this.io.importDatapack();
    });
    this.root.querySelector('#theme-palette-btn')?.addEventListener('click', (e) => {
      const float = (e.currentTarget as HTMLElement)
        .closest('.theme-palette')
        ?.querySelector<HTMLElement>('[data-theme-float]');
      if (!float) return;
      this.themeFloatOpen = !this.themeFloatOpen;
      float.classList.toggle('open', this.themeFloatOpen);
    });
    this.root.querySelector('[data-theme-float-close]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.themeFloatOpen = false;
      (e.currentTarget as HTMLElement).closest('[data-theme-float]')?.classList.remove('open');
    });
    // 主题浮窗：拖动标题栏移动（position: fixed，绕开顶栏拥挤）
    const themeFloat = this.root.querySelector<HTMLElement>('[data-theme-float]');
    const themeFloatHead = this.root.querySelector<HTMLElement>('[data-theme-float-head]');
    if (themeFloat && themeFloatHead) {
      themeFloatHead.addEventListener('pointerdown', (e) => {
        if ((e.target as HTMLElement).closest('[data-theme-float-close]')) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = themeFloat.getBoundingClientRect();
        const baseX = rect.left;
        const baseY = rect.top;
        themeFloatHead.setPointerCapture(e.pointerId);
        const onMove = (ev: PointerEvent) => {
          const nx = baseX + (ev.clientX - startX);
          const ny = baseY + (ev.clientY - startY);
          const x = Math.max(0, Math.min(window.innerWidth - 80, nx));
          const y = Math.max(0, Math.min(window.innerHeight - 40, ny));
          themeFloat.style.left = `${x}px`;
          themeFloat.style.top = `${y}px`;
          themeFloat.style.right = 'auto';
          this.themeFloatPos = { x, y };
        };
        const onUp = () => {
          themeFloatHead.releasePointerCapture(e.pointerId);
          themeFloatHead.removeEventListener('pointermove', onMove);
          themeFloatHead.removeEventListener('pointerup', onUp);
        };
        themeFloatHead.addEventListener('pointermove', onMove);
        themeFloatHead.addEventListener('pointerup', onUp);
      });
    }
    this.root.querySelector('#help-modal')?.addEventListener('click', () => {
      this.modal.open({
        title: '关于 AronaClicker',
        body: `
          <p>什亭之匣内的联邦搜查部模拟器。经营设施、调度学生、推进剧情。</p>
          <p>操作：<br>· 左侧面板切换 Area / 世界线<br>· 中间为聊天演出<br>· 右侧为设施与强化<br>· 悬停资源条 / 设施可查看详情</p>
          <p>本弹窗为通用弹窗母版的示例用法：<code>modal.open({ title, body, footer, onClose })</code>。</p>`,
        footer: `<button class="primary-button modal-close">知道了</button>`,
      });
    });
    this.root.querySelector('#new-game')?.addEventListener('click', () => {
      // 彻底重启：清空全部运行时状态（含 Global 资源 / 已解锁世界线 / 统计），
      // 并删除本地存档，回到首次启动的全新世界线选择。
      this.game.reset();
      SaveSystem.delete();
      this.started = false;
      this.pendingRestart = false;
      this.toast.show('已彻底重置，回到世界线选择', 'info');
      this.themeFloatOpen = false;
      this.renderInitSelect();
    });
    this.root.querySelector('#clear-log')?.addEventListener('click', () => {
      this.game.clearDevLogs();
      this.render();
    });
    this.root.querySelector('#export-log')?.addEventListener('click', () => {
      this.io.exportLog();
    });
    this.root.querySelector('#dump-enh-debug')?.addEventListener('click', () => {
      this.game.dumpEnhancementDebug();
      this.toast.show('Enhancement 条件诊断已写入日志', 'info');
      this.render();
    });
    this.root.querySelector('#save-game')?.addEventListener('click', () => {
      const saved = SaveSystem.save(this.withHistories(this.game.save()));
      this.game.devLog.record(saved ? '本地存档已保存' : '本地存档保存失败', {
        source: 'save',
        level: saved ? 'success' : 'error',
      });
      this.toast.show(saved ? '存档已保存' : '存档保存失败', saved ? 'success' : 'error');
      this.render();
    });
    this.root.querySelector('#load-game')?.addEventListener('click', () => {
      const data = SaveSystem.load();
      if (data) {
        this.game.load(data);
        this.game.unlockInit(this.game.state.activeInit || 'base:init:schale_office');
        this.resetSessionPanel();
        this.restoreHistories(data);
        this.game.devLog.record('本地存档已读取', { source: 'save', level: 'success' });
        this.toast.show('存档已加载', 'success');
      } else {
        this.game.devLog.record('本地存档读取失败', { source: 'save', level: 'warning' });
        this.toast.show('没有找到存档', 'error');
      }
      this.render();
    });

    // Tab 切换
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => {
      button.addEventListener('click', () => {
        const [panel, tabId] = (button.dataset.tab ?? ':').split(':');
        if (panel === 'left') {
          this.panelState.leftTab = tabId;
          // 左 Tab 联动中栏：点击"区域"→ 聊天（init 视图），点击"通讯录"→ 临时页
          if (tabId === 'area') this.panelState.centerTab = 'chat';
          else if (tabId === 'contacts') this.panelState.centerTab = 'contacts-draft';
        } else if (panel === 'center') {
          const wasChat = this.panelState.centerTab === 'chat';
          this.panelState.centerTab = tabId;
          if (!wasChat && tabId === 'chat') {
            // 从日志切回聊天：标记强制滚到底
            this.scroll.forceToBottom();
          }
        } else if (panel === 'right') this.panelState.rightTab = tabId;
        this.render();
      });
    });

    // --- 通讯录 / 角色（Character 重构 UI） ---
    this.root.querySelectorAll<HTMLButtonElement>('[data-select-variant]').forEach(button => {
      button.addEventListener('click', () => {
        this.panelState.selectedVariantId = button.dataset.selectVariant ?? null;
        this.panelState.conversationVariantId = this.panelState.selectedVariantId;
        this.panelState.leftTab = 'contacts';
        this.panelState.rightTab = 'character';
        this.scroll.forceToBottom();
        this.render();
      });
    });
    // 对话空间返回键：回到一般聊天（并取消左侧该学生的 active 选中态）
    this.root.querySelector('[data-conversation-back]')?.addEventListener('click', () => {
      this.panelState.conversationVariantId = null;
      this.panelState.selectedVariantId = null;
      this.panelState.centerTab = 'chat';
      this.scroll.forceToBottom();
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-mark-read]').forEach(button => {
      button.addEventListener('click', () => {
        this.game.mutations.markChatRead(button.dataset.markRead!);
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-equip-equipment]').forEach(button => {
      button.addEventListener('click', () => {
        const variantId = this.panelState.selectedVariantId;
        if (!variantId) return;
        const r = this.game.mutations.equipEquipment(variantId, button.dataset.equipEquipment!);
        if (!r.ok) this.toast.show(r.reason === 'not-owned' ? '尚未收集该装备' : '无法装备', 'error');
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-unequip-equipment]').forEach(button => {
      button.addEventListener('click', () => {
        const variantId = this.panelState.selectedVariantId;
        if (!variantId) return;
        this.game.mutations.unequipEquipment(variantId);
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-activate-color]').forEach(button => {
      button.addEventListener('click', () => {
        const colorId = button.dataset.activateColor || null;
        if (!this.game.mutations.activateTheme(colorId)) {
          this.toast.show('该色彩尚未解锁', 'error');
          return;
        }
        this.game.mutations.setCustomTheme(null);
        this.toast.show(colorId ? '主题已切换' : '已恢复默认主题', 'success');
        this.render();
      });
    });
    // 自定义主题：从 ColorGroup 取主色位 Color 构建 ThemeDef（绕过 ownership 闸门）。
    this.root.querySelectorAll<HTMLButtonElement>('[data-activate-custom-theme]').forEach(button => {
      button.addEventListener('click', () => {
        const groupId = button.dataset.activateCustomTheme;
        if (!groupId) {
          this.game.mutations.setCustomTheme(null);
          this.toast.show('已恢复默认主题', 'success');
          this.render();
          return;
        }
        const group = this.game.registry.colorGroups.get(groupId);
        const slot = group?.slots.find(s => s.role === 'primary') ?? group?.slots[0];
        if (!slot) {
          this.toast.show('该色组无效', 'error');
          return;
        }
        this.game.mutations.setCustomTheme({ colorId: slot.colorId });
        this.game.mutations.activateTheme(null);
        this.toast.show('已应用自定义主题', 'success');
        this.render();
      });
    });
    // 层级优先级：◀/▶ 交换相邻位（低 → 高排列）
    this.root.querySelectorAll<HTMLButtonElement>('[data-theme-layer-order-move]').forEach(button => {
      button.addEventListener('click', () => {
        const scope = button.dataset.themeLayerOrderMove as ThemeOrderScope;
        const dir = Number(button.dataset.dir);
        const cur = this.game.state.themeLayerOrder ?? DEFAULT_LAYER_ORDER;
        const idx = cur.indexOf(scope);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= cur.length) return;
        const next = [...cur];
        [next[idx], next[target]] = [next[target], next[idx]];
        this.game.mutations.setThemeLayerOrder(next);
        this.render();
      });
    });
    // 实体主题槽：选定 Area / 学生的当前主题来源（载荷 = {entityKey, slot} JSON）
    this.root.querySelectorAll<HTMLButtonElement>('[data-entity-theme-select]').forEach(button => {
      button.addEventListener('click', () => {
        const raw = button.dataset.entityThemeSelect;
        if (!raw) return;
        try {
          const { entityKey, slot } = JSON.parse(raw);
          this.game.mutations.setEntityThemeSlot(entityKey, slot);
          this.render();
        } catch {
          this.toast.show('无效的主题选择', 'error');
        }
      });
    });
    this.root.querySelector('#open-gacha')?.addEventListener('click', () => this.openGachaModal());
    this.root.querySelectorAll<HTMLButtonElement>('[data-open-spot-gacha]').forEach(button => {
      button.addEventListener('click', () => this.openSpotGachaModal(button.dataset.openSpotGacha!));
    });
    // 抽取按钮在 body 级弹窗内，由 openGachaModal 打开时单独绑定（bindGachaButtons）
    this.bindGachaButtons(this.root.querySelectorAll('[data-gacha]'));
    this.root.querySelectorAll<HTMLButtonElement>('[data-add-exp]').forEach(button => {
      button.addEventListener('click', () => {
        const variantId = button.dataset.addExp!;
        const before = this.game.rosterSystem.getOwned(this.game.state, variantId)?.level ?? 0;
        const r = this.game.mutations.addExp(variantId, 100);
        if (r.ok && r.newLevel > before) this.toast.show(`升级！Lv.${r.newLevel}`, 'success');
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-breakthrough]').forEach(button => {
      button.addEventListener('click', () => {
        const r = this.game.mutations.breakthroughStar(button.dataset.breakthrough!);
        if (!r.ok) this.toast.show('碎片不足或已达上限', 'error');
        else this.toast.show(`突破成功 ★${r.newStars}`, 'success');
        this.render();
      });
    });

    // 剧情：首次进入 Entry 时切到剧情所需聊天空间（owner = VariantId → 学生对话空间沙盒；
    // 无 owner → 一般聊天流全局沙盒），并切到聊天 tab，让演出立即可见。
    // 不移动 Area：startActiveStory 只启动演出游标，不触发 travelToArea。
    this.root.querySelectorAll<HTMLButtonElement>('[data-start-story]').forEach(button => {
      button.addEventListener('click', () => {
        const storyId = button.dataset.startStory!;
        const entry = this.game.registry.activeStories.get(storyId);
        const owner = entry?.owner ?? null;
        this.panelState.conversationVariantId = owner;
        this.panelState.centerTab = 'chat';
        this.panelState.leftTab = 'story';
        this.scroll.forceToBottom();
        const result = this.game.startActiveStory(storyId, owner);
        this.logStoryFailure(result);
        this.render();
      });
    });
    // 重阅读：故事栏已完成 + replayable 的内容项。
    // 点击后前往该 Entry 归属的对话空间演出（owner = VariantId → 学生对话空间沙盒；
    // 无 owner → 一般聊天流全局沙盒），并切到聊天 tab，让演出立即可见。
    // 重读不移动 Area：replayStory 只重置演出游标，不触发 travelToArea。
    this.root.querySelectorAll<HTMLButtonElement>('[data-replay-story]').forEach(button => {
      button.addEventListener('click', () => {
        const storyId = button.dataset.replayStory!;
        const entry = this.game.registry.activeStories.get(storyId);
        const owner = entry?.owner ?? null;
        this.panelState.conversationVariantId = owner;
        this.panelState.centerTab = 'chat';
        this.panelState.leftTab = 'story';
        this.scroll.forceToBottom();
        const result = this.game.replayStory(storyId, owner);
        this.logStoryFailure(result);
        this.render();
      });
    });
    // 故事层级导航：向内逐层下钻（分类 → 篇 → 章）
    this.root.querySelectorAll<HTMLButtonElement>('[data-story-nav]').forEach(button => {
      button.addEventListener('click', () => {
        const path = (button.dataset.storyNav ?? '').split(':').filter(Boolean);
        this.panelState.storyNavPath = path;
        this.panelState.leftTab = 'story';
        this.render();
      });
    });
    // 故事层级导航：面包屑返回指定深度
    this.root.querySelectorAll<HTMLButtonElement>('[data-story-back]').forEach(button => {
      button.addEventListener('click', () => {
        const depth = Number(button.dataset.storyBack ?? 0);
        this.panelState.storyNavPath = this.panelState.storyNavPath.slice(0, depth);
        this.panelState.leftTab = 'story';
        this.render();
      });
    });
    // 故事"档案"入口：中栏切换档案临时页
    this.root.querySelectorAll<HTMLButtonElement>('[data-story-archive]').forEach(button => {
      button.addEventListener('click', () => {
        this.panelState.centerTab = 'archive-draft';
        this.render();
      });
    });
    this.root.querySelector<HTMLButtonElement>('[data-trigger-passive-story]')?.addEventListener('click', () => {
      // 壁垒：对话空间只抽归该学生的闲聊；一般聊天抽全局闲聊（owner = undefined）
      const owner = this.panelState.conversationVariantId ?? undefined;
      const result = this.game.triggerPassiveStory(this.game.getView().activeInit, owner);
      this.logStoryFailure(result);
      this.render();
    });
    // 底部发送按钮：本质是带发送交互的 Talklet 的演出形态
    this.root.querySelector<HTMLButtonElement>('[data-send]')?.addEventListener('click', () => {
      // 误触发的文本选区（拖拽选中气泡文字）不算点击，避免吞掉真实点击
      const sel = document.getSelection();
      if (sel && sel.type === 'Range' && !sel.isCollapsed) return;
      // 壁垒：聊天空间里点发送走"该学生专属闲聊"抽取；一般聊天抽全局
      const owner = this.panelState.conversationVariantId ?? undefined;
      const result = this.game.clickSend(owner);
      if (result.type === 'completed') {
        // 回显决策由引擎给出（非 click 页 + 有 sendText + 未 muteReply）：
        // 满足时才以"老师"身份发出右侧气泡；click / 静默发送不产生玩家回复气泡
        if (result.echoReply) {
          this.chat.pushPlayerReply(this.panelState, result.sentText);
        }
        // 向后吸收的过渡页（推进后自动跳过的纯展示页）同步进聊天流
        this.chat.pushAbsorbed(this.panelState, result.absorbed ?? []);
      } else if (result.type === 'working') {
        // 多击任务：尚未完成，仅进度条 +1（本次点击不发送、不推进），render() 自动刷新
      } else if (result.type === 'idle' && result.started) {
        // 无剧情时点击触发了被动闲聊
      }
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-story-choice]').forEach(button => {
      button.addEventListener('click', () => {
        // 聊天沙盒：对话空间的选项推进作用于该角色自己的游标；一般聊天推进全局游标
        const owner = this.panelState.conversationVariantId ?? undefined;
        const result = this.game.advanceStory(Number(button.dataset.storyChoice), owner);
        this.logStoryFailure(result);
        this.render();
      });
    });
    // 羁绊剧情卡片（流内渲染）：点击启动目标 ActiveStoryEntry（skipConditions，尊重单次完成态）
    this.root.querySelectorAll<HTMLElement>('[data-kizuna]').forEach(el => {
      el.addEventListener('click', () => {
        const storyId = el.dataset.kizuna!;
        const owner = this.panelState.conversationVariantId ?? undefined;
        const result = this.game.startCardStory(storyId, owner);
        this.logStoryFailure(result);
        this.render();
      });
    });

    // 背包 / 区域 / 强化 / 升级
    this.root.querySelectorAll<HTMLButtonElement>('[data-use-item]').forEach(button => {
      button.addEventListener('click', () => {
        const itemId = button.dataset.useItem!;
        const result = this.game.useItem(itemId);
        if (result.success) {
          const item = this.game.registry.items.get(itemId);
          this.toast.show(`已使用 <b>${item?.name ?? itemId}</b>`, 'success');
        } else {
          this.toast.show(`使用失败：${itemUseErrorText[result.error] ?? result.error}`, 'error');
        }
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-area]').forEach(button => {
      button.addEventListener('click', () => {
        // aria-disabled 行（当前 Area / 锁定 Area）不可移动
        if (button.getAttribute('aria-disabled') === 'true') return;
        const areaId = button.dataset.area!;
        const result = this.game.travelToArea(areaId);
        if (result.success) {
          const area = this.game.registry.areas.get(areaId);
          this.toast.show(`已前往 ${area?.name ?? areaId}`, 'success');
          // 与 Talklet 的 travelToArea（notice=true）一致：在聊天流显示「移动到了 XX」迷你条目
          this.pendingRewardChats.push(`移动到了 ${area?.name ?? areaId}`);
        } else {
          this.toast.show(`无法移动：${travelErrorText[result.error] ?? result.error}`, 'error');
        }
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-purchase-enh]').forEach(button => {
      button.addEventListener('click', () => {
        const enhId = button.dataset.purchaseEnh!;
        const result = this.game.purchaseEnhancement(enhId);
        if (result.success) {
          const enh = this.game.registry.enhancements.get(enhId);
          this.toast.show(`已获得强化 <b>${enh?.name ?? enhId}</b>`, 'success');
        } else {
          this.toast.show(`购买失败：${enhPurchaseErrorText[result.error] ?? result.error}`, 'error');
        }
        this.render();
      });
    });
    this.root.querySelector('[data-open-enh-manager]')?.addEventListener('click', () => {
      this.openEnhancementManager();
    });
    // 全局强化选择页入口（mid-game 热插拔）：打开镜像盘的 GlobalEnhancement 面
    this.root.querySelector('[data-open-global-enh-select]')?.addEventListener('click', () => {
      this.openGlobalEnhancementSelect();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(button => {
      button.addEventListener('click', () => {
        const spotId = button.dataset.upgrade!;
        // 未拥有（level 0）→ 购买解锁；已拥有 → 升级
        const level = this.game.getView().spotLevels[spotId] ?? 0;
        const spotDef = this.game.registry.spots.get(spotId);
        const spotName = spotDef?.name ?? spotId;

        if (level <= 0) {
          const result = this.game.unlockSpot(spotId);
          if (result.success) {
            this.toast.show(`已解锁 <b>${spotName}</b>`, 'success');
          } else {
            const errMap: Record<string, string> = {
              NotFound: '未找到该设施',
              NotVisible: '设施尚不可见',
              AlreadyOwned: '已拥有该设施',
              InsufficientResource: '资源不足',
              MaxLevel: '已达等级上限',
            };
            this.toast.show(`解锁失败：${errMap[result.error] ?? result.error}`, 'error');
          }
        } else {
          const result = this.game.upgradeSpot(spotId);
          if (result.success) {
            this.toast.show(`<b>${spotName}</b> 已升级至 Lv.${result.newLevel}`, 'success');
          } else {
            const errMap: Record<string, string> = {
              NotFound: '未找到该设施',
              NotOwned: '尚未拥有该设施',
              InsufficientResource: '资源不足',
              MaxLevel: this.game.getEffectiveMaxLevel(spotId) !== undefined
                ? `已达等级上限 Lv.${this.game.getEffectiveMaxLevel(spotId)}`
                : '已达等级上限',
              ConditionNotMet: '条件未满足',
            };
            this.toast.show(`升级失败：${errMap[result.error] ?? result.error}`, 'error');
          }
        }
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-restart-init]').forEach(button => {
      button.addEventListener('click', () => {
        // 不立即调用 restartInit（会清资源），仅在控制器标记待重启。
        // 玩家在 InitSelect 中选卡 / 购买时再真正执行 restartInit + resumeInit。
        this.started = false;
        this.pendingRestart = true;
        this.toast.show('选择世界线切换，或购买新世界线', 'info');
        this.renderInitSelect();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-hard-reset-init]').forEach(button => {
      button.addEventListener('click', () => {
        // 硬重置仍需立即清档（放弃快照），但保留 unlockedInits 与统计。
        this.game.hardRestartInit();
        this.started = false;
        this.pendingRestart = true;
        this.toast.show('已彻底重置当前世界线，返回选择', 'info');
        this.renderInitSelect();
      });
    });
  }

  private logStoryFailure(result: StoryStartResult | StoryAdvanceResult): void {
    if (result.success) return;
    this.game.devLog.record(`剧情操作失败：${storyErrorText[result.error] ?? result.error}`, {
      source: 'story',
      level: 'warning',
      details: result.error,
    });
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
