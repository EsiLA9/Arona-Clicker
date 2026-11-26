# Task：恢复世界三栏并共用编辑器主题与查阅工具

状态：进行中

## 目标与边界

- 世界编辑器高级模式提供三栏、双栏、专注。仍以双栏打开新浏览实例，右栏只提供预留标题和空面板。Init → Area → Spot 继续是一个只读浏览实例，保留现有层级和链接。
- 一次从外部进入到真正退出之间，Story、StoryEntry、世界编辑器共用一个主题实例。工具栏折叠、栏宽继续按工作类型保存，实体选择和滚动仍随各自浏览实例。
- 从现行 Story／StoryEntry 和世界的两个实现中提取确有复用者的目录和审阅 UI。领域数据、查询与保存由各自编辑器维护。本轮不新增世界历史、搜索、编辑表单、右栏内容或通用插件注册层。

## 1. 恢复世界右栏，沿用已有栏位契约

- 在 `src/ui/runtime-editor/world-browser.ts` 的 `worldColumns` 声明 `right`，与 tree、detail 一起交给 `createEditorWorkspaceColumn` 和 `createEditorWorkspaceFrame`。给右栏稳定的 key、hostId、bindingKey、主题作用域和「便捷信息」标题，正文留空。保留高级模式的同一 Frame，经典模式仍只显示目录与摘要。
- 继续从栏位声明派生 `worldEditorEdges`。下拉选项、布局属性、视图切换和右分隔线走 `src/ui/workspace/editor-workspace.ts` 的既有逻辑。删除世界对旧会话中合法 `three` 值的归一化，保留对真正非法值的回退。通过现有世界视图切换路径在原挂载点切换三个模式。行内链接随实体更新正文时保持列宿主，右栏宽度按世界偏好保存、拖宽和双击复位。目录定位在三栏时保留右栏，只有专注时恢复可见目录。

## 2. 共享主题从首次进入持续到真正退出

- `src/ui/controller/controller.ts` 当前在 `activateEditorAppearance(workType)` 中维护按类型的 Map，`activeEditorTheme()` 再按路由读取其中一份。将主题移出这张偏好表，改为 UIController 持有一个活动编辑器会话。会话包含一个 `EditorWorkspaceTheme` 和最初的外部返回点。各工作类型继续使用现有 `EditorWorkspacePreferences` 及存储键，实例不持有主题。去掉 Story 在 `state.uiTheme` 中持有主题的旁路，改由场景卡、主题预览和属性服务向当前活动会话读取或提交。Header 和画布继续共用现有有效主题投影。
- 在进入路由清理 `serviceThemeOverride`、更换 DOM 或暂挂原 Workspace 之前，取一次外部页面的有效主题。SelectorPage 在场时取其当前焦点的完整投影，其他外部页面用 `src/ui/controller/controller-theme.ts` 的现有运行／服务有效主题优先级，包含当前有效的服务继承主题。复用主题层已有的浅色默认、错误通知及恢复逻辑。
- 把 Story 的 `open`／`leaveForWorld` 和 UIController 的 `openWorldBrowser`／`openStoryEditor` 接到同一个进入／互切流程。第一次进入建立会话；已在编辑器路由时，经过 Story 的 `beforeLeave` 保存拦截，再切路由并继续用原会话和返回点。保存失败时不修改活动路由、主题或返回点。合并现在分别在 Story 和世界间传递的返回点所有权。显式场景双击、色组或自定义应用更新会话主题，其他编辑器随后读取同一结果。预览关闭及互切时清除预览层，恢复已提交主题。故障和 toast 去重也随本次会话。真正退出后再次从外部进入重新采样。
- 收口经典返回按钮、高级 ribbon 退出、最后实例关闭、外部服务导航及 Controller 销毁。沿用 `src/ui/workspace/editor-return.ts` 的目标有效性和 Shop 暂挂清理，互切不清理原 Shop。先确定合法返回目标或实际回退目标，再结束活动会话并走目的地渲染。回游戏由现有 `syncRuntimeTheme` 按实时玩家选择、区域、对话和仍有效的场景层重算；回星图由 SelectorPage 按当前聚焦解析；回服务页按服务的继承规则恢复其来源。若编辑器路由镜像清掉了来自星图的服务继承，明确把原服务的继承上下文随外部返回点保留，仅在返回该服务时恢复。不得把 editor 主题或游戏进入时的旧主题写回游戏状态。

## 3. 左栏目录的核对结论与提取范围

