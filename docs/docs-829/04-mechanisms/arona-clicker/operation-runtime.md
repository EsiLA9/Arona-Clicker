# 04-mechanisms/arona-clicker/operation-runtime — Gameplay B EventRun Runtime

本文记录 AC 内 Gameplay B 的当前 EventRun、战术 Beat 与非战斗场景行为 Runtime。每个 `GameInstance` 私有持有一个局内 owner；操作方经受控入场和窄 facade 启动、查看及推进 Run。Run 不进入 `PlayerState` 或 `InitSnapshot`；主 `SaveData` 可选存一份有界 `operationRun` checkpoint，用于恢复同一场正在进行的事件。

## Runtime owner 与公开命令

每个 `GameInstance` 在私有字段 `#operationRuntimeOwner` 中持有 `OperationRuntimeService`。`GameInstance.operationEntry` 公开冻结的 `OperationEntryFacade`，当前只提供：

| 命令 | 输入与作用 |
| --- | --- |
| `start(eventId, characterIds)` | 按 ID 请求一次受控入场，返回 detached `EventRun`。 |
| `getSnapshot()` | 返回当前 Run 的 detached、冻结副本；没有 Run 时返回 `null`。 |
| `previewIntervention({ runId, planVersion, draft })` | 纯计算单名学生的指挥修订预览，不写 Run 或消费随机数。 |
| `reviseIntervention({ runId, planVersion, draft })` | 校验预览后写入唯一干预槽，递增版本并重建基础计划。 |
| `clearIntervention({ runId, planVersion })` | 清除已存草稿并递增版本；槽位已空时返回未变化快照。 |
| `commitBeat({ runId, planVersion })` | 由当前 Run 中已存的计划与草稿执行一次战术结算。 |
| `previewSceneActionBatch({ runId, planVersion, selections, cards? })` | 纯校验当前地点的完整 Individual/Global 批次；汇总 SceneAction 与当前手牌 SceneCard 的内容费用，不写 Run 或消费随机数。 |
| `stageSceneActionBatch({ runId, planVersion, selections, cards? })` | 显式暂存完整逐人/全局选择、玩家卡选择与费用预览；不扣费、移牌或消费随机数，可随 Run 存档。 |
| `clearSceneActionBatchDraft({ runId, planVersion })` | 丢弃暂存批次；不改 Cost、卡区或随机流。 |
| `commitStagedSceneActionBatch({ runId, planVersion })` | 校验暂存费用快照仍与当前 Run 一致，再通过同一原子场景结算入口提交。 |
| `commitSceneActionBatch({ runId, planVersion, selections, cards? })` | 将 SceneAction 与零张或多张手牌合成一条 OperationResolution，一次扣 PlayerCost、递减批次数并将所用卡从 hand 移入 discard。 |
| `transitionRoute({ runId, planVersion, routeId })` | 完成地点后按当前出口 Gate 转场；这是自动单出口和玩家多出口共用的唯一地点转场命令。 |
| `createSaveSnapshot()` / `restoreSaveSnapshot(snapshot)` | 由 GameInstance 存档/读档路径调用；内容由当前 Registry 重建，拒绝时保留清晰诊断。 |
| `getLastRestoreResult()` | 查询最近一次读档的续局结果或拒绝原因；没有 `operationRun` 时为 `none`。 |

Facade 不暴露 raw owner、任意 `applyStateDelta()`、`finish()`、`reset()`、`dispose()`、订阅接口或冻结的 Run rules。战术命令只接受当前 `runId` 和 `planVersion`；Commit 不接收行动、效果、支付、技能抽取或 Resolution 内容作为调用方输入。

## 受控入场与每局冻结规则

调用方只提交事件 ID 和选定 Character ID。标准 GameInstance 使用 Registry-backed `OperationContentResolver`；显式传入的 resolver 可作为测试/扩展覆写。Registry adapter 以完整 ID 读取 Operation Event、Location、Action 和 StudentOperationProfile，再组装运行时入场 DTO。声明 `initId` 的 Datapack Event 只能从当前所处 Init 启动。Admission 在创建 Run 前验证请求 ID、事件定义、参与者槽位、学生 Character 定义、真实且持有的 Registry Variant、解锁状态、Profile 配对及其结构。对手和环境参与者不经过玩家 roster / Student Profile 检查。任何解析或准入失败都不会替换现有 Run 或发布 `runStarted`。

