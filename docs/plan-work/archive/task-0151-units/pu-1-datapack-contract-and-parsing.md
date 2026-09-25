# Unit task-0151-PU-1：Milestone Datapack contract 与列表解析

## Goal

为 MilestoneDef 声明稳定 ID 与现有 Condition / ConditionGroup 的最小 Datapack contract，并让 JSON 分片解析和 ZIP 列表读取都接受该定义。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/context-packs/datapack-schema.md` | 找到 contract、解析和 Schema 同步边界 |
| 文档 | `docs/docs-828/05-conventions/schema-sync.md` | 遵守引擎类型与生成 Schema 的来源规则 |
| Task | `docs/plan-work/task-0151-milestone-persistent-arrival-facts-p0.md` | 本 Unit 的字段与能力边界 |
| 源码 | `src/data-services/contracts/datapack.ts:Datapack` | 汇总 Datapack list 类型 |
| 源码 | `src/data-services/datapack/fragment-parser.ts:DATAPACK_LIST_FIELDS` | 接入分片列表解析 |
| 源码 | `src/data-services/datapack/zip-loader.ts:DATAPACK_LIST_FIELDS` | 接入 ZIP 顶层列表解析 |
| 测试 | `tests/data/fragment-parser.test.ts` | 验证分片解析 |
| 测试 | `tests/data/zip-loader.test.ts` | 验证 ZIP 解析 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k tokens |
| 文档 Read Set | 3 篇，含 Task |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k 时停止并重新拆分 |

## Optional Read Set

- `tools/datapack-editor/schema/engine-schema.sync.test.ts`：仅当需要确认 contract 是否进入生成 Schema 时读取；Schema 实际变更归 PU-2。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本 Unit 明确列出的自身文件除外）
- Registry 实现、Milestone Domain、UI / 编辑器源码

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Datapack 当前有 `triggerDefs` 列表 | `src/data-services/contracts/datapack.ts:Datapack` | 作为列表 contract 模式参考 |
| 分片 parser 与 ZIP loader 各维护一份列表字段清单 | `fragment-parser.ts:DATAPACK_LIST_FIELDS`、`zip-loader.ts:DATAPACK_LIST_FIELDS` | 两处都需同步 |
| Condition / ConditionGroup 已由引擎类型定义 | `src/engine/types/expression.ts:Condition`、`ConditionGroup` | 复用现有类型，不新建 DSL |

## Constraints

- 只新增 `id` 与现有 `condition` 所需字段；不添加标题、scope、奖励、进度、阶段或时间。
- 遵守 `AGENTS.md` 的 Schema 同步规则；不手改生成 Schema。

## Allowed Files

- `src/data-services/contracts/datapack.ts`
- `src/data-services/datapack/fragment-parser.ts`
- `src/data-services/datapack/zip-loader.ts`
- `tests/data/fragment-parser.test.ts`
- `tests/data/zip-loader.test.ts`

## Explicit Non-goals

- Registry 存储 / 验证、Schema 生成、Save Progress、Runtime registration、UI 与数据包编辑器支持。

## Stop Conditions

使用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件全部 6 条。若新增字段必须改动 Allowed Files 外的类型文件，停止回交。

## Completion Criteria

- [ ] Datapack 类型有最小 MilestoneDef 列表。
- [ ] 分片与 ZIP 两种路径均能解析该列表，既有列表行为不变。
- [ ] 定向 parser 测试通过；Task 中记录 Receipt。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/data/fragment-parser.test.ts tests/data/zip-loader.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `git --no-pager diff --check` | 通过 |
