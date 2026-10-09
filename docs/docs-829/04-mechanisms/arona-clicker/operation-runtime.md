# 04-mechanisms/arona-clicker/operation-runtime — Gameplay B EventRun Runtime

本文记录 AC 内 Gameplay B 的当前 EventRun、战术 Beat 与非战斗场景行为 Runtime。每个 `GameInstance` 私有持有一个局内 owner；操作方经受控入场和窄 facade 启动、查看及推进 Run。Run 不进入 `PlayerState` 或 `InitSnapshot`；主 `SaveData` 可选存一份有界 `operationRun` checkpoint，用于恢复同一场正在进行的事件。

## Runtime owner 与公开命令

每个 `GameInstance` 在私有字段 `#operationRuntimeOwner` 中持有 `OperationRuntimeService`。`GameInstance.operationEntry` 公开冻结的 `OperationEntryFacade`，当前只提供：

| 命令 | 输入与作用 |
| --- | --- |
| `start(eventId, characterIds)` | 按 ID 请求一次受控入场，返回 detached `EventRun`。 |
| `getSnapshot()` | 返回当前 Run 的 detached、冻结副本；没有 Run 时返回 `null`。 |
| `getAdmissionSummary(eventId, characterIds)` | 对固定阵容做只读准入预检，返回参与者展示名、可出动状态与缺失原因；不启动 Run。 |
| `previewIntervention({ runId, planVersion, draft })` | 纯计算单名学生的指挥修订预览，不写 Run 或消费随机数。 |
| `reviseIntervention({ runId, planVersion, draft })` | 校验预览后写入唯一干预槽，递增版本并重建基础计划。 |
| `clearIntervention({ runId, planVersion })` | 清除已存草稿并递增版本；槽位已空时返回未变化快照。 |
| `commitBeat({ runId, planVersion })` | 由当前 Run 中已存的计划与草稿执行一次战术结算。 |
| `previewSceneActionBatch({ runId, planVersion, selections, cards?, purchases?, skip? })` | 纯校验当前 Scene 的 Individual/Global 选择、PurchaseOffer 与跳过合同；汇总实际选择的 SceneAction、当前手牌 SceneCard 和 PurchaseOffer 的共享 PlayerCost，不写 Run 或消费随机数。 |
| `stageSceneActionBatch({ runId, planVersion, selections, cards?, purchases?, skip? })` | 显式暂存当前选择的 SceneAction、玩家卡、购买项与费用预览；显式 skip 才表示跳过本批。不扣费、移牌或消费随机数，可随 Run 存档。 |
| `clearSceneActionBatchDraft({ runId, planVersion })` | 丢弃暂存批次；不改 Cost、卡区或随机流。 |
| `commitStagedSceneActionBatch({ runId, planVersion })` | 校验暂存费用快照仍与当前 Run 一致，再通过同一原子场景结算入口提交。 |
| `commitSceneActionBatch({ runId, planVersion, selections, cards?, purchases?, skip? })` | 将 SceneAction、零张或多张手牌和 PurchaseOffer 合成一条 OperationResolution，一次扣 PlayerCost、写购买 Fact marker、应用既有 Action 效果、递减批次数并将所用卡从 hand 移入 discard。 |
| `transitionRoute({ runId, planVersion, routeId })` | 完成地点后按当前出口 Gate 转场；这是自动单出口和玩家多出口共用的唯一地点转场命令。 |
| `claimOutcomeReward()` | 对已结束的成功/部分成功 Run，经 `StateMutationService` 提交事件定义中的白名单奖励一次；失败、未结束或已领取状态不会重复发放。 |
| `createSaveSnapshot()` / `restoreSaveSnapshot(snapshot)` | 由 GameInstance 存档/读档路径调用；内容由当前 Registry 重建，拒绝时保留清晰诊断。 |
| `getLastRestoreResult()` | 查询最近一次读档的续局结果或拒绝原因；没有 `operationRun` 时为 `none`。 |

Facade 不暴露 raw owner、任意 `applyStateDelta()`、`finish()`、`reset()`、`dispose()`、订阅接口或冻结的 Run rules。战术命令只接受当前 `runId` 和 `planVersion`；Commit 不接收行动、效果、支付、技能抽取或 Resolution 内容作为调用方输入。

## 受控入场与每局冻结规则

调用方只提交事件 ID 和选定 Character ID。标准 GameInstance 使用 Registry-backed `OperationContentResolver`；显式传入的 resolver 可作为测试/扩展覆写。Registry adapter 以完整 ID 读取 Operation Event、Location、Action 和 StudentOperationProfile，再组装运行时入场 DTO。声明 `initId` 的 Datapack Event 只能从当前所处 Init 启动。Admission 在创建 Run 前验证请求 ID、事件定义、参与者槽位、学生 Character 定义、真实且持有的 Registry Variant、解锁状态、Profile 配对及其结构。对手和环境参与者不经过玩家 roster / Student Profile 检查。任何解析或准入失败都不会替换现有 Run 或发布 `runStarted`。

