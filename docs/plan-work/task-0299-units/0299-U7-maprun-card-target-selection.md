# Unit 0299-U7：MapRun 卡牌目标自动选择与无目标跳过

## Goal

复用现有真实 `MapRunCardRef` 目录和合法候选，为自然卡牌目标稳定选出默认实例；目标为空时以明确的 `noLegalTarget` 安全跳过，Commit 和 Receipt / Save / Resume 保持一致。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | Unit 白名单与 Receipt 规则 |
| 文档 | docs/docs-829/05-conventions/testing.md | 已报告机制问题的行为回归范围 |
| 文档 | docs/plan-work/task-0299-gameplay-b-autonomous-action-target-strategy.md：P0、P4 | 已冻结的目标与跳过合同 |
| 源码 | src/arona-clicker/services/map-card-catalog.ts：catalogMapRunCards、mapRunCardKey | 真实实例与稳定目录次序 |
| 源码 | src/arona-clicker/services/gameplay-b-action-preview-resolver.ts：卡牌候选过滤 | Source-relative 合法目标、Preview |
| 源码 | src/arona-clicker/services/map-run-service.ts：resolveEncounterCommitPlan、restoreEncounterCommitReceipt、setPreparedCardTarget、setActionOverride | Commit、Receipt 与干预重算 |
| 源码 | src/arona-clicker/services/map-card-effects.ts：resolveMapCardEffects | 复用真实卡牌 Effect / scost 合同 |
| 测试 | tests/engine/gameplay-b-map-cards.test.ts | 实例身份、默认目标、换牌、效果、零候选与存档 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 3 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 仅扩大到直接 Commit / Receipt 调用方 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 卡牌目录只从当前 Encounter 的真实 Hand、PlayerCommand 和 Enemy Intent 构造；引用 scope 含 Run / Map / Node / Activity / Round。 | map-card-catalog.ts：catalogMapRunCards | UI 卡片 DOM 不参与领域身份。 |
| Hand 卡牌 `id` 含 zone、owner、Action ID；同 Action ID 在不同 Character 手牌是不同实例。 | map-card-catalog.ts：append、tests/engine/gameplay-b-map-cards.test.ts | 按完整 MapRunCardRef 比较。 |
| Action Preview 已计算合法卡牌候选，但多候选时 targetCard 为空；零候选也被标成需要选择。 | gameplay-b-action-preview-resolver.ts：卡牌 Preview 分支 | 需要稳定首选和零候选区分。 |
| Commit 当前拒绝任一 `targetSelectionRequired` Action；`resolveMapCardEffects` 对 card Action 要求真实 targetCard。 | map-run-service.ts：resolveEncounterCommitPlan；map-card-effects.ts：resolveMapCardEffects | Skip 必须同时绕过 Effect choice 计算并写入可恢复 Receipt。 |

## Constraints

- 卡牌默认目标取当前完整合法候选数组的第一个实例；顺序直接复用目录：固定 Party 顺序、每人当前 Hand 顺序及现有其他目录顺序。不得按 Action ID 合并实例。
- 有显式合法 targetSelections 时尊重手动选择；清除选择、Swap、PlayerCommand 或恢复自然 Action 后，以当前 Action 和当前合法候选重新选第一项，不继承旧值。候选只有 1 项时仍按既有行为自动使用，不增加无意义存档字段。
- 合法候选为空时，Preview 以 `skipReason: noLegalTarget` 表示准备行动不可执行，且不再要求一个不存在的 target。不要抽 Hand[1]、重抽、不循环修改其他角色 Hand，也不创建虚构 Wait。
- Commit 对该跳过 Action 保留 Action ID、override 与 PlayerCommand 的 PlayerCost；不记录 targetCard / scostCost / Action resourceChanges / HP effects，不支付 Actor / Team Action cost，不应用 card effects。Receipt restore 必须接受且核对同样的跳过形状。
- 有真实 targetCard 的 Action 继续送入现有 `resolveMapCardEffects`，正常计算 scost 折扣并经当前 Commit / Receipt。
- 不改变任何既有 card side / scost legality，不实现 Flow 卡，不改 Runtime / Workspace View / Controller / CSS；P5 U9 再投影 Skip 状态。

## Allowed Files

- src/arona-clicker/services/gameplay-b-action-preview-resolver.ts
- src/arona-clicker/services/map-run-service.ts
- tests/engine/gameplay-b-map-cards.test.ts
- 本 Unit 与其 Receipt；必要时更新 Task-0299 的 Patch Unit 状态。

## Explicit Non-goals

- 不建新卡牌目录或策略 Owner，不更改 MapRunCardRef 格式。
- 不改变 `resolveMapCardEffects` 的既有可用目标 / 效果语义；无目标跳过通过同一 Commit plan 排除该 Action 的 card effect choice。
- 不把 Skip 状态暴露到 Runtime / Workspace UI；等待 Task-0291 U4 接口稳定后由 U9 处理。
- 不等待 Task-0298 Flow 身份 / P6 作用线；本 Unit 只处理真实 MapRun Card。

## Stop Conditions

- 真实卡牌身份、合法性或 Effect 合同不足以支持当前 MapRun 卡目标：停止并指出具体缺口，不复制新目录。
- 为 Skip UI 投影必须修改 Task-0291 U4 当前使用的 View / Workspace 文件：保留领域结果，停止该投影并留给 U9。
- 需要改变既有 card side / scost 语义、Save 版本或 Task 未冻结的费用行为：停止并交回负责人。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [x] 多个合法真实卡牌目标自动选目录顺序第一项；实例引用完整保留，同 Action ID 不混淆。
- [x] 手动目标跨刷新保持；清除、换牌、PlayerCommand / 恢复自然行为后按当前候选重新决策。
- [x] 零候选卡牌行动预览明确标记 `noLegalTarget`；可直接 Commit，不阻塞、不换牌、不重抽。
- [x] 零候选 Skip 不应用 Action cost、card effect、scost 折扣或 HP effect；PlayerCommand PlayerCost 按 P0 保留。
- [x] 有目标时实际 `resolveMapCardEffects` / Commit 生效；Receipt 可 Save / Resume 并校验 Skip 与实际目标。
- [x] 受影响卡牌测试、类型检查、文档检查与差异空白检查通过。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Runtime / Cards / Save / Resume | npx vitest run --silent tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts | 通过：3 files、64 tests；包含自动实例选择、真实 scost Commit 和零候选 Skip Receipt 保存恢复。 |
| 类型检查 | npx tsc --noEmit | 通过 |
| 文档 / 差异 | npm run check:docs；git diff --check | 通过；errors 0、scanned 947；差异检查仅有既有 CRLF 提示。 |
