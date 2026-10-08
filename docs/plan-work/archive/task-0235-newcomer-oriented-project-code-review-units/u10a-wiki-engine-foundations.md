# Unit 0235-U10a：Engine 契约与求值 Wiki

## Goal

说明 Engine 在产品 Runtime 中提供什么，以及表达式和 GameNum 怎样被读取与计算。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `06-wiki/40-engine/00-index.md`、`core-contracts.md`、`expressions-and-game-num.md`、`02-modules/engine.md` | 入口和 Engine 概念说明 |
| 源码 | `src/engine/index.ts`、`core/event-bus.ts`、`expression/` 的公开入口与 GameNum 构建/求值 | 核实端口、事件和表达式执行路径 |
| 测试 | `tests/engine/trigger-system.test.ts`、GameNum/Condition 相关单测 | 说明可观察计算行为 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–30k token |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 仅读表达式执行依赖的子树，细节由更深 Mechanism 页承载 |

## Optional Read Set

- `docs/docs-829/03-data-structures/engine-contracts.md`，只引用其类型边界，不复制字段。

## Do Not Read by Default

- `docs/plan-work/archive/**`、全部 Engine 文件逐符号说明。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Engine Wiki 当前覆盖核心契约与表达式/GameNum 计算。 | `06-wiki/40-engine/00-index.md` | 实际订阅/求值由实现证明。 |

## Constraints

- 明确 Engine 是供产品装配的通用能力，不等于具体产品服务。
- 术语在首见处给短定义，随后用同一名称。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u10a-wiki-engine-foundations.md`（填写本 Unit Receipt）
- `docs/docs-829/06-wiki/40-engine/00-index.md`
- `docs/docs-829/06-wiki/40-engine/core-contracts.md`
- `docs/docs-829/06-wiki/40-engine/expressions-and-game-num.md`

## Explicit Non-goals

- 不改 Engine 契约、表达式 DSL 或求值性能。
- 不在页面展开所有运算符和所有表达式 AST 节点。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；与产品服务的层界不明时先读组合根并报告冲突。

## Completion Criteria

- [x] 新人能区分 Engine 契约、产品装配和单个表达式求值。
- [x] 每个介绍的关键关系都标注导入/调用/事件类型并链接源码与测试。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 求值走读 | 选一个值/条件/GameNum 查询测试到构建与读取 | 顺序准确 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt 0235-U10a

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `docs/docs-829/06-wiki/40-engine/00-index.md`、`core-contracts.md`、`expressions-and-game-num.md`；本 Unit Receipt |
| 未完成内容 | 未逐个介绍全部 AST 节点 / 运算符；符合 Explicit Non-goals。未逐行审查 Engine 全部源文件。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 对 `40-engine/` 与本 Unit 路径执行 `review_changes`；刷新 core-contracts 的 3 条、expressions 的 4 条 maps_to Evidence，以及本 Unit 的 1 条 Evidence。写后完整复核：全部直接映射 owner unchanged、stale 0。`00-index.md` 没有既有直接 Evidence / maps_to，不新建泛化 Concept。 |

### 已审查证据

- 源码：`src/engine/index.ts`、`src/engine/contracts/` 和 `types/` 的契约入口、`src/engine/expression/value-system.ts`、`condition-system.ts`、`game-num.ts`、`game-num-build.ts`、`game-num-eval.ts`、`src/arona-clicker/runtime-wiring.ts` 的 `wireGameInstance()`。
- 测试：`tests/engine/engine-contracts.test.ts`、`value-system.test.ts`、`condition-system.test.ts`、`game-num.test.ts`、`game-num-invalidation.test.ts`、`game-num-hot-spot.test.ts`。确认窄契约可独立构造；Value/Condition 求值边界；GameNum 树建立、懒求值、资源变化事件驱动的定向标脏，以及之后查询时重算。
- Review 结果：本 Unit 范围内未确认 P0–P3 运行时代码缺陷。此结论只涵盖以上路径，不代表整个 Engine 已逐行审查。
- Wiki 修订：增加新手首读问题索引，区分静态契约依赖、Runtime 对象装配、运行时调用、查询数据与事件通知；补充 Value / Condition / GameNum 首次释义、缺值行为、缓存失效时机、源码 / 测试和机制页链接。

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 未执行 | 未执行 | 本 Unit 是代码 / 测试证据审阅与纯文档修改；按 Task 验收执行文档检查，不运行产品测试。 |
| 求值走读 | 对照上述实现与测试 | 通过 | Value / Condition 求值；GameNum build → cache/evaluate → resourceChanged 标脏 → 下次查询重算。 |
| 文档检查 | `npm run check:docs` | 通过 | 679 个 Markdown，errors: 0。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 无 whitespace 错误；输出仅含并行修改的 TS 文件 CRLF 转换提示。 |

### 遇到问题 / 需上游确认项 / 事实更新建议

- 问题：无。
- 需上游确认项：无。
- 事实更新建议：无；本 Unit 已将核实内容写入限定范围的 Engine Wiki。
