import { GameInstance } from '../engine/game-instance';
import { Character, StoryAdvanceResult, StoryStartResult, Resource } from '../engine/types';
import { SaveSystem } from '../save/storage';
import { loadDatapackFromZipFile } from '../data/zip-loader';
import { createUIContext } from './context';
import {
  getTooltipContent,
  getSpotReveal,
  getEnhancementReveal,
  getInitReveal,
  getAreaReveal,
  getStoryReveal,
} from './components/tooltip';
import { renderAppShell, PanelState } from './components/app-shell';
import { renderInitSelect } from './components/init-select';
import { renderEnhancementManager } from './components/enhancements';
import { storyErrorText, ChatEntry } from './components/story';
import { ToastService } from './components/toast';
import { enhPurchaseErrorText, travelErrorText, itemUseErrorText } from './components/errors';
import { ModalManager } from './modal';

const CHAT_MAX = 200;

export class UIController {
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private panelState: PanelState = {
    leftTab: 'area',
    centerTab: 'chat',
    rightTab: 'spot',
    chatEntries: [],
  };
  private chatId = 1;
  private lastChatCount = 0;
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

  constructor(
    private readonly game: GameInstance,
    private readonly root: HTMLElement,
  ) {}

  mount(): void {
    // EventBus 广播 → 揭示条件判断 → 变化则反射到 UI（无需玩家交互才刷新）
    this.game.eventBus.onAny(event => {
      // 生产类高频事件由 refreshLight 覆盖数值，不参与揭示评估
      if (event.type === 'tick' || event.type === 'spotProduced') return;
      this.refreshRevealIfChanged();
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
    for (const story of this.game.registry.stories.values()) {
      fp += `s:${story.id}:${getStoryReveal(ctx, story).stage};`;
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
  private refreshLight(): void {    const view = this.game.getView();
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
    // 交互触发重建前隐藏残留的 hover 弹层（body 级，DOM 重建不会自动触发 mouseout）
    document.getElementById('floating-tooltip')?.classList.remove('is-open');
    // DOM 重建前先捕获当前聊天流的滚动比例
    this.captureChatScroll();
    const context = createUIContext(this.game);
    this.root.innerHTML = renderAppShell(context, this.panelState);
    this.bindPopovers();
    this.bindActions();
    this.restoreChatScroll();
    // 同步揭示指纹，避免下一次事件重复重建
    this.revealFingerprint = this.computeRevealFingerprint();
  }

  /** 聊天流滚动状态：以比例保存，DOM 重建后恢复。 */
  private chatScrollRatio = 1;
  private chatAtBottom = true;
  private pendingChatForceScroll = false;

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
    if (this.panelState.centerTab !== 'chat') return;
    const stream = this.root.querySelector<HTMLElement>('.chat-stream');
    if (!stream) return;
    const count = this.panelState.chatEntries.length;
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

  private renderInitSelect(): void {
    const context = createUIContext(this.game);
    this.root.innerHTML = renderInitSelect(context);

    // 已解锁 → 直接进入（新游戏 / 恢复）
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

    // 购买按钮：先扣费，再进入
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
        this.renderInitSelect(); // 刷新为可进入态
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

  /** 记录聊天流条目，维持上限。 */
  private pushChat(entry: Omit<ChatEntry, 'id' | 'timestamp'>): void {
    this.panelState.chatEntries.push({
      ...entry,
      id: this.chatId++,
      timestamp: Date.now(),
    });
    if (this.panelState.chatEntries.length > CHAT_MAX) {
      this.panelState.chatEntries.splice(0, this.panelState.chatEntries.length - CHAT_MAX);
    }
  }

  /** 剧情开始/推进时把当前页加入聊天历史。 */
  private appendStoryPages(result: StoryStartResult | StoryAdvanceResult, storyType: 'active' | 'passive'): void {
    if (!result.success) return;
    // StoryStartResult 与未完成的 AdvanceResult 携带 story；完成的 AdvanceResult 仅含 storyId。
    if ('story' in result && result.story) {
      this.pushChat({
        kind: 'talk',
        speaker: result.story.page.speaker,
        text: result.story.page.text,
        storyType,
      });
    }
    if ('finished' in result && result.finished) {
      this.pushChat({ kind: 'system', text: '剧情记录完成。' });
    }
  }

  private bindActions(): void {
    this.root.querySelector('#tick-now')?.addEventListener('click', () => {
      this.game.tick();
      this.render();
    });
    this.root.querySelector('#import-datapack')?.addEventListener('click', () => {
      this.importDatapack();
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

    // 剧情
    this.root.querySelectorAll<HTMLButtonElement>('[data-start-story]').forEach(button => {
      button.addEventListener('click', () => {
        const storyId = button.dataset.startStory!;
        const result = this.game.startActiveStory(storyId);
        this.logStoryFailure(result);
        this.appendStoryPages(result, 'active');
        this.render();
      });
    });
    this.root.querySelector<HTMLButtonElement>('[data-trigger-passive-story]')?.addEventListener('click', () => {
      const result = this.game.triggerPassiveStory();
      this.logStoryFailure(result);
      this.appendStoryPages(result, 'passive');
      this.render();
    });
    // 底部发送按钮：本质是带发送交互的 Talklet 的演出形态
    this.root.querySelector<HTMLButtonElement>('[data-send]')?.addEventListener('click', () => {
      const result = this.game.clickSend();
      if (result.type === 'completed') {
        // 玩家点击的回复文案进入聊天流，再推进到下一页
        this.pushChat({ kind: 'talk', speaker: '老师', text: result.sentText, isPlayer: true });
        this.appendStoryPages(result.advance, 'passive');
      } else if (result.type === 'working') {
        // 多击任务：尚未完成，仅进度条 +1（本次点击不发送、不推进），render() 自动刷新
      } else if (result.type === 'idle' && result.started) {
        // 无剧情时点击触发了被动闲聊
        this.pushChat({ kind: 'system', text: '开始了一段新的闲聊。' });
      }
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-story-choice]').forEach(button => {
      button.addEventListener('click', () => {
        const result = this.game.advanceStory(Number(button.dataset.storyChoice));
        this.logStoryFailure(result);
        this.appendStoryPages(result, 'passive');
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

  /**
   * 绑定 body 级浮动弹层（独立于 #app 的 DOM 刷新）。
   * 用事件委托 + 防抖：鼠标在 wrap 上停留一小段时间才显示（避免扫过即弹），
   * 移出 wrap（未进入弹层）后快速隐藏（避免遮挡下方内容）。
   */
  private bindPopovers(): void {
    let tooltipEl = document.getElementById('floating-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'floating-tooltip';
      tooltipEl.className = 'floating-tooltip';
      document.body.appendChild(tooltipEl);
    }

    const GAP = 10;
    const SHOW_DELAY = 80;  // 停留此毫秒才显示（防误触）
    const HIDE_DELAY = 60;  // 移出后快速隐藏（便于查看下方内容）
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const hide = (delay = HIDE_DELAY) => {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        tooltipEl!.classList.remove('is-open');
      }, delay);
    };
    const cancelHide = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };

    const show = (wrap: HTMLElement) => {
      // 防抖：鼠标在 wrap 上停留 SHOW_DELAY 毫秒才生成内容
      if (showTimer) clearTimeout(showTimer);
      showTimer = setTimeout(() => {
        const key = wrap.dataset.tooltip;
        if (!key) return;
        cancelHide();

        const context = createUIContext(this.game);
        const content = getTooltipContent(context, key);
        if (!content) return;

        tooltipEl!.innerHTML = content;
        tooltipEl!.classList.add('is-open');

        const wrapRect = wrap.getBoundingClientRect();
        const popRect = tooltipEl!.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = wrapRect.bottom + 8;
        if (top + popRect.height > vh - GAP) {
          top = wrapRect.top - popRect.height - 8;
          if (top < GAP) top = GAP;
        }
        // 默认右对齐 wrap 右缘（避免覆盖同行左侧内容 / 面板内其他导航）
        let left = wrapRect.right - popRect.width;
        if (left < GAP) left = GAP;
        if (left + popRect.width > vw - GAP) left = vw - GAP - popRect.width;
        tooltipEl!.style.top = `${top}px`;
        tooltipEl!.style.left = `${left}px`;
      }, SHOW_DELAY);
    };

    // 事件委托：mouseover 时若进入 hover-wrap[data-tooltip]，防抖后显示
    this.root.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement;
      const wrap = target.closest<HTMLElement>('.hover-wrap[data-tooltip]');
      if (wrap) show(wrap);
    });
    // mouseout 时：移出 wrap 且未进入另一 wrap → 快速隐藏。
    // tooltip 为 pointer-events:none，鼠标可穿透，不会拦截移向底部内容的动作。
    this.root.addEventListener('mouseout', (event) => {
      const target = event.target as HTMLElement;
      const to = event.relatedTarget as HTMLElement | null;
      const wrap = target.closest<HTMLElement>('.hover-wrap[data-tooltip]');
      if (!wrap) return;
      // 移入另一 wrap → 保持，由对方 mouseover 接管
      if (to && to.closest('.hover-wrap[data-tooltip]')) {
        cancelHide();
        return;
      }
      hide();
    });
  }
}
