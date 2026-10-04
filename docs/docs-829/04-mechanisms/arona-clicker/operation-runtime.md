# 04-mechanisms/arona-clicker/operation-runtime — Gameplay B EventRun Runtime

本文说明 Gameplay B 的局内 EventRun 如何归属、接受局部状态转移，并随 AronaClicker Runtime 生命周期清理。事实依据为 Operation Runtime 实现与定向测试；路线图、场景行为与卡牌规则不在本文描述范围内。

## Runtime owner

`wireGameInstance()` 为每个 `GameInstance` 创建独立的 `OperationRuntimeService`，并通过 `GameInstance.operationRuntime` 暴露命令与只读快照入口。自定义 no-op Wiring 未创建该服务时，`GameInstance` 会补建一个实例。服务持有当前 Run 的唯一可变副本，不依赖通用 Engine `EventBus`。

调用方将 `OperationEventDef` 传给 `operationRuntime.start()`；服务先完整校验定义，再创建 Run。当前定义入口尚未接入 Datapack / Registry。Run 是独立易失的局内 owner，不进入 `PlayerState`、`InitSnapshot` 或 `SaveData`；读取通过深拷贝且冻结的快照完成，外部修改快照不会写回服务。

## EventRun 内容

| 子状态 | 当前持有内容 |
| --- | --- |
| `eventState` | 有界数值轨道、已知事实 ID、持有物 ID。 |
| `actorStates` | 定义的参与者 ID / 类型、HP 与各自有界资源的运行值。 |
| `playerRouteState` | 非负有限的 `playerCost` 数值和 `drawPile`、`hand`、`discard`、`played` 四个牌区的 ID 列表。局部更新须保持初始牌组的 ID 多重集不变。 |
| `locationProgress` | 定义中的每个 Location 的访问次数和完成标记；初始 Location 从一次访问开始。 |
| `random` | 定义的 seed 与运行游标字段。 |

这些字段都由同一个 Run 所有。牌区目前只是状态槽位及其守恒校验，没有抽牌、打牌或场景行动行为；Location 目前也只是被声明和计数的局内状态，没有路线边或分支逻辑。

## 创建与局部转移

`start()` 会检查事件 ID、Location 引用、轨道与 Actor 初值范围、事实和物品引用、PlayerCost、牌区形状及可选随机 seed。校验失败会返回诊断且不创建 Run；有效定义会创建 `inProgress` Run，并记录起始 Location。

`applyStateDelta()` 对轨道、事实、持有物、Actor 和路线玩家状态的一个批次先校验再提交。未声明的键、越界数值、畸形 delta 或牌区 ID 多重集变化会拒绝整个批次，不留下部分写入。批内字段变化不逐项发事件。

`enterLocation()` 只接受定义过的 Location ID 并增加对应访问次数；`completeCurrentLocation()` 标记当前 Location 完成。`finish()` 生成冻结的 `EventResult`，结果种类为 `success`、`partialSuccess` 或 `failure`；终局 Run 不再接受状态转移，重复结束会返回已有结果。

## 本地生命周期通知

服务本地 `subscribe()` 通知以下边界：`runStarted`、`locationEntered`、`locationCompleted`、`runFinished`。这些通知不扩展 Engine 通用事件类型。生命周期回调期间禁止重入修改 Run 或清理服务；单个 listener 抛出的异常会被隔离，不中断已提交转移或其余 listener。

## GameInstance 清理边界

| GameInstance 操作 | Operation Runtime 行为 |
| --- | --- |
| `stop()` | 只停止 Tick；保留当前 Run。 |
| `init()`、`load()`、`reload()`、`reset()` | 清除当前易失 Run，服务仍可继续使用。 |
| `dispose()` | 停止 Tick，并清除 Run 与本地订阅者；之后不能再使用该服务。 |

`load()` 不会恢复 EventRun。Operation Runtime 没有存档、恢复或跨 Runtime 共享路径。

## 代码与测试

- `src/arona-clicker/contracts/operation.ts`：定义与运行态公开形状。
- `src/arona-clicker/services/operation-definition-validation.ts`：事件定义与引用校验。
- `src/arona-clicker/services/operation-runtime-service.ts`：Run owner、局部转移和生命周期通知。
- `src/arona-clicker/runtime-wiring.ts`、`src/arona-clicker/runtime-game-instance.ts`：每实例装配与清理接线。
- `tests/engine/operation-runtime-service.test.ts`：定义验证、Run 隔离、转移原子性和本地通知测试。
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`：GameInstance 隔离与生命周期测试。

相关边界：[[docs/docs-829/01-architecture/data-flow]]、[[docs/docs-829/02-modules/arona-clicker]]、[[docs/docs-829/03-data-structures/player-state]]。
