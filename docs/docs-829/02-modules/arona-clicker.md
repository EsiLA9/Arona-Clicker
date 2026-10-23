# 02-modules/arona-clicker — AronaClicker 领域模块

本文说明产品领域层如何把玩家操作、状态写入、世界线生命周期与只读视图组织起来。内容依据 `src/arona-clicker/` 当前实现；它描述职责边界，不将设计规划当作已实现机制。

## 边界

`src/arona-clicker/` 是产品领域层，持有 AronaClicker 的玩家状态类型、业务服务、运行时装配、存档编解码和 ReadModel。它消费 Engine 与 Data Services 提供的通用机制和定义查询，不是基础 Engine 的内置内容来源。

base 默认内容由 `src/arona-clicker/content/default-datapack.ts` 提供；当前 Gameplay B 默认只装载 Runtime 装配的 Map-only `gameplay-b@1.0.0` bundle。旧 Carousel / Strategy Park Operation 内容不再随第一方包装载，Strategy Park bundle 已退役；包仍经同一 PackManager/Registry 流程管理。运行状态由 `PlayerState` 表示；服务以业务命令编排校验和规则，再通过 mutation port / `StateMutationService` 写入。UI 读取 `getView()` 等投影，不应直接操作状态。

## 主要职责

| 区域 | 职责 | 入口 |
| --- | --- | --- |
| `runtime/` | 组合 GameInstance、服务与外部端口；集中运行时命令、存档和装配 | `createAppRuntime()`、`GameInstance` |
| `services/{character,economy,map,operation,presentation,progression,runtime,story,world}/` | 按产品领域归组业务用例与运行服务；根 `services/index.ts` 保留统一导出 | 各领域 Service/System |
| `contracts/{character,economy,map,operation,presentation,progression,runtime,story,world}/` | 按领域归组产品端口、命令和只读数据合同；根 `contracts/index.ts` 保留统一导出 | Runtime 与领域服务的窄接口 |
| `services/operation/operation-entry-service.ts`、`services/operation/operation-participant-admission.ts`、`services/operation/student-operation-profile-resolver.ts`、`contracts/operation/operation-content-resolver.ts`、`contracts/operation/operation-participant.ts`、`contracts/operation/student-operation-profile.ts` | 按事件 ID 解析受信内容、核验学生并构造一次性 Actor/Profile 初始化快照后调用私有 Operation owner；只读快照经安全门面返回 | `GameInstance.operationEntry.start(eventId, characterIds)`、`operationEntry.getSnapshot()` |
| `services/operation/operation-runtime-service.ts`、`contracts/operation/operation.ts` | 每个 GameInstance 的私有易失 EventRun owner 与局部转移校验 | 仅由 Runtime / Operation 领域服务内部调用，不作为 GameInstance 公共属性暴露 |
| `state/`、`types/state.ts` | PlayerState、快照和集中写入实现 | `StateMutationService`、`InitSavepoint` |
| `read-model/`、`contracts/runtime/view.ts` | 将状态与派生查询投影成只读 GameView | `buildGameView()` |
| `content/{character,economy,gameplay-b,progression,story,world}/` | 按内容主题归组作者定义；基础包与内容工厂分开放置 | `default-datapack.ts`、`gameplay-b/`、`def-factory/`、`base-pack/` |

业务服务并不等同于状态写入口：例如 GachaService 负责抽取顺序、货币与 pity 规则，写入则委托 mutation port。InitService 管理转换时序，并与快照、引擎运行时子系统协作。

## 状态与视图

`PlayerState` 同时容纳账号级数据和当前 Init 数据；`PER_INIT_FIELD_SPECS` 定义快照捕获、清除、恢复行为。派生结果如可见性、统计、Affector 与当前剧情游标由相应系统管理，不能简单视为 PlayerState 字段的镜像。

`GameView` 是面向 UI 的投影，构建时复制若干集合和映射，并合入可见性、剧情、Affector、统计快照。扩展 UI 展示应确认应进入 PlayerState、派生系统还是只读投影。

`OperationRuntimeService` 管理的 EventRun 属于另一份局内状态，不属于 `PlayerState`、`InitSnapshot` 或 `GameView`；主 SaveData 只持有可选、受 `resumeVersion` 约束的 Run checkpoint。每个 `GameInstance` 都有自己的私有 owner；产品调用方经窄 `operationEntry` facade 请求固定阵容准入、干预、战斗/场景结算、路线转场与一次性奖励提交。Run 内冻结参与者身份、展示名/头像、Profile 资格及战术规则，不复制 Variant ID、`CharacterData` 或 `VariantProgress`。通用 Operation / EventRun Runtime 仍保留，但旧 Carousel 与 Strategy Park 示例已不属于当前第一方 Gameplay B 内容；Map-only 包的装载与恢复选择见 [[pack-loading]]。

## 深入阅读

- [[docs/docs-829/03-data-structures/player-state]]：状态分层与字段。
- [[docs/docs-829/03-data-structures/game-view]]：ReadModel 的输入输出边界。
- [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]：业务命令到状态变更的路径。
- [[operation-runtime]]：Gameplay B 的 EventRun 状态 owner 与生命周期。
- [[docs/docs-829/06-wiki/30-arona-clicker-domain/00-index]]：领域概念导航。

## 验证入口

- `tests/engine/arona-runtime-pack.test.ts`：检查基础内容、正式 Gameplay B 包和 PackManager/Registry 装配。
- `tests/engine/state-mutation-service.test.ts`：检查代表性 PlayerState 写入、拒绝和事件发布。
- `tests/engine/operation-runtime-service.test.ts`：检查 Gameplay B EventRun 的运行时约束；该 Run 与 PlayerState 分开归属。

定向测试说明具体行为和边界；完整测试选择见 [[docs/docs-829/06-wiki/60-engineering-support/testing]]。
