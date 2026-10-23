# Task 0320-U23：实际治疗后的局内资源触发

状态：施工与自动化验证完成；屏幕验收待人工执行，需求单不代表已通过。

## 基线与目标

Task 0318 已提供 Encounter-local `regen`，U21/U22 已接通 AG-1 `revive`、Shield 和受限固定减伤。当前 AG-1 `heal` Trace 记录 HP 实际变化，但不存在从结果事件派生的新来源。本 Unit 以 `healApplied` 建立有限的 MapRun 内反应队列，验证“受治后回馈资源”，不连接 AC EventBus/TriggerSystem。

## 冻结合同

### 作者字段与事件身份

- `GameplayMapEffectProgramDef` 可声明有序 `triggers`。U23 仅允许 `event: 'healApplied'`；每条 trigger 有 Map-local `id` 和唯一的正向 Actor `resourceChange` 效果。
- 此首片仅匹配同一 Action `effectProgram.resolve` 中对单个 `primary` 执行的 AG-1 `heal`。不监听 TargetSet Heal、`hpChange`、`revive`、E1/legacy Heal、Encounter `regen` 或外部游戏事件。
- Planner 按每个实际 heal hit 的 Trace 顺序建立事件；只在 `after > before` 时发出，事件的 `target` 是该次 Heal 的实际 primary Actor，`actualAppliedAmount = after - before`。请求为 0、目标倒地、目标满血或 HP cap 后变化为 0 时不发事件。
- 每个事件依 `triggers` 声明顺序激活匹配 handler。资源写账户固定为事件目标的 `primaryActor`，资源必须由 Map 为该 Actor 声明，delta 必须为正安全整数。
- Trigger 只绑定其所属 Action Program 中的 Heal 事件；不跨 Action、Status、Encounter 或 Map 订阅。事件携带父 AG-1 source/action、父 executionIndex、Heal path、目标身份、请求与实际恢复量以及队列序号。

### 反应队列与事务

- Queue 为 AG-1 detached Commit 计划的派生局部数据。它不写 AC EventBus、不调用 Tick，不另开 MapRun Owner；恢复从 scheduler start snapshot 与当前 Program/Status/资源起点重算 Queue。
- 一个 heal source 的 Effect Program 先完整规划；随后按入队 FIFO 顺序执行该来源的匹配 Trigger effect，再进入下一个 AG-1 来源。Trigger 写入加入父来源资源意图账本，父来源完成后才安装；自身不能使用尚未安装的该奖励支付费用或读取余额。
- U23 Trigger effect 只允许一条 `resourceChange`，且目标为 `primaryActor`。它不包含 damage/heal/Status/Counter/Flag/嵌套 Trigger，因此链深固定为 1、不能重入、不产生新的 `healApplied` 或其它事件。
- 每个 Commit 最多执行 32 个 Trigger effects。超预算、资源账户/余额非法、Planner/Receipt 校验失败时，整轮拒绝且 HP、资源、费用、状态和 Trigger cursor/Trace 均无部分安装。
- Trigger 不修改已有 AG-1 来源顺序；触发奖励在父来源的资源结算后对后续来源可见。非触发 Map、scheduler v5/v6、Program Receipt v1/v2、Status Receipt v1–v5、Shield Receipt v1 及 E1/legacy 行为保持原样。

### Trace、Receipt、Restore 与显示

- 新增独立 `triggerReceiptVersion: 1` 与有序 `triggerTrace`。Trace 逐次记录 trigger ID、`healApplied`、父来源/Action/executionIndex/path、队列序号、目标、请求/实际 HP delta，以及已执行资源意图或精确拒绝原因。没有事件的 Map/Commit 不带新 Receipt 字段。
- `effectTrace` 保留父 Heal 与 Trigger resource effect/settlement 的有序证据；`triggerTrace` 为事件触发独立回执，不升级 scheduler/Program/Status/Shield Receipt。Preview、Commit Receipt、Restore、Save/Resume 与 Runtime ReadModel 验证并深冻结该证据。
- Flow 按 `triggerTrace` 顺序显示父 Heal 的实际恢复量及资源回馈；不改变既有 executionSequence 次序或伪造额外 Action 卡。

### 正式样例与验证

- 新增独立 AG-1 演练 Map：Party Shiroko 对 9/10 HP 的 Serika 请求治疗 3，实际恢复 1；触发一次 `focus +1`。它不引用 AC 永久资源或 Story 状态。
- 自动化还覆盖实际恢复 0 的满血目标不触发、状态/资源预算边界、后续来源读取奖励、Flow、Save/Resume、Restore 重算与 Trace/资源篡改拒绝。
- 开发迷你控制台可用 `startMap <mapId> --enter-office --move-to practice --ability encourage --target-party serika --commit-rounds 1` 自动准备演练；人工浏览器验收仍另以需求单记录。

## 施工切片

- **U23a 作者合同**：Effect Program trigger 定义、严格语法、Normalizer、AG-1/primary heal/resource Context、Schema 与摘要边界。
- **U23b 纯 Planner**：实际 Heal 事件、FIFO 局部队列、资源响应 Trace、32 次预算与零恢复/非法输入拒绝。
- **U23c Owner/Receipt/Restore**：父 executionIndex 绑定、资源结算、独立 Trigger Receipt v1、Preview/Commit/Save/Restore 重算与篡改拒绝。
- **U23d ReadModel/Flow/样例**：深冻结只读投影、触发回馈 Flow、正式可进入 Map、作者说明和屏幕验收需求单。

## 明确排除

- `damageApplied`、反击伤害、实际伤害 0/Shield 全吸收规则、`onExpire`、`regen` heal event、Status 持有的被动 Trigger、同链来源重入、链深大于 1、跨 Encounter Status、一次性受击保护、任意 Trigger Program、E1/legacy 或 AC EventBus。
- 上述触发扩展需独立合同；U23 不预建其作者字段、Receipt 版本或运行时行为。

## 实施与验收状态

- U23a–d 均已完成：作者语法/AG-1 Context/Schema、纯 Planner、Owner 资源结算与独立 Receipt/Restore、Runtime ReadModel/Flow 和正式样例已接通。
- 正式样例 `gameplay-b:map:heal-applied-resource-example` 以 9/10 HP 对芹香请求恢复 3；实际恢复 1 后给予 `focus +1`。随后执行的芹香来源读取本轮 Focus 并造成等量伤害。
- Planner 覆盖多 Heal hit × trigger 声明顺序、零恢复与 32 次预算；Owner 覆盖后续来源可见、Save/Restore 重算与 Trace 篡改拒绝、34 次激活时无部分安装。
- 自动化、类型、架构、文档和差异检查汇总见 [[receipts/U23-receipt]]。人工 Workspace 步骤见 [[U23-screen-acceptance-report]]，状态保持待人工执行。
