# Unit 0320-U12b：E2 Planner 资源余额与 MapRun Fact 语义

## Goal

在纯 Effect Planner 中实现 U08 已冻结的 MapRun Counter/Flag 有序读取与写入、以及来源开始快照的资源余额 Value/Condition 读取。支持 `sourceActor`、`primaryActor`、`sourceTeam` 与循环内 `loopTargetActor` 余额读取；`additionalActor` 在身份 Owner 接线前必须明确拒绝。输出计划后的 Facts 与写入 Trace，供后续 MapRun Owner Unit 原子安装及 AG-1 Receipt 重放。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → production context pack、`docs/ai/PROJECT-CONSTITUTION.md` | Effect 与 Patch Unit 纪律 |
| 上游合同 | Task 0320 P2、U08 E2 Contract Freeze、U10b Context/Registry、U12a Receipt | 账户集合、Facts 语义、循环绑定与预算已冻结 |
| 作者 AST | `src/data-services/contracts/gameplay-map-effects.ts`：BalanceAccount、Value、Condition、MapRun Statement | 消费现有闭合作者联合类型 |
| Normalizer | `src/data-services/normalization/gameplay-map-effect-program.ts`：Normalized Loop/Value/Condition/Instruction | 确认循环体递归类型和 Fact 来源路径 |
| Planner 合同 | `src/arona-clicker/contracts/map/map-effects.ts`：SourceInput、SourcePlan、Trace/GuardRead | 加入 detached 余额/Facts 输入输出与证据结构 |
| Planner | `src/arona-clicker/services/map/map-effect-planner.ts`：Value/Condition、`apply`、Loop | 对接固定快照、词法 loopTarget 与顺序写入 |
| 测试 | `tests/engine/gameplay-b-effect-planner.test.ts` | 纯来源计划 helper 与已有循环行为 |
| 项目地图 | `graph_project(acprogram)` 与定向 Planner 路径搜索 | 核对当前项目和直接影响；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k tokens；限 Planner 资源读、MapRun Facts 与定向行为测试 |
| 文档 Read Set | 4 篇/节；源码路径见上表 |
| 历史文档 | 0 篇；U08/U10/U12a 是现行合同与实现证据 |
| 超预算处理 | 需要 Owner、AG-1 Receipt/Restore、RNG、additionalTarget 身份或写账户扩展时停下并交 Task Owner 拆分 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| `resourceBalance` 和 `resourceAtLeast` 的作者账户闭合集合含 `sourceActor`、`primaryActor`、`additionalActor`、`loopTargetActor`、`sourceTeam` | `gameplay-map-effects.ts`：`GameplayMapEffectBalanceAccount`；U08 §E2 | 本 Unit 只让已有身份可绑定的账户运行 |
| `additionalActor` 缺少运行时额外目标身份绑定 | U09b Runtime Audit、U11 Receipt；Planner `MapEffectSourceInput` | 本 Unit 对该账户显式失败，后续 additionalTarget Runtime Unit 接线 |
| MapRun Counter/Flag 作者定义、MapRun 根状态与 AG-1 scheduler v2 起点/Receipt 字段已存在 | `gameplay-map.ts`、`map-run.ts`、U09a–U09c Receipt | 本 Unit 不修改 Owner 或回执 |
| U12a 已提供确定性循环、`loopTarget` 身份遮蔽与恢复、循环访问预算和 Trace；随机 TargetSet 明确拒绝 | U12a Receipt；Planner `forTargets` 分支 | 本 Unit 复用现有词法身份与预算 |

## Constraints

