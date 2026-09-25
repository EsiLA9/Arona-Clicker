# Unit task-0151-PU-5：Runtime Projection 与重入验收

## Goal

在不覆盖 Information Reveal handler 的前提下接入 Milestone runtime action，并在 Save restore / Init / runtime projection 重建入口重建 watches。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/01-architecture/state-layers.md` | Save 权威事实与 runtime 投影边界 |
| 文档 | `docs/docs-828/04-mechanisms/trigger-effect.md` | EB-T registration lifecycle |
| Task | `docs/plan-work/task-0151-milestone-persistent-arrival-facts-p0.md` | 四项 P0 与精确一次提交判据 |
| Unit | `docs/plan-work/archive/task-0151-units/pu-4-milestone-domain-and-ebt-adapter.md` | Adapter 与 action contract |
| 源码 | `src/arona-clicker/services/information-reveal-adapter.ts` | 现有 Adapter handler 行为与撤出 |
| 源码 | `src/arona-clicker/services/milestone-adapter.ts` | PU-4 新增 Adapter 的 runtime action 入口 |
| 源码 | `src/arona-clicker/services/init-service.ts:reconcileInformationRevealWatches` | Init 生命周期对账入口 |
| 源码 | `src/arona-clicker/runtime-wiring.ts` | Adapter 构造与 runtime action routing |
| 测试 | `tests/engine/milestone-runtime.test.ts` | Save restore / 重建 / 重入验收 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–30k tokens |
| 文档 Read Set | 4 篇，含 Task / 前置 Unit |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k 时停止并重新拆分 |

## Optional Read Set

- `src/arona-clicker/runtime-save.ts`、`src/arona-clicker/runtime-reset.ts`、`src/arona-clicker/runtime.ts`：仅在现有 InitService wrappers 未覆盖目标生命周期时读取；先核对 Task 中列明的调用事实。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本 Unit 明确列出的自身依赖除外）
- UI、Achievement、Reward、Datapack editor

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| InformationRevealAdapter 构造时设置 TriggerSystem 的单一 action handler | `information-reveal-adapter.ts:constructor` | 直接新增第二次 setter 会覆盖前者 |
| InitService 已提供 Reveal watches withdraw / reconcile wrapper | `init-service.ts:withdrawInformationRevealWatches, reconcileInformationRevealWatches` | 可扩展其内部聚合职责，契约仍不绑定 Init scope |
| Save restore 在 PlayerState 替换后调用 reconcile wrapper | `runtime-save.ts:restoreFromSave` | 需在集成测试覆盖已完成事实与未完成 watch |

## Constraints

- 两种 runtime action 都必须到达各自领域 handler；不得由 Milestone 覆盖或禁用 Reveal。
- projection 重建时 completed ID（含 orphan）保留；completed target 不重新监听。
- 注册先于 admission；同步重入时 StateMutationService 有效完成提交数为 1，最终该 Milestone Registration 数为 0。
- Save-scope Milestone 不建立 Init 专属持久语义；Init 只是现有 runtime rebuild 入口之一。

## Allowed Files

- `src/arona-clicker/services/information-reveal-adapter.ts`
- `src/arona-clicker/services/milestone-adapter.ts`
- `src/arona-clicker/runtime-wiring.ts`
- `src/arona-clicker/services/init-service.ts`
- `tests/engine/milestone-runtime.test.ts`（新增）

## Explicit Non-goals

- Save format migration、Milestone completed event、UI / reward、global resource Condition 修复、全新通用 projection service。

## Stop Conditions

使用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件全部 6 条。若需要修改 `runtime-save.ts`、`runtime-reset.ts`、TriggerSystem 或其他白名单外文件，停止回交并重拆 Unit。

## Completion Criteria

- [x] Reveal 与 Milestone action 同时可用，无单-handler 覆盖。
- [x] Save restore / 相关 runtime rebuild 后未完成目标重建 watch，completed / orphan ID 保留且不重新监听。
- [x] Admission 与同步事件重入竞争只产生一次有效 completed mutation，之后该目标注册数为 0。
- [x] 四项 P0 集成验收与定向测试通过。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/milestone-runtime.test.ts tests/engine/information-reveal-adapter.test.ts` | 通过，Reveal 回归不受影响 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 架构检查 | `npm run check:architecture` | 通过 |
