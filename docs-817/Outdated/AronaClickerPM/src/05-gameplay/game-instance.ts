import type { GameTick } from "../01-foundation/types"
import type { PlayerStateMut, RuntimeCacheMut } from "../01-foundation/types"
import type { FullKey } from "../03-registry/types"
import type { InitDef, AreaDef, SpotDef } from "../03-registry/types"
import type { SaveGameData } from "./persistence"
import { serializePlayer, deserializePlayer } from "./persistence"
import { GameRegistry } from "../03-registry/registry"
import { EventBus, EventTypes } from "../04-engine-core/event-bus"
import { evaluateCondition } from "../01-foundation/evaluator"
import { executeFuncList } from "../01-foundation/funclet-executor"
import { EffectEngine, EffectType } from "../04-engine-core/effect-engine"
import { VisibilityEngine } from "../04-engine-core/visibility-engine"

export interface GameInstanceOptions {
  registry: GameRegistry
  eventBus?: EventBus
}

export class GameInstance {
  readonly registry: GameRegistry
  readonly eventBus: EventBus
  readonly effectEngine: EffectEngine
  readonly visibilityEngine: VisibilityEngine

  player!: PlayerStateMut
  runtime!: RuntimeCacheMut
  tickCount: GameTick = 0

  constructor(opts: GameInstanceOptions) {
    this.registry = opts.registry
    this.eventBus = opts.eventBus ?? new EventBus()
    this.effectEngine = new EffectEngine(this.eventBus)
    this.visibilityEngine = new VisibilityEngine(opts.registry, this.eventBus)
  }

  // ── PlayerState factory ──

  createPlayerState(): PlayerStateMut {
    return {
      saveVersion: 1,
      createdAt: 0,
      lastSaveAt: 0,
      currentInit: "",
      currentArea: "",
      unlockedInits: [],
      completedInits: [],
      resources: {},
      resourceLog: {},
      flags: {},
      spots: {},
      enhancements: {},
      areaStates: {},
      storyInstances: {},
      tagStats: {},
      chatHistory: [],
      totalClicks: 0,
      totalStorySeen: 0,
      visibilityState: {},
      mutuallyExcluded: {},
    }
  }

  // ── RuntimeCache factory ──

  createRuntimeCache(): RuntimeCacheMut {
    return {
      currentTick: 0,
      spotProductionCache: [],
      activeEffects: [],
      isHibernating: false,
      effectVersion: 0,
      compiledModifiers: [],
    }
  }

  // ── Init entry ──

  enterInit(initKey: FullKey): boolean {
    const initDef = this.registry.getDefinition<InitDef>(initKey)
    if (!initDef) return false

    // check entryRequirements
    if (initDef.entryRequirements) {
      const ctx = this.buildEvalCtx()
      if (!evaluateCondition(initDef.entryRequirements, ctx)) return false
    }

    // fresh or switching: build state and runtime
    const isNew = !this.player
    if (isNew) {
      this.player = this.createPlayerState()
      this.runtime = this.createRuntimeCache()
    }

    // initialize area states for all areas in this init
    for (const areaKey of initDef.areas) {
      if (!this.player.areaStates[areaKey]) {
        this.player.areaStates[areaKey] = {
          discovered: false,
          unlocked: false,
          explorationProgress: 0,
        }
      }
    }

    // starting area is discovered + unlocked
    const startingArea = initDef.startingArea
    if (this.player.areaStates[startingArea]) {
      this.player.areaStates[startingArea].discovered = true
      this.player.areaStates[startingArea].unlocked = true
    }

    // set init and starting position
    this.player.currentInit = initKey
    this.player.currentArea = startingArea

    // execute startingActions
    if (initDef.startingActions.length > 0) {
      const execCtx = this.buildExecCtx()
      executeFuncList(initDef.startingActions, execCtx)
      // if play_story was called, pendingStory is set on execCtx
    }

    // verify currentArea validity
    const areaState = this.player.areaStates[this.player.currentArea]
    if (!areaState || !areaState.unlocked) {
      this.player.currentArea = startingArea
    }

    // register init as unlocked
    if (!this.player.unlockedInits.includes(initKey)) {
      this.player.unlockedInits.push(initKey)
    }

    // rebuild runtime
    this.rebuildRuntime()

    // attach visibility engine and scan conditions
    this.visibilityEngine.attach(this.player, this.runtime)
    this.visibilityEngine.scanAndBind()

    this.eventBus.publish(EventTypes.InitChanged, { to: initKey }, this.tickCount)

    return true
  }

