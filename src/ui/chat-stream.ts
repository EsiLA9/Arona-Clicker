// ============================================================
// ui/chat-stream.ts — 聊天流领域逻辑（计数/路由/剧情同步/页级打字与按钮门控）
// 疏散自 controller.ts：把聊天流相关的私有状态与操作收拢到这里，
// 由 controller 持有一个实例并委托。
// ============================================================

import { GameInstance } from '../engine/game-instance';
import type { StoryView, Talklet } from '../engine/types';
import type { ActiveBanner, PanelState, SendGatePhase } from './components/app-shell';
import type { ChatEntry, ChatTextEntry } from './components/story';
import { BANNER_ANIMATION_MS } from './components/story-gate';
import { PLAYER_IDENTITY } from './player';

const CHAT_MAX = 200;

/** 非右侧 talk 页的默认"正在输入"/"想回复"时长（秒）。 */
export const DEFAULT_RHYTHM_SECONDS = 0.9;
/** 自定义节奏时长夹取上限（秒）：防数据笔误冻结聊天流。 */
const MAX_RHYTHM_SECONDS = 10;
/** 门控期间点击底部按钮的加速步长（秒/次）：≥ 阶段剩余时长时一次点击直接击穿。 */
export const ACCELERATE_SECONDS = 0.1*10;
/** 链式连发两页之间的额外停顿（秒）：送达后停一拍，再开始下一页的省略号。 */
const CHAIN_PAUSE_SECONDS = 0.4;

/**
 * 底部按钮门控（§4）：一条按流记账的节奏链。
 * typing = 对方消息未送达（省略号气泡）；pause = 连发停顿拍；thinking = 消息已送达、
 * 按钮"想回复"中（文字未出现）。三阶段内点击底部按钮不推进，仅按 ACCELERATE_SECONDS 递减剩余时长。
 */
interface GateState {
  streamKey: string;
  phase: SendGatePhase;
  /** 阶段结束时间戳（加速 = 直接前移该值并重排计时器）。 */
  endsAt: number;
  timer: ReturnType<typeof setTimeout>;
  /** typing 阶段专用：打字条目所在流、条目 id、到期落下的内容载荷、送达后做节奏决策的页。 */
  stream?: ChatEntry[];
  typingId?: number;
  payload?: Omit<ChatEntry, 'id' | 'timestamp'>;
  page?: Talklet;
}

/** 开幕标题横幅（streamKey → 横幅）：到期自动清除并触发重渲染。 */
interface BannerState {
  title: string;
  /** 呼出时刻：render 重建元素时按此时长换算负 animation-delay 断点续播（不闪动）。 */
  startedAt: number;
  timer: ReturnType<typeof setTimeout>;
}

/** 聊天流管理：维护自增 ID、各流剧情页去重指纹、页级节奏门控，并把条目路由到目标流。 */
export class ChatStream {
  private chatId = 1;
  /** 各流最后同步的剧情页指纹（streamKey → `storyId:pageIndex` | null）。 */
  private streamFingerprints = new Map<string, string | null>();
  /** 进行中的节奏门控（streamKey → gate）。 */
  private gates = new Map<string, GateState>();
  /** 待执行的连发推进（streamKey → 0ms 计时器）。 */
  private autoAdvances = new Map<string, ReturnType<typeof setTimeout>>();
  /** 进行中的开幕标题横幅（streamKey → 横幅）。 */
  private banners = new Map<string, BannerState>();
  /** 节奏阶段流转 / 到期后的重渲染回调（controller 注入）。 */
  onChange: (() => void) | null = null;
  /** 链式连发推进回调（controller 注入）：对 streamKey 的沙盒执行一次 clickSend 单页推进。 */
  onAutoAdvance: ((streamKey: string) => void) | null = null;

  /** 会话重置（新游戏 / 读档 / 重启）：清剧情指纹与门控状态，ID 无需归零。 */
  reset(): void {
    this.streamFingerprints.clear();
    for (const key of [...this.gates.keys()]) this.removeGate(key);
    for (const key of [...this.autoAdvances.keys()]) this.cancelAutoAdvance(key);
    for (const key of [...this.banners.keys()]) this.clearBanner(key);
  }

