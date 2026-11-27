# Explorer、目录树与目录管理

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 共享目录树行、展开与定位

Story／StoryEntry 与 World Explorer 共享 `workspace/editor-directory.ts` 的 `.editor-directory-tree`、`.editor-directory-row`、`.editor-directory-chevron` 和展开控件。公共行最小高度 28px；子列表以连续竖线表现层级，Chevron 随 `aria-expanded` 旋转。共享规则位于 `src/ui/css/editor-directory.css`，World 树不依赖 Story stylesheet。Story/Entry 行可附加文档 SVG，目录管理齿轮和 Story metadata 是真实业务变体。

通用查询、普通/搜索折叠覆写、选中 placement、滚动 host、focus request 与 reveal 由 Workbench 的 `EditorExplorerService` 按 Explorer type 独立持有。`.editor-directory-row:hover` 只改变主题混色背景，不改变行盒；`[aria-pressed="true"]` 表示选中，`:focus-visible` 显示键盘焦点轮廓。公共服务负责展开、行选择、滚动捕获与显露祖先；Provider 仍生成真实资源树及 placement 身份。目录定位滚动对应左栏宿主，不接管中栏/右栏内容。

## 故事目录、发出方与浏览历史

Story 编辑器左栏使用 `renderWorkspaceTitlebar` 的标题内操作位。主按钮显示当前视图并在「故事目录 / 发出方」之间循环，右侧箭头展开原生浮层以直接选择。切换只协调左栏并保留各自列表的滚动和查询 channel。目录按 Init 和现有目录路径组织 Story 与 Entry，并可筛选内容类型。行内只显示名称和必要标记，悬停显示完整名称、ID 与入口类型。点击箭头折叠分支，点击内容行由对应 Provider 打开/激活资源实例。Entry 中栏使用结构化字段和独立抽取池区块，右栏显示调用关系。Story 右栏显示关联入口。浏览历史共用中栏前进 / 后退控件，显式定位后左栏显露目标。发出方列表使用圆形头像和名字，优先取角色差分色组或图片，无头像时显示名字首字。

## 内容来源、搜索与筛选

Story 编辑器左栏常驻一个来源选择框，Classic 标为「内容来源」，Advanced 标为「搜索来源」。选择框包含「当前游戏」，并分组列出「已载入数据包」与「保留草稿」。「搜索与筛选」默认折叠，收起后仍显示启用条件和清除按钮。`EditorExplorerService` 保存查询和普通折叠；搜索期间的临时展开覆写独立，清空查询后恢复普通折叠。Story Provider 负责解释 source/Init 筛选、内容类型和结果投影。搜索只协调左栏原有滚动区域，保留中右两栏。显式定位可保留 query/filter 并临时显露目标；它与普通 World 摘要实体链接区分，focus 模式里的普通链接不自动打开目录。Classic 将草稿操作收在工具行末尾，Advanced 由 Workbench 工具带承载。来源切换沿既有区域更新机制协调 Story 内容。源码为 `story-editor/sidebar-tree.ts`、`view.ts`、`controller.ts` 与 `workspace/editor-explorer-service.ts`。行为见 `tests/ui/story/story-editor-workspace.test.ts`、`tests/ui/story/story-editor-pack-source.test.ts`、`tests/ui/runtime-editor/runtime-editor-world-browser.test.ts`。

## StoryEntry 目录浏览弹窗

StoryEntry 目录浏览复用 Story 编辑弹窗。搜索和 Init 筛选常驻顶部，左侧目录树或搜索结果、右侧落点与同级条目分别滚动。筛选不移除目录落点。选择搜索结果后恢复树并定位该路径。全部目录视图可拖动编辑态条目，同级行的高亮边线表示插入点，只读条目仍可作为参照。顺序输入可留空使用自动值。弹窗内新建项和排序变更随确认写入草稿。入口为 `story-editor/catalog-dialog.ts`，行为见 `tests/ui/story/story-editor-authoring.test.ts`。

## 自动目录与目录管理工作区

Story 编辑器为每个 Init 保留「角色故事」与已载入角色的自动目录，空目录也能查看。左栏的「管理」和折叠按钮共用标题行，子树独立位于标题行下方。管理时中栏用 SwitchTabs 切换「目录设计」与「内容概览」，概览为可折叠的紧凑目录行和 Story／StoryEntry 链接。两页保留各自的滚动位置。右栏显示完整路径、资料候选、当前应用状态与预览选择。选择内容进入对应编辑页，点中栏返回可恢复先前编辑位置。入口为 `story-editor/sidebar-tree.ts`、`story-editor/directory-management.ts` 和 `story-editor/view.ts`。玩家「故事」工作区沿用 `columns/story-navigation.ts` 的导航栏与面包屑。

左栏目录行用彩色短注记表示构建来源、资料有无和多个直接关联，注记与管理按钮固定在同行。右栏「层级状态」列出手动资料份数以及直接归属的 Story 和 Entry 数量。搜索、筛选和折叠不改变这些计数。

## 排序、移动、移除及定位

目录结构操作继续留在工作区。中栏子目录行右侧提供「上移／下移」，以稳定目录 ID 调整预览顺序。右栏切换到可搜索的上级目录树或移除检查，分别展示新旧路径或引用链接。键入搜索与操作后的更新沿用编辑器区域协调，保留三栏滚动宿主。保存仍由所属编辑态 Mod 校验。

Story 与 Entry 的目录管理右栏也可以直接填写层级路径。「层级与手动资料」的同一组控件负责查看、新建、编辑和删除。Init 根可新建目录，旧手动目录保留移动与引用校验，角色目录可新建资料或恢复默认。创建时通过共享的 `active-editing-pack-picker.ts` 选择当前实际运行的编辑态包，保留原浏览来源和层级，确认选择和保存时复核包状态。路径资料通过紧凑候选行选择和预览，主资料和默认显示单独操作。标题、简介和主题输入只刷新中栏的局部预览，复用玩家资料组件。目录路径保留为导航身份，资料标题只影响显示。

## 目录资料预览与玩家详情

手动目录和自动角色目录使用 `story-directory-details.ts` 展示纯文本简介、封面和局部目录配色。预览在输入时保留表单输入节点和三个滚动区。玩家目录行的简介最多显示两行。玩家从入口标题打开右栏详情，左栏只更新选中态，中栏对话或目录概览保留。

## 目录滚动装配

`renderEditorDirectoryScroll()` 生成带 `data-scroll-key` 的内容滚动容器和独立滚动拇指。宿主为可收缩的列正文，保持 `min-height: 0`。仅溢出时启用拇指，在目录 Hover 或拖动时呈现。`bindEditorDirectoryScrollbars()` 绑定滚动与 ResizeObserver 并返回清理回调，新增树消费者应由自己的挂载生命周期调用。源码见 `src/ui/workspace/editor-directory-scroll.ts` 和 `src/ui/css/editor-directory.css`。
