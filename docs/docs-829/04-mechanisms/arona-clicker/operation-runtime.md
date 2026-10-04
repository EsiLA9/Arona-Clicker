# 04-mechanisms/arona-clicker/operation-runtime — Gameplay B EventRun Runtime

本文记录 AC 内 Gameplay B 的当前 EventRun 与战术 Beat Runtime。每个 `GameInstance` 私有持有一个局内 owner；操作方经受控入场和窄 facade 启动、查看及推进 Run。Beat 计划、干预草稿、战术结算和随机游标都属于易失 EventRun，不进入 AC 玩家存档状态。

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

Facade 不暴露 raw owner、任意 `applyStateDelta()`、`finish()`、`reset()`、`dispose()`、订阅接口或冻结的 Run rules。战术命令只接受当前 `runId` 和 `planVersion`；Commit 不接收行动、效果、支付、技能抽取或 Resolution 内容作为调用方输入。

## 受控入场与每局冻结规则

调用方只提交事件 ID 和选定 Character ID。构造时配置的可信 `OperationContentResolver` 提供事件、行动、学生技能与参与者内容；标准 Runtime wiring 组合 `CharacterSystem`、`RosterSystem` 和当前状态读取器。Admission 在创建 Run 前验证请求 ID、事件定义、参与者槽位、学生 Character 定义、真实且持有的 Registry Variant、解锁状态、Profile 配对及其结构。对手和环境参与者不经过玩家 roster / Student Profile 检查。任何解析或准入失败都不会替换现有 Run 或发布 `runStarted`。

GameInstance 入场将通过验证的 Actor 身份与 Profile 静态投影交给 owner。学生快照只含本局所需 Character ID、Profile ID、行动候选/优先级、能力、理由及可选技能规则 ID；不包含 Variant ID、`CharacterData`、`VariantProgress` 或长期角色对象。对手/环境快照包含参与者类型、可选 faction ID 和有序候选行动 ID。Admission DTO 只在入场过程中转换为 Run-start input，不按 Run ID 缓存。

owner 在发布 Run 前深拷贝并冻结事件定义、Actor 初始化、`OperationResolvedContent.actionDefinitions` 和技能规则，按 Run 私有保存。后续准备、预览与 Commit 都只读取该份冻结内容，不重新查询 resolver、Registry 或 PlayerState。Resolver 是当前临时受信内容入口；Operation 内容还没有正式 Datapack / Registry 表。

## EventRun 状态与归属

| 子状态 | 当前持有内容 |
| --- | --- |
| `eventState` | 有界数值轨道、已知事实 ID、持有物 ID。 |
| `actorStates` | 事件 Actor 的 ID/type、HP/resources、可选 Team ID；GameInstance Run 另有参与者身份，学生携带派生 Profile snapshot。 |
| `teamStates` | 每个声明 Team 的局部战术 resources。Team membership 只由 `OperationActorDef.teamId` 决定。 |
| `playerRouteState` | 独立的 `playerCost` 数值和固定多重集的 drawPile、hand、discard、played 卡牌 ID 区。 |
| `locationProgress` | 已声明 Location 的访问次数及完成标记；初始地点从一次访问开始。 |
| `preparedBeat` / `interventionDraft` | 当前版本的规范基础计划，以及最多一名学生的一槽干预草稿。低层结构测试 Run 可能没有战术内容，因此两者可为 `null`。 |
| `resolutions` / `resolutionSequence` | 最近最多 32 条结算记录及单调递增序号。 |
| `random` | `splitmix64-counter-v1`、事件 seed 和 `tacticalCursor`。 |
| `planVersion` / `beatIndex` | Run 状态版本和已成功提交 Beat 数。 |

EventRun 是每个 `GameInstance` 独立的易失状态，不写入 `PlayerState`、`InitSnapshot`、`SaveData`，也不通过 `GameView` 投影。`playerRouteState.playerCost` 与玩家卡牌区虽暂存在 Run 合同内，但它们不是 Team/Actor 战术资源；本战术规划、干预与结算不读取、不扣除 PlayerCost，也不抽取或打出玩家卡牌。

## 行动内容与 PreparedBeat

`OperationResolvedContent.actionDefinitions` 是本局 ActionDef 的唯一可信来源；`OperationEventDef.actionRequirements` 已删除。学生候选来自已入场 Profile 的 `actionPriorityIds` 和 `candidateActionIds`；对手/环境候选按其 `OperationParticipantSpec.candidateActionIds` 声明顺序读取。候选 ID 必须解析到完整 `OperationActionDef`，定义有限地声明参与者类型、能力、理由、标签、可选 Actor/Team 单项资源费、无目标或单 Actor 目标合同，以及 Actor HP/resource、Team resource 或事件数值轨道的有限 delta 效果。

在当前还没有完整 `LocationDef` 时，`OperationEventDef.locationTactics[]` 以已有 Location ID 临时保存已启用 Action ID 和 Combination 规则。没有该地点规则块时，该地点不启用行动。Location 仅过滤候选，不覆盖 Profile / ParticipantSpec 的候选顺序。

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