  /**
   * 呼出开幕标题横幅（openingTitleShown 事件）：写入指定流并在到期后自动清除
   * （onChange 触发重渲染移除 DOM）；同流重复呼出先清旧计时器。
   */
  showBanner(streamKey: string, title: string): void {
    this.clearBanner(streamKey);
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      this.banners.delete(streamKey);
      this.onChange?.();
    }, BANNER_ANIMATION_MS);
    this.banners.set(streamKey, { title, startedAt, timer });
  }

  /** 当前活跃流的开幕横幅快照（无则 null；render 前写入 PanelState.openingBanner）。 */
  activeBanner(panelState: PanelState): ActiveBanner | null {
    const banner = this.banners.get(panelState.conversationVariantId ?? '#global');
    return banner ? { title: banner.title, startedAt: banner.startedAt } : null;
  }

  /** 当前活跃流是否有进行中的开幕横幅（展示/淡出期间阻断该流的剧情推进类点击，见 controller-actions-story）。 */
  bannerBlocking(panelState: PanelState): boolean {
    return this.banners.has(panelState.conversationVariantId ?? '#global');
  }

  /** 清除指定流的开幕横幅（取消计时器）。 */
  private clearBanner(streamKey: string): void {
    const banner = this.banners.get(streamKey);
    if (!banner) return;
    clearTimeout(banner.timer);
    this.banners.delete(streamKey);
  }

  /** 当前活跃聊天流（对话空间打开时 = 该学生的流；否则 = 一般聊天流）。 */
  activeStream(panelState: PanelState): ChatEntry[] {
    const convId = panelState.conversationVariantId;
    if (!convId) return panelState.chatEntries;
    return (panelState.studentChats[convId] ??= []);
  }

  /** 当前活跃流的按钮门控阶段（renderSendButton 据此隐藏回复文案并阻断推进）。 */
  activeGate(panelState: PanelState): SendGatePhase | null {
    return this.gates.get(panelState.conversationVariantId ?? '#global')?.phase ?? null;
  }

  /** 点击加速：当前活跃流门控剩余时间 −0.1s；归零立即完成该阶段（经 onChange 触发重渲染）。 */
  accelerateActiveGate(panelState: PanelState): void {
    const key = panelState.conversationVariantId ?? '#global';
    const gate = this.gates.get(key);
    if (!gate) return;
    clearTimeout(gate.timer);
    const remaining = gate.endsAt - Date.now() - ACCELERATE_SECONDS * 1000;
    if (remaining <= 0) {
      this.fireGate(key);
      return;
    }
    gate.endsAt = Date.now() + remaining;
    gate.timer = setTimeout(() => this.fireGate(key), remaining);
  }

  /** 记录聊天流条目，维持上限（路由到当前活跃流：一般聊天 / 学生对话空间）。 */
  push(panelState: PanelState, entry: Omit<ChatEntry, 'id' | 'timestamp'>): void {
    this.append(this.activeStream(panelState), entry);
  }

  /**
   * 每次 render 前把当前 Talklet 的演示内容同步进聊天流。
   * 以「流 → `storyId:pageIndex`」指纹去重，覆盖自动展开 / 手动启动 / 推进 / 读档 / 切换 Init 全部入口。
   *
   * 多沙盒：对话空间（conversationVariantId 非空）同步该角色独立游标上的当前剧情；
   * 一般聊天（conversationVariantId 空）同步全局游标（active 主线 / 一般闲聊）。
   * 各沙盒并行互不干扰——外部故事不会串入角色流。
   *
   * 页级节奏（§4）：非右侧 talk 页缺省先渲染 0.9s 省略号气泡（`typing` 可覆盖 /
   * 置 0 关闭，上限 10s）；内容送达后按页做节奏决策——无按钮要求的左侧页（无 sendText /
   * 选项 / clickWork）跳过"想回复"自动推进下一页（连发：省略号-发出-省略号-发出），
   * 其余页进入底部按钮"想回复"门控（`thinking` 独立声明，缺省 0.9s）——
   * 两阶段内按钮无文案、不可推进，点击仅加速 0.1s/次。
   */
  syncCurrentStory(panelState: PanelState, game: GameInstance): void {
    const convId = panelState.conversationVariantId;
    const streamKey = convId ?? '#global';
    const story = convId ? game.getStoryView(convId) : game.getView().currentStory;
    if (!story) {
      // 本流剧情清空（完结/打断）：仍在打字的上一页内容立即落流（不丢消息）；门控与连发一并解除
      const gate = this.gates.get(streamKey);
      if (gate?.phase === 'typing') this.deliverTyping(streamKey);
      else if (gate) this.removeGate(streamKey);
      this.cancelAutoAdvance(streamKey);
      this.streamFingerprints.set(streamKey, null);
      return;
    }
    const fingerprint = `${story.storyId}:${story.pageIndex}`;
    if (this.streamFingerprints.get(streamKey) === fingerprint) return;
    this.streamFingerprints.set(streamKey, fingerprint);
    // 同流推进（防御路径：门控期间按钮已阻断推进）：旧页内容立即落流、旧门控与旧连发解除
    const staleGate = this.gates.get(streamKey);
    if (staleGate?.phase === 'typing') this.deliverTyping(streamKey);
    else if (staleGate) this.removeGate(streamKey);
    this.cancelAutoAdvance(streamKey);
    // click 页为纯底部按钮交互页（text 作按钮文案），不进入聊天流
    if (story.page.kind === 'click') return;
    const payload: Omit<ChatEntry, 'id' | 'timestamp'> = {
      kind: story.page.kind ?? 'talk',
      speaker: story.page.speaker,
      text: story.page.text,
      storyType: story.type,
      align: story.page.align,
      avatar: story.page.avatar,
      image: story.page.image,
      side: story.page.side,
      noAvatar: story.page.noAvatar,
      showAvatar: story.page.showAvatar,
    };
    const stream = this.activeStream(panelState);
    const typingSeconds = typingDelayOf(story.page);
    if (typingSeconds <= 0) {
      this.append(stream, payload);
      this.afterDelivery(streamKey, story.page);
      return;
    }
    const typingId = this.append(stream, {
      kind: 'typing',
      speaker: story.page.speaker,
      text: '',
      storyType: story.type,
      side: story.page.side,
      avatar: story.page.avatar,
      noAvatar: story.page.noAvatar,
      showAvatar: story.page.showAvatar,
    });
    this.gates.set(streamKey, {
      streamKey,
      phase: 'typing',
      endsAt: Date.now() + typingSeconds * 1000,
      timer: setTimeout(() => this.fireGate(streamKey), typingSeconds * 1000),
      stream,
      typingId,
      payload,
      page: story.page,
    });
  }

  /** 玩家（老师）回复气泡入流（由 clickSend 回显调用）。 */
  pushPlayerReply(panelState: PanelState, text: string): void {
    this.push(panelState, {
      kind: 'talk',
      speaker: PLAYER_IDENTITY.speaker,
      text,
      isPlayer: PLAYER_IDENTITY.isPlayer,
    });
  }

  /** 定向入流：把条目写进指定学生的聊天流（不路由，供升级提示等后台事件使用）。 */
  pushToVariant(panelState: PanelState, variantId: string, entry: Omit<ChatEntry, 'id' | 'timestamp'>): void {
    this.append((panelState.studentChats[variantId] ??= []), entry);
  }

  /** 向后吸收的过渡页（推进后自动跳过的纯展示页）同步进聊天流（不参与节奏门控）。 */
  pushAbsorbed(panelState: PanelState, views: StoryView[]): void {
    this.appendAbsorbed(this.activeStream(panelState), views);
  }

  /** 定向版过渡页入流（onAutoAdvance 链式推进用：写入来源流，不受当前活跃流影响）。 */
  pushAbsorbedTo(streamKey: string, panelState: PanelState, views: StoryView[]): void {
    const stream = streamKey === '#global'
      ? this.activeStream(panelState)
      : (panelState.studentChats[streamKey] ??= []);
    this.appendAbsorbed(stream, views);
  }

  private appendAbsorbed(stream: ChatEntry[], views: StoryView[]): void {
    for (const view of views) {
      if (view.page.kind === 'click') continue;
      this.append(stream, {
        kind: view.page.kind ?? 'talk',
        speaker: view.page.speaker,
        text: view.page.text,
        storyType: view.type,
        align: view.page.align,
        avatar: view.page.avatar,
        image: view.page.image,
        side: view.page.side,
        noAvatar: view.page.noAvatar,
        showAvatar: view.page.showAvatar,
      });
    }
  }

  /** 当前活跃流的演出专用文本覆盖层。 */
  activeChatTexts(panelState: PanelState): ChatTextEntry[] {
    const convId = panelState.conversationVariantId;
    if (!convId) return panelState.chatTexts;
    return (panelState.studentChatTexts[convId] ??= []);
  }

  /** 清理聊天流全部内容（含演出专用文本覆盖层）。 */
  clearAll(panelState: PanelState): void {
    const stream = this.activeStream(panelState);
    stream.length = 0;
    // 引擎显式清流：该流节奏内容不再需要，解除门控与连发（区别于正常送达的落内容）
    const streamKey = panelState.conversationVariantId ?? '#global';
    this.removeGate(streamKey);
    this.cancelAutoAdvance(streamKey);
    const texts = this.activeChatTexts(panelState);
    texts.length = 0;
  }

  /** 删除全部可变位置的演出文本覆盖层（保留聊天历史）。 */
  clearAllTexts(panelState: PanelState): void {
    const texts = this.activeChatTexts(panelState);
    texts.length = 0;
  }

  /** 添加演出专用文本覆盖层到当前活跃流（同 id 覆盖更新）。 */
  pushChatText(panelState: PanelState, entry: ChatTextEntry): void {
    const texts = this.activeChatTexts(panelState);
    const existing = texts.findIndex(t => t.id === entry.id);
    if (existing >= 0) {
      texts[existing] = entry;
    } else {
      texts.push(entry);
    }
  }

  /** 按临时 id 擦除演出专用文本覆盖层。 */
  clearChatText(panelState: PanelState, id: string): void {
    const texts = this.activeChatTexts(panelState);
    const idx = texts.findIndex(t => t.id === id);
    if (idx >= 0) texts.splice(idx, 1);
  }

  /** 追加条目到指定流：分配自增 id / 时间戳并维持上限。返回新条目 id。 */
  private append(stream: ChatEntry[], entry: Omit<ChatEntry, 'id' | 'timestamp'>): number {
    const id = this.chatId++;
    stream.push({ ...entry, id, timestamp: Date.now() });
    if (stream.length > CHAT_MAX) {
      stream.splice(0, stream.length - CHAT_MAX);
    }
    return id;
  }

  /** 门控计时到期：typing → 落内容并做节奏决策；pause → 连发推进；thinking → 解除门控（按钮文字出现）。 */
  private fireGate(streamKey: string): void {
    const gate = this.gates.get(streamKey);
    if (!gate) return;
    if (gate.phase === 'typing') {
      const page = gate.page;
      this.deliverTyping(streamKey);
      if (page) this.afterDelivery(streamKey, page);
    } else {
      this.removeGate(streamKey);
      if (gate.phase === 'pause') this.scheduleAutoAdvance(streamKey);
    }
    this.onChange?.();
  }

  /** 落内容：解除 typing 门控，打字条目原位替换为真实内容（保序；条目已不在则退化为追加）。 */
  private deliverTyping(streamKey: string): void {
    const gate = this.gates.get(streamKey);
    if (!gate || gate.phase !== 'typing') return;
    this.gates.delete(streamKey);
    clearTimeout(gate.timer);
    if (!gate.stream || gate.typingId === undefined || !gate.payload) return;
    const entry: ChatEntry = { ...gate.payload, id: this.chatId++, timestamp: Date.now() };
    const idx = gate.stream.findIndex(e => e.id === gate.typingId && e.kind === 'typing');
    if (idx >= 0) gate.stream.splice(idx, 1, entry);
    else this.append(gate.stream, gate.payload);
  }

  /** 解除门控（计时取消；typing 条目随流清理或由此处移除）。 */
  private removeGate(streamKey: string): void {
    const gate = this.gates.get(streamKey);
    if (!gate) return;
    this.gates.delete(streamKey);
    clearTimeout(gate.timer);
    if (gate.phase === 'typing' && gate.stream && gate.typingId !== undefined) {
      const idx = gate.stream.findIndex(e => e.id === gate.typingId && e.kind === 'typing');
      if (idx >= 0) gate.stream.splice(idx, 1);
    }
  }

  /** 内容送达后的节奏决策（§4）：无按钮要求的左侧页先停顿一拍再连发下一页；否则进入按钮"想回复"门控。 */
  private afterDelivery(streamKey: string, page: Talklet): void {
    if (chainEligible(page)) {
      const pauseMs = CHAIN_PAUSE_SECONDS * 1000;
      this.gates.set(streamKey, {
        streamKey,
        phase: 'pause',
        endsAt: Date.now() + pauseMs,
        timer: setTimeout(() => this.fireGate(streamKey), pauseMs),
      });
      return;
    }
    const thinkingMs = thinkingDelayOf(page) * 1000;
    if (thinkingMs <= 0 || this.gates.has(streamKey)) return;
    this.gates.set(streamKey, {
      streamKey,
      phase: 'thinking',
      endsAt: Date.now() + thinkingMs,
      timer: setTimeout(() => this.fireGate(streamKey), thinkingMs),
    });
  }

  /** 连发推进：0ms 后交还 controller 对该流执行一次 clickSend（指纹守卫防外部剧情变动竞态）。 */
  private scheduleAutoAdvance(streamKey: string): void {
    const fingerprint = this.streamFingerprints.get(streamKey);
    const prev = this.autoAdvances.get(streamKey);
    if (prev) clearTimeout(prev);
    this.autoAdvances.set(streamKey, setTimeout(() => {
      this.autoAdvances.delete(streamKey);
      if (this.streamFingerprints.get(streamKey) !== fingerprint) return;
      this.onAutoAdvance?.(streamKey);
    }, 0));
  }

  /** 取消待执行的连发推进（剧情清空 / 会话重置 / 指纹被外部推进）。 */
  private cancelAutoAdvance(streamKey: string): void {
    const timer = this.autoAdvances.get(streamKey);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.autoAdvances.delete(streamKey);
  }
}

