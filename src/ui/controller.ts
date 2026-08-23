// ============================================================
// ui/controller.ts — UI 控制器（集成层）
// 疏散后作为门面：核心渲染/刷新/事件绑定保留于此，
// 聊天流/滚动/选择页/IO 委托给专门模块（chat-stream / scroll /
// init-select-page / import-export）。
// ============================================================

import { GameInstance, type SaveData } from '../engine/game-instance';
import { Character, StoryAdvanceResult, StoryStartResult, Resource } from '../engine/types';
import { SaveSystem } from '../save/storage';
import { createUIContext } from './context';
import { renderGachaBody, renderSpotGachaBody } from './components/contacts';
import { openCollectionModal } from './components/collection-modal';
import {
  getSpotReveal,
  getEnhancementReveal,
  getInitReveal,
  getAreaReveal,
  getStoryReveal,
} from './components/tooltip';
import { renderAppShell, PanelState } from './components/app-shell';
import { renderInitSelect } from './components/init-select';
import type { InitSelectMode } from './components/init-select';
import { renderEnhancementManager } from './components/enhancements';
import { storyErrorText, ChatEntry } from './components/story';
import { buildThemeVars, heroGradient, THEME_NODES, type ThemeVarName } from './theme-tree';
import { ToastService } from './components/toast';
import { enhPurchaseErrorText, travelErrorText, itemUseErrorText } from './components/errors';
import { ModalManager } from './modal';
import { PopoverManager } from './popovers';
import { hexToRgbTriplet } from '../engine/system/color-system';
import { ChatStream } from './chat-stream';
import { ScrollManager } from './scroll';
import { InitSelectPage } from './init-select-page';
import { ImportExportService } from './import-export';

export class UIController {
  /** 每个聊天沙盒（含一般聊天）持久化的历史条数上限。 */
  private static readonly MAX_CHAT_HISTORY = 60;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private panelState: PanelState = {
    leftTab: 'area',
    centerTab: 'chat',
    rightTab: 'spot',
    chatEntries: [],
    selectedVariantId: null,
    conversationVariantId: null,
    studentChats: {},
  };
  /** 弹窗母版实例（body 级，独立于 #app 重建）。 */
  private readonly modal = new ModalManager();
  /** 全局 Toast 通知（body 级，独立于 #app 重建）。 */
  readonly toast = new ToastService();
  /** 上次的揭示状态指纹：揭示条件变化时才重建 UI。 */
  private revealFingerprint = '';
  /** 揭示评估节流（避免 tick 高频事件反复重算）。 */
  private lastRevealCheck = 0;
  /** 标记当前是否来自软重启（endInit → 重选 Init）：决定点击 Init 卡片时用 resumeInit 还是 startNewGame。 */
  private pendingRestart = false;
  /** 悬浮详情弹层（body 级，事件委托一次绑定）。 */
  private readonly popovers: PopoverManager;
  /** 待落账的奖励通知（storyRewarded 排队，render 时统一入流）。 */
  private pendingRewardChats: string[] = [];

  // --- 疏散出去的领域模块 ---
  /** 聊天流（ID 计数 / 剧情指纹 / 路由 / 同步）。 */
  private readonly chat = new ChatStream();
  /** 聊天流 / 面板滚动状态。 */
  private readonly scroll = new ScrollManager();
  /** 世界线选择页轮盘交互。 */
  private readonly initPage: InitSelectPage;
  /** 数据包导入 / 日志导出。 */
  private readonly io: ImportExportService;

