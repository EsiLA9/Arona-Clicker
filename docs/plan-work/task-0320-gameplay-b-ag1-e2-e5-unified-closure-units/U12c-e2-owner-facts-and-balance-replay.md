# Unit 0320-U12c：E2 AG-1 Owner Facts 与余额快照接线

## Goal

将 U12b 纯 Planner 输出接入 AG-1 唯一 MapRun Owner：每个来源在固定费用支付后、效果执行前读取该来源开始余额快照；MapRun Facts 从来源开始当前根状态读取，并在来源计划成功后更新 detached 整轮状态，使后续来源可见。成功 Commit 将最终 Facts 安装到 MapRun 根、写入已有 `plannedMapRunFacts` Receipt 字段，并让 scheduler v2 Restore 从起点重放和核验结果。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → production context pack、`docs/ai/PROJECT-CONSTITUTION.md`、`architecture-discipline.md` | Effect Owner、原子安装和 Patch Unit 纪律 |
| 上游合同 | Task 0320 P2、U08 Frozen P2 Contract、U09c Receipt、U12b Unit/Receipt | 来源起始读时点、Facts 生命周期与 Planner 输出形状 |
| MapRun | `src/arona-clicker/contracts/map/map-run.ts`：Fact state、scheduler start snapshot、AG-1 Receipt | 确认当前 Facts 与回执字段已存在，不增加版本字段 |
| Owner | `src/arona-clicker/services/map/map-run-service.ts`：`resolveAg1EncounterCommitPlan`、`planProgramSource`、Receipt 组装、`restoreAg1EncounterCommitReceipt`、`installPreparedEncounterCommit` | 传递每来源快照、聚合事实结果、安装与恢复重算 |
| 测试 | `tests/engine/gameplay-b-map-ag1-commit.test.ts`、`tests/engine/gameplay-b-map-ag1-restore.test.ts` | 费用时点、来源可见性、根状态安装、回执重放及篡改拒绝 |
| 项目地图 | `graph_project(acprogram)` 与定向 Owner/Restore 路径搜索 | 核对当前项目和直接影响；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 14k tokens；限 AG-1 source loop、Facts/Resource snapshot 和 Commit/Restore 定向测试 |
| 文档 Read Set | 5 篇/节；不追溯历史 Task |
| 历史文档 | 0 篇；U08/U09c/U12b 是当前合同与实现证据 |
| 超预算处理 | 需要新增 Receipt schema、scheduler 版本、additionalTarget、随机 RNG 或外部 Owner 时停止并交 Task Owner 拆分 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| AG-1 先为来源构造并支付固定 cost probe，再调用 `planProgramSource`，随后才按来源结算 Effect resource ledger | `map-run-service.ts`：`resolveAg1EncounterCommitPlan` 中来源循环 | 余额快照应在 cost probe `applyChanges` 后生成 |
| Owner 的四组工作余额 Map 会在成功来源后更新；后续来源可以读取先前来源已结算结果 | `map-run-service.ts`：`actorBalances`、`teamBalances`、`enemyActorBalances`、`enemyTeamBalances` 与 `applyChanges` | 同来源 Planner 输入须冻结，不被本源 ResourceChange 意图回写 |
| scheduler v2 起点快照已有 MapRun-root Facts；Receipt 已有 `plannedMapRunFacts`；Restore 会由起点构造历史 Run 并重算 AG-1 plan | `map-run.ts`、`map-run-service.ts`：`schedulerStartSnapshotOf`、`restoreAg1EncounterCommitReceipt`；U09c Receipt | 本 Unit 复用结构，不升版本 |
| U12b `MapEffectSourceInput` 可携带 Facts 声明+当前状态、来源开始余额快照；Plan 可输出更新后的 MapRun Facts | U12b Receipt 与 `map-effects.ts` | 本 Unit 只负责 Owner 传入、聚合、安装和重放 |

## Constraints

