# Unit 0320-U05：AG-1 统一执行队列与逐来源结算

## Goal

将 U04 的真实已选来源接入唯一 MapRun Owner，按 U02 的排序结果逐源处理费用、Effect Program、HP／资源／locals、Enemy skip 和战斗终局；完成后的来源序列与每源实际结果进入有版本的 Commit Receipt。E1-COMPAT-1 保持原分组执行路径与既有含义。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md` | Patch Unit 白名单与停止条件 |
| 规范 | `docs/docs-829/05-conventions/architecture-discipline.md` | 单一 MapRun Owner、detached 计划与原子安装 |
| 规范 | `docs/docs-829/05-conventions/testing.md` | 行为金样、原子性和高风险审查要求 |
| Task | `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md` | AG-1 P1 目标与依赖 |
| Draft | `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md` §13.1–13.4 | 已批准全序、支付、折扣、skip、terminal、Receipt 与幂等合同 |
| 前置 Unit | U01–U04 的 Unit 与 Receipt | 作者输入、排序器、Actor快照与唯一来源适配 |
| 源码 | `src/arona-clicker/services/map/map-run-service.ts`：`resolveEncounterCommitPlan`、`prepareEncounterRoundCommit`、`installPreparedEncounterCommit` | 唯一 Owner 的纯计划、Receipt 和原子安装路径 |
| 源码 | `src/arona-clicker/contracts/map/map-run.ts`：Commit Plan／Receipt／Preview、settlement projections | 新 AG-1 sequence 的最小闭合数据结构 |
| 源码 | `src/arona-clicker/runtime/runtime-game-instance.ts`：`commitMapEncounterRound` | Item 仅在来源实际执行时进行双 Owner 准备与安装；无需重复消费 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-map-source-transactions.test.ts` | E1 兼容、Round Commit 与跨 Owner Item 事务基线 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 35k tokens；集中读唯一规划器完整分段、必要恢复邻接函数和定向测试 |
| 文档 Read Set | 5 篇／节 |
| 历史文档 | 0 篇 |
| 超预算处理 | 若实现会触及超出白名单的 UI／Schema／Receipt Restore，请停止并分成 U06/U07，不越界扩单元 |

## Constraints

- AG-1 Map 走统一执行队列；省略 `executionContractId` 的 Map 仍走既有 E1-COMPAT-1 规划路径，E1 期望／黄金结果不变。
- 只处理 U04 适配器产生的 Party Action、Enemy Action、selected Ability、selected Item 实际来源。Wait、未选 PlayerCommand、未选 Hand 和候选选项不入队；`noLegalTarget` 的已选来源仍保留为来源行。
- 所有合法有实体来源的 prepare 折扣在队列执行前一次性计算；折扣只应用到合法当前卡片的 Actor sCost，不能按最终速度延迟，也不能改变 PlayerCost、Hand 或 Action 候选资格。
- PlayerCommand 已选选择费在队列执行前合计校验和扣除；即使该来源因后续终局／来源倒地／无目标而跳过，选择费仍支付。Ability 的 PlayerCost 与 Item 库存只在该来源实际执行时支付／消费。
- 每源开始顺序固定为：检查 `roundEnded` → 实体来源是否已倒地 `defeated` → 锁定目标重核／自动合法目标 fallback → 检查固定 Actor／Team／Ability／Item 成本 → 扣除本源成本 → 按声明顺序完整规划本源效果 → 本源资源效果完整兑现。Party 成本到达执行位置仍不可付时拒绝整轮 detached 计划；Enemy 不可付时记 `unaffordable`、不付费并继续。来源不可用自身效果支付自身固定成本。
- 前一来源的 HP、locals、Actor／Team 余额效果对后续来源可见；显式锁定目标不自动替换，合法但已倒地的显式目标保持零 HP变化并正常按合同收费；自动目标按来源开始时存活集合重新选择，无目标记 `noLegalTarget`。
- 每个来源程序完整完成后立即按 failure 优先、victory 次序检查 Battle terminal。terminal 后所有其余已选来源均写 `roundEnded`，不扣费用／Item、不执行效果；同源中途成 terminal 不截断。non-battle completion 只在全序结束后检查。
- 全部工作仍是 detached 计划：任一程序错误、资源非法、费用拒绝、越限或版本陈旧不得部分安装 HP、locals、余额、Command 费用、Item、Hand、Receipt。GameInstance 仅据执行计划的真实 Item 消费结果协调原有双 Owner 原子安装与幂等。
- AG-1 Receipt 使用闭合 `schedulerFormatVersion` 与 `executionSequence`，在 MapRound Commit Receipt 上存在，即使本轮无 Effect Program；至少逐行保存 `executionIndex`、`sourceKey`、sourceKind、owner/source identity、Action、CardRef或显式null、敏捷输入／final、已选目标、skip原因、实际资源／HP变化、PlayerCost 支付与 Item 是否消费。保持 `settlements/enemyActions/ability/item` 为旧分组投影，不能以投影顺序冒充执行顺序。
- U06 专门接入 Restore 时的执行队列、序列与分组投影独立重算。本 Unit 生成与安装完整 AG-1 Receipt；不能为本 Unit 临时放宽或绕开现有 Receipt Restore 校验。
- 不改变手牌抽取、E1 Effect Program 语义、Status 轮末时点、Effect trace 访问预算、Save 格式、Actorless 无费用身份或 U02 排序合同。

