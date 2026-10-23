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

### Gameplay B Map 与 E1–E5 效果程序

`Datapack.maps` 是可选的 `GameplayMapDef[]`。Map 使用局部 Node、Action、Encounter 与 Activity 声明，并以作者维护的 `resumeVersion` 标识存档兼容边界；修改会影响活动中 MapRun 的动作、目标、费用、效果、初始 HP 或资源规则时，应提高该版本。完整字段以 `src/data-services/contracts/gameplay-map.ts` 为准。

每个 Map Action 只通过 `effectProgram` 声明作者效果。`prepare` 用于绑定真实 CardRef 的 sCost 折扣；`resolve` 按列表顺序执行受限的 `damage`、`heal`、AG-1 `revive`、兼容性 `hpChange`、`resourceChange`、Counter、Flag 与 `when`。E1 的 `damage` / `heal` 支持 `target: 'primary'` 和正安全整数；E2 另支持确定性 TargetSet、受限 Value 表达式与每目标 0–8 次 repeat。集合侧别为 party / enemy，默认只选存活单位，可按 HP 比例排序并稳定保留定义顺序平手；最多 32 名，集合解析时固定成员。TargetSet damage/heal 的请求量可读取 source / primary / 当前目标 HP、HP cap、missingHP、Encounter Counter、Round、集合人数和安全整数运算。普通 `heal` 与 `hpChange` 仍不复活。

AG-1 `{ op: 'revive', target: 'primary', amount }` 只复苏倒地 Party Character，`amount` 为正安全整数并截到最大 HP；已存活目标为 no-op。Action target 可为 `{ kind: 'partyCharacter', includeDefeated: true }`，使倒地队友成为合法 `primary` 目标；仅适用于含 Revive 的 AG-1 Action，Enemy 来源拒绝。复苏不改 Shield、Status、费用或资源；同一 Program 后续治疗可继续生效。来源资格在 AG-1 队列实际开始时重验：先前已准备但在本轮倒地、随后被复苏的后序来源可执行；已 skip 的来源不回插。Revive Trace 进入现有 Program Receipt，Restore 重放 HP 和来源顺序，不提升 scheduler / Receipt 格式。作者演练见 [[docs/examples/gameplay-b-revive]]。

历史 E1 `hpChange` 仍是带符号 HP delta 节点；新内容优先使用语义明确的 `damage` / `heal`。Owner 负责 HP 上下限，并在 Receipt / Preview 中保留解析集合、请求量和实际变化。

Map 可在 `statuses` 声明 Map-local 的 `burn`、`regen`、AG-1 `damageReduction` 或 `damageProtection`：burn/regen 每层 HP 数值由 `hpPerStack` 给出；damageReduction 每层固定减伤由 `damageReductionPerStack` 给出；damageProtection 必须显式分类为 `beneficial`，其 `maxStacks` 表示可拦截正伤害命中的次数。不同 Status 不能混用行为字段。可选 `category` 只接受 `harmful` / `beneficial`；缺省表示未分类，不会由 `kind`、名称或 UI 样式推导。AG-1 Status 另可声明 `onExpire: { resourceId, delta }`，delta 必须是正安全整数；资源写入自然到期 Status 的 holder Actor 余额。Registry 遍历所有 `statusApply` 可能持有者，要求各自声明该 Actor 资源。`statusApply` 通过 Action 的 `source` 或单位 `primary` 目标施加已声明 Status，并指定层数与持续轮数；CardRef、Team 和 MapRun 不能作为持有者。Status 身份由持有者、Status ID、Effect Program 来源身份和来源 Action ID 共同确定。同来源重施会在上限内累加层数并刷新持续时间，不同来源分别保存。

