# Area Map 区域地图：Wiki 补写调查

> 调查日期：2026-10-28。用户所指的“地图”是世界区域导航的 Area Map，不是 Gameplay B 的 MapRun。本文记录现状与建议范围；不是新的机制权威页。

## 结论

Area Map 已有独立的数据定义、查询、区域旅行、界面会话及相关测试；现行 `docs/docs-830/` 的 [[workspace-navigation-and-rendering]] 只简要提到 Area Map 的 UI 会话，[[world-and-spots]] 解释 Area 和 Init 但没有区域地图机制正文。因此需要围绕 Area Map 补写分层 Wiki。

旧版 [[ai/archive/docs-829/04-mechanisms/arona-clicker/area-map-navigation]] 已覆盖这一主题，可用来找概念、资料和候选章节；它是归档材料，具体行为必须重新对照当前源码、测试与内容，不能整篇直接迁移成现行事实。

项目身份已确认 `acprogram`。以 `AreaMap`、区域地图、`area-map`、fast travel 查询保存图的概念名和摘要未命中，但路径搜索已找到多处 Area Map 实现和测试；这不能证明地图中没有其他相关实体，也不代表实现不存在。此次不刷新或修改项目地图。

## Area Map 与其他地图的区别

| 对象 | 主要用途 | 权威状态 / 边界 |
| --- | --- | --- |
| `AreaMapDef` | 展示区域导航图和节点动作 | 不拥有 Area；节点坐标控制布局，图上的候选连线不授予通行资格。 |
| Area 旅行 | 判断当前 Init 内能否前往目标 Area，并执行实际移动 | 由领域旅行查询和命令决定；成功后更新当前位置、访问记录及相关效果。 |
| Area Map UI 会话 | 浏览地图、切换子图、选择节点和保存相机位置 | 会话属于界面；浏览和选择本身不移动玩家。 |
| Gameplay B MapRun | 战术地图的局内节点、遭遇和提交 | 另一套定义、状态和规则，不能用来解释 Area Map。 |

源码依据：`src/data-services/contracts/area-map.ts`、`src/data-services/contracts/datapack.ts`、`src/arona-clicker/services/world/area-travel-routes.ts`、`src/ui/workspace/area-map-session.ts`。

## 应补写的内容

### 1. 区域地图总览：定义、入口和节点

- **读者要解决的问题**：区域地图是什么，从哪里进入；地图、Area 和节点如何关联。
- **已核实的材料**：Datapack 有独立的 `areaMaps`；`AreaDef.navigationMapId` 是可选的入口。`AreaMapDef` 有 ID、名称、节点和候选连线；节点动作可为 `inspect`、`attemptAreaTravel` 或 `openMap`，缺省为 `inspect`。地图节点外观和坐标不决定动作。
- **建议写法**：保留 [[world-and-spots]] 作为世界域总入口，新增 Area Map 总览说明定义、导航关系和一次实际打开地图的流程，并从世界域与总索引链接。
- **源码 / 测试**：`src/data-services/contracts/area-map.ts`、`src/data-services/contracts/world.ts`、`src/arona-clicker/services/world/area-map-query.ts`、`tests/data/default-area-maps.test.ts`。

### 2. 可见性投影、连线和隐藏信息

- **读者要解决的问题**：为什么一个节点、名称或连线显示 / 不显示；看见地图是否代表可以移动。
- **已核实的材料**：`AreaMapQuery` 只投影当前图；存在条件不满足的节点不输出，隐藏或缺失目标的节点不公开原始目标动作。地图候选边只在两个节点均指向可旅行 Area 且实际连接存在时输出；按真实方向决定是否带方向。地图与节点的 Reveal 状态及旅行预检共同影响节点 `ready`。
- **建议写法**：在机制详解中结合一个隐藏目标和一条有向连线示例解释“定义了线、实际有连接、玩家可否移动”是三个不同判断。
- **源码 / 测试**：`src/arona-clicker/services/world/area-map-query.ts`、`tests/engine/area-map-query.test.ts`、`tests/engine/area-map-fast-travel.test.ts`。