GameInstance 入场将通过验证的 Actor 身份与 Profile 静态投影交给 owner。学生快照只含本局所需 Character ID、Profile ID、行动候选/优先级、能力、理由及可选技能规则 ID；不包含 Variant ID、`CharacterData`、`VariantProgress` 或长期角色对象。对手/环境快照包含参与者类型、可选 faction ID 和有序候选行动 ID。Admission DTO 只在入场过程中转换为 Run-start input，不按 Run ID 缓存。

owner 在发布 Run 前深拷贝并冻结事件定义、Actor 初始化、`OperationResolvedContent.actionDefinitions` 和技能规则，按 Run 私有保存。后续准备、预览与 Commit 都只读取该份冻结内容，不重新查询 resolver、Registry 或 PlayerState。作者输入现在来自四张 Datapack 表；运行时仍只保留当前 Run 所需的冻结规则，不把 Registry 对象传给结算服务。

## EventRun 状态与归属

| 子状态 | 当前持有内容 |
| --- | --- |
| `eventState` | 有界数值轨道、已知事实 ID、持有物 ID。 |
| `actorStates` | 事件 Actor 的 ID/type、HP/resources、可选 Team ID；GameInstance Run 另有参与者身份，学生携带派生 Profile snapshot。 |
| `teamStates` | 每个声明 Team 的局部战术 resources。Team membership 只由 `OperationActorDef.teamId` 决定。 |
| `playerRouteState` | 与学生/队伍战术资源分开的共享 `playerCost`，以及只存物理 `cardInstanceId` 的 drawPile、hand、discard 三个互斥卡区。打出的牌直接进入 discard，不回洗。 |
| `locationProgress` | 已声明 Location 的访问次数、完成标记与当前访问已消费的 SceneAction 批次数；每次新访问重置批次数。 |
| `locationEntryCostHistory` | 每次进入地点记录访问序号、访问计数、costGain 与余额前后值；它与 `routeHistory` 一并属于 Run 快照。 |
| `pendingSceneActionBatch` | 仅显式 stage 后存在；保存完整输入及基于当时余额计算的费用预览。纯 `previewSceneActionBatch()` 不写入。 |
| `routeHistory` | 每次转场记录来源/目标地点、Route ID、离开结果、可选已消费持有物，以及配置了携带上限时的离场余额。 |
| `preparedBeat` / `interventionDraft` | 当前版本的规范基础计划，以及最多一名学生的一槽干预草稿。低层结构测试 Run 可能没有战术内容，因此两者可为 `null`。 |
| `resolutions` / `resolutionSequence` | 最近最多 32 条结算记录及单调递增序号。 |
| `random` | `splitmix64-counter-v1`、事件 seed 和 `tacticalCursor`。 |
| `planVersion` / `beatIndex` | Run 状态版本和已成功提交 Beat 数。 |

EventRun 仍是每个 `GameInstance` 的独立 owner 状态，不写入 `PlayerState`、`InitSnapshot`，也不通过 `GameView` 投影。`GameInstance.save()` 只会把有 `resumeVersion` 的 admitted Run 写入主 `SaveData.operationRun`；该 checkpoint 保存 EventRun、Actor/Profile 快照和终局 `EventResult`，不复制 Registry 定义、OperationAction 或 View。事件起始余额由 `playerRouteState.playerCost` 给出；地点 `costGain` 在 Run 开始和每次新访问时各发放一次。合法路线提交在同一 detached Run 计划内先应用来源地点 `maxCarryCost`，再切换地点、发放目标 `costGain` 并按手牌上限抽牌；任一步骤失败都不会写回。SceneAction / SceneCard 的 PlayerCost 与 Actor/Team 战术资源分离，战术 Beat 不读取或支付 PlayerCost。

事件可用 Seed 派生有限牌组的物理实例 ID 和初始牌序；独立牌组派生序列不推进 `random.tacticalCursor`。Run 保存实际抽牌顺序与三分区位置；达到 `maxHandSize` 时停止抽牌，未抽卡留在 drawPile，drawPile 耗尽或 discard 有牌时都不会回洗。牌定义、ActionDef 和牌实例索引不写入 Run。

## Save / Resume

可恢复快照由现有 `GameInstance.save()/load()` 接线到主 SaveData 的可选 `operationRun` 字段；SaveSystem 继续把它作为普通 JSON 文档，不新增 key、slot 或格式迁移。快照只有 `eventId + resumeVersion`、当前 EventRun 动态字段和可能存在的 EventResult；规则、Registry lookup 与 View 不落盘。有限牌组的 drawPile/hand/discard 已包含实际抽取顺序，因此恢复不重洗牌，也不重复发地点 Cost 或重抽卡。

