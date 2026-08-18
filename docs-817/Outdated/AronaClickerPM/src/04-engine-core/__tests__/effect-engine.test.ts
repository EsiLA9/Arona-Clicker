import { describe, it, expect, vi } from "vitest"
import { EffectEngine, EffectType } from "../effect-engine"
import { EventBus } from "../event-bus"
import type { EffectDefinition } from "../effect-engine"

function makeDef(overrides?: Partial<EffectDefinition>): EffectDefinition {
  return {
    id: "arona/effect/test_boost" as any,
    type: EffectType.SpotProductionMultiply,
    target: { scope: "spot", id: "arona/spot/mine" },
    operation: "multiply",
    value: 2,
    ...overrides,
  }
}

function makeEngine() {
  return new EffectEngine(new EventBus())
}

describe("EffectEngine", () => {
  describe("activate / deactivate", () => {
    it("activates an effect and tracks it", () => {
      const engine = makeEngine()
      engine.activate(makeDef(), "arona/spot/mine", 0)
      expect(engine.allInstances).toHaveLength(1)
      expect(engine.allInstances[0].sourceId).toBe("arona/spot/mine")
    })

    it("deactivates a specific effect by sourceId + effectId", () => {
      const engine = makeEngine()
      const def = makeDef()
      engine.activate(def, "spot_1", 0)
      engine.deactivate("spot_1", "arona/effect/test_boost" as any, 1)
      expect(engine.allInstances).toHaveLength(0)
    })

    it("deactivateAllBySource removes all effects from a source", () => {
      const engine = makeEngine()
      engine.activate(makeDef({ id: "eff/1" as any }), "src_a", 0)
      engine.activate(makeDef({ id: "eff/2" as any }), "src_a", 0)
      engine.activate(makeDef({ id: "eff/3" as any }), "src_b", 0)
      engine.deactivateAllBySource("src_a", 1)
      expect(engine.allInstances).toHaveLength(1)
      expect(engine.allInstances[0].sourceId).toBe("src_b")
    })
  })

  describe("compile stacking", () => {
    it("compiles add operations by summing", () => {
      const engine = makeEngine()
      engine.activate(makeDef({
        type: EffectType.SpotProductionAdd,
        operation: "add",
        value: 5,
      }), "src_1", 0)
      engine.activate(makeDef({
        type: EffectType.SpotProductionAdd,
        operation: "add",
        value: 3,
      }), "src_2", 0)

      const mods = engine.compile("spot", "arona/spot/mine")
      expect(mods).toHaveLength(1)
      expect(mods[0].add).toBe(8)
      expect(mods[0].multiply).toBe(1)
    })

    it("compiles multiply operations by multiplying", () => {
      const engine = makeEngine()
      engine.activate(makeDef({ operation: "multiply", value: 2 }), "a", 0)
      engine.activate(makeDef({ operation: "multiply", value: 3 }), "b", 0)

      const mods = engine.compile("spot", "arona/spot/mine")
      expect(mods[0].multiply).toBe(6)
    })

    it("compiles percent operations by summing", () => {
      const engine = makeEngine()
      engine.activate(makeDef({
        type: EffectType.SpotProductionAdd,
        operation: "percent",
        value: 0.1,
      }), "a", 0)
      engine.activate(makeDef({
        type: EffectType.SpotProductionAdd,
        operation: "percent",
        value: 0.2,
      }), "b", 0)

      const mods = engine.compile("spot", "arona/spot/mine")
      expect(mods[0].percent).toBeCloseTo(0.3)
    })

    it("compiles set operations by taking the highest value", () => {
      const engine = makeEngine()
      engine.activate(makeDef({
        type: EffectType.RevealEntity,
        operation: "set",
        value: 3,
      }), "a", 0)
      engine.activate(makeDef({
        type: EffectType.RevealEntity,
        operation: "set",
        value: 5,
      }), "b", 0)

      const mods = engine.compile("spot", "arona/spot/mine")
      expect(mods[0].set).toBe(5)
    })

    it("groups by (type + scope + targetId)", () => {
      const engine = makeEngine()
      // production multiply on mine
      engine.activate(makeDef({ type: EffectType.SpotProductionMultiply, target: { scope: "spot", id: "mine" }, value: 2 }), "a", 0)
      // production multiply on farm (different targetId)
      engine.activate(makeDef({ type: EffectType.SpotProductionMultiply, target: { scope: "spot", id: "farm" }, value: 3 }), "b", 0)

      const mods = engine.compile("spot", "mine")
      expect(mods).toHaveLength(1)
      expect(mods[0].multiply).toBe(2)
    })

    it("filters by scope, includes only matching instances", () => {
      const engine = makeEngine()
      // global scope
      engine.activate(makeDef({ target: { scope: "global" }, type: EffectType.ChatRewardMultiply, value: 2 }), "g", 0)
      // spot scope, different target
      engine.activate(makeDef({ target: { scope: "spot", id: "other" }, value: 3 }), "s", 0)

      const mods = engine.compile("global")
      expect(mods).toHaveLength(1)
      expect(mods[0].multiply).toBe(2)
    })
  })

  describe("lifetime (tick)", () => {
    it("permanent effects never expire", () => {
      const engine = makeEngine()
      engine.activate(makeDef({ duration: undefined }), "src", 0)
      engine.tick(1)
      engine.tick(2)
      engine.tick(3)
      expect(engine.allInstances).toHaveLength(1)
    })

    it("timed effects expire after duration ticks", () => {
      const engine = makeEngine()
      engine.activate(makeDef({ duration: 3 }), "src", 0)
      engine.tick(1)
      expect(engine.allInstances).toHaveLength(1)
      engine.tick(2)
      expect(engine.allInstances).toHaveLength(1)
      engine.tick(3)
      expect(engine.allInstances).toHaveLength(0)
    })

    it("timed effect with duration 1 expires on first tick", () => {
      const engine = makeEngine()
      engine.activate(makeDef({ duration: 1 }), "src", 0)
      engine.tick(1)
      expect(engine.allInstances).toHaveLength(0)
    })
  })

  describe("event publishing", () => {
    it("publishes event on activate", () => {
      const bus = new EventBus()
      const handler = vi.fn()
      bus.subscribe("story/modified_state", handler)

      const engine = new EffectEngine(bus)
      engine.activate(makeDef(), "src", 42)

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: 42,
          data: expect.objectContaining({
            modification: expect.objectContaining({ action: "activated" }),
          }),
        }),
      )
    })

    it("publishes event on deactivate", () => {
      const bus = new EventBus()
      const handler = vi.fn()
      bus.subscribe("story/modified_state", handler)

      const engine = new EffectEngine(bus)
      engine.activate(makeDef(), "src", 0)
      engine.deactivate("src", "arona/effect/test_boost" as any, 10)

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: 10,
          data: expect.objectContaining({
            modification: expect.objectContaining({ action: "deactivated" }),
          }),
        }),
      )
    })

    it("publishes event on expire", () => {
      const bus = new EventBus()
      const handler = vi.fn()
      bus.subscribe("story/modified_state", handler)

      const engine = new EffectEngine(bus)
      engine.activate(makeDef({ duration: 1 }), "src", 0)
      engine.tick(5)

      const calls = handler.mock.calls.filter(
        (c: any) => c[0].data.modification?.action === "expired",
      )
      expect(calls).toHaveLength(1)
    })
  })

  describe("clear", () => {
    it("removes all instances", () => {
      const engine = makeEngine()
      engine.activate(makeDef({ id: "a" as any }), "x", 0)
      engine.activate(makeDef({ id: "b" as any }), "y", 0)
      engine.clear()
      expect(engine.allInstances).toHaveLength(0)
    })
  })
})