GameInstance 入场将通过验证的 Actor 身份与 Profile 静态投影交给 owner。学生快照只含本局所需 Character ID、Profile ID、行动候选/优先级、能力、理由及可选技能规则 ID；不包含 Variant ID、`CharacterData`、`VariantProgress` 或长期角色对象。对手/环境快照包含参与者类型、可选 faction ID 和有序候选行动 ID。Admission DTO 只在入场过程中转换为 Run-start input，不按 Run ID 缓存。

owner 在发布 Run 前深拷贝并冻结事件定义、Actor 初始化、`OperationResolvedContent.actionDefinitions` 和技能规则，按 Run 私有保存。后续准备、预览与 Commit 都只读取该份冻结内容，不重新查询 resolver、Registry 或 PlayerState。作者输入现在来自六张 Datapack 表；运行时仍只保留当前 Run 所需的冻结规则，不把 Registry 对象传给结算服务。

## EventRun 状态与归属

| 子状态 | 当前持有内容 |
| --- | --- |
| `eventState` | 有界数值轨道、已知事实 ID、持有物 ID。 |
| `actorStates` | 事件 Actor 的 ID/type、HP/maxHP/resources、可选 Team ID 与 detached displayName/avatarRef；GameInstance Run 另有参与者身份，学生携带派生 Profile snapshot。 |
| `teamStates` | 每个声明 Team 的局部战术 resources。Team membership 只由 `OperationActorDef.teamId` 决定。 |
| `playerRouteState` | 与学生/队伍战术资源分开的共享 `playerCost`，以及只存物理 `cardInstanceId` 的 drawPile、hand、discard 三个互斥卡区。打出的牌直接进入 discard，不回洗。 |
| `locationProgress` | 已声明 Location 的访问次数、完成标记、有序 Scene 的已完成 ID 前缀，以及当前访问或各 Scene 已消费的 SceneAction 批次数；每次新访问重置批次数，但保留同 Run 已完成 Scene。 |
| `locationEntryCostHistory` | 每次进入地点记录访问序号、访问计数、costGain 与余额前后值，并带 Run-wide `timelineSequence`；它与 `routeHistory` 一并属于 Run 快照。 |
| `pendingSceneActionBatch` | 仅显式 stage 后存在；保存完整输入及基于当时余额计算的费用预览。纯 `previewSceneActionBatch()` 不写入。 |
| `routeHistory` | 每次转场记录 Run-wide `timelineSequence`、来源/目标地点、Route ID、离开结果、可选已消费持有物，以及配置了携带上限时的离场余额。 |
| `rewardClaimed` | Run 已结束且事件奖励确认已成功提交后置为 true；与 `EventResult` 同步快照并在 Save/Resume 中保留。 |
| `preparedBeat` / `interventionDraft` | 当前版本的规范基础计划，以及最多一名学生的一槽干预草稿。低层结构测试 Run 可能没有战术内容，因此两者可为 `null`。 |
| `resolutions` / `resolutionSequence` / `timelineSequence` | 最近最多 32 条结算记录、单调递增的结算序号，以及共享于结算、转场和地点入场记录的 Run-wide 时间序号。 |
| `random` | `splitmix64-counter-v1`、事件 seed 和 `tacticalCursor`。 |
| `planVersion` / `beatIndex` | Run 状态版本和已成功提交 Beat 数。 |

EventRun 仍是每个 `GameInstance` 的独立 owner 状态，不写入 `PlayerState`、`InitSnapshot`，也不通过 `GameView` 投影。`GameInstance.save()` 只会把有 `resumeVersion` 的 admitted Run 写入主 `SaveData.operationRun`；该 checkpoint 保存 EventRun、Actor/Profile 快照和终局 `EventResult`，不复制 Registry 定义、OperationAction 或 View。事件起始余额由 `playerRouteState.playerCost` 给出；地点 `costGain` 在 Run 开始和每次新访问时各发放一次。合法路线提交在同一 detached Run 计划内先应用来源地点 `maxCarryCost`，再切换地点、发放目标 `costGain` 并按手牌上限抽牌；任一步骤失败都不会写回。SceneAction / SceneCard 的 PlayerCost 是独立场景费用；其 ActionDef Actor/Team `cost` 若存在，会和 PlayerCost 一起预览、校验并原子支付。战术 Beat 不读取或支付 PlayerCost。

事件可用 Seed 派生有限牌组的物理实例 ID 和初始牌序；独立牌组派生序列不推进 `random.tacticalCursor`。Run 保存实际抽牌顺序与三分区位置；达到 `maxHandSize` 时停止抽牌，未抽卡留在 drawPile，drawPile 耗尽或 discard 有牌时都不会回洗。牌定义、ActionDef 和牌实例索引不写入 Run。

## Save / Resume