- 只在 AG-1 source loop 接线；E1/legacy 路径保持现状。若 Map 没有 `mapRunFacts` 声明，则不构造 Planner Facts 输入，也不在 Run/Receipt 多物化空状态。
- 为每个程序来源构造余额快照，包含已物化的 Party/Enemy Actor 与两侧 Team 当前余额；快照在该来源所有固定费用扣除后生成，效果规划完成后冻结。任何缺失 Owner balance 项都报错，不默认成 0。
- Effect Planner 输出的 Actor/Team 资源变化仍由现有 `settlementChangesFor`/`applyChanges` 在同来源后兑现。同来源内 `resourceBalance` 读取不观察该来源自己的资源写入；后续来源看到之前成功来源兑现后的余额。
- 以当前 Run MapRun-root Facts 为 detached 聚合状态；每个 `planProgramSource` 接收作者声明与当前值。每个成功来源产生的 `plannedMapRunFacts` 按来源顺序替换工作状态；无 Program、跳过来源或本来源无 Facts 输出时保留当前状态。
- Commit plan 的 `plannedMapRunFacts` 为整轮最终状态。Receipt 保存该结果，`baseRun` 安装同一结果；成功或终局路径均不丢弃 Facts。失败/过期/预算拒绝/异常时不安装 Facts、资源、HP 或 Receipt 的部分变化。
- Restore 仍从 `schedulerStartSnapshot` 重建初始 Facts 和资源，运行同一 AG-1 Planner 并精确比较 Trace、`plannedMapRunFacts`、当前 Run Facts 与 Owner balances；Receipt 的保存结果不能作为新输入。
- scheduler 保持 v2；不增加迁移。对无随机 AST 的既有 v2 fixture 保持通过；随机 TargetSet 依 U12a 明确失败。
- `additionalActor` 没有额外目标领域身份绑定，Owner 快照不得猜测身份；Planner 必须保持显式拒绝。当前 resourceChange 写账户仍限 sourceActor/primaryActor/sourceTeam。

## Allowed Files

### 施工实现白名单（Agent）

- `src/arona-clicker/services/map/map-run-service.ts`
- `tests/engine/gameplay-b-map-ag1-commit.test.ts`
- `tests/engine/gameplay-b-map-ag1-restore.test.ts`

### Task Owner 维护的施工记录

- 本 Unit、对应 Receipt、Task 0320 与 `docs/plan-work/00-index.md`

实现控制为 3 个实现文件、约 300–500 行净改动；子 Agent 不得编辑施工记录。

## Explicit Non-goals

- 不改 `map-run.ts` 字段、MapRun Facts 作者合同/Schema 或 scheduler v2 Receipt 格式。
- 不实现 Effect RNG/随机抽选/scheduler v3、additionalTarget Draft/运行时选择、新 resourceChange 写账户。
- 不修改纯 Planner U12b 语义，除非发现源/输出合同冲突；发生冲突按停止条件上报，不在 Owner Unit 越界扩建。
- 不改 AC PlayerState、GameInstance 外部 Owner、UI、Task 0316–0319，不操作 GALHCG 图、不刷新或写 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若 MapRun Owner 当前 cost/Effect 顺序与 U08 不符、已有 v2 Receipt 不足以重放新增输入、需改允许文件外路径，或安装路径不能原子保持一致，停止并提交具体证据和拆分方案。

## Completion Criteria

- [x] 同来源余额读取时点为固定 cost 支付后、效果写入前；来源间余额可见性遵循 AG-1 顺序，未物化账户/资源拒绝。
- [x] MapRun Fact 有序写入在同源后续语句及后续来源可见；完成计划的 Facts 与 Run 根状态和 Receipt 结果完全相同。
- [x] scheduler v2 Restore 从起点重算 Facts/余额/Trace，拒绝 Facts、余额、Receipt 或当前 Run 篡改；失败和重试无部分安装。
- [x] AG-1 Commit 与 Restore 定向测试、`npx tsc --noEmit`、`npm run check:docs`、`git --no-pager diff --check` 通过并记录 Receipt。
- [x] 不声称随机、additionalActor 读取或 additionalTarget 领域身份可运行。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| AG-1 Commit | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-commit.test.ts` | source-start balance、Fact 顺序、根状态安装与失败原子性通过 |
| AG-1 Restore | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-restore.test.ts` | 起点重放、结果比较和篡改拒绝通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码0 |
| 文档链接/结构 | `npm run check:docs` | 新 Unit/Receipt 路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
