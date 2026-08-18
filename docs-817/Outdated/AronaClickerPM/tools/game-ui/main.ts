import { GameRegistry } from "../../src/03-registry/registry"
import { GameInstance } from "../../src/05-gameplay/game-instance"
import { EventBus } from "../../src/04-engine-core/event-bus"
import { evaluateCondition } from "../../src/01-foundation/evaluator"
import { demoPack, R, A, S, E } from "../shared-datapack"

// ── Game Instance ──

let instance: GameInstance

function initEngine() {
  const bus = new EventBus()
  const reg = new GameRegistry()
  reg.load([demoPack])
  if (!reg.valid) { console.error("Registry errors:", reg.errors); return false }
  instance = new GameInstance({ registry: reg, eventBus: bus })
  return true
}

// ── Logging (with cap) ──

const logEl = document.getElementById("log")!
const MAX_LOG = 200

function addLog(cls: string, msg: string) {
  const d = document.createElement("div"); d.className = cls; d.textContent = msg
  logEl.appendChild(d)
  while (logEl.children.length > MAX_LOG) logEl.removeChild(logEl.firstChild!)
  logEl.scrollTop = logEl.scrollHeight
}

// ── Actions ──

function doTick(count: number) {
  if (!instance?.player) return
  const before: Record<string, number> = {}
  for (const e of instance.runtime.spotProductionCache) before[e.resource] = instance.player.resources[e.resource] ?? 0
  for (let i = 0; i < count; i++) instance.tick()
  const lines: string[] = []
  for (const e of instance.runtime.spotProductionCache) {
    const now = instance.player.resources[e.resource] ?? 0
    const diff = now - (before[e.resource] ?? 0)
    if (diff > 0) lines.push(`⛏️ ${e.spotId.split("/").pop()} → +${diff} ${e.resource.split("/").pop()}`)
  }
  for (const l of lines) addLog("gain", l)
  addLog("tick", `⏱ Tick ×${count} → ${instance.tickCount}`)
  render()
}

function enterInit() {
  if (!initEngine()) { addLog("info", "Engine init failed"); return }
  const ok = instance.enterInit("arona/init/overworld")
  if (!ok) { addLog("info", "Failed to enter Init"); return }
  addLog("info", `🏁 Entered "${instance.player.currentInit.split("/").pop()}"`)
  addLog("info", `📍 Starting at "${instance.player.currentArea.split("/").pop()}"`)
  render()
}

function buySpot(key: string) {
  const d = instance.registry.getDefinition(key) as any
  if (!d) return
  const cur = instance.player.spots[key]?.level ?? 0
  if (d.maxLevel && cur >= d.maxLevel) { addLog("info", `MAX`); return }
  const cost = d.costScaling ? Math.ceil(d.cost.amount * Math.pow(d.costScaling.base, cur * d.costScaling.exponent)) : d.cost.amount
  const cr = d.cost.resource
  if ((instance.player.resources[cr] ?? 0) < cost) { addLog("spend", `Need ${cost} ${cr.split("/").pop()}`); return }
  instance.player.resources[cr]! -= cost
  if (instance.player.spots[key]) instance.player.spots[key]!.level++; else instance.player.spots[key] = { level: 1, lastProductionTick: instance.tickCount }
  instance.rebuildRuntime()
  addLog("spend", `⬆ ${d.name} → Lv.${instance.player.spots[key]!.level}`)
  render()
}

function buyEnh(key: string) {
  const d = instance.registry.getDefinition(key) as any
  if (!d || instance.player.enhancements[key]) return
  const cr = d.cost.resource
  if ((instance.player.resources[cr] ?? 0) < d.cost.amount) { addLog("spend", `Need ${d.cost.amount} ${cr.split("/").pop()}`); return }
  instance.player.resources[cr]! -= d.cost.amount
  instance.player.enhancements[key] = { unlocked: true, active: true }
  instance.rebuildRuntime()
  addLog("gain", `✨ ${d.name} purchased!`)
  render()
}