可恢复快照由现有 `GameInstance.save()/load()` 接线到主 SaveData 的可选 `operationRun` 字段；SaveSystem 继续把它作为普通 JSON 文档，不新增 key、slot 或格式迁移。快照只有 `eventId + resumeVersion`、当前 EventRun 动态字段和可能存在的 EventResult；规则、Registry lookup 与 View 不落盘。有限牌组的 drawPile/hand/discard 已包含实际抽取顺序，因此恢复不重洗牌，也不重复发地点 Cost 或重抽卡。

读档顺序为：清除现存易失 Run → 恢复主 PlayerState → 按稳定 Event ID 从当前 Registry 解析规则 → 比较 `resumeVersion` 与 Init/Character/Profile/Action 引用 → 校验保存的轨道、Actor、Cost、地点访问、牌区、Resolution 与共享 timeline 顺序、RNG、PreparedBeat、干预与暂存场景批次 → 一次安装恢复 Run。历史完整性校验要求初始 Location 至少访问一次；`routeHistory.length` 等于所有 Location `visitCount` 总和减一；若任一 Location 声明 `costGain` 或 `maxCarryCost`，Location entry Cost history 必须存在且逐次覆盖每次访问，否则不允许多余的 entry Cost history。Resolution history 长度必须精确等于 `min(resolutionSequence, 32)`，其中序号覆盖最近连续保留窗口；共享 `timelineSequence` 必须等于累计 Resolution 数、Route 数和 entry Cost 记录数之和。每一条保留记录仍须通过 ID、字段、单调次序、唯一序号和范围校验。任何检查失败都不留下半恢复状态；`operationEntry.getLastRestoreResult()` 给出 `restored` 或带原因的 `rejected`，GameInstance 同时记录可见开发日志，调用方可重新开始事件。事件内容不兼容由作者递增 `resumeVersion` 表达，不计算内容 Hash。

SceneAction/玩家卡批次只有调用 `stageSceneActionBatch()` 后才成为 Run 状态。stage 保存原始选择和费用预览；读档会按当前可信内容重算并核对预览，commit 再走既有原子结算。纯预览、未接受的 UI 草稿和 hover/滚动状态均不在 SaveData 中。

## Location 内有序 Scene

`OperationLocationDef.scenes` 可内嵌一组按作者顺序执行的 `OperationSceneDef`。Scene ID 只需在所属 Location 内稳定；完整内容身份由 Event、Location、Scene 的父子路径组成。省略 `scenes` 时 Runtime 投影一个隐式 singleton Scene，稳定 ID 为 `main`，并沿用该 Location 原有的 enabled actions 与 SceneAction 设置，因此旧 Location 不需要内容迁移。

Scene 没有独立 Runtime owner、`sceneInstanceId` 或 SaveData 字段。`EventRun.locationProgress[locationId]` 承载 `completedSceneIds` 及显式 Scene 的批次计数；当前 Scene 从有序内容中取第一个未完成项，完成 ID 按顺序前缀校验。Location 重访沿用该 Run 已完成的 Scene 前缀，checkpoint 也保存同一份进度；开始新的 EventRun 才得到新的 Scene 进度。隐式 `main` 沿用 Location 原有完成规则；显式 Scene 只有成功提交后状态满足作者声明的 `completion` 才记录完成。

`OperationView.currentSceneId`、`currentScene`、`scenes` 和 `actionOffers` 都由当前 Location 内容与 EventRun 进度推导，不另存 ready/active/completed 标记。Scene Location 在有 tacticalContent 时仍保留一个确定性的 `preparedBeat` 作为只读资格投影与恢复校验快照；它不表示玩家可以提交战斗 Beat，Workspace 只在 `currentStage: combat` 显示战斗控制，且 Runtime 的 `commitBeat()` 会拒绝任何非 `stage: combat` Location。Scene 结算把 Scene ID 写入同一条 `OperationResolution.sceneId`，并按来源使用现有 `commitBeat()` 或 `commitSceneActionBatch()` 的 detached copy-on-write 提交；SceneAction 空 skip 虽消耗批次预算，不执行效果，也不推进 Scene。Scene 完成本身不会标记 Location 完成或执行路线转场；只有现有 Location objective / failure / explicit completion 规则决定退出。

`gameplay-b:operation-event:atomic-scene-demo` 是独立的小型 Registry Event，包含一个复合 Location 和一个最小出口 Location；复合地点按序排列 `investigate-equipment` → `handle-alarm` 两个 Scene。警报 Scene 分四批运行：`all-eligible` 对当前前排的两名敌人结算、显式选择并把一名前排敌人移到后排、再次 `all-eligible`（只命中仍在前排的敌人）、最后显式选择解除警报并揭示完成 Fact 的敌人。调查提交揭示维修线索后，View 将同地点的警报 Scene 投影为 active；空 skip、被 Runtime 拒绝的批次或只用 actorless 遥控牌都不会推进到警报 Scene。Scene A 完成时地点仍为 inProgress、出口 Route 不可用且没有路线历史。Scene B 成功后，独立地点目标与有序 Scene 完成门槛共同满足；来源地点记录为 success，唯一合法出口按既有规则自动转场。Run / Map 保留来源地点成功状态及两个 completed Scene ID，Route history 保存 Route ID。样例通过通用 Registry Operation 入口启动，不增加 Event-ID UI 特判；其 Event checkpoint 版本为 3。