- `src/ui/story-editor/view.ts` 的 `createStoryEditorListColumn` 同时在拼来源下拉、目录／发出方入口、搜索折叠、筛选摘要、草稿操作、两处滚动容器。数据和许多操作是 Story 专用。滚动行为原先拆在 Story 专用滚动条模块，仍靠 Story 专属 DOM 标记绑定。`src/ui/story-editor/sidebar-tree.ts` 的 `renderSidebarTree` 同时决定放置、过滤、折叠、延迟分支、管理入口和具体 li/button 结构。世界的 `renderWorldTree` 借了 Story 的树 CSS 类，却另写 ul/li、箭头、选中行和展开事件。共用标题和 Frame 已落地，目录控件仍有两套。
- 将树的列表、行、折叠控件、选中投影和行尾操作位提到 `src/ui/workspace/` 的共享目录渲染器。接口接收稳定行 key、标签和辅助文字、展开态、选中态、可选的选择／切换动作、子项内容及行尾操作。用共享树样式承载现有视觉，并把只用于树件的规则移到共享语义选择器。允许展开按钮与选择按钮合一或分开，保留 Story 的管理按钮和世界父实体可单独选择的行为。普通子树展开、收起的 DOM 更新走同一入口，交由各域回写自己的折叠状态；Story 延迟分支沿用既有增量渲染。
- 提取目录命令行和滚动容器。Story 目录工具条与世界的目录工具位调用同一组容器，由调用方传实际操作和无障碍标签。世界以现有「显示目录」能力接入，目录已可见时用于定位选中项；专注下入口仍由 ribbon 提供，避免恢复目录的入口被隐藏。目录滚动宿主以各自稳定的 scroll key 接到共享渲染与绑定，复用现有可拖滚动条逻辑，卸载时复用已有 AbortController／ResizeObserver 清理机制。世界的正文链接可继续展开祖先并定位对应树行。Story 的来源、草稿、发出方、管理和筛选保持领域提供，保留其现有 key、搜索焦点与滚动；世界只接当前已有的目录动作。

## 4. 中、右栏审阅工具的核对结论与提取范围

- 中栏已经复用 `renderWorkspaceTitlebar`，Story 正文和 Entry 共用 `editorHistoryHeader`，Entry 页签也已调用共享 `renderTabs`。正文场景、插入、试播和 Entry 编辑表单仍是业务工具。世界 `renderWorldDetail` 自己拼标题、类型和 ID、说明、上下级按钮、缺失和空状态；这些才是本轮的复用接点。
- 右栏只共用了 Frame 和页签基元。Story 的 `renderStoryInspector` 自己拼概述／关系／Flag／其他工具的页面壳，Entry 右栏直接拼关系和 Flag。两者已经共享 `src/ui/story-editor/relations-view.ts` 和 `src/ui/story-editor/flag-catalog-view.ts`。其内部 `renderStoryEditorTarget` 依赖 StoryIdentity、渐变、引用解析与跳转语义。`src/ui/story-editor/directory-management.ts` 已有可提取的只读资料行，具体资料生效规则属于 Story。
- 提取同用的两种轻量审阅件即可。第一种是具名审阅区，接收 key、标题、正文或空态，由 Story 关系区与世界中栏上下级关系区同时使用。第二种是只读标签／值行，接收文本、只读标识或现有引用按钮，由 Story 目录资料和世界中栏摘要同时使用。保持 Story 引用卡、调用关系计算、Flag 拖放和改名逻辑留在原域，通过内容或行动插槽接入。保留 `renderTabs`；本轮世界没有中或右栏分页需求。世界右栏仍只预留挂载位，复用证据来自实际世界中栏和左栏。
- 保留 Story 增量更新中的 pane／行／页签 key、控制器委托动作、焦点、滚动和已展开详情。检查 `src/ui/controller/controller.ts` 的世界绑定是否还存在仅为旧自制树结构服务的分支，迁移完成后删除该分支，保留世界数据和导航决策。

## 分阶段验收

1. **目录迁移**。先迁 Story，核对来源切换、筛选清除、发出方、折叠、管理、延迟分支、草稿权限、焦点及滚动。再迁世界，核对 Init／Area／Spot 单击、折叠与选中互不误触、详情链接定位与缺失归属。复用验收检查两边都实际调用同一渲染与折叠逻辑。
2. **审阅迁移**。用 Story／Entry 的关系与 Flag、Story 目录资料、世界的上下级与简介核对共享组件入口。验证 Story 关系点击定位和 Flag 的领域交互仍工作，世界父子链接仍是同一个实例内跳转。右栏空面板没有业务按钮。
3. **浏览器几何**。同一 1440 px 宽窗口记录世界经典、三栏、双栏、专注的实际轨道和分隔线边界。三栏两侧可拖宽、双击复位；双栏只有左分隔线；专注正文无空轨道。往返保留目录滚动，并确认 Story／Entry 栏宽、标题与拖动无回归。
4. **主题顺序**。至少从星图、游戏和继承星图主题的服务入口各测一次。记录入口有效主题 A，Story／世界双向互切保持 A，显式换成 B 后互切保持 B。注入故障后跨编辑器只看到一次提示。模拟在编辑期间改变游戏当前主题，真正退出应显示目标当前主题 C；再次进入采样 C。覆盖 Story 草稿失败、有效返回与目标失效回退、最后实例关闭和直接去其他服务。
5. 更新 `tests/ui/runtime-editor/runtime-editor-world-browser.test.ts` 中当前仅允许双栏和专注、以及主题按工作类型隔离的旧断言，保留 ribbon 隔离断言。扩展 `tests/ui/story/story-editor-workspace.test.ts` 与 `tests/ui/story/story-editor-theme.test.ts`，覆盖共享目录行为和会话采样次数、退出时主题恢复。按 Workspace 和主题相关范围用 `npm test` 验证，另跑类型、架构、文档和差异空白检查。同步相关机制页中按工作类型持有主题的旧文案。

## 当前进展

- 已完成源码与测试核对，并确定世界三栏、单次编辑器主题会话和实际复用的工具范围。
- 已实施世界三栏、共享主题会话和目录／审阅工具。定向回归 4 文件 75 项通过，类型、文档、架构和差异空白检查通过。
- 下一步由用户进行宽屏浏览器验收，保留活动 Task。
