// ============================================================
// engine/game/story-service.ts — 剧情流程服务
//
// 从 GameInstance 拆出：剧情游标状态 + 剧情启动/推进/发送。
// GameInstance 以门面形式委托本服务，保持公开 API 不变。
//
// 跳转链机制（v2）：
//   - Talklet / StoryChoice 可声明 jumpToStory + jumpMode。
//   - goto：完全转移演出流到目标 Story，不返回；目标 Story 完结即 Entry 完结。
//   - insert：暂停当前 Story，播放目标 Story；播完后返回当前 Story 的下一页。
//   - currentStoryEntryId 保持 Entry.id 不变（对外故事 id），
//     currentStoryDefId 记录当前实际播放的 Story.id（跳转链中可变）。
//   - 完结时按 Entry 的 completionStrategy 评估奖励（simple / conditional）。
//   - 重阅读模式（replayStory）受 branchGuards 分歧点准入守卫约束。
// ============================================================

import type {
  PlayerState,
  StoryDef,
  StoryEntryDef,
  StoryView,
  StoryStartResult,
  StoryAdvanceResult,
  SendState,
  SendResult,
  CompletedStory,
  StoryChoice,
  Effect,
  Talklet,
  TravelResult,
  BranchGuard,
  StoryId,
} from '../types';
import { Registry } from '../registry';
import { ConditionSystem } from '../condition-system';
import { EffectEngine } from '../effect-engine';
import { StateMutationService } from '../state-mutation-service';
import { EventBus } from '../event-bus';
import type { PassivePoolSystem } from '../passive-pool-system';
import { rollClickWorkTotal, shouldEchoReply } from './page-interaction';

/** 跳转深度上限：goto + insert 累计跳转次数，超出即强制终止演出（防循环/超深）。 */
export const MAX_JUMP_DEPTH = 32;

/** 剧情游标（存档用，GameInstance.save/load 读写）。 */
export interface StoryCursor {
  /** 当前 Entry.id（对外故事 id，跳转链中不变）。 */
  currentStoryId: string | null;
  /** 当前实际播放的 Story.id（跳转链中可变）。旧档无此字段 = 回退 Entry.storyId。 */
  currentStoryDefId?: string | null;
  currentStoryPageIndex: number;
  currentStoryChoiceIndex: number;
  talkletClickWork: { total: number; done: number } | null;
  /** insert 跳转返回点栈（旧档无 = 空）。 */
  insertStack?: { storyId: string; pageIndex: number }[];
  /** 本 Entry 链已访问过的 Story.id（去重，旧档无 = 空）。 */
  visitedStoryIds?: string[];
  /** 是否处于重阅读模式（旧档无 = false）。 */
  isReplay?: boolean;
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
  /** Story 自身要求移动 Area（travelToArea effect），不受玩家移动限制。 */
  travelToArea: (areaId: string, allowDuringStory?: boolean) => TravelResult;
}

export class StoryService {
  // 剧情游标
  /** 当前 Entry.id（对外故事 id；跳转链中保持不变）。 */
  private currentStoryEntryId: string | null = null;
  /** 当前实际播放的 Story.id（跳转链中可变；startStory 时 = entry.storyId）。 */
  private currentStoryDefId: string | null = null;
  private currentStoryPageIndex = 0;
  private currentStoryChoiceIndex = -1;
  /**
   * 当前 Talklet 的点击工作进度（Talklet.clickWork）。
   * null = 当前页无点击需求。首次进入 clickWork 页时 roll 随机 total，之后沿用。
   */
  private talkletClickWork: { total: number; done: number } | null = null;
  /** insert 跳转返回点栈：记录 (Story.id, 返回页索引)。 */
  private insertStack: { storyId: string; pageIndex: number }[] = [];
  /** applyCompletionReward 的结算记录（供完成时发出 storyRewarded 事件）。 */
  private lastRewarded: { source: 'first' | 'repeat' | 'conditional'; effects: Effect[] } | null = null;
  /** 本次剧情播放期间经 Talklet/选项效果设置的 flag（完成时随 storyRewarded 通知 UI）。 */
  private flagsSetThisStory = new Set<string>();
  /** 本 Entry 链已访问过的 Story.id（去重；含初始 Story 与全部跳转目标）。 */
  private visitedStoryIds: string[] = [];
  /** 累计跳转深度（goto + insert），上限 MAX_JUMP_DEPTH。 */
  private jumpDepth = 0;
  /** 重阅读模式标志：true 时受 branchGuards 分歧点准入守卫约束。 */
  private isReplay = false;
  /**
   * 选项页（choices）文本确认状态：进入 choice 页时为 false（选项被本页 text 阻塞，
   * 需玩家先点击确认文本后才显示选项）；点击确认后为 true。离开该页时重置。
   */
  private choiceTextConfirmed = false;

