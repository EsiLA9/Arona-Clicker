# Task 0312 E1 handoff 状态

状态：superseded — 2026-10-22 较早交接中的“从 U12C 开始”与旧 Action 数组示例，已被后续实际施工结果取代。请以 [[docs/plan-work/task-0312-gameplay-b-effect-program-v1]] §9、[[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]] 和当前机制文档为准；本页不再作为续施工指令。

## 当前状态

- Task 0312 阶段施工按用户指示关闭。U18 宽屏和完整纵向验收被豁免，未运行 U18 测试、未操作浏览器，也没有截图；这不代表 E1 产品验收通过。
- U12C、U13–U17 与 U19 后续均已完成并有对应 Receipt；U18 仍是用户豁免项。0312 当前没有待续 Unit。
- Task 0315 已完成内置 Map 与作者示例迁移，移除 Map Action 的旧 `effects` / `hpEffects` / `cardEffects` 合同和兼容执行；增加的 `damage` / `heal` 与 E1 AST 保留的 `hpChange` Program 节点并存。Shop Offer `effects` 保持独立。

## 当前作者入口与证据

- 作者合同：[[docs/docs-829/03-data-structures/datapack-contracts]]。
- 可加载示例：[[docs/examples/gameplay-b-effect-program-e1]]。
- 逐 Action 迁移矩阵：[[docs/plan-work/task-0315-units/receipts/task-0315-u04-receipt]]。
- 旧字段拒绝与生成 Schema：[[docs/plan-work/task-0315-units/receipts/task-0315-u10-receipt]]。

如果以后要补做 E1 产品验收，应按当前源码另立明确范围；不要按本页旧停点恢复 U12C，也不要把阶段豁免当成验收证据。E1 U18 已豁免且排除在后续范围外；AG-1 已批准合同的实施与 E2–E5 未完成能力统一登记于 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]，不再分散路由。
