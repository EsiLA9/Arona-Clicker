# Unit 0320-U04：AG-1 实际来源适配器

## Goal

把当前已经选定的 Party／Enemy Action、Ability 与 Item 草稿适配为 U02 的闭合排序输入，并保留实际来源身份、Action、CardRef、目标选择摘要。此 Unit 只实现 detached 纯函数和测试；不读取 MapRun Owner，不规划费用／效果，不修改 Commit／Receipt。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md` | Patch Unit 白名单和停止条件 |
| Task | `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md` | P1 来源范围与合同 |
| Draft | `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md` §13.2 | 来源身份、敏捷与全序键 |
| 前置 Unit | U01、U02、U03 的 Unit 与 Receipt | 作者字段、排序 API、固定 Actor 敏捷快照 |
| 源码 | `src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts`：`GameplayBActionPreview`、Party／Enemy Prepared 行 | 真实本轮所选行动来源 |
| 源码 | `src/arona-clicker/contracts/map/map-run.ts`：`MapRunEncounterSourcePreview`、`MapRunEncounterSnapshot` | Ability／Item 草稿和敏捷快照 |
| 源码 | `src/arona-clicker/contracts/map/map-cards.ts`、`src/arona-clicker/services/map/map-card-catalog.ts` | 当前真实 CardRef 与逻辑容器序号 |
| 源码 | `src/arona-clicker/services/map/gameplay-b-ag1-scheduler.ts` | U02 的闭合排序函数及候选类型 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts` | 当前 Prepared / Swap / PlayerCommand 来源行为 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 20k tokens；只读实际来源、快照和 Card Catalog 相关范围 |
| 文档 Read Set | 4 篇／节 |
| 历史文档 | 0 篇 |
| 超预算处理 | 若需读取／修改唯一 Owner Commit planner 或 Item 安装协调，停止并留给后续 Unit |

## Constraints

- 适配器接收显式 detached 输入：Scope、定义 Action、Party／Enemy 固定顺序身份及 U03 敏捷快照、当前 Action Preview、Actorless Source Preview、当前真实 Card Catalog。不得闭包访问 MapRunService、游戏对象或外部角色成长服务。
- Party 来源只从每个 `preparedActions` 行的最终 `preparedActionId` 构造一条；`null`/Wait 不入队。natural、Swap 和 PlayerCommand 仍是该角色唯一一条 Party Action 来源，不能另遍历候选／PlayerCommand 选项重复入队。
- Enemy 只从 `preparedEnemyActions` 的实际 `naturalActionId` 构造；`null`/Wait、展示用 Intent 卡和未选 Hand 均不入队。
- 选定 Action 即使 Preview 当前标成 `noLegalTarget` 仍保留来源，后续 Owner 在来源开始时记录 skip；不能把 target skip 伪装成 Wait 或删除选定来源。
- Party／Enemy 来源必须映射到本 Scope 下 Card Catalog 中唯一的真实 prepared 卡：Party PlayerCommand 用 `playerCommand` zone，否则用 `hand`；Enemy 用 `hand`。匹配 owner、Action ID、prepared 标记和容器；缺失／多义／错 Scope 映射拒绝。不得按 UI 顺序创建 CardRef。
- Ability 与 Item 每类最多一个已选来源；不创建或携带虚假角色 CardRef，CardRef 明确为 null。未选 Ability/Item 选项不入队。
- Actor agility 只读 U03 的完整顺序快照。Party／Enemy entity 使用快照补足；Actorless 使用 0。缺失／重复／未知或与 roster 不一致的敏捷快照拒绝。
- Action 缺少 agility 时 `base=max=0`；否则 `base/max` 直接使用 U01 作者字段。`final=min(base+actorAgility,max)` 必须避免安全整数加法溢出，并验证非负安全整数与 `final >= base`。
- 排序 rank 固定 Party entity `(side=0, source=0)`、Ability `(0,1)`、Item `(0,2)`、Enemy entity `(1,0)`；entity declaration index 来自固定 Party／当前 Encounter Enemy 顺序。Actorless 的 declaration index 与 logicalIndex 均为 0；entity logicalIndex 必须来自唯一真实 Card Catalog 行。
- `sourceKey` 使用规范 `JSON.stringify([runId,mapId,nodeId,activityId??null,round,sourceKind,ownerOrSourceId,actionId])` 元组：sourceKind 固定 `partyAction | enemyAction | ability | item`；Party/Enemy ownerOrSourceId 为领域身份，Item 为 itemId，Ability 为 null。sourceKey 必须唯一并交 U02 排序器校验。
- 返回来源元数据与 U02 排序候选保持分离；对候选排序后按唯一 sourceKey 关联来源。适配器不执行费用、目标重核、状态变化、准备折扣或终局判断。

