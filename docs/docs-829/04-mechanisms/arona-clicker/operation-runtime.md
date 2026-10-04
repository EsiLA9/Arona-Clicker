# 04-mechanisms/arona-clicker/operation-runtime — Gameplay B EventRun Runtime

本文说明 Gameplay B 的局内 EventRun 如何经受控入场创建、归属私有 Runtime owner、初始化 Actor/Profile 快照、接受局部状态转移，并随 AronaClicker Runtime 生命周期清理。当前规则限于已落地的入场及静态资格投影；路线图尚未实现的场景行为与结算机制不描述为当前事实。

## Runtime owner

每个 `GameInstance` 在私有字段 `#operationRuntimeOwner` 中持有一个 `OperationRuntimeService`；服务实例不经 `GameInstance` 公共属性暴露。`GameInstance.operationEntry` 是窄入口，公开的 `OperationEntryFacade` 只有 `start(eventId, characterIds)` 和 `getSnapshot()`，不会暴露 raw owner 的 `applyStateDelta()`、`finish()`、`reset()`、`dispose()` 或本地监听 API。

`GameInstance` 构造时使用 `GameInstanceOptions.operationContentResolver` 配置受信 `OperationContentResolver`；省略时使用空 resolver，没有可启动事件。标准 `runtime-wiring.ts` 通过组合钩子向 entry 提供 `CharacterSystem`、`RosterSystem` 和当前 state 读取器。自定义/no-op Wiring 仍得到封闭的 entry facade，但缺少 AC 身份服务时不能启动学生队伍。`GameInstanceOptions.wiring` 是受信组合根/测试替身，不是隔离对抗式扩展代码的权限边界；普通 Operation 调用方仍只能经 facade 传入 ID。

## 受控入场与 Actor/Profile 快照

公开调用方只提交事件 ID 与选定的 Character ID 列表，不提交 `OperationEventDef`、Actor spec、Profile 或其他解析后内容。`OperationEntryService.start()` 按该 ID 调用构造时的 resolver；Admission 验证 resolver 返回的事件 ID/定义、参与者槽位与 Profile 结构，并在调用 owner 前完成学生入场检查：Character 定义存在、存在真实且持有的 Registry Variant、Variant `proto` 与 Character ID 相符、`CharacterSystem.getUnlocked(state)` 包含该 Character、Profile 存在且匹配。

对手和环境参与者不经过玩家 roster / Student Profile 检查。任何解析或 admission 诊断都会在 owner `start()` 前抛出；失败请求不创建 Run，也不发出 `runStarted`。验证成功后，entry 将受信 resolver 提供的 `OperationEventDef` 与解析出的 Actor 初始化一起交给私有 owner。读取 Run 只能经 `operationEntry.getSnapshot()`，获得 detached、冻结的副本。

Admission 成功会生成 detached `OperationAdmission` DTO，包含按 actorId 核验的参与者及 Profile 定义。`OperationEntryService.startAdmitted(admission)` 经 `resolveOperationRunStart()` 按 actorId 与 Profile ID 配对，将其转为 `OperationRunStartInput`；私有 owner 收到的是事件定义加 Actor 初始化快照。DTO 不按 Run ID 缓存或直接存入 Run。

GameInstance 的公开入场路径中，ActorState 包含事件 Actor 的 ID/type、HP/resources，以及参与者类型：学生携带 Character ID 和派生的 `OperationStudentProfileSnapshot`；对手/环境身份快照携带 `participantKind` 及可选 faction ID。学生 snapshot 只含本局所需身份 ID 和静态 Profile 决策资料，不含 Variant ID、CharacterData、VariantProgress 或其他长期角色对象；也不直接保存原始 `StudentOperationProfileDef`。低层 `OperationRuntimeService.start(OperationEventDef)` 的结构测试路径可以省略这些扩展字段，但不经 GameInstance 公共入口。