AG-1 Map 还可使用闭合 statement `{ op: 'statusRemove', target, statusId }` 清除状态。目标仅为已解析的单位 `source` 或 `primary`，Actorless Ability / Item 只能使用 `primary`；`statusId` 必须精确引用该 Map 已声明的 Status。执行时移除该 holder 上该 ID 的所有活动实例，不按来源身份或 Action ID 过滤；无匹配时成功 no-op，并记录空的删除 Trace。还可使用 `{ op: 'statusRemoveCategory', target, category }` 按 `harmful` 或 `beneficial` 全量清除：只命中目标上定义类别完全一致的 Status，未分类实例保留，倒地目标仍可清理；类别必须在 Map 中至少有一个 Status 声明。两类移除都按 Effect Program 顺序操作 detached Status 列表，因此同轮施加、按 ID 移除、部分消费与类别移除的顺序决定最终状态。移除不改 HP、费用、资源或 MapRun Facts，不产生触发事件，也不复活单位。它们不会改变 E1/legacy 对既有 `statusApply` 的兼容。

Status 只在成功提交的 Encounter 回合边界触发，不依赖 AC Tick。第 N 轮新增实例从 N+1 轮末首次结算；持续时间按成功提交轮次递减。burn / regen 遵守 HP 上限和不复活规则；damageProtection 在 outgoing CardRef Modifier 之后、damageReduction 与 Shield 之前，对存活目标的每个正向 AG-1 damage hit 完整拦截一次并消费一层；damageReduction 在 Shield 之前减免请求量。两种防御 Status 的 roundEnd 均不改 HP、只推进持续时间。普通来源已令 Encounter 终局时跳过 roundEnd tick；否则先完成整批稳定顺序的 Status tick，再按 `statusTrace` 顺序对 `onExpire` 自然到期实例写入 holder 资源。新施加实例同轮不触发；显式移除、层数消费、类别净化、刷新未到期实例和 teardown 不发放回馈；最后一次 Burn tick 可以击倒 holder，但同轮仍照常结算回馈。此事件使用独立 Trigger Receipt v2，与 Action Heal/Damage Trigger 共用 32 次 Commit 预算，按 Action Trigger 后的全局队列顺序保存 trace；不升级 Status Receipt。默认 Encounter-lifetime 活动状态只保留在当前 Encounter，进入或离开时清理；显式声明 `lifetime: 'mapRun'` 的 AG-1 MapRun Status 由 MapRun 根持有，跨 Encounter 与 Shop 保留，仅成功 Encounter roundEnd 推进时长，Run 终止时清除。`statusTrace` 记录轮末状态与 HP 变化；tick 后才终局的 Receipt 保留该轮结算后的历史状态列表供重放，但不会存回活动 Run。AG-1 Status Receipt 按 Map 所含作者语义使用 v1–v7：v2 记录按 ID 清除 Trace，v3 增加部分层数消费 Trace，v4 增加类别移除 Trace，v5 允许伤害减免 Status，v6 允许 damageProtection，v7 记录 MapRun root Status 计划与统一跨 Owner tick Trace；各版本字段集合独立校验，Restore 从 scheduler 起点重新规划并核对，不直接安装 Trace 中的列表。含 MapRun Status 的 Map 使用 scheduler v7；此前 scheduler v5/v6 与 Program Receipt 独立，E1/legacy 继续使用 Status Receipt v1。作者样例见 [[docs/examples/gameplay-b-statuses]]、[[docs/examples/gameplay-b-damage-reduction]]、[[docs/examples/gameplay-b-damage-protection]]、[[docs/examples/gameplay-b-status-expiry-reward]]、[[docs/examples/gameplay-b-maprun-status]]；Status 初始 burn / regen 首片见 [[docs/plan-work/task-0318-gameplay-b-encounter-statuses]]，按 ID 清除首片见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U16-e4-status-cleanse-by-id]]，类别清除合同见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U20-e4-status-category-cleanse-contract]]，伤害减免合同见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U22-e4-round-limited-damage-reduction-contract]]，自然到期回馈见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U26-e4-status-natural-expiry-reward-contract]]，单次受击保护见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U27-e4-one-time-damage-protection-contract]]。

E2 Value 除法向负无穷取整；除零、安全整数越界、负的伤害／治疗量、repeat 越界与超展开预算均拒绝。AG-1 还允许有界随机 TargetSet、有限嵌套 `forTargets`、资源余额 Value／条件以及 MapRun Counter／Flag 顺序读写；效果随机数有独立可保存游标。MapRun Facts 可参与受限条件、写入、静态候选池 gate 和路线 Edge gate；候选池在 Encounter 入场冻结 gate 输入，Edge 在每次移动时读取当前已安装 Facts。恢复仍从 scheduler 起点重算 Encounter 输入；路线门控不增加 Receipt 状态。上述字段仍不接受任意脚本或属性路径，具体限制见对应 Task 与回执。

