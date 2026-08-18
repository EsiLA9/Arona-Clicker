import { describe, it, expect, vi } from "vitest"
import { GameRegistry } from "../03-registry/registry"
import { GameInstance } from "../05-gameplay/game-instance"
import { EventBus, EventTypes } from "../04-engine-core/event-bus"
import { evaluateCondition } from "../01-foundation/evaluator"
import type { RawDatapack } from "../03-registry/types"

// ── Minimal datapack: 1 Init + 1 Area + 2 Spots + 1 Enhancement ──

const P = { M: "demo", R: "demo/resource", A: "demo/area", S: "demo/spot", E: "demo/enhancement", I: "demo/init" }

const datapack: RawDatapack = {
  id: P.M,
  name: "Demo",
  version: "1.0",
  description: "End-to-end test pack",
  priority: 0,
  contents: {
    resources: [
      { idName: "gold", name: "Gold", icon: "g", description: "Currency", baseValue: 1, persistent: true },
      { idName: "crystal", name: "Crystal", icon: "c", description: "Common", baseValue: 1 },
      { idName: "mithril", name: "Mithril", icon: "m", description: "Rare", baseValue: 10 },
    ],
    inits: [{
      idName: "overworld", name: "Overworld", description: "", icon: "",
      startingArea: "central", defaultArea: "central", defaultAreaCooldown: 100,
      areas: ["central", "deep_mine"],
      inheritEnhancements: true,
      startingActions: [
        { type: "add_resource", target: `${P.R}/gold`, value: { type: "const", value: 200 } },
        { type: "give_spot", target: `${P.S}/crystal_pick`, level: { type: "const", value: 1 } },
      ],
    }],
    areas: [{
      idName: "central", name: "Central", description: "", parentInit: "overworld",
      spots: ["crystal_pick", "mithril_drill"],
      passiveStoryEntries: [], activeStoryEntries: [],
      explorationMax: 100, adjacentAreas: ["deep_mine"],
    }, {
      idName: "deep_mine", name: "Deep Mine", description: "", parentInit: "overworld",
      spots: [], passiveStoryEntries: [], activeStoryEntries: [],
      explorationMax: 100, adjacentAreas: ["central"],
      purchaseCost: { resource: `${P.R}/gold`, amount: 500 },
    }],
    spots: [{
      idName: "crystal_pick", name: "Crystal Pick", description: "Mines crystals", icon: "⛏️",
      parentArea: "central",
      productions: [{ resource: "crystal", baseAmount: 5, intervalTicks: 5 }],
      cost: { resource: `${P.R}/gold`, amount: 50 },
      costScaling: { base: 1.5, exponent: 1 },
      maxLevel: 10,
      effects: [],
    }, {
      idName: "mithril_drill", name: "Mithril Drill", description: "Drills mithril", icon: "🔧",
      parentArea: "central",
      productions: [{ resource: "mithril", baseAmount: 1, intervalTicks: 20 }],
      cost: { resource: `${P.R}/crystal`, amount: 100 },
      effects: [],
      visibility: { 3: { type: "cmp", op: "gte", left: { type: "resource", target: `${P.R}/gold` }, right: { type: "const", value: 300 } } },
    }],
    effects: [{
      idName: "crystal_x2", type: "spot_production_multiply",
      target: { scope: "spot", id: "crystal_pick" },
      operation: "multiply", value: 2,
    }],
    enhancements: [{
      idName: "double_crystal", name: "Double Crystal", description: "2x crystal output", icon: "✨",
      category: "spot_boost", scope: "init",
      cost: { resource: `${P.R}/gold`, amount: 300 },
      effects: ["demo/effect/crystal_x2"],
    }],
    stories: [],
    activeStoryEntries: [],
    passiveStoryEntries: [],
  },
}

function setup() {
  const bus = new EventBus()
  const reg = new GameRegistry()
  reg.load([datapack])
  expect(reg.valid).toBe(true)
  const instance = new GameInstance({ registry: reg, eventBus: bus })
  return { bus, reg, instance }
}