  constructor(private readonly opts: StoryServiceOptions) {}

  private get state(): PlayerState {
    return this.opts.getState();
  }

  // --- 游标访问（GameInstance / 存档 / 移动规则使用） ---

  getCurrentStoryId(): string | null {
    return this.currentStoryEntryId;
  }

  /** 当前实际播放的 Story.id（跳转链中可变；无进行中剧情 = null）。 */
  getCurrentStoryDefId(): string | null {
    return this.currentStoryDefId;
  }

  /** 当前 Entry 跳转链是否经过该 Story（供 visitedStoryInChain 条件评估）。 */
  isVisitedInChain(storyId: string): boolean {
    return this.visitedStoryIds.includes(storyId);
  }

  /** 存档：导出剧情游标快照。 */
  saveCursor(): StoryCursor {
    return {
      currentStoryId: this.currentStoryEntryId,
      currentStoryDefId: this.currentStoryDefId,
      currentStoryPageIndex: this.currentStoryPageIndex,
      currentStoryChoiceIndex: this.currentStoryChoiceIndex,
      talkletClickWork: this.talkletClickWork ? { ...this.talkletClickWork } : null,
      insertStack: this.insertStack.map(s => ({ ...s })),
      visitedStoryIds: [...this.visitedStoryIds],
      isReplay: this.isReplay,
    };
  }

  /** 读档：恢复剧情游标（兼容旧档缺失的新字段）。 */
  restoreCursor(cursor: StoryCursor): void {
    this.currentStoryEntryId = cursor.currentStoryId;
    this.currentStoryDefId = cursor.currentStoryDefId ?? null;
    this.currentStoryPageIndex = cursor.currentStoryPageIndex;
    this.currentStoryChoiceIndex = cursor.currentStoryChoiceIndex;
    this.talkletClickWork = cursor.talkletClickWork ? { ...cursor.talkletClickWork } : null;
    // 选项文本确认状态不持久化：读档后玩家重新点击确认即可看到选项
    this.choiceTextConfirmed = false;
    this.insertStack = cursor.insertStack ? cursor.insertStack.map(s => ({ ...s })) : [];
    this.visitedStoryIds = cursor.visitedStoryIds ? [...cursor.visitedStoryIds] : [];
    this.isReplay = cursor.isReplay ?? false;
  }

  clearCurrentStory(): void {
    this.currentStoryEntryId = null;
    this.currentStoryDefId = null;
    this.currentStoryPageIndex = 0;
    this.currentStoryChoiceIndex = -1;
    this.talkletClickWork = null;
    this.choiceTextConfirmed = false;
    this.insertStack = [];
    this.visitedStoryIds = [];
    this.jumpDepth = 0;
    this.isReplay = false;
  }

  /** 当前是否有非 passive 剧情演出在进行（演出期间锁定移动）。 */
  isBlockingMovement(): boolean {
    if (this.currentStoryEntryId === null) return false;
    const entry = this.entryById(this.currentStoryEntryId);
    return entry ? entry.type !== 'passive' : false;
  }

  /** 移动出 Area 时强制打断正在播放的 PassiveStory。 */
  clearPassiveIfPlaying(): void {
    if (this.currentStoryEntryId === null) return;
    const currentEntry = this.entryById(this.currentStoryEntryId);
    if (currentEntry?.type === 'passive') this.clearCurrentStory();
  }

  hasCompletedStory(storyId: string): boolean {
    return this.state.storyLog.some(story => story.storyId === storyId);
  }

  // --- 公开 API（GameInstance 门面委托） ---

  startActiveStory(storyId: string): StoryStartResult {
    return this.startStory(storyId, 'active');
  }

  /** Pick one eligible passive story via the pool system (tree draw + reactor gates). */
  triggerPassiveStory(initId: string = this.state.activeInit): StoryStartResult {
    if (this.currentStoryEntryId !== null) {
      return { success: false, error: 'AlreadyActive' };
    }

    const selectedId = this.opts.passivePools.pick(this.state, (entry) => {
      if (entry.weight <= 0) return false;
      if (entry.availableInits.length > 0 && !entry.availableInits.includes(initId)) return false;
      if (entry.triggerCondition && !this.conditionSystem.evaluateGroup(entry.triggerCondition, this.state)) return false;
      if (!entry.repeatable && this.hasCompletedStory(entry.storyId)) return false;
      return true;
    });

    if (!selectedId) return { success: false, error: 'NoAvailableStory' };
    return this.startStory(selectedId, 'passive');
  }

