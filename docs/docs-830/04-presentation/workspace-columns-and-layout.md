# Workspace 栏：复用、装配与实例更新

本文回答：如何在另一工作区或普通容器中使用已有栏，配置顺序、宽度和返回行为，并保持显示实例隔离。页面路由与单层返回位置见 [[workspace-route-lifecycle]]。

## 装配入口

游戏 Workspace 通过 `WorkspaceFrameSpec.columns` 声明有序栏数组。数组顺序决定位置，每项的 `width` 是一个标准 CSS Grid track，支持固定长度、百分比、fr、minmax、calc 等；缺省为 `minmax(0, 1fr)`。多 track 字符串、repeat 和声明分隔符不作为单栏宽度接受；需要多栏时增加数组项。隐藏栏连同其 track 一起过滤，零栏输出空态。

原来的三栏宽度变量仍用于现有页面的默认设计，Operation 保持原有三段比例。调用方可以覆盖任意栏的 width；超出容器的最小总宽通过 Frame 横向滚动承载。`slot` 保留作旧外观与 `refreshPanels()` 的语义别名，不是实际位置。

`renderWorkspaceLayout()` 仍是内容工具的纯布局入口，不生成游戏主题宿主。`renderWorkspaceFrame()` 负责有主题的栏外壳，并可向 `UIContext.workspaceColumns` 收集装配定义。旧 left/center/right 对象只在共享 Frame 的兼容边界转换，当前游戏页面均已使用有序数组。

## 页面尺寸与栏结构

`renderWorkspace()` 的 Shell 依次容纳 topbar、`.workspace-page-content` 和页脚。页面内容区负责剩余高度、最小尺寸与顶栏下的 16px 间距；Frame 仅负责网格几何和超宽滚动，嵌入普通定尺寸容器时不增加页面间距或视口高度。Map / Map Entry 的业务 wrapper 保留路由及更新身份，沿用页面内容区提供的尺寸。

每个栏根是唯一的 Panel / Presentation 表面。背景与 `.presentation-host-content` 继续保持直接子层；content 内的 `.workspace-column__slot` 按纵向组合可选 `header`、`content` 正文与可选 `footer`。头部和固定操作区在正文滚动范围外，无内容时不生成空插槽。`actions` 仍是事件回调字典，与 `footer` 内容无关。

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

该示例展示运行态聊天栏的嵌入。Story Editor E0 使用纯气泡投影展示作者 nodes，不直接挂载上述带运行态语义的聊天栏；编辑会话与草稿保存见 [[runtime-editor-and-project-checks]]。播放预览 Runtime 仍未实现。

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

聊天显示各自有滚动 key；同一个业务 stream 可以展示两份，阅读位置互不覆盖。Story 的送达指纹、门控和自动推进仍由共享 ChatStream 按业务流去重。发送和选择从实际窗格的 owner 取目标，不从物理中栏或 Controller 当前选中项推断。

源码：`src/ui/components/shared/workspace-frame.ts`、`src/ui/columns/`、`src/ui/workspace/workspace-columns.ts`、`column-actions.ts`、`src/ui/controller/controller.ts`、`src/ui/update/ui-update-dispatcher.ts`、`src/ui/interaction/scroll.ts`。

验证入口：`tests/ui/workspace-columns.test.ts`、`content-columns.test.ts`、`workspace-frame.test.ts`、`workspace-lifecycle.test.ts`、`contacts-story-workspace.test.ts`、`scroll.test.ts`、`story-node-delivery.test.ts`。DOM 测试不等同浏览器视觉验收；实际验收记录见 [[ai/archive/plan/task-0332-workspace-reusable-columns-and-layout]]。
