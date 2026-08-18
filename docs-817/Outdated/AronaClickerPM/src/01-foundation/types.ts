// ── Branded ID types ──

export type InitId = string & { readonly __brand: "InitId" }
export type AreaId = string & { readonly __brand: "AreaId" }
export type SpotId = string & { readonly __brand: "SpotId" }
export type EnhancementId = string & { readonly __brand: "EnhancementId" }
export type ResourceId = string & { readonly __brand: "ResourceId" }
export type EffectId = string & { readonly __brand: "EffectId" }
export type StoryId = string & { readonly __brand: "StoryId" }
export type ActiveStoryEntryId = string & { readonly __brand: "ActiveStoryEntryId" }
export type PassiveStoryEntryId = string & { readonly __brand: "PassiveStoryEntryId" }

// PassiveTalk 是 PassiveStoryEntry 的别名（由 chat.md 约定）
export type PassiveTalkId = PassiveStoryEntryId
export type ActiveTalkId = ActiveStoryEntryId

export type GameTick = number

// ── Arithmetic ──

export type ArithmeticOp = "add" | "sub" | "mul" | "div" | "min" | "max"
export type CompareOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte"

// ── Value 统一数值系统 ──

export type Value =
  | { type: "const"; value: number }
  | { type: "resource"; target: ResourceId }
  | { type: "resource_gained_total"; target: ResourceId }
  | { type: "resource_gained_init"; target: ResourceId }
  | { type: "flag"; key: string }
  | { type: "context_flag"; key: string }
  | { type: "spot_level"; target: SpotId }
  | { type: "enhancement_level"; target: EnhancementId }
  | { type: "tick" }
  | { type: "stat"; stat: "total_clicks" | "total_story_seen" }
  | { type: "tag_stat"; tag: string; dimension: "collected" | "triggered" }
  | { type: "op"; op: ArithmeticOp; args: Value[] }

// ── Condition 统一条件系统 ──

export type Condition =
  | { type: "always" }
  | { type: "never" }
  | { type: "and"; conditions: Condition[] }
  | { type: "or"; conditions: Condition[] }
  | { type: "not"; condition: Condition }
  | { type: "cmp"; op: CompareOp; left: Value; right: Value }
  | { type: "has_enhancement"; target: EnhancementId }
  | { type: "has_spot"; target: SpotId; minLevel?: Value }
  | { type: "has_label"; label: number }
  | { type: "area_explored"; target: AreaId }

// ── EvaluationContext（Value / Condition 求值时传入）──

export interface EvaluationContext {
  player: PlayerStateRef
  runtime: RuntimeCacheRef
  contextFlags?: Map<string, any>
  labels?: Set<number>
}

// ── Funclet / FuncList 统一状态修改 ──

export type Funclet =
  | { type: "add_resource"; target: ResourceId; value: Value }
  | { type: "set_player_flag"; key: string; value: Value }
  | { type: "give_spot"; target: SpotId; level?: Value }
  | { type: "give_enhancement"; target: EnhancementId; level?: Value }
  | { type: "set_context_flag"; key: string; value: number | string | boolean }
  | { type: "travel_to_area"; target: AreaId }
  | { type: "play_story"; storyId: StoryId; label?: number }
  | { type: "custom"; data: any }

export type FuncList = Funclet[]

// ── ExecutionContext（Funclet 执行时传入）──

export interface ExecutionContext {
  evalCtx: EvaluationContext
  player: PlayerStateMut
  runtime: RuntimeCacheMut
  storyContext?: StoryContextRef
  pendingStory?: string
}

// ── 游戏状态引用类型（求值器 / 执行器类型签名）──

// 与 docs/02-entity-definition/*.md 中的正式数据结构一一对应。
// PlayerStateRef / RuntimeCacheRef 为只读视角，Mut 后缀为可变视角。

export type VisibilityLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface ResourceLogRef {
  totalGained: number
  totalConsumed: number
  perInit: Record<string, { gained: number; consumed: number }>
}

export interface SpotStateRef {
  level: number
  lastProductionTick: GameTick
}

export interface EnhancementStateRef {
  unlocked: boolean
  active: boolean
}

export interface AreaStateRef {
  discovered: boolean
  unlocked: boolean
  explorationProgress: number
}

export interface TagStatRef {
  totalCollected: number
  totalTriggered: number
  uniqueItems: string[]
  perInit: Record<string, { collected: number; triggered: number }>
}

export interface StoryInstanceRef {
  currentTalkletIndex: number
  triggeredCount: number
  completed: boolean
}

export interface ChatHistoryEntryRef {
  tick: GameTick
  type: "story_talklet" | "system" | "action_result"
  data: any
  isNew: boolean
}

export interface PlayerStateRef {
  saveVersion: number
  createdAt: GameTick
  lastSaveAt: GameTick

  currentInit: string
  currentArea: string
  unlockedInits: string[]
  completedInits: string[]

  resources: Record<string, number>
  resourceLog: Record<string, ResourceLogRef>

  spots: Record<string, SpotStateRef>
  enhancements: Record<string, EnhancementStateRef>

  areaStates: Record<string, AreaStateRef>

  storyInstances: Record<string, StoryInstanceRef>

  tagStats: Record<string, TagStatRef>

  chatHistory: ChatHistoryEntryRef[]

  totalClicks: number
  totalStorySeen: number

  visibilityState: Record<string, VisibilityLevel>
  mutuallyExcluded: Record<string, string[]>
  flags: Record<string, any>
}

export interface PlayerStateMut extends PlayerStateRef {}

export interface SpotProductionCacheEntry {
  spotId: string
  resource: string
  baseAmount: number
  intervalTicks: number
  nextProductionTick: GameTick
}

export interface ActiveEffectRef {
  effectId: string
  sourceId: string
  remainingTicks?: number
}

export interface RuntimeCacheRef {
  currentTick: GameTick
  spotProductionCache: SpotProductionCacheEntry[]
  activeEffects: ActiveEffectRef[]
  isHibernating: boolean
  effectVersion: number
  compiledModifiers: any[]
}

export interface RuntimeCacheMut extends RuntimeCacheRef {}

export interface StoryContextRef {
  accumulatedFlags: Map<string, any>
}
