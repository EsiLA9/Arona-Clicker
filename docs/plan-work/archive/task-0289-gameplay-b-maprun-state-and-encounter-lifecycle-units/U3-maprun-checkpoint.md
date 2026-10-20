# Unit 0289-U3：MapRun 状态 checkpoint 往返与拒绝校验

## Goal

把 U2 建立的队伍身份与 PlayerCost 纳入现有 MapRun checkpoint；保存 / 恢复保留当前 Run 值，非法 checkpoint 被拒绝且不污染现有状态。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 用途 |
|---|---|---|
| 设计 | `docs/plan-work/archive/draft-0287-gameplay-b-phase-b-contract.md` Save / Resume | 内容版本与旧 Operation Run 处置 |
| 规范 | `docs/docs-829/05-conventions/architecture-discipline.md` | SaveData 与运行 Owner 边界 |
| 契约 / Owner | `src/arona-clicker/contracts/map-run.ts`、`src/arona-clicker/services/map-run-service.ts` | checkpoint shape 与恢复校验 |
| Registry 验证接线 | `src/arona-clicker/runtime-game-instance.ts` `replaceMapRunOwner()` / restore；Registry Variant `proto` | 向唯一 Owner 提供静态 Variant → Character 只读查询，校验保存的 Party 身份配对；不读写 PlayerState |
| 测试 | `tests/engine/gameplay-b-map-save-resume.test.ts` | 当前版本、拒绝策略与不污染断言 |

## Context Budget

| 项 | 预算 / 规则 |
|---|---|
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 2–4 篇 |
| 历史文档 | 默认 0 篇 |
| 超预算处理 | 需要更改 SaveData 根结构时停止并交总控拆分 |

## Optional Read Set

- 无。U3 白名单允许在 GameInstance 创建唯一 MapRunService 时注入只读 Registry Variant → Character 查询；不注入 PlayerState，不建立第二个状态 Owner，也不改 Map Resolver 作者语义。

## Do Not Read by Default

- Operation Run 兼容与迁移实现；本 Unit 不迁移旧 Run。

## Confirmed Facts

| 事实 | 依据 | 备注 |
|---|---|---|
| MapRun checkpoint 为 `mapId + resumeVersion + run`，只保存活动 Run。 | `src/arona-clicker/contracts/map-run.ts` `MapRunSaveSnapshot`；`MapRunService.createSaveSnapshot()` | 不增加 SaveData 第二份 Map 状态。 |
| 内容版本不匹配时拒绝 MapRun 恢复，保留 PlayerState 与 OperationRun。 | `tests/engine/gameplay-b-map-save-resume.test.ts` | 新字段延续此事务边界。 |

## Constraints

- 恢复只校验并安装 Owner checkpoint；不得重新初始化 Map 初始 PlayerCost。
- 不迁移 OperationRun，旧 MapRun 版本按现有 `resumeVersion` 规则处理。
- 恢复 Party 时只保留冻结合同中的 `characterId` / `variantId` 字段；不复制 checkpoint 注入的额外运行时字段。利用静态 Registry 定义确认 Variant 的 `proto` 匹配对应 Character，不重新读取或写入 PlayerState。PlayerCost 往返用非零且与 Map 初值不同的值验证，证明恢复不会重置余额。
- `MapRunService` 仍是唯一状态写入 Owner；Variant 查询是只读验证 Port。
- MapRunService 可以支持不带 Variant 查询的仅内存启动测试，但任何非空 checkpoint 恢复都必须有 Variant 查询；缺少查询时拒绝恢复，不能绕过配对校验。

## Allowed Files

- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/services/map-run-service.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `tests/engine/gameplay-b-map-save-resume.test.ts`

## Explicit Non-goals

- 不增加第二个 SaveData 根字段或独立 Encounter checkpoint。
- 不实现 RNG、HP、Hand、Action、费用消耗、奖励结算或失败 Run 恢复。
- 不改 PlayerState / OperationRun，不做旧 Operation Run 迁移。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。若新增状态无法放进已有 `MapRunSaveSnapshot` 并保持唯一 Owner，或配对检查需要读取 / 写入 PlayerState、建立第二 Owner，停止并交回总控。

## Completion Criteria

- [x] checkpoint 深拷贝并往返恢复队伍身份与当前 PlayerCost；不从 Map 初值覆盖已消耗余额。
- [x] 使用非零且不同于 Map 初值的 PlayerCost 验证往返；恢复只接受固定 Party 中按序匹配的 Character ID 与非空 Variant ID，并只投影受支持的身份字段。
- [x] 恢复校验 Party 结构、Variant ID 唯一性、Registry Variant → Character 配对与非负 PlayerCost；非法 checkpoint 不污染 Owner。
- [x] 未提供 Variant 查询的 MapRunService 不接受 checkpoint 恢复。
- [x] 无 checkpoint、内容版本不匹配、无效 Run 和成功恢复的既有合同保持；PlayerState / OperationRun 不变。
- [x] 只有当前合法活动 MapRun 可恢复；失败 Run 不增加可恢复形状。

实施与复核记录：[[receipts/receipt-U3-maprun-checkpoint]]。

## Verification

| 项 | 命令 / 方式 | 期望 |
|---|---|---|
| Save / Resume 定向测试 | `npx vitest run tests/engine/gameplay-b-map-save-resume.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 通过 |
