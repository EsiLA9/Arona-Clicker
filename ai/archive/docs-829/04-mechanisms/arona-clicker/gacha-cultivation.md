# 04-mechanisms/arona-clicker/gacha-cultivation — 招募与培养

本文归纳当前实现的角色获取和成长路径：抽卡服务负责结算编排，mutation 实现负责写入，培养系统提供曲线推演和验证。更广义角色成长规划不属于本页事实。

这里的卡池定义“可抽哪些角色以及如何计算结果”；pity（保底计数）记录连续抽取进度；培养则把经验或碎片转换为已拥有角色的等级、星级等进度。抽取规则来自当前已装入 Registry 的内容，长期拥有状态仍归玩家状态。

## 抽卡

`GachaService` 从 Registry 查询卡池与差分，按池模式执行抽取。当前注册的实现包含 `ba-classic`：按 rarity weight 抽稀有度，再在该稀有度候选中处理 featured 权重；卡池 pity 到阈值时可保证首个 featured 成员。可抽成员由查询回调决定。

每抽先检查余额，不足时停止并返回 `insufficient-currency`；成功则扣费、抽取、更新 pity 与 pulls，再通过 mutation port 获得差分及重复补偿。完成或停止时发出 `gachaResolved`。服务可注入 RNG，便于确定性验证。

## 培养

`cultivate-system.ts` 提供曲线解析、有效等级上限、经验推演和突破校验。缺少曲线时使用默认曲线（等级上限 10、逐级线性经验、无突破）。有效等级上限是曲线 maxLevel 与可选账号上限的较小值。经验按级逐步消耗，达到上限后剩余经验归零。

突破校验要求差分已有进度、曲线包含突破配置、尚未达到星级上限，并检查该差分自己的碎片余额。实际资源和角色进度写入由 `StateMutationService` 的角色进度操作完成。

通讯录选择已持有学生后，角色页提供简易培养：训练每次增加1000经验，交流每次增加15好感经验，均可重复、暂不消耗材料；星级突破使用该Variant自己的碎片。页面显示当前经验/下一等级需求、等级与好感上限、突破消耗，达到上限或碎片不足时禁用相应按钮。经验和好感按「已存经验 + 本次增量」累计跨级，达到上限后剩余经验归零。

培养读模型为 `rosterSystem.cultivationOf(state, variantId)`，仅已持有且定义存在时返回只读视图；上限、需求和突破结果复用领域曲线与校验。UI命令经 `GameCommands.addExp/addAffectionExp/breakthroughStar` 写入现有mutation，未新增持久字段。普通培养点击仅更新培养区数值、按钮禁用与对应联系人等级，保留页面、按钮和滚动宿主。

专用演练场的「当前持有」来源在下次预览时读取最新培养；已确认入场快照和场景切片不随此后培养改变，见 [[ai/archive/docs-829/04-mechanisms/arona-clicker/variant-translation]]。

Roster、碎片、卡池计数是否按 Init 隔离，由 Registry 的 character scope 和 `PER_INIT_FIELD_SPECS` 决定；角色跨线记忆另存 `characterMemory`。

## 主要验证

当前对应测试包括 `tests/engine/gacha-service.test.ts`、`cultivate-system.test.ts`、`character-cultivation-query.test.ts`、`affection-system.test.ts` 以及 `tests/ui/character-cultivation.test.ts`。后者覆盖真实培养写入、转译更新/冻结与DOM连续性。

主要实现入口：`src/arona-clicker/services/economy/gacha-service.ts`、`cultivate-system.ts` 与 `src/arona-clicker/state/state-mutation-service.ts`。玩家角色字段和跨 Init 归属见 [[ai/archive/docs-829/03-data-structures/player-state]]；用户可见的角色获取/成长路线见 [[ai/archive/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth]]。
