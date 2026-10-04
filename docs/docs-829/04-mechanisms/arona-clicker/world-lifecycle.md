# 04-mechanisms/arona-clicker/world-lifecycle — Init 与 Area 生命周期

本文概述 InitService 当前实现的世界线选择、快照恢复、重启与区域移动流程。Init 在产品代码中也称世界线；本页只记录已实现行为。

## Init 转换

`startNewGame(initId)` 校验定义与购买条件，停止旧运行时，创建默认状态并播种 Registry/Init Extra，再重置并重绑依赖服务，解锁并进入目标 Init。若从 Lobby 首次开始，会保留大厅期间取得的 globalResources、已解锁 Init 和 global Enhancement。

`resumeInit(initId)` 在切换时先保存并退出当前 Init；存在快照则恢复，否则清理 Init 局部字段并用目标 Init 初始化。随后更新各系统所持状态引用、开始会话并进入目标 Init。

`restartInit()` 保存当前 Init 快照并清除当前 Run 的 per-Init 字段，回到等待选择的状态。`hardRestartInit()` 删除当前 Init 的快照并将其字段重新播种；`hardResetInit(initId)` 只删除指定快照。

转换期间会停止 Tick、使 runtime generation 失效、撤销相关 watch、卸载 Init Trigger、清理事件队列与当前剧情运行时。进入 Init 时挂载对应 Trigger、更新位置与可见性并执行定义要求的进入流程。热改 Init/Area 定义后的 reconcile 负责修复挂载和定位，不重放进入效果。

## Area 移动

移动校验目标定义属于当前 Init、剧情是否阻断移动、是否已在目标处、拓扑可达性以及可见性。成功后更新当前位置和首次访问记录，初始化 Area 的 defaultSpots（尚未建设者），记录统计并发出 `areaEntered`，再执行进入效果、刷新可见性及重检 Affector/Milestone。

## 生命周期状态

Init 字段的具体快照范围由 [[docs/docs-829/03-data-structures/player-state]] 所述的 `PER_INIT_FIELD_SPECS` 决定。保存格式和运行时重建由 InitService 与 InitSavepoint 协作，不代表 Runtime 派生对象被整体复制。

## 代码入口

- `src/arona-clicker/services/init-service.ts`
- `src/arona-clicker/state/init-savepoint.ts`
- `src/arona-clicker/state/per-init-fields.ts`
- `tests/engine/init-global-lifecycle.test.ts`
- `tests/engine/session-service.test.ts`
