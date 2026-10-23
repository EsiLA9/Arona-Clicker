# Unit 0309-U9：准备页与 MapRun 行为回归

## Goal

把既有 Map UI 测试迁到真实的设施入口→准备页→开始／继续流程，并覆盖只读查询、Story 门控、来源返回、重开／放弃与 Run 连续性。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` 的行为验收 | 明确必须证明的无写入、同 Run 与管理操作行为 |
| 测试 | `tests/ui/gameplay-b-basic-map-p0-p3.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts` | 复用真实 UI 测试启动与操作链 |
| 测试 | `tests/engine/gameplay-b-map-runtime-integration.test.ts` | 证明领域投影不写状态并正确区分 fresh / resume / blocked / unavailable |
| 源码 | `src/ui/components/map/map-entry.ts`、`controller-actions-operation.ts` | 确认入口 / 续行 UI 行为和当前 data 标记 |

## Constraints

- 测试从实际 DOM 操作用户动作，不用生产源码暴露出的内部构造状态代替路由与写入断言。
- 在地图出发前完成初始化 Story，另保留 Story 阻断用例证明忙碌入口不可打开。
- 旧 Map 地点 Flow 改用当前的 `data-map-location-node-id` 与 `data-map-location-submit` 交互，不恢复过时的直达按钮。
- 不弱化原 MapRun 快照、Encounter 结算和终局断言。

## Allowed Files

- `tests/ui/gameplay-b-basic-map-p0-p3.test.ts`
- `tests/ui/gameplay-b-map-vertical-slice.test.ts`
- `tests/engine/gameplay-b-map-runtime-integration.test.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`（仅修正默认已选目标的角色标记断言）

## Explicit Non-goals

- 不修改生产代码、Schema、存档协议或测试工具框架。
- 不更改并行 Area Map 测试及工作树中的其他文件。

## Completion Criteria

- [x] 设施入口只打开准备页；打开不产生 Run，Story 阻断时不进入。
- [x] 领域查询覆盖 fresh、同 Run resume、其他 Run blocked、Map missing，并证明查询无状态写入。
- [x] 既有 UI 流程显式从 fresh 页开始，回到准备页／离开／重入继续同 runId 且快照不变。
- [x] 真实 Encounter 受伤后返回准备页，读取当前 HP / cap 并继续同一快照。
- [x] 来源 functionality 失效后恢复日常 Game 路由，仍保留活动 Run。
- [x] 准备页管理操作复用确认：取消不变、重开创建新 Run、放弃留在 fresh 页且不自动开始。
- [x] Task 命中的 7 组定向回归通过，合计 118 项。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向行为 / 领域回归 | `npx vitest run` 指定 7 个 Task 命中测试文件 | 全部通过 |
| 项目类型检查 | `npx tsc --noEmit` | 通过 |
