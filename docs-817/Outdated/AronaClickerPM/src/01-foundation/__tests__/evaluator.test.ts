import { describe, it, expect } from "vitest"
import { evaluateValue, evaluateCondition } from "../evaluator"
import type { Value, Condition, EvaluationContext } from "../types"

function makeCtx(overrides?: Partial<EvaluationContext>): EvaluationContext {
  return {
    player: {
      saveVersion: 1,
      createdAt: 0,
      lastSaveAt: 100,
      currentInit: "init_1",
      currentArea: "area_1",
      unlockedInits: ["init_1"],
      completedInits: [],
      resources: { coin: 100, gem: 5 },
      resourceLog: {
        coin: { totalGained: 500, totalConsumed: 400, perInit: { init_1: { gained: 300, consumed: 200 } } },
        gem: { totalGained: 20, totalConsumed: 15, perInit: { init_1: { gained: 10, consumed: 5 } } },
      },
      flags: { tutorial_done: 1, boss_defeated: 0 },
      spots: { mine: { level: 3, lastProductionTick: 10 }, farm: { level: 1, lastProductionTick: 5 } },
      enhancements: { double_drop: { unlocked: true, active: true }, auto_smelt: { unlocked: false, active: false } },
      areaStates: {
        forest: { discovered: true, unlocked: true, explorationProgress: 100 },
        cave: { discovered: true, unlocked: false, explorationProgress: 50 },
        volcano: { discovered: false, unlocked: false, explorationProgress: 0 },
      },
      storyInstances: {},
      tagStats: {
        rare: { totalCollected: 7, totalTriggered: 3, uniqueItems: ["a"], perInit: { init_1: { collected: 5, triggered: 2 } } },
      },
      chatHistory: [],
      totalClicks: 42,
      totalStorySeen: 3,
      visibilityState: {},
      mutuallyExcluded: {},
    },
    runtime: { currentTick: 100, spotProductionCache: [], activeEffects: [], isHibernating: false },
    contextFlags: new Map([["story_flag", 1], ["encounter_done", true], ["name_set", "alice"]]),
    labels: new Set([1, 3, 5]),
    ...overrides,
  }
}

// ── Value tests ──