  // ── Init switching with inheritance ──

  switchInit(newInitKey: FullKey): boolean {
    const oldInitKey = this.player.currentInit
    const oldInitDef = oldInitKey ? this.registry.getDefinition<InitDef>(oldInitKey) : undefined
    const newInitDef = this.registry.getDefinition<InitDef>(newInitKey)
    if (!newInitDef) return false

    // check entryRequirements of new init
    if (newInitDef.entryRequirements) {
      const ctx = this.buildEvalCtx()
      if (!evaluateCondition(newInitDef.entryRequirements, ctx)) return false
    }

    // inheritance: keep global/persistent, conditionally keep init-scoped
    const preservedResources: Record<string, number> = {}
    const preservedEnhancements: Record<string, any> = {}
    const preservedFlags: Record<string, any> = {}
    const preservedTagStats: Record<string, any> = {}

    // persistent resources always survive
    for (const [key, amount] of Object.entries(this.player.resources)) {
      const resDef = this.registry.getDefinition(key)
      const persistent = (resDef as any)?.persistent === true
      if (persistent) preservedResources[key] = amount
    }

    // inheritResources: keep all resources
    if (oldInitDef?.inheritResources) {
      for (const [key, amount] of Object.entries(this.player.resources)) {
        preservedResources[key] = amount
      }
    }

    // global-scope enhancements always survive
    for (const [key, state] of Object.entries(this.player.enhancements)) {
      const enhDef = this.registry.getDefinition(key) as any
      if (enhDef?.scope === "global") preservedEnhancements[key] = { ...state }
    }

    // inheritEnhancements: keep init-scoped enhancements
    if (oldInitDef?.inheritEnhancements) {
      for (const [key, state] of Object.entries(this.player.enhancements)) {
        const enhDef = this.registry.getDefinition(key) as any
        if (enhDef?.scope !== "global" && !preservedEnhancements[key]) {
          preservedEnhancements[key] = { ...state }
        }
      }
    }

    // inherit flags
    if (oldInitDef?.inheritResources) {
      Object.assign(preservedFlags, this.player.flags)
    }

    // inherit tag stats
    if (oldInitDef?.inheritResources) {
      Object.assign(preservedTagStats, this.player.tagStats)
    }

    // deactivate old effects
    this.effectEngine.clear()

    // build fresh state
    const newPlayer = this.createPlayerState()
    newPlayer.resources = preservedResources
    newPlayer.enhancements = preservedEnhancements
    newPlayer.flags = preservedFlags
    newPlayer.tagStats = preservedTagStats
    newPlayer.unlockedInits = [...this.player.unlockedInits]
    newPlayer.completedInits = [...this.player.completedInits]
    newPlayer.totalClicks = this.player.totalClicks
    newPlayer.totalStorySeen = this.player.totalStorySeen
    newPlayer.chatHistory = [...this.player.chatHistory]

    this.player = newPlayer

    // enter the new init (initializes areas, runs startingActions)
    const entered = this.enterInit(newInitKey)
    if (!entered) return false

    // reactivate inherited enhancements' effects
    this.rebuildRuntime()

    this.eventBus.publish(EventTypes.InitChanged, { from: oldInitKey, to: newInitKey }, this.tickCount)

    return true
  }

  // ── Area travel ──

