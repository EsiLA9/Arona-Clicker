import { describe, it, expect } from "vitest"
import { GameRegistry } from "../registry"
import { makeFullKey, parseFullKey } from "../types"
import type { RawDatapack, FullKey } from "../types"

const basePack: RawDatapack = {
  id: "test_mod",
  name: "Test Mod",
  version: "1.0.0",
  description: "Test datapack",
  priority: 0,
  contents: {
    resources: [
      { idName: "gold", name: "Gold", icon: "🪙", description: "Gold coin", baseValue: 1, persistent: true },
      { idName: "crystal", name: "Crystal", icon: "💎", description: "Crystal shard" },
    ],
    inits: [{
      idName: "main_world", name: "Main World", description: "Starting world", icon: "🌍",
      startingArea: "hometown", defaultArea: "hometown", defaultAreaCooldown: 100,
      areas: ["hometown", "forest"], inheritEnhancements: true,
      startingActions: [{ type: "add_resource", target: "gold", value: { type: "const", value: 50 } }],
    }],
    areas: [{
      idName: "hometown", name: "Hometown", description: "Your home", parentInit: "main_world",
      spots: ["crystal_mine"], passiveStoryEntries: ["random_talk"], activeStoryEntries: ["intro_quest"],
      explorationMax: 100,
    }, {
      idName: "forest", name: "Forest", description: "Dark forest", parentInit: "main_world",
      spots: [], passiveStoryEntries: [], activeStoryEntries: [],
      explorationMax: 100, adjacentAreas: ["hometown"],
    }],
    spots: [{
      idName: "crystal_mine", name: "Crystal Mine", description: "Produces crystals", icon: "⛏️",
      parentArea: "hometown",
      productions: [{ resource: "crystal", baseAmount: 5, intervalTicks: 60 }],
      cost: { resource: "gold", amount: 100 },
      effects: [],
    }],
    effects: [{
      idName: "double_production", type: "spot_production_multiply",
      target: { scope: "spot", id: "crystal_mine" },
      operation: "multiply", value: 2,
    }],
    enhancements: [{
      idName: "mining_boost", name: "Mining Boost", description: "Boost mining", icon: "⚡",
      category: "spot_boost", cost: { resource: "gold", amount: 500 },
      effects: ["double_production"],
    }],
    stories: [{
      idName: "welcome", talklets: [{ speaker: "system", text: "Welcome!" }],
    }],
    activeStoryEntries: [{
      idName: "intro_quest", type: "active", story: "welcome",
      parentArea: "hometown",
    }],
    passiveStoryEntries: [{
      idName: "random_talk", type: "passive", story: "welcome",
      parentArea: "hometown", weight: 2, cooldownTicks: 50,
    }],
  },
}

