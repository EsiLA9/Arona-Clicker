import { describe, it, expect } from "vitest"
import { GameRegistry } from "../../03-registry/registry"
import { GameInstance } from "../game-instance"
import { EventBus, EventTypes } from "../../04-engine-core/event-bus"
import { EffectEngine, EffectType } from "../../04-engine-core/effect-engine"
import { demoPack, R, S, A, I, Eff } from "../../../tools/shared-datapack"
import type { EffectDefinition } from "../../04-engine-core/effect-engine"
import type { FullKey } from "../../03-registry/types"

function build() {
  const reg = new GameRegistry()
  reg.load([demoPack])
  const inst = new GameInstance({ registry: reg, eventBus: new EventBus() })
  inst.enterInit(`${I}/overworld`)
  return { reg, inst }
}

describe("Resource Caps", () => {
  it("gold has a base maxValue of 5000 from definition", () => {
    const { reg } = build()
    const def = reg.getDefinition<any>(`${R}/gold`)
    expect(def.maxValue).toBe(5000)
  })

  it("getEffectiveCap returns definition maxValue when no modifiers", () => {
    const { inst } = build()
    expect(inst.getEffectiveCap(`${R}/gold`)).toBe(5000)
  })

  it("getEffectiveCap returns undefined for resources without maxValue", () => {
    const { inst } = build()
    expect(inst.getEffectiveCap(`${R}/crystal`)).toBeUndefined()
  })

  it("caps gold at 5000 after production", () => {
    const { inst } = build()
    // gold_mine interval is 3 ticks
    inst.player.resources[`${R}/gold`] = 4999
    inst.tick(); inst.tick(); inst.tick() // produces at tick 3
    expect(inst.player.resources[`${R}/gold`]).toBe(5000)
  })

  it("does not cap resources without maxValue even after many ticks", () => {
    const { inst } = build()
    inst.player.resources[`${R}/crystal`] = 999999
    inst.tick(); inst.tick(); inst.tick()
    expect(inst.player.resources[`${R}/crystal`]).toBe(999999)
  })

  it("resource_cap_add effect increases effective cap", () => {
    const { inst } = build()
    const capAdd: EffectDefinition = {
      id: `${Eff}/gold_cap_plus` as FullKey,
      type: EffectType.ResourceCapAdd,
      target: { scope: "global", id: `${R}/gold` },
      operation: "add",
      value: 2000,
    }
    inst.effectEngine.activate(capAdd, "test", inst.tickCount)
    expect(inst.getEffectiveCap(`${R}/gold`)).toBe(7000)
  })

  it("resource_cap_set effect overrides to a higher value", () => {
    const { inst } = build()
    const capSet: EffectDefinition = {
      id: `${Eff}/gold_cap_set` as FullKey,
      type: EffectType.ResourceCapSet,
      target: { scope: "global", id: `${R}/gold` },
      operation: "set",
      value: 10000,
    }
    inst.effectEngine.activate(capSet, "test", inst.tickCount)
    expect(inst.getEffectiveCap(`${R}/gold`)).toBe(10000)
  })

  it("cap still applies after save→load round-trip", () => {
    const { inst } = build()
    inst.player.resources[`${R}/gold`] = 4999
    inst.tick(); inst.tick(); inst.tick()
    expect(inst.player.resources[`${R}/gold`]).toBe(5000)
    const save = inst.save()
    const reg = new GameRegistry(); reg.load([demoPack])
    const inst2 = new GameInstance({ registry: reg, eventBus: new EventBus() })
    inst2.loadFromSave(save)
    expect(inst2.player.resources[`${R}/gold`]).toBe(5000)
    // tick again — should stay capped
    inst2.tick(); inst2.tick(); inst2.tick()
    expect(inst2.player.resources[`${R}/gold`]).toBe(5000)
  })
})
