# Area Map：公开投影与界面会话

地图定义可能包含玩家尚不知道的信息。`AreaMapQuery` 把当前图转换为只读公开视图；地图会话只保存本次浏览状态，真正移动由 [[area-travel-and-transit]] 的旅行命令提交。地图定义与作者校验见 [[area-map-overview]]。

## 从定义到公开视图

Area、AreaMap 与 Node 各自投影 `existence`、`name`、`utility`、`condition`。未声明的信息面默认公开；条件揭示在条件满足并经过信息写入适配器后成为 Save 级知识，之后即使条件回退也保留；`explicit` 规则只能由授权的 Story / Effect 写入。读取地图不会写入信息进度。合法开图命令可以观察当前地图，并在成功后按 `collection` 规则收录它。

`getView(mapId)` 只返回当前可查询的地图：地图存在信息未知或 `openCondition` 当前不满足时返回 `null`。存在信息未知的 Node 不进入投影。地图名、描述、节点文字、图标及目标引用按对应信息面遮挡；目标存在性未知时，节点 `action` 为 `null`，不会暴露原始目标 ID。公开但暂时不可用的动作可见，`ready` 为 false 并附安全的受阻原因。

节点 `ready` 同时检查节点 `actionCondition`、目标存在性以及领域命令预检。旅行动作进一步使用 Area `enterCondition` 和真实路线；`openMap` 动作使用目标地图的 `openCondition`。当节点与目标的信息面公开且有可展示条件时，视图才附带安全条件摘要。投影内容形成 `revision`，供 Controller 检测定义或状态变化。

## 真实连接与导览直达

地图 `edges` 是展示候选线，不创建旅行路线。只有两端节点存在、公开的动作目标均为旅行 Area，且目标间当前存在真实方向连接时，边才显示；单向连接会反映方向。

旅行来源还可以由已收录地图中的 `travelMode: 'mapDirect'` 节点提供。该节点的存在信息和动作条件必须满足，目标 Area 的存在信息必须已知，最终旅行仍复核 Init 归属、`enterCondition`、剧情阻塞和当前状态。`mapDirect` 只增加该明确目标；不会把直达后的地点作为普通路线中转。`openCondition` 只限制查看地图，不撤销已收录事实，也不单独封锁由已收录图声明的旅行来源。完整路线合同见 [[area-travel-and-transit]]。

## 会话与地图册

`AreaMapController` 通过入口、节点或地图册命令建立 `AreaMapSession`。会话记录当前图、来源、选择、返回历史和各图相机，不写入 PlayerState。工具栏按收录顺序显示已收录地图，并只提交目录索引；用户可以从地图册切图，即使当前位置 Area 没有 `navigationMapId`。切图、返回、拖动、缩放和适配都不移动玩家。

| 操作 | 结果 |
| --- | --- |
| 选择普通节点 | 更新会话选择并展示已公开信息，不移动。 |
| 打开 `openMap` 节点 | 重新检查来源节点和目标地图；成功切图，按 `collection` 决定是否收录。 |
| 从地图册打开 | 按当前 Init 的已收录索引重新检查地图存在信息和 `openCondition`；不重复收录。 |
| 前往 | 重新读取当前节点投影，再调用 `travelToArea`；成功旅行会执行完整 Area 进入流程，失败保留会话和反馈。 |
| 返回 / 关闭 | 返回仍可打开的历史图，或释放会话并恢复先前界面位置。 |

投影或内容热更新时，Controller 刷新地图区域并保留仍然有效的选择和相机。位置、Init、Runtime generation 或浏览许可变化会关闭或回退会话；失效地图不会删除玩家的收录事实。

排查“按钮可见但无法移动”时，检查点击时的 `ready`、节点 / 目标信息、动作条件、Area `enterCondition` 和最终旅行结果。排查“地图册能看到但打不开”时，检查当前地图定义、存在知识与 `openCondition`；不要把收录当成当前浏览许可。

源码：`src/arona-clicker/services/world/area-map-query.ts`、`area-map-commands.ts`、`area-travel-routes.ts`、`src/ui/workspace/area-map-controller.ts`、`area-map-session.ts`、`area-map-dom.ts`。测试：`tests/engine/area-map/area-map-query.test.ts`、`area-map-commands.test.ts`、`area-map-fast-travel.test.ts`、`tests/ui/area-map/area-map-controller.test.ts`、`area-map-session.test.ts`。
