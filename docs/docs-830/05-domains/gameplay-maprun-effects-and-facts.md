# MapRun：执行顺序、效果与局内事实

本文说明 Encounter 一轮中如何安排来源和结算效果，以及 Facts、状态分别在哪里生效。行动草稿和提交入口见 [[gameplay-maprun-encounters]]。

## 执行合同与效果程序

地图的 `executionContractId` 有 `E1-COMPAT-1` 和 `AG-1` 两种；省略字段采用 E1 兼容行为。它决定来源调度和费用处理。E2 是效果程序能力的扩展名称，不是第三种 Map 执行合同。Registry 的上下文校验要求新 E2 Effect AST 使用显式 `AG-1`，特定 Status、触发器和其他扩展也有各自约束；作者应检查完整校验结果，而不是认为类型里出现的每个字段都可在任何合同下组合。

AG-1 将角色行动、Ability、Item 和敌方行动整理成来源序列。`resolveGameplayBAg1SourceOrder()` 先按最终敏捷和基础敏捷从高到低排序，再用阵营、来源类型、声明次序、逻辑次序和来源键稳定破同分；因此队列并非简单按界面卡牌位置执行。执行器按来源顺序核算相关费用与效果，前一来源的结果可能影响后一来源。E1 兼容路径使用其原有的集中费用预核方式，不能把 AG-1 的顺序结算推及所有地图。

Action 的 `effectProgram` 将可选 `prepare`、有序 `resolve` 和受限的结果 `triggers` 组成声明。规划器读取来源、目标和局内状态，生成 HP、资源、状态等候选结果及轨迹；提交者完成版本和合法性检查后才安装结果。Effect Program 是 Map 专用的有限语言，不是任意脚本，也不等同通用 Engine 的 Effect。

## 目标、数值和真实结果

目标集合可按阵营、存活状态和定义顺序/HP 比例排序；`random` 使用独立的 Effect 随机状态，随机集合要求有效的 `limit`。集合大小上限为 32，省略 `limit` 时过大的集合会被拒绝。有限 `forTargets` 可以对集合成员执行受限语句体，`loopTarget` 只在该体的作用域可用；例如 `revive` 不能写在循环体内。Value 是安全整数及允许的表达式组合，支持 HP、局内 Counter、指定资源余额等受校验输入，不是任意属性访问。

`damage` 和 `heal` 的请求量不总等于最终 HP 变化：HP 上下限、减伤和护盾等可改变实际结果。普通治疗不复活倒地单位；`revive` 是单独动作。`damageApplied`、`healApplied` 等程序触发器针对实际结果而不是仅看请求值；目标、触发类型和适用来源均受内容校验限制。可参考 [[ai/guide/examples/gameplay-b-actual-amount-threshold]] 和 [[ai/guide/examples/gameplay-b-revive]]。

## Encounter 状态与 MapRun 状态

Encounter-local 的 Counter、Flag 和默认生命周期的 Status 属于当前遭遇。Status 定义可描述 Burn、Regen、damageReduction 或 damageProtection 等；实例带有持有者、来源、层数和剩余时长，回合末可按定义处理并减少时长。自然到期、手动移除和消费是不同事件，不能假定都会触发相同奖励。Shield 是单独的吸收池，不应等同 Status 层数。

显式 `lifetime: 'mapRun'` 的 Status 属于本局，可跨 Encounter 和 Shop 保留；其支持受 AG-1 校验限制。节点首次应用 `partySetup` 时会清除前一阶段的 MapRun 状态，终局也会清理，因此“跨遭遇”不是“永久生效”。HP、资源与状态的提交和回执，均应查看对应执行合同和测试。

## Facts：候选池快照与实时路线

地图可声明有界 Counter 和布尔 Flag，在新 Run 初始化，并通过支持的效果更新。它们归当前 MapRun，不是世界剧情事实。AG-1 的候选池在打开 Encounter 时冻结事实输入；边条件在每次移动时读取已安装的当前 Facts 或 Team 资源。两处读取时点不同：

1. `tests/engine/gameplay-b/gameplay-b-maprun-fact-gated-pools.test.ts` 从 `route-step = 0` 打开第一场遭遇，记录候选来源快照。
2. 第一轮提交后 Counter 变为 1，但该遭遇的候选快照仍为 0；继续提交后进入第二场遭遇，新快照读取到 2。
3. 另一测试设置路线门禁 `route-step >= 3`，当前值为 2 时移动被拒绝，Run 快照不变。

快照不变的是该 Encounter 的**候选门禁输入**，不是说其他所有运行状态不再变化。保存、恢复和校验该快照时仍需以当前合同为准。

## 示例：前一来源补充资源

`tests/engine/gameplay-b/gameplay-b-map-ag1-commit.test.ts` 的 `previews and commits the approved refill-before-spend sequence` 展示 AG-1：预览中的 `serika-refill` 先于 `shiroko-spend` 执行；提交后执行顺序与预览一致，团队资源余额为 0。这个测试体现来源顺序与资源结算的关系；不能据此认定每张地图或 E1 兼容路径都采用同一结果。

源码：`src/data-services/contracts/gameplay-map.ts`、`gameplay-map-effects.ts`，`src/data-services/validation/gameplay-map-effect-context.ts`、`gameplay-map-effect-syntax.ts`；`src/arona-clicker/services/map/gameplay-b-ag1-scheduler.ts`、`map-effect-planner.ts`、`map-encounter-statuses.ts`、`map-edge-conditions.ts`。测试：`tests/engine/gameplay-b/gameplay-b-map-ag1-commit.test.ts`、`gameplay-b-maprun-fact-gated-pools.test.ts`、`gameplay-b-effect-lifecycle.test.ts`、`gameplay-b-maprun-status-example.test.ts`。
