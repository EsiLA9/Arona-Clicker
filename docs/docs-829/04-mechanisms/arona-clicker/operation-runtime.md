# 04-mechanisms/arona-clicker/operation-runtime — Gameplay B EventRun Runtime

本文说明 Gameplay B 的局内 EventRun 如何经受控入场创建、归属私有 Runtime owner、接受局部状态转移，并随 AronaClicker Runtime 生命周期清理。当前 ActorState 内容按已落地的 U1 实现描述；角色/Profile Actor 快照尚未接入。路线图、场景行为与卡牌规则不在本文描述范围内。

## Runtime owner

每个 `GameInstance` 在私有字段 `#operationRuntimeOwner` 中持有一个 `OperationRuntimeService`；服务实例不经 `GameInstance` 公共属性暴露。`GameInstance.operationEntry` 是窄入口，公开的 `OperationEntryFacade` 只有 `start(eventId, characterIds)` 和 `getSnapshot()`，不会暴露 raw owner 的 `applyStateDelta()`、`finish()`、`reset()`、`dispose()` 或本地监听 API。

`GameInstance` 构造时使用 `GameInstanceOptions.operationContentResolver` 配置受信 `OperationContentResolver`；省略时使用空 resolver，没有可启动事件。标准 `runtime-wiring.ts` 通过组合钩子向 entry 提供 `CharacterSystem`、`RosterSystem` 和当前 state 读取器。自定义/no-op Wiring 仍得到封闭的 entry facade，但缺少 AC 身份服务时不能启动学生队伍。`GameInstanceOptions.wiring` 是受信组合根/测试替身，不是隔离对抗式扩展代码的权限边界；普通 Operation 调用方仍只能经 facade 传入 ID。

## 受控入场与当前 U1 边界

公开调用方只提交事件 ID 与选定的 Character ID 列表，不提交 `OperationEventDef`、Actor spec、Profile 或其他解析后内容。`OperationEntryService.start()` 按该 ID 调用构造时的 resolver；Admission 验证 resolver 返回的事件 ID/定义、参与者槽位与 Profile 结构，并在调用 owner 前完成学生入场检查：Character 定义存在、存在真实且持有的 Registry Variant、Variant `proto` 与 Character ID 相符、`CharacterSystem.getUnlocked(state)` 包含该 Character、Profile 存在且匹配。

对手和环境参与者不经过玩家 roster / Student Profile 检查。任何解析或 admission 诊断都会在 owner `start()` 前抛出；失败请求不创建 Run，也不发出 `runStarted`。验证成功后，entry 才将 resolver 提供的 `OperationEventDef` 传给私有 owner。读取 Run 只能经 `operationEntry.getSnapshot()`，获得 detached、冻结的副本。

Admission 成功后会生成 detached `OperationAdmission` DTO，其中含已准入参与者与匹配的 Profile。当前 `OperationEntryService.startAdmitted(admission)` 只将 `admission.eventDefinition` 传给私有 owner；不会按 Run ID 缓存或保留该 DTO。**因此当前 EventRun 尚未包含 DTO 中的 Character、Variant、Profile、faction、能力或优先项信息**，`actorStates` 仍只有定义中的 actor ID/type 和运行中的 HP/resources。U2 将消费 Admission DTO 并把需要的身份/Profile 信息写入 EventRun Actor 快照；在此之前它只作为 admission 结果，不是 EventRun 的状态。

Run 是独立易失的局内 owner，不进入 `PlayerState`、`InitSnapshot` 或 `SaveData`。当前 resolver 是构造时配置的内容入口，Operation 定义尚未从 Datapack / Registry 自动装载。

## EventRun 内容

| 子状态 | 当前持有内容 |
| --- | --- |
| `eventState` | 有界数值轨道、已知事实 ID、持有物 ID。 |
| `actorStates` | 定义的 actor ID/type、HP 与各自有界资源的运行值；当前不含 Character、Variant、Profile、faction 或 Profile 能力数据。 |
| `playerRouteState` | 非负有限的 `playerCost` 数值和 `drawPile`、`hand`、`discard`、`played` 四个牌区的 ID 列表。局部更新须保持初始牌组的 ID 多重集不变。 |
| `locationProgress` | 定义中的每个 Location 的访问次数和完成标记；初始 Location 从一次访问开始。 |
| `random` | 定义的 seed 与运行游标字段。 |

这些字段都由同一个 Run 所有。牌区目前只是状态槽位及其守恒校验，没有抽牌、打牌或场景行动行为；Location 目前也只是被声明和计数的局内状态，没有路线边或分支逻辑。

## 创建与局部转移

`operationEntry.start(eventId, characterIds)` 首先要求非空稳定 event ID 及 Character ID 列表；受信 resolver 返回的 event ID 必须匹配请求，事件定义会检查 Location ID、轨道与 Actor 初值范围、事实和物品引用、PlayerCost、牌区形状及可选随机 seed。Admission 还验证参与者槽位、非学生引用边界和学生身份/Profile 配对。任何检查失败均在内部 owner `start()` 前给出诊断，不创建 Run；成功后 owner 创建 `inProgress` Run 并记录起始 Location。

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

## 代码与测试

- `src/arona-clicker/contracts/operation.ts`：定义与运行态公开形状。
- `src/arona-clicker/contracts/operation-participant.ts`、`student-operation-profile.ts`、`operation-content-resolver.ts`：受信事件内容与 admission DTO 形状。
- `src/arona-clicker/services/operation-entry-service.ts`、`operation-participant-admission.ts`：ID-only entry facade、身份/Profile admission；当前 `startAdmitted()` 只将事件定义传入 owner。
- `src/arona-clicker/services/operation-definition-validation.ts`：事件定义与引用校验。
- `src/arona-clicker/services/operation-runtime-service.ts`：Run owner、局部转移和生命周期通知。
- `src/arona-clicker/runtime-options.ts`、`runtime-wiring.ts`、`runtime-game-instance.ts`：resolver 注入、entry 装配、私有 owner 与生命周期清理。
- `tests/engine/operation-runtime-service.test.ts`：定义验证、Run 隔离、转移原子性和内部本地通知测试。
- `tests/engine/operation-participant-admission.test.ts`：受信 resolver、roster/Profile admission 和失败时不启动 owner。
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`：公开 facade、GameInstance 隔离和生命周期测试。

相关边界：[[docs/docs-829/01-architecture/data-flow]]、[[docs/docs-829/02-modules/arona-clicker]]、[[docs/docs-829/03-data-structures/player-state]]。
