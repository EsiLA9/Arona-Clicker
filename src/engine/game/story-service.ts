// ============================================================
// engine/game/story-service.ts — 剧情服务编排层
// 职责：游标持有与访问（存档 / 移动规则） + 对外 API 委托。
// 流程实现已拆至同包模块：story-flow（启动/推进/发送）、story-jump（跳转链）、
// story-replay（重读/守卫）、story-rewards（完结奖励）；通过 StoryRuntime 接入。
// ============================================================

import type { PlayerState } from '../types/state';
import type { BranchGuard, StoryDef, StoryEntryDef, Talklet } from '../types/entities';
import type { SendResult, SendState, StoryAdvanceResult, StoryStartResult, StoryView } from '../types/results';
import type { EventBus } from '../core/event-bus';
import type { Registry } from '../registry/registry';
import type { ConditionSystem } from '../expression/condition-system';
import type { EffectEngine } from '../effect/effect-engine';
import { StateMutationService } from '../system/state-mutation-service';
import { PassivePoolSystem } from '../system/passive-pool-system';
import { StoryCursorState, type StoryCursor } from './story-cursor-state';
import type { RewardsSettlement, StoryRuntime } from './story-context';
import {
  advanceStory,
  clickSend,
  getCurrentStoryView,
  getSendState,
  startStory,
  triggerAffectionPush,
  triggerPassiveStory,
} from './story-flow';
import { guardPrereqsMet, replayStory } from './story-replay';

export type { StoryCursor };

/** 聊天沙盒 key：`variant:<owner>`（owner 为 null 时无沙盒，走全局游标）。 */
function chatKey(owner: string): string {
  return `variant:${owner}`;
}

export interface StoryServiceOptions {
  registry: Registry;
  conditionSystem: ConditionSystem;
  effectEngine: EffectEngine;
  mutations: StateMutationService;
  eventBus: EventBus;
  /** 被动闲聊池系统：树状抽取 + reactor 反射 gate。 */
  passivePools: PassivePoolSystem;
  /** 读取当前 PlayerState（GameInstance 持有单一状态对象）。 */
  getState: () => PlayerState;
  /** Story 自身要求移动 Area（travelToArea effect），不受玩家移动限制。checkAdjacency=false 跳过拓扑。 */
  travelToArea: (areaId: string, allowDuringStory?: boolean, checkAdjacency?: boolean) => { success: boolean; error?: string; areaId?: string };
}

type TravelResult = ReturnType<StoryServiceOptions['travelToArea']>;

export class StoryService {
  /** 全局游标：active 主线 / 一般闲聊（owner 为空时使用）。 */
  private globalCursor = new StoryCursorState();
  /** 聊天沙盒游标：按 owner（VariantId）分区，各角色对话空间并行互不打断。 */
  private chatCursors = new Map<string, StoryCursorState>();
  /**
   * 待收尾的羁绊尾巴（§3）：key = VariantId，value = 关联聊天消息 id。
   * 纯运行时状态（不持久化）：剧情完成前退出应用则 pending 丢失——消息保持未读、
   * 卡片可重新点击，流程重走（无奖励丢失，奖励在尾巴结束的 markChatRead 才结算）。
   */
  private pendingKizunaTails = new Map<string, string>();
  /** 本次剧情播放期间经 Talklet/选项效果设置的 flag（完成时随 storyRewarded 通知 UI）。 */
  private flagsSetThisStory = new Set<string>();
  /** applyCompletionReward 的结算记录（供完成时发出 storyRewarded 事件）。 */
  private lastRewarded: { value: RewardsSettlement } = { value: null };
  /** 子模块（story-flow / jump / replay / rewards）的共享运行时视图。 */
  private readonly runtime: StoryRuntime;

  constructor(private readonly opts: StoryServiceOptions) {
    this.runtime = {
      registry: opts.registry,
      conditionSystem: opts.conditionSystem,
      effectEngine: opts.effectEngine,
      mutations: opts.mutations,
      eventBus: opts.eventBus,
      passivePools: opts.passivePools,
      travelToArea: opts.travelToArea,
      getState: () => this.state,
      cursorFor: owner => this.cursorFor(owner),
      entryById: storyId => this.entryById(storyId),
      storyOf: entry => this.storyOf(entry),
      currentPage: cur => this.currentPage(cur),
      hasCompletedStory: storyId => this.hasCompletedStory(storyId),
      getView: owner => this.getCurrentStoryView(owner),
      guardPrereqsMet: guard => this.guardPrereqsMet(guard),
      hasPendingKizunaTail: owner => this.pendingKizunaTails.has(owner),
      flagsSetThisStory: this.flagsSetThisStory,
      lastRewarded: this.lastRewarded,
    };
  }