读档顺序为：清除现存易失 Run → 恢复主 PlayerState → 按稳定 Event ID 从当前 Registry 解析规则 → 比较 `resumeVersion` 与 Init/Character/Profile/Action 引用 → 校验保存的轨道、Actor、Cost、地点访问、牌区、Resolution、RNG、PreparedBeat、干预与暂存场景批次 → 一次安装恢复 Run。任何检查失败都不留下半恢复状态；`operationEntry.getLastRestoreResult()` 给出 `restored` 或带原因的 `rejected`，GameInstance 同时记录可见开发日志，调用方可重新开始事件。事件内容不兼容由作者递增 `resumeVersion` 表达，不计算内容 Hash。

SceneAction/玩家卡批次只有调用 `stageSceneActionBatch()` 后才成为 Run 状态。stage 保存原始选择和费用预览；读档会按当前可信内容重算并核对预览，commit 再走既有原子结算。纯预览、未接受的 UI 草稿和 hover/滚动状态均不在 SaveData 中。

## 行动内容与 PreparedBeat

`OperationResolvedContent.actionDefinitions` 是本局 ActionDef 的唯一可信来源；`OperationEventDef.actionRequirements` 已删除。学生候选来自已入场 Profile 的 `actionPriorityIds` 和 `candidateActionIds`；对手/环境候选按其 `OperationParticipantSpec.candidateActionIds` 声明顺序读取。候选 ID 必须解析到完整 `OperationActionDef`，定义有限地声明参与者类型、能力、理由、标签、可选 Actor/Team 单项资源费、无目标或单 Actor 目标合同，以及 Actor HP/resource、Team resource 或事件数值轨道的有限 delta 效果。

Runtime `OperationEventDef.locations[]` 是 Registry adapter 依 `OperationEventContentDef.locationIds` 解析出的只读入场 DTO；作者内容中的 Location 独立登记。Location 保持战术 Action、Combination、局部结局规则、路线和可选场景合同。非战斗场景可用 `actionMode` 选择 `individual` 或 `global`，配置有限 `sceneActionBatches`、SceneAction 薄包装、`costGain` 与 `maxCarryCost`。Individual 每批必须为每名存活学生各提交一项行为；Global 每批恰好提交一项行为，可带一名或多名合法目标。SceneActionDef 只引用 `OperationActionDef` 并声明 scope 与 PlayerCost；目标、资格和效果不复制。RouteGate 只读取单个可选 `requiredHeldItemId`；Datapack 校验要求 Route 目标位于 Event 声明的 Location 内、门禁物品属于 Event。Location 仍只过滤战术候选，不覆盖 Profile / ParticipantSpec 的候选顺序。

有限玩家卡组位于事件定义的 `playerSceneDeck`：PlayerSceneCardDef 只声明卡 ID、ActionDef、PlayerCost、scene 时机和副本数。场景批次另可提交零张或多张当前 hand 卡实例；每张卡由同一份 `OperationActionDef` 提供效果与目标规则。SceneAction 与卡牌费用从内容定义汇总，在提交前统一校验余额；命令不能注入费用、Action 或效果。Planner 将 SceneAction/SceneCard 效果与 Beat 效果写入相同 OperationResolution 变化格式与同一个 Runtime 提交边界，卡牌只在该原子提交里从 hand 移入 discard。

纯准备器 `prepareOperationBeat()` 接收最小 EventRun 快照与冻结内容，不接收 RNG、PlayerCost 或可变 owner。它按事件 Actor 声明顺序，为每位 Actor 生成一个 `studentAction`、`intent` 或 `wait`：学生按 Profile 候选次序，对手/环境按 ParticipantSpec 次序；每项需通过地点启用、能力、参与者类型、目标和当前资源检查。非学生没有 capability 来源，因此 Admission 拒绝其引用带能力门槛的 Action，不会忽略门槛。Action 仅支持无目标或单 Actor 目标；显式 `targetPriorityActorIds` 优先，其后按 Event Actor 声明顺序选取首个合法目标。准备期间按 Actor 顺序预留共享 Team 与个人 Actor 资源；本 Beat 产生的资源不会支付本 Beat 的行动费用。

