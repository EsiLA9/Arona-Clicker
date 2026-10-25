# docs-830/05-domains/maps-and-operations — 地图与作战

本文回答：地图流程与战术作战如何分别持有运行过程，并向界面提供结果。

## 两种运行对象

地图 Run 由 `MapRunService` 管理，围绕地图节点、路线、遭遇、行动和局内结果推进。产品 Runtime 提供开始、重启及查询入口，UI 经 Controller 命令操作地图工作区。

开始地图前，Runtime 解析地图定义并校验成员快照、起始节点与初始成本。Run 创建后保存本局队伍快照、角色状态、资源和地图事实；后续节点与遭遇提交作用于这个 Run。MapRun 是独立运行态，地图关卡过程不直接等同于跨 Init 的 PlayerState。

作战 Run 由 `OperationRuntimeService` 管理。`operationEntry` 先解析并校验入场角色与内容，再创建本局运行状态；界面通过版本化命令提交干预、行动、路线或 Beat，服务校验后提交结果并生成下一步视图。

作战入场由 `OperationEntryService` 做角色与内容准入，再将本局 Actor/Profile 与规则输入交给私有 Run owner。Owner 校验战斗定义并复制冻结规则，生成初始 Run 和 PreparedBeat 后才发布 `runStarted`。战斗提交包含 `runId` 与 `planVersion`；服务用当前 Run 快照生成候选 Resolution，校验版本、地点和随机游标后一次替换 Run 状态。路线切换也经唯一的 `transitionRoute()` 写入路径。

```text
地图定义 → MapRunService → 地图 Run / 工作区视图

作战事件 + 入场成员 → Operation Entry 校验 → OperationRuntimeService
  → Run 快照 → 干预 / 行动 / 路线 / Beat 提交 → OperationView
```

两类 Run 都是局内运行对象，拥有各自的命令和查询视图；它们的状态归属不等同于长期玩家进度。

源码入口：`src/arona-clicker/services/map/map-run-service.ts`、`src/arona-clicker/services/operation/operation-entry-service.ts`、`operation-runtime-service.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`src/ui/controller/controller-actions-operation.ts`。

相关测试见 `tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/operation-runtime-service.test.ts`。

界面视图边界见 [[docs/docs-830/04-presentation/read-model-and-ui]]。