Run 是独立易失的局内 owner，不进入 `PlayerState`、`InitSnapshot` 或 `SaveData`。当前 resolver 是构造时配置的内容入口，Operation 定义尚未从 Datapack / Registry 自动装载。

## Profile 静态资格与安全回退

事件可声明 `actionRequirements`，每项只提供 action ID、所需 capability ID 和理由 ID。Profile 候选与 requirements 的交集通过事件内容确定；以 actorId 找到参与者、以 `profileId` 关联唯一 Profile，并核对该 Profile 的 Character ID。Profile 中 actionPriorityIds 覆盖到的候选先按其声明次序排列；其他匹配候选沿用 Profile 的 candidateActionIds 顺序。

每个 `actionCandidates` 条目记录该 action 的 required/missing capability IDs、静态 eligible 标记，以及按“Profile 理由在前、事件要求理由在后”去重合并的 reason IDs。`eligibleActionIds` 保留候选次序。如果没有静态合格候选，固定写入 `operation:action:wait` fallback 和 `operation:profile:no-eligible-action` 理由。此处只做内容资格过滤、排序和解释投影，不准备或执行行动。

## EventRun 内容

| 子状态 | 当前持有内容 |
| --- | --- |
| `eventState` | 有界数值轨道、已知事实 ID、持有物 ID。 |
| `actorStates` | 事件定义中的 actor ID/type、HP/resources；GameInstance 入场还提供 participantKind。学生另有 Character ID 与派生的 `OperationStudentProfileSnapshot`；对手/环境身份快照另有可选 faction ID。快照不含 Variant ID 或长期角色对象。 |
| `playerRouteState` | 非负有限的 `playerCost` 数值和 `drawPile`、`hand`、`discard`、`played` 四个牌区的 ID 列表。局部更新须保持初始牌组的 ID 多重集不变。 |
| `locationProgress` | 定义中的每个 Location 的访问次数和完成标记；初始 Location 从一次访问开始。 |
| `random` | 定义的 seed 与运行游标字段。 |

这些字段都由同一个 Run 所有。牌区目前只是状态槽位及其守恒校验，没有抽牌、打牌或场景行动行为；Location 目前也只是被声明和计数的局内状态，没有路线边或分支逻辑。

## 创建与局部转移

`operationEntry.start(eventId, characterIds)` 首先要求非空稳定 event ID 及 Character ID 列表；受信 resolver 返回的 event ID 必须匹配请求，事件定义会检查 Location ID、轨道与 Actor 初值范围、事实和物品引用、PlayerCost、牌区形状、action requirements 及可选随机 seed。Admission 验证参与者槽位、学生身份/Profile 配对及非学生引用边界；随后 `resolveOperationRunStart()` 构建 actorId 对应、Profile ID 关联的完整 Actor 初始化输入。

owner 在修改当前 Run 前先校验事件定义和所有 Actor 初始化（每个定义 Actor 恰好一个，学生 Profile 与 actionRequirements 投影相符），然后深拷贝/冻结输入并一次创建完整 EventRun 与 actorStates。只有完整 Run 写入 owner slot 后才发布 `runStarted` 和 `locationEntered`；任何验证、Profile 投影或初始化失败都不会留下部分新 Run 或发出生命周期事件，既有进行中的 Run 也不会被无效初始化替换。

GameInstance 公共入场始终使用完整 `OperationRunStartInput`。`OperationRuntimeService` 的低层结构测试入口仍可只接收 `OperationEventDef`，但不经 GameInstance，也不生成角色身份/Profile snapshot。

`applyStateDelta()` 对轨道、事实、持有物、Actor 和路线玩家状态的一个批次先校验再提交。未声明的键、越界数值、畸形 delta 或牌区 ID 多重集变化会拒绝整个批次，不留下部分写入。批内字段变化不逐项发事件。

`enterLocation()` 只接受定义过的 Location ID 并增加对应访问次数；`completeCurrentLocation()` 标记当前 Location 完成。`finish()` 生成冻结的 `EventResult`，结果种类为 `success`、`partialSuccess` 或 `failure`；终局 Run 不再接受状态转移，重复结束会返回已有结果。

