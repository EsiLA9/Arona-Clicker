# Unit 0235-U12b：架构检查、UI Callgraph 与文档工具 Wiki

## Goal

解释架构边界、UI 调用图和文档工具分别能帮助开发者验证什么。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `06-wiki/60-engineering-support/00-index.md`、`architecture-checks.md`、`ui-callgraph.md`、`docs-tooling.md`、`docs/docs-829/05-conventions/architecture-discipline.md` | 当前工具范围与规则权威 |
| 源码 | `scripts/check-architecture-boundaries.mjs`、`scripts/ui-callgraph*`、`scripts/check-docs.mjs`、`scripts/report-doc-context.mjs` | 校验实际输入与限制 |
| 测试/验证 | `package.json` 中对应脚本；相应脚本的定向 fixtures | 命令覆盖与失败模式 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k token |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 只看工具入口和其代表性输出，不跑全套项目 Review 之外的额外脚本 |

## Optional Read Set

- 具体脚本的帮助文本和 CI 调用点，仅用于核验命令参数。

## Do Not Read by Default

- `docs/plan-work/archive/**`、无关报告历史文件和临时工具输出。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Engineering Support Wiki 记录架构检查、UI Callgraph 和文档工具入口。 | `06-wiki/60-engineering-support/00-index.md` | 工具限制按脚本核对。 |

## Constraints

- 对每个工具说明输入、输出、适用场景和限制。
- 说明静态检查不是完整运行时证明；工具不能替代对业务源码的审阅。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u12b-wiki-tooling-analysis.md`（填写本 Unit Receipt）
- `docs/docs-829/06-wiki/60-engineering-support/architecture-checks.md`
- `docs/docs-829/06-wiki/60-engineering-support/ui-callgraph.md`
- `docs/docs-829/06-wiki/60-engineering-support/docs-tooling.md`

## Explicit Non-goals

- 不修改检查脚本、Callgraph 算法、Markdown 链接规则或文档分区。
- 不把工具报告中生成的线索直接记录成 Code Review finding。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；工具行为与 Wiki 不一致时只修正文档并记录是否需要另立脚本修复 Task。

## Completion Criteria

- [x] 每页准确说明工具能够和不能够验证的内容。
- [x] 新人能从问题反查适用的命令，并理解后续人工核对步骤。
- [x] 三页与工程支持入口及相应 05-conventions 规则互相链接。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 命令核验 | 比对 package scripts 和实现入口 | 参数及边界准确 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## 本次审查结果

- **范围**：`package.json` 命令映射、架构导入边界脚本、UI 调用图脚本、Markdown 检查器及文档分区规模报告；检索了这些脚本是否有独立 fixtures/tests。
- **Wiki 修改**：重写架构检查、UI 调用图、文档检查三页。逐页说明输入、输出、命令参数、适用任务和检查限制；向目录索引补充新人路线和“工具结果不能代替源码 Review”的边界。
- **源码证据**：`check-architecture-boundaries.mjs` 递归扫 `src/engine/`、`src/data-services/` 的 `.ts` 并以正则匹配相对 import，含两个固定路径 `compatibilityShims` 豁免；当前工作树没有这些路径对应的文件。`ui-callgraph.mjs` 以语法树分析默认 `src/ui` 的非声明 `.ts`，函数名解析有强/弱边、默认不纳入弱边，支持 `--roots/--depth/--paths/--json`。`check-docs.mjs` 检查链接、plan-work 重名、当前源码路径、路由元数据和旧计划/Goal Set 边界。`report-doc-context.mjs` 只统计预设 Markdown 分区，使用字符数除以四估算 token 并提示 60k 阈值。`package.json` 将四个脚本名映射到这些入口。
- **测试证据**：在 `scripts/`、`tests/` 中搜索未找到架构检查、UI callgraph、check-docs 或 doc-context 的独立 fixture/test；脚本自身提供直接命令验证。本次执行 `npm run check:architecture` 通过；`npm run ui:callgraph -- --summary` 正常输出 118 个 UI TS 文件、2698 个定义、3740 条可靠调用边、1885 条弱边和 317 个 DOM 写入点。
- **代码 Review 发现**：**P3 — 架构检查器的兼容转发白名单包含当前不存在的路径，若未来在同路径恢复文件，会无条件跳过该文件的全部边界违规**。依据 `scripts/check-architecture-boundaries.mjs:15-18` 的 `compatibilityShims` 集合及 `checkBoundary()` 中 `compatibilityShims.has(filePath)` 例外判断；当前 `src/engine/image/` 目录不存在，所以目前没有现存文件被豁免。建议另行删除失效项或改为明确的导入级例外并配测试；本 Unit 不修改检查脚本。置信度：高。
- **未覆盖项**：未为脚本新建 fixtures、未运行 UI 全模式、未验证别名/动态导入，因为检查器明确不覆盖这些语法；本仓库未找到这些脚本的专用测试。

## Receipt 0235-U12b

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `docs/docs-829/06-wiki/60-engineering-support/architecture-checks.md`、`ui-callgraph.md`、`docs-tooling.md`；本 Unit 文件内补充审查记录与 Receipt。 |
| 未完成内容 | 无；P3 脚本改进建议留给上游另立修复 Task。 |
| 范围外变更 | 无；未改脚本及命令配置。 |
| GALHCG 影响闭环 | 绑定 `acprogram`；3 个本 Unit Wiki 路径完整 `review_changes` 复核。`project-diagnostic-tooling` 节点及架构/UI/文档工具页映射更新为当前 Evidence，相关 node/edge freshness 均 fresh。 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 架构检查 | `npm run check:architecture` | 通过 | 只证明脚本覆盖的相对导入边界没有命中。 |
| UI 调用图 | `npm run ui:callgraph -- --summary` | 通过 | 输出静态语法分析概览；不是运行时跟踪。 |
| 文档链接 | `npm run check:docs` | 通过 | 扫描 679 篇 Markdown，0 错误。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 无空白错误；仅有其他工作区源码行尾提示。 |
| 独立脚本测试 | 在 `scripts/`、`tests/` 定向检索 | 未发现 | 当前 Read Set 内没有对应 fixtures/test。 |
| GALHCG | `review_changes` 核对 3 张工具 Wiki 页面；更新 `project-diagnostic-tooling` 节点和文档映射；`verify_freshness` | 通过 | 页面路径审查无 stale owner；本次更新 node/edge freshness 为 fresh。 |

### 遇到问题

- 架构检查器的历史兼容路径豁免与当前工作树不一致，记录为 P3。文档不再把不存在的源文件写成有效链接。

### 需上游确认项

- 是否另立小 Task 删除失效豁免并为检查器边界补定向测试。

### 事实更新建议

- 架构检查只是以正则匹配相对导入的静态边界检查；UI 调用图是名称匹配的 AST 导航线索；文档检查器则只检查机械结构。三者不能替代实际业务路径的源码 Review。已写入 Wiki。