describe("evaluateValue", () => {
  it("const: returns literal value", () => {
    expect(evaluateValue({ type: "const", value: 42 }, makeCtx())).toBe(42)
    expect(evaluateValue({ type: "const", value: -1 }, makeCtx())).toBe(-1)
    expect(evaluateValue({ type: "const", value: 0 }, makeCtx())).toBe(0)
  })

  it("resource: returns current amount, 0 if missing", () => {
    const ctx = makeCtx()
    expect(evaluateValue({ type: "resource", target: "coin" as any }, ctx)).toBe(100)
    expect(evaluateValue({ type: "resource", target: "gem" as any }, ctx)).toBe(5)
    expect(evaluateValue({ type: "resource", target: "nonexistent" as any }, ctx)).toBe(0)
  })

  it("resource_gained_total: returns total gained across all inits", () => {
    const ctx = makeCtx()
    expect(evaluateValue({ type: "resource_gained_total", target: "coin" as any }, ctx)).toBe(500)
    expect(evaluateValue({ type: "resource_gained_total", target: "gem" as any }, ctx)).toBe(20)
    expect(evaluateValue({ type: "resource_gained_total", target: "nonexistent" as any }, ctx)).toBe(0)
  })

  it("resource_gained_init: returns gained in current init only", () => {
    const ctx = makeCtx()
    expect(evaluateValue({ type: "resource_gained_init", target: "coin" as any }, ctx)).toBe(300)
    expect(evaluateValue({ type: "resource_gained_init", target: "nonexistent" as any }, ctx)).toBe(0)
  })

  it("flag: returns numeric flag value, 0 for non-number or missing", () => {
    const ctx = makeCtx()
    expect(evaluateValue({ type: "flag", key: "tutorial_done" }, ctx)).toBe(1)
    expect(evaluateValue({ type: "flag", key: "boss_defeated" }, ctx)).toBe(0)
    expect(evaluateValue({ type: "flag", key: "nonexistent" }, ctx)).toBe(0)
  })

  it("context_flag: returns from contextFlags map", () => {
    const ctx = makeCtx()
    expect(evaluateValue({ type: "context_flag", key: "story_flag" }, ctx)).toBe(1)
    expect(evaluateValue({ type: "context_flag", key: "encounter_done" }, ctx)).toBe(1)
    expect(evaluateValue({ type: "context_flag", key: "name_set" }, ctx)).toBe(0)
    expect(evaluateValue({ type: "context_flag", key: "missing" }, ctx)).toBe(0)
  })

  it("context_flag: returns 0 when contextFlags is undefined", () => {
    const ctx = makeCtx({ contextFlags: undefined })
    expect(evaluateValue({ type: "context_flag", key: "story_flag" }, ctx)).toBe(0)
  })

  it("spot_level: returns spot level, 0 if not owned", () => {
    const ctx = makeCtx()
    expect(evaluateValue({ type: "spot_level", target: "mine" as any }, ctx)).toBe(3)
    expect(evaluateValue({ type: "spot_level", target: "nonexistent" as any }, ctx)).toBe(0)
  })

  it("enhancement_level: returns 1 if unlocked, 0 otherwise", () => {
    const ctx = makeCtx()
    expect(evaluateValue({ type: "enhancement_level", target: "double_drop" as any }, ctx)).toBe(1)
    expect(evaluateValue({ type: "enhancement_level", target: "auto_smelt" as any }, ctx)).toBe(0)
    expect(evaluateValue({ type: "enhancement_level", target: "nonexistent" as any }, ctx)).toBe(0)
  })

  it("tick: returns current tick", () => {
    expect(evaluateValue({ type: "tick" }, makeCtx())).toBe(100)
  })

  it("stat: returns player stats", () => {
    const ctx = makeCtx()
    expect(evaluateValue({ type: "stat", stat: "total_clicks" }, ctx)).toBe(42)
    expect(evaluateValue({ type: "stat", stat: "total_story_seen" }, ctx)).toBe(3)
  })

  it("tag_stat: returns tag collection/trigger counts", () => {
    const ctx = makeCtx()
    expect(evaluateValue({ type: "tag_stat", tag: "rare", dimension: "collected" }, ctx)).toBe(7)
    expect(evaluateValue({ type: "tag_stat", tag: "rare", dimension: "triggered" }, ctx)).toBe(3)
    expect(evaluateValue({ type: "tag_stat", tag: "nonexistent", dimension: "collected" }, ctx)).toBe(0)
  })

  // op arithmetic

  it("op/add: sums all args", () => {
    const v: Value = { type: "op", op: "add", args: [{ type: "const", value: 1 }, { type: "const", value: 2 }, { type: "const", value: 3 }] }
    expect(evaluateValue(v, makeCtx())).toBe(6)
  })

  it("op/sub: subtracts sequentially", () => {
    const v: Value = { type: "op", op: "sub", args: [{ type: "const", value: 10 }, { type: "const", value: 3 }, { type: "const", value: 2 }] }
    expect(evaluateValue(v, makeCtx())).toBe(5)
  })

  it("op/mul: multiplies all args", () => {
    const v: Value = { type: "op", op: "mul", args: [{ type: "const", value: 2 }, { type: "const", value: 3 }, { type: "const", value: 4 }] }
    expect(evaluateValue(v, makeCtx())).toBe(24)
  })

  it("op/div: divides sequentially, handles division by zero as 0", () => {
    const v1: Value = { type: "op", op: "div", args: [{ type: "const", value: 10 }, { type: "const", value: 2 }] }
    expect(evaluateValue(v1, makeCtx())).toBe(5)
    const v2: Value = { type: "op", op: "div", args: [{ type: "const", value: 10 }, { type: "const", value: 0 }] }
    expect(evaluateValue(v2, makeCtx())).toBe(0)
  })

  it("op/min: returns smallest arg", () => {
    const v: Value = { type: "op", op: "min", args: [{ type: "const", value: 5 }, { type: "const", value: 2 }, { type: "const", value: 8 }] }
    expect(evaluateValue(v, makeCtx())).toBe(2)
  })

  it("op/max: returns largest arg", () => {
    const v: Value = { type: "op", op: "max", args: [{ type: "const", value: 5 }, { type: "const", value: 2 }, { type: "const", value: 8 }] }
    expect(evaluateValue(v, makeCtx())).toBe(8)
  })

  it("nested op: deeply nested expression", () => {
    // (10 + 5) * (20 - (min:3 15)) = 15 * 17 = 255
    const v: Value = {
      type: "op", op: "mul", args: [
        { type: "op", op: "add", args: [{ type: "const", value: 10 }, { type: "const", value: 5 }] },
        { type: "op", op: "sub", args: [
          { type: "const", value: 20 },
          { type: "op", op: "min", args: [{ type: "const", value: 3 }, { type: "const", value: 15 }] },
        ] },
      ],
    }
    expect(evaluateValue(v, makeCtx())).toBe(255)
  })

  it("mixed leaf types in op", () => {
    // coin(100) + gem(5) * tick(100) = 100 + 500 = 600
    const v: Value = {
      type: "op", op: "add", args: [
        { type: "resource", target: "coin" as any },
        { type: "op", op: "mul", args: [
          { type: "resource", target: "gem" as any },
          { type: "tick" },
        ] },
      ],
    }
    expect(evaluateValue(v, makeCtx())).toBe(600)
  })
})