  /**
   * 重阅读入口：从 StoryEntry 重新阅读关联的 Story 链。
   * 与 startStory 的区别：
   *   - 仅检查 entry.replayable 与无进行中剧情，不受 triggerCondition / availableInits / AlreadyCompleted 限制；
   *   - 进入重阅读模式：推进到受 branchGuards 保护的分歧跳转时，
   *     若玩家 storyReadLogs 中缺乏指定前置阅读记录，则拒绝（BranchGuardDenied）。
   */
  replayStory(storyId: string): StoryStartResult {
    const entry = this.entryById(storyId);
    if (!entry) return { success: false, storyId, error: 'NotFound' };
    if (!entry.replayable) return { success: false, storyId, error: 'NotReplayable' };
    if (this.currentStoryEntryId !== null) return { success: false, storyId, error: 'AlreadyActive' };
    const story = this.storyOf(entry);
    if (!story || story.talklets.length === 0) return { success: false, storyId, error: 'NotFound' };

    this.beginStory(entry, story, true);
    return { success: true, story: this.getCurrentStoryView()! };
  }

  advanceStory(choiceIndex?: number): StoryAdvanceResult {
    if (this.currentStoryEntryId === null) return { success: false, error: 'NoActiveStory' };
    const entry = this.entryById(this.currentStoryEntryId);
    if (!entry) {
      this.clearCurrentStory();
      return { success: false, error: 'NotFound' };
    }
    const story = this.currentStoryDef();
    if (!story) {
      this.clearCurrentStory();
      return { success: false, error: 'NotFound' };
    }

    const page = story.talklets[this.currentStoryPageIndex];
    if (!page) {
      this.clearCurrentStory();
      return { success: false, storyId: story.id, error: 'NotFound' };
    }

    const choices = page.choices ?? [];
    let selectedChoice: StoryChoice | undefined;
    if (choices.length > 0) {
      if (choiceIndex === undefined) {
        return { success: false, storyId: story.id, error: 'ChoiceRequired' };
      }
      if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= choices.length) {
        return { success: false, storyId: story.id, error: 'InvalidChoice' };
      }
      selectedChoice = choices[choiceIndex];
      if (selectedChoice.condition && !this.conditionSystem.evaluateGroup(selectedChoice.condition, this.state)) {
        return { success: false, storyId: story.id, error: 'ChoiceConditionNotMet' };
      }
      this.currentStoryChoiceIndex = choiceIndex;
    } else if (choiceIndex !== undefined) {
      return { success: false, storyId: story.id, error: 'InvalidChoice' };
    }

    // 解析跳转目标：选项级优先于 Talklet 级（提前到点击防护之前，供防护判断）。
    const jumpTarget = selectedChoice?.jumpToStory ?? page.jumpToStory;
    const jumpMode = (selectedChoice?.jumpMode ?? page.jumpMode) ?? 'goto';

    // 点击需求防护：click / clickWork 页若带 jumpToStory，或推进后会离开本 Story
    // （Story 末尾：insert 弹栈返回调用方 / goto 链完结），必须先经 clickSend 完成点击确认。
    // 保证"完成该 Talklet 的 click 之后才发生跳转 / 返回 / 完结"，避免省略该处的点击需求
    // （尤其 insert 子剧情的末页 click——未完成点击就弹栈返回会跳过它）。
    // 普通 click 页（推进后仍在 Story 内）保持原行为：advanceStory 可直接推进。
    // 选项页（choices.length > 0）由选项交互驱动，不检查点击。
    const clickWorkDef = page.clickWork ?? (page.kind === 'click' ? { base: 1 } : undefined);
    const willLeaveStory = !!jumpTarget || this.currentStoryPageIndex + 1 >= story.talklets.length;
    if (willLeaveStory && choices.length === 0 && clickWorkDef
        && (!this.talkletClickWork || this.talkletClickWork.done <= this.talkletClickWork.total)) {
      return { success: false, storyId: story.id, error: 'ClickRequired' };
    }

