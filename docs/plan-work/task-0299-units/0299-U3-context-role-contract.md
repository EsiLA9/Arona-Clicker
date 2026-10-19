# Unit 0299-U3：显式 tendencyRole 作者合同

## Goal

为 Map Action 加入有限的 recovery / defense / attack 用途配置，并由 Registry 严格拒绝未知值与目标类型不兼容的配置。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | 白名单与 Unit 停止条件 |
| 文档 | docs/plan-work/task-0299-gameplay-b-autonomous-action-target-strategy.md：P0、P2 | 冻结用途与倍率语义 |
| 文档 | docs/docs-829/05-conventions/schema-sync.md | 源类型与生成文件边界 |
| 源码 | src/data-services/contracts/gameplay-map.ts：GameplayMapActionDef | 新作者配置字段 |
| 源码 | src/data-services/registry/registry-validate.ts：Map Action validation | Registry 字段验证 |
| 测试 | tests/data/gameplay-b-map-registry.test.ts | 合法 / 非法 Datapack 合同 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 8k–16k token |
| 文档 Read Set | 3 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 不扫描旧 Operation 或独立 Editor UI |

## Optional Read Set

- tools/datapack-editor/schema/editor-extras.ts，仅当新字段需要独立 Editor 表单时再读。

## Do Not Read by Default

- docs/plan-work/archive/**
- 运行时 Hand 抽取与 Workspace View；由 U4 / U9 负责

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| tendencyWeight 属于 Encounter 每个候选 Action；Map Action 当前无用途配置。 | gameplay-map.ts：GameplayEncounterActionCandidateDef、GameplayMapActionDef | role 挂在 Action；候选基准权重保持原样。 |
| Registry 对 Map Action 和 target 做严格额外字段拒绝。 | registry-validate.ts：action / target validation | 新字段必须纳入明确枚举校验。 |
| 当前独立 Editor 没有 Gameplay Map 的 TableMeta。 | tools/datapack-editor/schema/editor-extras.ts：TABLE_META | 本 Unit 只更新运行时权威源合同；依 AGENTS.md 不编辑生成 Schema。 |

## Constraints

- tendencyRole 仅有 recovery / defense / attack；缺省代表只使用 tendencyWeight。
- recovery 只能搭配 self / partyCharacter；attack 只能搭配 enemy；defense 可搭配任何当前有效目标。
- 本 Unit 只声明用途字段和 Registry 合法性，不在这里定义任意公式或倍率脚本。
- Map Action 未进入独立 Editor 的可编辑表，不修改生成 Schema 或新建 Editor 表。

## Allowed Files

- src/data-services/contracts/gameplay-map.ts
- src/data-services/registry/registry-validate.ts
- tests/data/gameplay-b-map-registry.test.ts

## Explicit Non-goals

- 不改 tendencyWeight、Hand resolver、RNG、MapRun / Save 数据。
- 不按 name / description / effects 文本推导角色用途。
- 不改 tools/datapack-editor、生成 Schema 或 UI。

## Stop Conditions

- 当前数据结构无法表达可选 role 或 Registry 无法严格拒绝未知值：停止并报告真实限制。
- 需要修改生成 Schema / 编辑器表格或新增超出该枚举的情境字段：停止并说明具体原因。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [x] 旧 Datapack 缺省 role 时通过 Registry，行为仍是 tendencyWeight 基础值。
- [x] 三个 role 的合法目标类型通过；未知值及不兼容组合被拒绝。
- [x] TypeScript 合同明确且仅为可选小枚举。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Registry 回归 | npx vitest run tests/data/gameplay-b-map-registry.test.ts | 通过 |
| 类型检查 | npx tsc --noEmit | 通过 |
| 差异检查 | git diff --check | 通过 |
