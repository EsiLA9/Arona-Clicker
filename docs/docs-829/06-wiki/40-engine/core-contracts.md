# 06-wiki/40-engine/core-contracts — Engine 的协作端口

Engine 子系统依赖最小状态与服务端口，由 Runtime 装配为可协作的游戏运行时。

## 静态依赖关系

`src/engine/contracts/` 把核心算法需要的外部能力收敛成类型接口，例如读取状态、注册定义、解析条件、写入变更或消费运行时效果。实现无需依赖完整产品 Runtime。`src/engine/index.ts` 是面向调用方的聚合导出；`types/` 与 `contracts/` 分别提供声明形状与协作能力。

## 运行时组合

在 AronaClicker 中，GameInstance/wiring 创建并连接 ValueSystem、ConditionSystem、EffectEngine、TriggerSystem、AffectorEngine、GameNumSystem、VisibilityEngine、StatsService 与 TickSystem。实际连接点和状态源可能随宿主而异，因此组件能力应由注入契约确认，不应仅由类名推断。

事件总线提供跨系统通知。订阅者处理自己关心的事件并更新索引、缓存或响应规则；它不是状态本身，也不能代替 mutation port。查询端口保持窄小的测试可组合性由 `tests/engine/engine-contracts.test.ts` 验证。

## 继续阅读

[[docs/docs-829/03-data-structures/engine-contracts]] · [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]] · [[docs/docs-829/06-wiki/40-engine/00-index]]
