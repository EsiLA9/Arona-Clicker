import { describe, it, expect } from "vitest"
import { VisibilityEngine } from "../visibility-engine"
import { GameRegistry } from "../../03-registry/registry"
import { EventBus, EventTypes } from "../event-bus"
import type { RawDatapack } from "../../03-registry/types"

const testPack: RawDatapack = {
  id: "test", name: "Test", version: "1.0", description: "", priority: 0,
  contents: {
    resources: [{ idName: "gold", name: "Gold", icon: "g", description: "" }],
    inits: [{
      idName: "world", name: "World", description: "", icon: "",
      startingArea: "town", defaultArea: "town", defaultAreaCooldown: 0,
      areas: ["town"], inheritEnhancements: false,
      startingActions: [{ type: "add_resource", target: "test/resource/gold", value: { type: "const", value: 10 } }],
    }],
    areas: [{
      idName: "town", name: "Town", description: "", parentInit: "world",
      spots: ["hidden_mine"], passiveStoryEntries: [], activeStoryEntries: [],
      explorationMax: 100,
    }],
    spots: [{
      idName: "hidden_mine", name: "Hidden Mine", description: "", icon: "",
      parentArea: "town",
      productions: [{ resource: "test/resource/gold", baseAmount: 1, intervalTicks: 10 }],
      cost: { resource: "test/resource/gold", amount: 100 },
      effects: [],
      visibility: {
        3: { type: "cmp", op: "gte",
             left: { type: "resource", target: "test/resource/gold" },
             right: { type: "const", value: 50 } },
      },
    }],
    effects: [], stories: [], activeStoryEntries: [], passiveStoryEntries: [],
    enhancements: [],
  },
}

describe("VisibilityEngine", () => {
  it("scans and binds triggers on init", () => {
    const reg = new GameRegistry(); reg.load([testPack])
    const bus = new EventBus()
    const ve = new VisibilityEngine(reg, bus)

    const player = {
      saveVersion: 1, createdAt: 0, lastSaveAt: 0,
      currentInit: "test/init/world", currentArea: "test/area/town",
      unlockedInits: [], completedInits: [],
      resources: { "test/resource/gold": 10 },
      resourceLog: {}, flags: {}, spots: {}, enhancements: {},
      areaStates: {}, storyInstances: {}, tagStats: {},
      chatHistory: [], totalClicks: 0, totalStorySeen: 0,
      visibilityState: {}, mutuallyExcluded: {},
    } as any
    const runtime = { currentTick: 0, spotProductionCache: [], activeEffects: [], isHibernating: false, effectVersion: 0, compiledModifiers: [] } as any

    ve.attach(player, runtime)
    ve.scanAndBind()

    // initially visibilityState should be empty (gold = 10 < 50)
    expect(player.visibilityState["test/spot/hidden_mine"]).toBeUndefined()
    expect(ve.activeTriggers.length).toBeGreaterThan(0)
  })

  it("auto-discovers when condition is met via resource change", () => {
    const reg = new GameRegistry(); reg.load([testPack])
    const bus = new EventBus()
    const ve = new VisibilityEngine(reg, bus)

    const player = {
      saveVersion: 1, createdAt: 0, lastSaveAt: 0,
      currentInit: "test/init/world", currentArea: "test/area/town",
      unlockedInits: [], completedInits: [],
      resources: { "test/resource/gold": 10 },
      resourceLog: {}, flags: {}, spots: {}, enhancements: {},
      areaStates: {}, storyInstances: {}, tagStats: {},
      chatHistory: [], totalClicks: 0, totalStorySeen: 0,
      visibilityState: {}, mutuallyExcluded: {},
    } as any
    const runtime = { currentTick: 0, spotProductionCache: [], activeEffects: [], isHibernating: false, effectVersion: 0, compiledModifiers: [] } as any

    ve.attach(player, runtime)
    ve.scanAndBind()

    // initially hidden
    expect(player.visibilityState["test/spot/hidden_mine"]).toBeUndefined()

    // increase gold past threshold
    player.resources["test/resource/gold"] = 100

    // publish ResourceAdded to trigger re-check
    bus.publish(EventTypes.ResourceAdded, { resource: "test/resource/gold", amount: 90, newTotal: 100 }, 1)

    // now should be visible
    expect(player.visibilityState["test/spot/hidden_mine"]).toBe(3)
  })
})
