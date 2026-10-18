# Unit 0289-U2：固定队伍准入与 MapRun-local 状态

## Goal

MapRun 开始前，以只读 PlayerState 信息校验 Map 固定队伍并确定各角色当前已拥有的 Variant；把身份快照和 `initialPlayerCost` 作为 MapRun-local 状态交给唯一 Owner。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 用途 |
|---|---|---|
| 设计 | `docs/plan-work/draft-0287-gameplay-b-phase-b-contract.md` 状态生命周期 | 固定队伍与 MapRun-local 归属 |
| 规范 | `docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/05-conventions/architecture-discipline.md` | PlayerState 只读准入与 Owner 边界 |
| 契约 / Owner | `src/arona-clicker/contracts/map-run.ts`、`src/arona-clicker/services/map-run-service.ts` | MapRun 字段与唯一可写 Owner |
| 检查点恢复 | `MapRunSaveSnapshot`、`MapRunService.restoreSaveSnapshot()`、`restoreRunState()` | 新增必需的队伍身份与 PlayerCost 必须通过既有恢复路径保留并做最小结构校验；深入的存档往返与损坏输入测试归 U3 |
| 装配 | `src/arona-clicker/runtime-game-instance.ts` `startMap()` / `replaceMapRunOwner()` | 准入接线与 Owner 创建 |
| 角色查询 | `src/arona-clicker/services/character-system.ts`、`src/arona-clicker/services/roster-system.ts` | 已拥有 / 解锁 Character 与 Variant |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-map-runtime-integration.test.ts` | 直接状态及 GameInstance 命令验收 |

## Context Budget

| 项 | 预算 / 规则 |
|---|---|
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 3–5 篇 |
| 历史文档 | 默认 0 篇 |
| 超预算处理 | 若需新增服务文件或跨出 5 个 Allowed Files，停止并交回总控拆分 |

## Optional Read Set

- `src/arona-clicker/services/operation-participant-admission.ts`：只参考 Character → 已拥有 Variant 的确定性查找，不复用 Operation Profile / Action 装配。

## Do Not Read by Default

- 旧 Operation Sample 的 Profile、Strategy、CardPool 与 Action 生成实现；C3 另立 Read Set。

## Confirmed Facts

| 事实 | 依据 | 备注 |
|---|---|---|
| `CharacterSystem.getUnlocked()` 从已拥有 Variant 推出已解锁 Character。 | `src/arona-clicker/services/character-system.ts` `getUnlocked()` | 可只读检查角色准入。 |
| `RosterSystem` 可从 PlayerState 读取已持有 Variant 与 Variant 定义。 | `src/arona-clicker/services/roster-system.ts` `getOwned()` / `getVariant()` | MapRun 保存实际匹配的 Variant 身份。 |
| 现有 Operation 准入对同一 Character 按 Variant ID 排序，取首个已持有 Variant。 | `src/arona-clicker/services/operation-participant-admission.ts` `indexOwnedVariantsByCharacter()` | 可复用确定性选择规则，不复用整套 Operation。 |
| MapRunService 当前不读写 PlayerState。 | `src/arona-clicker/services/map-run-service.ts` `start()` | 保持产品准入在 GameInstance 边界完成。 |

## Constraints

- 使用 Task 0289 已冻结的 Map party 与初始费用合同。
- MapRun Owner 仍为 GameInstance 私有 `MapRunService`；UI / Save 不成为第二 Owner。
- 保持 `Persistent PlayerState` 不变。
- 在既有 `MapRunSaveSnapshot` 中增加并恢复本 Unit 新增的 MapRun-local 固定队伍身份与 PlayerCost；只做使必需字段能够安全恢复的最小验证，不改变 checkpoint 格式版本策略或保存根结构。U3 负责完整往返和异常 checkpoint 验收。

## Allowed Files

- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/services/map-run-service.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `tests/engine/gameplay-b-map-run.test.ts`
- `tests/engine/gameplay-b-map-runtime-integration.test.ts`

## Explicit Non-goals

- 不实现 HP、Actor / Team resource、敌方状态、行动轮次、Action / Effect、Hand、Swap、Player Command、Ability、Item 或奖励。
- 不实现失败触发、失败终态、撤退、当前 Run 重试或失败 UI；这些规则已冻结，实际 HP 触发和显示由 C4 实现。
- 不增加第二个 Runtime Owner，不改 Map Entry UI / loader / Schema。
- 不重新从 Persistent PlayerState 导入养成 HP 或长期资源。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。若需更改 roster 的既有身份语义或改动 Allowed Files 外的 wiring / UI，停止并报告。不得在本 Unit 提前实现 C4 失败行为。

## Completion Criteria

- [x] MapRun 快照含固定队伍身份 `{ characterId, variantId }` 和当前 `playerCost`。
- [x] 未知、未拥有或未解锁成员导致准入整体失败，Run 尚未创建、PlayerState 不变。
- [x] MapRunService 接收已准入的只读结果，不直接依赖或写入 PlayerState。
- [x] 成功完成 Encounter、沿合法 Edge 移动及进入下一 Encounter 不会重建队伍或重置 PlayerCost；直接测试使用非零初值验证跨节点保留。
- [x] 现有 restore 路径能安装并保留新增必需字段；完整 Save / Resume 往返与损坏 checkpoint 拒绝由 U3 验收。
- [x] 不添加 HP、Team resource、Encounter action、Hand、Prepared Action、Target、RNG 或失败终态空占位。

实施与复核记录：[[receipts/receipt-U2-party-admission-and-maprun-state]]。

## Verification

| 项 | 命令 / 方式 | 期望 |
|---|---|---|
| MapRun / GameInstance 测试 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 通过 |
