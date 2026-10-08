# Unit 0235-U12a：测试和 Schema Editor Wiki

## Goal

向新人解释怎样验证代码、Schema 如何产生，以及独立 Datapack Editor 的作用范围。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `06-wiki/60-engineering-support/00-index.md`、`testing.md`、`schema-editor.md`、`docs/docs-829/05-conventions/schema-sync.md` | 工具入口及强制 Schema 流程 |
| 源码 | `package.json`、`vitest.config.ts`、`scripts/gen-schema*`、`tools/datapack-editor/` Schema 加载入口 | 核实命令与 Schema 消费路径 |
| 测试 | 定向测试样例、Schema/editor loading tests | 找到项目验证证据 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–30k token |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 从 package scripts 只读命中命令实现，不读所有工具代码 |

## Optional Read Set

- `AGENTS.md` 常用命令表，保持链接文字与命令入口一致。

## Do Not Read by Default

- `docs/plan-work/archive/**`、生成的 JSON 正文和整个 node_modules。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Engineering Support Wiki 目前包含测试与独立 Schema Editor 两个页面。 | `06-wiki/60-engineering-support/00-index.md` | 测试命令与生成关系需源文件确认。 |

## Constraints

- 命令要说明“运行什么、它能证明什么、不证明什么”。
- Schema 生成文件按 AGENTS 禁改规则处理，只讲源类型与生成入口。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u12a-wiki-tooling-tests.md`（填写本 Unit Receipt）
- `docs/docs-829/06-wiki/60-engineering-support/00-index.md`
- `docs/docs-829/06-wiki/60-engineering-support/testing.md`
- `docs/docs-829/06-wiki/60-engineering-support/schema-editor.md`

## Explicit Non-goals

- 不改 package scripts、测试配置、Schema 生成或编辑器行为。
- 不把通过某一测试描述成全项目无缺陷。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]] 和 [[AGENTS.md]] 生成文件规则；命令输出与文档不一致时停止并报告。

## Completion Criteria

- [x] 新人能选择相关测试命令并理解验证覆盖边界。
- [x] Schema 来源、生成步骤和独立 Editor 消费关系准确。
- [x] 目录页提供明确向下和向上阅读路线。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 命令核验 | 比对 package scripts 与脚本入口 | 命令名准确 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## 本次审查结果

- **范围**：`package.json` 测试和 Schema 命令；Vitest 文件匹配与运行环境；Schema 解析/生成、静态 JSON 加载、编辑器扩展合并和最终表消费；对应 Schema 同步测试。
- **Wiki 修改**：更新工程支持目录、测试说明和 Schema Editor 说明。给出完整测试、定向测试、watch、类型检查和构建的选择方法与证明边界；说明 Engine/Data Services 契约 → 生成 JSON → `editor-extras` 合并 → 编辑器 `TABLES` 的路径。明确不能手改生成文件，Schema 权威流程继续链接 `05-conventions/schema-sync`。
- **源码证据**：`package.json` 中 `test`/`test:watch`/`gen:schema` 映射；`vitest.config.ts` 只收集 `tests/**/*.test.ts` 和 `tools/**/*.test.ts`，Node 环境并加载 `tests/setup.ts`；`scripts/gen-engine-schema.mjs:parseEngineSchema()` 读取 Engine types/contracts 与 Data Services contracts 并由 `--write` 生成 JSON；`engine-defs.ts:loadEngineDefs()` 加载生成协议，`merge.ts:buildTables()` 与 `editor-extras` 合并，`datapack.schema.ts` 暴露 `TABLES`，独立编辑器 `ui/main.ts` 消费；`engine-schema.sync.test.ts` 重新解析源契约，检查表映射、字段覆盖、hand 占位、ref 目标和枚举同步。
- **测试证据**：确认 `tools/datapack-editor/schema/engine-schema.sync.test.ts` 被 Vitest glob 收集且断言覆盖上述契约。测试源已读，本 Unit 未执行测试。
- **代码 Review 发现**：未确认 P0–P3 缺陷。
- **未覆盖项**：未运行生成命令、Schema 同步测试、编辑器 UI 测试或完整 Vitest；未逐项审查其他工具目录的测试。未编辑生成 JSON。

## Receipt 0235-U12a

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `docs/docs-829/06-wiki/60-engineering-support/00-index.md`、`testing.md`、`schema-editor.md`；本 Unit 文件内补充审查记录与 Receipt。 |
| 未完成内容 | 无；未执行的测试及 UI 覆盖边界见上。 |
| 范围外变更 | 无；没有运行会改写生成文件的命令。 |
| GALHCG 影响闭环 | 绑定 `acprogram`；工程支持索引、测试和 Schema Wiki 路径均已完整 `review_changes` 复核；更新 `datapack-editor-schema-sync`、`test-harness-and-configuration` 的文档 Evidence，并将索引映射到已有诊断工具概念；相关 freshness 为 fresh。 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 命令核验 | 比对 `package.json`、`vitest.config.ts`、生成器与同步测试入口 | 通过 | 未运行测试或 `gen:schema`。 |
| 文档链接 | `npm run check:docs` | 通过 | 扫描 679 篇 Markdown，0 错误。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 无空白错误；仅有其他工作区源码行尾提示。 |
| GALHCG | `review_changes` 核对工程支持索引、测试/Schema 页面；更新 `datapack-editor-schema-sync`、`test-harness-and-configuration` 的文档边及索引页映射；`verify_freshness` | 通过 | 路径核对无 stale owner；本次更新边 freshness 为 fresh。 |

### 遇到问题

- 无阻断问题；生成 JSON 是禁手改派生产物，本 Unit 保持未触碰。

### 需上游确认项

- 无。

### 事实更新建议

- Schema sync 测试既检查源契约和合并后表结构，也依赖被提交的生成 JSON；它不验证作者使用表单时的交互正确性。此边界已写入 Wiki。
