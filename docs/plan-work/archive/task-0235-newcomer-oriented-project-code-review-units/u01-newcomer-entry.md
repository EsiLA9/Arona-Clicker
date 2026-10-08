# Unit 0235-U01：新人首读路线与项目总览

## Goal

建立从文档总入口开始的新人首读页，并用已核实的启动和依赖事实校准项目总览。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规则 | `AGENTS.md`、`docs/docs-829/00-INDEX.md`、`docs/docs-829/05-conventions/doc-maintenance.md` | 确认权威分层、主入口和页面写法 |
| 文档 | `01-architecture/overview.md`、`dependency-map.md`、`run-logic.md`、`data-flow.md`、`02-modules/00-index.md` | 复核现有主干路由并避免复制正文 |
| 源码 | `src/ui/main.ts`、`src/app/runtime-bootstrap.ts`、`src/arona-clicker/runtime.ts`、`runtime-wiring.ts` | 核实浏览器启动和组合入口 |
| 测试 | `tests/engine/arona-runtime-pack.test.ts` 与对应启动测试 | 核实初始化边界 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k token |
| 文档 Read Set | 5–8 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 只扩展为回答明确读者问题所需的源码；超过 60k 时停下拆分 |

## Optional Read Set

- `docs/docs-829/01-architecture/run-logic.md` 中被概览引用的下游正文，仅在启动图无法核实时阅读。

## Do Not Read by Default

- `docs/plan-work/archive/**`、`docs/archive/docs-828-snapshot/**`。
- 与启动和概念总览无关的领域、编辑器或历史文件。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前总入口已有系统主干路由和分区索引。 | `docs/docs-829/00-INDEX.md` | 是文档现状，不代替运行流源码核验。 |
| 当前没有单独的 newcomer / first-read 页面。 | `rg --files docs/docs-829` 盘点 | 新页路径固定为 `01-architecture/first-read.md`。 |

## Constraints

- 先讲系统用途和阅读顺序，再逐步介绍 Runtime、Datapack、Registry、Engine、PlayerState、ReadModel、UI 等概念。
- 图中明确静态依赖、调用、数据流和事件响应，不把它们画成同一种箭头。
- 从 `docs/docs-829/00-INDEX.md` 和 06-Wiki 总索引都能进入新人导览；总览页给出下一步链接。
- 遵守 [[docs/docs-829/05-conventions/doc-maintenance]]，详细算法保留在 03/04 权威页。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u01-newcomer-entry.md`（填写本 Unit Receipt）
- `docs/docs-829/00-INDEX.md`
- `docs/docs-829/01-architecture/first-read.md`
- `docs/docs-829/01-architecture/overview.md`
- `docs/docs-829/01-architecture/dependency-map.md`
- `docs/docs-829/06-wiki/00-index.md`

## Explicit Non-goals

- 不修改运行时代码、命令或项目规则。
- 不在首读页重写状态字段、算法、玩法或所有模块卡。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]。如代码事实与现有架构页冲突，记录证据并暂停该 Unit 的对应段落，不自行定稿。

## Completion Criteria

- [ ] 新人从总入口可按步骤认识项目，并能通过链接继续到正确的源码/测试/机制页。
- [ ] 新人页回答“从哪启动、内容如何进 Runtime、谁拥有状态、UI 从哪里读、先读什么”。
- [ ] 总览图与依赖页中关系类型标记准确，所有链接可达。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 新人冷读 | 只按总入口路线检查上述 5 个问题 | 每问都能从页面和链接找到证据 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt

- **结果：** 已建立新人首读页，并从文档总入口、架构概览、依赖图和功能 Wiki 总索引提供入口。
- **源码核对：** `src/ui/main.ts:boot()` 恢复包库、对齐开发包、应用启用包并挂载 `UIController`；`src/app/runtime-bootstrap.ts:createAppRuntime()` 创建产品 Runtime，`loadDefaultDatapack()` 调用 `applyEnabledPacks()`；`src/arona-clicker/runtime-game-instance.ts:init()` 将定义装入 Registry 并接好子系统。`getView()` 构造 UI 快照；`save()`、`load()`、`reset()` 协调产品进度和 Operation Run 生命周期。
- **测试证据：** 检查了 `tests/engine/arona-runtime-pack.test.ts` 的“默认启用集装载 base 与独立 Gameplay B 示例包”等案例；`tests/ui/controller-events.test.ts` 使用 Runtime `getView()` 检查输入后的可观察结果。未执行这些行为测试。
- **Wiki 修改：** 新建 `docs/docs-829/01-architecture/first-read.md`；更新 `00-INDEX.md`、本区 `overview.md`/`dependency-map.md` 和 `06-wiki/00-index.md`，区分静态依赖、直接调用、状态数据、可选事件通知和只读查询。
- **审查发现：** 未在本 Unit 审查的启动与总览路径中确认 P0–P3 代码缺陷。初始 Wiki 缺少一页能回答“从哪启动、内容如何装载、状态属于谁、UI 从哪里读、先读什么”的入口；已补足。
- **边界与未覆盖：** 未逐行审查所有启动相关文件；具体状态变更/事件时序由 U05/U06 与 Engine Units 审查。事件图是路径示意，明确不是所有 UI 操作都会发布事件。
- **验证：** `npm run check:docs` 通过（681 Markdown，0 errors）；`git --no-pager diff --check` 通过。任务负责人按五个首读问题完成冷读走查，链接能继续定位相关源码与测试。
