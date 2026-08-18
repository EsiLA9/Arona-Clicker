import { describe, it, expect } from "vitest"
import { GameAPI, calcCost } from "../game-api"
import { GameRegistry } from "../../03-registry/registry"
import { GameInstance } from "../game-instance"
import { EventBus } from "../../04-engine-core/event-bus"
import { demoPack, R, S, A, E, I as Init } from "../../../tools/shared-datapack"

function setup() {
  const reg = new GameRegistry(); reg.load([demoPack])
  const inst = new GameInstance({ registry: reg, eventBus: new EventBus() })
  inst.enterInit(`${Init}/overworld`)
  const api = new GameAPI(reg, inst.player, inst.runtime)
  return { reg, inst, api }
}

describe("GameAPI", () => {
  describe("calcCost", () => {
    it("returns base if no scaling", () => {
      expect(calcCost(50, undefined, 5)).toBe(50)
    })
    it("applies exponential scaling", () => {
      // 50 * 1.3^(0*1) = 50
      expect(calcCost(50, { base: 1.3, exponent: 1 }, 0)).toBe(50)
      // 50 * 1.3^(1*1) = 65
      expect(calcCost(50, { base: 1.3, exponent: 1 }, 1)).toBe(65)
    })
  })

  describe("resources", () => {
    it("res() returns 0 for missing", () => {
      const { api } = setup()
      expect(api.res("nonexistent")).toBe(0)
    })
    it("res() returns current amount", () => {
      const { api } = setup()
      expect(api.res(`${R}/gold`)).toBeGreaterThan(0)
    })
    it("hasRes() checks threshold", () => {
      const { api } = setup()
      expect(api.hasRes(`${R}/gold`, 99999)).toBe(false)
    })
    it("addRes / spendRes", () => {
      const { api } = setup()
      api.addRes(`${R}/gold`, 100)
      expect(api.res(`${R}/gold`)).toBeGreaterThan(800)
      expect(api.spendRes(`${R}/gold`, 99999)).toBe(false)
    })
  })

  describe("spots", () => {
    it("spotLevel returns 0 for unowned", () => {
      const { api } = setup()
      expect(api.spotLevel("nonexistent")).toBe(0)
    })
    it("ownSpot is false for unowned", () => {
      const { api } = setup()
      expect(api.ownSpot(`${S}/crystal_pick`)).toBe(false)
    })
    it("spotCost applies scaling", () => {
      const { api } = setup()
      const cost = api.spotCost(`${S}/gold_mine`)
      expect(cost).toBeGreaterThan(0)
    })
    it("spotMaxed returns false for non-maxed", () => {
      const { api } = setup()
      expect(api.spotMaxed(`${S}/gold_mine`)).toBe(false)
    })
  })

  describe("enhancements", () => {
    it("enhUnlocked returns false initially", () => {
      const { api } = setup()
      expect(api.enhUnlocked(`${E}/double_crystal`)).toBe(false)
    })
    it("enhToggle toggles active state", () => {
      const { api, inst } = setup()
      inst.player.enhancements[`${E}/double_crystal`] = { unlocked: true, active: true }
      expect(api.enhActive(`${E}/double_crystal`)).toBe(true)
      api.enhToggle(`${E}/double_crystal`)
      expect(api.enhActive(`${E}/double_crystal`)).toBe(false)
    })
  })

  describe("areas", () => {
    it("areaName returns human-readable", () => {
      const { api } = setup()
      expect(api.areaName(`${A}/central`)).toBe("Central Square")
    })
    it("canReach checks adjacency", () => {
      const { api } = setup()
      expect(api.canReach(`${A}/central`, `${A}/hinterlands`)).toBe(true)
      expect(api.canReach(`${A}/hinterlands`, `${A}/central`)).toBe(false) // one-way
    })
  })

  describe("entity info", () => {
    it("entityName resolves names", () => {
      const { api } = setup()
      expect(api.entityName(`${A}/central`)).toBe("Central Square")
      expect(api.entityName("unknown/thing/x")).toBe("x")
    })
  })

  describe("visibility", () => {
    it("visLevel defaults to 0", () => {
      const { api } = setup()
      expect(api.visLevel("anything")).toBe(0)
    })
  })
})
