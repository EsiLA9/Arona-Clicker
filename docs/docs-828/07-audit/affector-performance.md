# 07-audit/affector-performance — Affector / GameNum 性能热点

本文回答：当前源码中 Affector → ConditionDepIndex → GameNum/flow → Tick 链上的性能判别，哪些是真实实现问题，哪些只是随规模增长的风险。

## 结论摘要

| 优先级 | 已确认问题 | 当前结论 |
| --- | --- | --- |
| P1 | ZoneModifier 按 source 删除时扫描全部 tag/entity effect 表 | 真实；优先建立 source → records 索引 |
| P1 | 每个 `affectorFlows` 节点重新扫描 active instances、entries、flows | 真实；优先建立 `(resource, mount)` flow 索引 |
| P1/P2 | Affector 一次变化可能触发多次 GameNum 重同步 | 真实；需要显式 coalesce，EventBus 当前不会自动去重 |
| P2 | active 实例数组复制、entry `includes()`、ConditionDepIndex 删除/Extra 扫描、tag 失效过宽 | 真实但通常随规模放大 |
| P3 | ConditionGroup 失去短路、Enhancement/Story 线性查询 | 真实的微优化，暂无瓶颈证据 |
| P2/P3 | Effect map/filter/spread 与 perTickEffects 事件链 | 分配事实真实；事件风暴取决于内容与订阅规模 |

完整的逐条证据、紧迫性定义、代码落点和施工顺序见 [[docs/plan-work/active/task-0034-affector-performance-review]]。

## 边界

- 本次为静态复杂度核验，不是 profiler 结果；不宣称当前内容规模下的 CPU/GC 占比。
- `TagEffectRecord` 注释中“按 source O(k)”描述的是目标语义，当前实现仍由 `removeTagEffectsBySource()` 扫描全局表。
- `spotLevelChanged` 当前只有 `newLevel`；若要把 tag 失效收窄到 0↔正数边沿，必须先补充旧值或等价边沿信息。
- 任何优化必须保持事件驱动失效、StateMutationService 单一写入口和 UI 只读边界。

## 当前状态

静态核验完成，整改未开始。后续应先为 source 删除、flow 索引和事件合并增加行为等价测试及可控规模计数基准，再施工。
