# P4：用现有数据做出玩家能完成的调查、收藏和剧情

**起步方式。** 先在正式定义的副本或独立测试包中设计一条短活动，再逐步跑真实游戏。表述“已有”时指能定位到当前合同或测试；“补接”表示已有能力需要在玩家界面或现有服务间接通；“试验缺口”要在现有数据无法表达体验后确认。先跑小活动，再决定是否添加新字段或服务。[现状审计 A11–A15](11-current-implementation-audit.md) 有源代码、测试和存档范围。

## 玩家要完成的活动

玩家在大厅收到一段简短线索，知道有一个值得调查的地点。他查看收录的地图，发现熟悉的主厅到陌生地点有潜在线路。获得线索或能力后，他真正抵达，读到人物资料并接下邀约。活动途中会拿到一件可用物品。用掉物品后还可以回顾曾取得的线索。回到熟悉地点时，普通日常有变化，而必须阅读的关键篇章可以稳定接取。换世界线、返回、保存和重开后，这些变化各自按拥有范围继续起作用。

这是由五个独立试点拼成的目标。用 Base 验证地图、人物和赴约，用 addition-test 验证信号芯片，用 area-achievement-demo 验证资料收集和里程碑。首轮别把不同 Init 的现有实体强行拼成一条可通行路线。各自得到行为证据后，再用独立测试包组合短链。以下新增线索、门控和入口均为试验安排。

实体能力、可持续游玩的三条活动与可能需要的框架改造见[探索与收藏设计](19-gameplay-capabilities-and-activities.md)。下列五项用于核对当前机制。证据表明缺口影响实际玩法时，可单独提议较大改动供负责人评审。

## A. 在地图上发现地点、知道怎么到、第一次到访

起点是 Base 的 `base:init:schale_office`、主厅 `base:area:schale_main`、天台 `base:area:schale_rooftop` 和 `base:area-map:schale_office`。实际导航图节点的动作可以尝试前往 Area。图的边用于表现是否有连接，通行判断仍按 Area 的实际路网和玩家状态执行。

1. 在测试副本中设天台存在、名称、用途及进入条件说明为可分别揭示的信息。启动游戏时从主厅观察，只有应公开的内容可见；明确测试完全未知时是否有占位。选择一个已有 Story 的实验副本或 Trigger，在实际可执行动作中用 revealInformation 告知已声明的某项信息。先揭示存在再揭示名称或用途。不要从知道地名直接推断可达、到访。
2. 在实验中尝试打开或获得地图，先记录打开成功与是否收录。 `AreaMapDef.collection` 区分 onOpen 与 explicit， `AreaMapCommandService` 和 acquireAreaMap 处理实际授予。图加入收藏后记录 collectedAreaMapIds；当前位置和 visitedAreas 此时没有因为收藏而改变。
3. 对天台加入真实 `Area.enterCondition` 测试值，例如使用 `hasEnh` 检查该测试中发放的现有类强化。提示应出现在可理解的位置。有线路却缺条件时，点击动作给拒绝，不改到访、消耗品或位置；能显示多少原因由当前已知信息决定。只有作者检查器会显示完整名称和真实字段。
4. 经已有 Effect 为测试玩家取得所需资格，再通过地图节点动作或正常 Area 导航前往。追踪 `buildAreaTravelRoutes` 和 `InitService.travelToArea`，核对当前 Init、目标存在信息、实际进入条件和所走路线。成功才出现到访和 Area 进入事件，下一步能由地区 Story 投放接住。用相同条件验证预览旅行和提交旅行的判断。
5. 保存退出后，在地图、地点资料或 Story 记录查清已收录、已知未访、已到访和已看线索。重访用同一实体的 visit 信息，不重复显示第一次资料或发放一次性奖励。切到另一个 Init 再回来，对照 `PER_INIT_FIELD_SPECS`，位置、到访和收录按当前机制恢复，已揭示信息按当前保存范围处理。

已有 `WorldInformationDef` 的 existence、name、utility、condition，`InformationReveal`、真实 Travel 和存档支持前几步。需核对的缺口是哪些线索能在玩家界面回查、能否用已有拒绝信息做恰当提示、是否需要额外来源记录。若地点未揭示时某个玩家读模型仍泄露其名称，先改该显示规则。先不新增世界知识键、旅行报价或第二套地图。参考 `tests/engine/area-map/area-map-travel.test.ts` 与 `tests/engine/world/information-reveal-save-rebuild.test.ts`。

