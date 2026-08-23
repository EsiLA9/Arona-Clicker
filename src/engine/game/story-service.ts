import {
  type StoryDef,
  type StoryEntryDef,
  type Talklet,
  type StoryChoice,
  type PassiveStoryEntry,
  type BranchGuard,
} from '../types/entities';
import type { Effect } from '../types/expression';
import type { PlayerState, CompletedStory } from '../types/state';
import type { GameEvent } from '../types/events';
import type { EventBus } from '../core/event-bus';
import { type SendState, type SendResult, type StoryStartResult, type StoryAdvanceResult, type StoryView } from '../types/results';
import { Registry } from '../registry/registry';
import { ConditionSystem } from '../expression/condition-system';
import { EffectEngine } from '../effect/effect-engine';
import { StateMutationService } from '../system/state-mutation-service';
import { PassivePoolSystem } from '../system/passive-pool-system';
import { getAtPath, isStr } from '../extra/index';
import { StoryCursorState, type StoryCursor } from './story-cursor-state';

export const MAX_JUMP_DEPTH = 32;

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

/** 由 Talklet.clickWork 滚随机点击总次数：base + 随机偏移（0..rand-1），rand 缺省/<=0 则恒 base。 */
function rollClickWorkTotal(base: number, rand?: number): number {
  if (!rand || rand <= 0) return base;
  return base + Math.floor(Math.random() * rand);
}

/** 页/选项是否为回显页面（把 sentText 以「老师」气泡回显到聊天流）。 */
function shouldEchoReply(page: Talklet): boolean {
  return page.kind !== 'click' && !page.muteReply && !!page.sendText;
}

export class StoryService {
  /** 全局游标：active 主线 / 一般闲聊（owner 为空时使用）。 */
  private globalCursor = new StoryCursorState();
  /** 聊天沙盒游标：按 owner（VariantId）分区，各角色对话空间并行互不打断。 */
  private chatCursors = new Map<string, StoryCursorState>();

  /** applyCompletionReward 的结算记录（供完成时发出 storyRewarded 事件）。 */
  private lastRewarded: { source: 'first' | 'repeat' | 'conditional'; effects: Effect[] } | null = null;
  /** 本次剧情播放期间经 Talklet/选项效果设置的 flag（完成时随 storyRewarded 通知 UI）。 */
  private flagsSetThisStory = new Set<string>();

  constructor(private readonly opts: StoryServiceOptions) {}

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

  startActiveStory(storyId: string): StoryStartResult {
    return this.startStory(storyId, 'active');
  }

  /**
   * Pick one eligible passive story via the pool system (tree draw + reactor gates).
   * @param initId 当前世界线
   * @param owner 壁垒：仅抽取归属该 VariantId 的闲聊（对话空间）；省略/null/'' = 全局闲聊。
   */
  triggerPassiveStory(initId: string = this.state.activeInit, owner?: string | null): StoryStartResult {
    const cur = this.cursorFor(owner);
    // 并行双游标：本沙盒已有进行中故事 → 拒绝（不打断他人，也不重抽）。
    // owner 为空时全局游标进行中（如 active 主线）同样拒绝，避免覆盖。
    if (!cur.empty) return { success: false, error: 'AlreadyActive' };

    const selectedId = this.opts.passivePools.pick(this.state, (entry) => {
      if (entry.weight <= 0) return false;
      if (entry.availableInits.length > 0 && !entry.availableInits.includes(initId)) return false;
      if (entry.triggerCondition && !this.conditionSystem.evaluateGroup(entry.triggerCondition, this.state)) return false;
      if (!entry.repeatable && this.hasCompletedStory(entry.storyId)) return false;
      return true;
    }, {
      owner: owner ?? null,
      cooldowns: this.state.passiveCooldowns ?? {},
      blocks: this.state.studentBlocks ?? {},
    });

    if (!selectedId) return { success: false, error: 'NoAvailableStory' };
    return this.startStory(selectedId, 'passive', owner);
  }

