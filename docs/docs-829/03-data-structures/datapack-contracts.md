# 03-data-structures/datapack-contracts — Datapack 契约

本文回答 Datapack 如何汇总内容定义、哪些表可选，以及契约与运行时定义表的关系。

可以把 Datapack 理解为“一组告诉游戏有哪些内容的声明”。它本身不是玩家存档，也不会因为类型里有一张表就自动让游戏功能使用该表；后续还要经过加载校验、Registry 登记，并由运行时服务读取。整体包流见 [[docs/docs-829/06-wiki/20-data-services/datapack-flow]]。

`src/data-services/contracts/datapack.ts` 的 `Datapack` 是内容包的聚合接口。它将世界、角色、剧情、物品、经济与成长、抽卡、色彩、标签、图片及运行时规则等 Def 数组放在同一声明对象中；每项字段类型拆在 `contracts/` 下独立文件，规则类类型可引用 Engine 契约。

## 必需与可选

`name`、`version`、`inits`、`areas`、`spots`、`enhancements`、`activeStories`、`passiveStories`、`stories`、`items`、`funcletDefs`、`characters` 为必需字段。`modName` 可选，Registry 对缺省值采用 `base`。其他以 `?` 标注的表或配置是可选，例如被动池、掉落表、角色变体、培养曲线、商店、图片、Extra 和各系统配置。必需只表示聚合对象的结构约束，不保证定义引用在单包内闭合。

## 身份与引用

多数实体使用 `modName:typeName:idName` 三段式 ID；段字符集及已登记的 `typeName` 由 `parseEntityId` / `validateEntityId` 核验。`modName` 是包默认命名空间提示，解析器从 manifest 写入该字段；缺省包使用 `base`。Tag 有独立命名空间规则，图片定义使用 `mod:type(pic):id` 形式，Extra 是扁平路径到值的映射。

字段名带 `Id` 不足以判断它怎样生效：有些字段会查 Registry 并读取目标 Def 内容，有些只按字符串比较身份、归属或玩家状态键；各字段的加载期校验也不完全相同。追查某个引用时同时看契约、校验与运行时消费方，不能把 ID 格式合法推导为目标存在或引用已接线。解析与表索引入口见 [[docs/docs-829/03-data-structures/registry]]。

契约描述形状，不独立实现全局唯一性、依赖关系或跨表引用的闭合验证。单包结构与局部引用由 `validateDatapack` 检查；跨包目标和运行时依赖须结合完整启用集验证。加载顺序、覆盖及应用见 [[pack-loading]]。

## 表与消费边界

区域导航使用可选 areaMaps 表与 AreaDef.navigationMapId，独立于 Gameplay B maps。局部节点与连线不拥有 Area，也不决定可达性；最终启用集需调用 Registry.validateAreaMapRefs。定义、引用校验与只读消费见 [[docs/docs-829/04-mechanisms/arona-clicker/area-map-navigation]]。

区域导航使用可选 areaMaps 表与 AreaDef.navigationMapId，独立于 Gameplay B maps。局部节点与连线不拥有 Area，也不决定可达性；最终启用集需调用 Registry.validateAreaMapRefs。定义、引用校验与只读消费见 [[docs/docs-829/04-mechanisms/arona-clicker/area-map-navigation]]。

Registry 为各契约表建立查询集合；内容作者策略则限定哪些表和字段可由通用编辑 API 修改，并声明编码、默认值与消费者。契约存在某字段不意味着它支持局部 mutation，也不意味着某 UI 已消费它。需区分：声明数据、Registry 物化、领域或 Engine 消费、作者入口授权。

### Gameplay B Operation 表

Datapack 可选声明 `operationEvents`、`operationLocations`、`operationActions`、`studentOperationProfiles`、`operationStrategyProfiles` 和 `operationCardPools`。六类顶层定义分别使用 `operation-event`、`operation-location`、`operation-action`、`student-operation-profile`、`operation-strategy-profile`、`operation-card-pool` 三段式 ID；跨表引用写完整 ID。SceneAction、RouteEdge、Objective、Outcome、CombinationRule、SceneCard、Actor 等仍嵌入 Event 或 Location，并在所属内容范围内使用局部 ID。

Operation Event 用 `locationIds` 关联 Location、用 `initId` 归属 AC 世界线，并声明正整数 `resumeVersion`。`title` 与 `description` 是可选的事件入口名称和简短介绍，供通用入口与运行区显示。`resumeVersion` 是作者显式维护的恢复兼容号，不由 Registry 计算内容 Hash。Event 可声明成功/部分成功的白名单资源奖励；Operation Actor 可提供可选展示名与头像引用，运行时会把它们冻结到 Run。每个 Operation Location 必须声明 `stage: combat | scene`；UI 从 Runtime View 消费当前地点阶段，不根据地点 ID 或 `PreparedBeat` 是否存在推测。RouteEdge 只能检查 Event 声明的单个局内持有物；谓词只检查 Event 的 track/fact。Registry 在 `validateDatapack` 阶段对同包与已加载 Registry 的引用进行检查，随后通过统一表步骤合并、覆盖及清空。