AG-1 `effectProgram.triggers` 提供闭合的局内结果回馈：`healApplied` / `damageApplied` 仅在 primary Actor 有实际 HP 变化后触发，资源写给该 primary；`enemyDefeated` 仅在 Party Actor 对 Enemy primary 的直接单体 damage 命中使 HP 从正数降为 0 后触发，资源写给来源角色。击败目标与领奖角色分别记录。TargetSet、`forTargets`、Status tick、Shield 全吸收、保护拦截、减伤归零和已倒地目标不产生击杀回馈。Trigger 复用有限 FIFO 与单 Commit 32 次预算，费用与父来源完全结算后才生效；不连接 AC EventBus 或 Tick。独立 Trigger Receipt v1/v2 保持原语义，v3 增加 `enemyDefeated` 身份证据，并可与 Status 自然到期 Trace 同次保存与重放。正式演练见 [[docs/examples/gameplay-b-heal-applied-resource]]、[[docs/examples/gameplay-b-damage-applied-resource]]、[[docs/examples/gameplay-b-actual-amount-threshold]] 与 [[docs/examples/gameplay-b-enemy-defeated-reward]]；合同见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U29-e5-single-hit-defeat-reward-contract]]。

`when` 可读取当前 HP／比例、Encounter Counter／Flag、MapRun Counter／Flag、资源余额阈值和 E5 `preparedTagCount`；来源余额条件按来源开始时的工作余额求值，MapRun Facts 在同一 detached 顺序计划中读到此前语句的写入。`preparedTagCount` 的 V1 side 为 `party`：它在整轮计划前从每名角色的有效 `preparedActionId` 冻结一次，已选 PlayerCommand 计入，Wait、未选命令候选、Ability／Item、Enemy Intent 与 UI 重复呈现排除。每个准备来源最多计一次，Tag 按完整 TagRef 的同 namespace 层级前缀匹配；该快照在后续来源执行时不变化，也不能用于没有 Prepared 快照的 Encounter completion。带 `when` 时两个声明分支都参与校验，运行时只执行命中的分支。追加效果是同一受限 Program 的顺序语句，不创建递归事件链。作者示例见 [[docs/examples/gameplay-b-prepared-tag-combo]] 与 [[docs/plan-work/task-0319-gameplay-b-prepared-tag-combo]]。Action 的行动费用、目标和卡牌引用继续使用各自字段与生命周期。旧 Action `effects`、`hpEffects`、`cardEffects` 不属于合同，Registry 会拒绝含这些未知字段的原始输入。`ShopOffer.effects` 是独立的商店交易合同，仍保留并按 Shop 规则校验。

Encounter 的 `locals` 声明有界 Counter 与布尔 Flag：Counter 经安全整数加法后截到声明范围，Flag 只接受布尔值。它们跨同一 Encounter 的轮次保留，进入新 Encounter 时按声明重新初始化。非战斗 `completion.kind: 'condition'` 使用受限条件，在完整合法轮次结算后检查；Battle Encounter 不使用此条件完成规则。

### Gameplay B 静态 Action Tag 与候选池（E3）

Map Action 可用完整 `TagRef` 声明静态 `tags`；候选池的 Tag entry 按同命名空间层级前缀匹配 Action Tag。Tag 只负责分类与候选筛选，不触发范围伤害等效果；TagDef 可补充显示信息，但 Action Tag 引用无需另行登记 TagDef。

`GameplayMapDef.candidatePools` 是 Map-local 的有序声明，entry 可直接提供 Action、按 Tag 选择 Action，或引用同 Map 的另一个候选池。Encounter Character / Enemy 通过 `candidatePoolIds` 引用池，并可继续使用原有直接候选。来源按稳定顺序展开，同一 Action 的权重累加并保留首次出现位置；重复引用、未知 Action / Pool、引用环、非法权重和安全整数溢出由 Registry 拒绝。合并在动态资格／费用／目标校验与 Tendency 调整前完成，之后仍使用现有 Hand、Owner RNG 和无放回抽取。