## Allowed Files

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/contracts/runtime/runtime.ts`（仅将 RecentCommit／CommitPreview 的 `executionContractId` 读模型联合类型扩为接受 AG-1；不新增本 Unit 的执行顺序 UI 字段）
- `src/arona-clicker/services/map/map-run-service.ts`（唯一 Owner 计划／Commit／Receipt 创建；不改 Restore 验证）
- `tests/engine/gameplay-b-map-ag1-commit.test.ts`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U05-ag1-unified-execution-queue.md`（仅记录实施结果）
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U05-receipt.md`

## Explicit Non-goals

- 不改 `restoreEncounterCommitReceipt`、Save/Resume 独立回放或 E1 Receipt validator；归后续 U06。
- 不改 UI/Tooltip 执行次序展示；归后续 U07。Runtime RecentCommit／CommitPreview 仅允许 `executionContractId` 类型投影兼容 `'AG-1'`，不在本 Unit 暴露或展示完整执行序列。
- 不改 `runtime-game-instance.ts` 的双 Owner coordinator；其既有 `PreparedMapRunEncounterCommit.itemId` 契约由本 Owner 只在实际执行 Item 时赋值并用集成测试验证。
- 不实现 E2 随机、通用循环或资源余额 Value；不导入 E3–E5 新能力。
- 不修改旧分组数据或把 E1 Map 升级为 AG-1；仅显式 AG-1 Map 走新分支。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若 `resolveEncounterCommitPlan` 无法在不改变 E1 分组路径的前提下分派 AG-1，停止并回报，不把 E1 与 AG-1 改成同一行为合同。

## Completion Criteria

- [x] Preview 与 Commit 使用相同纯 AG-1 全序；实际来源行与 U04 唯一顺序一致。
- [x] 逐来源执行严格覆盖 §13.3 的支付、目标、skip、资源可见性、同源完成和终局顺序。
- [x] Queue 内已选 PlayerCommand 按规则支付；Ability 与 Item 只在实际执行时支付；终局后的 Item 保留且 skip reason 正确。
- [x] 快速资源来源能资助后续来源但不能支付自身；Party 不可付整轮拒绝、Enemy 不可付免费 skip；首个 Effect 错误／非法资源时零安装。
- [x] 生成独立 versioned `executionSequence`，旧 settlement groups 是一致投影；无 Effect Program 的 AG-1 轮也有 Receipt 序列。
- [x] 失败与重试、双 Owner Item 提交遵守现有原子与幂等边界；E1 原行为定向回归不变。
- [x] 运行新 AG-1 Commit 测试及既有 `gameplay-b-map-run`、`gameplay-b-map-source-transactions` 定向测试、`npx tsc --noEmit` 与 `git --no-pager diff --check`；更新 Receipt。Restore 验收留待 U06。

## 实施记录

- `MapRunService` 按 `executionContractId` 显式分派 AG-1 与原 E1 分组计划；AG-1 Preview 与 Commit 共用统一来源序列计划，E1 原路径保留。
- AG-1 按 U04 来源顺序逐源支付和应用效果；实际执行 Item 才向既有 coordinator 提供消费 ID。Receipt 即使没有 Effect Program 仍保存 AG-1 contract、scheduler version 和执行序列，程序 Receipt 字段保持独立。
- Runtime RecentCommit／CommitPreview 的 `executionContractId` 联合类型扩展接受 AG-1，未增加执行序列 UI 投影。
- 增补源不能用自身效果支付成本、Enemy 后续来源变为 `unaffordable`、终局后的 Item 不消费、无 Program Receipt 等用例。Restore 独立重放继续由 U06 负责。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| AG-1 全序与逐源提交 | `npx vitest run tests/engine/gameplay-b-map-ag1-commit.test.ts` | 通过 |
| E1 MapRun 兼容 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts` | 通过 |
| Item 双 Owner 原子性 | `npx vitest run tests/engine/gameplay-b-map-source-transactions.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
