import { GameInstance } from '../engine/game-instance';
import { Character, StoryAdvanceResult, StoryStartResult, Resource } from '../engine/types';
import { SaveSystem } from '../save/storage';
import { loadDatapackFromZipFile } from '../data/zip-loader';
import { createUIContext } from './context';
import { renderCollectionBody, renderColorCodex } from './components/collection';
import { renderGachaBody } from './components/contacts';
import {
  getSpotReveal,
  getEnhancementReveal,
  getInitReveal,
  getAreaReveal,
  getStoryReveal,
} from './components/tooltip';
import { renderAppShell, PanelState } from './components/app-shell';
import { renderInitSelect, renderInitDetail, renderInitRow } from './components/init-select';
import type { InitSelectMode } from './components/init-select';
import { renderEnhancementManager } from './components/enhancements';
import { storyErrorText, ChatEntry } from './components/story';
import { PLAYER_IDENTITY } from './player';
import { buildThemeVars, heroGradient, THEME_NODES, type ThemeVarName } from './theme-tree';
import { ToastService } from './components/toast';
import { enhPurchaseErrorText, travelErrorText, itemUseErrorText } from './components/errors';
import { ModalManager } from './modal';
import { PopoverManager } from './popovers';
import { hexToRgbTriplet } from '../engine/color-system';

const CHAT_MAX = 200;

export class UIController {
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
  private chatId = 1;
  private lastChatCount = 0;
  /** 当前剧情页指纹（storyId:pageIndex）：聊天流去重，防止重复入流。 */
  private lastStoryFingerprint: string | null = null;
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

