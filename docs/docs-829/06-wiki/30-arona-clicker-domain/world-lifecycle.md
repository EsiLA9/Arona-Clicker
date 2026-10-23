# 06-wiki/30-arona-clicker-domain/world-lifecycle — 世界线与区域的运行周期

本文从产品使用概念解释 Init 选择、恢复、重启和 Area 移动，机制细节以同域文档为准。

可以把一次游戏进度想成一个“当前 Run”：它属于一条 Init（世界线），在其中进入不同 Area（区域），并解锁或升级 Spot（设施）。离开 Init 时，部分进度会记入该 Init 的快照；重新进入时恢复快照。global 字段和 local 字段的技术含义见 [[docs/docs-829/03-data-structures/player-state]]。

Init 表示一个可选择的世界线运行环境。进入前可以处于 Lobby；选择 Init 后，运行时恢复该 Init 的快照，或为其建立新的局部起点。软重启保存进度并退出当前 Run；硬重启清除该 Init 的快照。跨 Init 保留与局部字段的区别由状态快照登记表决定。

Area 移动受当前 Init、连通关系、可见性和剧情阻断条件约束。成功移动会记录访问、处理默认 Spot、触发进入事件与效果，并让相关派生系统重新评估。

新开游戏 `startNewGame()` 会创建默认 PlayerState，并进入目标 Init。`resumeInit()` 若当前已有活动 Init，会先保存并退出当前 Run，再恢复目标 Init 的快照；目标尚无快照时则以定义的起始状态建立新 Run。`restartInit()` 是软重启：保存局部快照并退出当前 Run；`hardRestartInit()` 删除当前 Init 的快照并为它重新准备起点。两种重启不是同一件事。

玩家移动 Area 时，`travelToArea()` 依次检查目标存在、属于当前 Init、剧情没有阻断、（通常）与当前位置相邻、当前可见。成功后才更新位置与访问记录、处理默认 Spot、记录统计并发出 `areaEntered`。剧情效果发起的移动可不查相邻关系，但仍须属于当前 Init。

部分完成后的故事会在未来进入目标 Area 时投递一个 ActiveStoryEntry。玩家在 AreaHero 内页手动接取后，界面返回一般游戏聊天区域播放；离开 Area 不清除未完成投递，只有正式完成才撤离并留下回执。待接取投递属于当前 Init，随该线存档恢复。

详细转换顺序见 [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle]]；状态范围见 [[docs/docs-829/03-data-structures/player-state]]。

## 从哪里核对

- `src/arona-clicker/services/world/init-service.ts`：`startNewGame()`、`resumeInit()`、`restartInit()`、`hardRestartInit()`、`travelToArea()`；公共门面由 Runtime 委托。
- `src/arona-clicker/state/init-savepoint.ts` 与 `src/arona-clicker/state/per-init-fields.ts`：决定哪些局部字段在离开时保存、重开时清空、恢复时还原。
- `tests/engine/init-global-lifecycle.test.ts` 验证直接切换 Init 会先保存当前进度、Story 游标随快照恢复、快照与活动状态不共享可变对象。移动的细节拒绝条件继续查 [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle]]。
