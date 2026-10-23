# Unit 0320-U09b：MapRun Facts Owner 与 Save/Resume

## Goal

以 MapRun 根状态作为 MapRun Fact Counter/Flag 的唯一 Owner，按 Map 声明初始化并闭合跨 Activity、Encounter、Node 的生命周期和 Save/Resume 校验。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task / 合同 | Task 0320 P2、U08 E2 Contract Freeze、U09a Receipt | 已冻结 Fact 字段、生命周期与作者定义 |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/docs-829/05-conventions/architecture-discipline.md` | Patch Unit 白名单与状态 Owner 边界 |
| 生命周期 | `docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle.md` | 区分 MapRun Save 与 PlayerState/InitSnapshot 生命周期 |
| 契约 | `src/arona-clicker/contracts/map/map-run.ts`：`MapRun`、`MapRunSaveSnapshot` | 根状态与 Save checkpoint 的持有形状 |
| Owner | `src/arona-clicker/services/map/map-run-service.ts`：`start`、`restart`、移动/完成路径、`restoreRunState`、`createSaveSnapshot`、`restoreSaveSnapshot` | 初始化、保留、重置、清除、恢复校验的唯一写入入口 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-map-save-resume.test.ts` | Run 生命周期、checkpoint 往返与拒绝恢复证据 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 16k tokens；聚焦 MapRun 根状态与 Save/Resume |
| 文档 Read Set | 5 篇/节；不追溯历史 Task |
| 历史文档 | 0 篇 |
| 超预算处理 | 需要改 AG-1 scheduler snapshot/Receipt 时拆到后续 Unit；需要影响 PlayerState 或新增 Owner 时停止上报 |

## Optional Read Set

- `docs/docs-829/03-data-structures/game-view.md`，仅当验证 MapRun 事实是否意外泄漏进 ReadModel 时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `src/ui/**`、`src/data-services/validation/**`、`src/data-services/registry/**`；作者形状与 Schema 已由 U09a 完成，本 Unit 不接 Effect AST。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| U09a 的 `GameplayMapDef.mapRunFacts` 是可选声明；Counter 为 `id/initial/min/max`，Flag 为 `id/initial`，总声明上限64 | `src/data-services/contracts/gameplay-map.ts`、U09a Receipt | 无声明的 Map 必须维持无 MapRun Fact 状态 |
| `MapRun` 是独立于 PlayerState 的 MapRunService Owner；Save checkpoint 保存 `mapId/resumeVersion/run` | `map-run.ts` 的 `MapRun`/`MapRunSaveSnapshot`、`map-run-service.ts` 的 `MapRunService` 与 `createSaveSnapshot` | Save Codec 已整体深拷贝 MapRun checkpoint |
| 当前 Encounter locals 位于 `MapRunEncounterSnapshot`；新 Encounter 会按其定义初始化自己的 locals | `map-run.ts`、`createEncounterSnapshot` | MapRun Facts 不能挂在 Encounter 或 Activity 上 |
| 新 Run 由 `MapRunService.start` 创建；恢复由 `restoreRunState` 验证后再经 `restoreSaveSnapshot` 安装 | `map-run-service.ts` | 失败恢复不会安装部分 Run |
| 移动与 Activity/Encounter 转换保留 Run 根字段；`restart` 重新调用 `start`，放弃/终局清除活动 Owner | `map-run-service.ts`：`move`、`advanceCompletedActivity`、`restart`、`abandon`、终局处理 | 需由本 Unit 的行为测试锁定 Facts 生命周期 |

## Constraints

- 以 U09a 声明为源，初始化 MapRun 根层的 detached Counter/Flag 当前值；Counter 保存 `id/value`，且恢复时依据当前 Map 声明校验 ID、顺序、类型和 `[min,max]` 边界；Flag 依据当前声明校验 ID、顺序与 boolean 类型。不得信任 Save 中可伪造的范围或额外字段。
- 只有 Map 声明了 `mapRunFacts` 时才在 Run 中物化 Fact 状态；未声明的旧 Map 不产生默认运行态 Fact 字段。声明对象缺省某一列表时，Owner 仍按稳定的闭合形状提供该类空集合。
- Facts 持续跨 Round、Activity、Encounter 和 Node；新 Run/Restart 按作者初值重建；Abandon、成功或失败清除时不泄漏到下一个 Run。Encounter locals 保持原生命周期。
- Save/Resume 继续走现有 `MapRunSaveSnapshot`；拒绝缺失、未知、重复、畸形或越界事实状态，并保持现有“验证成功后原子安装”的 Restore 行为。不增加旧存档迁移。
- 此 Unit 不实现 Fact 读写、Effect AST、Edge 条件或 ReadModel；AG-1 `schedulerStartSnapshot`/Receipt 格式与历史重算由依赖本 Unit 的后续 Unit 完成。
- 遵守 `architecture-discipline` 与当前 MapRun Owner；不写 PlayerState、EventBus、Story 或 InitSnapshot。

## Allowed Files

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `tests/engine/gameplay-b-map-run.test.ts`
- `tests/engine/gameplay-b-map-save-resume.test.ts`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U09b-maprun-fact-owner-save-resume.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U09b-receipt.md`

## Explicit Non-goals

- 不改 Registry、作者合同、Schema、作者示例或 `resumeVersion` 的生产内容值；U09a 已完成作者定义，当前生产 Map 尚无 MapRun Facts 声明。
- 不扩展 AG-1 scheduler start snapshot、scheduler 格式版本、Commit Receipt 或 Restore 重算；单列后续 Unit。
- 不实现 E2R、`forTargets`、余额 Value/Condition、额外目标或 Facts 的 Effect 读写。
- 不改 Save Codec、PlayerState、UI、Story/AC、Edge、临时 Item 或 GALHCG。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若状态 Owner 不能限定为 MapRun 根、恢复需要旧存档迁移、必须扩大到 Allowed Files 外，或源码/测试与本合同不符，停止并报告证据及所需范围调整。

## Completion Criteria

- [x] 新 Run 按当前 Map 声明初始化 Counter/Flag；无声明的 Map 不增加运行态字段。
- [x] Facts 跨 Encounter/Activity/Node 保持，Encounter locals 不变；Restart 重置，Abandon/终局清除。
- [x] Save/Resume 精确保留有效 Facts；畸形、缺失、额外、重复或越界状态被拒绝且无部分安装。
- [x] `gameplay-b-map-run` 与 `gameplay-b-map-save-resume` 定向测试、类型检查、差异检查通过并记入 Receipt。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| MapRun 生命周期 | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts` | Run 初始化、跨活动保留、重启/清理行为正确 |
| Save/Resume | `npx vitest run --silent tests/engine/gameplay-b-map-save-resume.test.ts` | 有效 Facts 往返；非法快照拒绝且 Owner 不变 |
| 类型检查 | `npx tsc --noEmit` | 退出码0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
