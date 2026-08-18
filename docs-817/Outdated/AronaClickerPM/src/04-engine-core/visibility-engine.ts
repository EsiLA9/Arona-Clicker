import type { Condition, GameTick, VisibilityLevel } from "../01-foundation/types"
import type { PlayerStateMut, RuntimeCacheMut } from "../01-foundation/types"
import { evaluateCondition } from "../01-foundation/evaluator"
import { GameRegistry } from "../03-registry/registry"
import { EventBus, EventTypes } from "./event-bus"

export interface VisibilityTrigger {
  entityKey: string
  targetLevel: VisibilityLevel
  condition: Condition
  subId: string
}

export class VisibilityEngine {
  private registry: GameRegistry
  private eventBus: EventBus
  private triggers: VisibilityTrigger[] = []
  private player: PlayerStateMut | null = null
  private runtime: RuntimeCacheMut | null = null

  constructor(registry: GameRegistry, eventBus: EventBus) {
    this.registry = registry
    this.eventBus = eventBus
  }

  get activeTriggers(): readonly VisibilityTrigger[] {
    return this.triggers
  }

  attach(player: PlayerStateMut, runtime: RuntimeCacheMut): void {
    this.player = player
    this.runtime = runtime
  }

  detach(): void {
    this.player = null
    this.runtime = null
  }

  scanAndBind(): void {
    this.clearTriggers()

    for (const type of ["spot", "area", "enhancement", "init", "activeStoryEntry", "passiveStoryEntry"] as const) {
      const defs = this.registry.queryByType(type)
      for (const d of defs) {
        const def = d as any
        const vis = def.visibility
        if (!vis) continue
        const key = def.id

        // process levels 1-4, higher levels first so triggers are ordered
        for (let level = 4; level >= 1; level--) {
          const cond = vis[level as 1 | 2 | 3 | 4]
          if (!cond) continue
          this.bindTrigger(key, level as VisibilityLevel, cond)
        }
      }
    }
  }

  checkEntity(key: string): void {
    if (!this.player) return
    const def = this.registry.getDefinition(key)
    if (!def) return
    const vis = (def as any).visibility
    if (!vis) return

    for (let level = 4; level >= 1; level--) {
      const cond = vis[level as 1 | 2 | 3 | 4]
      if (!cond) continue
      const currentLevel = this.player.visibilityState[key] ?? 0
      if (currentLevel >= level) continue
      const ctx = { player: this.player, runtime: this.runtime! }
      if (evaluateCondition(cond, ctx)) {
        this.setVisibility(key, level)
        break // highest applicable level reached
      }
    }
  }

  private bindTrigger(entityKey: string, targetLevel: VisibilityLevel, condition: Condition): void {
    // always conditions → set immediately, no trigger needed
    if (condition.type === "always") {
      this.setVisibility(entityKey, targetLevel)
      return
    }

    // for other conditions, check immediately and also subscribe to resource events
    this.checkAndSet(entityKey, targetLevel, condition)

    // subscribe to resource changes so we re-check
    const subId = `vis_${entityKey}_lv${targetLevel}`
    this.eventBus.subscribe(EventTypes.ResourceAdded, () => {
      if (!this.player) return
      this.checkAndSet(entityKey, targetLevel, condition)
    })

    this.triggers.push({ entityKey, targetLevel, condition, subId })
  }

  private checkAndSet(entityKey: string, targetLevel: VisibilityLevel, condition: Condition): void {
    if (!this.player) return
    const currentLevel = this.player.visibilityState[entityKey] ?? 0
    if (currentLevel >= targetLevel) return
    const ctx = { player: this.player, runtime: this.runtime! }
    if (evaluateCondition(condition, ctx)) {
      this.setVisibility(entityKey, targetLevel)
    }
  }

  private setVisibility(entityKey: string, level: VisibilityLevel): void {
    if (!this.player) return
    const current = this.player.visibilityState[entityKey] ?? 0
    if (level <= current) return

    this.player.visibilityState[entityKey] = level

    // remove all triggers for levels ≤ this one (higher level supersedes lower)
    this.triggers = this.triggers.filter(t => {
      if (t.entityKey !== entityKey) return true
      if (t.targetLevel <= level) {
        // trigger's subscription is still active but will be filtered out
        return false
      }
      return true
    })
  }

  clearTriggers(): void {
    this.triggers = []
  }
}
