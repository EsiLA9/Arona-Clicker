import type {
  EffectId,
  GameTick,
  RuntimeCacheMut,
  VisibilityLevel,
} from "../01-foundation/types"
import { EventBus, EventTypes } from "./event-bus"

// ── Effect type constants ──

export const EffectType = {
  SpotProductionMultiply: "spot_production_multiply",
  SpotProductionAdd: "spot_production_add",
  SpotIntervalReduce: "spot_interval_reduce",
  ChatRewardMultiply: "chat_reward_multiply",
  ChatRewardAdd: "chat_reward_add",
  ResourceGainMultiply: "resource_gain_multiply",
  ResourceGainAdd: "resource_gain_add",
  PassiveStoryEntryWeight: "passive_story_entry_weight",
  ExplorationBoost: "exploration_boost",
  TravelCostReduce: "travel_cost_reduce",
  RevealEntity: "reveal_entity",
  GrantPurchaseAccess: "grant_purchase_access",
  UnlockArea: "unlock_area",
  UnlockEnhancement: "unlock_enhancement",
  UnlockStory: "unlock_story",
  ResourceCapAdd: "resource_cap_add",
  ResourceCapSet: "resource_cap_set",
  Custom: "custom",
} as const

export type EffectType = (typeof EffectType)[keyof typeof EffectType]

// ── Effect data structures ──

export interface EffectTarget {
  scope: "global" | "init" | "area" | "spot"
  id?: string
}

export interface EffectDefinition {
  id: EffectId
  type: EffectType
  target: EffectTarget
  operation: "add" | "multiply" | "percent" | "set"
  value: number
  duration?: number
}

// ── Effect instance (runtime) ──

export interface EffectInstance {
  definition: EffectDefinition
  sourceId: string
  remainingTicks?: number
}

// ── Compiled modifier (output of stacking) ──

export interface CompiledModifier {
  type: EffectType
  target: EffectTarget
  add: number
  multiply: number
  percent: number
  set: number | null
}

// ── EffectEngine ──

export class EffectEngine {
  private instances: EffectInstance[] = []
  private eventBus: EventBus
  private _version = 0

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  get allInstances(): readonly EffectInstance[] {
    return this.instances
  }

  get version(): number {
    return this._version
  }

  private bumpVersion(): void {
    this._version++
  }

  activate(def: EffectDefinition, sourceId: string, currentTick: GameTick): void {
    const inst: EffectInstance = {
      definition: def,
      sourceId,
      remainingTicks: def.duration,
    }
    this.instances.push(inst)
    this.bumpVersion()
    this.publishEffectEvent(inst, "activated", currentTick)
  }

  deactivate(sourceId: string, effectId: EffectId, currentTick: GameTick): void {
    const idx = this.instances.findIndex(
      (i) => i.sourceId === sourceId && i.definition.id === effectId,
    )
    if (idx === -1) return

    const removed = this.instances.splice(idx, 1)[0]
    this.bumpVersion()
    this.publishEffectEvent(removed, "deactivated", currentTick)
  }

  deactivateAllBySource(sourceId: string, currentTick: GameTick): void {
    const remaining: EffectInstance[] = []
    for (const inst of this.instances) {
      if (inst.sourceId === sourceId) {
        this.publishEffectEvent(inst, "deactivated", currentTick)
      } else {
        remaining.push(inst)
      }
    }
    if (remaining.length !== this.instances.length) this.bumpVersion()
    this.instances = remaining
  }

  tick(currentTick: GameTick): void {
    const remaining: EffectInstance[] = []
    let changed = false
    for (const inst of this.instances) {
      if (inst.definition.duration == null) {
        remaining.push(inst)
        continue
      }
      inst.remainingTicks! -= 1
      if (inst.remainingTicks! <= 0) {
        this.publishEffectEvent(inst, "expired", currentTick)
        changed = true
      } else {
        remaining.push(inst)
      }
    }
    if (changed) this.bumpVersion()
    this.instances = remaining
  }

