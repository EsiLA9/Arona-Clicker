# 共享栏头、操作与浮层

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## Tabs、栏头与动作区

保持顶部宿主、主题状态与标题区域一致，不只复制按钮 class 而漏掉宿主元数据。公共顶部、标题/返回及兼容 story-trigger 按钮不依赖 Chat / Story 业务 CSS。Workspace 内容选择与跨路由导航使用语义动作，不编码物理栏位。

源码入口为 `src/ui/components/shared/tabs.ts` 的 `renderTabs`、`renderPanelTabsRegion`、`renderPanelHeaderRegion`、`renderPanelActionsRegion`。`src/ui/css/workspace-controls.css`。

## 工作区返回标题

标题或 Tabs 传给栏的 header，不包进正文滚动。返回控件使用 `workspace-back`，保留 `conversation-back` 别名。`.panel-tabs-region` 内容区与按钮共用 `--panel-tabs-control-height`（当前 30px）最小高度，纯文字与标签栏单行等高。长标题、标签可换行撑高，返回键不压缩。

源码入口为 `src/ui/components/shared/workspace-titlebar.ts` 的 `renderWorkspaceTitlebar`。Contacts / Story / MapEntry 使用。

## 固定动作与危险状态

MapEntry、Area Map、Shop 的确定固定动作放到正文之外。`actions` 继续表示回调字典。危险按钮复用公共变体，不依赖兄弟 Workspace 的 CSS。禁用状态抑制可用态 Hover。MapRun 的复杂 action dock 保留业务布局与 keyed 更新。

源码入口为 `WorkspaceColumnSpec.footer`。`layout.css` / `cards.css` 的 `mini-action--danger`、`primary-button--danger`。

## Mini Card

继承视觉规则。业务渲染与内容来源由目标组件负责，没有宣称存在通用卡片渲染器。

源码入口为 `src/ui/css/cards.css` 的 `.mini-card` 与 `--card-*`。

## 宿主与实体表现

经只读上下文解析适用表现，不自行拼接全套主题规则或绕过实体揭示条件。

源码入口为 `src/ui/presentation/presentation-service.ts` 的 `renderUIHost`。`src/ui/components/presentation/entity-presentation.ts` 与 `src/ui/runtime/context.ts` 的查询。

## 弹窗与锚定提示

先查共享生命周期、锚点与焦点处理入口，再扩展内容，不复制独立浮层管理系统。

源码入口为 `src/ui/interaction/modal.ts`、`src/ui/interaction/popovers.ts`。`src/ui/css/modal.css`、`src/ui/css/popover.css`。

## 普通弹窗的表单规格

ModalManager 的普通弹窗沿用 panel / panel-light / ink-on-* 主题角色：标题 18px、正文与表单 14px、辅助说明及内容区小操作 13px。共享外壳提供 24px 内容留白、42px 表单高度、40px 底部按钮、可换行操作区和焦点反馈。原生表单元素保留语义，以背景、边框、圆角与继承字体消除浏览器默认外观差异。危险操作保留危险变体，checkbox / radio / range 不套文本框尺寸。主题编辑器与 Runtime Datapack 专用表单继续自主管理布局。样式入口为 `src/ui/css/modal.css`。

## 编辑器弹窗变体

工作台里的 Story／Entry 编辑弹窗通过 `ModalOptions.appearance: 'editor'` 显式启用编辑器外观；普通游戏弹窗继续使用上方普通规格。变体在既有遮罩、面板、标题、正文和底部节点上增加共享 `editor-modal-*` class，不改变 DOM 分区或 ModalManager 生命周期。边框圆角 5px，遮罩和阴影减轻；标题背景／文字取 panel-light 角色，正文取 panel 角色，焦点和选中使用主题强调色，内容横向留白 14px、底部留白 8px。短确认窗自然随内容高度收缩；大型目录、条件树和引用选择通过业务 class 设置工作区高度及滚动区，底部动作留在正文滚动外。Runtime 子编辑窗沿用同一组样式钩子和主题角色映射，同时保留 `runtime-subdialog-*` 的尺寸特例、内部滚动与父子栈行为。编辑器删除确认不得套用会撑满视口的 `runtime-datapack-modal`。源码：`src/ui/interaction/modal.ts`、`src/ui/runtime-editor/subdialog.ts`、`src/ui/css/modal.css`、`src/ui/css/runtime-editor.css`。