/** 页级"正在输入"延迟（秒）：缺省 = 非右侧 talk 页默认 0.9s；0 = 显式关闭；自定义夹取上限 10s。 */
function typingDelayOf(page: Talklet): number {
  if (!typingEligible(page)) return 0;
  const declared = page.typing;
  if (declared === undefined) return DEFAULT_RHYTHM_SECONDS;
  return Math.min(Math.max(declared, 0), MAX_RHYTHM_SECONDS);
}

/** 页级"想回复"延迟（秒）：资格与 typing 相同；时长独立声明（thinking），缺省 0.9s。 */
function thinkingDelayOf(page: Talklet): number {
  if (!typingEligible(page)) return 0;
  const declared = page.thinking;
  if (declared === undefined) return DEFAULT_RHYTHM_SECONDS;
  return Math.min(Math.max(declared, 0), MAX_RHYTHM_SECONDS);
}

/** 节奏资格谓词：talk 页、非羁绊卡片页、非右侧（玩家/对话方侧）。 */
function typingEligible(page: Talklet): boolean {
  if ((page.kind ?? 'talk') !== 'talk') return false; // narration / click 忽略
  if (page.kizuna) return false;                     // 羁绊卡片页忽略
  if ((page.side ?? 'left') === 'right') return false; // 右侧无"对方在打字"语义
  return true;
}

/**
 * 链式连发谓词（§4）：左侧 talk 页且无任何按钮要求——无回复文案（sendText）、
 * 无选项、无按动次数（clickWork）。命中页送达后跳过"想回复"阶段，自动推进下一页，
 * 形成"省略号-发出-省略号-发出"的连发节奏，直到需要玩家接话的页为止。
 */
function chainEligible(page: Talklet): boolean {
  return typingEligible(page)
    && !page.sendText?.trim()
    && (page.choices?.length ?? 0) === 0
    && !page.clickWork;
}
