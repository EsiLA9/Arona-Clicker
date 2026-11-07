# Area 旅行：实际通路、探索与交通

区域旅行改变玩家在当前 Init 内的实际位置。`AreaTravelGraph` 和 `InitService` 决定通路及命令结果；地图上的节点和线只是面向玩家的投影。地图定义见 [[area-map-overview]]。

## 真实连接从哪里来

`GameInstance.getAreaTravelGraph()` 根据当前 Registry 和运行态创建查询图，合并：

1. `AreaDef.adjacentAreaIds` 中的静态有向连接。
2. Runtime Editor Overlay 提供的区域连接，以及当前活跃 Affector 提供的连接；连接声明可为单向或双向。
3. 当前活跃 Affector 提供的交通网络；网络成员之间可以形成可查询的交通连接。

普通连接的两端必须存在且属于同一 Init；交通查询同样按当前世界线限制目的地。图在查询时从活跃来源构造；来源移除或失活后，其连接不因曾经画在地图上或曾被访问而永久保留。`tests/engine/area-map-fast-travel.test.ts` 覆盖移除电梯强化后连接和地图投影线消失的情形。

## 三种路线

`buildAreaTravelRoutes()` 从当前位置一次遍历普通连接与交通网络，再加入当前 Init 已收录地图明确声明的直达目的地。目的地的存在信息和 `enterCondition` 仍须满足。返回的 `method` 描述这次查询找到的路径类型：

| 方法 | 典型情况 | 重要限制 |
| --- | --- | --- |
| `adjacent` | 当前 Area 的一条普通有向连接直接通向目标。 | 目标不必已经访问，但仍要符合可见与解锁等检查。 |
| `visited` | 经已探索的普通路径前往之前到访的区域。 | 从中间节点继续扩展时，该节点必须已访问且 `quickPassage !== false`；后续普通边的目标也须已访问。 |
| `transit` | 从可到达的网络成员使用交通网络到其他成员。 | 目标可以未访问；只有允许通行的已访问中间区域能继续扩展后续路径。 |
| `mapDirect` | 已收录 AreaMap 上公开且动作条件满足的 `mapDirect` 节点。 | 仅增加节点声明的目标，不生成邻接，也不从该目标继续扩展普通路线。目标存在信息与 `enterCondition` 仍需满足。 |

这些名称是路线查询结果，不是地图绘图方式。若直接相邻路径和其他路径都提供同一目的地，查询会优先标记 `adjacent`；`mapDirect` 只在没有普通来源时增加目标。`reachableAreaIds()` 还包含直接出口，即使其中有的当前被锁定；是否真正能移动仍要调用旅行预检。

## 例子：探索后跨区域返回

`tests/engine/area-map-fast-travel.test.ts` 使用可加载的区域地图演示包：玩家进入商场入口后，激活的电梯网络可把玩家送到尚未访问的二楼大厅，预检结果为 `transit`。店铺最初不能直接抵达；沿一楼大厅和走廊逐步到达店铺后，返回已访问的一楼大厅可走 `visited` 路线。另有一处身份尚未公开的休息点，收录楼层图后可由明确的 `mapDirect` 节点前往；成功进入前其真实名称不会显示。

测试将中间走廊的 `quickPassage` 设为 `false` 后，返回预检失败；恢复为 `true` 后重新成功。如果随后移除必要的普通连接，即便两端都曾访问，返回仍会失败。这个例子同时说明：已访问记录、允许中转和当前真实通路需要共同成立。

## 从预检到命令

`InitService.getAreaTravelStatus()` 创建只读查询；`travelToArea()` 会重新创建并执行同一套检查，而不是信任旧 UI 结果。常规玩家命令检查目标存在、属于活动 Init、剧情是否阻塞移动、是否已经在目标、Area 的存在信息与当前 `enterCondition`，以及路线是否可用。失败可能返回 `NotFound`、`NotInThisInit`、`StoryBlocked`、`AlreadyThere`、`Locked` 或 `NotAdjacent`，不执行后续进入流程。知识是记住的信息；`enterCondition` 是当前能力门槛，两者不能互相替代。

成功时服务清理正在播放的被动剧情，设置 `currentAreaId` 和 `visitedAreas`，按 Area 的 `onVisitReveal`（省略时为存在与身份）记录实际到访知识，再初始化默认 Spot、记录统计并发出 `areaEntered`，之后应用进入效果、刷新可见性、重新检查 Affector 和协调 Milestone。直达只省略途中移动；不补写途中地点的到访、进入效果或奖励。预检本身不写状态。

剧情自身触发的移动可通过 `allowDuringStory` 放行剧情阻塞，并可用 `checkAdjacency=false` 跳过拓扑检查；仍会检查目标、当前 Init、可见与解锁等其他条件。它是有明确调用参数的特殊路径，不能当作普通玩家旅行规则。

## 位置与保存

`currentAreaId`、`visitedAreas` 与 `collectedAreaMapIds` 属于每 Init 状态快照；地图收录在切换 Init 时随该快照恢复或在重置时清空。`informationRevealProgress` 是 Save 级知识事实。它们都不同于地图会话中的当前浏览图、选择和相机。保存机制见 [[init-state-snapshots]] 与 [[save-system-and-recovery]]。

排查时依次确认：当前 Init 和 Area；目标存在信息与 `enterCondition`；真实有向连接、活跃交通网络或已收录地图中的直达节点；中间区域是否已访问且允许通行；最后检查剧情阻塞与提交时的最新状态。

源码：`src/arona-clicker/services/world/area-travel-routes.ts`、`src/arona-clicker/services/world/init-service.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`src/arona-clicker/state/per-init-fields.ts`。测试入口：`tests/engine/area-map-travel.test.ts`、`tests/engine/area-map-fast-travel.test.ts`。