每个冻结 `PreparedBeat` 都带 `planVersion`、`locationId` 和按 Actor 声明顺序排列的计划。准备是纯计算：相同 Run 快照和同一份冻结规则产生相同计划、目标、支付预算及理由，不写 Run、不发通知、不消费随机数。没有可用候选时产生带稳定理由的 Wait，不扣费；不会运行通用 AI。

## 一槽干预与预览

一个 Beat 只有一个 `interventionDraft`，且最多改写一名学生的 Action 和/或目标，可附带内容给出的理由 ID。未编辑 Actor 的原计划保持不变。拟切换至另一学生前，须先清除现有草稿。`previewIntervention()` 校验该学生、Action、目标、理由、地点启用与资源预算，并返回 detached 的最终计划投影；不保存草稿、不改变 Run 或随机游标。若修改令任何计划不可支付或目标非法，整个预览/修改被拒绝，不会暗中重排其他 Actor。

`reviseIntervention()` 只在预览有效时存下单一草稿，递增 `planVersion`，并在新版本重建规范基础 `preparedBeat`。Commit 时，planner 会重算并逐字段核对该基础计划，再使用 Run 已保存的草稿重建最终计划；不会信任外部传入的替代计划。

## Combination、学生技能与局部 RNG

Combination 只匹配当前 Location 的规则和两名不同学生的 `studentAction`。候选按优先级、规则 ID 的 code-unit 顺序、Actor 声明索引构成的固定总序检查；输入 tag 槽位有序，每名学生在一个组合中至多消费一次。规则仅支持同一非空目标或双方无目标。匹配后组合效果替代两个输入 Action 的效果，但两个行动原有费用照付；技能触发仍依据干预后的学生 Action 判断。

局部随机状态字段为 `{ algorithm, seed, tacticalCursor }`。当前算法 ID 是 `splitmix64-counter-v1`；固定 stream tag 是 ASCII `tactical`（`0x746163746963616c`），版本区别由算法 ID 表达。每个 raw 64-bit word（包括 rejection sampling 丢弃的 word）推进暂存 cursor。学生技能规则使用整数 basis points `[0, 10000]`，仅对 Profile 引用且存在的规则、干预后 Action 命中 trigger 的学生抽样；检查顺序为 Actor 声明顺序。准备、预览、干预、撤销、非法命令和失败结算都不推进 Run cursor。planner 只返回 provisional cursor；仅有效 Commit 原子成功后 owner 才写回随机状态。

## Resolution 与原子 Commit

纯 `planOperationResolution()` 从 Commit 开始时的同一份冻结快照计算最终计划、唯一干预、行动费用、Combination、技能 roll 和数值变化。费用先从 Commit 起始 Actor/Team 余额按 Actor 声明顺序验证预留；行动、Intent、Combination、技能效果和支付对同一 numeric pool 汇总后只限幅一次。每项变化保留 before、requested delta、实际 delta、after 和来源，Resolution 不携带完整 Run 或规则定义。

`commitBeat({ runId, planVersion })` 先校验当前 in-progress Run 与版本，再运行纯 planner。owner 校验候选批次与当前 Run、Location、计划版本和 RNG cursor 一致，把结算 delta 应用到 detached 候选 Run，并完成随机状态、Beat/Resolution 序号、草稿清除、历史 append 与下一 Beat 准备。所有步骤成功后只替换一次 Run slot，再发布 `beatResolved`。`commitSceneActionBatch()` 复用同一个 `planOperationResolution()`、OperationResolution 容器与变更应用逻辑；不抽取战术随机数，只额外提交批次数、玩家 Cost 与牌区移动。任何规划、校验、费用、目标或下一 Beat 准备失败均不写 Run、随机流、历史或通知。

每次成功状态变更都会推进 `planVersion`：Commit、有效 `applyStateDelta()`、Location complete/route transition 和 finish。Route 命令必须匹配当前 `runId` 与 `planVersion`。状态/Location 变化会清除过期草稿并重建当前规范计划；终局状态没有下一 Beat。最近一次已消费 `basePlanVersion` 的 Commit 重试在 stale/terminal 检查前返回同一条冻结 Resolution，不重复扣费、抽样、写入或通知；更早版本不重放，返回 stale。历史最多保留最近 32 条，`resolutionSequence` 不随裁剪回退。

## 其他状态转移与生命周期

