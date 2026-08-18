import type { ResourceId } from "./types"

export interface ResourceDefinition {
  id: ResourceId
  name: string
  icon: string
  description: string
  baseValue: number
  persistent?: boolean      # 是否跨 Init 保留（默认 false）
}

export interface ResourceAmount {
  resource: ResourceId
  amount: number
}

export interface ResourceCost {
  resource: ResourceId
  amount: number
  scaling?: CostScaling
}

export interface CostScaling {
  base: number
  exponent: number
}

export interface ResourceProduction {
  resource: ResourceId
  baseAmount: number
  intervalTicks: number
}

export type ResourcePool = Record<ResourceId, number>