function toggleEnh(key: string) {
  const s = instance.player.enhancements[key]; if (!s) return
  s.active = !s.active; instance.rebuildRuntime()
  addLog("info", `✨ ${key.split("/").pop()} ${s.active ? "ON" : "OFF"}`); render()
}

function travel(key: string) {
  const cur = instance.player.currentArea
  if (key === cur) return
  const curDef = instance.registry.getDefinition(cur) as any
  if (!curDef?.adjacentAreas.includes(key)) { addLog("info", `No path from ${cur.split("/").pop()} to ${key.split("/").pop()}`); return }
  const targetDef = instance.registry.getDefinition(key) as any
  const state = instance.player.areaStates[key]
  const ok = instance.travelToArea(key)
  if (ok) {
    addLog("info", `📍 Traveled to ${key.split("/").pop()}`)
  } else {
    const reasons: string[] = []
    if (!state?.discovered && targetDef?.discoveryCost) {
      const c = targetDef.discoveryCost
      reasons.push(`need ${c.amount} ${c.resource.split("/").pop()} to discover`)
    }
    if (!state?.unlocked && targetDef?.purchaseCost) {
      const c = targetDef.purchaseCost
      reasons.push(`need ${c.amount} ${c.resource.split("/").pop()} to unlock`)
    }
    addLog("spend", `❌ ${key.split("/").pop()} — ${reasons.join(", ") || "unknown"}`)
  }
  render()
}

function resetGame() {
  initEngine(); logEl.innerHTML = ""; addLog("info", "🔄 Reset. Click 进入 Init to start."); render()
}

// ── Render ──

const RES_ORDER = ["gold", "crystal", "mithril", "dark_essence", "food"]
const RES_CLS: Record<string, string> = { gold: "gold", crystal: "crystal", mithril: "mithril", dark_essence: "value", food: "value" }

