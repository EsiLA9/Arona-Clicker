import { describe, it, expect } from "vitest"
import { GameInstance } from "../game-instance"
import { GameRegistry } from "../../03-registry/registry"
import type { RawDatapack, FullKey } from "../../03-registry/types"

const R = "test/resource"
const A = "test/area"
const S = "test/spot"
const I = "test/init"
const E = "test/enhancement"

const testPack: RawDatapack = {
  id: "test",
  name: "Test",
  version: "1.0",
  description: "Test pack",
  priority: 0,
  contents: {
    resources: [
      { idName: "gold", name: "Gold", icon: "g", description: "Gold coin", persistent: true },
      { idName: "crystal", name: "Crystal", icon: "c", description: "Crystal" },
    ],
    inits: [{
      idName: "main", name: "Main", description: "", icon: "",
      startingArea: "hometown", defaultArea: "hometown", defaultAreaCooldown: 100,
      areas: ["hometown", "forest"],
      inheritEnhancements: true,
      startingActions: [
        { type: "add_resource", target: `${R}/gold`, value: { type: "const", value: 100 } },
      ],
    }, {
      idName: "ng_plus", name: "NG+", description: "", icon: "",
      startingArea: "hometown", defaultArea: "hometown", defaultAreaCooldown: 100,
      areas: ["hometown"],
      inheritResources: true,
      inheritEnhancements: true,
      startingActions: [
        { type: "add_resource", target: `${R}/crystal`, value: { type: "const", value: 10 } },
      ],
    }],
    areas: [{
      idName: "hometown", name: "Hometown", description: "", parentInit: "main",
      spots: ["mine"], passiveStoryEntries: [], activeStoryEntries: [],
      explorationMax: 100, adjacentAreas: ["forest"],
    }, {
      idName: "forest", name: "Forest", description: "", parentInit: "main",
      spots: [], passiveStoryEntries: [], activeStoryEntries: [],
      explorationMax: 100, adjacentAreas: ["hometown"],
    }],
    spots: [{
      idName: "mine", name: "Mine", description: "", icon: "",
      parentArea: "hometown",
      productions: [{ resource: "crystal", baseAmount: 5, intervalTicks: 10 }],
      cost: { resource: "gold", amount: 50 },
      effects: [],
    }],
    enhancements: [{
      idName: "boost", name: "Boost", description: "", icon: "",
      category: "spot_boost", cost: { resource: "gold", amount: 200 },
      effects: [],
      scope: "global",
    }],
    effects: [],
    stories: [],
    activeStoryEntries: [],
    passiveStoryEntries: [],
  },
}

function createInstance(): GameInstance {
  const reg = new GameRegistry()
  reg.load([testPack])
  return new GameInstance({ registry: reg })
}

describe("GameInstance", () => {
  it("createPlayerState returns empty state", () => {
    const inst = createInstance()
    const state = inst.createPlayerState()
    expect(state.resources).toEqual({})
    expect(state.spots).toEqual({})
    expect(state.currentInit).toBe("")
  })

  describe("enterInit", () => {
    it("enters an init and sets up area states", () => {
      const inst = createInstance()
      const ok = inst.enterInit(`${I}/main`)
      expect(ok).toBe(true)
      expect(inst.player.currentInit).toBe(`${I}/main`)
      expect(inst.player.currentArea).toBe(`${A}/hometown`)
      expect(inst.player.areaStates[`${A}/hometown`].discovered).toBe(true)
      expect(inst.player.areaStates[`${A}/hometown`].unlocked).toBe(true)
      expect(inst.player.areaStates[`${A}/forest`].discovered).toBe(false)
    })

    it("executes startingActions", () => {
      const inst = createInstance()
      inst.enterInit(`${I}/main`)
      expect(inst.player.resources[`${R}/gold`]).toBe(100)
    })

    it("fails if entryRequirements not met (none defined, so passes)", () => {
      const inst = createInstance()
      const ok = inst.enterInit(`${I}/main`)
      expect(ok).toBe(true)
    })
  })

  describe("switchInit", () => {
    it("switches init and inherits persistent resources", () => {
      const inst = createInstance()
      inst.enterInit(`${I}/main`)

      inst.player.resources[`${R}/gold`] = 999
      inst.player.enhancements[`${E}/boost`] = { unlocked: true, active: true }

      const ok = inst.switchInit(`${I}/ng_plus`)
      expect(ok).toBe(true)
      expect(inst.player.currentInit).toBe(`${I}/ng_plus`)

      expect(inst.player.resources[`${R}/gold`]).toBe(999)
      expect(inst.player.enhancements[`${E}/boost`]).toBeDefined()
      expect(inst.player.resources[`${R}/crystal`]).toBe(10)
    })
  })

  describe("travelToArea", () => {
    it("travels to an adjacent area", () => {
      const inst = createInstance()
      inst.enterInit(`${I}/main`)

      const ok = inst.travelToArea(`${A}/forest`)
      expect(ok).toBe(true)
      expect(inst.player.currentArea).toBe(`${A}/forest`)
    })

    it("rejects travel to non-adjacent area", () => {
      const inst = createInstance()
      inst.enterInit(`${I}/main`)

      const ok = inst.travelToArea("nonexistent" as any)
      expect(ok).toBe(false)
      expect(inst.player.currentArea).toBe(`${A}/hometown`)
    })

    it("same area is a no-op success", () => {
      const inst = createInstance()
      inst.enterInit(`${I}/main`)
      const ok = inst.travelToArea(`${A}/hometown`)
      expect(ok).toBe(true)
    })
  })

  describe("tick", () => {
    it("advances tick count", () => {
      const inst = createInstance()
      inst.enterInit(`${I}/main`)
      expect(inst.tickCount).toBe(0)
      inst.tick()
      expect(inst.tickCount).toBe(1)
    })

    it("produces resources from owned spots", () => {
      const inst = createInstance()
      inst.enterInit(`${I}/main`)
      inst.player.spots[`${S}/mine`] = { level: 1, lastProductionTick: 0 }
      inst.rebuildRuntime()

      for (let i = 0; i < 10; i++) {
        inst.tick()
      }

      expect(inst.player.resources[`${R}/crystal`]).toBeGreaterThanOrEqual(5)
    })
  })

  describe("runtime cache", () => {
    it("rebuilds runtime after entering init", () => {
      const inst = createInstance()
      inst.enterInit(`${I}/main`)
      expect(inst.runtime.currentTick).toBe(0)
      expect(inst.runtime.spotProductionCache).toBeDefined()
      expect(inst.runtime.isHibernating).toBe(false)
    })
  })
})
