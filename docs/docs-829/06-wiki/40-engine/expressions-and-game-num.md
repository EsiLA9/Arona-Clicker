# 06-wiki/40-engine/expressions-and-game-num — 求值与产出树

Value 和 Condition 从当前状态求值，GameNum 将资源产出声明构造成可失效、可解释的派生树。

## 声明求值

`ValueSystem` 递归处理常数、Value source、算术、取整与 clamp。source evaluator 从 ValueState 或注入服务读取资源、Spot 等级、Extra、Funclet 等值；未知 source 与缺失定义返回 0。`ConditionSystem` 把 ConditionTarget 转换为实际数值，再用 Comparator 比较；ConditionGroup 递归短路计算 AND/OR。统计、Story、Tag、Extra、好感等读取器通过 setter 注入。

## GameNum 产出结构

`GameNumSystem` 是门面，构树、求值和失效分别位于 `game-num-build.ts`、`game-num-eval.ts` 与 `game-num-tag.ts`。资源基础产出、Spot、Area、Init 分层聚合，区加成与 Affector flow 可加入相应节点。表达式资源依赖被扫描并用于资源变化后的定向失效；Spot/定义/Tag/Affector 等事件也驱动重建或标脏。

可以通过 `evaluateWithBreakdown()` 取得贡献明细；区节点由 `buildZoneNode()` 按实体、类别与资源查询。`tests/engine/game-num.test.ts` 覆盖 flat/multiplier 组合、来源撤销、Affector 区效果与分解贡献；`game-num-invalidation.test.ts`、`game-num-hot-spot.test.ts` 覆盖缓存失效及热定义更新。

## 代表性协作

静态上，GameNum 依赖 ValueSystem、Registry 查询端口和 Affector 查询端口。运行时，Affector 状态改变后其区修饰/flows 同步进 GameNum；状态资源变化使相关求值节点失效；Tick 再按资源读取当前产出。静态依赖图不表示每次产出都重新构建全树。

[[docs/docs-829/04-mechanisms/engine/production]] · [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]] · [[docs/docs-829/06-wiki/40-engine/00-index]]