    // 重阅读模式：分歧点准入守卫检查（在效果应用之前，拒绝时不产生任何副作用）。
    if (jumpTarget && this.isReplay) {
      const guard = entry.branchGuards?.find(g => g.storyId === jumpTarget);
      if (guard && !this.guardPrereqsMet(guard)) {
        return { success: false, storyId: story.id, error: 'BranchGuardDenied', denialMessage: guard.denialMessage };
      }
    }

    if (page.effects) {
      this.trackFlagsAndApply(page.effects);
    }
    if (selectedChoice?.effects) {
      this.trackFlagsAndApply(selectedChoice.effects);
    }
    // 阅读日志：记录离开页 + 所选选项（按 Story.id 记）
    this.mutations.recordStoryRead(story.id, this.currentStoryPageIndex, selectedChoice ? choiceIndex : undefined);

    // 跳转：goto / insert
    if (jumpTarget) {
      return this.performJump(jumpTarget, jumpMode, story);
    }

    // 正常推进
    this.currentStoryPageIndex += 1;
    // 已离开上一页 → 重置点击工作进度与选项文本确认（下一页若需要会在 getSendState 中重新 roll）
    this.talkletClickWork = null;
    this.choiceTextConfirmed = false;
    if (this.currentStoryPageIndex < story.talklets.length) {
      // 阅读日志：新页已显示
      this.mutations.recordStoryRead(story.id, this.currentStoryPageIndex);
      return { success: true, finished: false, story: this.getCurrentStoryView()! };
    }

