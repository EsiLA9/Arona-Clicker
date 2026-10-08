# 03-data-structures/registry — Registry 表与索引

本文回答 Registry 保存哪些声明表、身份如何组织，以及查询索引如何对应主表。

Registry 可以理解为运行时的“内容目录”：包管理层把已启用的 Datapack 按顺序交给它，Registry 校验后把定义放进按 ID 查询的表里。它不负责读取文件、决定启用哪些包，也不保存玩家游玩进度；包流程见 [[docs/docs-829/06-wiki/20-data-services/datapack-flow]]，玩家进度见 [[docs/docs-829/03-data-structures/player-state]]。

Registry 的主数据以 Map 按定义 ID 保存；`Registry.load()` 根据 `Datapack` 契约逐表合并。必需表由 `Datapack` 声明为数组，可选表在未声明时按空表处理。完整表清单以 `src/data-services/registry/registry.ts` 的 `tableSteps` 和字段为准。

## 定义表

主表涵盖世界定义（Init、Area、Spot）、角色及变体、物品与增强、剧情及入口、商店、抽卡、掉落、触发与 Affector、色彩、成长配置、标签表现、资源显示、角色资料、图片、成就与里程碑等。表值仍使用各自的 Def 契约；本页不重复字段表，见 [[docs/docs-829/03-data-structures/datapack-contracts]]。

多包加载时相同 ID 的后加载定义会覆盖 Map 中的值；这属于 Registry 合并实现，不等同于任意跨包引用均有效。被覆盖 Spot 的来源和关系索引会先移除再登记。

## 所有权与辅助索引

Registry 记录 Init、Area、Spot 的来源 `modName`，Spot 还维护标签所有权。Area→Spot 与 Init→Area 索引支持按父项查询；Spot 标签索引把分层 Tag 的声明路径展开到前缀，以支持父标签匹配。图片表以完整图片 ID 为主键，另有按 kind 的索引。上述索引由表写入路径维护，应与主表一同更新。

Spot 支持受控的 create、replace、delete、suspend、resume 操作，返回可回滚 receipt；操作会维护 Area、Tag 索引及来源信息。Init 与 Area 也有各自的 mutation API。具体校验和状态转换见源码 `registry-*-mutation.ts`，以及 [[docs/docs-829/06-wiki/20-data-services/registry]]。

## 校验上下文

`validateDatapack(dp)` 检查包内重复 ID、ID 形态和引用。Init→Area、Area→Spot、Spot→Area 等引用用当前 Registry 加当前包定义组成上下文；但 `Area.defaultSpots` 当前只在本包的 Spot 表中查找，不能用它表达跨包目标。`Registry.load()` 在合并前调用该校验；显式 `Registry.validate()` 用于不提交内容的校验。完整启用集会按加载顺序让已有定义进入后续包校验上下文，但这不改变上述 `defaultSpots` 的包内检查规则。

## 路由

- 契约与可选表：[[docs/docs-829/03-data-structures/datapack-contracts]]
- 包合并行为：[[pack-loading]]
- Spot/Area/Init 查询与协作：[[docs/docs-829/06-wiki/20-data-services/registry]]

## 从哪里核对

- `src/data-services/registry/registry.ts`：`Registry.load()` 校验后登记定义；`merge()` 通过共享的 `tableSteps` 合并各表；`clear()` 使用相同步骤清空；`validate()` 只校验、不提交。
- `tests/engine/registry.test.ts`：`should build relationship indices` 验证 Init→Area、Area→Spot 查询索引；`should merge multiple datapacks` 验证多包合并；`should reject duplicate IDs`、`should reject broken references` 验证拒绝条件。
- `tests/data/registry-spot-mutation.test.ts`：覆盖 Spot 的受控新增、替换、删除与索引/来源维护。Map 的后载覆盖规则与运行时内容目录不是同一套入口。
