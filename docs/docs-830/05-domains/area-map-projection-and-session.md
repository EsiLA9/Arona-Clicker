# Area Map：公开投影与界面会话

地图定义可能包含玩家尚不知道的目标。`AreaMapQuery` 把当前图变成只读公开视图，界面会话只保存本次浏览状态；真正的区域移动仍由 [[area-travel-and-transit]] 的命令完成。地图定义和作者校验见 [[area-map-overview]]。

## 从定义到公开视图

`getView(mapId)` 对当前地图评估 Reveal，不递归展开关联图。地图不存在或其 `existence` 不满足时返回 `null`；节点自身 `existence` 不满足时，该节点不进入视图。对于名称、用途和条件，同一 Reveal 类型没有声明时默认公开；有多条同类型触发条件时，任一满足即可公开。解锁使用 `unlockMet()` 的检查。

投影还要检查节点动作的目标。如果 `openMap` 的目标地图或 `attemptAreaTravel` 的目标 Area 不存在或存在性未揭示，视图中的 `action` 为 `null`，不公开原始目标 ID。视图仍可以包含动作种类和受节点自身 Reveal 控制的名称/外观；这不等于已经公开目标实体。若目标已公开但锁定，动作可见，`ready` 仍为 false。

旅行节点的 `ready` 还要求地图和节点解锁、目标存在且解锁，并通过本次旅行预检。可公开的条件也会受节点及目标的 condition Reveal 约束。公开投影序列化后形成视图 `revision`，供 UI 检测投影是否变化。

## 候选线为何可能消失或变为单向

定义中的候选线只有在两端公开动作均为 `attemptAreaTravel`，且其目标 Area 之间存在真实连接时才输出。双向连接投影为普通线；只有正向连接时为有向线；只有反向连接时，投影反转端点并标记有向。两端任一目标隐藏、节点缺失或没有真实连接时，该候选线不显示。

`tests/engine/area-map-fast-travel.test.ts` 构造了一张包含 home 与 shop 候选线的假想图；没有真实连接时投影的线为空，且旅行预检失败。相反，隐藏整张地图不一定使领域旅行失效，因为地图 Reveal 与实际旅行拓扑是不同检查。

## 会话保存什么

打开入口时，`AreaMapController` 检查当前世界位置、前台交互许可和入口投影，再创建 `AreaMapSession`。会话记录来源 Init / Area、runtime generation、当前图、选中节点、浏览历史、每张图的相机、提交状态和反馈。它保存在 UI 的 `panelState.areaMapSession` 中，是临时界面状态，不是 PlayerState 或持久 MapRun。

| 用户操作 | 当前行为 |
| --- | --- |
| 选择普通节点 | 更新会话选择并展示公开信息；不移动玩家。 |
| 选择可用的 `openMap` 节点 | 读取目标投影并切换当前图，保存上一图及选择供返回；同图切换不额外堆叠历史。 |
| 返回 | 重新查询历史图，跳过不可用或未解锁的图，并仅恢复仍存在的选择。 |
| 拖动、缩放、适配或重置 | 改变当前图的相机；每张图在本会话有自己的 viewport。 |
| 前往 | 重查当前投影与节点可用性，再调用 `travelToArea`；成功关闭地图，失败保留会话及反馈。 |

界面的区域侧栏也可发出旅行命令，最终仍通过相同领域校验。浏览或切换地图不等于旅行。

## 过期状态与释放

选择节点和通过地图按钮提交旅行前，Controller 会重新读取公开视图，并比较投影与会话修订。若定义、Reveal、路线或其他公开内容已变化，就先刷新，不使用旧节点动作提交。

`reconcileAreaMap()` 在公开投影变化时尽量保留相机和仍有效的选择；选中节点消失或动作变化时清除选择与反馈。界面可针对地图区域做局部更新，而不是因为每次状态变化都重建整个页面。

会话依赖其打开时的 Init、Area 和 runtime generation。如果位置或世界线已改变、运行时已重载、前台交互不再允许打开地图，或页面路由已离开，会话会关闭或释放。当前图不再可查询时，Controller 尝试回到当前 Area 的入口图；入口也不可用则关闭。

排查“按钮已显示却没有移动”时，先检查点击时的 `ready`、前台交互许可与视图修订，再检查最终旅行命令返回的错误；不要将旧画面或地图候选线当作通行授权。

源码：`src/arona-clicker/services/world/area-map-query.ts`、`src/ui/workspace/area-map-controller.ts`、`src/ui/workspace/area-map-session.ts`、`src/ui/workspace/area-map-dom.ts`、`src/ui/workspace/area-map-camera.ts`。测试入口：`tests/engine/area-map-query.test.ts`、`tests/ui/area-map-controller.test.ts`、`tests/ui/area-map-session.test.ts`、`tests/ui/area-map-camera.test.ts`。
