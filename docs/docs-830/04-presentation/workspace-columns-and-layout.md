# Workspace 栏：复用、装配与实例更新

本文回答：如何在另一工作区或普通容器中使用已有栏，配置顺序、宽度和返回行为，并保持显示实例隔离。页面路由与单层返回位置见 [[workspace-route-lifecycle]]。

## 装配入口

游戏 Workspace 通过 `WorkspaceFrameSpec.columns` 声明有序栏数组。数组顺序决定位置，每项的 `width` 是一个标准 CSS Grid track，支持固定长度、百分比、fr、minmax、calc 等；缺省为 `minmax(0, 1fr)`。多 track 字符串、repeat 和声明分隔符不作为单栏宽度接受；需要多栏时增加数组项。隐藏栏连同其 track 一起过滤，零栏输出空态。

原来的三栏宽度变量仍用于现有页面的默认设计，Operation 保持原有三段比例。调用方可以覆盖任意栏的 width；超出容器的最小总宽通过 Frame 横向滚动承载。`slot` 保留作旧外观与 `refreshPanels()` 的语义别名，不是实际位置。

`renderWorkspaceLayout()` 仍是内容工具的纯布局入口，不生成游戏主题宿主。`renderWorkspaceFrame()` 负责有主题的栏外壳，并可向 `UIContext.workspaceColumns` 收集装配定义。旧 left/center/right 对象只在共享 Frame 的兼容边界转换，当前游戏页面均已使用有序数组。

## 页面尺寸与栏结构

`renderWorkspace()` 的 Shell 依次容纳 topbar、`.workspace-page-content` 和页脚。页面内容区负责剩余高度、最小尺寸与顶栏下的 16px 间距；Frame 仅负责网格几何和超宽滚动，嵌入普通定尺寸容器时不增加页面间距或视口高度。Map / Map Entry 的业务 wrapper 保留路由及更新身份，沿用页面内容区提供的尺寸。

每个栏根是唯一的 Panel / Presentation 表面。背景与 `.presentation-host-content` 继续保持直接子层；content 内的 `.workspace-column__slot` 按纵向组合可选 `header`、`content` 正文与可选 `footer`。头部和固定操作区在正文滚动范围外，无内容时不生成空插槽。`actions` 仍是事件回调字典，与 `footer` 内容无关。

需要在正文视口上固定定位的内容可提供 `bodyOverlay`：共享 `.workspace-column__viewport` 包住原有滚动 body，并将该层作为其同级节点；标题、页脚仍在视口外。该包装层不拥有滚动，不改变原 body 的滚动身份。Story 编辑器用此入口承载逐节点开启的演出编辑层，未提供该字段的栏保持原结构。

`scroll: 'auto'` 让正文自身滚动；`content` / `none` 让正文作为可收缩宿主，由内容中的专用区域滚动或处理交互。队伍、资源等多个滚动区可共存，动态增删或排序时应各自提供稳定的 `data-scroll-key`；Map 的既有 `data-map-region-key` 也可作身份。快照按栏实例与区域身份恢复，父栏不接管嵌套子栏的滚动区；聊天阅读与贴底继续由 FlowScroll 管理。

## 定义、业务绑定与实例

| 字段 / 标识 | 含义 |
| --- | --- |
| `definitionId` | 可复用栏的种类，例如 chat、contacts、character |
| Frame `id` | 工作区设计和样式标识 |
| Frame `instanceId` | 可选挂载命名空间；缺省使用 id。同一设计同时出现两份时应分别指定 |
| 栏 `key` | 当前装配内的稳定 key；重复会报错，不因换序而改变 |
| `columnInstanceId()` | 命名空间和编码后的 key 组成的 DOM/更新身份 |
| `bindingKey` | 当前业务绑定身份，例如角色 owner；更换后旧挂载 token 失效 |
| `hostId`、`themeScope`、`workspaceOwner` | 表现查询、继承与来源；不是 DOM 实例身份 |

栏根节点已有 `data-column-instance`、`data-column-key`、`data-column-binding` 等元数据，没有增加额外面板 wrapper。`data-column-origin` 让来源工作区的栏样式可在另一宿主中保持；背景、几何和标题仍复用原 Presentation 入口。宽度变化可能自然引起换行，不承诺不同宽度下逐像素一致。

## 复用真实内容

`src/ui/columns/index.ts` 是完整栏工厂入口；纯聊天/联系人/角色正文由 `content-columns.ts` 组合，其他正式栏在同一目录按内容职责拆分：

