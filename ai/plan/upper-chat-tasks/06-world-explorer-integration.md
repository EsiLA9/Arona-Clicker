# Task 06（现有 0422）：World 接入已经形成的公共 Explorer 框架

## 施工目的

将 World 的领域树、资源与动作接入 Task 04/05 建立的公共节点、搜索、树渲染和交互。不是在 World 目录上单独添加一个搜索输入框并复制 Story 匹配算法。保留 World 默认单实例复用和只读领域摘要，World Explorer 在活动 Story、目录实例或空 Workbench 时仍完全可用。

主要源码：src/ui/runtime-editor/world-browser-provider.ts、world-browser.ts、src/ui/controller/controller.ts、src/ui/workspace/editor-explorer-service.ts、editor-resource-request.ts 及 Task 05 实际公共搜索/渲染入口。修改原 0422 任务说明及前置依赖，不改编号。最终跨业务集成与文档移至 Task 08。

## 1. World 数据适配

保留 buildDefaultWorldTree(catalog) 对 Init/Area/Spot 的领域归属组织、默认区域/地点标记、归属缺失分组和稳定排序。保留 worldEntityKey/worldEntityIdentity/worldTreePlacementIdentity。将 WorldTreeNode 映射到公共 EditorExplorerNode：placementKey 使用真实路径 key；resource 包含实际 provider/kind/id/resourceKey；label 和 searchableText 提供名称与 ID；default 与 missing-parent 使用必要状态描述；children 与 childState 体现真实数据。没有资源 ref 的分组节点仍可展开但不能打开任意对象。

不要把 World 领域树强行改成 Story 目录算法；也不新建 World 搜索树副本。适配函数是领域数据映射，可遍历领域树，但不能自行完成文本筛选、搜索展开、公共树 HTML 或 query 持久化。资源可以既有子项又能打开，公共渲染应提供独立展开/打开控制，不让点击 Chevron 同时触发实体切换。

World 数据源是当前合法 World catalog/registry，而非 active World instance 的 target；从空 Workbench 或 Story 活动状态调用 projection 时仍取得真实目录。查询状态使用 EditorExplorerService 中 world 独立命名空间，不读 Story 的 query 或 scope。保留必要数据失效策略（registry 更新后重新投影），不创建无界全树缓存。

## 2. 使用同一搜索控件与公共管线

修改 createWorldEditorExplorerColumn()/worldExplorerProjection()，调用 Task 05 的公共 Explorer 栏位/搜索/树渲染入口。World 只提供领域节点、必要标题和专属工具（例如定位当前 World 资源），不重新手写搜索框或 onQuery 匹配。公共 query channel 必须有真实输入绑定和刷新回调，不能仅保存字段。名称/ID 文本匹配、祖先保留、普通展开与搜索展开、清除恢复、无结果/空目录均使用同一执行过程。

World 若无现有领域过滤需求，不新增一套 Init/type 过滤器凑功能；已有领域约束由 Provider 表达。搜索控件、树行和状态使用已定型 Authoring 视觉语言，与 Story 同角色控件一致。当前 World 行可能以 strong 显示名称及 small 类型，检查既有语义与共享规则；不能通过整行 HTML 回调保留独立渲染器。保留合法的 World 类型与默认标记，不无故新增装饰图标。

renderWorldTree() 若仍为外部调用入口，应仅转发 World 适配数据至公共投影和渲染。移除其独立递归 list、open 判断、选择标记和重复资源属性组装。搜索行为必须能通过公共测试路径覆盖两种 Provider，而不是靠分别编写同义算法通过两套测试。

## 3. World 定位、资源打开与实例更新

利用 worldTreePath 或现有领域父链定位能力解析目标 placement，返回给公共 reveal/locate 流程。不要再次实现整套展开/聚焦/滚动逻辑。显式 locate 可切换 Explorer 为 world、显示左栏并临时显露祖先；保持原 world query 与普通展开，清除定位恢复。没有 World 活动实例时，定位按钮应有明确目标或禁用理由，不从 Story 活动目标猜 World ID。

从目录行打开 Init/Area/Spot 时发出既有 EditorResourceOpenRequest，origin/placement/resourceKey 一致。公共 Manager 根据 World reuse 策略保持单实例 ID；中栏关系链接发出 instance-link，不附带自动 locate，不修改当前 Explorer 类型、查询、折叠或选中。更新 Manager resource/reuse/presentation 与摘要、Inspector、实例条的真实投影，修复只 innerHTML 写摘要的旧路径。若目标不存在，拒绝且原内容与活动 ID 可继续使用。

点击资源与点击展开应通过公共绑定各自完成，仅一次语义执行。审查 UIController.bindWorldBrowser/commitWorldTarget/openWorldBrowser 等当前实际剩余代码，删除已经迁入公共 Host 的重复选择、搜索、展开、焦点和滚动处理；保留只读摘要查询和 World 特有资源行为。禁止将 World 的导航或渲染能力转接给 StoryController 以取得搜索服务。

## 4. 连续交互与独立状态

World 搜索输入在活动 Story、Entry、目录实例、World、空 Workbench 五种组合下使用同一挂载路径。切换 Explorer 后恢复 world 自己的 query/placement/fold/scroll。Story 后续业务更新不覆盖 World；World 关系链接不改 Story Explorer 正在调查的来源。公共 DOM patch 不以当前 route.kind 或 active provider 选择不同搜索功能。检查共享 scroll key 在不同 Explorer 切换时不互相写入。

## 验收与检查点

CP1：World 节点适配并真实接入公共搜索与渲染；CP2：定位、打开和更新链路迁移；CP3：旧 World 目录行为退出、跨业务定向测试。

用例：名称和 ID 搜索 Spot，显示正确 Init/Area 祖先；搜索无结果，清除恢复此前手动折叠；空 Init/Area 无无效 Chevron，但实体可打开；归属缺失分组仍可显示和检索；无 World 实例也能搜索/打开；从结果打开 Spot 后通过中栏链接切 Area/Init，Instance ID 不变且标签一致，Explorer 查询不变；Story→World→Story→World 保留各自状态；Story 活动时 World 搜索后编辑 Story，实际 World DOM 与输入仍保持；World 活动时 Story Explorer 业务来源可用。测试应使用真实公共输入事件和渲染入口，不仅 World 纯数据测试。确认不再存在独立 World 搜索与完整递归渲染实现。真实浏览器几何/hover 仍按用户验收约定记录。