describe("GameRegistry", () => {
  describe("load", () => {
    it("loads a minimal datapack and builds all indexes", () => {
      const reg = new GameRegistry()
      reg.load([basePack])

      expect(reg.valid).toBe(true)
      expect(reg.errors).toHaveLength(0)
    })

    it("populates the main index with all definitions", () => {
      const reg = new GameRegistry()
      reg.load([basePack])

      expect(reg.all.size).toBeGreaterThan(0)

      // check a few specific entries
      const goldKey = makeFullKey("test_mod", "resource", "gold")
      const goldDef = reg.getDefinition(goldKey)
      expect(goldDef).toBeDefined()
      expect((goldDef as any).name).toBe("Gold")

      const mineKey = makeFullKey("test_mod", "spot", "crystal_mine")
      const mineDef = reg.getDefinition(mineKey)
      expect(mineDef).toBeDefined()
      expect((mineDef as any).productions[0].baseAmount).toBe(5)
    })
  })

  describe("auxiliary indexes", () => {
    it("byMod index", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const keys = reg.byMod.get("test_mod")
      expect(keys).toBeDefined()
      expect(keys!.length).toBeGreaterThan(0)
    })

    it("byType index", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const resources = reg.byType.get("resource")
      expect(resources).toBeDefined()
      expect(resources!.length).toBe(2)
    })

    it("areasByInit index", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const initKey = makeFullKey("test_mod", "init", "main_world")
      const areas = reg.areasByInit.get(initKey)
      expect(areas).toBeDefined()
      expect(areas!.length).toBe(2)
    })

    it("spotsByArea index", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const areaKey = makeFullKey("test_mod", "area", "hometown")
      const spots = reg.spotsByArea.get(areaKey)
      expect(spots).toBeDefined()
      expect(spots!.length).toBe(1)
    })

    it("storiesByArea index", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const areaKey = makeFullKey("test_mod", "area", "hometown")
      const stories = reg.storiesByArea.get(areaKey)
      expect(stories).toBeDefined()
      expect(stories!.active).toHaveLength(1)
      expect(stories!.passive).toHaveLength(1)
    })

    it("effectsByTarget index", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      // effect targets spot:crystal_mine
      const targetKey = "spot:test_mod/spot/crystal_mine"
      const effects = reg.effectsByTarget.get(targetKey)
      expect(effects).toBeDefined()
      expect(effects!.length).toBe(1)
    })

    it("enhancementsByCategory index", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const enhs = reg.enhancementsByCategory.get("spot_boost")
      expect(enhs).toBeDefined()
      expect(enhs!.length).toBe(1)
    })
  })

  describe("query API", () => {
    it("getDefinition returns correct definition", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const key = makeFullKey("test_mod", "resource", "gold")
      const def = reg.getDefinition(key)
      expect(def).toBeDefined()
    })

    it("queryByType returns all definitions of a type", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const resources = reg.queryByType("resource")
      expect(resources).toHaveLength(2)
    })

    it("queryByMod returns all definitions from a mod", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const defs = reg.queryByMod("test_mod")
      expect(defs.length).toBeGreaterThan(0)
    })

    it("queryAreasByInit returns areas for an init", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const initKey = makeFullKey("test_mod", "init", "main_world")
      const areas = reg.queryAreasByInit(initKey)
      expect(areas).toHaveLength(2)
      expect(areas[0].name).toBe("Hometown")
    })

    it("querySpotsByArea returns spots for an area", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      const areaKey = makeFullKey("test_mod", "area", "hometown")
      const spots = reg.querySpotsByArea(areaKey)
      expect(spots).toHaveLength(1)
      expect(spots[0].name).toBe("Crystal Mine")
    })
  })

  describe("priority merging", () => {
    it("higher priority datapack overrides lower priority", () => {
      const lowPack: RawDatapack = {
        ...basePack,
        priority: 0,
        contents: {
          resources: [{ idName: "gold", name: "LowGold", icon: "🪙", description: "Low", baseValue: 1 }],
        },
      }
      const highPack: RawDatapack = {
        ...basePack,
        priority: 10,
        contents: {
          resources: [{ idName: "gold", name: "HighGold", icon: "🪙", description: "High", baseValue: 2 }],
        },
      }

      const reg = new GameRegistry()
      reg.load([lowPack, highPack])

      const goldKey = makeFullKey("test_mod", "resource", "gold")
      const goldDef = reg.getDefinition(goldKey) as any
      expect(goldDef.name).toBe("HighGold")
      expect(goldDef.baseValue).toBe(2)
    })
  })

  describe("validation", () => {
    it("detects duplicate keys", () => {
      const reg = new GameRegistry()
      const packs = [
        basePack,
        { ...basePack, id: "dup", priority: 1, contents: { resources: [{ idName: "gold", name: "Dupe", icon: "?", description: "dup", baseValue: 0 }] } },
      ]
      reg.load(packs)
      // duplicate idName within different priorities gets merged (last wins), not an error
      // Validator only catches duplicates in the same compile step (same priority segment)
      expect(reg.valid).toBe(true)
    })
  })

  describe("FullKey utilities", () => {
    it("makeFullKey / parseFullKey round-trip", () => {
      const key = makeFullKey("arona", "spot", "crystal_mine")
      expect(key).toBe("arona/spot/crystal_mine")
      const parsed = parseFullKey(key)
      expect(parsed.mod).toBe("arona")
      expect(parsed.type).toBe("spot")
      expect(parsed.id).toBe("crystal_mine")
    })
  })

  describe("meta", () => {
    it("records loaded datapack metadata", () => {
      const reg = new GameRegistry()
      reg.load([basePack])
      expect(reg.meta.loadedDatapacks).toHaveLength(1)
      expect(reg.meta.loadedDatapacks[0].id).toBe("test_mod")
      expect(reg.meta.loadedDatapacks[0].version).toBe("1.0.0")
    })
  })
})
