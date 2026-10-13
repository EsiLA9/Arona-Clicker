# UI 复用模式 — 组件、布局与内容

> 本文回答：已有页面从哪些组件和内容入口组合。范围为 ACProgram 游戏 UI；入口已核对源码，用法作为复用约定，不复制渲染函数、机制正文或完整 DOM 树。

## 复用模式

| 模式 | 入口 / 已有例子 | 用途与例外 |
| --- | --- | --- |
| 工作区骨架 | `src/ui/components/workspace-frame.ts` 的 `renderWorkspaceFrame` / `renderWorkspaceColumn`；`src/ui/components/contacts-workspace.ts` 与 `src/ui/components/inventory-workspace.ts` | 复用列宿主、surface、布局与滚动归属，按业务配置内容，不另手写相似外框 |
| Tabs 与顶部区域 | `src/ui/components/tabs.ts` 的 `renderTabs`、`renderPanelTabsRegion`、`renderPanelHeaderRegion` | 保持顶部宿主、主题状态与标题区域一致，不只复制按钮 class 而漏掉宿主元数据 |
| 工作区返回标题 | `src/ui/components/workspace-titlebar.ts` 的 `renderWorkspaceTitlebar`；Contacts / Story 使用 | 复用支持的 panel 与返回动作；新增业务动作需窄扩展，不伪装成已有动作 |
| 同类 Mini card | `src/ui/css/cards.css` 的 `.mini-card` 与 `--card-*` | 继承视觉规则；业务渲染与内容来源由目标组件负责，没有宣称存在通用卡片渲染器 |
| Spot 行动入口按钮 | `src/ui/components/operation-entry.ts` 的 `renderOperationSpotFunctions`，由 `production.ts` 组合 | 沿用 `.mini-action` 和 `card.action` 主题宿主；同一 `operationEntry` 类型每按钮绑定一个关卡，放在设施操作组内，不插入聊天流。准入与继续状态从领域查询取得；已核对源码与定向测试 |
| 宿主与实体表现 | `src/ui/presentation-service.ts` 的 `renderUIHost`；`src/ui/components/entity-presentation.ts` 与 `src/ui/context.ts` 的查询 | 经只读上下文解析适用表现，不自行拼接全套主题规则或绕过实体揭示条件 |
| 弹窗与提示层 | `src/ui/modal.ts`、`src/ui/popovers.ts`；`src/ui/css/modal.css`、`src/ui/css/popover.css` | 先查共享生命周期、锚点与焦点处理入口，再扩展内容，不复制独立浮层管理系统 |

## 内容与结构

- 内容来源：通过 `UIContext` / `GameView` / 只读查询取得名称、描述、数值与状态，优先沿用目标页面的格式化方式；读写边界见 [[docs/docs-829/06-wiki/50-ui/read-model-context]]。
- 结构依据：`WorkspaceColumnSpec` 的 `hostId`、`workspaceOwner`、`surface` 和 `scroll` 承担不同职责；核对各自身份和滚动归属，不机械复制另一个工作区的值。
- 路由与更新边界见 [[docs/docs-829/06-wiki/50-ui/workspace-routing]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]。

结构验证入口：`tests/ui/workspace-frame.test.ts` 覆盖 Frame、列身份和顶部区域组合。浮层、状态与目标页面测试按改动选择。本表只覆盖已核对入口，不表示所有业务页面都共用一个组件。

