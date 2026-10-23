# Task 0320-U25：实际 HP 变化阈值触发

状态：实现与自动化验证完成；屏幕验收待人工执行。U25 是 E5 结果条件的最小首片，沿用本地试玩台操作参数。

## 目标

让现有 `healApplied` 与 `damageApplied` 局内资源回馈按实际 HP 变化量设置门槛。门槛使用已经经过 HP 上限、Status 减免和 Shield 结算后的实际结果，不新增事件、Effect 类型或外部状态写入。

## 冻结合同

- `GameplayMapEffectTriggerDef` 增加可选 `minimumActualAmount`。
- 若省略，语义与 U23/U24 完全相同：任意正实际 HP 变化均可激活该匹配 Trigger。
- 若填写，值必须是正安全整数；仅当事件的 `actualAppliedAmount >= minimumActualAmount` 时，才把该 Handler 纳入 FIFO 队列。
- Heal 使用实际恢复量；Damage 使用最终实际 HP 损失。请求值不得用于阈值比较。
- 未达到阈值的事件不产生 Trigger Trace、资源意图或队列序号，不消耗 32 次 Commit 激活预算，也不修改后续来源可见的余额。
- 达到阈值的 Handler 保持 U23/U24 的 Trigger 声明顺序、事件 FIFO、父来源完整结算后写资源、后续来源可见、单条正向 `primaryActor` `resourceChange`、不重入和单 Commit 32 次预算。
- Heal 满血/HP cap、DamageReduction、Shield 吸收与 HP clamp 继续按 U23/U24 定义产生实际量；阈值只观察实际量，不改变其计算。
- 新字段仅影响当前 Map 的作者行为。采用阈值的正式 Map 必须提升自己的 `resumeVersion`；不升级无关 Map。旧的省略字段 Map 与 U23/U24 Trigger Receipt v1 保持原行为。
- Restore 从提交起点及当前冻结的 Map 定义重算阈值命中、Trigger FIFO、资源账本和 Receipt；门槛改动导致预期 Trace/余额变化时拒绝不一致历史，不做迁移。
- Flow 只显示实际执行的 Trigger；未达到门槛时不新增“未触发”展示行。以后若需要解释未命中原因，另立 Trace 合同。

## 样例与验证

- 扩展独立演练 Map 或新增演练 Map，至少包含一个未达门槛的 heal/damage 回馈和一个达到门槛的回馈；保持数据与 `resumeVersion` 一致。
- 自动化覆盖低于、等于和高于门槛；比较实际 HP 变化而非请求量；未命中不消耗预算；多个事件与 Handler 的 FIFO；后续来源余额可见；Save/Restore 重算及阈值/Trace/余额篡改拒绝。
- 开发迷你控制台使用现有白名单操作参数启动 Map、移动节点、配置所需 Ability/目标并提交有限回合；控制台参数本身不扩展为通用脚本。

## 明确排除

- 新事件、通用 when/表达式条件、Status 持有/到期 Trigger、击杀归属、反击、TargetSet 事件、链式或跨 Action 订阅。
- 任意资源账户、资源扣除、HP/Status/Fact 写入、跨 Encounter/Map 状态、E1/legacy Trigger 与 AC EventBus/Tick。

## 实施单元

- 作者合同／严格语法／Context／Normalizer／Schema 同步。
- Planner 阈值匹配和预算；保持未命中不入队。
- Owner/Receipt/Restore、Flow 与正式演练 Map。
- 屏幕验收需求单：提供可复制 `startMap` 参数命令并保持“待人工执行”，不声称人工通过。

## 实施与验收状态

- 作者字段、严格语法、Context、Normalizer 与生成 Schema 已同步；Planner 按最终实际 Heal/Damage HP 变化量过滤 Trigger；Owner、独立 Trigger Receipt v1、Save/Restore、正式演练 Map 与作者说明已接通。
- 正式演练证明请求 3、实际损失 1 不触发；后续请求 2、实际损失 2 达到门槛并给予 `guard +1`，随后来源能读取该资源。提高门槛后 Restore 拒绝不一致历史。
- 定向 16 文件 466/466、Schema/类型/架构/文档/差异检查通过。回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U25-receipt]]。
- 屏幕验收仍待人工执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U25-screen-acceptance-report]]。
