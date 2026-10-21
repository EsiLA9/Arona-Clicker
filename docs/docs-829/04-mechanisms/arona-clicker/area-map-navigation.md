# 04-mechanisms/arona-clicker/area-map-navigation — 区域地图导航

本文回答：地图如何展示真实 Area 通路、提供信息与移动入口，以及探索和交通的领域边界。

## 地图与真实连接

Datapack.areaMaps 的 AreaMapDef 使用 mod:area-map:name ID；AreaDef.navigationMapId 是可选入口。多个 Area 可以共享地图，一个 Area 也可以出现在多张地图中。地图不拥有 Area，不授予通行资格，不持有交通开通状态。

Node 的 action 为 inspect、attemptAreaTravel 或 openMap。openMap 只切换浏览视图，不移动玩家，也不创建区域连接。Map.edges 仅是候选显示范围：查询先解析可见节点的目标 Area，再与实际连接相交。真实连接存在时可以不画，不存在时一定不画；单向连接按真实方向输出箭头，双向连接输出普通线。inspect 与 openMap 节点不作为区域通路线的端点。交通网络的连接同样来自领域查询；未激活的交通不渲染为可用通路。

实际连接由 AreaDef.adjacentAreaIds、Runtime topology overlay、Active Affector 的 areaConnections 与 areaTransitNetworks 合成。地图连线过滤和移动规划使用同一种 AreaTravelGraph 快照，后者不依赖 Map 定义、可见性或节点布局。

## 探索与快速返回

visitedAreas 继续仅记录真实抵达。普通相邻区域可以首次进入；非相邻的普通目的地必须已到访，并且当前存在由已到访、可快速通过区域组成的有向路线，才能快速返回。封路、单向连接和区域 existence／unlock 会改变路线结果；去过某地不代表它永远可达。命令提交时重新规划，不复用 UI 预检权限。

快速返回压缩已探索路段，只执行目标区域的正常进入流程，不重放中间区域的 areaEntered 或进入效果。已到访节点默认继续传递可达性；待接取剧情和重复进入效果不会自动截断路线。仅 quickPassage=false 的区域不能作为快速路线中间点，仍可作为抵达目标。需要强制停留的内容应显式声明 quickPassage=false。源区域与目标仍受正式 Story 移动锁、目标可见性及解锁校验保护。

AreaTravelGraph 的普通边使用邻接索引，交通网络使用隐式成员组。一次查询批次只遍历一次已探索图，网络成员组最多展开一次，不创建两两完全连接，也不对每个地图节点重复寻路。

源码入口：src/arona-clicker/services/area-travel-routes.ts、services/init-service.ts、runtime-game-instance.ts。

## 交通服务与发现信息

AffectorEffect.areaTransitNetworks 声明实际交通网络，每项包含 name 和 areaIds。该 entry Active 时成员之间存在双向交通连接；失活或撤销最后来源后，连接消失。交通可以抵达未到访成员，但不会把其他成员记为已到访。网络不产生跨 Init 移动。

商场示例：进入入口后通过首访 Effect 获得 Init 范围的电梯通行 Enhancement，挂载真实电梯网络，连接入口与各楼层大厅。内部走廊、店铺仍使用普通邻接。保存和恢复沿已有 Enhancement／Affector 生命周期处理，无需新增 openedAreaMaps 等地图交通状态。

地图信息与交通分别揭示：Map／Node 复用 Reveal 的 existence、name、utility、condition、unlock。示例中城区提供商场导览入口，首次进入商场取得一楼导览后，其地图才出现；取得导览不改变房间邻接。作者可以通过物品、flag、剧情或已有进度条件揭示地图与节点，不必把知道、到访和交通开放合为一个状态。

## 装载、查询与 UI

fragment-parser 显式识别 areaMaps，文件夹和 ZIP 使用同一解析链。validateDatapack 验证形状，Registry.validateAreaMapRefs 在最终启用包合并后检查地图、Area 与 Pic 引用。GameInstance.init 在清理 live runtime 前先预检候选集。Pic 沿用 mod:kind(pic):name 格式。

GameReadModel.areaMap 返回脱离 source 的当前图投影，不递归展开子图。隐藏节点及关联线不输出；隐藏目标的 action、名称、说明和条件不会泄漏。详情显示当前位置／已到访／尚未到访，动作区区分普通前往、沿已探索路线快速返回和乘交通前往。

area-map 会话仅属于 UI，保存浏览历史、选择和每图相机，不进入存档。Map 跨图、选择、拖动、缩放和 Reveal 更新均不写游戏位置。只有显式移动按钮调用正式 travelToArea；成功移动退出地图，失败保留会话。受保护剧情、外部 Area 改变、Init 切换及 runtime generation 失效会关闭会话。DOM 按节点身份原位更新，保留画布与详情滚动宿主；共享前台准入规则见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]。

## 默认内容与验证

默认基础包的 6 张区域图覆盖全部 14 个 Area，按 Init 组织节点并声明邻接候选线，不声明任何移动授权。

开发演示 /src/ui/index.html?areaMapDemo=1 使用独立 GameInstance 与内存存档，包含 8 个 Area、5 张 Map、商场电梯及内部房间。入口可从事务所前往，电梯开通后各大厅实际互通，内部房间仍沿走廊探索。

核心验证入口：tests/engine/area-map-fast-travel.test.ts、tests/engine/area-map-query.test.ts、tests/ui/area-map-controller.test.ts；Schema 同步入口见 [[docs/docs-829/05-conventions/schema-sync]]。

左栏通过 reachableAreaIds 展示直接出口与沿已探索路线可达的地点；availableAreaIds 仍只表示真实一步连接，地图连线继续使用后者的拓扑事实。