  private get state(): PlayerState {
    return this.opts.getState();
  }

  /**
   * 解析目标游标：owner 非空 → 该聊天沙盒（惰性创建）；否则 → 全局游标。
   */
  private cursorFor(owner?: string | null): StoryCursorState {
    if (owner != null) {
      const key = chatKey(owner);
      let cur = this.chatCursors.get(key);
      if (!cur) {
        cur = new StoryCursorState();
        this.chatCursors.set(key, cur);
      }
      return cur;
    }
    return this.globalCursor;
  }

  // --- 游标访问（GameInstance / 存档 / 移动规则使用） ---

  getCurrentStoryId(owner?: string | null): string | null {
    return this.cursorFor(owner).currentStoryEntryId;
  }

  /** 当前实际播放的 Story.id（跳转链中可变；无进行中剧情 = null）。 */
  getCurrentStoryDefId(owner?: string | null): string | null {
    return this.cursorFor(owner).currentStoryDefId;
  }

  /** 当前 Entry 跳转链是否经过该 Story（供 visitedStoryInChain 条件评估）。 */
  isVisitedInChain(storyId: string): boolean {
    return this.globalCursor.visitedStoryIds.includes(storyId);
  }

  /** 存档：导出全局游标快照。 */
  saveCursor(): StoryCursor {
    return this.globalCursor.save();
  }

  /** 存档：导出全部聊天沙盒游标（key → StoryCursor）。 */
  saveChatCursors(): Record<string, StoryCursor> {
    const out: Record<string, StoryCursor> = {};
    for (const [key, cur] of this.chatCursors) {
      if (!cur.empty) out[key] = cur.save();
    }
    return out;
  }

  /** 读档：恢复全局游标（兼容旧档缺失的新字段）。 */
  restoreCursor(cursor: StoryCursor): void {
    this.globalCursor.restore(cursor);
  }

  /** 读档：恢复聊天沙盒游标。 */
  restoreChatCursors(map: Record<string, StoryCursor> | undefined): void {
    this.chatCursors.clear();
    if (!map) return;
    for (const [key, cursor] of Object.entries(map)) {
      const cur = new StoryCursorState();
      cur.restore(cursor);
      this.chatCursors.set(key, cur);
    }
  }

  clearCurrentStory(owner?: string | null): void {
    this.cursorFor(owner).clear();
  }

  /** 当前是否有阻塞移动的剧情演出（active，或 passive 声明 leaveArea:false）。 */
  isBlockingMovement(owner?: string | null): boolean {
    const cur = this.cursorFor(owner);
    if (cur.currentStoryEntryId === null) return false;
    const entry = this.entryById(cur.currentStoryEntryId);
    if (!entry) return false;
    if (entry.type !== 'passive') return true;
    return entry.leaveArea === false;
  }

  /** 移动出 Area 时打断正在播放的 PassiveStory；声明 interruptible:false 的闲聊不被打断。 */
  clearPassiveIfPlaying(owner?: string | null): void {
    const cur = this.cursorFor(owner);
    if (cur.currentStoryEntryId === null) return;
    const currentEntry = this.entryById(cur.currentStoryEntryId);
    if (currentEntry?.type === 'passive' && currentEntry.interruptible !== false) cur.clear();
  }

  hasCompletedStory(storyId: string): boolean {
    return this.state.storyLog.some(story => story.storyId === storyId);
  }

  // --- 公开 API（GameInstance 门面委托） ---

  startActiveStory(storyId: string, owner?: string | null): StoryStartResult {
    return this.startStory(storyId, 'active', owner);
  }

  /**
   * 聊天卡片入口启动（kizuna 羁绊卡片 / 演出浮窗）： 
   * 清空当前游标（丢弃进行中演出的剩余页，goto 语义），跳过 availableInits / triggerCondition，
   * 但尊重单次完成态（AlreadyCompleted 拒绝）。
   * 与 clickSend 的 kizuna 处理（story-flow.ts:295-313）一致。
   */
  startCardStory(storyId: string, owner?: string | null): StoryStartResult {
    this.runtime.cursorFor(owner).clear();
    return this.startStory(storyId, 'active', owner, { skipConditions: true });
  }

  /** @see story-flow.startStory */
  startStory(storyId: string, expectedType: 'active' | 'passive', owner?: string | null, opts?: { force?: boolean; skipConditions?: boolean }): StoryStartResult {
    return startStory(this.runtime, storyId, expectedType, owner, opts);
  }

