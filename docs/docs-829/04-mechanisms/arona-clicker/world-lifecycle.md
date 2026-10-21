# 04-mechanisms/arona-clicker/world-lifecycle — Init 与 Area 生命周期

本文概述 InitService 当前实现的世界线选择、快照恢复、重启与区域移动流程。Init 在产品代码中也称世界线；本页只记录已实现行为。

简单来说，Init 是一条独立游玩进度线，Area 是线上的区域。切换、重启和恢复 Init 会清理或恢复该线专属字段；在 Area 之间移动则只改变当前所在位置和由此触发的进入流程。

## Init 转换

`startNewGame(initId)` 校验定义与购买条件，停止旧运行时，创建默认状态并播种 Registry/Init Extra，再重置并重绑依赖服务，解锁并进入目标 Init。若从 Lobby 首次开始，会保留大厅期间取得的 globalResources、已解锁 Init 和 global Enhancement。

`resumeInit(initId)` 在切换时先保存并退出当前 Init；存在快照则恢复，否则清理 Init 局部字段并用目标 Init 初始化。随后更新各系统所持状态引用、开始会话并进入目标 Init。

`restartInit()` 保存当前 Init 快照并清除当前 Run 的 per-Init 字段，回到等待选择的状态。`hardRestartInit()` 删除当前 Init 的快照并将其字段重新播种；`hardResetInit(initId)` 只删除指定快照。

转换期间会停止 Tick、使 runtime generation 失效、撤销相关 watch、卸载 Init Trigger、清理事件队列与当前剧情运行时。进入 Init 时挂载对应 Trigger、更新位置与可见性并执行定义要求的进入流程。热改 Init/Area 定义后的 reconcile 负责修复挂载和定位，不重放进入效果。

## Area 移动

移动校验目标定义属于当前 Init、剧情是否阻断移动、是否已在目标处、拓扑可达性以及可见性。成功后更新当前位置和首次访问记录，初始化 Area 的 defaultSpots（尚未建设者），记录统计并发出 `areaEntered`，再执行进入效果、刷新可见性及重检 Affector/Milestone。

当前 Init 内，完成来源故事后启用的 `StoryFollowUp` 会等待未来匹配的 Area 进入事件。目标为 ActiveStoryEntry 时，匹配事件创建按 `entryId` 幂等的 `areaStoryDeliveries` 记录并提交 FollowUp once 标记；抵达不启动 Story，同一 Entry 不会被后续 FollowUp 移到另一个 Area。故事目录中仅靠可用条件开放的 9 个 ActiveStoryEntry，在首次满足 `availableInits` 与 `triggerCondition` 时投递到当时所在 Area；已有 Init、FollowUp 或羁绊卡来源的条目不进入这条自动发现路径。投递状态随 Init 快照和 Save 恢复，播放时游标继续引用来源 Entry，完成时精确更新该 Entry 的回执。AreaHero 接取通过 StoryService 正常准入并采用 Entry owner 游标；被占用的 owner 游标不会被抢占。PassiveStory FollowUp 保留原直接启动路径。

## 生命周期状态

Init 字段的具体快照范围由 [[docs/docs-829/03-data-structures/player-state]] 所述的 `PER_INIT_FIELD_SPECS` 决定。保存格式和运行时重建由 InitService 与 InitSavepoint 协作，不代表 Runtime 派生对象被整体复制。

世界线进入后的角色、剧情和业务状态如何写入，见 [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]；玩家可见的世界线功能路由见 [[docs/docs-829/06-wiki/30-arona-clicker-domain/world-lifecycle]]。

## 代码入口

- `src/arona-clicker/services/init-service.ts`
- `src/arona-clicker/state/init-savepoint.ts`
- `src/arona-clicker/state/per-init-fields.ts`
- `tests/engine/init-global-lifecycle.test.ts`
- `tests/engine/session-service.test.ts`