  clear(): void {
    if (this.instances.length > 0) this.bumpVersion()
    this.instances = []
  }

  // ── Compiled modifier cache ──

  syncCache(runtime: RuntimeCacheMut, scope: string, targetId?: string): CompiledModifier[] {
    if (runtime.effectVersion === this._version && runtime.compiledModifiers) {
      return this.filterModifiers(runtime.compiledModifiers, scope, targetId)
    }
    const all = this.compileAll()
    runtime.compiledModifiers = all
    runtime.effectVersion = this._version
    return this.filterModifiers(all, scope, targetId)
  }

  private filterModifiers(all: CompiledModifier[], scope: string, targetId?: string): CompiledModifier[] {
    return all.filter((m) => {
      if (m.target.scope !== scope) return false
      if (targetId != null && m.target.id != null && m.target.id !== targetId) return false
      return true
    })
  }

  private compileAll(): CompiledModifier[] {
    const groups = new Map<string, EffectInstance[]>()
    for (const inst of this.instances) {
      const key = `${inst.definition.type}:${inst.definition.target.scope}:${inst.definition.target.id ?? ""}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(inst)
    }

    const result: CompiledModifier[] = []
    for (const instances of groups.values()) {
      const def = instances[0].definition
      let add = 0
      let multiply = 1
      let percent = 0
      let set: number | null = null

      for (const inst of instances) {
        switch (inst.definition.operation) {
          case "add":
            add += inst.definition.value
            break
          case "multiply":
            multiply *= inst.definition.value
            break
          case "percent":
            percent += inst.definition.value
            break
          case "set":
            if (set == null || inst.definition.value > set) {
              set = inst.definition.value
            }
            break
        }
      }

      result.push({ type: def.type, target: def.target, add, multiply, percent, set })
    }

    return result
  }

  // ── Legacy: direct compile (for external read-only use) ──

  compile(targetScope: EffectTarget["scope"], targetId?: string): CompiledModifier[] {
    const filtered = this.instances.filter((inst) => {
      const t = inst.definition.target
      if (t.scope !== targetScope) return false
      if (targetId != null && t.id != null && t.id !== targetId) return false
      return true
    })

    const groups = new Map<string, EffectInstance[]>()
    for (const inst of filtered) {
      const key = `${inst.definition.type}:${inst.definition.target.scope}:${inst.definition.target.id ?? ""}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(inst)
    }

    const result: CompiledModifier[] = []
    for (const instances of groups.values()) {
      const def = instances[0].definition
      let add = 0
      let multiply = 1
      let percent = 0
      let set: number | null = null

      for (const inst of instances) {
        switch (inst.definition.operation) {
          case "add":
            add += inst.definition.value
            break
          case "multiply":
            multiply *= inst.definition.value
            break
          case "percent":
            percent += inst.definition.value
            break
          case "set":
            if (set == null || inst.definition.value > set) {
              set = inst.definition.value
            }
            break
        }
      }

      result.push({ type: def.type, target: def.target, add, multiply, percent, set })
    }

    return result
  }

  applyToRuntime(
    cache: RuntimeCacheMut,
    currentTick: GameTick,
    targetScope: EffectTarget["scope"],
    targetId?: string,
  ): void {
    const modifiers = this.compile(targetScope, targetId)

    cache.activeEffects = []
    for (const mod of modifiers) {
      cache.activeEffects.push({
        effectId: `compiled:${mod.type}:${mod.target.scope}:${mod.target.id ?? ""}`,
        sourceId: "effect-engine",
      })
    }
  }

  private publishEffectEvent(
    inst: EffectInstance,
    action: "activated" | "deactivated" | "expired",
    tick: GameTick,
  ): void {
    this.eventBus.publish(EventTypes.StoryModifiedState, {
      story: inst.definition.id,
      modification: { action, type: inst.definition.type, sourceId: inst.sourceId },
    }, tick)
  }
}