- `createChatColumn()`：显式接收 owner、历史、发送状态和门控；不会因挂载而启动剧情。
- `createContactsColumn()`：接收选中项、历史、未读查询与 `onSelect` 回调。
- `createCharacterColumn()`：接收 variantId；装备事件通过显示中的 `data-character-owner` 确定目标。
- `createAreaNavigationColumn()`、`createFacilitiesColumn()`、`createEnhancementsColumn()`、`createInventoryEffectsColumn()`、`createLogColumn()`：提供可独立装配的区域导航、设施、强化、物品/效果摘要与日志栏。`createChatColumn` 与 `createCharacterColumn` 共用上面已有的内容实现。

经典 Game 使用稳定的展示组 key `area-navigation`、`activity`、`tools`；`activity` 在 chat/log 间切换，`tools` 在设施/角色/强化/其他间切换。组 key 保留节点位置，当前内容由 `definitionId` 与 `bindingKey` 表示；定义或绑定变化会让旧 `ColumnToken` 失效。默认页签和资源条显隐由 Game 组装指定。区域栏头部的 Contacts / Story 是打开另一个 Workspace 的导航动作，不是区域栏正文页签。

这些工厂接收 `appearance`、标题/旧标题片段，以及可选 `actions`。动作是由宿主绑定的具名 selector 回调，通过 `bindColumnActions()` 限定在该实例内；组件不持有 Controller 或业务命令。只读数据不能替代动作绑定：在非游戏 Controller 的容器中使用交互栏时，应提供相应回调。

区域栏可显式提供头部、动作和区域地图入口策略。Controller 的 Game 默认动作只填补未提供的 selector，不覆盖宿主回调。设施、强化、区域导航与角色栏通过 `SemanticColumnSpec.semanticRefresh` 保留原始绑定及装配选项，在集合变化时重算正文，并经过同一栏更新生命周期；不会从旧 HTML 推测配置。设施与区域导航追随当前区域，强化追随当前 Init，角色栏保留显式 variantId。

现有页面还导出 `create*WorkspaceFrame()`，可以用 `workspaceColumns(frame)` 取得所需的栏，再指定新 key、width、onBack 或 bind。Game 的入口在 `workspace-renderer.ts`；其他入口位于对应组件文件。Map 的 `createMapWorkspaceFrame()` 接收已构造的标题和内容，其业务 Run、关系层与跨栏联动仍由 Map Workspace 持有，不因栏复用而复制 Runtime。

以下是单栏嵌入的调用形态，container 由调用方提供尺寸：

```ts
const column = createChatColumn(ctx, {
  owner: null,
  entries,
  sendState,
  title: '聊天预览',
  actions: { '[data-send]': () => previewActions.send() },
});
const columns = new WorkspaceColumns({ beforeReplace: dismissAffectedPopovers });
columns.mountColumn(container, ctx, 'editor/preview', column, {
  onBack: () => editorActions.closePreview(),
});
// 宿主退出时释放显示实例；共享业务流由其原 owner 管理。
columns.dispose();
```

该示例展示运行态聊天栏的嵌入。Story 编辑器使用气泡投影展示作者节点，隔离试播使用自己的 Frame 列配置。编辑会话与草稿保存见 [[runtime-editor-and-project-checks]]。

## 导航与 DOM 生命周期

`onBack` 的优先级为单栏挂载显式覆盖、栏自身回调、Frame 默认回调。`null` 明确禁用返回。`data-column-back` / `data-workspace-back` 由实例捕获处理，一次点击只执行一个结果；没有动作时隐藏对应按钮。`backSelector` 可指定已有栏的其他返回入口。栏内退一级和退出 Workspace 使用不同回调，不新增 history stack。

游戏 Controller 收集原页面的默认返回适配，继续通过 `disposeWorkspace()`、Area/Map Entry 原返回入口执行会话与主题清理。跨工作区复用时可以覆盖这些结果，不需要先进入栏原所属页面。

`WorkspaceColumns.mount()` 以 key 协调 DOM：换序移动原列根，改宽度只更新 grid；未变化的内容、输入、滚动及工作区浮层保留。内容或 binding 改变才替换所属栏。`bind(root)` 可返回清理函数；替换、移除、dispose 时释放对应监听/订阅。调用方必须通过绑定和 token 管理实例自己的异步工作，共享业务流不随某份显示卸载而取消。

`adopt()` 把字符串渲染出来的 DOM 接入相同的实例生命周期，不再创建第二套渲染调度器。`ColumnToken` 包含实例与 generation；旧挂载/旧绑定的 update 不能覆盖新实例。

## Controller 更新与兼容边界

