# 06-wiki/40-engine/expressions-and-game-num — 从声明到数值

表达式（expression）是描述如何取值或运算的数据；求值器读取当前状态和注入的查询能力，再算出数字。GameNum 把多来源产出组织成一棵可缓存的数值树。

## Value：读取一个数

`ValueSystem.evaluate()` 递归处理 `ValueExpression`。当前 `src/engine/expression/value-system.ts` 支持常数、Value source、加减乘除、最小 / 最大 / 幂、向下 / 向上 / 四舍五入和 clamp（把数限制在上下界之间）。一个 source 可读取资源、Spot 等级、Area Spot 数、Manager 数、Extra 路径或 Funclet（数据定义的小型计算式）；额外查询能力由 Runtime setter 注入。

求值是读操作：ValueSystem 不改状态。缺少的资源、Spot 等值在相应读取器中按 0 处理；缺少 Funclet 返回 0；除数为 0 时除法返回 0。`tests/engine/value-system.test.ts` 覆盖资源读取、缺值、Extra 注入和默认值行为。

## Condition：判断是否成立

Condition 先把一个目标转换为数字，再用 `==`、`!=`、大小比较符比对预期值。目标可读取资源、Spot 等级、flag、强化、标签统计、故事状态、Extra、角色好感或当前 Area。条件组用 AND / OR 组合，并在结果已经确定时提前停止后续求值。`ConditionSystem` 依赖由构造后的 setter 注入，因此 Engine 不需要静态导入每一种产品查询服务。

测试入口：`tests/engine/condition-system.test.ts`。Trigger 和可见性如何消费 Condition，分别见 [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]]、[[docs/docs-829/06-wiki/40-engine/visibility-stats-extra]]。

## GameNum：组织产出并按需计算

GameNum 是带类型的产出节点树（例如常数、表达式、求和、相乘、拥有状态、区修饰和 Affector flow）。`GameNumSystem.buildAll()` 按已登记资源、Spot、Area、Init 和 Affector 定义构建树；`evaluateResourceGain()` 从资源根节点开始递归求值。节点会保留缓存，未变化时可复用已算结果；这是一种按需（懒）计算，不是每次 Tick 都重建整棵树。

树中表达式读取资源时会记录依赖。`StateMutationService` 写资源后发 `resourceChanged`；GameNum 订阅相关事件，把受影响节点标脏，之后下次求值才重新计算。Spot / Enhancement / Affector 等结构或定义变化也会让对应产出失效或重建。事件是失效通知；重新计算发生在之后调用查询时。

`evaluateWithBreakdown()` 返回总值和节点贡献明细，可供检查产出来源；`buildZoneNode()` 按实体、类别与资源查询区修饰。示例数值组合见 `tests/engine/game-num.test.ts`；资源变化后的新读值与定向失效见 `tests/engine/game-num-invalidation.test.ts`；热更新 Spot 索引见 `tests/engine/game-num-hot-spot.test.ts`。

## 关系路线与边界

静态导入路线：`game-num.ts` 使用 ValueSystem、Registry / Affector 查询契约和事件类型。运行时调用路线：TickSystem 调用 `evaluateResourceGain()`；状态变更事件仅令缓存失效；后续求值才消费最新状态。生产如何把结果入账：[[docs/docs-829/06-wiki/40-engine/tick-session]]。契约怎样被产品 Runtime 注入：[[docs/docs-829/06-wiki/40-engine/core-contracts]]。返回 [[docs/docs-829/06-wiki/40-engine/00-index]]。
