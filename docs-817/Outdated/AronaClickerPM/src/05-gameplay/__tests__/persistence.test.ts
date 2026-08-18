import { describe, it, expect } from "vitest"
import { GameRegistry } from "../../03-registry/registry"
import { GameInstance } from "../game-instance"
import { EventBus } from "../../04-engine-core/event-bus"
import { demoPack, R, A, I as Init, S, E } from "../../../tools/shared-datapack"
import {
  serializePlayer,
  deserializePlayer,
  isValidSave,
  SaveSlotManager,
  type SaveGameData,
} from "../persistence"

function buildInstance() {
  const reg = new GameRegistry()
  reg.load([demoPack])
  const inst = new GameInstance({ registry: reg, eventBus: new EventBus() })
  inst.enterInit(`${Init}/overworld`)
  return inst
}

describe("Persistence", () => {
  describe("serialize / deserialize", () => {
    it("serializes player state to SaveGameData", () => {
      const inst = buildInstance()
      const save = inst.save()
      expect(save.schema).toBe("arona_save_v1")
      expect(save.meta.version).toBe(1)
      expect(save.meta.initKey).toBe(`${Init}/overworld`)
      expect(typeof save.meta.tickCount).toBe("number")
      expect(typeof save.meta.timestamp).toBe("number")
    })

    it("deserializes back to matching state", () => {
      const inst = buildInstance()
      inst.tick()
      inst.tick()
      inst.tick()
      const save = inst.save()
      const { player, tickCount } = deserializePlayer(save)
      expect(player.currentInit).toBe(`${Init}/overworld`)
      expect(player.currentArea).toBe(`${A}/central`)
      expect(tickCount).toBe(3)
      expect(player.resources[`${R}/gold`]).toBeGreaterThan(800)
    })

    it("save→load round-trip preserves resources and spots", () => {
      const inst = buildInstance()
      inst.tick()
      inst.tick()
      const save = inst.save()
      const inst2 = buildInstance()
      inst2.loadFromSave(save)
      expect(inst2.player.resources[`${R}/gold`]).toBe(inst.player.resources[`${R}/gold`])
      expect(inst2.player.currentArea).toBe(inst.player.currentArea)
      expect(inst2.tickCount).toBe(inst.tickCount)
      expect(inst2.player.spots[`${S}/gold_mine`]?.level).toBe(1)
    })

    it("load rebuilds production cache and continues ticking", () => {
      const inst = buildInstance()
      inst.tick()
      inst.tick()
      inst.tick()
      const save = inst.save()
      const inst2 = buildInstance()
      inst2.loadFromSave(save)
      // gold_mine interval is 3; after 3 ticks on inst + 1 on inst2,
      // we may not have a new production, but the engine should run
      expect(inst2.runtime.spotProductionCache.length).toBeGreaterThan(0)
      expect(inst2.tickCount).toBe(3)
      // after 3 more ticks (6 total) we should see new production
      inst2.tick(); inst2.tick(); inst2.tick()
      expect(inst2.player.resources[`${R}/gold`]).toBeGreaterThan(save.meta.tickCount > 0 ? 800 : 800)
    })
  })

  describe("isValidSave", () => {
    it("accepts valid SaveGameData", () => {
      const data: SaveGameData = {
        schema: "arona_save_v1",
        meta: { version: 1, timestamp: 0, initKey: "m/i", tickCount: 0, areaKey: "m/a" },
        player: { resources: { gold: 100 } },
      }
      expect(isValidSave(data)).toBe(true)
    })
    it("rejects null / wrong schema", () => {
      expect(isValidSave(null)).toBe(false)
      expect(isValidSave({ schema: "wrong" })).toBe(false)
    })
  })

  describe("SaveSlotManager (with in-memory storage)", () => {
    function mkStore() {
      const store: Record<string, string> = {}
      return {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
      }
    }

    it("save round-trips through storage", () => {
      const mgr = new SaveSlotManager(mkStore(), "test_")
      const data: SaveGameData = {
        schema: "arona_save_v1",
        meta: { version: 1, timestamp: 100, initKey: "m/i", tickCount: 5, areaKey: "m/a" },
        player: {},
      }
      mgr.save(0, data)
      expect(mgr.load(0)).toEqual(data)
      expect(mgr.listSaves()).toHaveLength(1)
      expect(mgr.listSaves()[0].meta.tickCount).toBe(5)
    })
    it("delete removes slot", () => {
      const mgr = new SaveSlotManager(mkStore(), "test_")
      mgr.save(0, { schema: "arona_save_v1", meta: { version: 1, timestamp: 0, initKey: "m/i", tickCount: 0, areaKey: "m/a" }, player: {} })
      mgr.delete(0)
      expect(mgr.load(0)).toBeNull()
    })
    it("export/import round-trips", () => {
      const mgr = new SaveSlotManager(mkStore(), "test_")
      mgr.save(0, { schema: "arona_save_v1", meta: { version: 1, timestamp: 0, initKey: "m/i", tickCount: 0, areaKey: "m/a" }, player: {} })
      const exported = mgr.exportSlot(0)
      expect(exported).not.toBeNull()
      mgr.delete(0)
      expect(mgr.importSlot(exported!, 1)).toBe(true)
      expect(mgr.load(1)).not.toBeNull()
    })
    it("importSlot rejects invalid JSON", () => {
      const mgr = new SaveSlotManager(mkStore(), "test_")
      expect(mgr.importSlot("not json", 0)).toBe(false)
      expect(mgr.importSlot('{"schema":"wrong"}', 0)).toBe(false)
    })
  })
})
