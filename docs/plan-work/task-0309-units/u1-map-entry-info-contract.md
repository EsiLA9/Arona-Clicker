# Unit 0309-U1：定义可选地图入口说明

## Goal

为 GameplayMapDef 增加仅供行前准备页展示的可选简介与提示字段。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 约定 | `AGENTS.md` 工作边界 | 生成 Schema 为禁改路径 |
| 约定 | `docs/docs-829/05-conventions/schema-sync.md` | 明确源契约与生成 Schema 的关系 |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` §“内容侧：最小可选入口说明” | 冻结字段名、纯展示边界及兼容要求 |
| 源码 | `src/data-services/contracts/gameplay-map.ts:GameplayMapDef` | 权威 Map 定义契约 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 5k–15k tokens |
| 文档 Read Set | 3 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 停止并拆分 |

## Optional Read Set

- 无；若修改生成 Schema 或其生成流程成为必要，按停止条件上交。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `tools/datapack-editor/**`

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| GameplayMapDef 当前有 `id`、`name`、`resumeVersion` 等字段，没有地图级入口说明字段 | `src/data-services/contracts/gameplay-map.ts:GameplayMapDef` | 由本次实际源码读取核实 |
| Schema 同步流程会产出生成 Schema；项目入口将生成 Schema 列为禁改路径 | `docs/docs-829/05-conventions/schema-sync.md`；`AGENTS.md` 工作边界 | 本 Unit 不触碰生成产物 |

## Constraints

- `entryInfo` 仅含 `description?: string` 与 `tips?: readonly string[]`，纯文本、纯展示，不参与玩法计算。
- 缺省时保持旧 Map 兼容；不得从 Node 文本推导入口说明。
- 遵守 `AGENTS.md` 的禁改路径。

## Allowed Files

- `src/data-services/contracts/gameplay-map.ts`

## Explicit Non-goals

- 不添加包校验器、Schema 生成结果、示例内容、Runtime 投影或 UI。
- 不修改 `resumeVersion` 规则。

## Stop Conditions

适用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件的 6 条。特别是：若本字段不能在不修改禁改生成 Schema 的前提下完成本 Unit，停止并上交。

## Completion Criteria

- [x] GameplayMapDef 声明可选 `entryInfo`，且两个子字段均为可选只读文本。
- [x] 无白名单外文件变更。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 差异检查 | `git --no-pager diff --check` | 通过 |
| 代码测试 | 未要求；不新增或运行测试 | — |

## Pre-flight

- Goal：添加纯展示入口说明类型；Allowed Files 仅为 Map 数据契约；明确不做校验、Schema 产物、示例、Runtime 与 UI；字段仅用于准备页展示，且必须兼容旧 Map。触及生成 Schema 即停止。