## Allowed Files

- `src/arona-clicker/services/map/gameplay-b-ag1-source-adapter.ts`
- `tests/engine/gameplay-b-ag1-source-adapter.test.ts`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U04-ag1-source-adapter.md`（仅记录实施结果）
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U04-receipt.md`

## Explicit Non-goals

- 不修改 `map-run-service.ts`、`map-card-catalog.ts`、Runtime/GameInstance 或任何 Owner 规划／安装路径。
- 不实现当轮支付、prepared 折扣、目标合法性重验、program 执行、skip、终局、费用投影、Receipt／Save／Restore。
- 不改变 U02 排序器规则或 U03 保存格式；不改变 Action 候选资格、权重、Hand 抽取或现有 Prepared 语义。
- 不读 Cultivate／Gear 等实时成长数值；不接入 E2–E5 原语。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若 Prepared Preview 与 Card Catalog 无法唯一对应真实 Party／Enemy 来源卡，停止上报；不要为通过排序创建新卡身份、改变 Catalog 或绕过 Catalog 校验。

## Completion Criteria

- [x] natural、Swap、PlayerCommand 各只从最终 Prepared 行产生一条来源；PlayerCommand 使用真实 zone/index，未选候选不入队，Wait 排除。
- [x] Enemy 只产生实际选中 Hand Action；`noLegalTarget` 选定来源保留并携带 skip 所需事实；展示卡／未选 Hand 排除。
- [x] Ability／Item 各自只允许一个真实已选来源，actorless agility=0、无 CardRef。
- [x] Party／Enemy 行使用 U03 快照补足、正确声明 index 与真实 Catalog logicalIndex；敏捷上限公式对大整数安全。
- [x] sourceKey 遵守规范元组，返回来源与 U02 顺序按 key 一一对应；无重复或模糊映射；不修改输入。
- [x] 运行适配器测试、`npx tsc --noEmit` 与 `git --no-pager diff --check`；Receipt 记录结果。

## 实施记录

- 新增 `buildGameplayBAg1ExecutionSources(input)`，仅消费显式 Scope、Map/Encounter 定义、固定 roster、U03 敏捷快照、Action/Actorless Preview 与当前 Card Catalog；拒绝非 AG-1 Map、错误 Scope、错序或不完整快照及不一致 Preview。
- Party natural／Swap／PlayerCommand 统一只读取最终 Prepared 行；Enemy 只读取实际 `naturalActionId`。实体来源必须在当前 Scope Catalog 中唯一匹配 owner、Action、zone、prepared、logicalIndex、可控性与 Catalog canonical CardRef ID。所有候选卡也必须属于当前 Scope。`noLegalTarget` 仍保留来源和 skipReason。
- U03 Party／Enemy agility 快照不仅须与 roster 完整、顺序一致，也逐 ID 比对当前 Map／Encounter 作者值；省略值按 0。快照行必须是无额外字段、无访问器的纯数据对象，防止活动 Owner 中作者值漂移但 resumeVersion 未变时沿用旧补足值。
- Ability／Item 只从已选 source preview 与当前 Encounter 映射构造；actorless 来源无 CardRef、actor agility=0。目标摘要按领域身份复制，目标身份必须在当前 roster，目标 CardRef 必须符合当前 Scope。
- `sourceKey` 按 Draft §13.2 的八项 JSON 元组生成；Action 缺省敏捷为零，最终敏捷用 `actorAgility >= max - base ? max : base + actorAgility` 避免加法溢出。输出和 U02 排序键分离，并按已排序 sourceKey 返回冻结的新来源数组。
- 最终验证结果见 Receipt。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 来源适配 | `npx vitest run tests/engine/gameplay-b-ag1-source-adapter.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
