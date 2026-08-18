import type { FullKey } from "../03-registry/types"
import type { Condition } from "../01-foundation/types"
import type { PlayerStateMut, RuntimeCacheMut } from "../01-foundation/types"
import { evaluateCondition } from "../01-foundation/evaluator"

export interface CostScaling {
  base: number
  exponent: number
}

export interface NamedEntity {
  id: string
  name: string
  icon: string
}

// ── Cost calculation ──

export function calcCost(baseAmount: number, scaling: CostScaling | undefined, currentLevel: number): number {
  if (!scaling) return baseAmount
  return Math.ceil(baseAmount * Math.pow(scaling.base, currentLevel * scaling.exponent))
}

// ── GameAPI — convenience wrapper over a live GameInstance ──

export class GameAPI {
  constructor(
    private defs: {
      getDefinition(key: string): any
      queryByType(type: string): any[]
    },
    private player: PlayerStateMut,
    private runtime: RuntimeCacheMut,
  ) {}

  // ── Resource ──

  res(key: string): number {
    return this.player.resources[key] ?? 0
  }

  hasRes(key: string, amount: number): boolean {
    return this.res(key) >= amount
  }

  addRes(key: string, amount: number): void {
    this.player.resources[key] = (this.player.resources[key] ?? 0) + amount
  }

  spendRes(key: string, amount: number): boolean {
    if (!this.hasRes(key, amount)) return false
    this.player.resources[key]! -= amount
    return true
  }

  resLog(key: string): { totalGained: number; totalConsumed: number; perInit: Record<string, { gained: number; consumed: number }> } | undefined {
    return this.player.resourceLog[key]
  }

  resDef(key: string): any {
    return this.defs.getDefinition(key)
  }

  resMax(key: string): number | undefined {
    return this.resDef(key)?.maxValue
  }

  resPct(key: string): number {
    const max = this.resMax(key)
    if (max == null || max <= 0) return 1
    return Math.min(1, (this.res(key) ?? 0) / max)
  }

  resFull(key: string): boolean {
    const max = this.resMax(key)
    if (max == null) return false
    return (this.res(key) ?? 0) >= max
  }

  // ── Spot ──

  spotLevel(key: string): number {
    return this.player.spots[key]?.level ?? 0
  }

  ownSpot(key: string): boolean {
    return this.spotLevel(key) > 0
  }

  spotDef(key: string): any {
    return this.defs.getDefinition(key)
  }

  spotCost(key: string): number {
    const d = this.spotDef(key)
    if (!d) return 0
    const cur = this.spotLevel(key)
    return calcCost(d.cost?.amount ?? 0, d.costScaling, cur)
  }

  spotMaxed(key: string): boolean {
    const d = this.spotDef(key)
    if (!d?.maxLevel) return false
    return this.spotLevel(key) >= d.maxLevel
  }

  spotProduction(key: string): number {
    const d = this.spotDef(key)
    const s = this.player.spots[key]
    if (!d || !s) return 0
    const prod = d.productions?.[0]
    if (!prod) return 0
    return prod.baseAmount + (s.level - 1) * (prod.perLevel ?? 0)
  }

  spotsInArea(areaKey: string): { key: string; level: number }[] {
    const areaDef = this.defs.getDefinition(areaKey)
    if (!areaDef) return []
    return (areaDef.spots ?? []).filter((k: string) => this.ownSpot(k)).map((k: string) => ({ key: k, level: this.spotLevel(k) }))
  }

  // ── Enhancement ──

  enhUnlocked(key: string): boolean {
    return this.player.enhancements[key]?.unlocked === true
  }

  enhActive(key: string): boolean {
    return this.player.enhancements[key]?.active === true
  }

  enhToggle(key: string): void {
    const e = this.player.enhancements[key]
    if (!e) return
    e.active = !e.active
  }

  // ── Area ──

  areaDef(key: string): any {
    return this.defs.getDefinition(key)
  }

  areaUnlocked(key: string): boolean {
    return this.player.areaStates[key]?.unlocked === true
  }

  areaDiscovered(key: string): boolean {
    return this.player.areaStates[key]?.discovered === true
  }

  areaName(key: string): string {
    return this.areaDef(key)?.name ?? key.split("/").pop() ?? key
  }

  adjacentAreas(key: string): string[] {
    return this.areaDef(key)?.adjacentAreas ?? []
  }

  canReach(from: string, to: string): boolean {
    return this.adjacentAreas(from).includes(to)
  }

  // ── Entity info ──

  entityName(key: string): string {
    const d = this.defs.getDefinition(key)
    return d?.name ?? key.split("/").pop() ?? key
  }

  entityIcon(key: string): string {
    const d = this.defs.getDefinition(key)
    return d?.icon ?? "?"
  }

  // ── Visibility ──

  visLevel(key: string): number {
    return this.player.visibilityState[key] ?? 0
  }

  isVisible(key: string, minLevel = 3): boolean {
    return this.visLevel(key) >= minLevel
  }

  checkCondition(c: Condition): boolean {
    return evaluateCondition(c, { player: this.player, runtime: this.runtime })
  }

  // ── Inventory ──

  spotCount(): number {
    return Object.keys(this.player.spots).length
  }

  enhCount(): number {
    return Object.values(this.player.enhancements).filter((e: any) => e.unlocked).length
  }

  currentAreaName(): string {
    return this.areaName(this.player.currentArea)
  }

  currentInitName(): string {
    return this.entityName(this.player.currentInit)
  }
}
