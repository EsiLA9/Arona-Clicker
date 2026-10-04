# 03-data-structures/datapack-contracts — Datapack 契约

本文回答 Datapack 如何汇总内容定义、哪些表可选，以及契约与运行时定义表的关系。

`src/data-services/contracts/datapack.ts` 的 `Datapack` 是内容包的聚合接口。它将世界、角色、剧情、物品、经济与成长、抽卡、色彩、标签、图片及运行时规则等 Def 数组放在同一声明对象中；每项字段类型拆在 `contracts/` 下独立文件，规则类类型可引用 Engine 契约。

## 必需与可选

`name`、`version`、`inits`、`areas`、`spots`、`enhancements`、`activeStories`、`passiveStories`、`stories`、`items`、`funcletDefs`、`characters` 为必需字段。`modName` 可选，Registry 对缺省值采用 `base`。其他以 `?` 标注的表或配置是可选，例如被动池、掉落表、角色变体、培养曲线、商店、图片、Extra 和各系统配置。必需只表示聚合对象的结构约束，不保证定义引用在单包内闭合。

## 身份与引用

多数实体使用 `modName:typeName:idName` 三段式 ID；段字符集及已登记的 `typeName` 由 `parseEntityId` / `validateEntityId` 核验。`modName` 是包默认命名空间提示，解析器从 manifest 写入该字段；缺省包使用 `base`。Tag 有独立命名空间规则，图片定义使用 `mod:type(pic):id` 形式，Extra 是扁平路径到值的映射。

字段名带 `Id` 不足以判断它怎样生效：有些字段会查 Registry 并读取目标 Def 内容，有些只按字符串比较身份、归属或玩家状态键；各字段的加载期校验也不完全相同。追查某个引用时同时看契约、校验与运行时消费方，不能把 ID 格式合法推导为目标存在或引用已接线。解析与表索引入口见 [[docs/docs-829/03-data-structures/registry]]。

契约描述形状，不独立实现全局唯一性、依赖关系或跨表引用的闭合验证。单包结构与局部引用由 `validateDatapack` 检查；跨包目标和运行时依赖须结合完整启用集验证。加载顺序、覆盖及应用见 [[docs/docs-829/04-mechanisms/data-services/pack-loading]]。

## 表与消费边界

Registry 为各契约表建立查询集合；内容作者策略则限定哪些表和字段可由通用编辑 API 修改，并声明编码、默认值与消费者。契约存在某字段不意味着它支持局部 mutation，也不意味着某 UI 已消费它。需区分：声明数据、Registry 物化、领域或 Engine 消费、作者入口授权。

### Gameplay B Operation 表

Datapack 可选声明 `operationEvents`、`operationLocations`、`operationActions` 和 `studentOperationProfiles`。四类顶层定义分别使用 `operation-event`、`operation-location`、`operation-action`、`student-operation-profile` 三段式 ID；跨表引用写完整 ID。SceneAction、RouteEdge、Objective、Outcome、CombinationRule、SceneCard、Actor 等仍嵌入 Event 或 Location，并在所属内容范围内使用局部 ID。

Operation Event 用 `locationIds` 关联 Location、用 `initId` 归属 AC 世界线，并声明正整数 `resumeVersion`。它是作者显式维护的恢复兼容号，不由 Registry 计算内容 Hash。RouteEdge 只能检查 Event 声明的单个局内持有物；谓词只检查 Event 的 track/fact。Registry 在 `validateDatapack` 阶段对同包与已加载 Registry 的引用进行检查，随后通过统一表步骤合并、覆盖及清空。

这些字段会进入生成的 `engine-defs.gen.json`，但本阶段不添加 Operation 专属编辑器表配置；独立作者工作流分别由任务 [[task-0221-gameplay-b-authoring-and-content-validation-workflow]] 接续。

详细协作路由见 [[docs/docs-829/06-wiki/20-data-services/definition-authoring]]；总入口见 [[docs/docs-829/06-wiki/20-data-services/00-index]]。