普通页面统一通过实例更新，不再为 Character、Contacts、Story、Settings、Inventory 各维护一套 region 替换方法。`requestColumnRefresh(instanceId)` 仍走现有 UIUpdateDispatcher；请求携带 Surface token 与 Column token。`refreshPanels()` 将旧语义别名转为当前栏实例，Datapack 合并栏通过 `panelAliases` 声明旧 center 刷新应交给哪一栏。

目标缺失先恢复所属栏，Frame 缺失再在当前 shell 中恢复工作区；启动或 shell 不可用时才退回全页渲染。替换前关闭范围内浮层，替换后绑定动作并恢复焦点/滚动，范围外 DOM 保持。

设施、强化与区域导航的消费者来自已挂载且仍连接的语义实例，原 Game 页签和当前路由只决定默认装配，不屏蔽其他位置的消费者。App 重绘只释放其替换范围内的栏，外部容器中仍连接的栏继续登记；Controller 销毁时再释放全部实例。

`updates: 'external'` 标识专用 keyed 更新路径：Shop、Map、Map Entry、Area Map、Operation 继续由其交易/地图/行动协调器更新内部区域。Story Editor E0 同样声明此模式，以作者节点身份局部协调三栏，固定输入使用共享 footer；普通编辑不替换整栏。它们的专用业务编排没有被替换成通用栏调度。未来将复杂栏嵌入新宿主时，仍需为其具体业务动作和协调器设计绑定，不能只复制 HTML。

### 编辑器模式与浏览实例

Story／StoryEntry 与 World 通过 `editor-workspace.ts` 在游戏页面内装配可切换的编辑器外壳。经典模式显示游戏顶栏和底栏；高级模式占满视口，使用场景工具组、实例条、工作类型栏和状态栏。正文节点插入仍位于 Story 中栏。试播和目录管理可以请求临时三栏布局，退出时恢复基础布局。Frame 始终是独立宿主的直接子项，外壳更新走对应编辑器的局部协调。

公共交互由 `bindEditorWorkspace(root, signal, binding)` 一次装配：它内部绑定布局选择、Classic／Advanced、Ribbon 与栏宽拖动、退出命令和清理生命周期。业务传入可用边缘及 `onBeforeViewChange`、`onViewChange`、`onModeChange`、`onExit` 回调；回调只处理业务刷新、滚动恢复和退出门禁，不负责组织公共控件的绑定顺序。程序化布局命令走 `setEditorWorkspaceView()`，使公共布局状态、shell 属性、轨道宽度和业务滚动钩子保持同一顺序。

公共框架表现位于 `src/ui/css/editor-workspace.css`，公共目录树与悬浮滚动条位于 `src/ui/css/editor-directory.css`，Review 字段基础样式与 Story／Runtime 共用条件引用选择器位于 `editor-shared.css`。共用条件引用项使用 `.editor-list-item`、`.editor-empty`、`.editor-actions`；Story 自身继续使用 Story 专有的行、空状态和操作类。`surface-styles.ts` 为 `world-editor` 只加载两份编辑器公共样式；`story` 先加载公共样式，再加载 `story-editor.css` 中的正文、节点、Entry、试播及属性编辑样式。公共目录 DOM 使用 `.editor-directory-*` 选择器，不依赖 Story 专有树类。样式迁移不改变栏内容更新策略：Story 保留 `patchEditorDOM()` 和 keyed 栏位协调，World 保留摘要区域的局部刷新。

高级编辑器的唯一布局 owner 是 `editorLayout` (`EditorLayoutService`)。它统一持有 Classic/Advanced、三栏／双栏／专注、Ribbon 密度及左右栏期望宽度，并持久化到 `acprogram.editor-layout.v1`。没有有效记录时默认三栏，期望宽度为左 300px、右 320px。旧 `acprogram.editor-workspace.v1.story/world` 只在迁移时读取：Story 有效字段优先，缺项取 World，再缺项使用默认值；迁移后删除两个旧键。Story/World 和 Story 浏览实例不再保存布局副本。

`EditorLayoutService` 保存用户期望宽度；布局服务按当前可用空间计算实际轨道。窗口变窄时左右轨道按比例压缩，为中栏预留 340px 和栏间距；ResizeObserver 只重算实际宽度，不改写持久期望值。拖动某一分隔线时，上限按另一侧当前实际宽度计算；用户松开后才保存该侧期望宽度。双击恢复该侧默认期望值，取消拖动恢复原值。三栏隐藏一侧后重新显示时重新使用其期望宽度。布局选择由全局 service 持有，切换工作类型、内容或实例不会自动改写；显式目录定位可从专注切换到双栏。

#### Workbench 与 Browse Instance Provider