## B. 获得、消耗和回顾一枚信号芯片

以 `datapack-dev/addition_test/01-content.json` 的 `addition-test:item:signal-chip` 为起点。它是 consumable，现有使用效果加 7 点信用点，携带包内图标。 `02-story.json` 中 `addition-test:passivestory:signal` 重复完成奖励给 1 枚。 `03-systems.json` 的 scanner 掉落表也声明这个选项；表本身不保证某个设施会调用它。已声明的 release 例子与两份 ZIP 要按实际输入区分。

1. 在观测站用真实被动入口获取芯片。在背包确认数字从 0 到 1、图标与说明可见。试验另用掉落入口和测试商店发放同一 ID。测试商店须先选真实 ShopOffer 合同及实际可用 Spot，不能声称已有 scanner 提供该商品。模拟不可支付、库存已满或空掉落，观察没有新增芯片时计数/说明如何表现。
2. 在背包点使用，沿 `ItemService.useItem` 核对实际消耗、信用点增加与失败原因。测试将“使用芯片解开线索”放进一份试验配置，先看已有 useEffects 和 flag/Story 事件能否表达。若要在某个新设施通过物品来验证资格，要区分“查所持数量”“出示不消耗”“支付后移除”。当前通用 `ConditionTarget` 没有现成的 hasItem 目标，不能凭空填；优先核对真实付款选项、现有统计/条件或明确使用效果，再决定是否缺少一种窄命令或条件。
3. 数量归零后，应能回顾曾发现的资料及下一步。已有 `$InitCollectedAmount <initId> <itemId>` 和里程碑能验证一段累计收集。沿状态变更检查商店、掉落、Story 奖励在实际成功时是否都更新计数；数字反映累计量，不能凭它推断具体出处、首次时间或已读说明。优先从现有统计及 Item/Inventory 显示满足“曾获得”。玩家确实要查原出处且现有数据无法回溯时，再加最少一条来源资料。
4. 选两份实体做系列线索，通过现有条件和里程碑试验是否可判断都曾获得，并交给 Entry 后续。用 `addition-test:item:archive-fragment` 和 `area-achievement-demo:item:archive-fragment` 作同名末段反例。不要跨样本误认同一实体，也不要把同一持有量重复算成已完成两项。读档后库存与回顾各自一致。

`ItemService.giveItem/useItem/rollDropTable`、`ShopService.checkout`、Story 奖励与 `StateMutationService.addItem` 都是具体现有入口。验收还要检查界面有没有告诉玩家去哪找线索。暂以累计获得和已读作为候选，是否要永久收藏记录、保留来源和跨 Init 公开是 D08 的产品选择。若失败仅因为现有界面没展示已有数据，先做显示，不新建库存和档案体系。

## C. 玩家可以认识尚未持有的角色

用白子的 Character 原型 `shiroko` 与 Variant `Shiroko` 说明区别：前者是人物，后者是可持有和培养的一种差分。当前羁绊邀约有好感和已读前置，不能直接换成未持有玩家的公开初见。已有 RosterSystem 能给已拥有联系人与包含未获得差分占位的图鉴， `CharaProfileService.characterProfile` 读取资料，实际是否公开何种资料由玩家入口经验决定。

1. 在 Base 测试副本保留当前白子羁绊。造一份极小的试验会面，先走地区的可接取 Active Entry 及普通正文。它可以使用现有地点与命名资料，但不靠领取角色运行。初见完成时写入现有的 Story 记录或合适 flag，验证由此能决定一项资料是否可读。
2. 玩家看到对该人物的有限资料，从该处查最近会面或下一步线索。用已有角色图鉴/联系人客户端相比：能否区分“已知道人物”“已拥有差分”“可进入羁绊”。未拥有不可通过联系人操作培养；图鉴可公开的名称和资料上限要逐项确认。不因为同角色另一差分显示未知而删掉已知姓名。
3. 再通过真实获取 Variant 的测试流程进入通常的好感路线，验证既有角色资料、招募、拥有和好感不会被新增线索修改。依次跑未持有、已有一差分、已有多差分、换 Init、保存再读。普通画像可用 `hoshino` 的现有 Profile 对照。

现有 Reveal 的状态写入口支持若干世界/故事/物品目标，**没有通用 Character 知识目标**。因此先使用 Story 已读/flag 和界面查资料得到具体体验，再决定是否要角色已认识的独立持久记录。首个合理改动可能只是一处人物资料投影。不要从试验型 flag 直接推导全体人物固定阶段。可回归 `tests/engine/character/roster-system.test.ts`、白子和星野 Story 样本。独立资料页、现有界面扩展及跨线规则在 D08 定。

