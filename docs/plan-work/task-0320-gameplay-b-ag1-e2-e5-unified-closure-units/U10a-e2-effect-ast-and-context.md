# Unit 0320-U10a：E2 Effect AST 与严格语法

## Goal

为 U08 冻结的随机 TargetSet、`forTargets`、资源余额 Value/Condition 与 MapRun Facts 读写补齐闭合作者类型和结构语法；语法结果标识 AG-1 专属 AST，Map/Encounter 准入及引用绑定由后续 U10b 完成。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → `docs/ai/context-packs/production`、`docs/ai/PROJECT-CONSTITUTION.md` | 项目路由和正式 Unit 施工纪律 |
| 规范 | `docs/docs-829/05-conventions/architecture-discipline.md`、`docs/docs-829/05-conventions/testing.md` | 保持作者校验边界并按影响验证 |
| 上游合同 | Task 0320 P2、U08 §Frozen P2 Contract 与 §E2 作者 AST 拼写 | 语义、字段拼写、AG-1 准入与预算已冻结 |
| 作者类型 | `src/data-services/contracts/gameplay-map-effects.ts` | 当前 Value、Condition、Statement、TargetSet 和闭合账户联合 |
| 语法 | `src/data-services/validation/gameplay-map-effect-syntax.ts` | 当前严格闭合节点校验、结构深度和静态节点预算 |
| 测试 | `tests/data/gameplay-b-effect-syntax.test.ts` | 语法拒绝、闭合字段与词法环目标形状 |
| 项目地图 | `graph_project(acprogram)`；定向搜索 `forTargets` 与相关文件路径 | 已核对项目身份；源码字面搜索尚无 `forTargets` 命中，后续以当前文件核证 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 14k tokens；只读取列出的 AST、语法校验器和测试 |
| 文档 Read Set | 4 篇/节，不顺序通读其它阶段 |
| 历史文档 | 0 篇；U08 是当前裁定权威 |
| 超预算处理 | 需要增加 Context/Registry、Map Action 字段、Schema/Normalizer、Planner/Owner 或超过预算时停止，交上游拆分 Unit |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| TargetSet 当前支持 `definition` 与 HP 比例排序，`random` 尚不在闭合语法中；`limit` 可选 | `gameplay-map-effect-syntax.ts`：`checkDamageTarget` | random 需要改成强制 `limit: 1..32` |
| Value、Condition、Statement 为显式闭合联合，当前无 `forTargets`、资源余额 Value/Condition 或 MapRun Fact 节点 | `gameplay-map-effects.ts`；语法校验器的 switch | U08 已冻结可实现形状 |
| Map 的 `executionContractId` 可省略、为 `E1-COMPAT-1` 或 `AG-1` | `gameplay-map.ts` 与 `registry-validate.ts` | 本 Unit 仅让语法结果标识 AG-1 专属构造；实际准入由 U10b 验证 |
| AST、严格语法和 Map/Encounter 引用绑定可分别验证 | 本 Unit 源码范围与 U10b 白名单 | 本 Unit 不宣称上下文引用有效或 Runtime 可执行 |

## Constraints

- 逐字段遵循 U08 冻结形状：random TargetSet；`{ op:'forTargets', targetSet, body }`；`resourceBalance` / `resourceAtLeast`；MapRun Counter/Flag Value、Condition、Statement。
- 仅增加 AST/严格结构校验。语法未知字段仍须拒绝；节点、Value、Condition、深度与展开预算保持有界。语法结果 `requiresAg1` 只表达准入需求，由 U10b 的上下文入口消费。
- 新构造最终仅适用于明确 `executionContractId: 'AG-1'` 的 Map；本 Unit 只产出准入需求标记，省略合同和 `E1-COMPAT-1` 的拒绝由 U10b 负责。MapRun Facts 声明自身可存在于 E1 Map，但该 Map 的 Effect Program 不可读写它。
- 账户闭合集合按 U08 识别；本 Unit 未增加 Action `additionalTarget`，所以 `additionalActor` 不得被上下文解析为有效账户。不得用 primary/source 或默认零余额替代。
- `resourceChange.account` 本 Unit 保持现有 `sourceActor | primaryActor | sourceTeam`；扩展 additional/loop Actor 写账户依赖 Runtime Planner 身份绑定，后续单独接线。
- `loopTarget` 只在 `forTargets.body` 的词法作用域可用；嵌套遮蔽外层，退出内层恢复外层。目标单位、HP Value 与 Actor 账户的可见性必须由上下文递归访问器检查。
- MapRun Fact ID 的分域引用校验、资源/单位绑定与 Encounter locals 分离由 U10b 负责；本 Unit 只检查作者字段形状。
- Schema 暂由后续独立 Unit 生成/同步；本 Unit 不宣称作者 Schema 已同步，Task 在 Schema Unit 完成前仍是进行中。
- 遵守 `docs/ai/PROJECT-CONSTITUTION.md` 停止条件；禁止改 GALHCG 图、刷新或写 freshness。

## Allowed Files

### 施工实现白名单（Agent）

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`

### Task Owner 维护的施工记录

- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U10a-e2-effect-ast-and-context.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U10a-receipt.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U08-e2-contract-freeze.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U08-receipt.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md`
- `docs/plan-work/00-index.md`

施工实现控制在 3 个源码/测试文件及约 300–500 行净改动；Task Owner 独立更新跟踪记录。U08 合同澄清只能由 Task Owner 写入。子 Agent 不得编辑本 Unit、Receipt、U08、主 Task 或索引。

## Explicit Non-goals

- 不修改 Map/Encounter 上下文校验、Registry 引用绑定、`GameplayMapActionDef`、`additionalTarget` 或来源准入；这些由 U10b/U10d 负责。
- 不扩展 `resourceChange.account`、不实现 Effect Program Normalizer、生成 Schema/Schema 同步、Planner、RNG Owner、scheduler v3、Receipt/Save/Resume、additional target runtime 或 UI。
- 不实现 Edge Fact 条件、临时 Item、跨 Map Pool、AC/Story 状态写入或新的外部 Owner。
- 不触碰 Task 0316–0319 已完成切片、生产 DataPack 样例及 GALHCG。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若 `executionContractId` 无法在现有上下文校验入口准确区分 E1/AG-1、U08 字段与当前测试冲突、需要改白名单外路径，或需要为使 AST 可接受而实现 Normalizer/Planner/Schema，停止并提交已确认事实。

## Completion Criteria

- [x] 作者类型精确表达 U08 冻结的 E2 读取 AST、Facts 操作与循环结构，TargetSet `random` 必须有 1..32 的 `limit`；其它 order 不混用随机抽取。
- [x] 严格语法校验覆盖闭合字段、非负/安全整数、静态深度与节点预算，并拒绝非法 `loopTarget` 结构位置所能静态识别的错误。
- [x] 语法返回 AG-1 专属 AST 标记；Map/Encounter 准入由 U10b 消费。
- [x] `resourceChange.account` 在本 Unit 保持既有三账户；额外/循环 Actor 写入不误混入已接线的 AST。
- [x] 定向语法测试、类型检查及差异检查通过并写入 Receipt；文档检查通过。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 语法行为 | `npx vitest run --silent tests/data/gameplay-b-effect-syntax.test.ts` | 新 AST 闭合形状/边界通过，非法形状拒绝 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 文档链接/结构 | `npm run check:docs` | 新路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
