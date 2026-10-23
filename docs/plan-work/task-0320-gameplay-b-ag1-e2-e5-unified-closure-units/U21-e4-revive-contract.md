# U21-E4：AG-1 复苏倒地友方

> **状态：U21a–e 已实现并通过定向验证。** 本 Unit 只增加明确的 `revive` HP 原语和选择倒地 Party 目标所需的显式 Target 声明；不接触 Status 生命周期、Modifier 或 Trigger。详细证据见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U21-receipt]]，屏幕步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U21-screen-acceptance-report]]。

## 基线与目标

Draft 0312 §3/§4 将复苏描述为“对倒地友方恢复指定 HP”；普通 `heal` 与 `hpChange` 在 HP 为 0 时继续不复活。U18 Shield、U16/U19/U20 Status 操作均不会改变该语义。U21 为 AG-1 加入一个专用、可重放且可见的复苏语义。

## 冻结合同

### `revive` 原语

- 新增 AG-1 Effect Program 语句 `{ op: 'revive', target: 'primary', amount }`。`amount` 是 1 至 `Number.MAX_SAFE_INTEGER` 的正安全整数常量；不接受 Value 表达式，HP 上限裁切由 Planner 执行。
- `primary` 必须解析为一名 Party Character。Enemy 不能复苏 Party，复苏不能针对 Enemy、source、CardRef、Team、additionalTarget、TargetSet 或 `loopTarget`。Ability / Item 可通过其单位 primary 复苏 Party。
- 若规划时目标 HP 为 0，设置 HP 为 `min(amount, maxHp)`；必须结果大于 0。若 HP 大于 0，成功 no-op，保留原 HP 并在 Trace 明确 `alreadyAlive`。操作不改变 Shield、Status、资源、费用或其他来源的准备状态。
- `revive` 与同一 Program 中 damage/heal/status 等语句按作者顺序执行。复苏后同一 Program 的普通 heal 可以继续生效；普通 heal 在复苏前遇到 0 HP 仍不复活。
- 若 Party 来源的执行位置尚未到达，且更早的 AG-1 来源将其复苏，则队列在该来源的开始检查会按当时 HP 判断资格；来源变为存活可按原队列正常执行。已经 skip 的来源不回插、不重跑；同一来源不会因复苏而重复执行。
- 不增加自动复苏、死亡次数、倒地 Action、复苏 Trigger、费用或库存规则；既有来源费、PlayerCost、终局优先级和同源完整执行规则保持不变。

### 倒地目标声明

- `GameplayMapActionTargetDef` 的 `partyCharacter` 变体增加可选 `includeDefeated?: boolean`，字段仅允许出现在 AG-1 Map。缺省/false 维持现行仅存活目标合同；true 使该 Action 的 Party `primary` 合法集合包含所有 Party Character，以供玩家明确选择已倒地的单位。
- 含 `revive` 的 AG-1 Action 必须声明 `{ kind: 'partyCharacter', includeDefeated: true }`。Map Action 可以选择 Party 队友；Ability / Item 的目标形状仍由现有来源合同定义。Enemy Action 不得声明 `includeDefeated` 或执行 `revive`。
- `includeDefeated` 只影响 primary 候选合法性，不改变伤害／治疗是否对倒地单位生效，也不改变自动偏好。非法目标仍由现有 Draft 重验拒绝。
- `revive` 仅准入 AG-1；E1/legacy Validator、执行与 Status Receipt v1 不变。未知字段、无 Revive Action 却启用 `includeDefeated`、错误目标类型及 Enemy 来源使用均由 Context/Registry 拒绝。Schema 通过生成器更新。

### Trace、回放与版本

- Planner Trace 记录 source、Action、statement path、目标 identity、`requestedHp`、`restoredHp`、`beforeHp`、`afterHp` 与结果（`revived` / `alreadyAlive`）。HP 截界与 no-op 均能由输入快照独立重算。
- Trace 进入已有 AG-1 Program Receipt 的通用 statement trace 序列，不增加顶层 Receipt 字段，不提升 scheduler v5/v6、Program Receipt v1/v2、Shield Receipt v1 或 Status Receipt v1–v4。Restore 使用实际 Map Action Program 重放并逐项比较 Trace、HP、队列来源资格与终局结果。
- 只有增添 `revive` 或 `includeDefeated` 作者语义的正式 Map 才升 `resumeVersion`。不添加存档迁移器；历史 Map 仍由其自身版本和旧作者定义校验。
- Preview、失败提交、重试和 Restore 错误均不能安装部分 HP／Shield／Status／资源／Receipt；不通过 EventBus/Tick 回调复活。

## 施工切片

- **U21a 作者与 Schema**：Effect AST、Target `includeDefeated`、语法/上下文/Registry、生成 Schema 与边界测试。
- **U21b Planner**：复苏、目标类型校验、HP 上限、活目标 no-op、语句顺序与 Trace 单元测试。
- **U21c Owner/Restore**：AG-1 来源回放、后序来源活性、Save/Restore 篡改拒绝与原子提交。
- **U21d ReadModel/Workspace**：倒地主目标可选；Trace 显示复苏、HP 数值和活目标 no-op。
- **U21e 正式样例/作者说明**：新增最小可进入 Party Encounter 样例，演示先打倒队友、后续来源复苏，以及普通 heal 不复活；为新语义升级样例 `resumeVersion`。

## 完成证据

- Registry 只允许 AG-1 Party 目标；只有含 `revive` 的合法 Party 目标可含倒地单位，E1/Enemy 路径拒绝。
- Planner 覆盖 0 HP 复苏、HP cap、存活目标 no-op、program 先后语句与同轮下一来源恢复执行；Source 顺序、费用和 Hand 历史不改写。
- Owner/Restore 覆盖 Preview 纯读、失败原子性、Trace 与 HP 篡改拒绝、历史版本保留。
- Workspace 可选择倒地 Party primary，并能读懂实际复苏与 no-op Trace。

## 明确排除

复苏不移除状态、不补护盾、不恢复费用或未被选中的卡；不支持 Enemy 复苏、source 自复苏、复苏链或复苏后重跑先前来源。Trigger、跨 Encounter Status、Modifier 与 E5/P6 能力另由 Task 0320 后续单元处理。