`commitBeat({ runId, planVersion })` 先校验当前 in-progress Run 与版本，再运行纯 planner。owner 校验候选批次与当前 Run、Location、计划版本和 RNG cursor 一致，把结算 delta 应用到 detached 候选 Run，并完成随机状态、Beat/Resolution 序号、草稿清除、历史 append 与下一 Beat 准备。所有步骤成功后只替换一次 Run slot，再发布 `beatResolved`。任何规划、校验、数值合并或下一 Beat 准备失败均不写 Run、cursor、历史或通知。

每次成功状态变更都会推进 `planVersion`：Commit、有效 `applyStateDelta()`、Location enter/complete 和 finish。状态/Location 变化会清除过期草稿并重建当前规范计划；终局状态没有下一 Beat。最近一次已消费 `basePlanVersion` 的 Commit 重试在 stale/terminal 检查前返回同一条冻结 Resolution，不重复扣费、抽样、写入或通知；更早版本不重放，返回 stale。历史最多保留最近 32 条，`resolutionSequence` 不随裁剪回退。

## 其他状态转移与生命周期

`applyStateDelta()` 对数值轨道、事实、持有物、Actor 和玩家路线状态先整体校验再写入。拒绝的批次无部分写入；玩家牌区 ID 多重集须保持初始牌组不变。`enterLocation()` 只接受事件声明的地点并增加访问次数；`completeCurrentLocation()` 标记当前地点完成。`finish()` 生成 `success`、`partialSuccess` 或 `failure` 的冻结 `EventResult`；终局 Run 不接受后续状态转移，重复结束返回已有结果。Run owner 的本地通知包括 `runStarted`、Location 进入/完成、`beatResolved` 和 `runFinished`，不扩展通用 Engine EventBus，也不从 facade 暴露订阅接口。

| GameInstance 操作 | Operation Runtime 行为 |
| --- | --- |
| `stop()` | 只停止 Session Tick，保留当前 Run。 |
| `init()` / `load()` / `reset()` | 清除当前易失 Run；`load()` 不从 SaveData 恢复它。 |
| `reload()` | 经 `stop()` → `reset()` → `init()` 重载并清除旧 Run。 |
| `dispose()` | 停止 Session Tick 并 dispose 私有 owner；之后不能启动 Run。 |

## 尚未覆盖的范围

当前地点仍是简单 ID 集合；尚无地点出口、地图分支、持有物 gate、地点转场、访问上限或场景结局机制。当前 Action 效果只覆盖有限 Actor/Team/数值轨道变化；事实 Predicate、完整目标和事件结局由后续 Task 承接。玩家场景卡、玩家 PlayerCost 消耗、抽牌/打牌、Datapack / Registry 作者表，以及 Run 保存/恢复都不在当前 Runtime。Profile 中 `randomSkillRuleId` 只在本局规则提供对应有限技能定义并成功 Commit 时触发，不是随机抽取 AC 角色技能系统的运行入口。

## 代码与测试

- `src/arona-clicker/contracts/operation.ts`、`operation-action.ts`、`operation-skill.ts`、`operation-beat.ts`、`operation-resolution.ts`：EventRun、Action、有限技能、Beat 与 Resolution 合同。
- `src/arona-clicker/services/operation-entry-service.ts`、`operation-participant-admission.ts`、`student-operation-profile-resolver.ts`：ID-only entry、参与者准入与 Actor/Profile 入场投影。
- `operation-definition-validation.ts`、`operation-action-content-validation.ts`、`operation-tactical-definition-validation.ts`：事件、Action 与战术内容校验。
- `operation-plan-preparation.ts`、`operation-target-selection.ts`、`operation-intervention-preview.ts`、`operation-combination-resolver.ts`、`operation-tactical-rng.ts`、`operation-resolution-planner.ts`：纯计划、干预、协同、局部随机与结算规划。
- `src/arona-clicker/services/operation-runtime-service.ts`：Run owner、版本检查、原子提交、有限历史与生命周期通知。
- `src/arona-clicker/runtime-options.ts`、`runtime-wiring.ts`、`runtime-game-instance.ts`：resolver 装配、私有 owner 和 GameInstance 生命周期清理。
- 定向测试：`tests/engine/operation-runtime-service.test.ts`、`operation-plan-preparation.test.ts`、`operation-target-selection.test.ts`、`operation-intervention-preview.test.ts`、`operation-combination-resolver.test.ts`、`operation-tactical-rng.test.ts`、`operation-resolution-planner.test.ts`、`gameplay-b-event-runtime-integration.test.ts`、`student-operation-runtime.test.ts`。

相关边界：[[docs/docs-829/01-architecture/data-flow]]、[[docs/docs-829/02-modules/arona-clicker]]、[[docs/docs-829/03-data-structures/player-state]]。
