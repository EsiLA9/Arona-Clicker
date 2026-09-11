// ============================================================
// arona-clicker/services/story-service.ts — 剧情服务编排层
// 职责：游标持有与访问（存档 / 移动规则） + 对外 API 委托。
// 流程实现已拆至同包模块：story-flow（启动/推进/发送）、story-jump（跳转链）、
// story-replay（重读/守卫）、story-rewards（完结奖励）；通过 StoryRuntime 接入。
// ============================================================

import type { PlayerState } from '../types/state';
import type { BranchGuard, StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { StoryDef, Talklet } from '../../data-services/contracts/story';
import type { SendResult, SendState, StoryAdvanceResult, StoryStartResult, StoryView } from '../contracts/results';
import type { EventBus } from '../../engine/core/event-bus';
import type { StoryCursorCollection } from '../../engine/contracts/story-cursor';
import type { Registry } from '../../data-services/registry/registry';
import type { ConditionSystem } from '../../engine/expression/condition-system';
import type { EffectEngine } from '../../engine/effect/effect-engine';
import type { StoryMutationPort } from '../contracts/mutation';
import { PassivePoolSystem } from './passive-pool-system';
import { StoryCursorState, type StoryCursor } from './story-cursor-state';
import type { RewardsSettlement, StoryRuntime } from './story-context';
import {
  advanceStory,
  clickSend,
  getCurrentStoryView,
  getSendState,
  readyStepIds,
  startStory,
  triggerAffectionPush,
  triggerPassiveStory,
  triggerTailPush,
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
  mutations: StoryMutationPort;
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

  saveCursors(): StoryCursorCollection {
    return {
      global: this.saveCursor(),
      chats: this.saveChatCursors(),
    };
  }

  restoreCursors(collection: StoryCursorCollection | undefined): void {
    if (!collection) {
      this.globalCursor.clear();
      this.chatCursors.clear();
      return;
    }
    this.restoreCursor(collection.global);
    this.restoreChatCursors(collection.chats);
  }

  clearAllCurrentStories(): void {
    this.globalCursor.clear();
    this.chatCursors.clear();
    this.flagsSetThisStory.clear();
    this.lastRewarded.value = null;
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
   * 聊天卡片入口启动（kizuna 羁绊卡片 / 演出浮窗）：goto 重开语义——
   * 清空当前游标（丢弃进行中演出的剩余页），跳过 availableInits / triggerCondition，
   * 已完结剧情亦可正常重新开始（force 跳过 AlreadyCompleted；isReplay 保持 false，
   * 分支自由探索，重复完结奖励走 repeat 评估一般不发放）。
   * 与 clickSend 的 kizuna 处理（story-flow.ts:295-313）一致。
   */
  startCardStory(storyId: string, owner?: string | null): StoryStartResult {
    this.runtime.cursorFor(owner).clear();
    return this.startStory(storyId, 'active', owner, { skipConditions: true, force: true });
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
   * §2 轴 B 台阶推送：就绪队列非空时自动开始队列顶（尾巴强制优先，其后按需求值升序）。
   * 由「进入对话空间」（进入即推）与 clickSend idle（点击必中）两个时机调用。
   */
  triggerAffectionPush(owner: string): StoryStartResult {
    return triggerAffectionPush(this.runtime, owner);
  }

  /**
   * §3 尾巴定向推送：关联剧情完结后立即开始该条尾巴（skipConditions，完结即入口判定）。
   * owner 不匹配 / 已播过 / 游标占用均不触发——尾巴留在就绪队列顶由常规推送点送达。
   */
  triggerTailPush(owner: string, storyId: string): StoryStartResult {
    return triggerTailPush(this.runtime, owner, storyId);
  }

  /**
   * 未读计数（对话空间语义）= 就绪队列条数（尾巴 + 台阶）。
   * 玩家未打开该对话空间时，队列内容视为未读，通讯录徽标据此提示。
   */
  readyStepCount(owner: string): number {
    return readyStepIds(this.runtime, owner).length;
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