`applyStateDelta()` 对数值轨道、事实、持有物、Actor 和玩家路线状态先整体校验再写入。拒绝的批次无部分写入；牌区 ID 多重集须保持事件固定牌组的物理实例不变。`completeCurrentLocation()` 标记当前地点完成并评估出口：没有合法出口时调用事件终局判定，一个合法出口自动通过 `transitionRoute()` 前进，多个出口则等待玩家提交 Route ID。`transitionRoute()` 在 detached 候选 Run 上验证完成状态、版本、出口、访问上限和所需持有物，再应用离场 Cost 上限、消费门禁物品、保存来源结果、重置目标地点的本次进度、递增访问数、发放入场 Cost/抽牌并准备新地点；全部步骤成功后只替换一次 Run slot。任何转场错误都保留原 Run。

`finish()` 只在当前 Location 已完成且没有合法出口时生成 `success`、`partialSuccess` 或 `failure` 的冻结 `EventResult`；终局 Run 不接受后续状态转移，重复结束返回已有结果。Run owner 的本地通知包括 `runStarted`、Location 进入/完成、`beatResolved` 和 `runFinished`，不扩展通用 Engine EventBus，也不从 facade 暴露订阅接口。

| GameInstance 操作 | Operation Runtime 行为 |
| --- | --- |
| `stop()` | 只停止 Session Tick，保留当前 Run。 |
| `init()` / `reset()` | 清除当前易失 Run。 |
| `load()` | 先清除现存 Run 并恢复 PlayerState；存在 `operationRun` 时再用当前 Registry/Init 恢复，缺少字段时维持无 Run。 |
| `reload()` | 经 `stop()` → `reset()` → `init()` 重载并清除旧 Run。 |
| `dispose()` | 停止 Session Tick 并 dispose 私有 owner；之后不能启动 Run。 |

## 尚未覆盖的范围

当前已有有界地图分支、回环、单持有物 Gate、Location/Event 目标与结局、Individual/Global SceneAction、共享 PlayerCost、固定有限玩家场景卡组与独立抽牌顺序。Task 0220 已将作者合同接入 Datapack / Registry；Run 保存/恢复由 Task 0219 承接。Profile 中 `randomSkillRuleId` 只在本局规则提供对应有限技能定义并成功 Beat Commit 时触发，不是随机抽取 AC 角色技能系统的运行入口。

## 代码与测试

- `src/arona-clicker/contracts/operation.ts`、`operation-action.ts`、`operation-skill.ts`、`operation-beat.ts`、`operation-resolution.ts`、`operation-save.ts`：EventRun、Action、有限技能、Beat、Resolution 与有界存档合同。
- `src/arona-clicker/services/operation-entry-service.ts`、`operation-participant-admission.ts`、`student-operation-profile-resolver.ts`：ID-only entry、参与者准入与 Actor/Profile 入场投影。
- `operation-definition-validation.ts`、`operation-action-content-validation.ts`、`operation-tactical-definition-validation.ts`：事件、Action 与战术内容校验。
- `operation-plan-preparation.ts`、`operation-target-selection.ts`、`operation-intervention-preview.ts`、`operation-combination-resolver.ts`、`operation-tactical-rng.ts`、`operation-resolution-planner.ts`：纯计划、干预、协同、局部随机与结算规划。
- `src/arona-clicker/services/operation-runtime-service.ts`：Run owner、版本检查、原子提交、有限历史与生命周期通知。
- `src/arona-clicker/services/registry-operation-content-resolver.ts`、`src/arona-clicker/runtime-options.ts`、`runtime-wiring.ts`、`runtime-game-instance.ts`：Registry 内容解析、resolver 装配、私有 owner 和 GameInstance 生命周期清理。
- 定向测试：`tests/engine/operation-runtime-service.test.ts`、`operation-scene-actions.test.ts`、`gameplay-b-save-resume.test.ts`、`operation-player-scene-deck.test.ts`、`gameplay-b-scene-action-sample.test.ts`、`gameplay-b-route-sample.test.ts`、`gameplay-b-operation-sample.test.ts`、`operation-plan-preparation.test.ts`、`operation-target-selection.test.ts`、`operation-intervention-preview.test.ts`、`operation-combination-resolver.test.ts`、`operation-tactical-rng.test.ts`、`operation-resolution-planner.test.ts`、`gameplay-b-event-runtime-integration.test.ts`、`student-operation-runtime.test.ts`。

相关边界：[[docs/docs-829/01-architecture/data-flow]]、[[docs/docs-829/02-modules/arona-clicker]]、[[docs/docs-829/03-data-structures/player-state]]。