Scene 可用 `sceneActionChoice` 声明一个 M-of-N 候选集。V1 只接受 required Global SceneAction ID，作者的 N 必须在 `[1, M]`；普通 SceneAction 批次必须恰好提交 N 个不同候选，候选缺失、重复或多选都会使 Preview 与 Commit 整批失败。`fixed` SceneAction 在普通提交中仍自动结算，但不计入 N。显式 `skip: true` 是独立命令，不受 exact-N 拦截；它只按既有空批次规则消耗批次额度，不运行 SceneAction / PlayerSceneCard（包括 fixed 项）、不扣选择费用，也不满足 Scene completion。普通空提交不能伪装成 skip。该选择合同不把物理 PlayerSceneCard 或 PurchaseOffer 混入 M/N 候选。

同一 Scene 还可声明 `purchaseOffers`，但当前演示把玩法分置于同一 Location 的两个有序 Scene：`choose-response` 先完成 exact 2-of-4 选择，`purchase-supplies` 再呈现两个不同价格的补给。每个 PurchaseOffer 指向已登记 targetless Operation Action、非负共享 PlayerCost 与一个 Event `factIds` 中初始未记录且唯一的 `purchaseFactId`。Action 必须至少有一个 Event Track / Fact / HeldItem 奖励效果，不得声明 Action cost 或非 Event 效果。成功购买在同一 Resolution 中扣共享 PlayerCost、运行既有 Action effects 并揭示独立 purchase Fact；奖励 HeldItem 不充当防重锁。该 marker 属于 EventRun 的 `knownFactIds`，随 checkpoint 保存；Preview 和 Commit 均按 marker 重验。因此移除奖励物、恢复存档或重置 Location-local 进度不会清除购买锁。Action、StudentSkillRule 与 CombinationRule effects 不得 reveal/forget 任何预留 marker。Purchase Offer 的 View 奖励说明采用人类可读 Action 描述或标题，不把 Event-local Item/Fact/Track ID 当玩家文案。当前机制不引入 ShopService、货币或通用库存层。

`gameplay-b:operation-event:scene-offer-purchase-demo` 是上述合同的独立验收样例：同一 Location 内先 M/N 选择，再批量购买两个补给；购买后另用库存复核行动证明持有物可移除而 marker 仍有效。每个显式 Scene 仅在成功 Commit 后满足各自 completion 条件；两幕完成并满足 Location objectives 后才按单出口规则转场。

正式 Carousel 与 Strategy Park checkpoint 的 `resumeVersion` 当前分别为 3 与 4：Scene ID 进入 Resolution 后，旧版本检查点按既有内容版本策略拒绝，不做迁移。

显式 Scene 序列的完成是 Location 退出前置门槛：即使地点目标已满足，前序或当前 Scene 尚未完成时，地点也不会被标记完成或开放出口。Scene A → B 本身不消耗 Route；完成最后一幕后，再由 Location outcome 决定结果并评估出口。唯一可用 Route 沿现有 exact-one 规则自动转场；多出口仍等待玩家提交 Route ID。

## 行动内容与 PreparedBeat

`OperationResolvedContent.actionDefinitions` 是本局 ActionDef 的唯一可信来源；`OperationEventDef.actionRequirements` 已删除。学生候选来自已入场 Profile 的 `actionPriorityIds` 和 `candidateActionIds`；对手/环境候选按其 `OperationParticipantSpec.candidateActionIds` 声明顺序读取。候选 ID 必须解析到完整 `OperationActionDef`，定义有限地声明参与者类型、能力、理由、标签、可选 Actor/Team 单项资源费、无目标或单 Actor 目标合同，以及 Actor HP/resource、Team resource 或事件数值轨道的有限 delta 效果。

