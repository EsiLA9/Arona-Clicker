# Unit 0301-U1a：增加敌方行动内容与资源类型

## Goal

在 Gameplay Map 内容类型中表达每名 Enemy 的加权 Action 候选、Encounter-local 初始资源及双方共用的目标倾向，并生成独立编辑器 Schema。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/05-conventions/schema-sync.md` | 源类型与生成 Schema 同步流程 |
| 文档 | `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`：P0 / P1 | 已冻结的 Enemy 内容合同 |
| 源码 | `src/data-services/contracts/gameplay-map.ts`：GameplayMapActionDef、GameplayMapActionTargetDef、GameplayEncounterDef、GameplayEncounterEnemyDef | 目标类型修改点 |
| 源码 | `tools/datapack-editor/schema/engine-defs.ts`、`scripts/gen-engine-schema.mjs` | Schema 生成入口；不手改生成结果 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–15k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超出时拆分或回交 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| `GameplayEncounterEnemyDef` 当前只有 `id / initialHp / maxHp / damage`。 | `src/data-services/contracts/gameplay-map.ts` | `damage` 暂在类型中保留，后续 Runtime / 内容迁移 Unit 再移除。 |
| `GameplayEncounterActionCandidateDef` 已表达 `actionId / tendencyWeight`，当前只由 Character participant 使用。 | 同文件 `GameplayEncounterParticipantDef` | Enemy 可直接复用候选类型。 |
| Schema 从数据服务合同生成；`engine-defs.gen.json` 不手动编辑。 | `tools/datapack-editor/schema/engine-defs.ts`、`scripts/gen-engine-schema.mjs` | 本 Unit 运行正式生成器。 |

## Constraints

- 增加 `Enemy.actions`、Enemy Actor 初始资源、Encounter Enemy Team 初始资源类型。
- `eligibleCharacterIds` 继续只约束 Character；Enemy 是否可用由其 Encounter 候选池授权，空 Character 列表不能被解释成 Enemy 行动与 Ability / Item 行动。
- `enemy` / `partyCharacter` 目标偏好允许共用的稳定、最低 HP 比例、最高损失 HP 比例规则；使用关系由候选行动者上下文校验。
- 所有文件修改遵守 Schema 同步；生成 Schema 只能通过 `npm run gen:schema` 更新。

## Allowed Files

- `src/data-services/contracts/gameplay-map.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（仅由 Schema 生成器写入）
- `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`
- 本 Unit 与其 Receipt

## Explicit Non-goals

- 不修改 Registry、Runtime、Datapack 内容或 UI；这些由 U1b 及后续 Unit 处理。
- 不删除 `damage` 过渡字段；Runtime 尚未接入敌方 Action。
- 不手动编辑 `engine-defs.gen.json`。

## Stop Conditions

- 类型设计要求改变已冻结的 Action / Target / resource 规则。
- Schema 生成器无法表示新字段或要求直接手改生成文件。
- 需要编辑 Allowed Files 外路径。
- `npm run gen:schema` 或类型检查失败且原因无法解释。

## Completion Criteria

- [ ] Enemy 可声明同型加权行动候选、初始 Actor 资源；Encounter 可声明独立 Enemy Team 资源。
- [ ] Action target / tendency / resource 类型文档准确表达双边策略。
- [ ] 正式 Schema 生成器成功更新编辑器协议。
- [ ] 类型检查通过；未增加手工 Schema 文件编辑。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Schema | `npm run gen:schema` | 生成成功 |
| 类型 | `npx tsc --noEmit` | 通过 |
| Schema 同步 | `npx vitest run --silent tools/datapack-editor/schema/engine-schema.sync.test.ts` | 通过 |
