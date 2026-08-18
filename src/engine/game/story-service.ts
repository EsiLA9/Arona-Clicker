// ============================================================
// engine/game/story-service.ts — 剧情流程服务
//
// 从 GameInstance 拆出：剧情游标状态 + 剧情启动/推进/发送。
// GameInstance 以门面形式委托本服务，保持公开 API 不变。
// ============================================================

import type {
  PlayerState,
  StoryDef,
  StoryView,
  StoryStartResult,
  StoryAdvanceResult,
  SendState,
  SendResult,
  PassiveStoryDef,
  CompletedStory,
  StoryChoice,
  Effect,
  TravelResult,
} from '../types';
import { Registry } from '../registry';
import { ConditionSystem } from '../condition-system';
import { EffectEngine } from '../effect-engine';
import { StateMutationService } from '../state-mutation-service';
import { EventBus } from '../event-bus';

/** 剧情游标（存档用，GameInstance.save/load 读写）。 */
export interface StoryCursor {
  currentStoryId: string | null;
  currentStoryPageIndex: number;
  currentStoryChoiceIndex: number;
  talkletClickWork: { total: number; done: number } | null;
}

export interface StoryServiceOptions {
  registry: Registry;
  conditionSystem: ConditionSystem;
  effectEngine: EffectEngine;
  mutations: StateMutationService;
  eventBus: EventBus;
  /** 读取当前 PlayerState（GameInstance 持有单一状态对象）。 */
  getState: () => PlayerState;
  /** Story 自身要求移动 Area（travelToArea effect），不受玩家移动限制。 */
  travelToArea: (areaId: string, allowDuringStory?: boolean) => TravelResult;
}

export class StoryService {
  // 剧情游标
  private currentStoryId: string | null = null;
  private currentStoryPageIndex = 0;
  private currentStoryChoiceIndex = -1;
  /**
   * 当前 Talklet 的点击工作进度（StoryPage.clickWork）。
   * null = 当前页无点击需求。首次进入 clickWork 页时 roll 随机 total，之后沿用。
   */
  private talkletClickWork: { total: number; done: number } | null = null;

  constructor(private readonly opts: StoryServiceOptions) {}

  private get state(): PlayerState {
    return this.opts.getState();
  }

  // --- 游标访问（GameInstance / 存档 / 移动规则使用） ---

  getCurrentStoryId(): string | null {
    return this.currentStoryId;
  }

  /** 存档：导出剧情游标快照。 */
  saveCursor(): StoryCursor {
    return {
      currentStoryId: this.currentStoryId,
      currentStoryPageIndex: this.currentStoryPageIndex,
      currentStoryChoiceIndex: this.currentStoryChoiceIndex,
      talkletClickWork: this.talkletClickWork ? { ...this.talkletClickWork } : null,
    };
  }

  /** 读档：恢复剧情游标。 */
  restoreCursor(cursor: StoryCursor): void {
    this.currentStoryId = cursor.currentStoryId;
    this.currentStoryPageIndex = cursor.currentStoryPageIndex;
    this.currentStoryChoiceIndex = cursor.currentStoryChoiceIndex;
    this.talkletClickWork = cursor.talkletClickWork ? { ...cursor.talkletClickWork } : null;
  }

  clearCurrentStory(): void {
    this.currentStoryId = null;
    this.currentStoryPageIndex = 0;
    this.currentStoryChoiceIndex = -1;
    this.talkletClickWork = null;
  }

  /** 当前是否有非 passive 剧情演出在进行（演出期间锁定移动）。 */
  isBlockingMovement(): boolean {
    if (this.currentStoryId === null) return false;
    const story = this.registry.stories.get(this.currentStoryId);
    return story ? story.type !== 'passive' : false;
  }

  /** 移动出 Area 时强制打断正在播放的 PassiveStory。 */
  clearPassiveIfPlaying(): void {
    if (this.currentStoryId === null) return;
    const currentStory = this.registry.stories.get(this.currentStoryId);
    if (currentStory?.type === 'passive') this.clearCurrentStory();
  }

  hasCompletedStory(storyId: string): boolean {
    return this.state.storyLog.some(story => story.storyId === storyId);
  }

  // --- 公开 API（GameInstance 门面委托） ---

  startActiveStory(storyId: string): StoryStartResult {
    return this.startStory(storyId, 'active');
  }