  /**
   * 重阅读入口：从 StoryEntry 重新阅读关联的 Story 链。
   * 与 startStory 的区别：
   *   - 仅检查 entry.replayable 与无进行中剧情，不受 triggerCondition / availableInits / AlreadyCompleted 限制；
   *   - 进入重阅读模式：推进到受 branchGuards 保护的分歧跳转时，
   *     若玩家 storyReadLogs 中缺乏指定前置阅读记录，则拒绝（BranchGuardDenied）。
   */
  replayStory(storyId: string, owner?: string | null): StoryStartResult {
    const entry = this.entryById(storyId);
    if (!entry) return { success: false, storyId, error: 'NotFound' };
    if (!entry.replayable) return { success: false, storyId, error: 'NotReplayable' };
    const cur = this.cursorFor(owner);
    if (!cur.empty) return { success: false, storyId, error: 'AlreadyActive' };
    const story = this.storyOf(entry);
    if (!story || story.talklets.length === 0) return { success: false, storyId, error: 'NotFound' };

    this.beginStory(cur, entry, story, true);
    return { success: true, story: this.getCurrentStoryView(owner)! };
  }

  advanceStory(choiceIndex?: number, owner?: string | null): StoryAdvanceResult {
    const cur = this.cursorFor(owner);
    if (cur.currentStoryEntryId === null) return { success: false, error: 'NoActiveStory' };
    const entry = this.entryById(cur.currentStoryEntryId);
    if (!entry) {
      cur.clear();
      return { success: false, error: 'NotFound' };
    }
    const story = this.storyOf(entry);
    const defId = cur.currentStoryDefId ?? entry.storyId;
    const def = this.registry.stories.get(defId);
    if (!story || !def) {
      cur.clear();
      return { success: false, error: 'NotFound' };
    }

    const page = def.talklets[cur.currentStoryPageIndex];
    if (!page) {
      cur.clear();
      return { success: false, storyId: def.id, error: 'NotFound' };
    }

    const choices = page.choices ?? [];
    let selectedChoice: StoryChoice | undefined;
    if (choices.length > 0) {
      if (choiceIndex === undefined) {
        return { success: false, storyId: def.id, error: 'ChoiceRequired' };
      }
      if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= choices.length) {
        return { success: false, storyId: def.id, error: 'InvalidChoice' };
      }
      selectedChoice = choices[choiceIndex];
      if (selectedChoice.condition && !this.conditionSystem.evaluateGroup(selectedChoice.condition, this.state)) {
        return { success: false, storyId: def.id, error: 'ChoiceConditionNotMet' };
      }
      cur.currentStoryChoiceIndex = choiceIndex;
    } else if (choiceIndex !== undefined) {
      return { success: false, storyId: def.id, error: 'InvalidChoice' };
    }

    // 解析跳转目标：选项级优先于 Talklet 级（提前到点击防护之前，供防护判断）。
    const jumpTarget = selectedChoice?.jumpToStory ?? page.jumpToStory;
    const jumpMode = (selectedChoice?.jumpMode ?? page.jumpMode) ?? 'goto';

    // 点击需求防护：click / clickWork 页若带 jumpToStory，或推进后会离开本 Story
    // （Story 末尾：insert 弹栈返回调用方 / goto 链完结），必须先经 clickSend 完成点击确认。
    const clickWorkDef = page.clickWork ?? (page.kind === 'click' ? { base: 1 } : undefined);
    const willLeaveStory = !!jumpTarget || cur.currentStoryPageIndex + 1 >= def.talklets.length;
    if (willLeaveStory && choices.length === 0 && clickWorkDef
        && (!cur.talkletClickWork || cur.talkletClickWork.done <= cur.talkletClickWork.total)) {
      return { success: false, storyId: def.id, error: 'ClickRequired' };
    }

