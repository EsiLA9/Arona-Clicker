# 02-modules/arona-clicker — AronaClicker 领域模块

本文说明产品领域层如何把玩家操作、状态写入、世界线生命周期与只读视图组织起来。内容依据 `src/arona-clicker/` 当前实现；它描述职责边界，不将设计规划当作已实现机制。

## 边界

`src/arona-clicker/` 是产品领域层，持有 AronaClicker 的玩家状态类型、业务服务、运行时装配、存档编解码和 ReadModel。它消费 Engine 与 Data Services 提供的通用机制和定义查询，不是基础 Engine 的内置内容来源。

正式默认内容由 `src/arona-clicker/content/default-datapack.ts` 提供。运行状态由 `PlayerState` 表示；服务以业务命令编排校验和规则，再通过 mutation port / `StateMutationService` 写入。UI 读取 `getView()` 等投影，不应直接操作状态。

## 主要职责

| 区域 | 职责 | 入口 |
| --- | --- | --- |
| `runtime*.ts`、`runtime/` | 组合 GameInstance、服务与外部端口 | `createAppRuntime()`、`GameInstance` |
| `services/` | 世界线、抽卡、培养、剧情、聊天等业务用例 | 各领域 Service/System |
| `services/operation-entry-service.ts`、`services/operation-participant-admission.ts`、`services/student-operation-profile-resolver.ts`、`contracts/operation-content-resolver.ts`、`contracts/operation-participant.ts`、`contracts/student-operation-profile.ts` | 按事件 ID 解析受信内容、核验学生并构造一次性 Actor/Profile 初始化快照后调用私有 Operation owner；只读快照经安全门面返回 | `GameInstance.operationEntry.start(eventId, characterIds)`、`operationEntry.getSnapshot()` |
| `services/operation-runtime-service.ts`、`contracts/operation.ts` | 每个 GameInstance 的私有易失 EventRun owner 与局部转移校验 | 仅由 Runtime / Operation 领域服务内部调用，不作为 GameInstance 公共属性暴露 |
| `state/`、`types/state.ts` | PlayerState、快照和集中写入实现 | `StateMutationService`、`InitSavepoint` |
| `read-model/`、`contracts/view.ts` | 将状态与派生查询投影成只读 GameView | `buildGameView()` |
| `content/` | 正式产品默认 Datapack | `default-datapack.ts` |

业务服务并不等同于状态写入口：例如 GachaService 负责抽取顺序、货币与 pity 规则，写入则委托 mutation port。InitService 管理转换时序，并与快照、引擎运行时子系统协作。

## 状态与视图

`PlayerState` 同时容纳账号级数据和当前 Init 数据；`PER_INIT_FIELD_SPECS` 定义快照捕获、清除、恢复行为。派生结果如可见性、统计、Affector 与当前剧情游标由相应系统管理，不能简单视为 PlayerState 字段的镜像。

`GameView` 是面向 UI 的投影，构建时复制若干集合和映射，并合入可见性、剧情、Affector、统计快照。扩展 UI 展示应确认应进入 PlayerState、派生系统还是只读投影。

`OperationRuntimeService` 管理的 EventRun 属于另一份易失局内状态，不属于 `PlayerState`、`InitSnapshot` 或 `GameView`。每个 `GameInstance` 都有自己的私有 owner；产品调用方经 `operationEntry.start(eventId, characterIds)` 请求入场，经 `operationEntry.getSnapshot()` 读取 detached snapshot，不能传入 EventDefinition 或取得通用状态写入口。当前 GameInstance 入场会把按 actorId/ProfileId 配对的 Character ID、静态 Profile 资格快照及非学生 participantKind/faction 信息原子加入 Run；Variant ID、CharacterData、VariantProgress 等持久角色对象不会复制到 Run。行动执行、目标、费用、Resolution 与 Commit RNG 不属于当前 Runtime/Profile 快照机制，详见 [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]。

## 深入阅读

- [[docs/docs-829/03-data-structures/player-state]]：状态分层与字段。
- [[docs/docs-829/03-data-structures/game-view]]：ReadModel 的输入输出边界。
- [[docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]：业务命令到状态变更的路径。
- [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]：Gameplay B 的 EventRun 状态 owner 与生命周期。
- [[docs/docs-829/06-wiki/30-arona-clicker-domain/00-index]]：领域概念导航。
