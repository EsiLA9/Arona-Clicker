# Unit 0320-U13b：E2 Owner Effect RNG 与 scheduler v3

## Goal

将 U13a 的纯 Effect RNG 接入唯一 MapRun Owner：新 Encounter 从 Hand seed 派生独立 Effect state，同一 Encounter 跨 Round 延续；source queue 以同一 detached state 连续运行；成功 Commit 原子安装 after-state；scheduler start snapshot/Receipt 保存前后 state，Restore 从起点重放真实随机选择并升级 scheduler v2→v3。保留 Hand RNG 算法、seed、cursor 和候选概率行为。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → production context pack、`docs/ai/PROJECT-CONSTITUTION.md`、`architecture-discipline.md` | Owner、RNG state、原子 Commit/Restore 与 Unit 纪律 |
| 上游合同 | Task 0320 P2、U08 §E2R RNG、U09c Receipt、U12c Owner facts/balance Receipt、U13a Unit/Receipt | seed 派生、跨来源游标、Restore 和已接入 Owner 路径 |
| 运行态契约 | `src/arona-clicker/contracts/map/map-run.ts`：Encounter Snapshot、scheduler start、Receipt | 保存 Encounter state、回执 before/after 和 scheduler version |
| Owner | `src/arona-clicker/services/map/map-run-service.ts`：`createEncounterSnapshot`、`schedulerStartSnapshotOf`、AG-1 source loop、commit install、Save/Resume/Restore | seed 生命周期、随机状态传递与历史计划重算 |
| Commit 测试 | `tests/engine/gameplay-b-map-ag1-commit.test.ts` | Preview/Commit/失败/重试和跨 Round 状态 |
| Restore 测试 | `tests/engine/gameplay-b-map-ag1-restore.test.ts` | scheduler v3、random target trace 重算、旧版/篡改拒绝 |
| 项目地图 | `graph_project(acprogram)` 与定向 MapRun/Restore 路径搜索 | 核对项目身份和直接影响；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 14k tokens；限 MapRun Effect RNG 生命周期、scheduler v3 与两份 AG-1 行为测试 |
| 文档 Read Set | 5 篇/节；不读历史 Task |
| 历史文档 | 0 篇；U08/U09c/U12c/U13a 是当前合同与证据 |
| 超预算处理 | 若独立 Effect Receipt Validator 必须同步升级，停下来另切 U13c；不得把 E1 Receipt path 混作 AG-1 主恢复路径 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| U13a 已提供 `createMapEffectRandomState(handInitialSeed)`、随机抽样与 Planner input/next-state/trace | U13a Receipt；`gameplay-b-effect-rng.ts`、`map-effect-planner.ts` | Planner 已能接同一状态，但 Owner 尚未传入/安装 |
| Hand RNG state 的 `seed` 在 Encounter Round 之间保持，`cursor` 随抽牌增加；新 Encounter 通过 `nextActivityRandomState` 获取新 seed | `map-run-service.ts`：`createEncounterSnapshot`、`nextActivityRandomState` | 同 Encounter Round 只能保留 Effect state，新的 Encounter 必须重新派生 |
| scheduler start snapshot 已重建 AG-1 起点，Receipt Restore 会重跑 `resolveAg1EncounterCommitPlan` 并精确比较结构 | `map-run.ts`、`map-run-service.ts`：`schedulerStartSnapshotOf`、`restoreAg1EncounterCommitReceipt` | 新增 state 要随 scheduler v2→v3 严格版本边界保存 |
| AG-1 Commit/Restore 测试 fixture 的 `resumeVersion` 为3，当前 Receipt 固定 scheduler v2 | 两份 AG-1 定向测试；U09c Receipt | U13b 需使测试 Map `resumeVersion` 升至4；不改生产 Map |

## Constraints