  constructor(
    private readonly game: GameInstance,
    private readonly root: HTMLElement,
  ) {
    // 绑定到 document.body：弹窗（app-modal）挂在 body 级，图鉴条目的悬停详情也要生效
    this.popovers = new PopoverManager(document.body, this.game);
    this.initPage = new InitSelectPage({
      game: this.game,
      root: this.root,
      popovers: this.popovers,
      initSelectMode: () => this.initSelectMode(),
      renderInitSelect: () => this.renderInitSelect(),
      replaceInitDetail: () => this.replaceInitDetail(),
      bindDetailActions: () => this.bindDetailActions(),
    });
    this.io = new ImportExportService({
      game: this.game,
      toast: this.toast,
      resetSessionPanel: () => this.resetSessionPanel(),
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
      this.refreshRevealIfChanged();
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
    // 无存档时先展示世界线选择；有存档则直接进入游戏。
    if (!SaveSystem.exists()) {
      this.renderInitSelect();
    } else {
      const data = SaveSystem.load();
      if (data) {
        this.game.load(data);
        this.restoreHistories(data);
      }
      this.started = true;
      this.game.start();
      this.render();
    }
    this.refreshTimer = setInterval(() => {
      if (this.started) this.refreshLight();
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

  /** 揭示状态指纹：计算全部实体（Spot / Enhancement / Init / Area / Story）的当前揭示级别。 */
  private computeRevealFingerprint(): string {
    const ctx = createUIContext(this.game);
    let fp = '';
    for (const spot of this.game.registry.spots.values()) {
      const r = getSpotReveal(ctx, spot);
      fp += `${spot.id}:${r.stage}:${r.nameKnown}${r.conditionKnown}${r.utilityKnown};`;
    }
    for (const enh of this.game.registry.enhancements.values()) {
      fp += `${enh.id}:${getEnhancementReveal(ctx, enh).stage};`;
    }
    for (const init of this.game.registry.inits.values()) {
      fp += `i:${init.id}:${getInitReveal(ctx, init).stage};`;
    }
    for (const area of this.game.registry.areas.values()) {
      fp += `a:${area.id}:${getAreaReveal(ctx, area).stage};`;
    }
    for (const entry of [...this.game.registry.activeStories.values(), ...this.game.registry.passiveStories.values()]) {
      fp += `s:${entry.id}:${getStoryReveal(ctx, entry).stage};`;
    }
    return fp;
  }

  /**
   * EventBus 事件驱动的揭示刷新：条件（资源/tag/flag/统计等）变化后，
   * 重算揭示指纹，与上次不同才重建 UI（无需玩家交互）。
   */
  private refreshRevealIfChanged(): void {
    if (!this.started) return;
    const now = Date.now();
    if (now - this.lastRevealCheck < 200) return; // 节流：tick 内多次事件只评估一次
    this.lastRevealCheck = now;
    const fp = this.computeRevealFingerprint();
    if (fp !== this.revealFingerprint) {
      this.revealFingerprint = fp;
      this.render();
    }
  }

  /**
   * 轻量刷新：每 Tick 只更新资源数字节点，不重建 #app DOM。
   * 这样聊天流等区域的滚动位置与交互不受 Tick 干扰。
   */
  private refreshLight(): void {
    // 兜底：奖励通知排队后若没有后续全量 render，由下一 Tick 补一次
    if (this.pendingRewardChats.length > 0) {
      this.render();
      return;
    }
    const view = this.game.getView();
    const set = (res: string, value: number) => {
      const el = this.root.querySelector<HTMLElement>(`[data-resource="${res}"]`);
      if (el) el.textContent = Math.floor(value).toLocaleString('en-US');
    };
    const setGain = (res: string) => {
      const el = this.root.querySelector<HTMLElement>(`[data-gain="${res}"]`);
      if (el) {
        el.textContent = `每 Tick +${Math.floor(this.game.gameNumSystem.evaluateResourceGain(res, this.game.state as never)).toLocaleString('en-US')}`;
      }
    };
    // Spot 产出实时刷新（最终值：含倍率与功能 Affector）
    this.root.querySelectorAll<HTMLElement>('[data-spot-yield]').forEach(el => {
      const spotId = el.dataset.spotYield!;
      const yieldValue = Math.floor(this.game.gameNumSystem.evaluateSpotYield(spotId, this.game.state as never));
      el.textContent = `产出 ${yieldValue.toLocaleString('en-US')} / tick`;
    });
    set('frame', view.totalFrames);
    set(Resource.Credit, view.resources[Resource.Credit] ?? 0);
    set(Resource.Pyroxene, view.resources[Resource.Pyroxene] ?? 0);
    setGain(Resource.Credit);
    setGain(Resource.Pyroxene);
  }

  private render(): void {
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
    this.scroll.restorePanel(this.root);
    this.applyTheme();
    // 同步揭示指纹，避免下一次事件重复重建
    this.revealFingerprint = this.computeRevealFingerprint();
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
      if (area?.theme) {
        this.game.colorSystem.pushSceneTheme({ scope: 'area', colorId: area.theme.colorId, tokens: area.theme.tokens });
      }
    }
    const convId = this.panelState.conversationVariantId;
    if (convId) {
      const variant = this.game.registry.characterVariants.get(convId);
      if (variant?.theme) {
        this.game.colorSystem.pushSceneTheme({ scope: 'student', colorId: variant.theme.colorId, tokens: variant.theme.tokens });
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
  private initSelectMode(): InitSelectMode {
    return this.pendingRestart ? 'restart' : 'new';
  }

  private renderInitSelect(): void {
    const context = createUIContext(this.game);
    this.initPage.reset();
    this.root.innerHTML = renderInitSelect(context, this.initSelectMode(), this.initPage.selectedInitId);
    // #app 重建后原锚点（如 Spot hover 的卡片）已脱离文档 → 关闭残留悬浮层，避免离开 Init 后 tooltip 不消失
    this.popovers.retainIfAnchored();
    // Init 选择页也需要 Hover 弹层（同一套事件委托，首次进入即绑定）
    this.popovers.bind();
    this.initPage.bindStage();
  }

  /** 局部替换左侧详情文案块（不动轮盘 DOM，旋转状态得以保留）。 */
  private replaceInitDetail(): void {
    this.initPage.replaceInitDetail();
  }

  /** 绑定详情 CTA（进入 / 购买）与顶栏读档按钮；轮盘局部刷新后需重绑。 */
  private bindDetailActions(): void {
    // 详情 CTA：已解锁 → 直接进入（新游戏 / 恢复）
    this.root.querySelectorAll<HTMLButtonElement>('[data-init]').forEach(button => {
      button.addEventListener('click', () => {
        const initId = button.dataset.init!;
        if (this.pendingRestart) {
          this.pendingRestart = false;
          this.resumeInit(initId);
        } else {
          this.startNewGame(initId);
        }
      });
    });

    // 详情 CTA：购买按钮：先扣费，再局部刷新该行与详情（不触发整页重渲染）
    this.root.querySelectorAll<HTMLButtonElement>('[data-init-purchase]').forEach(button => {
      button.addEventListener('click', () => {
        const initId = button.dataset.initPurchase!;
        const result = this.game.purchaseInit(initId);
        if (!result.success) {
          const errMap: Record<string, string> = {
            NotFound: '世界线不存在',
            AlreadyUnlocked: '该世界线已解锁',
            InsufficientResource: '资源不足，无法购买',
          };
          this.toast.show(`购买失败：${errMap[result.error] ?? result.error}`, 'error');
          return;
        }
        const init = this.game.registry.inits.get(initId);
        this.toast.show(`已解锁世界线 <b>${init?.name ?? initId}</b>`, 'success');
        // 解锁后局部刷新：仅替换该卡片；若它正被选中则同步刷新详情 CTA
        this.initPage.refreshRow(initId);
        if (this.initPage.selectedInitId === initId) {
          this.replaceInitDetail();
        }
      });
    });
    this.root.querySelector('#load-game-init')?.addEventListener('click', () => {
      const data = SaveSystem.load();
      if (data) {
        this.game.load(data);
        this.started = true;
        this.game.start();
        this.resetSessionPanel();
        this.restoreHistories(data);
        this.game.devLog.record('本地存档已读取', { source: 'save', level: 'success' });
        this.render();
      }
    });
  }

  /**
   * 重置会话 UI：三种进入世界线的方式（新游戏 / 保存式重启 / 不保存式重启 / 读档）
   * 都回到一致的默认页面（左=区域、中=聊天、右=Spot），聊天流清空。
   */
  private resetSessionPanel(): void {
    this.panelState.leftTab = 'area';
    this.panelState.centerTab = 'chat';
    this.panelState.rightTab = 'spot';
    this.panelState.chatEntries = [];
    // 彻底重置会话级 UI 状态：退出对话空间、清空选中差分与各学生聊天流，
    // 避免新游戏 / 读档后残留上一会话的角色聊天记录或对话空间视图。
    this.panelState.conversationVariantId = null;
    this.panelState.selectedVariantId = null;
    this.panelState.studentChats = {};
    this.chat.reset();
    this.scroll.reset();
  }

  /** 截断聊天历史到上限（保留最近 N 条）。 */
  private trimHistory(entries: ChatEntry[]): ChatEntry[] {
    const n = UIController.MAX_CHAT_HISTORY;
    return entries.length > n ? entries.slice(entries.length - n) : entries;
  }

  /** 保存前：把各聊天沙盒 + 一般聊天历史（限 N 条）写入 SaveData。 */
  private withHistories(data: SaveData): SaveData {
    const histories: Record<string, unknown[]> = {};
    for (const [variantId, entries] of Object.entries(this.panelState.studentChats)) {
      histories[`variant:${variantId}`] = this.trimHistory(entries);
    }
    histories['global'] = this.trimHistory(this.panelState.chatEntries);
    return { ...data, chatHistories: histories };
  }

  /** 读档后：把持久化的聊天历史恢复到各沙盒（需在 resetSessionPanel 清空之后调用）。 */
  private restoreHistories(data: SaveData): void {
    const histories = data.chatHistories;
    if (!histories) return;
    this.panelState.studentChats = {};
    for (const [key, entries] of Object.entries(histories)) {
      if (!key.startsWith('variant:')) continue;
      const variantId = key.slice('variant:'.length);
      this.panelState.studentChats[variantId] = entries as ChatEntry[];
    }
    // 一般聊天历史（非沙盒）仅在有沙盒占用时作为回退保留，恢复后并入 chatEntries
    const globalEntries = histories['global'];
    if (globalEntries && this.panelState.chatEntries.length === 0) {
      this.panelState.chatEntries = globalEntries as ChatEntry[];
    }
  }

  private startNewGame(initId: string): void {
    const started = this.game.startNewGame(initId);
    if (!started) {
      this.game.devLog.record(`无法开始世界线：${initId}`, { source: 'init', level: 'error' });
      this.toast.show('无法开始世界线', 'error');
      return;
    }
    this.started = true;
    this.game.start();
    this.resetSessionPanel();
    const init = this.game.registry.inits.get(initId);
    this.toast.show(`进入世界线 <b>${init?.name ?? initId}</b>`, 'success');
    this.render();
  }

  /** 软重启后恢复进入世界线（保留跨 Init 进度与统计，有快照则恢复）。 */
  private resumeInit(initId: string): void {
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
    this.resetSessionPanel();
    const init = this.game.registry.inits.get(initId);
    this.toast.show(`回到世界线 <b>${init?.name ?? initId}</b>`, 'success');
    this.render();
  }

  /** 当前活跃聊天流（对话空间打开时 = 该学生的流；否则 = 一般聊天流）。 */
  private activeStream(): ChatEntry[] {
    return this.chat.activeStream(this.panelState);
  }

  /** 记录聊天流条目，维持上限（路由到当前活跃流：一般聊天 / 学生对话空间）。 */
  private pushChat(entry: Omit<ChatEntry, 'id' | 'timestamp'>): void {
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
      const container = (e.currentTarget as HTMLElement).closest('.theme-palette');
      container?.classList.toggle('open');
    });
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
      this.started = false;
      this.pendingRestart = false;
      this.game.stop();
      this.toast.show('已返回世界线选择', 'info');
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
        if (panel === 'left') this.panelState.leftTab = tabId;
        else if (panel === 'center') {
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
    this.root.querySelectorAll<HTMLButtonElement>('[data-equip-color]').forEach(button => {
      button.addEventListener('click', () => {
        const variantId = this.panelState.selectedVariantId;
        if (!variantId) return;
        const r = this.game.mutations.equipColor(variantId, button.dataset.equipColor!);
        if (!r.ok) this.toast.show(r.reason === 'slots-full' ? '色彩槽已满' : '无法装备', 'error');
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-unequip-color]').forEach(button => {
      button.addEventListener('click', () => {
        const variantId = this.panelState.selectedVariantId;
        if (!variantId) return;
        this.game.mutations.unequipColor(variantId, button.dataset.unequipColor!);
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
        this.toast.show(colorId ? '主题已切换' : '已恢复默认主题', 'success');
        this.render();
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

    // 剧情
    this.root.querySelectorAll<HTMLButtonElement>('[data-start-story]').forEach(button => {
      button.addEventListener('click', () => {
        const storyId = button.dataset.startStory!;
        const result = this.game.startActiveStory(storyId);
        this.logStoryFailure(result);
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

  /** 招募补给弹窗：卡池列表 + 抽取按钮（结果经 chat/toast 反馈）。 */
  private openGachaModal(): void {
    this.modal.open({
      title: '招募补给 · Gacha',
      body: renderGachaBody(createUIContext(this.game)),
      width: 560,
    });
    // 弹窗挂在 body 级 .app-modal，不在 #app 内——bindActions 覆盖不到，
    // 需在每次 open 后对弹窗 DOM 单独绑定抽取按钮
    this.bindGachaButtons(document.querySelectorAll('.app-modal [data-gacha]'));
  }

  /** Spot 招募弹窗：专有卡池 / 通用卡池 经 Switch 切换。 */
  private openSpotGachaModal(spotId: string): void {
    const spot = this.game.registry.spots.get(spotId);
    if (!spot) return;
    this.modal.open({
      title: `招募 · ${spot.name}`,
      body: renderSpotGachaBody(createUIContext(this.game), spotId),
      width: 560,
    });
    // 弹窗位于 body 级 .app-modal，单独绑定 Switch 与抽取按钮
    const modalEl = document.querySelector('.app-modal');
    modalEl?.querySelectorAll<HTMLButtonElement>('[data-gacha-scope-switch] .switch-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const scope = tab.dataset.scope!;
        modalEl.querySelectorAll('[data-gacha-scope-switch] .switch-tab').forEach(t => t.classList.toggle('active', t === tab));
        modalEl.querySelectorAll<HTMLElement>('[data-scope-panel]').forEach(panel => {
          panel.hidden = panel.dataset.scopePanel !== scope;
        });
      });
    });
    this.bindGachaButtons(modalEl?.querySelectorAll<HTMLButtonElement>('[data-gacha]') ?? document.querySelectorAll('.app-modal [data-gacha]'));
  }

  /** 绑定抽取按钮（root 内与弹窗内共用）。 */
  private bindGachaButtons(buttons: NodeListOf<HTMLButtonElement>): void {
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const poolId = button.dataset.gacha!;
        const count = Number(button.dataset.gachaCount) || 1;
        try {
          const summary = this.game.gachaService.roll(poolId, count);
          for (const r of summary.results) {
            const v = this.game.rosterSystem.getVariant(r.variantId);
            this.pushChat({
              kind: 'reward',
              text: r.duplicate
                ? `招募重复 · ${v?.displayName ?? r.variantId} → 碎片 +${r.shards}`
                : `招募成功 · ${v?.displayName ?? r.variantId} 加入通讯录！`,
            });
          }
          if (summary.results.length === 0) {
            const pool = this.game.gachaService.getPool(poolId);
            this.toast.show(
              summary.stopped === 'insufficient-currency'
                ? `${pool?.currency === 'base:resource:pyroxene' ? '青辉石' : '资源'}不足`
                : '抽取失败',
              'error',
            );
          }
        } catch (e) {
          this.toast.show(e instanceof Error ? e.message : '抽取失败', 'error');
        }
        this.modal.close();
        this.render();
      });
    });
  }

  /** 打开"当前游戏 · 强化管理"弹窗：查看 + 移除已购买的 Enhancement。 */
  private openEnhancementManager(): void {
    const render = () => {
      this.modal.open({
        title: '当前游戏 · 强化管理',
        body: renderEnhancementManager(createUIContext(this.game)),
        footer: `<button class="primary-button modal-close">关闭</button>`,
        onClose: () => this.render(),
      });
      // 弹窗位于 body（不在 #app 内），此处动态绑定移除按钮
      document.querySelectorAll<HTMLButtonElement>('[data-remove-enh]').forEach(btn => {
        btn.addEventListener('click', () => {
          const enhId = btn.dataset.removeEnh!;
          const removed = this.game.removeEnhancement(enhId);
          if (removed) {
            const enh = this.game.registry.enhancements.get(enhId);
            this.toast.show(`已移除强化 <b>${enh?.name ?? enhId}</b>`, 'info');
          }
          render(); // 刷新弹窗内容
        });
      });
    };
    render();
  }
}
