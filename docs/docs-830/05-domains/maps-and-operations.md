# docs-830/05-domains/maps-and-operations — 地图与作战

本文回答：地图流程与战术作战如何分别持有运行过程，并向界面提供结果。

## 两种运行对象

地图 Run 由 `MapRunService` 管理，围绕地图节点、路线、遭遇、行动和局内结果推进。产品 Runtime 提供开始、重启及查询入口，UI 经 Controller 命令操作地图工作区。

开始地图前，Runtime 解析地图定义并校验成员快照、起始节点与初始成本。Run 创建后保存本局队伍快照、角色状态、资源和地图事实；后续节点与遭遇提交作用于这个 Run。MapRun 是独立运行态，地图关卡过程不直接等同于跨 Init 的 PlayerState。

MapRun 使用定义的 `resumeVersion` 判断存档是否仍可恢复。读取存档时先解析当前地图定义并重验版本与 Run 快照；不兼容时只拒绝该局续玩并记录诊断，基础 PlayerState 仍可恢复。

作战 Run 由 `OperationRuntimeService` 管理。`operationEntry` 先解析并校验入场角色与内容，再创建本局运行状态；界面通过版本化命令提交干预、行动、路线或 Beat，服务校验后提交结果并生成下一步视图。

作战入场由 `OperationEntryService` 做角色与内容准入，再将本局 Actor/Profile 与规则输入交给私有 Run owner。Owner 校验战斗定义并复制冻结规则，生成初始 Run 和 PreparedBeat 后才发布 `runStarted`。战斗提交包含 `runId` 与 `planVersion`；服务用当前 Run 快照生成候选 Resolution，校验版本、地点和随机游标后一次替换 Run 状态。路线切换也经唯一的 `transitionRoute()` 写入路径。

一轮战斗的核心分层是：

```text
入场准入 → Run 快照 / Actor 与规则冻结 → PreparedBeat
  → 干预草稿 / 场景行动批次 → 纯 Resolution 规划
  → 版本校验与 Run 原子替换 → OperationView 投影
  → 地点目标完成 → 选择 Route 或得出终局 → 领取奖励
```

Action Planner 只计算候选结果；`OperationRuntimeService` 负责校验命令与提交 Run。Scene 卡牌实例在手牌/弃牌区移动，角色手牌按本局确定的内容与合法行动事实生成。Route/Outcome 根据地点目标、门禁和出口结算。OperationView 与 OperationObservation 是只读投影和有界诊断记录，不拥有 Run 状态；奖励成功领取后才经领域写入接口进入玩家进度。

```text
地图定义 → MapRunService → 地图 Run / 工作区视图

作战事件 + 入场成员 → Operation Entry 校验 → OperationRuntimeService
  → Run 快照 → 干预 / 行动 / 路线 / Beat 提交 → OperationView
```

两类 Run 都是局内运行对象，拥有各自的命令和查询视图；它们的状态归属不等同于长期玩家进度。

源码入口：`src/arona-clicker/services/map/map-run-service.ts`、`src/arona-clicker/services/operation/operation-entry-service.ts`、`operation-runtime-service.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`src/ui/controller/controller-actions-operation.ts`。

相关测试见 `tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/operation-runtime-service.test.ts`。

界面视图边界见 [[read-model-and-ui]]。

Operation 的准入、Run 生命周期与保存恢复见 [[operation-runtime-and-admission]]；行动准备、Scene 卡牌与版本化提交见 [[operation-action-planning]]。

Gameplay B 的地图定义、节点与局内生命周期见 [[gameplay-maprun-overview]]，遭遇与回合提交见 [[gameplay-maprun-encounters]]。世界区域导航属于另一套系统，从 [[area-map-overview]] 阅读。

## 如何区分两条流程

| 比较 | MapRun | Operation Run |
| --- | --- | --- |
| 入口 | 地图定义和已准入队伍快照 | Operation 事件、角色、Profile 与内容准入 |
| 主线 | 地图节点、移动、遭遇和局内结果 | Location、PreparedBeat、干预、行动解析及路线 |
| 状态所有者 | `MapRunService` | `OperationRuntimeService`，由 Entry 层协调入场 |
| 恢复 | 当前地图定义和 `resumeVersion` 参与校验 | 当前事件及角色 / Profile 与 `resumeVersion` 参与校验 |
| 长期玩家状态 | 局内状态不等于 PlayerState | Run 是独立快照，成功奖励才通过领域写入口进入玩家进度 |

两个流程都包含“行动”和“地图”，但不能因此把命令、快照或版本语义互换。具体 Operation 的准入与提交以 [[operation-runtime-and-admission]]、[[operation-action-planning]] 为准。

## 示例：地图移动被拒绝

`tests/engine/gameplay-b-map-run.test.ts` 展示了两类拒绝：未知地图或不完整队伍不能创建 Run；当前节点有未完成遭遇时不能移动。在有向路线测试中，从起点直接移动到不可达节点也会失败，原 Run 快照不变。地图节点是否可达取决于定义的有向连接，不应只根据画面上的相邻位置推断。

排查时先确认当前 Run 类型、定义与运行状态，再查看该类型的命令和对应测试；UI 显示结果是只读投影，不能代替实际 Run。
