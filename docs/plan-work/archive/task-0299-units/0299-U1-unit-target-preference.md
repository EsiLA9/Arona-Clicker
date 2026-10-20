# Unit 0299-U1：单位目标 preference 与自动默认值

## Goal

让 enemy / partyCharacter Action 在完整合法目标集中按显式 preference 或稳定顺序得到一个自动目标，同时保留玩家改选能力。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | 白名单与停止条件 |
| 文档 | docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy.md：P0、P1 | 已冻结行为 |
| 源码 | src/data-services/contracts/gameplay-map.ts：GameplayMapActionTargetDef | 作者数据字段 |
| 源码 | src/data-services/registry/registry-validate.ts：Map Action target validation | 严格验证与目标兼容性 |
| 源码 | src/arona-clicker/services/gameplay-b-action-preview-resolver.ts：resolveGameplayBActionPreview | 自动目标选择 |
| 源码 | src/arona-clicker/services/map-run-service.ts：setPreparedTarget、setPreparedEnemyTarget | 手动目标写入 |
| 测试 | tests/data/gameplay-b-map-registry.test.ts | Datapack 合法性 |
| 测试 | tests/engine/gameplay-b-map-run.test.ts | 默认目标、手动覆盖与纯 Preview |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 不读旧 Operation；发现跨层 DTO 需求即暂停并拆分 |

## Optional Read Set

- tools/datapack-editor/schema/editor-extras.ts，仅当 Map Action 被独立编辑器正式暴露时再读；当前没有 maps 表。

## Do Not Read by Default

- docs/plan-work/archive/**
- 旧 Operation target resolver
- Workspace / Controller / CSS；0291 U4 当前施工范围

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前多目标 party / enemy 会要求手动选择，合法目标顺序来自固定队伍 / Encounter roster。 | gameplay-b-action-preview-resolver.ts：partyCharacter / enemy 分支 | Preview 当前为纯计算。 |
| targetSelections 保存显式选择；多候选时 MapRun 的目标命令会保存所选值，清除后再 Preview。 | map-run.ts：MapRunEncounterTargetSelection；map-run-service.ts：setPreparedTarget、setPreparedEnemyTarget | 需保留当前自动默认目标被明确点击时的手动意图。 |
| Registry 对 target 对象执行额外字段拒绝。 | registry-validate.ts：target validation | preference 必须加进允许字段并严格枚举。 |
| Map Action 目前未列为独立 Datapack Editor TABLE_META。 | tools/datapack-editor/schema/editor-extras.ts：TABLE_META | 遵守 AGENTS.md，不直接改生成 Schema。 |

## Constraints

- 比较 HP 比例使用精确整数比例；平局保持敌人定义顺序或 Map 固定队伍顺序。
- 自动选择不得缩小 legalTarget IDs，也不得从名称、描述、效果文案、DOM 推断偏好。
- targetSelectionRequired 表示“缺少必须的目标”，不是禁止玩家修改自动值。
- 新增源码字段可选且有默认稳定顺序，旧 Datapack 不改变抽牌资格。

## Allowed Files

- src/data-services/contracts/gameplay-map.ts
- src/data-services/registry/registry-validate.ts
- src/arona-clicker/services/gameplay-b-action-preview-resolver.ts
- tests/data/gameplay-b-map-registry.test.ts
- tests/engine/gameplay-b-map-run.test.ts

## Explicit Non-goals

- 不在 UI / Runtime View 增加字段，不改 Workspace / Controller / CSS。
- 不处理抽卡前的零目标过滤（由 U2 负责）。
- 不重做 Swap、PlayerCommand、目标命令或 Save / Resume。

## Stop Conditions

- 目标 preference 必须新增到禁改的生成 Schema 或需修改 0291 U4 的共享 View / UI：停止并上报可维护源 / 文件冲突。
- 源码无法从当前 MapRun 快照取得目标 HP 上限或合法对象顺序：停止并报告缺失契约。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [x] preference 只允许 stableOrder / lowestHpRatio / highestMissingHpRatio；按 target kind 拒绝不兼容值。
- [x] 无 preference 时 stableOrder；enemy 按当前 HP 比例升序，partyCharacter 按缺失 HP 比例降序。
- [x] 同分稳定；完整候选仍暴露；手动改选持续有效；清除后恢复自动默认。
- [x] 连续 Preview / Save / Restore 不写状态、不推进 RNG、不更换同一快照目标。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Registry 回归 | npx vitest run tests/data/gameplay-b-map-registry.test.ts | 通过 |
| MapRun 回归 | npx vitest run tests/engine/gameplay-b-map-run.test.ts | 通过 |
| 类型检查 | npx tsc --noEmit | 通过 |
| 源码复核 | git diff --check；确认没有改禁改路径 | 通过 |