AG-1 Map 可在 Pool 上声明一个可选 `gate`，也可在 directed Edge 的 `condition` 上声明只读路线门槛；二者均只支持单项 MapRun Counter 比较或 Flag 等值比较，不提供逻辑组合。引用必须属于本 Map 的 `mapRunFacts`。候选池解析使用 Encounter 入场冻结的 Fact 输入，同一 Encounter 后续 Round 不重评；Edge 则在每次 Map 移动时读取当前已安装 Facts，不消费或修改状态。两者都要求显式 `executionContractId: 'AG-1'`；既有 Team 资源 Edge 条件保持兼容。作者示例见 [[docs/examples/gameplay-b-maprun-fact-gated-pools]]，路线合同与实现见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U28-e5-maprun-fact-edge-gates]]。

作者示例见 [[docs/examples/gameplay-b-card-tags-and-pools]]。该合同只处理静态 Map 内容，不接入旧 Operation CardPool，不增加第二份 Hand／库存，也不支持运行时临时 Pool 注入。

Registry 会按来源和 Encounter 上下文校验语法、资源账户声明、目标身份及 Actorless 限制；运行时仍会在权威 MapRun 计划入口复核自定义 Resolver 提供的内容。`MapRunService` 的 `resolveEncounterCommitPlan` 统一产出 Preview 与 Commit 使用的 detached 计划；Preview 不安装状态，Commit 通过既有 Owner 与 GameInstance 事务安装。Item 库存由 GameInstance 协调，E1 Receipt 保存有限访问记录和实际变化以支持严格恢复，不重放费用或效果。

`Task 0315` 的 U01–U10 Receipt 记录原语、迁移矩阵、Owner 安装、Receipt 校验、旧字段拒绝与生成 Schema；U11 记录文档和整体收尾。可装载示例和作者步骤见 [[docs/examples/gameplay-b-effect-program-e1]]。这不是独立 Datapack Editor 的完整 Map 编辑入口。

### U30：MapRun 生命周期 Status

`GameplayMapStatusDef.lifetime` 可省略，或取 `encounter` / `mapRun`；省略等同 `encounter`，旧 Status 行为不变。`mapRun` 仅适用于 AG-1，且只接受来源于原始 Node/Activity `participants[].actions` 直供 Action 的 Party Character Status；holder 必须是该 Map 固定 Party 成员，`statusApply.target` 只能是 `source` 或 Party `primary`。动态候选池专属 Action、Enemy、Ability、Item 和 `loopTarget` 来源不满足资格。

MapRun 状态由 `MapRun.mapRunStatuses` 单独持有。活动 Encounter 用只读合并投影读取状态，但序列化的 `activeEncounter.statuses` 仍仅保存 Encounter 状态。持续时长只随成功 Encounter roundEnd 前进；Shop、节点移动和 Encounter 转场不耗时，中间 Encounter 胜利保留状态，Run 终局清理。实例保存原始 Node/Activity 来源与 MapRun 提交时钟。采用该字段的 Map 使用 scheduler v7 与 Status Receipt v7；未声明 MapRun 状态的 Map 继续走旧版本路径。合同和演练分别见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U30-e4-maprun-status-contract]] 与 [[docs/examples/gameplay-b-maprun-status]]。

## 从哪里核对

- 聚合类型：`src/data-services/contracts/datapack.ts` 的 `Datapack`；各表字段继续看对应契约文件，不在本页复制完整类型。
- 校验和登记：`src/data-services/registry/registry.ts` 的 `Registry.load()` 会先调用 `validateDatapack()`，再按表步骤合并。合法 ID 不代表目标已存在，具体引用范围也由校验逻辑决定。
- 测试证据：`tests/engine/registry.test.ts` 的 `should load a valid datapack`、`should reject duplicate IDs`、`should reject broken references` 覆盖装载、重复 ID 与缺失引用。这里没有把所有可选表的每个字段逐项列出。
- 维护边界：字段语义以契约和对应机制为准；通用编辑允许范围见 [[docs/docs-829/06-wiki/20-data-services/definition-authoring]]，结构索引见 [[docs/docs-829/03-data-structures/registry]]。