Location 可声明有序 `scenes`；每个 Scene 可独立声明 `actionMode`、批次数、`sceneActions`、`sceneActionChoice` 和 `purchaseOffers`。`sceneActionBatches` 缺省表示不设批次数上限，显式值仍须是 1–10 的正整数。未声明 Scene 序列时，旧 Location 批次字段投影为隐式 `main` Scene。`sceneActionChoice` 以唯一的 Global required SceneAction ID 列出 M 个候选，并用 `chooseExactly` 声明 N；Runtime 强制每批恰好选择 N 项，fixed 项在普通提交中自动纳入且不计数，显式 `skip: true` 则不执行任何固定或可选 SceneAction / SceneCard。此 V1 规则不把玩家物理卡或购买项纳入 M/N。无上限 SceneAction 必须有至少一项 Location primary objective、partial outcome、failure condition 或 Event hard failure 出口；secondary objective 只计额外目标进度，不单独完成 Location。内容校验只拒绝明显没有出口的定义，不静态推断复杂条件是否可达。Scene completion 仍不自动完成 Location。

Combat Location 的 `maxBeats` 可缺省；缺省不设 Beat 上限，显式正整数仍是该 Location 的最高 Beat 数。若 combat Location 未声明 primary objective、partial outcome 或 failure condition，Runtime 会以当前 Location / Scene 启用的对手 Participant 候选行动所对应的存活 opponent 清场作为通用完成出口；secondary objective 不阻止该清场出口。若声明了 Location 结果条件，则仍由这些条件决定完成结果。Event hard failure 条件仍优先终止 Run。无上限循环由每次单独的 Commit 推进，Runtime 不在一次命令里自动重复结算。

`purchaseOffers` 是 EventRun 内的一次性效果 Offer，不是 `ShopDef` / Spot Shop。每项声明 Location/Scene-local Offer ID、引用既有 targetless Operation Action、非负共享 PlayerCost、Event 已声明且初始未记录的 `purchaseFactId`，以及可选标题/说明。引用 Action 至少含一个 Event Track / Fact / HeldItem 奖励 Effect，不能含 Action cost 或其它 Effect 类。purchase Fact 由 Offer 在同一 Resolution 写入并保留到 Run/checkpoint 结束；它与奖励 HeldItem 分开，且不能被 Action、StudentSkillRule 或 CombinationRule 效果改写。Registry 与 Operation Runtime admission 都校验候选基数、Offer/Fact 唯一性与引用闭合；编辑字段后仍需同步 Schema 并验证完整 pack。

`OperationActionDef.target` 是目标规则的唯一来源。Actor target 可选择 `selectionMode: 'select' | 'all-eligible'`，并用 `relation`、`allowedActorIds`、`allowedActorTypes` 与 `allowedPositionIds` 约束候选；所有声明的过滤相交。`selectionMode` 省略时为 `select`。`all-eligible` 仅供 Scene batch，Runtime 按提交时的存活状态和当前位置解析当前全组，空组不可提交；`targetActorIds: []` 本身不表达群体。显式 `select` ID 若因死亡或换位失效，Runtime 拒绝整个批次，不静默换目标或留下部分费用 / 效果。actorless Scene Action 仍须以 ID/type 建立绝对目标边界，Position 只缩小该边界，不能单独建立目标关系。

这些 Operation 表字段进入生成的 `engine-defs.gen.json`；`OperationActionDef.target` 当前由 Schema 的通用 JSON 字段呈现，没有 PB-23 专属目标编辑器。源契约变化后运行 `npm run gen:schema` 并检查 Schema 同步测试，禁止手改生成文件。Operation 独立作者编辑器 / 导入导出闭环见 [[docs/plan-work/task-0275-pb-25-scene-authoring-and-validation]]；游戏内 Runtime Editor 与 `ContentAuthoringPolicy` CRUD 仍是不同入口。

详细协作路由见 [[docs/docs-829/06-wiki/20-data-services/definition-authoring]]；总入口见 [[docs/docs-829/06-wiki/20-data-services/00-index]]。

## 从哪里核对

- 聚合类型：`src/data-services/contracts/datapack.ts` 的 `Datapack`；各表字段继续看对应契约文件，不在本页复制完整类型。
- 校验和登记：`src/data-services/registry/registry.ts` 的 `Registry.load()` 会先调用 `validateDatapack()`，再按表步骤合并。合法 ID 不代表目标已存在，具体引用范围也由校验逻辑决定。
- 测试证据：`tests/engine/registry.test.ts` 的 `should load a valid datapack`、`should reject duplicate IDs`、`should reject broken references` 覆盖装载、重复 ID 与缺失引用。这里没有把所有可选表的每个字段逐项列出。
- 维护边界：字段语义以契约和对应机制为准；通用编辑允许范围见 [[docs/docs-829/06-wiki/20-data-services/definition-authoring]]，结构索引见 [[docs/docs-829/03-data-structures/registry]]。
