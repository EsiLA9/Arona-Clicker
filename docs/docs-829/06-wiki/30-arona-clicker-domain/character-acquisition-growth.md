# 06-wiki/30-arona-clicker-domain/character-acquisition-growth — 角色获得与成长

本文说明抽卡与培养功能在领域服务中的协作关系，不把未来成长规划描述为当前能力。

角色“存在于内容中”与“已被玩家拥有”是两件事：角色、角色差分、卡池和培养曲线来自 Registry；玩家是否持有及其等级、碎片和卡池计数等记录在 PlayerState。通讯录查询、抽卡结算、培养计算分别由不同服务负责。

卡池定义由 Registry 提供，GachaService 根据池模式、费用、概率、保底和可抽成员执行逐抽结算。成功结果交给 mutation port 更新资源、角色持有状态、重复补偿和卡池计数。角色成长则读取差分定义与培养曲线；培养系统先推演经验或校验突破，状态写入由集中 mutation 实现完成。

Roster 和碎片等字段的生命周期可能受 Init scope 配置影响；角色记忆字段独立跨 Init 保留。当前详细算法见 [[gacha-cultivation]]，完整状态定义见 [[docs/docs-829/03-data-structures/player-state]]。

从一次获得流程看，`GachaService.roll()` 按卡池和模式逐抽；每抽先确认资源足够，再扣费、按规则选择角色差分、通过 mutation 获得角色并更新保底/抽数。资源不够时停止，但保留已经完成的部分抽取结果。`RosterSystem` 只查询持有/差分与可见通讯录分组。

培养计算本身由 `cultivate-system.ts` 的 `applyExp()`、`checkBreakthrough()` 等纯函数推演或检查；`StateMutationService.addExp()`、`breakthroughStar()` 负责把通过检查后的结果写入状态并更新资源/碎片。不要把“能够算出效果”误当成“已经写进 PlayerState”。角色哪些状态跨 Init 保留，按 Registry 的角色存档 scope 决定，见下方测试与状态页。

## 从哪里核对

- `src/arona-clicker/services/economy/gacha-service.ts` 的 `GachaService.roll()`：抽取、扣费、角色获得与计数；`src/arona-clicker/state/state-mutation-service.ts` 的 `acquireCharacter()`、`addExp()`、`breakthroughStar()`：持久状态写入。
- `src/arona-clicker/services/character/roster-system.ts` 的 `getOwned()`、`contactGroups()`：只读持有和通讯录查询；`src/arona-clicker/services/progression/cultivate-system.ts` 的 `applyExp()`、`checkBreakthrough()`：纯计算/校验。
- `tests/engine/gacha-service.test.ts` 覆盖资源不足拒绝、天井计数、重复抽取补偿和部分十连；`tests/engine/cultivate-system.test.ts` 覆盖等级上限、跨级经验、碎片不足/足够与变体碎片隔离。
- `tests/engine/character-persist.test.ts` 覆盖 roster、gacha 和装备状态按配置进入 global 或 Init 快照。持有状态字段说明见 [[docs/docs-829/03-data-structures/player-state]]。