    // 重阅读模式：分歧点准入守卫检查（在效果应用之前，拒绝时不产生任何副作用）。
    if (jumpTarget && cur.isReplay) {
      const guard = entry.branchGuards?.find(g => g.storyId === jumpTarget);
      if (guard && !this.guardPrereqsMet(guard)) {
        return { success: false, storyId: def.id, error: 'BranchGuardDenied', denialMessage: guard.denialMessage };
      }
    }

    if (page.effects) {
      this.trackFlagsAndApply(page.effects);
    }
    if (selectedChoice?.effects) {
      this.trackFlagsAndApply(selectedChoice.effects);
    }
    // 阅读日志：记录离开页 + 所选选项（按 Story.id 记）
    this.mutations.recordStoryRead(def.id, cur.currentStoryPageIndex, selectedChoice ? choiceIndex : undefined);

    // 跳转：goto / insert
    if (jumpTarget) {
      return this.performJump(cur, jumpTarget, jumpMode, def, owner);
    }

    // 正常推进
    cur.currentStoryPageIndex += 1;
    // 已离开上一页 → 重置点击工作进度与选项文本确认（下一页若需要会在 getSendState 中重新 roll）
    cur.talkletClickWork = null;
    cur.choiceTextConfirmed = false;
    if (cur.currentStoryPageIndex < def.talklets.length) {
      // 阅读日志：新页已显示
      this.mutations.recordStoryRead(def.id, cur.currentStoryPageIndex);
      return { success: true, finished: false, story: this.getCurrentStoryView(owner)! };
    }