  travelToArea(targetAreaKey: FullKey): boolean {
    const currentAreaKey = this.player.currentArea
    if (targetAreaKey === currentAreaKey) return true

    const targetAreaDef = this.registry.getDefinition<AreaDef>(targetAreaKey)
    if (!targetAreaDef) return false

    const currentAreaDef = this.registry.getDefinition<AreaDef>(currentAreaKey)
    if (!currentAreaDef) return false

    // path validation: target must be adjacent to current area
    if (!currentAreaDef.adjacentAreas.includes(targetAreaKey)) return false

    // auto-discover + unlock target area's area state
    const areaState = this.player.areaStates[targetAreaKey] ?? {
      discovered: false,
      unlocked: false,
      explorationProgress: 0,
    }

    if (!areaState.discovered) {
      // check discovery cost
      if (targetAreaDef.discoveryCost) {
        const cost = targetAreaDef.discoveryCost
        if ((this.player.resources[cost.resource] ?? 0) < cost.amount) return false
        this.player.resources[cost.resource] = (this.player.resources[cost.resource] ?? 0) - cost.amount
      }
      areaState.discovered = true
    }

    if (!areaState.unlocked) {
      if (targetAreaDef.purchaseCost) {
        const cost = targetAreaDef.purchaseCost
        if ((this.player.resources[cost.resource] ?? 0) < cost.amount) return false
        this.player.resources[cost.resource] = (this.player.resources[cost.resource] ?? 0) - cost.amount
      }
      areaState.unlocked = true
    }

    if (!areaState.unlocked) return false

    this.player.areaStates[targetAreaKey] = areaState
    this.player.currentArea = targetAreaKey

    this.eventBus.publish(EventTypes.AreaEntered, { area: targetAreaKey, init: this.player.currentInit }, this.tickCount)

    return true
  }

  // ── Resource caps ──

  getEffectiveCap(resourceKey: string): number | undefined {
    const resDef = this.registry.getDefinition<any>(resourceKey)
    const baseCap = resDef?.maxValue

    const mods = this.effectEngine.syncCache(this.runtime, "global")
    const initMods = this.effectEngine.syncCache(this.runtime, "init", this.player.currentInit)

    let add = 0
    let set: number | null = null

    for (const mod of [...mods, ...initMods]) {
      if (mod.type === EffectType.ResourceCapAdd && mod.target.id === resourceKey) {
        add += mod.add
      }
      if (mod.type === EffectType.ResourceCapAdd && !mod.target.id && baseCap != null) {
        add += mod.add
      }
      if (mod.type === EffectType.ResourceCapSet && mod.target.id === resourceKey) {
        if (set == null || mod.set! > set) set = mod.set
      }
    }

    if (baseCap == null && add === 0 && set == null) return undefined

    const computed = (baseCap ?? 0) + add
    if (set != null) return Math.max(computed, set)
    return computed
  }

  private capResource(key: string): void {
    const cap = this.getEffectiveCap(key)
    if (cap == null) return
    const cur = this.player.resources[key] ?? 0
    if (cur > cap) this.player.resources[key] = cap
  }

  // ── Tick ──

  tick(): void {
    this.tickCount++
    this.runtime.currentTick = this.tickCount
    this.runtime.isHibernating = false

    // compute spot production
    const productions = this.computeProductions()
    for (const prod of productions) {
      this.player.resources[prod.resource] = (this.player.resources[prod.resource] ?? 0) + prod.amount
      const log = this.player.resourceLog[prod.resource]
      if (log) {
        log.totalGained += prod.amount
        const perInit = log.perInit[this.player.currentInit]
        if (perInit) perInit.gained += prod.amount
      }
    }

    // cap resources after production
    for (const prod of productions) {
      this.capResource(prod.resource)
    }

    // produce events (skip if no listeners)
    if (this.eventBus.hasSubscribers(EventTypes.ResourceAdded)) {
      for (const prod of productions) {
        this.eventBus.publish(EventTypes.ResourceAdded, {
          resource: prod.resource, amount: prod.amount,
          newTotal: this.player.resources[prod.resource] ?? 0,
          init: this.player.currentInit,
        }, this.tickCount)
      }
    }

    // tick effect engine (expire timed effects)
    this.effectEngine.tick(this.tickCount)

    if (this.eventBus.hasSubscribers(EventTypes.TickPassed)) {
      this.eventBus.publish(EventTypes.TickPassed, { tick: this.tickCount }, this.tickCount)
    }
  }

  // ── Persistence ──