function render() {
  const has = !!instance?.player
  ;(document.getElementById("tickDisplay") as HTMLElement).textContent = has ? `⏱ Tick ${instance.tickCount}` : "🥚 未开始"

  // Resources
  const resEl = document.getElementById("resources")!
  if (!has) { resEl.innerHTML = '<div class="stat"><span class="label">Click 进入 Init to start</span></div>'
  } else {
    const allDefs = instance.registry.queryByType("resource")
    const byName: Record<string, any> = {}
    for (const d of allDefs) byName[d.id.split("/").pop()!] = d
    resEl.innerHTML = RES_ORDER.map(n => {
      const id = `${R}/${n}`
      const def = byName[n] as any
      return `<div class="stat"><span class="label">${def?.icon ?? "?"} ${def?.name ?? n}</span><span class="value ${RES_CLS[n] ?? ""}">${(instance.player.resources[id] ?? 0).toLocaleString()}</span></div>`
    }).join("")
  }

  // Location
  const locEl = document.getElementById("location")!
  if (!has) { locEl.innerHTML = "" }
  else {
    const initDef = instance.registry.getDefinition(instance.player.currentInit) as any
    const areaDef = instance.registry.getDefinition(instance.player.currentArea) as any

    // count spots in current area
    const spotsHere = Object.entries(instance.player.spots).filter(([k]) => {
      const d = instance.registry.getDefinition(k) as any
      return d?.parentArea === instance.player.currentArea
    }).length
    const spotsTotal = Object.keys(instance.player.spots).length

    // count newly discovered items via visibility
    const discovered = Object.entries(instance.player.visibilityState)
      .filter(([, lvl]) => (lvl as number) >= 3)
      .map(([k]) => k.split("/").pop())
    locEl.innerHTML =
      `<div class="stat"><span class="label">Init</span><span class="value">${initDef?.name}</span></div>` +
      `<div class="stat"><span class="label">📍 Area</span><span class="value">${areaDef?.name}</span></div>` +
      `<div class="stat"><span class="label">Spots here</span><span class="value">${spotsHere} / ${spotsTotal}</span></div>` +
      (discovered.length ? `<div class="stat"><span class="label">🔍 Discovered</span><span class="value">${discovered.join(", ")}</span></div>` : "")
  }

  // Spots (owned) — only show spots in current area
  const spotEl = document.getElementById("spots")!
  const curAreaKey = instance.player.currentArea
  if (!has) { spotEl.innerHTML = "" }
  else {
    const localSpots = Object.entries(instance.player.spots).filter(([k]) => {
      const d = instance.registry.getDefinition(k) as any
      return d?.parentArea === curAreaKey
    })
    if (localSpots.length === 0) {
      spotEl.innerHTML = '<div class="stat"><span class="label">No spots in this area</span></div>'
    } else {
      spotEl.innerHTML = localSpots.map(([k, s]) => {
        const d = instance.registry.getDefinition(k) as any
        if (!d) return ""
        const cur = s.level
        const cost = d.costScaling ? Math.ceil(d.cost.amount * Math.pow(d.costScaling.base, (cur - 1) * d.costScaling.exponent)) : d.cost.amount
        const affordable = (instance.player.resources[d.cost.resource] ?? 0) >= cost
        const maxed = d.maxLevel && cur >= d.maxLevel
        return `<div class="item"><div><span class="name">${d.icon} ${d.name}</span> <span class="badge">Lv.${cur}</span><div class="desc">${d.productions?.[0]?.baseAmount ?? "?"}/tick · ${(instance.player.resources[d.productions?.[0]?.resource] ?? 0).toLocaleString()} total</div></div><div>${maxed ? '<span class="badge">MAX</span>' : `<button class="primary" data-spot="${k}" ${affordable ? "" : "disabled"}>⬆ ${cost.toLocaleString()}</button>`}</div></div>`
      }).join("")
      spotEl.querySelectorAll("[data-spot]").forEach(el => el.addEventListener("click", () => buySpot((el as HTMLElement).dataset.spot!)))
    }
  }

  // Areas
  const areaEl = document.getElementById("areas")!
  if (!has) { areaEl.innerHTML = "" }
  else {
    const curAreaDef = instance.registry.getDefinition(instance.player.currentArea) as any
    const adjacent = new Set<string>(curAreaDef?.adjacentAreas ?? [])
    areaEl.innerHTML = instance.registry.queryByType("area").map(d => {
      const def = d as any; const key = def.id
      const here = instance.player.currentArea === key
      const st = instance.player.areaStates[key]
      const canReach = adjacent.has(key)
      let status = st?.unlocked ? "✅" : st?.discovered ? "👁️" : "❓"
      if (!canReach && !here) status += " 🔒"
      const costs: string[] = []
      if (def.discoveryCost) costs.push(`发现: ${def.discoveryCost.amount}${def.discoveryCost.resource.split("/").pop()}`)
      if (def.purchaseCost) costs.push(`进入: ${def.purchaseCost.amount}${def.purchaseCost.resource.split("/").pop()}`)
      const costStr = costs.length ? ` | ${costs.join(" ")}` : ""
      return `<div class="item"><div><span class="name">${here ? "📍" : "🌍"} ${def.name}</span><div class="desc">${status}${costStr}</div></div><div>${here ? '<span class="badge">here</span>' : (canReach ? `<button data-travel="${key}">Travel</button>` : '<span class="badge">no path</span>')}</div></div>`
    }).join("")
    areaEl.querySelectorAll("[data-travel]").forEach(el => el.addEventListener("click", () => travel((el as HTMLElement).dataset.travel!)))
  }

  // Shop — items grouped by area
  const shopEl = document.getElementById("shop")!
  if (!has) { shopEl.innerHTML = ""; return }
  const parts: string[] = []

  // Enhancement section — split by area attachment
  const enhItems = instance.registry.queryByType("enhancement") as any[]
  // global ones (no parentArea) always show
  const globalEnhs = enhItems.filter((d: any) => !d.parentArea)
  if (globalEnhs.length) {
    parts.push(`<div style="font-size:12px;color:#8b949e;margin:6px 0 4px">✨ Global / Always</div>`)
    for (const d of globalEnhs) {
      const owned = instance.player.enhancements[d.id]
      const aff = (instance.player.resources[d.cost.resource] ?? 0) >= d.cost.amount
      parts.push(`<div class="item"><div><span class="name">${d.icon} ${d.name}</span><div class="desc">${d.description}</div></div><div>${owned ? `<button data-toggle-enh="${d.id}">${owned.active ? "⏹" : "▶"}</button>` : `<button class="primary" data-buy-enh="${d.id}" ${aff ? "" : "disabled"}>${d.cost.amount} ${d.cost.resource.split("/").pop()}</button>`}</div></div>`)
    }
  }
  // area-specific ones: only show when in that area
  const areaEnhs = enhItems.filter((d: any) => d.parentArea === curAreaKey)
  if (areaEnhs.length) {
    const areaDef = instance.registry.getDefinition(curAreaKey) as any
    parts.push(`<div style="font-size:12px;color:#8b949e;margin:6px 0 4px">📍 ${areaDef?.name ?? ""} 专属</div>`)
    for (const d of areaEnhs) {
      const owned = instance.player.enhancements[d.id]
      const aff = (instance.player.resources[d.cost.resource] ?? 0) >= d.cost.amount
      parts.push(`<div class="item"><div><span class="name">${d.icon} ${d.name}</span><div class="desc">${d.description}</div></div><div>${owned ? `<button data-toggle-enh="${d.id}">${owned.active ? "⏹" : "▶"}</button>` : `<button class="primary" data-buy-enh="${d.id}" ${aff ? "" : "disabled"}>${d.cost.amount} ${d.cost.resource.split("/").pop()}</button>`}</div></div>`)
    }
  }

  // Unpurchased spots — only show those in current area
  const unpurchased = (instance.registry.queryByType("spot") as any[]).filter(
    (d: any) => !instance.player.spots[d.id] && d.parentArea === curAreaKey,
  )
  for (const d of unpurchased) {
    const visCond = d.visibility?.[3]
    let visible = false
    if (!visCond) { visible = true } else {
      const ctx = { player: instance.player, runtime: instance.runtime }
      visible = evaluateCondition(visCond, ctx)
    }
    if (!visible) { parts.push(`<div class="item"><div><span class="name">🔒 ???</span><div class="desc">Hidden spot in this area</div></div></div>`); continue }
    const aff = (instance.player.resources[d.cost.resource] ?? 0) >= d.cost.amount
    parts.push(`<div class="item"><div><span class="name">${d.icon} ${d.name}</span><div class="desc">${d.productions?.[0]?.baseAmount ?? "?"}/tick · cost: ${d.cost.amount} ${d.cost.resource.split("/").pop()}</div></div><div><button class="primary" data-spot="${d.id}" ${aff ? "" : "disabled"}>Buy ${d.cost.amount}</button></div></div>`)
  }

  shopEl.innerHTML = parts.join("") || '<div class="stat"><span class="label">All items purchased</span></div>'
  shopEl.querySelectorAll("[data-buy-enh]").forEach(el => el.addEventListener("click", () => buyEnh((el as HTMLElement).dataset.buyEnh!)))
  shopEl.querySelectorAll("[data-toggle-enh]").forEach(el => el.addEventListener("click", () => toggleEnh((el as HTMLElement).dataset.toggleEnh!)))
  shopEl.querySelectorAll("[data-spot]").forEach(el => el.addEventListener("click", () => buySpot((el as HTMLElement).dataset.spot!)))
}

// ── Wire UI ──

document.getElementById("btnTick1")!.onclick = () => doTick(1)
document.getElementById("btnTick5")!.onclick = () => doTick(5)
document.getElementById("btnTick20")!.onclick = () => doTick(20)
document.getElementById("btnTick100")!.onclick = () => doTick(100)
document.getElementById("btnReset")!.onclick = resetGame
document.getElementById("btnInit")!.onclick = enterInit
resetGame()