Actor Target 合同可声明 `selectionMode: 'select' | 'all-eligible'`、`allowedPositionIds` 和现有关系 / ID / type 过滤。省略 `selectionMode` 等价于 `select`；所有已声明的 relation、ID、type、position 条件都取交集。候选资格使用当前 Run 中存活 Actor 的 HP 和站位，站位 Effect 提交后 View / Preview 会据此重新计算。`select` 的显式目标 ID 会在 Preview / Commit 再验证；目标死亡、换位或其他状态变化导致显式目标失效时整批拒绝，不改选成全组、不留下部分费用或效果。对玩家已经选择的目标型 SceneAction，空 `targetActorIds` 表示使用当前合法候选的首项作为默认目标；候选按执行者 `targetPriorityActorIds` 排序，再按 Event Actor 声明顺序补齐，显式合法目标仍覆盖默认。该默认只补 Target，不替玩家选 Action 或 performer。`all-eligible` 只在 Scene 批次显式启用，由 Runtime 在当前状态解析全部合格目标，空组不可执行；它不由空 `targetActorIds` 推断。该模式不适用于战斗 Beat / Intervention，战斗仍使用原有单目标语义。Actor target 有 performer 时 `relation` 先确定关系候选；`allowedActorIds` 精确限制 Event Actor ID，`allowedActorTypes` 限制声明的 `OperationActorDef.type` 字符串，`allowedPositionIds` 限制当前 Run 的位置，所有条件同时声明时相交，每个静态 ID/type 都必须在当前 Event 中存在。免 performer 的场景 Action 不存在 relation source，只能使用显式 `allowedActorIds` / `allowedActorTypes` 建立绝对目标候选；`allowedPositionIds` 仅继续过滤这个集合，不能单独建立关系或 Actorless 目标边界，也不能解析 `self`、`sameTeam` 或 `otherTeam`。`targetPriorityActorIds` 只在合法候选中排序，不增加目标资格。Actorless Action 的非 Target Effect 不能依赖 source Actor；缺少 performer 时 Actor/Team execution cost 与 actor-relative Effect 均非法。

Runtime `OperationEventDef.locations[]` 是 Registry adapter 依 `OperationEventContentDef.locationIds` 解析出的只读入场 DTO；作者内容中的 Location 独立登记。Event 可带可选 `title` 与 `description`，分别供通用入口和 Operation workspace 标题/简报使用。每个 Location 必须显式声明 `stage: 'combat' | 'scene'`；Runtime View 原样投影当前阶段，UI 不从 `PreparedBeat`、`maxBeats` 或 Location ID 推断。Combat 的 `maxBeats` 可缺省；缺省无 Beat 上限，显式正整数仍是最高 Beat 数。Combat 未声明 primary objective、partial outcome 或 failure condition 时，以当前 Location / Scene 启用的 opponent Participant 候选行动识别对手，最后一名此类存活 opponent 倒下后作为普通 Location success；secondary objective 不阻止该清场出口。作者已声明 Location 结果条件时仍由这些条件决定完成结果，Event hard failure 仍可立即结束 Run。无上限 Combat 若没有可达清场对象或别的可识别完成/失败出口，会被内容校验拒绝；这只是明显无出口检查，不证明任意复杂条件可达。

Location 保持战术 Action、Combination、局部结局规则、路线和可选场景合同。非战斗场景可用 `actionMode` 选择 `individual` 或 `global`，可缺省 `sceneActionBatches`（表示不设批次数上限）或声明原有限范围 1–10 的正整数上限，并配置 SceneAction 薄包装、`costGain`、`maxCarryCost` 与可选 `maxVisits`。无上限 SceneAction Location 必须具备 primary objective、partial outcome、failure 条件或 Event hard failure 出口；secondary objective 单独存在不足以完成 Location。Registry / Runtime 只识别明显缺少出口的定义。每批仍由一次显式命令推进。Individual 每批每名存活学生最多选一项；Global 每批最多选一项；两种模式都允许零选或部分选择。显式 Skip 通过 `skip: true` 提交空批次并消耗一批；不结算任何 SceneAction / PlayerSceneCard（包括 fixed 项），不支付费用、移牌，也不因此满足 Scene completion。普通空提交则仍结算 fixed 项，因此可用于推进作者明确配置的固定场景行动。批次数仍按 Location 完成条件推进，Scene completion 和 Location completion 分开评估，路线 / Event outcome 沿现有流程重新计算。`performerPolicy` 位于 SceneAction / PlayerSceneCard 调用入口，缺省为 `selected-student`；`none` 只允许就地激活，`optional-student` 允许就地激活或由一名合格学生执行。Actorless Actor Target 必须声明绝对 Actor ID/type filter，且不能使用执行者资源成本或 performer-relative 效果；student 分支可用该学生的关系目标。`selectionPolicy` 缺省为 `required`，表示可由玩家选择的行动/牌，不表示批次必须用尽所有可选项；`fixed` 项自动纳入、不可取消，Location fixed SceneAction 按 scope 纳入，fixed 物理手牌按实例纳入。没有明确提交绑定的 fixed 项由 Runtime 根据 performer policy 选择默认执行方式/目标。SceneAction 与 PlayerSceneCard 仍只引用一份 `OperationActionDef`，目标、资格和效果不复制；Action `title` / `description` 与 wrapper 文案覆盖从 View 投影，不由 UI 按内容 ID 查表。RouteGate 可要求单个 `requiredHeldItemId`，或要求 `anyOfHeldItemIds` 中至少持有一项；两种字段互斥。只有单凭证路线可声明 `consumeRequiredHeldItem`，因此消费对象唯一。Datapack 校验要求 Route 目标位于 Event 声明的 Location 内、门禁物品属于 Event。进入目标地点时同时检查 Event 总访问预算与 Location 自身 `maxVisits`；RouteView 只对当前地点出边判断可用性。Location 仍只过滤战术候选，不覆盖 Profile / ParticipantSpec 的候选顺序。