  save(): SaveGameData {
    return serializePlayer(this.player, this.tickCount)
  }

  loadFromSave(save: SaveGameData): boolean {
    const { player, tickCount } = deserializePlayer(save)
    this.player = player
    this.tickCount = tickCount
    this.rebuildRuntime()
    this.visibilityEngine.attach(this.player, this.runtime)
    this.visibilityEngine.scanAndBind()
    this.eventBus.publish(EventTypes.SaveLoaded, { tick: this.tickCount }, this.tickCount)
    return true
  }

  // ── Internal helpers ──

  private buildEvalCtx() {
    return {
      player: this.player,
      runtime: this.runtime,
    }
  }

  private buildExecCtx() {
    return {
      evalCtx: this.buildEvalCtx(),
      player: this.player,
      runtime: this.runtime,
    }
  }

  rebuildRuntime(): void {
    this.runtime = this.createRuntimeCache()
    this.runtime.currentTick = this.tickCount

    // activate effects from owned enhancements
    const initDef = this.registry.getDefinition<InitDef>(this.player.currentInit)

    // gather spot effects for spot production cache
    for (const [spotKey, spotState] of Object.entries(this.player.spots)) {
      if (spotState.level <= 0) continue
      const spotDef = this.registry.getDefinition<SpotDef>(spotKey)
      if (!spotDef) continue

      // add to production cache
      for (const prod of spotDef.productions) {
        const effectiveAmount = prod.baseAmount + (spotState.level - 1) * prod.perLevel
        this.runtime.spotProductionCache.push({
          spotId: spotKey,
          resource: prod.resource,
          baseAmount: effectiveAmount,
          intervalTicks: prod.intervalTicks,
          nextProductionTick: spotState.lastProductionTick + prod.intervalTicks,
        })
      }
    }

    // activate enhancement effects
    for (const [enhKey, enhState] of Object.entries(this.player.enhancements)) {
      if (!enhState.unlocked || !enhState.active) continue
      const enhDef = this.registry.getDefinition(enhKey) as any
      if (!enhDef) continue

      for (const effectRef of enhDef.effects) {
        const effectDef = this.registry.getDefinition(effectRef)
        if (effectDef) {
          this.effectEngine.activate(effectDef as any, enhKey, this.tickCount)
        }
      }
    }

    // spot effects
    for (const [spotKey, spotState] of Object.entries(this.player.spots)) {
      if (spotState.level <= 0) continue
      const spotDef = this.registry.getDefinition<SpotDef>(spotKey)
      if (!spotDef) continue
      for (const effectRef of spotDef.effects) {
        const effectDef = this.registry.getDefinition(effectRef)
        if (effectDef) {
          this.effectEngine.activate(effectDef as any, spotKey, this.tickCount)
        }
      }
    }

    // inject compiled modifiers into runtime
    this.effectEngine.applyToRuntime(this.runtime, this.tickCount, "global")
    this.effectEngine.applyToRuntime(this.runtime, this.tickCount, "init", this.player.currentInit)
  }

  private computeProductions(): { resource: string; amount: number }[] {
    const productions: Record<string, number> = {}
    const globalMods = this.effectEngine.syncCache(this.runtime, "global")
    const initMods = this.effectEngine.syncCache(this.runtime, "init", this.player.currentInit)

    for (const entry of this.runtime.spotProductionCache) {
      if (this.tickCount < entry.nextProductionTick) continue

      let amount = entry.baseAmount
      const spotMods = this.effectEngine.syncCache(this.runtime, "spot", entry.spotId)
      const all = spotMods.length + initMods.length + globalMods.length > 0
        ? [...globalMods, ...initMods, ...spotMods]
        : []

      for (const mod of all) {
        if (mod.type === "spot_production_multiply") amount *= mod.multiply
        if (mod.type === "spot_production_add") amount += mod.add
      }

      productions[entry.resource] = (productions[entry.resource] ?? 0) + Math.floor(amount)

      const spotState = this.player.spots[entry.spotId]
      if (spotState) spotState.lastProductionTick = this.tickCount
    }

    return Object.entries(productions).map(([resource, amount]) => ({ resource, amount }))
  }
}