- Planner 输入提供 detached 资源余额快照；快照缺失账户、未声明资源、负值或非安全整数都报 `MapEffectPlanError`，不得把缺省账户/资源解释为 0。Planner 不修改余额快照；同来源内先前的 resourceChange 意图不改变本来源余额读取值。
- `sourceActor`、`primaryActor`、`sourceTeam` 依据本来源既有身份解析；`loopTargetActor` 只在循环 body 读取当前绑定目标 Actor。`additionalActor` 目前无运行时身份，必须显式拒绝，不做猜测或回退。
- 余额输入结构同时允许 Party/Enemy Actor 与 Party/Enemy Team；来源开始具体时点的构造和此前来源兑现可见性由后续 Owner Unit 负责。
- MapRun Facts 输入必须同时带当前值及作者声明的 Counter 边界；未声明/缺失/重复/类型非法 Fact 均报错。未声明 Facts 的 Map 不物化空 Facts，尝试读写时拒绝。
- MapRun Counter Value/Condition 与 Flag Condition 读当前 detached 计划状态；`mapRunCounterAdd` / `mapRunFlagSet` 按程序和来源语句顺序立刻更新副本，同来源后续分支与语句读到更新值。Flag 命名与 Counter 命名空间由上游 Registry 保证；Planner 仍防御性校验。
- Counter 加法须先确认安全整数范围，再按 U08/D03 饱和至声明 `[min,max]`；不能用饱和掩盖溢出。计划失败不得修改调用方输入。
- MapRun Fact 写入和 `when` 资源/Fact 条件读取保留可重放 Trace；既有 `options.visit` 对每个动态 Value/Condition/Statement 访问继续计数。
- 不升 scheduler v2；不接 Owner、Commit、resourceChange 实际结算、Receipt/Restore、Schema/UI、Effect RNG 或 additionalTarget 领域身份。

## Allowed Files

### 施工实现白名单（Agent）

- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/arona-clicker/services/map/map-effect-planner.ts`
- `tests/engine/gameplay-b-effect-planner.test.ts`

### Task Owner 维护的施工记录

- 本 Unit、对应 Receipt、Task 0320 与 `docs/plan-work/00-index.md`

实现控制为 3 个实现文件、约 300–500 行净改动；子 Agent 不得编辑施工记录。

## Explicit Non-goals

- 不改 `map-run-service.ts`、MapRun 根状态、来源结算顺序、AG-1 Receipt、Save/Resume 或 Restore；Planner 输出由后续 Owner Unit 接入。
- 不执行资源扣费或资源效果、不改变同来源资源工作余额；只读输入快照。
- 不实现 `additionalActor` 余额读取或 `additionalActor`/`loopTargetActor` 资源写账户；不提供额外目标运行时选择。
- 不实现随机抽选、Effect RNG、scheduler v3、Fact Edge 门控、UI 摘要或作者 Schema。
- 不修改 Task 0316–0319，不操作 GALHCG 图、不刷新或写 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若作者 AST 与 Normalizer 形状不符、循环预算不能覆盖动态读取、必须扩大到 MapRun Owner/Receipt/Restore，或预计超过白名单/预算，停止并报告源码证据和拆分建议。

## Completion Criteria

- [x] `resourceBalance` / `resourceAtLeast` 支持已绑定 Actor/Team 账户；循环内 `loopTargetActor` 绑定正确；缺失/未声明/非法余额及未接线 `additionalActor` 明确失败。
- [x] MapRun Fact Counter/Flag 按有序 detached 状态读取/写入；Counter 饱和、溢出拒绝、嵌套分支顺序与读写 Trace 正确。
- [x] 写意图不会改变本来源冻结余额；后续来源可见性留待 Owner Unit；Planner 异常、预算拒绝不改变输入。
- [x] 已有 E1–E4、U12a Loop Planner 定向测试及本 Unit 新测试通过，`npx tsc --noEmit`、`npm run check:docs` 与 `git --no-pager diff --check` 通过并记录 Receipt。
- [x] 不声称 MapRun Owner 提交/恢复已接入；随机 TargetSet 与额外目标身份仍受限。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Pure Planner | `npx vitest run --silent tests/engine/gameplay-b-effect-planner.test.ts` | Fact/Balance、loopTarget、原子失败与旧 Planner 行为通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码0 |
| 文档链接/结构 | `npm run check:docs` | 新 Unit/Receipt 路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