    // 本 Story 播完：insert 返回 or Entry 完结
    return this.resolveStoryEnd(story);
  }

  /**
   * 查询底部"回复按钮"的当前状态。
   * 该按钮本质是聊天流中的一条 Talklet；玩家点击它推进剧情。
   */
  getSendState(): SendState {
    // 无进行中剧情 → idle（点击可触发 PassiveTalk）
    if (this.currentStoryEntryId === null) return { mode: 'idle', reason: 'noStory' };
    const entry = this.entryById(this.currentStoryEntryId);
    const story = this.currentStoryDef();
    const page = story?.talklets[this.currentStoryPageIndex];
    if (!entry || !story || !page) return { mode: 'idle', reason: 'noStory' };
    // click 页：纯底部按钮交互（text/sendText 作按钮文案），不提供选项
    const isClick = page.kind === 'click';
    // 当前 Talklet 有选项 → 回复按钮让位给选项
    // choice 页 text 默认阻塞：未确认（confirmed=false）时 UI 先显示文本 + "继续"按钮，
    // 玩家点击确认后才渲染选项卡片（见 clickSend 的确认逻辑与 center-panel 渲染）。
    if (!isClick && (page.choices ?? []).length > 0) {
      this.talkletClickWork = null;
      return { mode: 'choice', confirmed: this.choiceTextConfirmed };
    }

    // 点击工作：当前页无需求 → 清理残留；有需求且未初始化 → roll 随机总次数。
    // click 页缺省按 { base: 1 } 处理（"点一下推进"为最小形态，增强健壮性）。
    const clickWork = page.clickWork ?? (isClick ? { base: 1 } : undefined);
    if (!clickWork) {
      this.talkletClickWork = null;
    } else if (!this.talkletClickWork) {
      this.talkletClickWork = { total: rollClickWorkTotal(clickWork.base, clickWork.rand), done: 0 };
    }

    return {
      mode: 'advance',
      storyId: entry.id,
      pageIndex: this.currentStoryPageIndex,
      text: isClick ? (page.sendText ?? page.text ?? '') : (page.sendText ?? ''),
      // 进度显示 clamp 到 total：已确认态（done = total + 1）在 UI 上显示为填满。
      clickWork: this.talkletClickWork
        ? { total: this.talkletClickWork.total, done: Math.min(this.talkletClickWork.done, this.talkletClickWork.total) }
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
  clickSend(): SendResult {
    const state = this.getSendState();

    if (state.mode === 'choice') {
      // choice 页 text 阻塞：首次点击仅确认文本（不推进剧情），UI 随后渲染选项。
      // 已确认后再次点击保持 choice（选项由 [data-story-choice] 按钮驱动）。
      if (!state.confirmed) this.choiceTextConfirmed = true;
      return { type: 'choice' };
    }

    if (state.mode === 'idle') {
      const result = this.triggerPassiveStory();
      if (result.success) return { type: 'idle', started: true };
      return { type: 'idle', started: false, error: result.error };
    }

    const sentText = state.text;

    // 回显决策（引擎侧、数据驱动）：由被点击页的 kind/muteReply/sendText 决定
    // 是否把 sentText 以「老师」气泡回显到聊天流。UI 据此消费，不再自行启发式判定。
    const echoedPage = this.currentPage();
    const echoReply = !!echoedPage && shouldEchoReply(echoedPage);

    // 多击任务：前 total 次点击从左往右填充进度条（最后一次填满 100%），
    // 填满后还需再点一次才结束该 click 页（推进剧情）。
    // total === 1（普通"点一下推进"）保持单次点击即推进。
    if (state.clickWork) {
      const total = state.clickWork.total;
      const done = state.clickWork.done + 1;
      if (total > 1 && done <= total) {
        this.talkletClickWork = { total, done };
        return { type: 'working', storyId: state.storyId, pageIndex: state.pageIndex, clicksDone: done, clicksTotal: total };
      }
      // 已填满（或 total === 1）：标记"已确认"（done = total + 1）后照常推进。
      // 保留进度而非置 null：advanceStory 的 ClickRequired 防护依赖它区分
      // "已确认可推进"与"未初始化/未完成"，防止直接调用 advanceStory 绕过点击需求。
      this.talkletClickWork = { total, done: total + 1 };
    }

    const advance = this.advanceStory();

    // 统一化读取：推进后停在下一页（无论是否交互页），由玩家逐页点击推进。
    // 不再向后吸收纯展示页——goto/insert 目标 Story 与普通 Story 行为完全一致，
    // 每一句（旁白/对话/click/选项）都默认要求一次点击才继续。
    // absorbed 恒为空数组（保留字段供 UI/测试兼容，不再产生吸收页）。
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
   */
  startStory(storyId: string, expectedType: 'active' | 'passive'): StoryStartResult {
    if (this.currentStoryEntryId !== null) {
      if (expectedType === 'active') {
        const currentEntry = this.entryById(this.currentStoryEntryId);
        if (currentEntry?.type === 'passive') {
          this.clearCurrentStory();
          // 继续启动 ActiveStory
        } else {
          return { success: false, storyId, error: 'AlreadyActive' };
        }
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
    if (!repeatable && this.hasCompletedStory(story.id)) {
      return { success: false, storyId, error: 'AlreadyCompleted' };
    }

    this.beginStory(entry, story, false);
    return { success: true, story: this.getCurrentStoryView()! };
  }

  getCurrentStoryView(): StoryView | null {
    if (this.currentStoryEntryId === null) return null;
    const entry = this.entryById(this.currentStoryEntryId);
    const story = this.currentStoryDef();
    const page = story?.talklets[this.currentStoryPageIndex];
    if (!entry || !story || !page) return null;

    return {
      storyId: entry.id,
      storyDefId: story.id,
      type: entry.type,
      pageIndex: this.currentStoryPageIndex,
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
  private beginStory(entry: StoryEntryDef, story: StoryDef, replay: boolean): void {
    this.currentStoryEntryId = entry.id;
    this.currentStoryDefId = entry.storyId;
    this.currentStoryPageIndex = 0;
    this.currentStoryChoiceIndex = -1;
    this.talkletClickWork = null;
    this.choiceTextConfirmed = false;
    this.flagsSetThisStory.clear();
    this.insertStack = [];
    this.visitedStoryIds = [entry.storyId];
    this.jumpDepth = 0;
    this.isReplay = replay;
    // 阅读日志：首条 Talklet 已显示（按 Story.id 记）
    this.mutations.recordStoryRead(entry.storyId, 0);
    this.opts.eventBus.emit({ type: 'storyTriggered', storyId: entry.id });
  }

  /** 执行 Story 跳转（goto / insert）。 */
  private performJump(target: StoryId, mode: 'goto' | 'insert', fromStory: StoryDef): StoryAdvanceResult {
    // 深度限制：防御内容作者误写循环跳转 / 超深嵌套。
    if (this.jumpDepth >= MAX_JUMP_DEPTH) {
      this.clearCurrentStory();
      return { success: false, error: 'JumpLimitExceeded' };
    }
    const targetStory = this.registry.stories.get(target);
    if (!targetStory || targetStory.talklets.length === 0) {
      this.clearCurrentStory();
      return { success: false, error: 'NotFound' };
    }
    if (mode === 'insert') {
      // 记录返回点：当前 Story 的下一页。若为末页（超界），返回时按 Story 已结束处理。
      this.insertStack.push({ storyId: fromStory.id, pageIndex: this.currentStoryPageIndex + 1 });
    }
    this.currentStoryDefId = target;
    this.currentStoryPageIndex = 0;
    this.currentStoryChoiceIndex = -1;
    this.talkletClickWork = null;
    this.choiceTextConfirmed = false;
    this.jumpDepth += 1;
    if (!this.visitedStoryIds.includes(target)) this.visitedStoryIds.push(target);
    // 阅读日志：目标 Story 首页已显示
    this.mutations.recordStoryRead(target, 0);
    return { success: true, finished: false, story: this.getCurrentStoryView()! };
  }

  /**
   * 本 Story 播完后的收尾：insert 栈非空则返回原地；栈空则 Entry 链完结。
   * 返回点超界（末页 insert 返回）时按"该 Story 已播完"继续弹栈。
   */
  private resolveStoryEnd(endedStory: StoryDef): StoryAdvanceResult {
    // 循环处理：末页 insert 返回可能层层触发"Story 结束"。
    for (;;) {
      if (this.insertStack.length > 0) {
        const ret = this.insertStack.pop()!;
        const retStory = this.registry.stories.get(ret.storyId);
        if (!retStory) {
          this.clearCurrentStory();
          return { success: false, error: 'NotFound' };
        }
        if (ret.pageIndex < retStory.talklets.length) {
          this.currentStoryDefId = ret.storyId;
          this.currentStoryPageIndex = ret.pageIndex;
          this.currentStoryChoiceIndex = -1;
          this.talkletClickWork = null;
          this.choiceTextConfirmed = false;
          this.mutations.recordStoryRead(ret.storyId, ret.pageIndex);
          return { success: true, finished: false, story: this.getCurrentStoryView()! };
        }
        // 返回点超界：该 Story 也视为已播完，继续弹栈或完结。
        continue;
      }

      // 链完结：发放完结奖励 + 记录完成。
      const entry = this.currentEntry();
      const story = this.currentStoryDef();
      if (!entry || !story) {
        this.clearCurrentStory();
        return { success: false, error: 'NotFound' };
      }
      // 重阅读模式：仅完成演出（供 UI 收尾），不发放奖励、不重复写入 storyLog。
      // 防止通过重阅读反复触发条件奖励 / 污染完成记录。
      const completed: CompletedStory = entry.type === 'active'
        ? { type: 'active', storyId: story.id, choiceIndex: this.currentStoryChoiceIndex }
        : { type: 'passive', storyId: story.id };
      if (!this.isReplay) {
        this.applyCompletionReward(entry, story);
        this.mutations.completeStory(completed);
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
      this.clearCurrentStory();
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
   * 完结奖励评估：
   * - conditional 策略：按声明顺序评估 conditionalRewards，首个满足的生效。
   *   条件可引用 flags / extra / 资源 / 统计 / visitedStoryInChain 等
   *   （跳转链中设置的 flag 与经过的 Story 均已就绪）。
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
      // （在 completeStory 之前判定，确保 storyLog 未含该故事时视为首次）
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

  /** 当前 Entry（无进行中剧情 = undefined）。 */
  private currentEntry(): StoryEntryDef | undefined {
    if (this.currentStoryEntryId === null) return undefined;
    return this.registry.storyEntries.get(this.currentStoryEntryId);
  }

  /** 当前实际播放的 Story（跳转链中可变；无进行中剧情 = undefined）。 */
  private currentStoryDef(): StoryDef | undefined {
    if (this.currentStoryDefId === null) return undefined;
    return this.registry.stories.get(this.currentStoryDefId);
  }

  /** 通过 Entry 的 storyId 重定向到纯演出 Story（初始 Story）。 */
  private storyOf(entry: StoryEntryDef): StoryDef | undefined {
    return this.registry.stories.get(entry.storyId);
  }

  /** 当前游标指向的 Talklet（无进行中剧情或无页时 = undefined）。 */
  private currentPage(): Talklet | undefined {
    if (this.currentStoryEntryId === null) return undefined;
    const story = this.currentStoryDef();
    return story?.talklets[this.currentStoryPageIndex];
  }

  /** 执行剧情页/选项中的 travelToArea effect（Story 自身要求移动，不受玩家限制）。 */
  private applyStoryTravel(effects: Effect[] | undefined): void {
    if (!effects) return;
    for (const effect of effects) {
      if (effect.op === 'travelToArea') this.opts.travelToArea(effect.target, true);
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