有限玩家卡组位于事件定义的 `playerSceneDeck`：PlayerSceneCardDef 声明卡 ID、ActionDef、标题/说明覆盖、PlayerCost、scene 时机、副本数，以及可选 performer / selection policy。场景批次另可提交零张或多张当前 hand 卡实例；每张卡由同一份 `OperationActionDef` 提供效果与目标规则。SceneAction 与玩家卡 PlayerCost、Action Actor/Team execution cost 从内容定义分别汇总并联合预检；命令不能注入费用、Action 或效果。Planner 将 SceneAction/SceneCard 效果与费用写入相同 OperationResolution 变化格式与同一个 Runtime 提交边界，卡牌只在该原子提交里从 hand 移入 discard。纯 `previewSceneActionBatch()` 向 UI 返回 PlayerCost 余额前/总额/余额后及 Actor/Team action cost；预览不写入 Run，最终 Commit 仍重新验证。

UI 将浏览/焦点、已选、不可用和 fixed 纳入投影区分；required 只在进入 Run 计划或 UI 草稿后表示已选，fixed 自动纳入且不可取消，并展示当前默认合法目标。`selected-student` Global SceneAction 与 PlayerSceneCard 可通过键盘/点击执行者选择器分配、改派或取消；候选直接来自当前 View 的 `eligibleActorIds`，与拖放共用 SceneDraft 写入路径。`optional-student` 仍可点按就地激活，也可选择学生执行。Selectable SceneAction 展示 Runtime 合法候选排序的首项目标作为默认；玩家可改选，未点选的 Action / performer 仍未加入 SceneDraft。PlayerSceneCard 保持自己的目标草稿规则。`all-eligible` 显示“自动作用于全部合格目标”与 View 当前候选，不开放手动目标增删。目标模式与候选一起从 Runtime View 投影；重排站位后 UI 更新候选摘要。SceneDraft 只在 UI 内存中按 Run、planVersion 和 Location 保存；改选、撤销与目标更新不写 Run。每次编辑后 Controller 调用 Runtime 纯预览，显示 PlayerCost 与 Actor/Team action cost，并以预览拒绝原因禁用确认。普通提交保持“编辑、查看即时预览、单次确认”，不会强制 stage/commit 两次确认；显式跳过仍走空批次规则。批次费用来自 Runtime，不由 UI 对 DOM 费用标签求和。

纯准备器 `prepareOperationBeat()` 接收最小 EventRun 快照与冻结内容，不接收 RNG、PlayerCost 或可变 owner。Runtime 把每名学生的当前 Character Hand 行动绑定到 `studentActionIdsByActorId`，并把 Profile 的 `actionPriorityIds`、`candidateActionIds` 限定在当前持牌集合；准备器按 Profile 优先级尝试持牌行动，之后按持牌顺序尝试未排序候选。它按事件 Actor 声明顺序，为每位 Actor 生成一个 `studentAction`、`intent` 或 `wait`：对手/环境仍按 ParticipantSpec 顺序；每项需通过地点启用、能力、参与者类型、目标和当前资源检查。每个可用 Action 的目标从当前存活且合法的 Actor 中选取：显式 `targetPriorityActorIds` 只排序合法候选，未声明时按 Event Actor 声明顺序；没有合法目标或资源不足时继续尝试下一 Action，最后才产生 Wait。已倒下的学生不再行动。非学生没有 capability 来源，因此 Admission 拒绝其引用带能力门槛的 Action，不会忽略门槛。Combat Action 维持单 Actor 目标；Scene 的 `all-eligible` 不延伸为战术目标模式。准备期间按 Actor 顺序预留共享 Team 与个人 Actor 资源；本 Beat 产生的资源不会支付本 Beat 的行动费用。

每个冻结 `PreparedBeat` 都带 `planVersion`、`locationId` 和按 Actor 声明顺序排列的计划。准备是纯计算：相同 Run 快照和同一份冻结规则产生相同计划、目标、支付预算及理由，不写 Run、不发通知、不消费随机数。没有可用候选时产生带稳定理由的 Wait，不扣费；不会运行通用 AI。

## 一槽干预与预览

一个 Beat 只有一个 `interventionDraft`，且最多改写一名学生的 Action 和/或目标，可附带内容给出的理由 ID。未编辑 Actor 的原计划保持不变。拟切换至另一学生前，须先清除现有草稿。`previewIntervention()` 校验该学生、Action、目标、理由、地点启用与资源预算，并返回 detached 的最终计划投影；不保存草稿、不改变 Run 或随机游标。若修改令任何计划不可支付或目标非法，整个预览/修改被拒绝，不会暗中重排其他 Actor。