  /** @see story-flow.triggerPassiveStory */
  triggerPassiveStory(initId: string = this.state.activeInit, owner?: string | null): StoryStartResult {
    return triggerPassiveStory(this.runtime, initId, owner);
  }

  /**
   * §2 轴 B 台阶推送：就绪队列非空时自动开始队列顶的台阶剧情。
   * 由「进入对话空间」（进入即推）与 clickSend idle（点击必中）两个时机调用。
   */
  triggerAffectionPush(owner: string): StoryStartResult {
    return triggerAffectionPush(this.runtime, owner);
  }

  /**
   * §3 消息羁绊卡片入口：登记 pendingKizunaTail 后启动关联剧情。
   * 与 startCardStory 同语义（跳过场景/条件判定，尊重单次完成态）。
   * 无尾巴的消息（剧情完成即结束）在卡片点击时即标记已读；有尾巴的留待尾巴收尾。
   */
  startMessageKizuna(messageId: string, owner: string): StoryStartResult {
    const message = this.registry.chatMessages.get(messageId);
    if (!message?.kizunaStoryId) return { success: false, storyId: messageId, error: 'NotFound' };
    const result = this.startCardStory(message.kizunaStoryId, owner);
    if (result.success) {
      this.pendingKizunaTails.set(owner, messageId);
      if (!message.kizunaTail?.length) this.mutations.markChatRead(messageId);
    }
    return result;
  }

  /** 该角色是否挂着待收尾的羁绊尾巴；返回关联聊天消息 id（无 pending = null）。 */
  getPendingKizunaTail(owner: string): string | null {
    return this.pendingKizunaTails.get(owner) ?? null;
  }

  /**
   * §3 尾巴收尾：尾巴展示完由 UI 调用——markChatRead（内含 affectionExpReward 结算）
   * + 清除 pending。该次聊天至此才标记彻底结束。
   */
  completeKizunaTail(owner: string): void {
    const messageId = this.pendingKizunaTails.get(owner);
    if (!messageId) return;
    this.pendingKizunaTails.delete(owner);
    this.mutations.markChatRead(messageId);
  }

  /** @see story-replay.replayStory */
  replayStory(storyId: string, owner?: string | null): StoryStartResult {
    return replayStory(this.runtime, storyId, owner);
  }

  /** @see story-flow.advanceStory */
  advanceStory(choiceIndex?: number, owner?: string | null): StoryAdvanceResult {
    return advanceStory(this.runtime, choiceIndex, owner);
  }

  /** @see story-flow.getSendState */
  getSendState(owner?: string | null): SendState {
    return getSendState(this.runtime, owner);
  }

  /** @see story-flow.clickSend */
  clickSend(owner?: string | null): SendResult {
    return clickSend(this.runtime, owner);
  }

  /** @see story-flow.getCurrentStoryView */
  getCurrentStoryView(owner?: string | null): StoryView | null {
    return getCurrentStoryView(this.runtime, owner);
  }

  // --- 内部 ---

  /** 通过对外故事 id（Entry.id）解析触发入口。 */
  private entryById(storyId: string): StoryEntryDef | undefined {
    return this.registry.storyEntries.get(storyId);
  }

  /** 通过 Entry 的 storyId 重定向到纯演出 Story（初始 Story）。 */
  private storyOf(entry: StoryEntryDef): StoryDef | undefined {
    return this.registry.stories.get(entry.storyId);
  }

  /** 当前游标指向的 Talklet（无进行中剧情或无页时 = undefined）。 */
  private currentPage(cur: StoryCursorState): Talklet | undefined {
    if (cur.currentStoryEntryId === null) return undefined;
    const defId = cur.currentStoryDefId ?? this.entryById(cur.currentStoryEntryId)?.storyId;
    const story = defId ? this.registry.stories.get(defId) : undefined;
    return story?.talklets[cur.currentStoryPageIndex];
  }

  /** 分歧点准入守卫：前置阅读是否全部满足。talkletIndex = -1 表示要求整条 Story 全部已读。 */
  private guardPrereqsMet(guard: BranchGuard): boolean {
    return guardPrereqsMet(this.runtime, guard);
  }

  private get registry() {
    return this.opts.registry;
  }

  private get conditionSystem() {
    return this.opts.conditionSystem;
  }

  private get effectEngine() {
    return this.opts.effectEngine;
  }

  private get mutations() {
    return this.opts.mutations;
  }
}
