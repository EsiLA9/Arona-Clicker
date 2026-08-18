import type {
  Value,
  Condition,
  FuncList,
  ResourceId,
  SpotId,
  AreaId,
  EnhancementId,
  EffectId,
  StoryId,
  ActiveStoryEntryId,
  PassiveStoryEntryId,
  InitId,
  VisibilityLevel,
} from "../01-foundation/types"

// ── FullKey utilities ──

export type ModName = string
export type TypeName =
  | "init" | "area" | "resource" | "spot" | "enhancement"
  | "effect" | "story" | "activeStoryEntry" | "passiveStoryEntry"
export type IdName = string
export type FullKey = `${ModName}/${TypeName}/${IdName}`

export function makeFullKey(mod: ModName, type: TypeName, id: IdName): FullKey {
  return `${mod}/${type}/${id}` as FullKey
}

export function parseFullKey(key: FullKey): { mod: ModName; type: TypeName; id: IdName } {
  const parts = key.split("/")
  return { mod: parts[0], type: parts[1] as TypeName, id: parts.slice(2).join("/") }
}

// ── Raw datapack types (what JSON looks like) ──

export interface RawResource {
  idName: IdName
  name: string
  icon: string
  description: string
  category?: "currency" | "material" | "special" | "collectible"
  baseValue?: number
  maxValue?: number
  persistent?: boolean
}

export interface RawCostScaling {
  base: number
  exponent: number
}

export interface RawResourceAmount {
  resource: string
  amount: number
}

export interface RawResourceCost {
  resource: string
  amount: number
  scaling?: RawCostScaling
}

export interface RawResourceProduction {
  resource: string
  baseAmount: number
  intervalTicks: number
  perLevel?: number
}

export interface RawEffectTarget {
  scope: "global" | "init" | "area" | "spot"
  id?: string
}

export interface RawEffect {
  idName: IdName
  type: string
  target: RawEffectTarget
  operation: "add" | "multiply" | "percent" | "set"
  value: number
  duration?: number
}

export interface RawVisibility {
  1?: Condition
  2?: Condition
  3?: Condition
  4?: Condition
}

export interface RawSpot {
  idName: IdName
  name: string
  description: string
  icon: string
  parentArea: string
  productions: RawResourceProduction[]
  cost: RawResourceCost
  costScaling?: RawCostScaling
  maxLevel?: number
  visibility?: RawVisibility
  unlockCondition?: Condition
  effects: string[]
  tags?: string[]
}

export interface RawArea {
  idName: IdName
  name: string
  description: string
  parentInit: string
  visibility?: RawVisibility
  unlockCondition?: Condition
  adjacentAreas?: string[]
  discoveryCost?: RawResourceCost
  purchaseCost?: RawResourceCost
  spots: string[]
  passiveStoryEntries: string[]
  activeStoryEntries: string[]
  explorationMax: number
  isExitPoint?: boolean
  environmentTags?: string[]
}

export interface RawEnhancement {
  idName: IdName
  name: string
  description: string
  icon: string
  category: string
  scope?: "init" | "global"
  parentArea?: string
  cost: RawResourceCost
  effects: string[]
  prerequisites?: Condition[]
  togglable?: boolean
  tags?: string[]
}

export interface RawInit {
  idName: IdName
  name: string
  description: string
  icon: string
  areas: string[]
  startingArea: string
  defaultArea: string
  defaultAreaCooldown: number
  entryRequirements?: Condition
  exitConditions?: any[]
  startingActions?: FuncList
  inheritResources?: boolean
  inheritSpots?: boolean
  inheritEnhancements?: boolean
}

export interface RawStoryEntryBase {
  idName: IdName
  story: string
  prerequisites?: Condition
  weight?: number
  cooldownTicks?: number
  visibility?: RawVisibility
  contextBehavior?: any
  tags?: string[]
}

export interface RawActiveStoryEntry extends RawStoryEntryBase {
  type: "active"
  parentArea: string
  category?: string
}

export interface RawPassiveStoryEntry extends RawStoryEntryBase {
  type: "passive"
  parentArea: string
}

