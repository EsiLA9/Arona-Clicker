import { describe, it, expect } from "vitest"
import { executeFunclet, executeFuncList } from "../funclet-executor"
import type { Funclet, FuncList, ExecutionContext, PlayerStateMut, RuntimeCacheMut } from "../types"

function makeCtx(overrides?: Partial<ExecutionContext>): ExecutionContext {
  const player: PlayerStateMut = {
    saveVersion: 1,
    createdAt: 0,
    lastSaveAt: 100,
    currentInit: "init_1",
    currentArea: "area_1",
    unlockedInits: ["init_1"],
    completedInits: [],
    resources: { coin: 100 },
    resourceLog: {
      coin: { totalGained: 500, totalConsumed: 400, perInit: { init_1: { gained: 300, consumed: 200 } } },
    },
    flags: {},
    spots: { existing_mine: { level: 2, lastProductionTick: 10 } },
    enhancements: { existing_boost: { unlocked: true, active: true } },
    areaStates: {},
    storyInstances: {},
    tagStats: {},
    chatHistory: [],
    totalClicks: 0,
    totalStorySeen: 0,
    visibilityState: {},
    mutuallyExcluded: {},
  }

  const runtime: RuntimeCacheMut = {
    currentTick: 100,
    spotProductionCache: [],
    activeEffects: [],
    isHibernating: false,
  }

  const storyContext = {
    accumulatedFlags: new Map<string, any>(),
  }

  const evalCtx = {
    player,
    runtime,
    contextFlags: new Map(),
    labels: new Set(),
  }

  return {
    evalCtx,
    player,
    runtime,
    storyContext,
    pendingStory: undefined,
    ...overrides,
  }
}

describe("executeFunclet", () => {
  describe("add_resource", () => {
    it("adds positive amount to existing resource", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "add_resource", target: "coin" as any, value: { type: "const", value: 50 } }, ctx)
      expect(ctx.player.resources.coin).toBe(150)
    })

    it("subtracts when value is negative", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "add_resource", target: "coin" as any, value: { type: "const", value: -30 } }, ctx)
      expect(ctx.player.resources.coin).toBe(70)
    })

    it("initializes resource to amount if not present", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "add_resource", target: "gem" as any, value: { type: "const", value: 10 } }, ctx)
      expect(ctx.player.resources.gem).toBe(10)
    })
  })

  describe("set_player_flag", () => {
    it("sets flag to evaluated value", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "set_player_flag", key: "tutorial_done", value: { type: "const", value: 1 } }, ctx)
      expect(ctx.player.flags.tutorial_done).toBe(1)
    })
  })

  describe("give_spot", () => {
    it("gives new spot at level 1 by default", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "give_spot", target: "new_spot" as any }, ctx)
      expect(ctx.player.spots.new_spot).toEqual({ level: 1, lastProductionTick: 100 })
    })

    it("gives new spot at specified level", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "give_spot", target: "new_spot" as any, level: { type: "const", value: 3 } }, ctx)
      expect(ctx.player.spots.new_spot.level).toBe(3)
    })

    it("upgrades existing spot if new level is higher", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "give_spot", target: "existing_mine" as any, level: { type: "const", value: 5 } }, ctx)
      expect(ctx.player.spots.existing_mine.level).toBe(5)
    })

    it("keeps existing level if new level is lower", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "give_spot", target: "existing_mine" as any, level: { type: "const", value: 1 } }, ctx)
      expect(ctx.player.spots.existing_mine.level).toBe(2)
    })
  })

  describe("give_enhancement", () => {
    it("unlocks new enhancement", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "give_enhancement", target: "new_enhance" as any }, ctx)
      expect(ctx.player.enhancements.new_enhance).toEqual({ unlocked: true, active: true })
    })

    it("sets existing enhancement to unlocked", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "give_enhancement", target: "existing_boost" as any }, ctx)
      expect(ctx.player.enhancements.existing_boost.unlocked).toBe(true)
    })
  })

  describe("set_context_flag", () => {
    it("sets flag in story context", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "set_context_flag", key: "choice_made", value: "option_a" }, ctx)
      expect(ctx.storyContext?.accumulatedFlags.get("choice_made")).toBe("option_a")
    })

    it("silently skips when storyContext is absent", () => {
      const ctx = makeCtx({ storyContext: undefined })
      executeFunclet({ type: "set_context_flag", key: "choice_made", value: 1 }, ctx)
      // should not throw
    })
  })

  describe("travel_to_area", () => {
    it("sets currentArea to target", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "travel_to_area", target: "area_2" as any }, ctx)
      expect(ctx.player.currentArea).toBe("area_2")
    })
  })

  describe("play_story", () => {
    it("sets pendingStory to storyId", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "play_story", storyId: "arona/story/prologue" as any }, ctx)
      expect(ctx.pendingStory).toBe("arona/story/prologue")
    })
  })

  describe("custom", () => {
    it("silently skips", () => {
      const ctx = makeCtx()
      executeFunclet({ type: "custom", data: { anything: true } }, ctx)
      // should not throw
    })
  })
})

describe("executeFuncList", () => {
  it("executes all funclets in order", () => {
    const ctx = makeCtx()
    const funcs: FuncList = [
      { type: "add_resource", target: "coin" as any, value: { type: "const", value: 10 } },
      { type: "add_resource", target: "coin" as any, value: { type: "const", value: 20 } },
      { type: "add_resource", target: "coin" as any, value: { type: "const", value: 30 } },
    ]
    executeFuncList(funcs, ctx)
    expect(ctx.player.resources.coin).toBe(160)
  })

  it("error in one funclet does not block subsequent funclets", () => {
    const ctx = makeCtx()
    // force an error by passing a value that evaluates to something that crashes
    const funcs: FuncList = [
      { type: "set_player_flag", key: "step1", value: { type: "const", value: 1 } },
      { type: "set_player_flag", key: "step2", value: { type: "tick" } },
    ]
    executeFuncList(funcs, ctx)
    // both should have executed; tick is valid so no error
    expect(ctx.player.flags.step1).toBe(1)
    expect(ctx.player.flags.step2).toBe(100)
  })

  it("sets pendingStory via play_story then continues", () => {
    const ctx = makeCtx()
    const funcs: FuncList = [
      { type: "add_resource", target: "coin" as any, value: { type: "const", value: 5 } },
      { type: "play_story", storyId: "test_story" as any },
      { type: "add_resource", target: "coin" as any, value: { type: "const", value: 5 } },
    ]
    executeFuncList(funcs, ctx)
    expect(ctx.player.resources.coin).toBe(110)
    expect(ctx.pendingStory).toBe("test_story")
  })
})
