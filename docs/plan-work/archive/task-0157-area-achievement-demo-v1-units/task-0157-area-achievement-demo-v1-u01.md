# Unit 0157-U01：成就声明进入数据包分片

## Goal

增加首期一对一 Milestone Listener／Achievement 声明，并让 JSON 分片及 ZIP 导入保留它们；此 Unit 不解释或执行声明。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/registry.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 仓库、数据包与 Unit 边界 |
| 计划 | `docs/plan-work/task-0157-area-achievement-demo-v1.md`、本 Unit | 首期语义与白名单 |
| 源码 | `src/data-services/contracts/datapack.ts`、`src/data-services/datapack/fragment-parser.ts`、`src/data-services/datapack/zip-loader.ts` | 声明与两条导入路径 |
| 测试 | `tests/data/fragment-parser.test.ts`、`tests/data/zip-loader.test.ts` | 保留新字段的证据 |

## Context Budget

目标上下文约 10k–20k tokens；只读上表，超出 2 个额外文件或 60k tokens 时停下上报。

## Optional Read Set

- `src/engine/types/expression.ts` 的 `Effect` 类型，仅在确认 `then` 类型时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**`、Runtime Editor、UI、Runtime 装配与其他机制源码。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Datapack 已有 `milestones?: MilestoneDef[]` | `src/data-services/contracts/datapack.ts:45-50,75` | Milestone 条件保持唯一来源 |
| 分片 parser 的列表字段与合并出口都显式列举 `milestones` | `src/data-services/datapack/fragment-parser.ts:DATAPACK_LIST_FIELDS,mergeFragments` | 新列表需同样保留 |
| ZIP loader 使用分片 parser 合并 | `src/data-services/datapack/zip-loader.ts:loadDatapackFromZip` | 本 Unit 无需改 ZIP loader 实现 |

## Constraints

- 一条 `MilestoneListenerDef` 含 `id`、`milestoneId`、`areaId`、`then: Effect[]`；一条 `AchievementDef` 含 `id`、`listenerId`、`title`、`clue`、`rewardDescription`。Area 与完成条件只各声明一处；引用及一对一关系留给后续 Registry Unit 验证。
- `milestoneListeners?`、`achievements?` 是 Datapack 顶层可选列表。此 Unit 不为 `then` 执行或 Area 准入赋予行为。
- 遵守 [[docs/docs-828/05-conventions/architecture-discipline]]；不手改生成 Schema。

## Allowed Files

- `src/data-services/contracts/datapack.ts`
- `src/data-services/datapack/fragment-parser.ts`
- `tests/data/fragment-parser.test.ts`
- `tests/data/zip-loader.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u01-receipt.md`

## Explicit Non-goals

- 不修改 `zip-loader.ts` 实现、Registry、ID 校验、Milestone Runtime、Effect 执行、UI、编辑器或示范包。
- 不增加 `when`、`next`、Init／全局归属、前置关系或其他展示字段。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若现有类型形状无法表达上述最小合同，停止并报告，不自行扩字段。

## Completion Criteria

- [ ] 两种声明由类型表达，旧 Datapack 不需添加空列表。
- [ ] JSON 分片合并与 ZIP 读取均保留两种声明，已有 Milestone 列表仍保留。
- [ ] Receipt 记录改动与实际验证。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/data/fragment-parser.test.ts tests/data/zip-loader.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
