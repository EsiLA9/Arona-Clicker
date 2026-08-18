import type { Funclet, FuncList, ExecutionContext } from "./types"
import { evaluateValue } from "./evaluator"

export function executeFunclet(f: Funclet, ctx: ExecutionContext): void {
  try {
    switch (f.type) {
      case "add_resource": {
        const amount = evaluateValue(f.value, ctx.evalCtx)
        ctx.player.resources[f.target] =
          (ctx.player.resources[f.target] ?? 0) + amount
        return
      }

      case "set_player_flag": {
        ctx.player.flags[f.key] = evaluateValue(f.value, ctx.evalCtx)
        return
      }

      case "give_spot": {
        const lvl = f.level ? evaluateValue(f.level, ctx.evalCtx) : 1
        const existing = ctx.player.spots[f.target]
        if (existing) {
          existing.level = Math.max(existing.level, lvl)
        } else {
          ctx.player.spots[f.target] = {
            level: lvl,
            lastProductionTick: ctx.runtime.currentTick,
          }
        }
        return
      }

      case "give_enhancement": {
        const state = ctx.player.enhancements[f.target]
        if (state) {
          state.unlocked = true
        } else {
          ctx.player.enhancements[f.target] = {
            unlocked: true,
            active: true,
          }
        }
        return
      }

      case "set_context_flag": {
        if (ctx.storyContext == null) return
        ctx.storyContext.accumulatedFlags.set(f.key, f.value)
        return
      }

      case "travel_to_area": {
        ctx.player.currentArea = f.target
        return
      }

      case "play_story": {
        ctx.pendingStory = f.storyId
        return
      }

      case "custom":
        return
    }
  } catch {
    // 成功静默完成，失败静默跳过
  }
}

export function executeFuncList(funcs: FuncList, ctx: ExecutionContext): void {
  for (const f of funcs) {
    executeFunclet(f, ctx)
  }
}