// ── Condition tests ──

describe("evaluateCondition", () => {
  it("always: returns true", () => {
    expect(evaluateCondition({ type: "always" }, makeCtx())).toBe(true)
  })

  it("never: returns false", () => {
    expect(evaluateCondition({ type: "never" }, makeCtx())).toBe(false)
  })

  it("and: true when all true, false when any false", () => {
    const cond: Condition = { type: "and", conditions: [{ type: "always" }, { type: "always" }] }
    expect(evaluateCondition(cond, makeCtx())).toBe(true)

    const cond2: Condition = { type: "and", conditions: [{ type: "always" }, { type: "never" }] }
    expect(evaluateCondition(cond2, makeCtx())).toBe(false)
  })

  it("and: short-circuits on first false", () => {
    let sideEffect = false
    const cond: Condition = {
      type: "and", conditions: [
        { type: "never" },
        // This would set sideEffect if evaluated, but shouldn't be reached
        { type: "always" },
      ],
    }
    expect(evaluateCondition(cond, makeCtx())).toBe(false)
    expect(sideEffect).toBe(false)
  })

  it("or: true when any true, false when all false", () => {
    const cond: Condition = { type: "or", conditions: [{ type: "never" }, { type: "never" }] }
    expect(evaluateCondition(cond, makeCtx())).toBe(false)

    const cond2: Condition = { type: "or", conditions: [{ type: "never" }, { type: "always" }] }
    expect(evaluateCondition(cond2, makeCtx())).toBe(true)
  })

  it("or: short-circuits on first true", () => {
    const cond: Condition = {
      type: "or", conditions: [
        { type: "always" },
        // won't be reached
        { type: "never" },
      ],
    }
    expect(evaluateCondition(cond, makeCtx())).toBe(true)
  })

  it("not: inverts condition", () => {
    expect(evaluateCondition({ type: "not", condition: { type: "always" } }, makeCtx())).toBe(false)
    expect(evaluateCondition({ type: "not", condition: { type: "never" } }, makeCtx())).toBe(true)
  })

  describe("cmp", () => {
    const left: Value = { type: "const", value: 10 }
    const right: Value = { type: "const", value: 5 }

    it("eq", () => {
      expect(evaluateCondition({ type: "cmp", op: "eq", left, right: left }, makeCtx())).toBe(true)
      expect(evaluateCondition({ type: "cmp", op: "eq", left, right }, makeCtx())).toBe(false)
    })
    it("ne", () => {
      expect(evaluateCondition({ type: "cmp", op: "ne", left, right }, makeCtx())).toBe(true)
      expect(evaluateCondition({ type: "cmp", op: "ne", left, right: left }, makeCtx())).toBe(false)
    })
    it("gt", () => {
      expect(evaluateCondition({ type: "cmp", op: "gt", left, right }, makeCtx())).toBe(true)
      expect(evaluateCondition({ type: "cmp", op: "gt", left: right, right: left }, makeCtx())).toBe(false)
    })
    it("gte", () => {
      expect(evaluateCondition({ type: "cmp", op: "gte", left, right: left }, makeCtx())).toBe(true)
      expect(evaluateCondition({ type: "cmp", op: "gte", left: right, right: left }, makeCtx())).toBe(false)
    })
    it("lt", () => {
      expect(evaluateCondition({ type: "cmp", op: "lt", left: right, right: left }, makeCtx())).toBe(true)
      expect(evaluateCondition({ type: "cmp", op: "lt", left, right }, makeCtx())).toBe(false)
    })
    it("lte", () => {
      expect(evaluateCondition({ type: "cmp", op: "lte", left: right, right: left }, makeCtx())).toBe(true)
      expect(evaluateCondition({ type: "cmp", op: "lte", left, right }, makeCtx())).toBe(false)
    })
  })

  it("has_enhancement: true when unlocked", () => {
    const ctx = makeCtx()
    expect(evaluateCondition({ type: "has_enhancement", target: "double_drop" as any }, ctx)).toBe(true)
    expect(evaluateCondition({ type: "has_enhancement", target: "auto_smelt" as any }, ctx)).toBe(false)
    expect(evaluateCondition({ type: "has_enhancement", target: "nonexistent" as any }, ctx)).toBe(false)
  })

  it("has_spot: checks level >= minLevel (default 1)", () => {
    const ctx = makeCtx()
    // mine has level 3
    expect(evaluateCondition({ type: "has_spot", target: "mine" as any }, ctx)).toBe(true)
    expect(evaluateCondition({ type: "has_spot", target: "mine" as any, minLevel: { type: "const", value: 4 } }, ctx)).toBe(false)
    // nonexistent spot
    expect(evaluateCondition({ type: "has_spot", target: "nonexistent" as any }, ctx)).toBe(false)
  })

  it("has_label: true only when label is in context labels set", () => {
    const ctx = makeCtx()
    expect(evaluateCondition({ type: "has_label", label: 1 }, ctx)).toBe(true)
    expect(evaluateCondition({ type: "has_label", label: 99 }, ctx)).toBe(false)
  })

  it("has_label: returns false when labels is undefined", () => {
    const ctx = makeCtx({ labels: undefined })
    expect(evaluateCondition({ type: "has_label", label: 1 }, ctx)).toBe(false)
  })

  it("area_explored: true when explorationProgress > 0", () => {
    const ctx = makeCtx()
    expect(evaluateCondition({ type: "area_explored", target: "forest" as any }, ctx)).toBe(true)
    expect(evaluateCondition({ type: "area_explored", target: "volcano" as any }, ctx)).toBe(false)
    expect(evaluateCondition({ type: "area_explored", target: "nonexistent" as any }, ctx)).toBe(false)
  })

  it("complex nested condition", () => {
    // (has_spot mine >= 2) AND (NOT (has_enhancement auto_smelt)) OR (tick > 1000)
    const cond: Condition = {
      type: "or",
      conditions: [
        {
          type: "and",
          conditions: [
            { type: "has_spot", target: "mine" as any, minLevel: { type: "const", value: 2 } },
            { type: "not", condition: { type: "has_enhancement", target: "auto_smelt" as any } },
          ],
        },
        { type: "cmp", op: "gt", left: { type: "tick" }, right: { type: "const", value: 1000 } },
      ],
    }
    expect(evaluateCondition(cond, makeCtx())).toBe(true)
  })
})
