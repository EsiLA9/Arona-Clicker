# Unit 0320-U10c：E2 Normalizer 循环递归与来源元数据

## Goal

让 Effect Program Normalizer 保留 U10a/U10b 已闭合的 `forTargets` 语句体和 MapRun Fact 写入节点；循环体中的每条语句、条件与嵌套分支均附稳定来源路径与 `program` 模式。同步收紧只读摘要消费者，明确拒绝尚未纳入摘要合同的新语句，避免把新节点误报为旧 Flag。此 Unit 不求值、不规划、不执行任何 Effect。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → production context pack、`docs/ai/PROJECT-CONSTITUTION.md` | 路由、白名单与 Patch Unit 纪律 |
| 上游合同 | Task 0320 P2、U08 Frozen P2 Contract、U10a AST/Syntax、U10b Context/Registry | `forTargets`、MapRun Fact 节点、严格语法与来源准入已冻结 |
| Normalizer | `src/data-services/normalization/gameplay-map-effect-program.ts`：Normalized types、`normalizeCondition`、`normalizeProgramStatements` | 当前 `when` 递归实现与遗漏结构的落点 |
| 作者 AST | `src/data-services/contracts/gameplay-map-effects.ts`：`GameplayMapEffectStatementDef`、`GameplayMapEffectLoopStatementDef`、Loop Value/Condition | 递归输入类型及词法作用域结构 |
| 测试 | `tests/data/gameplay-b-effect-normalization.test.ts` | 路径元数据、输入不变性、闭合 AST 的既有行为 |
| 只读摘要消费方 | `src/arona-clicker/services/map/map-effect-summary.ts`：`summarizeMapActionEffects`；`tests/engine/gameplay-b-effect-projection.test.ts` | 新归一化节点进入联合类型后，旧终末分支可能把非 Flag 当 Flag 读取 |
| 项目地图 | `graph_project(acprogram)` 与定向 Normalizer 路径搜索 | 施工前核对项目身份和直接影响；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k tokens；限于 Normalizer、AST 类型、声明摘要消费者与定向测试 |
| 文档 Read Set | 4 篇/节 |
| 历史文档 | 0 篇；U08/U10a/U10b 是当前合同 |
| 超预算处理 | 需改 Planner、Effect Receipt、Schema、Context 或另一个源码/测试路径时停止并请求上游拆分 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Normalizer 目前为每个顶层叶语句及 `when` 分支加 `originPath`、`mode: 'program'`，并递归规范化 `when` 条件与分支 | `gameplay-map-effect-program.ts`：`normalizeProgramStatements` | 非 `when` 语句目前以浅拷贝保留嵌套字段 |
| 新 AST `forTargets.body` 可含递归 Loop Statement、嵌套循环及 loopTarget Value/Condition | `gameplay-map-effects.ts`：Loop AST 类型；U08/U10a | 原样浅拷贝会漏掉子语句的来源元数据 |
| MapRun Counter/Flag 写入是新的叶语句；Context/Registry 只校验 ID 与命名域，不负责 Normalizer 元数据 | 作者 AST；U10b Context/Registry | 两种写入均需规范化为 Normalized leaf |
| 当前 Normalization 定向测试约束不修改作者输入，且调用语法校验以拒绝越界节点 | `gameplay-b-effect-normalization.test.ts` | 新测试沿用该行为 |
| `summarizeMapActionEffects` 的终末 `else` 目前读取 `flagId/value`，原本依赖联合类型中仅余 `flagSet` | `map-effect-summary.ts`：`summarizeMapActionEffects` | 新节点扩入 Normalized union 后报 TS2339；不得错误投影成 Flag |

## Constraints

