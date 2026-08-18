import type {
  Value,
  Condition,
  ArithmeticOp,
  CompareOp,
  EvaluationContext,
} from "./types"

// ── Value evaluator ──

export function evaluateValue(v: Value, ctx: EvaluationContext): number {
  switch (v.type) {
    case "const":
      return v.value

    case "resource":
      return ctx.player.resources[v.target] ?? 0

    case "resource_gained_total":
      return ctx.player.resourceLog[v.target]?.totalGained ?? 0

    case "resource_gained_init": {
      const rl = ctx.player.resourceLog[v.target]
      return rl?.perInit[ctx.player.currentInit]?.gained ?? 0
    }

    case "flag": {
      const val = ctx.player.flags[v.key]
      return typeof val === "number" ? val : 0
    }

    case "context_flag": {
      if (ctx.contextFlags == null) return 0
      const val = ctx.contextFlags.get(v.key)
      if (val == null) return 0
      if (typeof val === "boolean") return val ? 1 : 0
      if (typeof val === "number") return val
      return 0
    }

    case "spot_level":
      return ctx.player.spots[v.target]?.level ?? 0

    case "enhancement_level": {
      const state = ctx.player.enhancements[v.target]
      return state?.unlocked ? 1 : 0
    }

    case "tick":
      return ctx.runtime.currentTick

    case "stat":
      return evaluateStat(v.stat, ctx.player)

    case "tag_stat":
      return evaluateTagStat(v.tag, v.dimension, ctx.player)

    case "op": {
      const args = v.args.map((a) => evaluateValue(a, ctx))
      return applyArithmeticOp(v.op, args)
    }
  }
}

function evaluateStat(
  stat: "total_clicks" | "total_story_seen",
  player: EvaluationContext["player"],
): number {
  switch (stat) {
    case "total_clicks":
      return player.totalClicks
    case "total_story_seen":
      return player.totalStorySeen
  }
}

function evaluateTagStat(
  tag: string,
  dimension: "collected" | "triggered",
  player: EvaluationContext["player"],
): number {
  const ts = player.tagStats[tag]
  if (ts == null) return 0
  switch (dimension) {
    case "collected":
      return ts.totalCollected
    case "triggered":
      return ts.totalTriggered
  }
}

function applyArithmeticOp(op: ArithmeticOp, args: number[]): number {
  switch (op) {
    case "add":
      return args.reduce((a, b) => a + b, 0)
    case "sub":
      return args.reduce((a, b) => a - b)
    case "mul":
      return args.reduce((a, b) => a * b, 1)
    case "div":
      return args.reduce((a, b) => (b === 0 ? 0 : a / b))
    case "min":
      return Math.min(...args)
    case "max":
      return Math.max(...args)
  }
}

// ── Condition evaluator ──

export function evaluateCondition(c: Condition, ctx: EvaluationContext): boolean {
  switch (c.type) {
    case "always":
      return true

    case "never":
      return false

    case "and":
      return c.conditions.every((sub) => evaluateCondition(sub, ctx))

    case "or":
      return c.conditions.some((sub) => evaluateCondition(sub, ctx))

    case "not":
      return !evaluateCondition(c.condition, ctx)

    case "cmp": {
      const left = evaluateValue(c.left, ctx)
      const right = evaluateValue(c.right, ctx)
      return compare(c.op, left, right)
    }

    case "has_enhancement":
      return ctx.player.enhancements[c.target]?.unlocked === true

    case "has_spot": {
      const minLvl = c.minLevel ? evaluateValue(c.minLevel, ctx) : 1
      return (ctx.player.spots[c.target]?.level ?? 0) >= minLvl
    }

    case "has_label":
      return ctx.labels?.has(c.label) === true

    case "area_explored":
      return ctx.player.areaStates[c.target]?.explorationProgress > 0
  }
}

function compare(op: CompareOp, left: number, right: number): boolean {
  switch (op) {
    case "eq":
      return left === right
    case "ne":
      return left !== right
    case "gt":
      return left > right
    case "gte":
      return left >= right
    case "lt":
      return left < right
    case "lte":
      return left <= right
  }
}