    // 本 Story 播完：insert 返回 or Entry 完结
    return this.resolveStoryEnd(cur, def, owner);
  }

  /**
   * 查询底部"回复按钮"的当前状态。
   * 该按钮本质是聊天流中的一条 Talklet；玩家点击它推进剧情。
   */
  getSendState(owner?: string | null): SendState {
    const cur = this.cursorFor(owner);
    // 无进行中剧情 → idle（点击可触发 PassiveTalk）
    if (cur.currentStoryEntryId === null) return { mode: 'idle', reason: 'noStory' };
    const entry = this.entryById(cur.currentStoryEntryId);
    const defId = cur.currentStoryDefId ?? entry?.storyId;
    const story = defId ? this.registry.stories.get(defId) : undefined;
    const page = story?.talklets[cur.currentStoryPageIndex];
    if (!entry || !story || !page) return { mode: 'idle', reason: 'noStory' };
    // click 页：纯底部按钮交互（text/sendText 作按钮文案），不提供选项
    const isClick = page.kind === 'click';
    // 当前 Talklet 有选项 → 回复按钮让位给选项
    if (!isClick && (page.choices ?? []).length > 0) {
      cur.talkletClickWork = null;
      return { mode: 'choice', confirmed: cur.choiceTextConfirmed };
    }

    // 点击工作：当前页无需求 → 清理残留；有需求且未初始化 → roll 随机总次数。
    const clickWork = page.clickWork ?? (isClick ? { base: 1 } : undefined);
    if (!clickWork) {
      cur.talkletClickWork = null;
    } else if (!cur.talkletClickWork) {
      cur.talkletClickWork = { total: rollClickWorkTotal(clickWork.base, clickWork.rand), done: 0 };
    }

    return {
      mode: 'advance',
      storyId: entry.id,
      pageIndex: cur.currentStoryPageIndex,
      text: isClick ? (page.sendText ?? page.text ?? '') : (page.sendText ?? ''),
      // 进度显示 clamp 到 total：已确认态（done = total + 1）在 UI 上显示为填满。
      clickWork: cur.talkletClickWork
        ? { total: cur.talkletClickWork.total, done: Math.min(cur.talkletClickWork.done, cur.talkletClickWork.total) }
        : undefined,
    };
  }

  /**
   * 玩家点击一次回复按钮。
   * - 剧情演出中：直接推进（advanceStory），并执行当前页效果
   * - 无剧情：尝试按当前场景随机抽取并开始一条 PassiveTalk
   *
   * 推进后若到达的页无交互需求（非 click、无选项、无 sendText、无 clickWork），
   * 会自动继续推进（向后吸收）直到下一个需要交互的页或剧情结束。
   */
  clickSend(owner?: string | null): SendResult {
    const state = this.getSendState(owner);
    const cur = this.cursorFor(owner);

    if (state.mode === 'choice') {
      // choice 页 text 阻塞：首次点击仅确认文本（不推进剧情），UI 随后渲染选项。
      if (!state.confirmed) cur.choiceTextConfirmed = true;
      return { type: 'choice' };
    }

    if (state.mode === 'idle') {
      const result = this.triggerPassiveStory(undefined, owner);
      if (result.success) return { type: 'idle', started: true };
      return { type: 'idle', started: false, error: result.error };
    }

    const sentText = state.text;

    // 回显决策（引擎侧、数据驱动）：由被点击页的 kind/muteReply/sendText 决定
    const echoedPage = this.currentPage(cur);
    const echoReply = !!echoedPage && shouldEchoReply(echoedPage);

    // 多击任务：前 total 次点击从左往右填充进度条（最后一次填满 100%），
    if (state.clickWork) {
      const total = state.clickWork.total;
      const done = state.clickWork.done + 1;
      if (total > 1 && done <= total) {
        cur.talkletClickWork = { total, done };
        return { type: 'working', storyId: state.storyId, pageIndex: state.pageIndex, clicksDone: done, clicksTotal: total };
      }
      cur.talkletClickWork = { total, done: total + 1 };
    }

    const advance = this.advanceStory(undefined, owner);

    const absorbed: StoryView[] = [];
    const finished = advance.success && 'finished' in advance ? advance.finished : false;

    return {
      type: 'completed',
      storyId: state.storyId,
      finished,
      sentText,
      echoReply,
      advance,
      absorbed,
    };
  }

  /**
   * 启动一个剧情（active 或 passive）。ActiveStory 可打断正在播放的 PassiveStory。
   * 返回 StoryStartResult；GameInstance 在进入 Init 自动展开 startStoryId 时复用。
   * @param owner 指定目标沙盒：非空 → 聊天沙盒；省略/null → 全局游标。
   */
  startStory(storyId: string, expectedType: 'active' | 'passive', owner?: string | null, force?: boolean): StoryStartResult {
    const cur = this.cursorFor(owner);
    if (!cur.empty) {
      const currentEntry = cur.currentStoryEntryId ? this.entryById(cur.currentStoryEntryId) : undefined;
      if (expectedType === 'active') {
        if (currentEntry?.type === 'passive') {
          cur.clear();
          // 继续启动 ActiveStory
        } else {
          return { success: false, storyId, error: 'AlreadyActive' };
        }
      } else if (force && currentEntry?.type === 'passive') {
        // 强制模式（Trigger 驱动的系统事件剧情）：打断已有被动闲聊再启动新剧情
        cur.clear();
      } else {
        return { success: false, storyId, error: 'AlreadyActive' };
      }
    }
    const entry = this.entryById(storyId);
    if (!entry) return { success: false, storyId, error: 'NotFound' };
    if (entry.type !== expectedType) return { success: false, storyId, error: 'WrongStoryType' };
    const story = this.storyOf(entry);
    if (!story || story.talklets.length === 0) return { success: false, storyId, error: 'NotFound' };
    if (entry.availableInits.length > 0 && !entry.availableInits.includes(this.state.activeInit)) {
      return { success: false, storyId, error: 'ConditionNotMet' };
    }
    if (entry.triggerCondition && !this.conditionSystem.evaluateGroup(entry.triggerCondition, this.state)) {
      return { success: false, storyId, error: 'ConditionNotMet' };
    }
    const repeatable = entry.type === 'passive' ? entry.repeatable : false;
    // force 模式（Trigger 驱动的系统级剧情）跳过 repeatable/已读限制，
    // 确保进入天台等区域事件能稳定触发剧情，即使该剧情此前已播放过。
    if (!repeatable && !force && this.hasCompletedStory(story.id)) {
      return { success: false, storyId, error: 'AlreadyCompleted' };
    }

    this.beginStory(cur, entry, story, false);
    return { success: true, story: this.getCurrentStoryView(owner)! };
  }

  getCurrentStoryView(owner?: string | null): StoryView | null {
    const cur = this.cursorFor(owner);
    if (cur.currentStoryEntryId === null) return null;
    const entry = this.entryById(cur.currentStoryEntryId);
    const defId = cur.currentStoryDefId ?? entry?.storyId;
    const story = defId ? this.registry.stories.get(defId) : undefined;
    const page = story?.talklets[cur.currentStoryPageIndex];
    if (!entry || !story || !page) return null;

    return {
      storyId: entry.id,
      storyDefId: story.id,
      type: entry.type,
      pageIndex: cur.currentStoryPageIndex,
      totalPages: story.talklets.length,
      page: {
        ...page,
        effects: page.effects ? [...page.effects] : undefined,
        choices: page.choices?.map(choice => ({
          ...choice,
          effects: [...choice.effects],
        })),
      },
      availableChoiceIndexes: (page.choices ?? []).reduce<number[]>((indexes, choice, index) => {
        if (!choice.condition || this.conditionSystem.evaluateGroup(choice.condition, this.state)) {
          indexes.push(index);
        }
        return indexes;
      }, []),
    };
  }

  // --- 内部 ---

  /** 初始化剧情游标（startStory / replayStory 共用）。 */
  private beginStory(cur: StoryCursorState, entry: StoryEntryDef, story: StoryDef, replay: boolean): void {
    cur.currentStoryEntryId = entry.id;
    cur.currentStoryDefId = entry.storyId;
    cur.currentStoryPageIndex = 0;
    cur.currentStoryChoiceIndex = -1;
    cur.talkletClickWork = null;
    cur.choiceTextConfirmed = false;
    this.flagsSetThisStory.clear();
    cur.insertStack = [];
    cur.visitedStoryIds = [entry.storyId];
    cur.jumpDepth = 0;
    cur.isReplay = replay;
    // 阅读日志：首条 Talklet 已显示（按 Story.id 记）
    this.mutations.recordStoryRead(entry.storyId, 0);
    this.opts.eventBus.emit({ type: 'storyTriggered', storyId: entry.id });
  }

  /** 执行 Story 跳转（goto / insert）。 */
  private performJump(cur: StoryCursorState, target: string, mode: 'goto' | 'insert', fromStory: StoryDef, owner?: string | null): StoryAdvanceResult {
    // 深度限制：防御内容作者误写循环跳转 / 超深嵌套。
    if (cur.jumpDepth >= MAX_JUMP_DEPTH) {
      cur.clear();
      return { success: false, error: 'JumpLimitExceeded' };
    }
    const targetStory = this.registry.stories.get(target);
    if (!targetStory || targetStory.talklets.length === 0) {
      cur.clear();
      return { success: false, error: 'NotFound' };
    }
    if (mode === 'insert') {
      // 记录返回点：当前 Story 的下一页。若为末页（超界），返回时按 Story 已结束处理。
      cur.insertStack.push({ storyId: fromStory.id, pageIndex: cur.currentStoryPageIndex + 1 });
    }
    cur.currentStoryDefId = target;
    cur.currentStoryPageIndex = 0;
    cur.currentStoryChoiceIndex = -1;
    cur.talkletClickWork = null;
    cur.choiceTextConfirmed = false;
    cur.jumpDepth += 1;
    if (!cur.visitedStoryIds.includes(target)) cur.visitedStoryIds.push(target);
    // 阅读日志：目标 Story 首页已显示
    this.mutations.recordStoryRead(target, 0);
    return { success: true, finished: false, story: this.getCurrentStoryView(owner)! };
  }

  /**
   * 本 Story 播完后的收尾：insert 栈非空则返回原地；栈空则 Entry 链完结。
   * 返回点超界（末页 insert 返回）时按"该 Story 已播完"继续弹栈。
   */
  private resolveStoryEnd(cur: StoryCursorState, endedStory: StoryDef, owner?: string | null): StoryAdvanceResult {
    // 循环处理：末页 insert 返回可能层层触发"Story 结束"。
    for (;;) {
      if (cur.insertStack.length > 0) {
        const ret = cur.insertStack.pop()!;
        const retStory = this.registry.stories.get(ret.storyId);
        if (!retStory) {
          cur.clear();
          return { success: false, error: 'NotFound' };
        }
        if (ret.pageIndex < retStory.talklets.length) {
          cur.currentStoryDefId = ret.storyId;
          cur.currentStoryPageIndex = ret.pageIndex;
          cur.currentStoryChoiceIndex = -1;
          cur.talkletClickWork = null;
          cur.choiceTextConfirmed = false;
          this.mutations.recordStoryRead(ret.storyId, ret.pageIndex);
          return { success: true, finished: false, story: this.getCurrentStoryView(owner)! };
        }
        // 返回点超界：该 Story 也视为已播完，继续弹栈或完结。
        continue;
      }

      // 链完结：发放完结奖励 + 记录完成。
      const entry = cur.currentStoryEntryId ? this.entryById(cur.currentStoryEntryId) : undefined;
      const defId = cur.currentStoryDefId ?? (entry ? entry.storyId : null);
      const story = defId ? this.registry.stories.get(defId) : undefined;
      if (!entry || !story) {
        cur.clear();
        return { success: false, error: 'NotFound' };
      }
      // 重阅读模式：仅完成演出（供 UI 收尾），不发放奖励、不重复写入 storyLog。
      const completed: CompletedStory = entry.type === 'active'
        ? { type: 'active', storyId: story.id, choiceIndex: cur.currentStoryChoiceIndex }
        : { type: 'passive', storyId: story.id };
      if (!cur.isReplay) {
        this.applyCompletionReward(entry, story);
        this.mutations.completeStory(completed);
        // 被动闲聊完结：写冷却帧 + 设置对话空间阻断态（关卡式剧情）
        if (entry.type === 'passive') {
          this.recordPassiveCooldown(entry);
          this.maybeBlockConversation(entry);
        }
        // 奖励结算通知（UI 渲染用；effects 已在 applyCompletionReward 中生效）
        const settled = this.lastRewarded;
        this.lastRewarded = null;
        if (settled) {
          this.opts.eventBus.emit({
            type: 'storyRewarded',
            storyId: story.id,
            source: settled.source,
            effects: settled.effects,
            flags: [...this.flagsSetThisStory],
          });
        }
        this.flagsSetThisStory.clear();
      }
      cur.clear();
      return { success: true, finished: true, storyId: story.id, completed };
    }
  }

  /** 应用剧情页/选项效果：记录 setFlag（供完成通知），跳过 travelToArea（单独处理）。 */
  private trackFlagsAndApply(effects: Effect[]): void {
    for (const effect of effects) {
      if (effect.op === 'setFlag') this.flagsSetThisStory.add(effect.target);
    }
    this.effectEngine.applyEffects(effects.filter(effect => effect.op !== 'travelToArea'));
    this.applyStoryTravel(effects);
  }

  /**
   * 被动闲聊完结后写入冷却帧：entry 自身 + 其归属的池（若池声明了 cooldownFrames）。
   * 抽选时未过冷却期的 entry/池将被剪枝（见 PassivePoolSystem.pick）。
   */
  private recordPassiveCooldown(entry: PassiveStoryEntry): void {
    if (!entry.cooldownFrames) return;
    const frame = this.state.totalFrames;
    const cooldowns = { ...(this.state.passiveCooldowns ?? {}) };
    cooldowns[entry.id] = frame;
    // 该 entry 被哪些池以子节点形式引用（归属池）：这些池命中后也进入冷却
    for (const pool of this.opts.registry.passivePools.values()) {
      if (!pool.cooldownFrames) continue;
      if (pool.children.some(child => child.id === entry.id)) {
        cooldowns[pool.id] = frame;
      }
    }
    this.mutations.setPassiveCooldowns(cooldowns);
  }

  /**
   * 被动闲聊完结后若声明了 block 条件，则锁定该学生对话空间（壁垒重启），
   * 直到条件组满足（由各 tick / 区域进入事件经 StateMutationService 解除）。
   */
  private maybeBlockConversation(entry: PassiveStoryEntry): void {
    if (entry.owner && entry.block) {
      this.mutations.setStudentBlock(entry.owner, entry.id);
    }
  }

  /**
   * 完结奖励评估：
   * - conditional 策略：按声明顺序评估 conditionalRewards，首个满足的生效。
   * - simple 策略（缺省，兼容现有行为）：passive 闲聊的 first / repeat。
   */
  private applyCompletionReward(entry: StoryEntryDef, story: StoryDef): void {
    if (entry.completionStrategy === 'conditional' && entry.conditionalRewards && entry.conditionalRewards.length > 0) {
      const matched = entry.conditionalRewards.find(r => this.conditionSystem.evaluateGroup(r.condition, this.state));
      if (matched && matched.effects.length > 0) {
        this.effectEngine.applyEffects(matched.effects);
        this.lastRewarded = { source: 'conditional', effects: matched.effects };
      }
      return;
    }
    if (entry.type === 'passive' && entry.completionReward) {
      // 当前世界线内首次完成发 first，重复完成发 repeat
      const isFirst = !this.hasCompletedStory(story.id);
      const reward = isFirst ? entry.completionReward.first : entry.completionReward.repeat;
      if (reward && reward.length > 0) {
        this.effectEngine.applyEffects(reward);
        this.lastRewarded = { source: isFirst ? 'first' : 'repeat', effects: reward };
      }
    }
  }

  /** 分歧点准入守卫：前置阅读是否全部满足。talkletIndex = -1 表示要求整条 Story 全部已读。 */
  private guardPrereqsMet(guard: BranchGuard): boolean {
    return guard.prerequisites.every(({ storyId, talkletIndex }) => {
      const log = this.state.storyReadLogs?.[storyId];
      if (!log) return false;
      if (talkletIndex === -1) {
        const story = this.registry.stories.get(storyId);
        if (!story) return false;
        return story.talklets.every((_, i) => log.readTalkletIndexes.includes(i));
      }
      return log.readTalkletIndexes.includes(talkletIndex);
    });
  }

  /** 通过对外故事 id（Entry.id）解析触发入口。 */
  private entryById(storyId: string): StoryEntryDef | undefined {
    return this.registry.storyEntries.get(storyId);
  }

  /** 入口归属的学生差分（passive 用 .owner；active 用 extra.owner）；无则外部/一般闲聊。 */
  private ownerOfEntry(entry: StoryEntryDef): string | undefined {
    if (entry.type === 'passive') return entry.owner;
    const owner = entry.extra ? getAtPath(entry.extra, 'owner') : undefined;
    return owner !== undefined && isStr(owner) ? owner.v : undefined;
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

  /**
   * 执行剧情页/选项中的 travelToArea effect（Story 自身要求移动，不受玩家限制）。
   * 不判断拓扑（checkAdjacency=false），但 area 不属于当前 Init 时跳过移动（静默，不中断剧情）。
   * effect.notice=true 且移动成功 → 发出 storyAreaTraveled 事件，供 UI 显示「移动到了 XX」迷你条目。
   */
  private applyStoryTravel(effects: Effect[] | undefined): void {
    if (!effects) return;
    for (const effect of effects) {
      if (effect.op !== 'travelToArea') continue;
      const result = this.opts.travelToArea(effect.target, true, false);
      if (result.success && effect.notice) {
        this.opts.eventBus.emit({ type: 'storyAreaTraveled', areaId: effect.target });
      }
    }
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