- 对顶层和循环体 `forTargets` 递归处理 body；内层 `when.then/else` 中的 `forTargets` 也递归处理。
- 所有新增叶节点（`mapRunCounterAdd`、`mapRunFlagSet`）保留字段，并有自身正确 `originPath` 与 `mode: 'program'`；`forTargets` 控制节点自身以及其 body 子节点也有来源元数据。
- 给循环语句、loop-only `when`、HP/状态语句保留 U10a 定义的 Loop 值、条件和目标类型；内层 `loopTarget` 只作为作者 AST 数据保留，不在 Normalizer 中解析身份。
- TargetSet、Value 表达式及账户引用仍是结构数据；不求值、不绑定运行态资源或目标、不消耗 RNG、不改预算语义。
- 只读声明摘要不扩展 `MapDeclaredEffectSummary` 合同。对 `forTargets` 与 MapRun Fact 写入这些尚无摘要表示的新叶语句，摘要消费者必须显式抛出带操作名/来源路径的 unsupported 错误；不得静默漏报或伪装成旧 Counter/Flag。
- 正常化不得改变作者输入；精确字段校验与结构上限继续由现有 Syntax 校验器负责。
- `NormalizedGameplayMapActionEffects` 的既有 `budget` / `prepare` / `resolve` 外形和旧 E1/E2 子片的来源路径语义保持兼容。

## Allowed Files

### 施工实现白名单（Agent）

- `src/data-services/normalization/gameplay-map-effect-program.ts`
- `tests/data/gameplay-b-effect-normalization.test.ts`
- `src/arona-clicker/services/map/map-effect-summary.ts`
- `tests/engine/gameplay-b-effect-projection.test.ts`

### Task Owner 维护的施工记录

- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U10c-e2-normalizer-loop-metadata.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U10c-receipt.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md`
- `docs/plan-work/00-index.md`

因独立类型检查发现声明摘要旧终末分支将新 Normalized 节点错误视作 Flag，Task Owner 将本 Unit 白名单从 2 个文件扩为 4 个文件：增加只读摘要的明确 unsupported 边界及对应测试；不扩展 UI 或摘要合同。总净改动仍须控制在约 300–500 行内。实现代理不得改 Unit、Receipt、Task 或索引。

## Explicit Non-goals

- 不修改 AST 合同、语法、Context/Registry、Map Action、Schema 或生成文件。
- 不修改 Planner、RNG Owner/scheduler v3、Receipt/Save/Resume、UI 或运行时状态；摘要改动仅限下述 unsupported guard。
- 摘要只增加对当前未支持节点的显式拒绝；不添加新摘要种类、不展开循环或评估任何条件。
- 不实现 `forTargets` / MapRun Facts 的运行语义；Normalizer 通过不代表 Runtime 能执行。
- 不扩展 `resourceChange.account` 或实现 `additionalTarget`。
- 不改 Task 0316–0319 已完成切片，不操作 GALHCG 图、不刷新或写 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若 Loop Statement 类型无法在当前 AST 闭集内表达、需修改白名单外路径、规范化要求执行/身份解析语义，或预计净改动超过 500 行，停止并上交已核实证据。

## Completion Criteria

- [x] 顶层 `forTargets` 及其 body 递归规范化，循环节点和所有子语句均有准确来源路径与 `program` 模式。
- [x] 内层循环和 `when.then/else` 可继续包含循环；MapRun Counter/Flag 写入叶节点保留字段并有准确元数据。
- [x] 循环作用域允许的单位、HP/资源 Value 与 Condition 结构被原样保留，不在此层做语义求值；作者输入保持不变。
- [x] 摘要消费方将尚无投影合同的 `forTargets` / MapRun Fact 写入明确报为 unsupported，不把其字段误读为 Flag；旧声明摘要行为保持不变。
- [x] 旧 `when` / Status / 确定性 E2 Normalizer 测试继续通过；新增递归路径和新叶节点断言通过。
- [x] Normalizer 与摘要投影定向测试、`npx tsc --noEmit`、`npm run check:docs` 与 `git --no-pager diff --check` 通过并写入 Receipt。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Normalizer | `npx vitest run --silent tests/data/gameplay-b-effect-normalization.test.ts` | 旧结构兼容，新循环路径完整 |
| 摘要投影 | `npx vitest run --silent tests/engine/gameplay-b-effect-projection.test.ts` | 旧投影通过，新节点明确 unsupported |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 文档链接/结构 | `npm run check:docs` | 新 Unit/Receipt 路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