`reviseIntervention()` 只在预览有效时存下单一草稿，递增 `planVersion`，并在新版本重建规范基础 `preparedBeat`。候选方案若与基础 PreparedBeat 中该学生的 Action 与目标完全一致，Runtime 将其规范为无干预；若已有单槽干预被改回基础方案，只清除槽位并更新版本。费用校验留在纯 Preview / Planner 的 Action 合同边界，为未来费用扩展保留一致入口；当前不增加货币或干预成本。Commit 时，planner 会重算并逐字段核对基础计划，再使用 Run 已保存的草稿重建最终计划；不会信任外部传入的替代计划。View 提供基础与有效 PreparedBeat，UI 显示自动 Action / Target 与玩家修订；默认值本身不会被当成玩家干预。

## Combination、学生技能与局部 RNG

Combination 只匹配当前 Location 的规则和两名不同学生的 `studentAction`。候选按优先级、规则 ID 的 code-unit 顺序、Actor 声明索引构成的固定总序检查；输入 tag 槽位有序，每名学生在一个组合中至多消费一次。规则仅支持同一非空目标或双方无目标。匹配后组合效果替代两个输入 Action 的效果，但两个行动原有费用照付；技能触发仍依据干预后的学生 Action 判断。

局部随机状态字段为 `{ algorithm, seed, tacticalCursor }`。当前算法 ID 是 `splitmix64-counter-v1`；固定 stream tag 是 ASCII `tactical`（`0x746163746963616c`），版本区别由算法 ID 表达。每个 raw 64-bit word（包括 rejection sampling 丢弃的 word）推进暂存 cursor。学生技能规则使用整数 basis points `[0, 10000]`，仅对 Profile 引用且存在的规则、干预后 Action 命中 trigger 的学生抽样；检查顺序为 Actor 声明顺序。准备、预览、干预、撤销、非法命令和失败结算都不推进 Run cursor。planner 只返回 provisional cursor；仅有效 Commit 原子成功后 owner 才写回随机状态。

## Resolution 与原子 Commit

纯 `planOperationResolution()` 从 Commit 开始时的同一份冻结快照计算最终计划、唯一干预、行动费用、Combination、技能 roll 和数值变化。费用先从 Commit 起始 Actor/Team 余额按 Actor 声明顺序验证预留；行动、Intent、Combination、技能效果和支付对同一 numeric pool 汇总后只限幅一次。每项变化保留 before、requested delta、实际 delta、after 和来源，Resolution 不携带完整 Run 或规则定义。

`commitBeat({ runId, planVersion })` 先校验当前 in-progress Run 与版本，再运行纯 planner。owner 校验候选批次与当前 Run、Location、计划版本和 RNG cursor 一致，把结算 delta 应用到 detached 候选 Run，并完成随机状态、Beat/Resolution 序号、草稿清除、历史 append 与下一 Beat 准备。所有步骤成功后只替换一次 Run slot，再发布 `beatResolved`。`commitSceneActionBatch()` 复用同一个 `planOperationResolution()`、OperationResolution 容器与变更应用逻辑；不抽取战术随机数，只额外提交批次数、玩家 Cost 与牌区移动。任何规划、校验、费用、目标或下一 Beat 准备失败均不写 Run、随机流、历史或通知。

每次成功状态变更都会推进 `planVersion`：Commit、有效 `applyStateDelta()`、Location complete/route transition 和 finish。Route 命令必须匹配当前 `runId` 与 `planVersion`。状态/Location 变化会清除过期草稿并重建当前规范计划；终局状态没有下一 Beat。最近一次已消费 `basePlanVersion` 的 Commit 重试在 stale/terminal 检查前返回同一条冻结 Resolution，不重复扣费、抽样、写入或通知；更早版本不重放，返回 stale。Resolution 历史最多保留最近 32 条，`resolutionSequence` 不随裁剪回退。成功 Commit、Route 转场和 Location 入场费用记录共享 Run-wide `timelineSequence`，供 UI 按可证明的顺序交织结算、路线与 Cost 变化；缺少共同序号时 UI 标出顺序不完整，不猜测。修改该 checkpoint 字段的正式 Carousel / Strategy Park Event 已递增各自 `resumeVersion`，按既有策略拒绝旧 checkpoint，不做迁移。

## 其他状态转移与生命周期

`applyStateDelta()` 对数值轨道、事实、持有物、Actor 和玩家路线状态先整体校验再写入。拒绝的批次无部分写入；牌区 ID 多重集须保持事件固定牌组的物理实例不变。`completeCurrentLocation()` 标记当前地点完成并评估出口：没有合法出口时调用事件终局判定，一个合法出口自动通过 `transitionRoute()` 前进，多个出口则等待玩家提交 Route ID。`transitionRoute()` 在 detached 候选 Run 上验证完成状态、版本、出口、访问上限和所需持有物，再应用离场 Cost 上限、消费门禁物品、保存来源结果、重置目标地点的本次进度、递增访问数、发放入场 Cost/抽牌并准备新地点；全部步骤成功后只替换一次 Run slot。任何转场错误都保留原 Run。

