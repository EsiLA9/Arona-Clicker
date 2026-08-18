# 1. 基础数值

## 1.1 GameNum
基础的连携数值系统。

## 1.2 Condition
分为原子判断与复合判断，以及等于、不等于、大于、小于、大等于、小等于等判断模式。
只提供判断的结构与行为，具体进行判定需要 EventBus/Trigger 进行执行。

# 2. 引擎结构

## 2.1 EventBus
游戏的数值发生变动后，立即在 EventBus 上通知 `valType,valObj,value`
对 `valType` 与 `valObj` 感兴趣的 `trigger` 会检查条件并触发。这些触发应该被包装好，不允许被数据包编辑者观察。

## 2.2 Effect
Effect 是物品被持有/激活时的效果组。

## 2.3 Funclet

# 3. 数据结构
