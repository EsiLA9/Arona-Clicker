# Unit task-0151-PU-2：Milestone Registry 与 Schema

## Goal

让 Registry 持有和查询 PU-1 引入的 MilestoneDef，按既有 ID 规则验证定义，并通过 Schema 生成流程同步编辑器 Schema。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/03-data-structures/registry.md` | Registry 定义合并与访问边界 |
| 文档 | `docs/docs-828/05-conventions/schema-sync.md` | 生成 Schema 的正确流程 |
| Task | `docs/plan-work/task-0151-milestone-persistent-arrival-facts-p0.md` | Milestone ID 与 Definition 删除语义 |
| Unit | `docs/plan-work/archive/task-0151-units/pu-1-datapack-contract-and-parsing.md` | 输入 contract 与列表名称 |
| 源码 | `src/data-services/registry/registry.ts:tableSteps, load` | 定义 map 生命周期与 Datapack 合并 |
| 源码 | `src/data-services/registry/registry-validate.ts` | 引用与 ID 验证模式 |
| 源码 | `src/engine/core/entity-id.ts:ENTITY_TYPES, validateEntityId` | 新 Def typeName 必须登记在实体 ID 表 |
| 测试 | `tests/engine/registry.test.ts` | Registry 合并与读取测试 |
| 测试 | `tools/datapack-editor/schema/engine-schema.sync.test.ts` | Schema 三向同步判据 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k tokens |
| 文档 Read Set | 3 篇，含 Task / PU-1 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k 时停止并重新拆分 |

## Optional Read Set

- `src/data-services/registry/registry.ts` 中相邻 Def 的 factory / table step：只在新增映射无直接模式时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本 Unit 明确列出的自身依赖除外）
- Runtime Adapter、UI、内容浏览器实现

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| TriggerDefs 直接进入 TriggerSystem，不属于 Registry Def map | `src/arona-clicker/runtime-game-instance.ts:GameInstance.init` | Milestone Def 需要独立 Registry map |
| Registry 使用 `tableSteps` 合并和清理定义 | `src/data-services/registry/registry.ts:tableSteps` | 定义变化需遵守现有生命周期 |
| Trigger ID 已有 Registry 校验入口 | `src/data-services/registry/registry-validate.ts` | 新 ID 验证沿用实际契约 |
| Registry ID 类型由 `ENTITY_TYPES` 集中登记 | `src/engine/core/entity-id.ts:ENTITY_TYPES` | Milestone ID 必须使用 `milestone` typeName 并更新该表 |

## Constraints

- Definition 缺失时只影响 desired watch；不得删除 Save 中 completed ID。
- 用生成命令改 Schema 产物；禁止手工编辑生成 JSON。

## Allowed Files

- `src/data-services/registry/registry.ts`
- `src/data-services/registry/registry-validate.ts`
- `src/engine/core/entity-id.ts`
- `tests/engine/registry.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（仅由 `npm run gen:schema` 生成）

## Explicit Non-goals

- Datapack parser 改动、Save Progress、Condition evaluator、EB-T adapter、UI 与编辑器功能。

## Stop Conditions

使用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件全部 6 条。Schema 生成若要求改动其他受限或生成源文件，停止回交。

## Completion Criteria

- [ ] Registry 能合并、清理并只读查询 MilestoneDef。
- [ ] 定义 ID 按当前 Registry 规则校验；不新增 Condition DSL 校验器。
- [ ] Schema 生成与同步测试通过；无手工 Schema 改写。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/registry.test.ts tools/datapack-editor/schema/engine-schema.sync.test.ts` | 通过 |
| Schema | `npm run gen:schema` | 生成文件与源类型一致 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