  /** Pick one eligible passive story from the current Init by weight. */
  triggerPassiveStory(initId: string = this.state.activeInit): StoryStartResult {
    if (this.currentStoryId !== null) {
      return { success: false, error: 'AlreadyActive' };
    }

    const candidates = [...this.registry.stories.values()]
      .filter((story): story is PassiveStoryDef => {
        if (story.type !== 'passive' || story.weight <= 0) return false;
        if (story.availableInits.length > 0 && !story.availableInits.includes(initId)) return false;
        if (story.triggerCondition && !this.conditionSystem.evaluateGroup(story.triggerCondition, this.state)) {
          return false;
        }
        if (!story.repeatable && this.hasCompletedStory(story.id)) return false;
        return !this.isStoryOnCooldown(story);
      });

    if (candidates.length === 0) return { success: false, error: 'NoAvailableStory' };

    const totalWeight = candidates.reduce((sum, story) => sum + story.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = candidates[candidates.length - 1];
    for (const candidate of candidates) {
      roll -= candidate.weight;
      if (roll < 0) {
        selected = candidate;
        break;
      }
    }
    return this.startStory(selected.id, 'passive');
  }

  advanceStory(choiceIndex?: number): StoryAdvanceResult {
    if (this.currentStoryId === null) return { success: false, error: 'NoActiveStory' };
    const story = this.registry.stories.get(this.currentStoryId);
    if (!story) {
      this.clearCurrentStory();
      return { success: false, error: 'NotFound' };
    }

    const page = story.pages[this.currentStoryPageIndex];
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

    if (page.effects) {
      this.effectEngine.applyEffects(page.effects.filter(effect => effect.op !== 'travelToArea'));
      this.applyStoryTravel(page.effects);
    }
    if (selectedChoice?.effects) {
      this.effectEngine.applyEffects(selectedChoice.effects.filter(effect => effect.op !== 'travelToArea'));
      this.applyStoryTravel(selectedChoice.effects);
    }

    this.currentStoryPageIndex += 1;
    // 已离开上一页 → 重置点击工作进度（下一页若需要会在 getSendState 中重新 roll）
    this.talkletClickWork = null;
    if (this.currentStoryPageIndex < story.pages.length) {
      return { success: true, finished: false, story: this.getCurrentStoryView()! };
    }

    const completed: CompletedStory = story.type === 'active'
      ? { type: 'active', storyId: story.id, choiceIndex: this.currentStoryChoiceIndex }
      : { type: 'passive', storyId: story.id };

    // 被动闲聊完结奖励：当前世界线内首次完成发 first，重复完成发 repeat
    // （在 completeStory 之前判定，确保 storyLog 未含该故事时视为首次）
    if (story.type === 'passive' && story.completionReward) {
      const isFirst = !this.hasCompletedStory(story.id);
      const reward = isFirst ? story.completionReward.first : story.completionReward.repeat;
      if (reward && reward.length > 0) {
        this.effectEngine.applyEffects(reward);
      }
    }

    this.mutations.completeStory(completed);
    this.mutations.setStoryCooldown(story.id, this.state.totalFrames);
    this.clearCurrentStory();
    return { success: true, finished: true, storyId: story.id, completed };
  }

  /**
   * 查询底部"回复按钮"的当前状态。
   * 该按钮本质是聊天流中的一条 Talklet；玩家点击它推进剧情。
   */
  getSendState(): SendState {
    // 无进行中剧情 → idle（点击可触发 PassiveTalk）
    if (this.currentStoryId === null) return { mode: 'idle', reason: 'noStory' };
    const story = this.registry.stories.get(this.currentStoryId);
    const page = story?.pages[this.currentStoryPageIndex];
    if (!story || !page) return { mode: 'idle', reason: 'noStory' };
    // 当前 Talklet 有选项 → 回复按钮让位给选项
    if ((page.choices ?? []).length > 0) {
      this.talkletClickWork = null;
      return { mode: 'choice' };
    }

    // 点击工作：当前页无需求 → 清理残留；有需求且未初始化 → roll 随机总次数
    if (!page.clickWork) {
      this.talkletClickWork = null;
    } else if (!this.talkletClickWork) {
      const total = page.clickWork.base + (page.clickWork.rand ? Math.floor(Math.random() * page.clickWork.rand) : 0);
      this.talkletClickWork = { total, done: 0 };
    }

    return {
      mode: 'advance',
      storyId: story.id,
      pageIndex: this.currentStoryPageIndex,
      text: page.sendText ?? page.text,
      clickWork: this.talkletClickWork ? { ...this.talkletClickWork } : undefined,
    };
  }

  /**
   * 玩家点击一次回复按钮。
   * - 剧情演出中：直接推进一页（advanceStory），并执行当前页效果
   * - 无剧情：尝试按当前场景随机抽取并开始一条 PassiveTalk
   */
  clickSend(): SendResult {
    const state = this.getSendState();

    if (state.mode === 'choice') return { type: 'choice' };

    if (state.mode === 'idle') {
      const result = this.triggerPassiveStory();
      if (result.success) return { type: 'idle', started: true };
      return { type: 'idle', started: false, error: result.error };
    }

    // mode === 'advance'
    const sentText = state.text;

    // 多击任务：尚未达到 total → 只计数、不推进，返回 working 供前端刷新进度条
    if (state.clickWork) {
      const total = state.clickWork.total;
      const done = state.clickWork.done + 1;
      if (done < total) {
        this.talkletClickWork = { total, done };
        return { type: 'working', storyId: state.storyId, pageIndex: state.pageIndex, clicksDone: done, clicksTotal: total };
      }
      // 最后一次点击：完成，清零后照常推进
      this.talkletClickWork = null;
    }

    const advance = this.advanceStory();
    return {
      type: 'completed',
      storyId: state.storyId,
      finished: advance.success && 'finished' in advance ? advance.finished : false,
      sentText,
      advance,
    };
  }

  /**
   * 启动一个剧情（active 或 passive）。ActiveStory 可打断正在播放的 PassiveStory。
   * 返回 StoryStartResult；GameInstance 在进入 Init 自动展开 startStoryId 时复用。
   */
  startStory(storyId: string, expectedType: 'active' | 'passive'): StoryStartResult {
    if (this.currentStoryId !== null) {
      if (expectedType === 'active') {
        const currentStory = this.registry.stories.get(this.currentStoryId);
        if (currentStory?.type === 'passive') {
          this.clearCurrentStory();
          // 继续启动 ActiveStory
        } else {
          return { success: false, storyId, error: 'AlreadyActive' };
        }
      } else {
        return { success: false, storyId, error: 'AlreadyActive' };
      }
    }
    const story = this.registry.stories.get(storyId);
    if (!story) return { success: false, storyId, error: 'NotFound' };
    if (story.type !== expectedType) return { success: false, storyId, error: 'WrongStoryType' };
    if (story.pages.length === 0) return { success: false, storyId, error: 'NotFound' };
    if (story.availableInits.length > 0 && !story.availableInits.includes(this.state.activeInit)) {
      return { success: false, storyId, error: 'ConditionNotMet' };
    }
    if (story.triggerCondition && !this.conditionSystem.evaluateGroup(story.triggerCondition, this.state)) {
      return { success: false, storyId, error: 'ConditionNotMet' };
    }
    const repeatable = story.type === 'passive' ? story.repeatable : false;
    if (!repeatable && this.hasCompletedStory(story.id)) {
      return { success: false, storyId, error: 'AlreadyCompleted' };
    }
    if (this.isStoryOnCooldown(story)) return { success: false, storyId, error: 'Cooldown' };

    this.currentStoryId = story.id;
    this.currentStoryPageIndex = 0;
    this.currentStoryChoiceIndex = -1;
    this.talkletClickWork = null;
    this.opts.eventBus.emit({ type: 'storyTriggered', storyId: story.id });
    return { success: true, story: this.getCurrentStoryView()! };
  }

  getCurrentStoryView(): StoryView | null {
    if (this.currentStoryId === null) return null;
    const story = this.registry.stories.get(this.currentStoryId);
    const page = story?.pages[this.currentStoryPageIndex];
    if (!story || !page) return null;

    return {
      storyId: story.id,
      type: story.type,
      pageIndex: this.currentStoryPageIndex,
      totalPages: story.pages.length,
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

  private isStoryOnCooldown(_story: StoryDef): boolean {
    // PassiveTalk 无冷却限制；ActiveStory 不可重复，冷却由 `startStory` 的 repeatable 检查完全覆盖。
    return false;
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
