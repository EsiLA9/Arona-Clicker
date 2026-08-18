import { describe, it, expect } from "vitest"
import { GameRegistry } from "../src/03-registry/registry"
import { GameInstance } from "../src/05-gameplay/game-instance"
import { EventBus } from "../src/04-engine-core/event-bus"
import { demoPack, R, S, A, I as Init } from "./shared-datapack"

describe("Benchmark", () => {
  it("100 ticks with multiple spots", () => {
    const reg = new GameRegistry(); reg.load([demoPack])
    const inst = new GameInstance({ registry: reg, eventBus: new EventBus() })
    inst.enterInit(`${Init}/overworld`)

    // buy all available spots at level 1
    for (const key of [`${S}/gold_mine`, `${S}/crystal_pick`, `${S}/farm`]) {
      inst.player.spots[key] = { level: 1, lastProductionTick: 0 }
    }
    inst.rebuildRuntime()

    // also unlock travel areas so those spots can exist
    inst.player.spots[`${S}/deep_crystal_drill`] = { level: 1, lastProductionTick: 0 }
    inst.player.spots[`${S}/essence_extractor`] = { level: 1, lastProductionTick: 0 }
    inst.player.spots[`${S}/mithril_drill`] = { level: 1, lastProductionTick: 0 }
    inst.rebuildRuntime()

    // activate some enhancements
    inst.player.enhancements["arona/enhancement/double_crystal"] = { unlocked: true, active: true }
    inst.player.enhancements["arona/enhancement/efficiency_boost"] = { unlocked: true, active: true }
    inst.rebuildRuntime()

    const WARMUP = 20
    const TICKS = 100

    // warmup
    for (let i = 0; i < WARMUP; i++) inst.tick()

    const t0 = performance.now()
    for (let i = 0; i < TICKS; i++) inst.tick()
    const t1 = performance.now()

    const elapsed = t1 - t0
    const perTick = elapsed / TICKS

    // breakdown: re-run with instrumentation
    const breakdowns: string[] = []

    // measure syncCache alone
    const t2 = performance.now()
    for (let i = 0; i < TICKS; i++) {
      inst.effectEngine.syncCache(inst.runtime, "global")
      inst.effectEngine.syncCache(inst.runtime, "init", inst.player.currentInit)
      for (const e of inst.runtime.spotProductionCache) {
        inst.effectEngine.syncCache(inst.runtime, "spot", e.spotId)
      }
    }
    const t3 = performance.now()
    breakdowns.push(`syncCache ×100: ${(t3 - t2).toFixed(2)}ms`)

    // measure tick() alone (after warmup, with version cache settled)
    const t4 = performance.now()
    for (let i = 0; i < TICKS; i++) inst.tick()
    const t5 = performance.now()
    breakdowns.push(`tick() ×100: ${(t5 - t4).toFixed(2)}ms`)

    console.log(`\nBenchmark: 100 ticks with 6 spots + 2 enhancements`)
    console.log(`Total 100 ticks:   ${elapsed.toFixed(2)}ms (${perTick.toFixed(3)}ms/tick)`)
    console.log(`Breakdown:`)
    for (const b of breakdowns) console.log(`  ${b}`)

    // expectations
    expect(inst.tickCount).toBeGreaterThan(WARMUP + TICKS)
    // should complete in reasonable time
    expect(elapsed).toBeLessThan(1000)
  })
})