  constructor(
    private readonly game: GameInstance,
    private readonly root: HTMLElement,
  ) {
    // 绑定到 document.body：弹窗（app-modal）挂在 body 级，图鉴条目的悬停详情也要生效
    this.popovers = new PopoverManager(document.body, this.game);
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
    // 无存档时先展示世界线选择；有存档则直接进入游戏。
    if (!SaveSystem.exists()) {
      this.renderInitSelect();
    } else {
      const data = SaveSystem.load();
      if (data) this.game.load(data);
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
    this.syncCurrentStoryToChat();
    // 奖励通知在台词/回复气泡之后落账（排队见 storyRewarded 订阅）
    for (const text of this.pendingRewardChats) {
      this.pushChat({ kind: 'reward', text });
    }
    this.pendingRewardChats = [];
    // DOM 重建前先捕获各面板滚动位置（条件变化触发的揭示刷新不得把列表拽回顶层）
    this.capturePanelScroll();
    // 聊天流滚动状态单独按比例捕获（跨流恢复）
    this.captureChatScroll();
    const context = createUIContext(this.game);
    this.root.innerHTML = renderAppShell(context, this.panelState);
    this.popovers.bind();
    this.bindActions();
    this.restoreChatScroll();
    this.restorePanelScroll();
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

  /** 聊天流滚动状态：以比例保存，DOM 重建后恢复。 */
  private chatScrollRatio = 1;
  private chatAtBottom = true;
  private pendingChatForceScroll = false;
  /** 待落账的奖励通知（storyRewarded 排队，render 时统一入流）。 */
  private pendingRewardChats: string[] = [];

  /** 重建 DOM 前调用：记录当前聊天流滚动比例，并判断是否贴底。 */
  private captureChatScroll(): void {
    const stream = this.root.querySelector<HTMLElement>('.chat-stream');
    if (!stream) return;
    const max = stream.scrollHeight - stream.clientHeight;
    if (max <= 0) {
      this.chatScrollRatio = 1;
      this.chatAtBottom = true;
      return;
    }
    this.chatScrollRatio = stream.scrollTop / max;
    // 距底部 24px 内视为"贴底"（新内容到达时跟随滚到底）
    this.chatAtBottom = stream.scrollTop + stream.clientHeight >= stream.scrollHeight - 24;
  }

  /**
   * 重建 DOM 后调用：
   * - 新内容到达且用户原本贴底 → 滚到底
   * - 用户在上方翻看历史 → 保持原位置（不打断）
   * - force（从日志切回聊天）→ 滚到底
   */
  private restoreChatScroll(): void {
    // 对话空间或一般聊天：两者都有 .chat-stream
    if (this.panelState.centerTab !== 'chat' && !this.panelState.conversationVariantId) return;
    const stream = this.root.querySelector<HTMLElement>('.chat-stream');
    if (!stream) return;
    const count = this.activeStream().length;
    const hasNew = count !== this.lastChatCount;
    this.lastChatCount = count;
    if ((hasNew && this.chatAtBottom) || this.pendingChatForceScroll) {
      this.chatScrollRatio = 1;
      this.pendingChatForceScroll = false;
      this.chatAtBottom = true;
    }
    const max = stream.scrollHeight - stream.clientHeight;
    stream.scrollTop = this.chatScrollRatio * max;
  }

  /** 面板滚动位置快照：按面板序号记录 .panel-body 的 scrollTop（强化/通讯录等列表防刷新回滚）。 */
  private panelScrollTop: number[] = [];

  private capturePanelScroll(): void {
    this.panelScrollTop = [...this.root.querySelectorAll<HTMLElement>('.panel')].map(
      panel => panel.querySelector<HTMLElement>('.panel-body')?.scrollTop ?? 0,
    );
  }

  private restorePanelScroll(): void {
    if (this.panelScrollTop.length === 0) return;
    this.root.querySelectorAll<HTMLElement>('.panel').forEach((panel, i) => {
      const body = panel.querySelector<HTMLElement>('.panel-body');
      if (body && this.panelScrollTop[i] !== undefined) {
        body.scrollTop = this.panelScrollTop[i];
      }
    });
  }

  /** Init 选择界面模式：由当前流程决定（新建 vs 重启/重选），替代从 activeInit 推断。 */
  private initSelectMode(): InitSelectMode {
    return this.pendingRestart ? 'restart' : 'new';
  }

  /** 左侧圆盘当前展示的世界线（轮盘 3 点钟方向的选中项）。 */
  private initSelectedId: string | null = null;

  /** 轮盘局部刷新 API（bindInitStage 装配；页面不在选择态时为 null）。 */
  private initStageApi: { refreshRow(initId: string): void } | null = null;

  private renderInitSelect(): void {
    const context = createUIContext(this.game);
    this.initStageApi = null;
    this.root.innerHTML = renderInitSelect(context, this.initSelectMode(), this.initSelectedId);
    // #app 重建后原锚点（如 Spot hover 的卡片）已脱离文档 → 关闭残留悬浮层，避免离开 Init 后 tooltip 不消失
    this.popovers.retainIfAnchored();
    // Init 选择页也需要 Hover 弹层（同一套事件委托，首次进入即绑定）
    this.popovers.bind();
    this.bindInitStage();
  }

  /** 局部替换左侧详情文案块（不动轮盘 DOM，旋转状态得以保留）。 */
  private replaceInitDetail(): void {
    const copy = this.root.querySelector('.init-orb-copy');
    if (copy) {
      copy.outerHTML = renderInitDetail(createUIContext(this.game), this.initSelectMode(), this.initSelectedId);
    }
    this.bindDetailActions();
  }

  /**
   * Init 选择页交互：世界线卡片像时钟刻度一样沿盘缘环绕巨大圆盘排布。
   * 已显示的 Init 视为一个有序 List，滚轮/点击驱动整组卡片绕盘心旋转，
   * 转到正右方（与详情相邻）的卡片即聚焦项。
   * 约束：
   *   - 元素间相对位置不可破坏：每张卡片持有固定「世界角」i*step，随 spin 整体旋转，永不互相穿越。
   *   - 不可聚焦到空元素：聚焦 = 转至正右方的卡片，始终有卡片就位。
   *   - 滚到 List 边缘元素再继续滚，聚焦跳到另一侧元素（环形 List，spin 环形归一化）。
   * 卡片 DOM 常驻，切换只改 transform/opacity + 局部替换左侧详情，保证过渡连续。
   */
  private bindInitStage(): void {
    const shell = this.root.querySelector<HTMLElement>('.init-select-shell');
    const disc = this.root.querySelector<HTMLElement>('.init-orb-disc');
    const wheelEl = this.root.querySelector<HTMLElement>('.init-wheel');
    if (!shell || !disc || !wheelEl || this.root.querySelectorAll('[data-init-select]').length === 0) {
      this.bindDetailActions();
      return;
    }
    const ids = [...this.root.querySelectorAll<HTMLButtonElement>('[data-init-select]')]
      .map(row => row.dataset.initSelect!);
    const count = ids.length;
    // 盘缘步进角（度）：小间距可容纳更多条目同屏
    const step = Math.min(360 / count, 16);
    // 累积旋转（步数）：卡片 world 角 i*step 固定，随 spin 整体旋转；
    // 聚焦 = 转至正右方的卡片；spin 环形，边缘继续滚则聚焦跳到另一侧，卡片不瞬移。
    let spin = Math.max(0, ids.indexOf(this.initSelectedId ?? ids[0]));
    this.initSelectedId = ids[spin];

    const getRows = () => [...this.root.querySelectorAll<HTMLButtonElement>('[data-init-select]')];

    /** 依当前 spin 沿盘缘排布卡片，返回聚焦卡片下标（正右方）。 */
    const apply = (): number => {
      if (!document.contains(wheelEl)) return spin;
      const d = disc!.getBoundingClientRect();
      const s = shell!.getBoundingClientRect();
      const cx = d.left - s.left + d.width / 2;
      const cy = d.top - s.top + d.height / 2;
      const radius = (d.width / 2) * 0.985;
      const rot = spin * step;

      let focus = spin;
      let bestAbs = Infinity;
      const poses = getRows().map((row, i) => {
        let angle = i * step - rot;
        // 归一化到 [-180, 180] 仅用于背面绘制，不改变卡片相对顺序
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        const abs = Math.abs(angle);
        if (abs < bestAbs) { bestAbs = abs; focus = i; }
        return { row, angle };
      });
      poses.forEach(({ row, angle }, i) => {
        const rad = angle * Math.PI / 180;
        const facing = Math.cos(rad);
        const x = cx + radius * facing;
        const y = cy + radius * Math.sin(rad);
        row.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${angle}deg)`;
        row.style.opacity = facing <= 0.05 ? '0' : String(Math.max(0.08, facing));
        row.style.pointerEvents = facing <= 0.05 ? 'none' : 'auto';
        row.classList.toggle('is-active', i === focus);
      });
      return focus;
    };

    const bindRowClick = (row: HTMLButtonElement) => {
      row.addEventListener('click', () => {
        const i = ids.indexOf(row.dataset.initSelect!);
        if (i !== spin) rotateTo(i, true);
      });
    };

    const rotateTo = (target: number, refreshDetail: boolean) => {
      // 直接让目标卡片聚焦：spin 设为 target，卡片沿固定 world 角整体旋转到该卡片位于正右方
      spin = ((target % count) + count) % count;
      const focus = apply();
      this.initSelectedId = ids[focus];
      if (refreshDetail) this.replaceInitDetail();
    };

    /** 解锁等状态变化后原位同步该卡片内容：不替换节点，保留内联定位与事件绑定。 */
    const refreshRow = (initId: string) => {
      const html = renderInitRow(createUIContext(this.game), initId);
      const old = getRows().find(row => row.dataset.initSelect === initId);
      if (!html || !old) return;
      const template = document.createElement('template');
      template.innerHTML = html.trim();
      const fresh = template.content.firstElementChild as HTMLButtonElement;
      old.className = fresh.className;
      old.innerHTML = fresh.innerHTML;
      apply();
    };
    this.initStageApi = { refreshRow };

    getRows().forEach(bindRowClick);

    wheelEl.parentElement?.addEventListener('wheel', event => {
      event.preventDefault();
      // 连续旋转一格：整组卡片绕盘心转动，相对位置保持；spin 环形，转到 List 边缘元素后继续滚则聚焦跳到另一侧
      spin = ((spin + ((event as WheelEvent).deltaY > 0 ? 1 : -1)) % count + count) % count;
      const focus = apply();
      this.initSelectedId = ids[focus];
      this.replaceInitDetail();
    }, { passive: false });

    // 视差：指针移动时背景层与卡片轻微反向漂移，形成聚焦纵深感
    const onMove = (event: MouseEvent) => {
      if (!document.contains(wheelEl)) {
        shell!.removeEventListener('mousemove', onMove);
        return;
      }
      const rect = shell!.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
      shell!.style.setProperty('--par-x', nx.toFixed(3));
      shell!.style.setProperty('--par-y', ny.toFixed(3));
    };
    shell.addEventListener('mousemove', onMove);
    shell.addEventListener('mouseleave', () => {
      shell.style.setProperty('--par-x', '0');
      shell.style.setProperty('--par-y', '0');
    });

    window.addEventListener('resize', apply);
    apply();
    this.bindDetailActions();
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
        if (this.initSelectedId === initId) {
          this.initStageApi?.refreshRow(initId);
          this.replaceInitDetail();
        } else {
          this.initStageApi?.refreshRow(initId);
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
    this.lastChatCount = 0;
    this.lastStoryFingerprint = null;
    this.chatScrollRatio = 1;
    this.chatAtBottom = true;
    this.pendingChatForceScroll = false;
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
    const convId = this.panelState.conversationVariantId;
    if (!convId) return this.panelState.chatEntries;
    return (this.panelState.studentChats[convId] ??= []);
  }

  /** 记录聊天流条目，维持上限（路由到当前活跃流：一般聊天 / 学生对话空间）。 */
  private pushChat(entry: Omit<ChatEntry, 'id' | 'timestamp'>): void {
    const stream = this.activeStream();
    stream.push({
      ...entry,
      id: this.chatId++,
      timestamp: Date.now(),
    });
    if (stream.length > CHAT_MAX) {
      stream.splice(0, stream.length - CHAT_MAX);
    }
  }

  /**
   * 每次 render 前把当前 Talklet 的演示内容同步进聊天流。
   * 以 `storyId:pageIndex` 指纹去重，覆盖自动展开 / 手动启动 / 推进 / 读档 / 切换 Init 全部入口。
   */
  private syncCurrentStoryToChat(): void {
    const story = this.game.getView().currentStory;
    if (!story) {
      this.lastStoryFingerprint = null;
      return;
    }
    const fingerprint = `${story.storyId}:${story.pageIndex}`;
    if (fingerprint === this.lastStoryFingerprint) return;
    this.lastStoryFingerprint = fingerprint;
    // click 页为纯底部按钮交互页（text 作按钮文案），不进入聊天流
    if (story.page.kind === 'click') return;
    this.pushChat({
      kind: story.page.kind ?? 'talk',
      speaker: story.page.speaker,
      text: story.page.text,
      storyType: story.type,
      align: story.page.align,
      avatar: story.page.avatar,
      side: story.page.side,
      noAvatar: story.page.noAvatar,
    });
  }

  private bindActions(): void {
    this.root.querySelector('#tick-now')?.addEventListener('click', () => {
      this.game.tick();
      this.render();
    });
    this.root.querySelector('#collection-modal')?.addEventListener('click', () => {
      const ctx = createUIContext(this.game);
      this.modal.open({
        title: '图鉴 · Codex',
        body: `
          <section class="codex-section">
            <h2 class="codex-section-title">被动闲聊收集</h2>
            ${renderCollectionBody(ctx)}
          </section>
          <section class="codex-section">
            <h2 class="codex-section-title">色彩收集与管理</h2>
            ${renderColorCodex(ctx)}
          </section>`,
        width: 640,
      });
    });
    this.root.querySelector('#import-datapack')?.addEventListener('click', () => {
      this.importDatapack();
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
      this.exportLog();
    });
    this.root.querySelector('#dump-enh-debug')?.addEventListener('click', () => {
      this.game.dumpEnhancementDebug();
      this.toast.show('Enhancement 条件诊断已写入日志', 'info');
      this.render();
    });
    this.root.querySelector('#save-game')?.addEventListener('click', () => {
      const saved = SaveSystem.save(this.game.save());
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
            this.pendingChatForceScroll = true;
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
        this.pendingChatForceScroll = true;
        this.render();
      });
    });
    // 对话空间返回键：回到一般聊天
    this.root.querySelector('[data-conversation-back]')?.addEventListener('click', () => {
      this.panelState.conversationVariantId = null;
      this.panelState.centerTab = 'chat';
      this.pendingChatForceScroll = true;
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
    this.root.querySelectorAll<HTMLButtonElement>('[data-open-gacha]').forEach(button => {
      button.addEventListener('click', () => this.openGachaModal());
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
      const result = this.game.triggerPassiveStory();
      this.logStoryFailure(result);
      this.render();
    });
    // 底部发送按钮：本质是带发送交互的 Talklet 的演出形态
    this.root.querySelector<HTMLButtonElement>('[data-send]')?.addEventListener('click', () => {
      const result = this.game.clickSend();
      if (result.type === 'completed') {
        // 回显决策由引擎给出（非 click 页 + 有 sendText + 未 muteReply）：
        // 满足时才以"老师"身份发出右侧气泡；click / 静默发送不产生玩家回复气泡
        if (result.echoReply) {
          this.pushChat({ kind: 'talk', speaker: PLAYER_IDENTITY.speaker, text: result.sentText, isPlayer: PLAYER_IDENTITY.isPlayer });
        }
        // 向后吸收的过渡页（推进后自动跳过的纯展示页）同步进聊天流
        for (const view of result.absorbed ?? []) {
          if (view.page.kind === 'click') continue;
          this.pushChat({
            kind: view.page.kind ?? 'talk',
            speaker: view.page.speaker,
            text: view.page.text,
            storyType: view.type,
            align: view.page.align,
            avatar: view.page.avatar,
            side: view.page.side,
            noAvatar: view.page.noAvatar,
          });
        }
      } else if (result.type === 'working') {
        // 多击任务：尚未完成，仅进度条 +1（本次点击不发送、不推进），render() 自动刷新
      } else if (result.type === 'idle' && result.started) {
        // 无剧情时点击触发了被动闲聊
      }
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-story-choice]').forEach(button => {
      button.addEventListener('click', () => {
        const result = this.game.advanceStory(Number(button.dataset.storyChoice));
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

  /**
   * 导入 Mod 压缩包：用户选择 .zip 后遍历其中所有 .json 文件构造 Datapack，
   * 运行时整体替换数据包（reload）并进入新会话。
   */
  private importDatapack(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip,application/x-zip-compressed';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { datapack, jsonFileCount, ignoredCount } = await loadDatapackFromZipFile(file);
        this.game.reload([datapack]);
        // 数据包更换后旧存档 id 可能失效，清除以免下次启动读档报错
        SaveSystem.delete();
        this.started = true;
        this.pendingRestart = false;
        this.game.start();
        this.resetSessionPanel();
        this.game.devLog.record(
          `导入数据包：${datapack.name} v${datapack.version}（${jsonFileCount} 个 json 文件${ignoredCount > 0 ? `，忽略 ${ignoredCount} 个非 json` : ''}）`,
          { source: 'datapack', level: 'success' },
        );
        this.toast.show(
          `已加载 Mod <b>${datapack.name}</b> v${datapack.version}<br><small>${jsonFileCount} 个 json 文件${ignoredCount > 0 ? `，忽略 ${ignoredCount} 个非 json` : ''}</small>`,
          'success',
        );
        this.render();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.game.devLog.record(`导入数据包失败：${message}`, { source: 'datapack', level: 'error' });
        this.toast.show(`导入失败：${message}`, 'error');
      } finally {
        input.remove();
      }
    });
    input.click();
  }

  /** 导出开发日志：devLog 全量 + 运行上下文，下载为 JSON 文件。 */
  private exportLog(): void {
    const payload = this.game.devLog.export({
      frame: this.game.state.totalFrames,
      activeInit: this.game.state.activeInit,
      resources: { ...this.game.state.resources },
      saveVersion: '1.0.0',
    });
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `aronaclicker-log-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.game.devLog.record(`已导出日志（${this.game.getDevLogs().length} 条）`, { source: 'dev', level: 'info' });
    this.render();
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