## 本地生命周期通知

内部 `OperationRuntimeService.subscribe()` 通知以下边界：`runStarted`、`locationEntered`、`locationCompleted`、`runFinished`。这些通知不扩展 Engine 通用事件类型，且不由 `GameInstance.operationEntry` 公共 facade 暴露。生命周期回调期间禁止重入修改 Run 或清理服务；单个 listener 抛出的异常会被隔离，不中断已提交转移或其余 listener。

## GameInstance 清理边界

| GameInstance 操作 | Operation Runtime 行为 |
| --- | --- |
| `stop()` | 只停止 Session Tick；保留当前 Run。 |
| `init()` | 清除当前易失 Run，再装载内容。 |
| `load()` | 清除当前易失 Run；不会从 SaveData 恢复 EventRun。 |
| `reset()` | 清除当前易失 Run。 |
| `reload()` | 通过 `stop()` → `reset()` → `init()` 重载；最终清除旧 Run。 |
| `dispose()` | 停止 Session Tick 并 dispose 私有 owner；此后启动请求会失败。 |

Operation Runtime 没有存档、恢复或跨 Runtime 共享路径。只读快照 facade 在清理后仍存在，但空 Run 返回 `null`。

## 静态资格之外的后续机制

`actionRequirements` 和 `OperationStudentProfileSnapshot` 当前只表达事件声明的候选资格、能力缺口、优先次序与理由；Profile 未匹配事件声明的候选不会成为本局静态行动候选。Wait fallback 只描述无合格候选时的固定安全计划，不会自动执行。

`playerRouteState.playerCost` 与 `random.seed/cursor` 当前是 EventRun 状态槽；此机制页描述的实现没有 SceneAction 批次、目标选择、Action 费用支付、PreparedBeat、Resolution、Commit 或随机流消费。战术行动与 Commit/RNG 由 Task 0215 建立，目标处理后续由 Task 0217 丰富；非战斗 SceneAction / 共享 PlayerCost 及玩家场景卡分别由 Task 0224/0225 提供，路线内容合同由 Task 0218/0220 处理。Profile 中的 `randomSkillRuleId` 仅保留引用，不代表技能已运行。

## 代码与测试

- `src/arona-clicker/contracts/operation.ts`：定义与运行态公开形状。
- `src/arona-clicker/contracts/operation-participant.ts`、`student-operation-profile.ts`、`operation-content-resolver.ts`：受信事件内容与 admission DTO 形状。
- `src/arona-clicker/services/operation-entry-service.ts`、`operation-participant-admission.ts`、`student-operation-profile-resolver.ts`：ID-only entry、身份/Profile admission、Admission DTO 到完整 run-start input 的一次性投影。
- `src/arona-clicker/services/operation-definition-validation.ts`：事件定义与引用校验。
- `src/arona-clicker/services/operation-runtime-service.ts`：Run owner、局部转移和生命周期通知。
- `src/arona-clicker/runtime-options.ts`、`runtime-wiring.ts`、`runtime-game-instance.ts`：resolver 注入、entry 装配、私有 owner 与生命周期清理。
- `tests/engine/student-operation-runtime.test.ts`：Actor/Profile 配对、静态候选资格与排序、Wait 回退、快照冻结和原子初始化验收。
- `tests/engine/operation-runtime-service.test.ts`：定义验证、Run 隔离、转移原子性和内部本地通知测试。
- `tests/engine/operation-participant-admission.test.ts`：受信 resolver、roster/Profile admission 和失败时不启动 owner。
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`：公开 facade、GameInstance 隔离和生命周期测试。

相关边界：[[docs/docs-829/01-architecture/data-flow]]、[[docs/docs-829/02-modules/arona-clicker]]、[[docs/docs-829/03-data-structures/player-state]]。
