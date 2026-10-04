# 06-wiki/30-arona-clicker-domain/character-acquisition-growth — 角色获得与成长

本文说明抽卡与培养功能在领域服务中的协作关系，不把未来成长规划描述为当前能力。

卡池定义由 Registry 提供，GachaService 根据池模式、费用、概率、保底和可抽成员执行逐抽结算。成功结果交给 mutation port 更新资源、角色持有状态、重复补偿和卡池计数。角色成长则读取差分定义与培养曲线；培养系统先推演经验或校验突破，状态写入由集中 mutation 实现完成。

Roster 和碎片等字段的生命周期可能受 Init scope 配置影响；角色记忆字段独立跨 Init 保留。当前详细算法见 [[docs/docs-829/04-mechanisms/arona-clicker/gacha-cultivation]]，完整状态定义见 [[docs/docs-829/03-data-structures/player-state]]。