- Effect RNG state 使用 U13a 固定算法和独立 seed domain。新 Encounter 从初始 Hand `randomState.seed`（任何 Hand draw 前）派生；同一 Encounter 后续 Round 保留上轮计划 after-state；切到新 Encounter 时重新从新 Hand seed 派生。不得从已经推进的 Hand cursor 派生或重置同一 Encounter 的 Effect cursor。
- MapRun Encounter Snapshot 保存当前 Effect state；scheduler start snapshot 保存 Commit 前 state；AG-1 Receipt 保存本轮计划后的完整 Effect state，即使本轮没有随机语句也记录 unchanged state。
- `resolveAg1EncounterCommitPlan` 将单一 detached Effect state 沿稳定 AG-1 source execution sequence 传入每个 Program Planner，取回 next-state 后交给下一个来源。不同来源不得各自重置到 scheduler start seed。
- Preview/prepare/过期/失败/执行错误和 Restore 验证都只在 detached 副本推进。仅成功 Commit 的 atomic install 才把 after-state 放入下一 Round Encounter；没有目标或没有消耗 raw word 时游标保持不变。
- Restore 只接受 scheduler v3，拒绝 v2 与未知版本；闭合验证 before-state、after-state seed/algorithm/cursor、随机目标身份 Trace、当前 Encounter state 与重算结果。旧 scheduler 无迁移分支。
- Map Resume Version 对已含新 Effect state/scheduler v3 Receipt 的测试 Map 升至4；不提高无相关存档内容的其它 Map，也不修改当前非 AG-1 生产 Map。
- Hand `randomState`、`drawCursorStart` 和 `GAMEPLAY_B_HAND_RNG_ALGORITHM` 完全保持；不得把 Effect RNG 嵌入 Hand state、改变 Hand 抽取候选概率或引入 `Math.random`。
- 任何新 Encounter seed state、scheduler snapshot state、Receipt state 均需闭合字段、unsigned 32-bit seed、非负 safe-integer cursor 校验；只用 `copyMapEffectRandomState` 验证/深拷贝。

## Allowed Files

### 施工实现白名单（Agent）

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `tests/engine/gameplay-b-map-ag1-commit.test.ts`
- `tests/engine/gameplay-b-map-ag1-restore.test.ts`

### Task Owner 维护的施工记录

- 本 Unit、对应 Receipt、Task 0320 与 `docs/plan-work/00-index.md`

实现控制为 4 个实现路径、约 400–600 行净改动；若超 Unit 默认预算，应按状态/Owner与Receipt重算拆分，不扩大 Context。

## Explicit Non-goals

- 不修改 Hand RNG 算法或Hand状态，不改非AG-1/E1效果计划路径。
- 不实现独立 `map-effect-receipt-validator.ts` 的随机 Receipt 重放；需要时另立 U13c 并证明和 AG-1 Restore 的覆盖关系。
- 不接 additionalTarget 身份、additionalActor/loopTargetActor 写账户、E3候选随机或任何跨 Map 随机状态。
- 不改 Schema、UI、作者合同、Task 0316–0319，不操作 GALHCG 图、不刷新或写 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若 Hand seed 在新 Encounter 边界不能稳定取得、scheduler v3 不足以从同一 start snapshot 重放跨来源随机 trace、Restore 字段与闭合版本不符，或需要改白名单外 Receipt Validator/fixture 文件，停止并上报证据及所需拆分。

## Completion Criteria

- [x] 新 Encounter seed 确定派生，Round 延续，Effect state 与 Hand cursor 完全分离；Preview/失败/重试不安装状态。
- [x] AG-1 queue 跨来源连续消费同一游标；Commit 后 after-state 原子安装，scheduler v3 Receipt 保存起点/终点和随机目标 trace。
- [x] Restore 从 scheduler start 重跑并校验随机身份顺序、before/after state 和当前 Encounter state；拒绝 v2/未知格式、篡改与 `resumeVersion:3` 存档。
- [x] 两项 AG-1 Commit/Restore 定向测试、`npx tsc --noEmit`、`npm run check:docs` 与 `git --no-pager diff --check` 通过并记录 Receipt。
- [x] Hand RNG 行为保持原样；独立 Effect Receipt Validator 与 additionalTarget Runtime 均仍是单独范围。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| AG-1 Commit | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-commit.test.ts` | Preview纯读、successful cursor install、failed/expired/terminal和跨Round行为正确 |
| AG-1 Restore | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-restore.test.ts` | scheduler v3 重放、旧版本与state/trace篡改拒绝 |
| 类型检查 | `npx tsc --noEmit` | 退出码0 |
| 文档链接/结构 | `npm run check:docs` | 新 Unit/Receipt 路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
