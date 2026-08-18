import type {
  Value,
  Condition,
  ArithmeticOp,
  CompareOp,
  ResourceId,
  SpotId,
  EnhancementId,
  AreaId,
} from "./types"

// ── Value builders ──

export function vconst(value: number): Value {
  return { type: "const", value }
}

export function vresource(target: ResourceId): Value {
  return { type: "resource", target }
}

export function vresourceGainedTotal(target: ResourceId): Value {
  return { type: "resource_gained_total", target }
}

export function vresourceGainedInit(target: ResourceId): Value {
  return { type: "resource_gained_init", target }
}

export function vflag(key: string): Value {
  return { type: "flag", key }
}

export function vcontextFlag(key: string): Value {
  return { type: "context_flag", key }
}

export function vspotLevel(target: SpotId): Value {
  return { type: "spot_level", target }
}

export function venhancementLevel(target: EnhancementId): Value {
  return { type: "enhancement_level", target }
}

export function vtick(): Value {
  return { type: "tick" }
}

export function vstat(stat: "total_clicks" | "total_story_seen"): Value {
  return { type: "stat", stat }
}

export function vtagStat(tag: string, dimension: "collected" | "triggered"): Value {
  return { type: "tag_stat", tag, dimension }
}

export function vop(op: ArithmeticOp, ...args: Value[]): Value {
  return { type: "op", op, args }
}

// ── Arithmetic shorthand ──

export function vadd(...args: Value[]): Value {
  return vop("add", ...args)
}

export function vsub(...args: Value[]): Value {
  return vop("sub", ...args)
}

export function vmul(...args: Value[]): Value {
  return vop("mul", ...args)
}

export function vdiv(...args: Value[]): Value {
  return vop("div", ...args)
}

export function vmin(...args: Value[]): Value {
  return vop("min", ...args)
}

export function vmax(...args: Value[]): Value {
  return vop("max", ...args)
}

// ── Condition builders ──

export function condAlways(): Condition {
  return { type: "always" }
}

export function condNever(): Condition {
  return { type: "never" }
}

export function condAnd(...conditions: Condition[]): Condition {
  return { type: "and", conditions }
}

export function condOr(...conditions: Condition[]): Condition {
  return { type: "or", conditions }
}

export function condNot(condition: Condition): Condition {
  return { type: "not", condition }
}

export function condCmp(op: CompareOp, left: Value, right: Value): Condition {
  return { type: "cmp", op, left, right }
}

export function condHasEnhancement(target: EnhancementId): Condition {
  return { type: "has_enhancement", target }
}

export function condHasSpot(target: SpotId, minLevel?: Value): Condition {
  return { type: "has_spot", target, ...(minLevel !== undefined ? { minLevel } : {}) }
}

export function condHasLabel(label: number): Condition {
  return { type: "has_label", label }
}

export function condAreaExplored(target: AreaId): Condition {
  return { type: "area_explored", target }
}
