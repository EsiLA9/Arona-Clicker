# Draft：装备效果声明的运行消费边界

状态：draft — Task 0168 已完成静态消费者调查；运行接入语义待裁定

## 目标与当前边界

明确 Gear 与 ColorEquipment 的效果声明如何成为玩家可观察的结果。调查由 [[task-0168-active-artifact-cleanup-and-map-reconciliation]] 的 A07 发起；本 Draft 保存独立机制问题，不将资料清理扩大为效果结算改造。

## 已核实事实（2026-10-01）

| 当前事实 | 实际依据 | 意义 |
| --- | --- | --- |
| GearSystem.effectsOf 聚合已装备槽位的 tier baseEffects 与 perLevelEffects，并返回 Effect 数组。 | src/arona-clicker/services/gear-system.ts；tests/engine/gear-system.test.ts | 已实现的查询能力，尚不证明运行时应用效果。 |
| ColorEquipmentSystem.effectsOf 返回所装备色彩装备的 effects。 | src/arona-clicker/services/color-equipment-system.ts；tests/engine/color-equipment-system.test.ts | 色彩装备效果也具有可读取的声明。 |
| 对 src、tests、tools 的 effectsOf / resolveTierEffects / baseEffects / perLevelEffects 等静态搜索，仅发现这些方法的定义、声明和测试调用，未发现生产调用这些效果查询的方法。 | 上述源码、查询契约与搜索结果；调查未运行浏览器或做动态追踪 | 这是静态消费者缺口，不能证明不存在任意动态访问，更不能删除整个装备系统。 |
| 默认色彩装备描述包含“信用点获取 +1/+2/+3”等文字，定义中保存 addResource 效果；默认 Gear tier 也保存示例效果。 | src/arona-clicker/content/color-equipments.ts；src/arona-clicker/content/gears.ts | 内容文字可能产生收益已生效的预期，需要单独裁定或验证。 |
| 通讯录读取 gearSystem.viewOf；装备成长、状态与色彩外观仍有当前消费者。 | src/ui/components/contacts.ts；src/arona-clicker/services/gear-system.ts；src/arona-clicker/services/color-equipment-system.ts | 保留现有查询和定义，不能用局部效果缺口判定整套数据无用。 |

## 待裁定事项

- 效果声明是保留的查询能力、一次性装备事件效果，还是持续收益贡献？触发时机、重入/卸下/Init 切换和防重复应用边界必须先确定。
- 若继续保留尚未消费的示例声明，是否调整内容说明以准确反映已实现行为？这属于内容语义改动，另立可验收 Task 后执行。
- 若接入运行时，应先确定 StateMutationService、Trigger / Affector 的责任和相应测试，再实施；不能直接在每 Tick 重复应用 addResource 来补上缺口。

## 本轮决定与下一步

保留两类效果查询和装备数据，记录“未发现当前生产消费者”的边界。Task 0168 的静态调查已完成，本 Draft 尚未批准运行接入、效果删除或内容改写。后续围绕上述触发语义裁定，再建立独立 Task。

## 相关路由

- [[task-0168-active-artifact-cleanup-and-map-reconciliation]]
- [[docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth]]
- [[docs/docs-829/06-wiki/50-ui/presentation-theme]]