`UIController.workbench` 是单一高级编辑会话 owner：`EditorWorkbench` 持有 session/theme/return、`activeExplorerType`、共享 `BrowseInstanceManager` 与公共 `EditorExplorerService`。`activeExplorerType` 只决定左栏 Explorer；Manager 的 `activeBrowseInstanceId` 决定中右栏和业务工具。换 Explorer 不会激活实例，激活实例也不强制换 Explorer。游戏界面的装配/跨 Provider 路由入口是 [`UIController`](../../../src/ui/controller/controller.ts)；公共 owner 定义在 [`editor-workbench.ts`](../../../src/ui/workspace/editor-workbench.ts)。

`BrowseInstanceManager<TState>` 只管理 opaque Provider record、顺序、激活、复用、复制、关闭和 active ID；它不导入 Story/World。Provider 在调用 Manager 前准备业务 state/seed，激活或关闭准备回调失败时 Manager 不提交活动 ID/集合变更。共享 Manager 由 Workbench 的 [`editor-browse-instances.ts`](../../../src/ui/workspace/editor-browse-instances.ts) 创建，核心实现见 [`browse-instance-manager.ts`](../../../src/ui/workspace/browse-instance-manager.ts)。业务 Provider 负责内容合法性、保存门禁及 capture/restore；合法完成的持久化保存不由 Manager 回滚。

| Provider | 资源身份与初态 | 生命周期策略和业务边界 |
| --- | --- | --- |
| Story / StoryEntry | [`storyBrowseIdentity()`](../../../src/ui/story-editor/workspace-session.ts) 将 kind、resource ID、编辑来源（registry 使用运行包身份）组合成 resource/reuse key；seed 保存目标、初始 visit 和文档元数据。 | [`StoryEditorController`](../../../src/ui/story-editor/controller.ts) 校验资源/来源并执行 draft save gate；激活时恢复该 record 的 Story working state，离开时 capture。复制生成独立 visit/滚动等浏览状态，作者草稿仍由 Story Editor 共享。关闭非末实例可选其他 Provider；末实例关闭保留空 Workbench，退出另走 `closeEditorWorkspace()`。 |
| World | [`prepareWorldBrowseSeed()`](../../../src/ui/runtime-editor/world-browser-provider.ts) 用 `kind:id` 作资源身份，target 与摘要由 World Provider 准备。 | `worldBrowseReuseKey` 固定为 `world-browser`，所以默认单实例复用是 Provider 策略：切换 Init/Area/Spot 更新同一个 Manager record 的 target；它没有独立 World instance ID/集合。关闭走 UIController 的公共 close 入口，末实例留空 Workbench；“退出编辑器”仍独立。 |

Story 的 `StoryEditorController.state` 是活动 Provider 的工作集；Manager 中每条 Story record 的 snapshot 在成功离开/激活边界 capture/restore。Story 草稿和属性编辑缓存不复制到每个 Browse Instance；非活动实例保留自己的目标、访问历史、滚动、右栏页签和来源 visit。不要在新 Provider 中另造一个实例集合或第二个 active ID，也不要把 Provider 内容语义塞进通用 Manager。

#### Explorer Provider 与公共浏览服务

[`EditorExplorerService`](../../../src/ui/workspace/editor-explorer-service.ts) 按 Explorer type 独立持有 query channel、普通/搜索折叠、选中 placement、各滚动 host、focus request 和临时 reveal。`bindColumn()` 处理通用 query、展开、placement 选择与滚动事件；`revealPlacement()` 展开祖先、显露行、滚动并 focus。列由 `WorkspaceColumns` keyed mount 绑定，dispose/replacement 会调用业务 binder disposer。

Explorer 使用 [公共位置契约](../../../src/ui/workspace/editor-explorer-nodes.ts)。各视图提供有序记录，以稳定 `placementKey` 标识每次放置，以 `parentKey` 表达父子关系。`folder` 描述空目录、普通展开与延后挂载等树行为，`resource` 和来源描述可打开的业务实例。一个资源可有多个目录位置，同 ID 的包内容仍按精确来源识别。公共索引校验父子关系，并提供用于搜索和定位的子项与资源位置。

高级编辑器提供 Datapacks、Storys 与 IAS 三个左栏视图。`EditorWorkbench.project()` 使用 [公共栏组件](../../../src/ui/workspace/editor-explorer-column.ts) 生成标题控件、搜索筛选、工具区、目录和滚动宿主。[公共行渲染与分派](../../../src/ui/workspace/editor-directory.ts) 以位置键与动作读取当前投影。同一标题行包含可展开槽、名称与行内操作槽。文件夹名称和箭头都选中位置并切换展开，行内入口打开业务实例并保留当前目录选择，实体叶项通过名称打开。Story 目录管理的内容概览、移动目标树和 Entry 归档目录也复用树投影、行结构和交互入口。各宿主持有自身的选择、草稿与排序状态。