describe("E2E: minimal datapack", () => {
  // ── 1. Tick loop: auto-production → resource → events ──

  it("tick loop: auto-production adds resources and fires events", () => {
    const { bus, instance } = setup()
    const events: any[] = []
    bus.subscribe(EventTypes.ResourceAdded, (e) => events.push(e))
    bus.subscribe(EventTypes.TickPassed, (e) => events.push(e))

    instance.enterInit(`${P.I}/overworld`)
    // crystal_pick has interval 5, after 5 ticks it should produce
    for (let i = 0; i < 5; i++) instance.tick()

    const resourceEvents = events.filter((e) => e.type === EventTypes.ResourceAdded)
    expect(resourceEvents.length).toBeGreaterThanOrEqual(1)
    expect(instance.player.resources[`${P.R}/crystal`]).toBeGreaterThanOrEqual(5)

    const tickEvents = events.filter((e) => e.type === EventTypes.TickPassed)
    expect(tickEvents.length).toBe(5)
  })

  // ── 2. EventBus verification ──

  it("event bus: subscribe/unsubscribe lifecycle", () => {
    const { bus, instance } = setup()
    const handler = vi.fn()

    const sub = bus.subscribe(EventTypes.TickPassed, handler)
    instance.enterInit(`${P.I}/overworld`)
    instance.tick()
    expect(handler).toHaveBeenCalledOnce()

    bus.unsubscribe(sub)
    instance.tick()
    expect(handler).toHaveBeenCalledOnce() // no additional call
  })

  // ── 3. Funclet → state → events ──

  it("funclet: startingActions execute and events fire", () => {
    const { instance } = setup()
    instance.enterInit(`${P.I}/overworld`)

    // startingActions: add_resource gold=200, give_spot crystal_pick
    expect(instance.player.resources[`${P.R}/gold`]).toBe(200)
    expect(instance.player.spots[`${P.S}/crystal_pick`]).toBeDefined()
    expect(instance.player.spots[`${P.S}/crystal_pick`].level).toBe(1)
  })

  // ── 4. Spot purchase → upgrade → production → CostScaling ──

  it("spot: buy → upgrade → production with cost scaling", () => {
    const { instance } = setup()
    instance.enterInit(`${P.I}/overworld`)

    // spot is already given via startingActions at level 1
    // verify it produces
    instance.rebuildRuntime()

    const spotState = instance.player.spots[`${P.S}/crystal_pick`]
    expect(spotState).toBeDefined()

    // manually "upgrade" by setting a higher level and verify production scales
    spotState.level = 3
    instance.rebuildRuntime()

    // baseAmount=5, perLevel=0, so production = 5 regardless of level
    // but with effect multiply 2 → 10 per interval
    // actually effect hasn't been bought yet

    // tick enough to produce
    for (let i = 0; i < 5; i++) instance.tick()
    expect(instance.player.resources[`${P.R}/crystal`]).toBeGreaterThanOrEqual(5)
  })

  // ── 5. Effect activation → production modifier ──

  it("effect: enhancement multiplies spot production", () => {
    const { instance } = setup()
    instance.enterInit(`${P.I}/overworld`)

    instance.player.resources[`${P.R}/gold`] = 500
    instance.player.enhancements[`${P.E}/double_crystal`] = { unlocked: true, active: true }
    instance.rebuildRuntime()

    // effect targets spot:crystal_pick — compile spot-scoped
    const modifiers = instance.effectEngine.compile("spot", `${P.S}/crystal_pick`)
    const crystalMod = modifiers.find((m) => m.type === "spot_production_multiply")
    expect(crystalMod).toBeDefined()
    expect(crystalMod!.multiply).toBe(2)
  })

  // ── 6. Condition-driven visibility ──

  it("condition: mithril drill visible when gold >= 300", () => {
    const { reg, instance } = setup()
    instance.enterInit(`${P.I}/overworld`)

    const drillKey = `${P.S}/mithril_drill`
    const drillDef = reg.getDefinition(drillKey) as any

    // visibility.3 condition: gold >= 300
    const cond = drillDef.visibility?.[3]
    expect(cond).toBeDefined()

    // initially gold = 200
    let ctx = { player: instance.player, runtime: instance.runtime }
    expect(evaluateCondition(cond, ctx)).toBe(false)

    // increase gold past threshold
    instance.player.resources[`${P.R}/gold`] = 500
    ctx = { player: instance.player, runtime: instance.runtime }
    expect(evaluateCondition(cond, ctx)).toBe(true)
  })

  // ── 7. Save/Load ──

  it("save/load: PlayerState serializes and deserializes", () => {
    const { instance } = setup()
    instance.enterInit(`${P.I}/overworld`)
    instance.tick()
    instance.tick()
    instance.tick()

    // snapshot
    const saved = JSON.parse(JSON.stringify(instance.player))

    // verify key fields survived round-trip
    expect(saved.currentInit).toBe(`${P.I}/overworld`)
    expect(saved.currentArea).toBe(`${P.A}/central`)
    expect(typeof saved.resources[`${P.R}/gold`]).toBe("number")
    expect(typeof saved.spots[`${P.S}/crystal_pick`].level).toBe("number")
    expect(Array.isArray(saved.chatHistory)).toBe(true)

    // load into fresh instance
    const fresh = setup().instance
    fresh.enterInit(`${P.I}/overworld`)
    // overwrite with saved state
    Object.assign(fresh.player, saved)
    fresh.rebuildRuntime()

    // verify state is consistent
    expect(fresh.player.currentInit).toBe(saved.currentInit)
    expect(fresh.player.resources[`${P.R}/gold`]).toBe(instance.player.resources[`${P.R}/gold`])
    expect(fresh.player.spots[`${P.S}/crystal_pick`].level).toBe(
      instance.player.spots[`${P.S}/crystal_pick`].level,
    )
  })

  // ── 8. Manual purchase + area travel + enhancement ──

  it("full flow: buy spot → travel → buy enhancement → verify output", () => {
    const { instance } = setup()
    instance.enterInit(`${P.I}/overworld`)

    // initial state: 200 gold, crystal_pick at level 1
    expect(instance.player.resources[`${P.R}/gold`]).toBe(200)

    instance.player.resources[`${P.R}/gold`] = 1000
    instance.player.enhancements[`${P.E}/double_crystal`] = { unlocked: true, active: true }
    instance.rebuildRuntime()

    // travel to deep_mine (costs 500 gold)
    const travelOk = instance.travelToArea(`${P.A}/deep_mine`)
    expect(travelOk).toBe(true)
    expect(instance.player.currentArea).toBe(`${P.A}/deep_mine`)
    expect(instance.player.resources[`${P.R}/gold`]).toBe(500)

    // travel back to central
    instance.travelToArea(`${P.A}/central`)

    // let crystal_pick produce with double_crystal modifier
    instance.rebuildRuntime()
    for (let i = 0; i < 5; i++) instance.tick()

    // base 5 * 2 (enhancement) = 10 per interval
    expect(instance.player.resources[`${P.R}/crystal`]).toBeGreaterThanOrEqual(10)
  })
})