### 3. 真实旅行、探索路径和交通

- **读者要解决的问题**：普通前往、已探索路线和交通网络如何决定可达；成功移动后发生什么。
- **已核实的材料**：`AreaTravelGraph` 合并 Area 邻接、领域连接与交通网络；旅行路径查询区分 `adjacent`、`visited`、`transit`。`InitService` 在执行移动时重新检查目标、世界线、剧情阻塞、可见/解锁与路线；成功后更新当前位置、到访记录，处理目的地进入及相关后续工作。`quickPassage` 参与已探索路线的中间节点判断。
- **建议写法**：用相邻区域、经过已访问区域的路线和交通连接三个例子区分，明确预检与最终命令、路径和地图画线不是同一概念；具体网络生命周期须在正式编写时继续核对 Affector 的实际来源。
- **源码 / 测试**：`src/arona-clicker/services/world/area-travel-routes.ts`、`src/arona-clicker/services/world/init-service.ts`、`tests/engine/area-map-travel.test.ts`、`tests/engine/area-map-fast-travel.test.ts`。

### 4. 地图界面会话和操作

- **读者要解决的问题**：切换地图、返回、缩放、选择和正式前往分别会改变什么。
- **已核实的材料**：`AreaMapSession` 保存当前图、浏览历史、选择、每张图的相机和反馈；`openMap` 切换浏览视图。Controller 选择或提交前重新读取投影，并通过 `travelToArea` 命令执行旅行；成功时关闭地图，失败时保留会话及反馈。
- **建议写法**：单列 UI 详解，说明会话与 PlayerState 的分工、过期投影的重查、页面关闭条件和局部刷新；链接既有 [[workspace-route-lifecycle]]、[[update-dispatch-and-surface]]。
- **源码 / 测试**：`src/ui/workspace/area-map-controller.ts`、`area-map-session.ts`、`area-map-camera.ts`、`area-map-dom.ts`；`tests/ui/area-map-controller.test.ts`、`area-map-session.test.ts`、`area-map-camera.test.ts`。

### 5. 内容创作、装载与错误诊断

- **读者要解决的问题**：如何声明一张图、关联入口，为什么装载或显示失败。
- **已核实的材料**：`validateAreaMapShapes()` 检查 ID、节点唯一性、有限坐标、动作和边端点等结构；`validateAreaMapReferences()` 在提供的最终定义集合中检查 Area、地图和 Pic 引用。现有测试覆盖跨图循环引用、无效目标、默认内容入口及数据包解析。
- **建议写法**：在 Area Map 详解中提供一个最小可核对的定义，解释节点 ID 与完整实体 ID、结构检查和最终引用检查；涉及编辑器支持的内容需分别核对现行作者策略和 Schema，不假设所有字段都有专用编辑器。
- **源码 / 测试**：`src/data-services/registry/area-map-validation.ts`、`src/data-services/authoring/content-policies.ts`、`tests/data/area-map-registry.test.ts`、`tests/data/area-map-pack.test.ts`、`tests/data/area-map-authoring.test.ts`。

## 推荐页面结构

先写一篇 **区域地图总览**，讲清关系、入口、主要流程与源码依据；再根据上述材料补两篇独立详解：

1. **区域旅行与通路**：真实连接、探索路线、交通、预检与提交。
2. **Area Map 投影与界面**：Reveal、候选连线、会话、节点操作和局部刷新。

内容定义和装载验证可先放在总览的作者章节；如果实例和字段解释增长到影响阅读，再拆成独立参考页。以现有默认区域图或 `tests/data/area-map-demo.test.ts` 中的演示包为例，编写前重新核对内容和预期结果。

## 验证状态

本次读取源码、测试内容及旧文档作为调查依据，没有运行区域地图测试，也没有修改正式 Wiki、游戏代码或 GALHCG 图。写入 Wiki 时应按涉及内容执行必要的文档检查，并区分实际运行过的测试与仅阅读的测试。
