# Unit 0320-U12a：E2 确定性 `forTargets` Planner

## Goal

在纯 Effect Planner 中执行 U08 冻结的有限确定性 `forTargets` 语句体：循环到达时解析一次 TargetSet 并固定顺序；嵌套 body 以 `loopTarget` 绑定当前领域身份，退出内层后恢复外层；记录可重放的列表与迭代轨迹。随机 TargetSet 当前必须显式拒绝，不能退化为定义顺序。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → production context pack、`docs/ai/PROJECT-CONSTITUTION.md` | 机制路由与 Unit 纪律 |
| 上游合同 | Task 0320 P2、U08 Frozen P2 Contract、U10a AST/Syntax、U10b Context、U10c Normalizer | 循环语义、词法范围、访问预算和输入结构已冻结 |
| Planner 合同 | `src/arona-clicker/contracts/map/map-effects.ts`：`MapEffectSourceInput`、Trace、Visit | 增加纯 Planner 可接受的 Loop 身份/Trace 形状 |
| Planner | `src/arona-clicker/services/map/map-effect-planner.ts`：`resolveSet`、Value/Condition evaluation、`apply` | 现有 target set、条件、语句执行路径 |
| 测试 | `tests/engine/gameplay-b-effect-planner.test.ts` | 单来源纯计划测试 helper 与兼容基线 |
| 项目地图 | `graph_project(acprogram)` 与定向 Planner 路径搜索 | 核对直接关系；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k tokens；限纯 Planner、Planner Trace 合同与定向测试 |
| 文档 Read Set | 4 篇/节 |
| 历史文档 | 0 篇；U08/U10 是当前权威合同 |
| 超预算处理 | 需要接 MapRun Owner/AG-1 Receipt/Restore、MapRun Facts、resourceBalance、RNG Owner、Schema 或目标 Draft 时停止并请求拆分 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Planner 的 `resolveSet` 当前支持定义顺序与 HP 比例排序，遇 `order: 'random'` 会按未排序候选直接 slice | `map-effect-planner.ts`：`resolveSet` | 新 Unit 必须先显式拒绝随机抽选 |
| Planner 已在 `when`、damage/heal、HP、Counter/Flag、Status 与资源写意图之间按有序 detached 状态规划，并通过 `options.visit` 接受外层预算 | `map-effect-planner.ts`：`apply`、`recordVisit` | Loop 每次动态访问都须调用同一个外层 visit callback |
| Normalizer 已递归保留 Loop Statement、条件、值与 `originPath/mode` | `gameplay-map-effect-program.ts`；U10c Receipt | Planner 可消费闭合 Loop 类型 |
| 当前 Planner 没有 Loop 迭代身份或 Loop Trace 结构 | `map-effects.ts`：Trace unions | 需要为重放保存 TargetSet 固定列表与迭代顺序 |

## Constraints

- 只执行非随机 `definition`、`hpRatioAscending`、`hpRatioDescending` TargetSet；`random` 必须抛出带 Action/路径诊断的 `MapEffectPlanError`，任何情况下不得按定义顺序截取前 N 个。
- 循环语句到达时调用一次 `resolveSet` 并固定身份/顺序；body 按该顺序逐一完整执行。嵌套循环使用本层候选身份遮蔽外层，退出后恢复外层。
- 循环 body 中 `loopTarget` 可用于 HP 条件、HP Value、`hpChange` 和状态目标；damage/heal 的现有 `target` Value 仍指当前命中单位，不替代 loopTarget。
- 每个语句/条件访问按现有 `options.visit` 上报，循环迭代累积到同一个来源/整轮预算；预算拒绝或 body 错误时 Planner 只返回错误，不修改调用者快照。
- Trace 记录 Loop Selector、一次解析得到的完整身份顺序及每次迭代的索引/身份标记，使没有 HP 写入的循环也能独立重放。
- 资源余额、MapRun Facts、Effect RNG、`additionalTarget` 与额外/循环 Actor 资源写账户不由本 Unit 接线；后续 Unit 承接。当前写账户仍限 sourceActor/primaryActor/sourceTeam。
- 此 Unit 只提供纯计划结构；不接 Owner、Receipt、Restore 或 UI。不能据此宣称玩家能提交新 Loop AST。

## Allowed Files

### 施工实现白名单（Agent）

- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/arona-clicker/services/map/map-effect-planner.ts`
- `tests/engine/gameplay-b-effect-planner.test.ts`

### Task Owner 维护的施工记录

- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U12a-e2-deterministic-loop-planner.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U12a-receipt.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md`
- `docs/plan-work/00-index.md`

实现控制为 3 个源码/测试文件、约 300–500 行净改动；子 Agent 不得编辑 Unit/Receipt/Task/index。

## Explicit Non-goals

- 不接 AG-1 MapRun Owner、commit、资源结算、MapRun Facts 根状态、Receipt/Save/Resume 或 Restore。
- 不实现随机抽样/Effect RNG/scheduler v3；本 Unit 明确拒绝 `order: random`。
- 不实现 resourceBalance/resourceAtLeast、MapRun Counter/Flag 读写、additionalTarget 或额外/循环 Actor 写账户。
- 不改作者 AST、Context、Normalizer、Schema、摘要/UI；摘要仍由 U10c 的 unsupported guard 阻止误报。
- 不修改 Task 0316–0319，不操作 GALHCG 图、不刷新或写 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若现有纯 Planner 无法在三白名单文件内表达 Loop Trace/预算、需要调用 MapRun Owner/RNG/运行态身份来源，或净改动预计超过 500 行，停止并上交事实与建议拆分。

## Completion Criteria

- [x] 确定性 Loop Set 在语句入口仅解析一次并按固定顺序执行；随机顺序明确失败。
- [x] `loopTarget` 的 HP/单位引用只在循环 body 有效；嵌套遮蔽和返回外层均正确。
- [x] Trace 包含完整 Loop 身份列表与迭代索引/身份，访问预算按每次 body 访问累积。
- [x] Loop/预算/异常失败不改变输入；既有单语句 TargetSet/Value/repeat/Status 计划行为保持通过。
- [x] Planner 定向测试、`npx tsc --noEmit`、`npm run check:docs` 与 `git --no-pager diff --check` 通过并写入 Receipt。
- [x] 不声称随机、Facts、余额读取或 MapRun Owner 提交/回放已实现。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Pure Planner | `npx vitest run --silent tests/engine/gameplay-b-effect-planner.test.ts` | 嵌套 Loop、顺序、Trace、拒绝随机与预算测试通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 文档链接/结构 | `npm run check:docs` | 新 Unit/Receipt 路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
