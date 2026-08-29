// ============================================================
// engine/def-factory/story-entry.ts — StoryEntry 定义链式 Builder
// active / passive 两种入口，共享 StoryEntryBase 字段。
// 羁绊剧情入口已并入 active（原 kizunaStory 移除）。
// .build() 返回对应标准 Entry（纯数据）。
// ============================================================

import type { TagPath } from '../core/tag';
import type { ExtraCompound } from '../types/extra';
import type { Condition, ConditionGroup, Effect } from '../types/expression';
import { Resource } from '../types/ids';
import type { InitId, StoryId } from '../types/ids';
import type { RevealTarget, RevealTrigger } from '../types/reveal';
import type {
  ActiveStoryEntry,
  BranchGuard,
  ConditionalReward,
  PassiveStoryEntry,
  StoryEntryBase,
} from '../types/content';
import { and } from './condition';

abstract class StoryEntryBaseBuilder {
  protected readonly _id: StoryId;
  protected _storyId: StoryId;
  protected _triggerCondition: ConditionGroup = and();
  protected _availableInits: InitId[] = [];
  protected _tags: TagPath[] = [];
  protected _revealTriggers: RevealTrigger[] = [];
  protected _replayable = false;
  protected _completionStrategy?: 'simple' | 'conditional';
  protected _conditionalRewards: ConditionalReward[] = [];
  protected _branchGuards: BranchGuard[] = [];
  protected _extra?: ExtraCompound;

  constructor(id: StoryId, storyId?: StoryId) {
    this._id = id;
    this._storyId = storyId ?? id;
  }

  /** 演出本体引用（缺省 = 自身 id）。 */
  story(storyId: StoryId): this { this._storyId = storyId; return this; }
  /** 可触发 Init（空 = 所有 Init）。 */
  inits(...initIds: InitId[]): this { this._availableInits = initIds; return this; }
  /** 触发条件组（缺省恒真）。 */
  when(condition: ConditionGroup): this { this._triggerCondition = condition; return this; }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  replayable(): this { this._replayable = true; return this; }
  /** 条件分支奖励包（completionStrategy='conditional' 时按声明顺序评估）。 */
  conditionalReward(condition: ConditionGroup, ...effects: Effect[]): this {
    this._conditionalRewards.push({ condition, effects });
    return this;
  }
  /** 分歧点准入守卫（replayable 时生效）。 */
  branchGuard(storyId: StoryId, prerequisites: { storyId: StoryId; talkletIndex: number }[], denialMessage: string): this {
    this._branchGuards.push({ storyId, prerequisites, denialMessage });
    return this;
  }
  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this {
    this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target });
    return this;
  }
  extra(value: ExtraCompound): this { this._extra = value; return this; }

  protected toBase(): StoryEntryBase {
    const def: StoryEntryBase = {
      id: this._id,
      storyId: this._storyId,
      triggerCondition: this._triggerCondition,
      availableInits: this._availableInits,
    };
    if (this._tags.length) def.tags = this._tags;
    if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers;
    if (this._replayable) def.replayable = true;
    if (this._completionStrategy) def.completionStrategy = this._completionStrategy;
    if (this._conditionalRewards.length) def.conditionalRewards = this._conditionalRewards;
    if (this._branchGuards.length) def.branchGuards = this._branchGuards;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

// --- active ---

export class ActiveStoryBuilder extends StoryEntryBaseBuilder {
  private _completionReward?: { first?: Effect[]; repeat?: Effect[] };
  private _owner?: string;

  completionStrategy(value: 'simple' | 'conditional'): this {
    this._completionStrategy = value;
    return this;
  }
  /** 首次完结奖励。 */
  rewardFirst(...effects: Effect[]): this {
    this._completionReward = { ...(this._completionReward ?? {}), first: effects };
    return this;
  }
  /** 重复完结奖励（一般不配置；配置后重复完成该 Story 才发放）。 */
  rewardRepeat(...effects: Effect[]): this {
    this._completionReward = { ...(this._completionReward ?? {}), repeat: effects };
    return this;
  }
  /** 归属学生差分（通讯录/故事栏按角色分组，以及聊天卡片对话空间路由）。 */
  owner(variantId: string): this { this._owner = variantId; return this; }

  build(): ActiveStoryEntry {
    const def: ActiveStoryEntry = { ...this.toBase(), type: 'active' };
    if (this._completionReward) def.completionReward = this._completionReward;
    if (this._owner) def.owner = this._owner;
    return def;
  }
}

// --- passive ---

export class PassiveStoryBuilder extends StoryEntryBaseBuilder {
  private _repeatable = true;
  private _weight = 1;
  private _completionReward?: { first?: Effect[]; repeat?: Effect[] };
  private _owner?: string;
  private _cooldownFrames?: number;
  private _block?: ConditionGroup;
  private _interruptible?: boolean;
  private _leaveArea?: boolean;
  private _affectionRequired?: number;

  /** 可重复触发（缺省 true，与 base 数据一致）。 */
  repeatable(value = true): this { this._repeatable = value; return this; }
  weight(value: number): this { this._weight = value; return this; }
  /** 首次完结奖励。 */
  rewardFirst(...effects: Effect[]): this {
    this._completionReward = { ...(this._completionReward ?? {}), first: effects };
    return this;
  }
  /** 重复完结奖励。 */
  rewardRepeat(...effects: Effect[]): this {
    this._completionReward = { ...(this._completionReward ?? {}), repeat: effects };
    return this;
  }
  /** 闲聊完结奖励快捷：青辉石（base 数据标准模式，first/repeat 均为 addResource Pyroxene）。 */
  rewardPyroxene(firstAmount: number, repeatAmount?: number): this {
    this._completionReward = {
      ...(this._completionReward ?? {}),
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: firstAmount }],
      ...(repeatAmount !== undefined ? { repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: repeatAmount }] } : {}),
    };
    return this;
  }
  owner(variantId: string): this { this._owner = variantId; return this; }
  cooldownFrames(value: number): this { this._cooldownFrames = value; return this; }
  /** 好感台阶门槛：好感达标才入就绪队列（声明后退出随机抽取，改按需求值升序推送）。 */
  affectionRequired(value: number): this { this._affectionRequired = value; return this; }
  block(condition: ConditionGroup): this { this._block = condition; return this; }
  /** 是否可被移动 Area 打断（缺省 true）。 */
  interruptible(value = true): this { this._interruptible = value; return this; }
  /** 播放中是否允许离开 Area（缺省 true）。 */
  leaveArea(value = true): this { this._leaveArea = value; return this; }

  build(): PassiveStoryEntry {
    const def: PassiveStoryEntry = {
      ...this.toBase(),
      type: 'passive',
      repeatable: this._repeatable,
      weight: this._weight,
    };
    if (this._completionReward) def.completionReward = this._completionReward;
    if (this._owner) def.owner = this._owner;
    if (this._cooldownFrames !== undefined) def.cooldownFrames = this._cooldownFrames;
    if (this._affectionRequired !== undefined) def.affectionRequired = this._affectionRequired;
    if (this._block) def.block = this._block;
    if (this._interruptible !== undefined) def.interruptible = this._interruptible;
    if (this._leaveArea !== undefined) def.leaveArea = this._leaveArea;
    return def;
  }
}

export const activeStory = (id: StoryId, storyId?: StoryId): ActiveStoryBuilder =>
  new ActiveStoryBuilder(id, storyId);
export const passiveStory = (id: StoryId, storyId?: StoryId): PassiveStoryBuilder =>
  new PassiveStoryBuilder(id, storyId);