[Datapacks](../../../src/ui/workspace/datapack-explorer.ts) 从包记录构造顶级包根，展开时在同层显示该包定义的 Story、StoryEntry、Init、Area 与 Spot。包内位置带包记录身份，资源打开仍交给 Story 或 IAS 的现有业务入口。打开 IAS 前核对运行定义的所有者和实际包记录。仅在包库可见的条目会说明当前无法打开。

实例主体激活后只更新当前导航已可见行的活动标记。每个实例都有 SVG Logo，组件为缺省图标提供保底。单击 Logo 定位到 Storys 或 IAS，双击定位到 Datapacks 的实际包和资源行。公共定位更新左栏视图，临时展开并露出目标，选中实际行并滚动、聚焦。失败时恢复定位造成的变化。普通 IAS 摘要链接保持当前导航与布局。接入可参考 `StoryEditorController.explorerProvider()`、`describeWorldExplorer()` 和 `DatapackExplorer.describe()`。

Browse Instance 的接入也复用已有 Manager：先按稳定业务资源身份和 Provider 复用策略准备 `BrowseInstanceSeed`，把领域工作状态放入 opaque `state`，再通过 `BrowseInstanceManager.openOrReuse()` / `createPrepared()` 与 Provider 的恢复及保存门禁协调；Provider 提供中右栏、命令和 `BrowseInstancePresentation`，由 `UIController.createEditorWorkbenchProjection()` 统一组合。Story 参考 `storyBrowseIdentity()`、`prepareManagedBrowseActivation()` 和 `businessProjection()`；World 参考 `prepareWorldBrowseSeed()`、固定 `worldBrowseReuseKey` 与 `createWorldEditorBusinessProjection()`。Provider 不另建 active ID/实例集合，也不直接构造公共标签条或左栏。

源码入口：[`workspace-renderer.ts`](../../../src/ui/workspace/workspace-renderer.ts)、[`workspace-columns.ts`](../../../src/ui/workspace/workspace-columns.ts)、[`editor-workspace.ts`](../../../src/ui/workspace/editor-workspace.ts)、[`editor-explorer-service.ts`](../../../src/ui/workspace/editor-explorer-service.ts)、[`story-editor/workspace-session.ts`](../../../src/ui/story-editor/workspace-session.ts)、[`story-editor/sidebar-tree.ts`](../../../src/ui/story-editor/sidebar-tree.ts)、[`runtime-editor/world-browser-provider.ts`](../../../src/ui/runtime-editor/world-browser-provider.ts)。

测试入口：[`browse-instance-manager.test.ts`](../../../tests/ui/workspace/browse-instance-manager.test.ts)、[`story-editor-workspace-session.test.ts`](../../../tests/ui/story/story-editor-workspace-session.test.ts)、[`story-editor-workspace.test.ts`](../../../tests/ui/story/story-editor-workspace.test.ts)、[`story-editor-explorer-identity.test.ts`](../../../tests/ui/story/story-editor-explorer-identity.test.ts)、[`runtime-editor-world-browser.test.ts`](../../../tests/ui/runtime-editor/runtime-editor-world-browser.test.ts)、[`editor-explorer-service.test.ts`](../../../tests/ui/workspace/editor-explorer-service.test.ts)。DOM 测试不等同浏览器视觉验收；本 Roadmap 的实际视觉/交互待验项由用户手动验收。

聊天显示各自有滚动 key；同一个业务 stream 可以展示两份，阅读位置互不覆盖。Story 的送达指纹、门控和自动推进仍由共享 ChatStream 按业务流去重。发送和选择从实际窗格的 owner 取目标，不从物理中栏或 Controller 当前选中项推断。

源码：`src/ui/components/shared/workspace-frame.ts`、`src/ui/columns/`、`src/ui/workspace/workspace-columns.ts`、`column-actions.ts`、`src/ui/controller/controller.ts`、`src/ui/update/ui-update-dispatcher.ts`、`src/ui/interaction/scroll.ts`。

验证入口：`tests/ui/workspace/workspace-columns.test.ts`、`content-columns.test.ts`、`workspace-frame.test.ts`、`workspace-lifecycle.test.ts`、`contacts-story-workspace.test.ts`、`scroll.test.ts`、`story-node-delivery.test.ts`。DOM 测试不等同浏览器视觉验收；实际验收记录见 Task 0332（原归档已删除）。
