# 02-modules/state-mutation — 单一写入口与每帧结算

> 一句话：`StateMutationService` 是产品业务状态变更的集中写入口（改值 → 记统计 → 发事件）；`TickSystem` 编排每帧生产结算。

## 职责边界

- **管**：产品业务 `PlayerState` 写方法、产品状态层的 `effect-ops` 分发、三层访问器（当前层/快照层回退）、每帧资源产出入账。
- **不管**：业务校验（门面层 canXxx 只读判定）、联动逻辑（订阅方自己做）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `src/arona-clicker/state/state-mutation-service.ts` | **产品 Runtime 业务状态的集中写入口实现**：资源/Spot/Manager/物品/强化/世界线/标记/Extra/角色/色彩/剧情/学生阻断等业务写方法；写方法内「改值 → 记统计 → 发事件」 |
| `src/arona-clicker/state/effect-ops.ts` | `applyEffects` / `applyEffect`：按 `EffectOp` 分发到产品 `EffectMutationPort`；基础引擎只保留最小 `StateMutationPort` |
| `src/engine/system/tick-system.ts` | 每 Tick 编排：逐 Resource 调 `gameNumSystem.evaluateResourceGain` → `changeResource` 入账 → 发 `spotProduced`（resource 粒度）+ `tick` 事件 |

## 当前边界待核对

`TickSystem.tick()` 目前会直接执行 `state.totalFrames += 1`，再发出 `tick` 事件；这项帧计数写入与“所有状态都经 StateMutationService”的架构纪律关系尚待确认。当前 Wiki 只把业务状态 mutation 描述为集中写入口，不据此宣布该例外已获裁定。代码入口见 `src/engine/system/tick-system.ts`；探索记录见 [[docs/archive/docs-828-snapshot/01-architecture/AC-outline-wiki#探索中待进一步核对]]。

## 核心概念

- **4 步管道**：门面只读校验 → mutations 写（改值/统计/事件）→ 监听器响应 → 可选派生重建。详见 [[docs/archive/docs-828-snapshot/04-mechanisms/state-mutation]]。
- **为什么不可绕过**：绕过则统计错记、事件漏发、GameNum 缓存陈旧、UI 不一致。
- 写方法与事件对照表见 [[docs/archive/docs-828-snapshot/04-mechanisms/state-mutation]]。

## 测试入口

`tests/engine/` 多数测试经由该服务写入；`spot-tag.test.ts`、`game-num-invalidation.test.ts` 覆盖失效契约。

## 相关文档

[[docs/archive/docs-828-snapshot/01-architecture/state-layers]] · [[docs/archive/docs-828-snapshot/05-conventions/architecture-discipline]]（纪律 1）
