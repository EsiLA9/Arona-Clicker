# Unit 0241-U8：角色 Hand 的 Run、恢复与 Commit

## Goal

让 Run start、原子 Beat Commit 与 Save/Resume 正确持有和安装逐角色 Hand，并在 Effect 改变 position 后解析下一手。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md` E0 | 状态生命周期裁定 |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | Run/Save/Commit 现行语义 |
| 源码 | `src/arona-clicker/services/operation-runtime-service.ts` | EventRun owner 和原子 Commit |
| 源码 | `src/arona-clicker/services/operation-resolution-planner.ts` | Action effect 应用及下轮状态 |
| 源码 | `src/arona-clicker/services/operation-participant-admission.ts` | Run start/resume 接线 |
| 测试 | `tests/engine/operation-runtime-service.test.ts`、`gameplay-b-save-resume.test.ts`、`operation-resolution-planner.test.ts` | 行为和恢复回归 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 20k–35k tokens |
| 文档 Read Set | Task E0 与 Runtime mechanism |
| 历史文档 | 0 篇 |
| 超预算处理 | 超 60k tokens 时停止并交还 Task Owner |

## Optional Read Set

- `src/arona-clicker/runtime-game-instance.ts`（只在确认 snapshot 接线方式需要时）。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `src/ui/**`、Editor、样例包

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Run 由 `OperationRuntimeService` 私有持有；成功结算后一次安装 planner 输出 | `operation-runtime-service.ts` | 新 hand 安装须处于同一原子边界 |
| SaveSnapshot 保存动态 Run，Resume 用当前 Registry 规则重建 | Runtime mechanism 与 Save/Resume tests | 不实现迁移层 |

## Constraints

- Run start 首手和 Commit 后下轮手均由 U4 纯解析器产生。
- 只有成功 Commit 才替换 Hand：成功 Beat Commit 推进 Beat index 后重解析下一手；成功 SceneAction/Card batch Commit 在已有 beatIndex 上按新 Run facts 重解析 Hand。preview/失败/拒绝命令都不替换 Hand。
- Save 保存已见 Hand；restore 校验旧状态与当前内容，不自动重抽。
- scene deck 与 PlayerCost 保持独立。

## Allowed Files

- `src/arona-clicker/contracts/operation.ts`
- `src/arona-clicker/services/operation-runtime-service.ts`
- `src/arona-clicker/services/operation-participant-admission.ts`
- `tests/engine/operation-runtime-service.test.ts`
- `tests/engine/gameplay-b-save-resume.test.ts`

## Explicit Non-goals

- UI View 投影、Editor、浏览器、数据大样例。
- 存档迁移兼容层及 tactical skill RNG 行为变更。

## Stop Conditions

使用 PROJECT-CONSTITUTION §停止条件全部 6 条；需要修改 GameInstance SaveData schema 以外的全局存档路径或任何白名单外文件时停止上报。

## Completion Criteria

- [ ] Run start 持有每个学生有限 Hand；Hands 不与 `playerSceneDeck` 混用。
- [ ] Beat Commit 成功后应用 Action/position 状态、递增 Beat 并重解析下一手；SceneAction/Card batch 成功 Commit 后也按更新后的 Run facts 重解析 Hand。
- [ ] preview/invalid/rejected command 与失败 Commit 不改变 Hand、Beat 或 RNG。
- [ ] Resume 保留原 Hand；定义或候选不匹配时整份 Run 拒绝恢复。
- [ ] back→front 后前排池激活，无显式 deck switch。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-save-resume.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

## Receipt

见 `receipts/receipt-0241-u8-operation-save-commit.md`。