export interface RawStory {
  idName: IdName
  talklets: any[]
}

export interface RawChatConfig {
  baseReward: number
  baseIntervalTicks: number
  passiveStoryEntrySlots: number
}

export interface RawDatapackContents {
  resources?: RawResource[]
  inits?: RawInit[]
  areas?: RawArea[]
  spots?: RawSpot[]
  enhancements?: RawEnhancement[]
  effects?: RawEffect[]
  stories?: RawStory[]
  activeStoryEntries?: RawActiveStoryEntry[]
  passiveStoryEntries?: RawPassiveStoryEntry[]
  chat?: RawChatConfig
}

export interface RawDatapack {
  id: string
  name: string
  version: string
  description: string
  dependencies?: string[]
  priority: number
  contents: RawDatapackContents
}

// ── Compiled definition types (after FullKey resolution) ──

export interface ResourceDef {
  id: ResourceId
  name: string
  icon: string
  description: string
  category: "currency" | "material" | "special" | "collectible"
  baseValue: number
  maxValue?: number
  persistent: boolean
}

export interface ResourceAmount {
  resource: string
  amount: number
}

export interface ResourceCost {
  resource: string
  amount: number
  scaling?: { base: number; exponent: number }
}

export interface ResourceProduction {
  resource: string
  baseAmount: number
  intervalTicks: number
  perLevel: number
}

export interface EffectTarget {
  scope: "global" | "init" | "area" | "spot"
  id?: string
}

export interface EffectDef {
  id: EffectId
  type: string
  target: EffectTarget
  operation: "add" | "multiply" | "percent" | "set"
  value: number
  duration?: number
}

export interface SpotDef {
  id: SpotId
  name: string
  description: string
  icon: string
  parentArea: AreaId
  productions: ResourceProduction[]
  cost: ResourceCost
  costScaling?: { base: number; exponent: number }
  maxLevel?: number
  visibility?: RawVisibility
  effects: EffectId[]
  tags: string[]
}

export interface AreaDef {
  id: AreaId
  name: string
  description: string
  parentInit: InitId
  visibility?: RawVisibility
  adjacentAreas: AreaId[]
  discoveryCost?: ResourceCost
  purchaseCost?: ResourceCost
  spots: SpotId[]
  passiveStoryEntries: PassiveStoryEntryId[]
  activeStoryEntries: ActiveStoryEntryId[]
  explorationMax: number
  isExitPoint: boolean
  environmentTags: string[]
}

export interface EnhancementDef {
  id: EnhancementId
  name: string
  description: string
  icon: string
  category: string
  scope: "init" | "global"
  parentArea?: AreaId
  cost: ResourceCost
  effects: EffectId[]
  prerequisites?: Condition[]
  togglable: boolean
  tags: string[]
}

export interface InitDef {
  id: InitId
  name: string
  description: string
  icon: string
  areas: AreaId[]
  startingArea: AreaId
  defaultArea: AreaId
  defaultAreaCooldown: number
  entryRequirements?: Condition
  exitConditions: any[]
  startingActions: FuncList
  inheritResources: boolean
  inheritSpots: boolean
  inheritEnhancements: boolean
}

export interface StoryEntryDefBase {
  id: string
  story: StoryId
  prerequisites?: Condition
  weight: number
  cooldownTicks: number
  visibility?: RawVisibility
  contextBehavior?: any
  tags: string[]
}

export interface ActiveStoryEntryDef extends StoryEntryDefBase {
  parentArea: AreaId
  category?: string
}

export interface PassiveStoryEntryDef extends StoryEntryDefBase {
  parentArea: AreaId
}

export interface StoryDef {
  id: StoryId
  talklets: any[]
}

export interface ChatConfigDef {
  baseReward: number
  baseIntervalTicks: number
  passiveStoryEntrySlots: number
}

// ── Union definition type ──

export type Definition =
  | ResourceDef | InitDef | AreaDef | SpotDef
  | EnhancementDef | EffectDef | StoryDef
  | ActiveStoryEntryDef | PassiveStoryEntryDef
