# UI 复用模式 — 组件、布局与内容

> 本文回答：已有页面从哪些组件和内容入口组合。范围为 ACProgram 游戏 UI；入口已核对源码，用法作为复用约定，不复制渲染函数、机制正文或完整 DOM 树。

## 复用模式

| 模式 | 入口 / 已有例子 | 用途与例外 |
| --- | --- | --- |
| 工作区骨架 | `src/ui/components/workspace-frame.ts` 的 `renderWorkspaceFrame` / `renderWorkspaceColumn`；`src/ui/components/contacts-workspace.ts` 与 `src/ui/components/inventory-workspace.ts` | 复用列宿主、surface、布局与滚动归属，按业务配置内容，不另手写相似外框 |
| 内容工具三栏 | `src/ui/components/workspace-frame.ts` 的纯布局 `renderWorkspaceLayout`、`src/ui/runtime-editor/codex/workspace.ts` 的 `renderContentWorkspace`；超级图鉴实际使用 | 把已渲染的导航／条目／详情作为 Frame 直接子项；使用 `pane-switch` 窄屏显隐。该入口不创建游戏列 Host、surface 或 Presentation host；工具自己拥有表面和滚动区。可选操作 footer 仅在有内容时出现，当前图鉴不挂载。搜索留在固定区域，条目与详情各自拥有内容滚动；现有编辑器尚未迁入新骨架 |
| Tabs 与顶部区域 | `src/ui/components/tabs.ts` 的 `renderTabs`、`renderPanelTabsRegion`、`renderPanelHeaderRegion` | 保持顶部宿主、主题状态与标题区域一致，不只复制按钮 class 而漏掉宿主元数据 |
| 工作区返回标题 | `src/ui/components/workspace-titlebar.ts` 的 `renderWorkspaceTitlebar`；Contacts / Story 使用 | 复用支持的 panel 与返回动作；新增业务动作需窄扩展，不伪装成已有动作 |
| 同类 Mini card | `src/ui/css/cards.css` 的 `.mini-card` 与 `--card-*` | 继承视觉规则；业务渲染与内容来源由目标组件负责，没有宣称存在通用卡片渲染器 |
| Operation 手牌扇列 | `src/ui/components/operation-workspace.ts` 的 `.operation-card-fan` 持有区；样式见 `src/ui/css/operation-workspace.css` | 公共手牌、角色持有牌与场景行动候选共用横向交叠、悬停／焦点抬高和高亮；拖放仍由卡面按钮承接。固定锚定的预备行动／敌方意图卡与购买项列表保留各自布局 |
| Spot 行动入口按钮 | `src/ui/components/operation-entry.ts` 的 `renderOperationSpotFunctions`，由 `production.ts` 组合 | 沿用 `.mini-action` 和 `card.action` 主题宿主；同一 `operationEntry` 类型每按钮绑定一个关卡，放在设施操作组内，不插入聊天流。准入与继续状态从领域查询取得；已核对源码与定向测试 |
| 宿主与实体表现 | `src/ui/presentation-service.ts` 的 `renderUIHost`；`src/ui/components/entity-presentation.ts` 与 `src/ui/context.ts` 的查询 | 经只读上下文解析适用表现，不自行拼接全套主题规则或绕过实体揭示条件 |
| 弹窗与提示层 | `src/ui/modal.ts`、`src/ui/popovers.ts`；`src/ui/css/modal.css`、`src/ui/css/popover.css` | 先查共享生命周期、锚点与焦点处理入口，再扩展内容，不复制独立浮层管理系统 |

## 内容与结构

- 内容来源：通过 `UIContext` / `GameView` / 只读查询取得名称、描述、数值与状态，优先沿用目标页面的格式化方式；读写边界见 [[docs/docs-829/06-wiki/50-ui/read-model-context]]。
- 结构依据：完整游戏工作区通过 `renderWorkspaceFrame()` 和 `WorkspaceColumnSpec` 声明 `hostId`、`workspaceOwner`、`surface` 与 `scroll`；纯布局入口接收预渲染列，不提供这些 Host 语义。按入口选择机制，不把游戏 Host 结构机械套到内容工具。
- 路由与更新边界见 [[docs/docs-829/06-wiki/50-ui/workspace-routing]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]。

结构验证入口：`tests/ui/workspace-frame.test.ts` 覆盖 Frame、列身份和顶部区域组合。浮层、状态与目标页面测试按改动选择。本表只覆盖已核对入口，不表示所有业务页面都共用一个组件。


超级图鉴的中文分类与类型标签由 `src/ui/runtime-editor/codex/content-labels.ts` 提供；名称、说明、关系与可靠来源来自只读内容查询。主路径为资料／被引用，完整出向关系、字段树和 JSON 进入技术详情；未知字段仍可展开。`tests/ui/workspace-frame.test.ts` 验证内容工具 Frame 的直接子项、`pane-switch`、无游戏主题 Host，以及有操作内容时才输出 footer。更新边界与来源限制见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]、[[docs/docs-829/06-wiki/50-ui/read-model-context]]。此为已采用的工具特例，不改变游戏工作区默认主题规则。