`finish()` 只在当前 Location 已完成且没有合法出口时生成 `success`、`partialSuccess` 或 `failure` 的冻结 `EventResult`；终局 Run 不接受后续状态转移，重复结束返回已有结果。终局奖励只允许从 `EventDef.rewards.success/partialSuccess` 读取受限资源奖励；`claimOutcomeReward()` 先调用 AC 注入的 Mutation 回调，成功后才原子标记 Run 与结果已领取，回调失败不留下已领取标记。失败不产生奖励。Run owner 的本地通知包括 `runStarted`、Location 进入/完成、`beatResolved` 和 `runFinished`，不扩展通用 Engine EventBus，也不从 facade 暴露订阅接口。

| GameInstance 操作 | Operation Runtime 行为 |
| --- | --- |
| `stop()` | 只停止 Session Tick，保留当前 Run。 |
| `init()` / `reset()` | 清除当前易失 Run。 |
| `load()` | 先清除现存 Run 并恢复 PlayerState；存在 `operationRun` 时再用当前 Registry/Init 恢复，缺少字段时维持无 Run。 |
| `reload()` | 经 `stop()` → `reset()` → `init()` 重载并清除旧 Run。 |
| `dispose()` | 停止 Session Tick 并 dispose 私有 owner；之后不能启动 Run。 |

## 当前机制范围

当前正式切片已组合有界地图分支/回环、单持有物 Gate、Location/Event 目标与结局、Individual/Global SceneAction、共享 PlayerCost、固定有限玩家场景卡组、独立抽牌顺序、固定阵容准入、三栏 Operation UI、主 SaveData 续局和一次性 AC 资源奖励。Gameplay B 运行内容从独立 `gameplay-b@1.0.0` bundle 接入；其局内 ID 命名空间为 `gameplay-b`。Profile 中 `randomSkillRuleId` 只在本局规则提供对应有限技能定义并成功 Beat Commit 时触发，不是随机抽取 AC 角色技能系统的运行入口。更广泛事件目录、阵容选择器、地图作者画布、通用卡片系统和自定义奖励效果仍不属于 V1。

## 代码与测试

- `src/arona-clicker/contracts/operation.ts`、`operation-action.ts`、`operation-skill.ts`、`operation-beat.ts`、`operation-resolution.ts`、`operation-save.ts`：EventRun、Action、有限技能、Beat、Resolution 与有界存档合同。
- `src/arona-clicker/services/operation-entry-service.ts`、`operation-participant-admission.ts`、`student-operation-profile-resolver.ts`：ID-only entry、参与者准入与 Actor/Profile 入场投影。
- `operation-definition-validation.ts`、`operation-action-content-validation.ts`、`operation-tactical-definition-validation.ts`：事件、Action 与战术内容校验。
- `operation-plan-preparation.ts`、`operation-target-selection.ts`、`operation-intervention-preview.ts`、`operation-combination-resolver.ts`、`operation-tactical-rng.ts`、`operation-resolution-planner.ts`：纯计划、干预、协同、局部随机与结算规划。
- `src/arona-clicker/services/operation-runtime-service.ts`：Run owner、版本检查、原子提交、有限历史与生命周期通知。
- `src/arona-clicker/services/registry-operation-content-resolver.ts`、`src/arona-clicker/runtime-options.ts`、`runtime-wiring.ts`、`runtime-game-instance.ts`：Registry 内容解析、resolver 装配、私有 owner 和 GameInstance 生命周期清理。
- 定向测试：`tests/engine/operation-runtime-service.test.ts`、`operation-scene-actions.test.ts`、`gameplay-b-save-resume.test.ts`、`operation-player-scene-deck.test.ts`、`gameplay-b-scene-action-sample.test.ts`、`gameplay-b-multiscene-location.test.ts`、`gameplay-b-route-sample.test.ts`、`gameplay-b-operation-sample.test.ts`、`operation-plan-preparation.test.ts`、`operation-target-selection.test.ts`、`operation-intervention-preview.test.ts`、`operation-combination-resolver.test.ts`、`operation-tactical-rng.test.ts`、`operation-resolution-planner.test.ts`、`gameplay-b-event-runtime-integration.test.ts`、`student-operation-runtime.test.ts`；Registry 入口两幕点击测试位于 `tests/ui/gameplay-b-operation-entry-registry.test.ts`。

相关边界：[[docs/docs-829/01-architecture/data-flow]]、[[docs/docs-829/02-modules/arona-clicker]]、[[docs/docs-829/03-data-structures/player-state]]。
