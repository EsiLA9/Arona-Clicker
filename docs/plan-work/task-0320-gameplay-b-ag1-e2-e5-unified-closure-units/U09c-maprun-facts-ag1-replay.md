# Unit 0320-U09c：MapRun Facts 的 AG-1 回执重放

## Goal

将 MapRun-root Facts 纳入 AG-1 scheduler 起点快照和 Receipt，并由 Restore 重建起点、重跑真实计划及校验最终 Facts；把 scheduler 格式升级到 v2。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task / 合同 | Task 0320 P2、U08 E2 Contract Freeze、U09b Receipt | MapRun Facts 生命周期、Receipt/Restore 与版本升级已冻结 |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/docs-829/05-conventions/architecture-discipline.md` | 单一 Owner、Receipt 重放与白名单边界 |
| 契约 | `src/arona-clicker/contracts/map/map-run.ts`：scheduler snapshot、AG-1 Receipt、`MapRunFactState` | 起点与结果字段形状、scheduler 格式版本 |
| Owner | `src/arona-clicker/services/map/map-run-service.ts`：`schedulerStartSnapshotOf`、`resolveAg1EncounterCommitPlan`、`restoreAg1EncounterCommitReceipt`、`restoreRunState` | 起点复制、历史 Run 重建和完整回执重算入口 |
| 测试 | `tests/engine/gameplay-b-map-ag1-commit.test.ts`、`tests/engine/gameplay-b-map-ag1-restore.test.ts` | AG-1 版本、计划快照及篡改拒绝行为 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 14k tokens；仅处理 Facts 的 AG-1 scheduler/replay 接线 |
| 文档 Read Set | 4 篇/节 |
| 历史文档 | 0 篇 |
| 超预算处理 | 若需改 Effect Planner 产生/修改 Facts，交后续 Effect 语义 Unit；不得在本 Unit 越过 AG-1 replay 边界 |

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| U09b 已将 MapRun Facts 放入 MapRun 根并保存/恢复，未声明 Facts 不物化字段 | `MapRun.mapRunFacts`、U09b Receipt | 本 Unit 读取根状态，不改变其生命周期 |
| AG-1 起点快照由 `schedulerStartSnapshotOf` 构造；Restore 对闭合字段做验证后从它重建 `historicalRun` 并重跑 `resolveAg1EncounterCommitPlan` | `map-run-service.ts`、U06 Receipt | 需把 Facts 放在 Run 根输入，不放 Encounter locals |
| scheduler 当前版本为1，类型、生成、恢复校验与 commit/restore tests 都固定该版本 | `map-run.ts`、`map-run-service.ts`、两项 AG-1 tests | 改 snapshot 结构须升版本；不做旧版本迁移 |
| 生产 Gameplay B Maps 当前未声明 `executionContractId: 'AG-1'`；AG-1 运行态合同通过测试 Map 覆盖 | `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`、AG-1 tests | 测试 fixture 应随 replay 格式同步递增 `resumeVersion` |

## Constraints

- AG-1 scheduler 起点快照将 `mapRunFacts` 放在 Run 根层；必须 detached、闭合且按 U09b 当前 Map 声明重验。未声明 Facts 时字段缺省；声明了 Facts 时必须完整出现，Counter/Flag 顺序、ID、类型和边界由作者声明确定。
- AG-1 Receipt 增加 `plannedMapRunFacts` 结果字段；本 Unit 尚无 Facts Effect 写入，计划结果应与起点一致。Restore 必须重算而非信任保存结果，并检查当前 Run 根 Facts 与最近成功 Receipt 的计划结果一致。
- `schedulerFormatVersion` 从1升到2；Restore 拒绝旧版本和未知结构，不增加迁移分支。会生成/保存 scheduler Receipt 的 Commit 与 Restore 测试 Map 提高 `resumeVersion`；只覆盖无回执 Save/Resume 的 AG-1 fixture 不在本 Unit 范围内。当前无生产 AG-1 Map，不改生产 `resumeVersion`。
- 不改变 U09b Run 生命周期，不把 Facts 移到 Encounter snapshot/locals；不实现随机、循环、资源 Value/Condition、additional target 或 Facts Effect 读写。
- 成功/失败/过期 Commit 与 Restore 保持既有原子安装和幂等语义。不得改 Owner 以外的 PlayerState、Effect Planner、Schema、UI 或 GALHCG。

## Allowed Files

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `tests/engine/gameplay-b-map-ag1-commit.test.ts`
- `tests/engine/gameplay-b-map-ag1-restore.test.ts`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U09c-maprun-facts-ag1-replay.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U09c-receipt.md`

## Explicit Non-goals

- 不修改 MapRun Facts 作者类型/Registry/Schema、Run Owner/Save/Resume 生命周期或正式作者示例；分别由 U09a/U09b 完成。
- 不实现 Effect AST、Fact 读写、E2R RNG、`forTargets`、资源 Value/Condition、额外目标或 UI。
- 不改生产 Map `resumeVersion`；目前没有生产 AG-1 Map。不得增加旧 scheduler v1 的 Restore 兼容层。
- 不操作 GALHCG 图、刷新或 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若无法仅由起点快照重建 MapRun Facts 并重跑回执、需接触 Effect Planner/外部 Owner，或需修改 Allowed Files 外路径，停止并上报具体证据。

## Completion Criteria

- [x] scheduler v2 起点快照保存 detached MapRun-root Facts；未声明 Facts 时字段缺省。
- [x] AG-1 Receipt 保存重算后的 `plannedMapRunFacts`；本阶段没有 Fact Effect 写入时结果与起点一致。
- [x] Restore 严格重建事实起点、重跑计划并验证起点/结果/当前 Run 状态，拒绝篡改和 v1 Receipt，且无部分安装。
- [x] Commit/Restore scheduler Receipt 测试 Map `resumeVersion` 已递增；定向测试、类型和差异检查通过并记录。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| AG-1 Commit | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-commit.test.ts` | scheduler v2 快照与 Receipt 正确、未声明 Map 兼容 |
| AG-1 Restore | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-restore.test.ts` | Facts 起点重建、回执重算、伪造和旧版本拒绝 |
| 类型检查 | `npx tsc --noEmit` | 退出码0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