## D. 地区日常可以随机，重要邀约应稳定可接取

在 Base 用 `base:passivepool:schale_root`、`base:passivepool:schale_daily` 和 briefing/tea。池按候选权重与真实条件选择，Entry 有世界线、是否重复、冷却等字段。已有 `PassivePoolSystem.pick`、 `ConditionDepIndex`、 `StoryAvailabilityDeliveryMount`、 `StoryFollowUpMount` 与 `StoryService` 可作为正式接线。

玩家在主厅有普通交流机会。实验让一条与见面进度相关的既有式样条件加入日常候选。未满足时看不到该候选，满足后可被选择；冷却、有效位置和资格由真实服务判断。回到同一地区，比较未抽中、已播、还有冷却和过期时是否可操作。若玩家保存后频繁重复领奖，查完成与冷却是否实际持久，别用新计数把现有 bug 遮住。

同时使用白子赴约，或已有 Story followUp 的“下次进入指定 Area 时投放目标 Entry”，作为确定性线路。玩家完成前置后打开 AreaHero/地区工作区，看见可领取条目；离开、重开、返回，再按现有接取命令进入。已取消、条件改变或活动槽位占用时显示具体状态，按当前消费规则重验。将所有随机日常候选设为空时，已经满足条件的必要条目仍应可接取。投放与播放是两次动作，看到邀请不代表已执行 Story。

先使用真实的 `storyCompleted/areaEntered` 监听、区域投放及相关测试定位限制。 `StoryAvailabilityDeliveryMount` 现有订阅不能自动保证任意新条件变化触发，即时发现必须有可重现的失联用例才补监听或刷新。重访与持久可用如果现有投放已表达，直接复用。是否取消必要入口和**哪些**剧情应当保留由 D09 决定。首轮没有新增通用 EncounterChannel 或第二种机会服务的前置。

## E. 调查目标要打开真实活动

以 `datapack-dev/area-achievement-demo/00-world.json` 与 `01-achievements.json` 为验证起点。从 `area-achievement-demo:area:supply-station` 出发，经相邻路径到 archive-room。每次进入，`enterEffects` 增加 1 枚该包档案片。已有 `archive-fragments` Milestone 检查本 Init 累计量到 3，关联 listener 完成后给 5 信用点；Achievement 显示线索和进度。这里先跑当前玩法，看第 1、2、3 次访问、返回、读档、再访的实际结果。

在独立测试副本增加一种真正可用的后续功能，如完成调查后开放含目标资料的 Story 入口或设施。先选能由现有配置表达的版本。例如，用已经实现的 hasEnh、已有 addEnhancement Effect、设施 `SpotFunctionality.condition` 或 Entry 的 `triggerCondition` 条件做一项能力和入口。查看当次 `MilestoneAdapter` 和 `SpotFunctionalitySystem` 的真实检查，以及可见状态与实际操作是否一致。能力不能只显示“+5”。要让玩家会用它，例如返回资料地点打开范围明确的后续。若现有功能种类不含“资料检索”，首轮可用已存在的 Story 入口，另登记是否要设计新的可执行设施行为。

Milestone 目前先提交完成，然后执行 listener.then；失败只记日志、不会自动重试。 `tests/engine/world/milestone-runtime.test.ts` 明确固定此行为。如果新后续需要保证交付，先用故障注入验证具体会被卡住的场景。可比较直接用可靠条件读取已完成的现有事实、一个允许重试的领取动作，或只把该能力型提交结合进现有写入。新机制不得顺便改变普通奖励的行为。不要预建 ObjectiveDef 或通用授予框架。

## 交付试验用什么判断

将 A 到 E 的行为逐项记录：在哪看到提示、点了哪个既有操作、读取哪些真实定义、哪项玩家事实实际改变、下一操作在哪、是否可回顾。逐项注明已有、补接或缺口。组合实验可在首次访问、取得两项资料、认识人物、合法抵达、阅读关键 Entry、返回新日常的几步上验证。必须保留正确前置不满足、重复进入、读档、换线、取消及失败恢复。按 [R8](09-construction-roadmap.md) 并行准备以上 JSON 和验收，不依赖正式 DSL、完整工作台或正式还原。[决定 D08、D09](10-decision-register.md) 记录需要负责人确认的长期玩法选择。
