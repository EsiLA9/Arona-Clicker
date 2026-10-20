# Unit 0288-U6：保存 MapRun 并按内容版本恢复

## Goal
将活动 MapRun checkpoint 与 PlayerState 分开存放，恢复时校验 Map ID / resumeVersion；旧 OperationRun 不转换且不得影响 PlayerState。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 文档 | `docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice.md`、`docs/plan-work/archive/draft-0287-gameplay-b-phase-b-contract.md` | 已冻结的生命周期与存档合同 |
| 文档 | `docs/docs-829/05-conventions/architecture-discipline.md` | 持久化状态边界 |
| 源码 | `src/arona-clicker/contracts/save-data.ts`、`src/arona-clicker/contracts/save-codec.ts` | SaveData 字段形态 |
| 源码 | `src/arona-clicker/runtime-save-codec.ts`、`src/arona-clicker/runtime-game-instance.ts` | 快照与恢复调用 |
| 源码 | `src/arona-clicker/contracts/map-run.ts`、`src/arona-clicker/services/map-run-service.ts` | U4 当前只提供运行命令，U6 需补 Owner 级无副作用 checkpoint / restore API |
| 测试 | `tests/engine/gameplay-b-save-resume.test.ts` | 现有 Operation checkpoint 测试仅作保存模式参考 |

## Context Budget
- 目标 12k–25k tokens；历史文档 0 篇；最多 7 个文件 / 700 行净改动。

## Confirmed Facts
| 事实 | 依据 |
|---|---|
| 当前 SaveData 有独立 `operationRun` checkpoint。 | `contracts/save-data.ts` |
| 恢复过程由 GameInstance 在装载 SaveData 时调用。 | `runtime-game-instance.ts` |
| U4 MapRunService 只暴露 start / snapshot / move / complete 命令，私有 slot 无法从白名单外原样恢复。 | `services/map-run-service.ts` |

## Constraints
- `mapRun` 独立于长期 PlayerState；不保存 UI 可写副本。
- SaveData 中的活动 checkpoint 包含原 Run ID、Map ID / resumeVersion、当前位置、访问/完成进度与活动 Encounter 节点。只保存进行中的 Run。
- `MapRunService` 增加 Owner 级 checkpoint / restore API；恢复应直接校验并装入状态，不得通过重复执行 start / move / complete 命令重放，以免生成新 Run ID 或重放 Encounter 结算。
- Map 缺失或 resumeVersion 不匹配时拒绝恢复 MapRun，保留 PlayerState，并给 UI / Runtime 一个可观察的失效结果。
- 失效结果使用现有 DevLog warning / Activity Log 暴露；不为此扩建新的通用恢复状态 API。
- `operationRun` 与 `mapRun` 保持不同格式与恢复路径，绝不相互转换。本 Task 不提前移除仍有效的旧 Operation 恢复能力；旧内容退役时的 Run 失效提示和清理确认由 0287 C5 验收。
- 只存 MapRun 与活动 Encounter 当前实际具有的状态；不可为了将来抽卡预先增加占位字段。

## Allowed Files
- src/arona-clicker/contracts/save-data.ts
- src/arona-clicker/contracts/save-codec.ts
- src/arona-clicker/contracts/map-run.ts
- src/arona-clicker/services/map-run-service.ts
- src/arona-clicker/runtime-save-codec.ts
- src/arona-clicker/runtime-game-instance.ts
- New file: tests/engine/gameplay-b-map-save-resume.test.ts

## Explicit Non-goals
- OperationRun 数据迁移、旧 `operationRun` Schema 删除或本阶段停用旧 Operation 恢复能力。
- Hand / Swap 恢复、奖励发放、清理旧内容。

## Stop Conditions
1. 需要改白名单外文件、静默删除旧 Run 或改变 PlayerState。
2. 恢复依赖 Map 作者字段而这些字段尚未在 U1 冻结。
3. 超过 7 个文件 / 700 行或新增第二份权威 Runtime 状态。
4. 定向测试或类型检查失败且无法定位。

## Completion Criteria
- [ ] Map 上 checkpoint 可原样保存、恢复位置 / 进度。
- [ ] 恢复保留原 Run ID；活动 Encounter 被无副作用地恢复，不重复触发进入或完成结算。
- [ ] 活动 Encounter checkpoint 可保存与恢复；恢复不重复触发进入结果。
- [ ] 未知 Map / 版本失配拒绝只影响 MapRun，不改 PlayerState。
- [ ] 被拒绝的原因在现有 Activity Log / DevLog 中可观察。
- [ ] 旧 OperationRun 不能被误解释为 MapRun；其现行恢复路径保持独立，退役时的失效与清理流程留给 C5。

## Verification
| 项 | 命令 | 期望 |
|---|---|---|
| 定向测试 | `npx vitest run tests/engine/gameplay-b-map-save-resume.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
