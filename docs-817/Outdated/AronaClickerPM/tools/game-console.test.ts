/**
 * Game Console — 终端版游戏测试工具
 *
 * 用法: npx vitest run tools/game-console.test.ts --reporter=verbose
 * 数据包定义见 tools/shared-datapack.ts
 */

import { describe, it, expect } from "vitest"
import { GameRegistry } from "../src/03-registry/registry"
import { GameInstance } from "../src/05-gameplay/game-instance"
import { EventBus } from "../src/04-engine-core/event-bus"
import { evaluateCondition } from "../src/01-foundation/evaluator"
import { demoPack, R, A, S, I as Init, E } from "./shared-datapack"

const B = (s: string) => `\x1b[1m${s}\x1b[22m`
const G = (s: string) => `\x1b[32m${s}\x1b[39m`
const Y = (s: string) => `\x1b[33m${s}\x1b[39m`
const C = (s: string) => `\x1b[36m${s}\x1b[39m`

function bar(v: number, max: number, sz = 20): string {
  const f = Math.round((v / Math.max(max, 1)) * sz)
  return "█".repeat(Math.min(f, sz)) + "░".repeat(Math.max(0, sz - f))
}
function fmt(n: number) { return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n) }

function demoLoop(inst: GameInstance) {
  const w: string[] = []
  const write = (s: string) => w.push(s)

  write(`\n${B("╔══════════════════════════════════════════════╗")}`)
  write(`  ${B("AronaClickerPM  —  Travel Test")}`)
  write(`  ${Y("pack:")} ${demoPack.name} v${demoPack.version}`)
  write(`${B("╚══════════════════════════════════════════════╝")}\n`)

  // ── 1. Enter Init ──
  write(`${C("▶ 1")} Enter Init — start in Central Square`)
  inst.enterInit(`${Init}/overworld`)
  write(`  ${G("✓")} Gold: ${fmt(inst.player.resources[`${R}/gold`] ?? 0)} （starting: 300）`)
  write(`  ${G("✓")} Spot: gold_mine Lv.1 （5 gold / 3 ticks）`)

  // ── 2. Tick to build up gold ──
  write(`\n${C("▶ 2")} Tick 12× — earn gold for travel`)
  for (let i = 0; i < 12; i++) inst.tick()
  write(`   Gold: ${fmt(inst.player.resources[`${R}/gold`] ?? 0)}`)

  // ── 3. Travel: Central → Hinterlands ──
  write(`\n${C("▶ 3")} Travel: Central ${Y("→")} Hinterlands`)
  write(`   (discoveryCost: 50g, purchaseCost: 150g)`)
  let ok = inst.travelToArea(`${A}/hinterlands`)
  write(`   ${ok ? G("✓ arrived") : Y("✗ blocked")}  |  Area: ${inst.player.currentArea.split("/").pop()}, Gold: ${fmt(inst.player.resources[`${R}/gold`] ?? 0)}`)
  expect(ok).toBe(true)
  expect(inst.player.currentArea).toBe(`${A}/hinterlands`)

  // ── 4. Buy farm + farm for food ──
  write(`\n${C("▶ 4")} Buy Farm (40g) + Tick 4× — produce food`)
  inst.player.spots[`${S}/farm`] = { level: 1, lastProductionTick: inst.tickCount }
  inst.rebuildRuntime()
  for (let i = 0; i < 4; i++) inst.tick()
  const food = inst.player.resources[`${R}/food`] ?? 0
  write(`   Farm Lv.1, Food produced: ${G(fmt(food))}`)
  expect(food).toBeGreaterThan(0)

  // ── 5. Travel: Hinterlands → Deep Mine (one-way) ──
  write(`\n${C("▶ 5")} Directed test: can we go back from Hinterlands to Central?`)
  let backToCentral = inst.travelToArea(`${A}/central`)
  write(`   hinterlands ${Y("→")} central: ${backToCentral ? G("✓") : Y("✗ blocked (no outgoing edge)")}`)
  expect(backToCentral).toBe(false)
  expect(inst.player.currentArea).toBe(`${A}/hinterlands`)

  write(`\n${C("▶ 5b")} Travel: Hinterlands ${Y("→")} Deep Mine (one-way, purchaseCost: 500g)`)
  ok = inst.travelToArea(`${A}/deep_mine`)
  write(`   ${ok ? G("✓ arrived") : Y("✗ blocked")}  |  Area: ${inst.player.currentArea.split("/").pop()}, Gold: ${fmt(inst.player.resources[`${R}/gold`] ?? 0)}`)
  expect(ok).toBe(true)
  expect(inst.player.currentArea).toBe(`${A}/deep_mine`)

  // ── 6. Buy Deep Crystal Drill + produce ──
  write(`\n${C("▶ 6")} Buy Deep Crystal Drill (200g) + Tick 12×`)
  inst.player.spots[`${S}/deep_crystal_drill`] = { level: 1, lastProductionTick: inst.tickCount }
  inst.rebuildRuntime()
  for (let i = 0; i < 12; i++) inst.tick()
  const crystal = inst.player.resources[`${R}/crystal`] ?? 0
  write(`   Deep Drill Lv.1, Crystal: ${G(fmt(crystal))}（base 15 + effect 10 = 25 / 6 ticks）`)
  expect(crystal).toBeGreaterThan(20)

  // ── 7. Travel: Deep Mine → Abyss ──
  write(`\n${C("▶ 7")} Travel: Deep Mine ${Y("→")} The Abyss`)
  write(`   (needs 5 mithril — start with 0, so blocked)`)
  ok = inst.travelToArea(`${A}/abyss`)
  write(`   ${ok ? G("✓ arrived") : Y("✗ blocked (need 5 mithril)")}  |  Area: ${inst.player.currentArea.split("/").pop()}`)
  expect(ok).toBe(false)

  // ── 8. Gain mithril by buying Mithril Drill ──
  write(`\n${C("▶ 8")} Return to Central, buy Mithril Drill`)
  inst.travelToArea(`${A}/central`)
  inst.player.resources[`${R}/gold`] = 500
  const drillDef = inst.registry.getDefinition(`${S}/mithril_drill`) as any
  const visCond = drillDef?.visibility?.[3]
  const ctx = { player: inst.player, runtime: inst.runtime }
  const visible = visCond ? evaluateCondition(visCond, ctx) : false
  write(`   Mithril Drill visible? ${visible ? G("yes") : Y("no")}  (need gold ≥ 300, have 500)`)

  inst.player.spots[`${S}/mithril_drill`] = { level: 1, lastProductionTick: inst.tickCount }
  inst.rebuildRuntime()
  for (let i = 0; i < 30; i++) inst.tick()
  const mithril = inst.player.resources[`${R}/mithril`] ?? 0
  write(`   Mithril: ${G(fmt(mithril))}（1 / 15 ticks, 30 ticks → ~2）`)

  // ── 9. Travel: Central → Deep Mine → Abyss (now with mithril) ──
  write(`\n${C("▶ 9")} Travel: Central ${Y("→")} Deep Mine ${Y("→")} Abyss`)
  inst.travelToArea(`${A}/deep_mine`)
  ok = inst.travelToArea(`${A}/abyss`)
  write(`   ${ok ? G("✓ arrived at Abyss!") : Y("✗ blocked")}  |  Mithril: ${fmt(inst.player.resources[`${R}/mithril`] ?? 0)}`)
  expect(ok).toBe(true)
  expect(inst.player.currentArea).toBe(`${A}/abyss`)

  // ── 10. Extract essence + shortcut back ──
  write(`\n${C("▶ 10")} Buy Essence Extractor (5 mithril) + Tick 12×`)
  inst.player.spots[`${S}/essence_extractor`] = { level: 1, lastProductionTick: inst.tickCount }
  inst.rebuildRuntime()
  for (let i = 0; i < 12; i++) inst.tick()
  const essence = inst.player.resources[`${R}/dark_essence`] ?? 0
  write(`   Dark Essence: ${G(fmt(essence))}（5 / 6 ticks, 12 ticks → ~10）`)

  // shortcut: abyss → hinterlands (one-way)
  write(`\n${C("▶ 10b")} Shortcut: Abyss ${Y("→")} Hinterlands (one-way)`)
  ok = inst.travelToArea(`${A}/hinterlands`)
  write(`   ${ok ? G("✓ arrived via one-way shortcut!") : Y("✗ blocked")}  |  Area: ${inst.player.currentArea.split("/").pop()}`)
  expect(ok).toBe(true)

  // head back to central to complete the loop
  inst.travelToArea(`${A}/deep_mine`)
  inst.travelToArea(`${A}/central`)
  write(`   Final: ${G("central")} (loop complete)`)

  // ── ── Summary ── ──
  const fG = inst.player.resources[`${R}/gold`] ?? 0
  const fC = inst.player.resources[`${R}/crystal`] ?? 0
  const fM = inst.player.resources[`${R}/mithril`] ?? 0
  const fE = inst.player.resources[`${R}/dark_essence`] ?? 0
  const fF = inst.player.resources[`${R}/food`] ?? 0

  write(`\n${B("╔══════════════════════════════════════════════╗")}`)
  write(`  ${B("Travel Complete — Directed Graph")}`)
  write(`  ${B("╠══════════════════════════════════════════════╣")}`)
  write(`  Travel route:`)
  const route = ["central", "hinterlands", "deep_mine", "central", "deep_mine", "abyss", "hinterlands", "deep_mine", "central"]
  const arrow = Y("→")
  write(`   ${route.map(a => G(a)).join(` ${arrow} `)}`)
  write(`  ${B("╠══════════════════════════════════════════════╣")}`)
  write(`  ${B("Directed edges used:")}`)
  write(`    central    ${Y("→")} hinterlands  (one-way)`)
  write(`    hinterlands ${Y("→")} deep_mine    (one-way)`)
  write(`    deep_mine   ${Y("→")} central      (two-way)`)
  write(`    deep_mine   ${Y("→")} abyss        (one-way)`)
  write(`    abyss       ${Y("→")} hinterlands  (one-way shortcut)`)
  write(`    hinterlands ${Y("→")} deep_mine    (one-way, repeated)`)
  write(`  ${B("╠══════════════════════════════════════════════╣")}`)
  write(`  ${B("Resources:")}`)
  write(`    Gold:         ${G(fmt(fG)).padStart(10)} ${bar(fG, 800)}  (${route.filter(a => a === "central").length}x visited)`)
  write(`    Crystal:      ${G(fmt(fC)).padStart(10)} ${bar(fC, 150)}`)
  write(`    Mithril:      ${G(fmt(fM)).padStart(10)} ${bar(fM, 10)}`)
  write(`    Dark Essence: ${G(fmt(fE)).padStart(10)} ${bar(fE, 20)}`)
  write(`    Food:         ${G(fmt(fF)).padStart(10)} ${bar(fF, 50)}`)
  write(`  ${B("╠══════════════════════════════════════════════╣")}`)
  write(`  Spots:`)
  for (const [k, v] of Object.entries(inst.player.spots)) {
    const d = inst.registry.getDefinition(k) as any
    const areaKey = d?.parentArea ?? "?"
    const areaName = (inst.registry.getDefinition(areaKey) as any)?.name ?? areaKey.split("/").pop()
    write(`    ${(d?.name ?? k.split("/").pop()!).padEnd(22)} Lv.${v.level}  (${areaName})`)
  }
  write(`  ${B("╠══════════════════════════════════════════════╣")}`)
  write(`  Game: Tick ${inst.tickCount}  |  Current: ${inst.player.currentArea.split("/").pop()}`)
  write(`  ${B("╚══════════════════════════════════════════════╝")}\n`)

  return w.join("\n")
}

describe("Game Console — Travel Test", () => {
  it("travels the full area network", () => {
    const reg = new GameRegistry(); reg.load([demoPack])
    expect(reg.valid).toBe(true)
    const inst = new GameInstance({ registry: reg, eventBus: new EventBus() })
    const output = demoLoop(inst)
    console.log(output)

    expect(inst.player.currentArea).toBe(`${A}/central`)
    expect(inst.player.currentInit).toBe(`${Init}/overworld`)

    // resources produced in various areas
    expect(inst.player.resources[`${R}/gold`]).toBeGreaterThan(0)
    expect(inst.player.resources[`${R}/food`]).toBeGreaterThan(0)
    expect(inst.player.resources[`${R}/dark_essence`]).toBeGreaterThan(0)

    // all 4 areas visited at some point
    for (const areaKey of [`${A}/central`, `${A}/hinterlands`, `${A}/deep_mine`, `${A}/abyss`]) {
      expect(inst.player.areaStates[areaKey]?.unlocked).toBe(true)
    }
  })
})
