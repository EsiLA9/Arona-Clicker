# Task：通讯录学生 Workspace UI 风格收敛

状态：✅ 已完成

## 目标

将点击通讯录学生后进入的角色独立 Workspace，严格收敛到一般游戏态与 Spot 商店 Workspace 已有的 UI 视觉和布局契约，同时保留通讯录、学生故事、角色成长三栏的业务语义与交互。

## 设计边界

- 本任务只处理 `src/ui/` 的结构表现、CSS、交互状态样式和响应式布局。
- 不改变 Workspace 状态模型、角色成长机制、通讯录数据、聊天流、主题层级或状态写入口。
- 普通游戏态与商店 Workspace 是视觉基线；角色专属内容可以保留，但不得再引入独立的一套面板外框、间距、Tab、按钮和滚动规则。
- 保留当前工作区中用户已有的未提交修改，不覆盖无关改动。

## 当前事实与代码落点

- 角色 Workspace 由 `src/ui/components/character-workspace.ts` 生成，接管 left / center / right 三栏。
- 通讯录、学生对话、角色成长内容主要由 `src/ui/components/contacts.ts` 渲染。
- 角色 Workspace 专属布局在 `src/ui/css/layout.css` 的 `.character-workspace` 区域。
- 通讯录内容样式在 `src/ui/css/contacts.css`，对话内容样式在 `src/ui/css/conversation.css`。
- 一般游戏态和商店态的共同布局、按钮、Tab、面板契约分布在 `src/ui/css/layout.css`、`src/ui/css/chat.css`、`src/ui/css/variables.css` 及商店 Workspace 样式中。
- `docs/docs-828/02-modules/ui.md` 已规定角色 Workspace 的三栏宿主、`panel-tabs-region`、`panel-body` 和 WorkspaceFrame 约定；本任务按该约定做表现层收敛。

## 施工切片

### P0：基线核验与差异清单

- 对照普通游戏态、Spot 商店 Workspace、角色 Workspace 的 DOM 层级与 CSS 作用域。
- 核验面板外框、三栏间距、顶部 Tab、返回按钮、正文内边距、滚动容器和主题变量继承。
- 在当前 Edge 游戏页面记录桌面宽度与窄屏宽度下的实际差异。

### P1：结构与容器收敛

- 让角色 Workspace 复用普通游戏态 / 商店态的面板边界、列间距、圆角、溢出和 `panel-body` 契约。
- 清理角色 Workspace 内部重复或互相覆盖的容器规则。
- 保证三栏 Host、主题作用域和 WorkspaceFrame 数据属性不变。

### P2：控件与内容视觉收敛

- 统一顶部 Tabs、返回入口、通讯录条目、学生故事消息、培养按钮、空态和未读徽标的颜色、字体、尺寸、圆角、边框和激活态。
- 优先复用已有通用 class / token；只有角色语义确实需要时才保留局部 class。
- 保持角色主题和表现宿主的覆盖能力，不以硬编码颜色破坏主题链路。

### P3：状态、响应式与可访问性

- 校验 hover、active、disabled、unread、focus-visible 和内容滚动状态。
- 对齐普通游戏态 / 商店态的窄屏折叠策略，处理三栏高度、滚动和内容溢出。
- 尊重现有 reduced-motion 和键盘焦点规则。

### P4：回归与视觉验收

- 运行通讯录 / Workspace 相关专项测试、类型检查和构建。
- 在浏览器中完成普通游戏态、商店态、角色 Workspace 三方截图或逐项视觉对照。
- 记录仍然有意保留的角色专属表现，并确认没有业务行为回归。

## 测试与验收

- 专项测试：`tests/ui/components/contacts.test.ts`、`tests/ui/workspace-frame.test.ts`，以及受影响的 UI 测试。
- 类型检查：`npx tsc --noEmit`。
- 全量测试：`npm test`。
- 构建验证：`npm run build`。
- 浏览器验收：普通游戏态、Spot 商店 Workspace、点击通讯录学生后的角色 Workspace；覆盖主题切换、学生切换、返回游戏、故事进入 / 返回、成长操作入口和窄屏布局。
- 视觉验收口径：角色 Workspace 在相同主题和窗口尺寸下，面板骨架、控件语言、间距节奏、滚动行为与一般游戏态 / 商店态一致；差异仅来自角色内容本身。

## 当前核验（2026-09-11）

- 已阅读 `docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/ui.md` 和 `docs/docs-828/05-conventions/doc-maintenance.md`。
- 已定位角色 Workspace、通讯录、对话和商店 Workspace 的主要组件与 CSS 落点。
- 修复 `WorkspaceFrame` 角色分支缺少 `character-workspace` 外层 class 的问题，使既有角色 Workspace CSS 真正命中。
- 角色三栏顶部改用普通游戏态的 `renderPanelHeaderRegion`，统一复用 `leftPanel.tabs`、`centerPanel.tabs`、`rightPanel.tabs`。
- 角色与商店 Workspace 共用列边界、圆角、溢出和 `panel-body` 间距契约；角色内容仍保留通讯录、学生故事和角色成长语义。
- 专项测试：`npx vitest run tests/ui/workspace-frame.test.ts tests/ui/components/contacts.test.ts`，20/20 通过。
- 类型检查：`npx tsc --noEmit` 通过。
- 全量测试：`npm test -- --reporter=dot`，133 个测试文件、1251 个测试通过。
- 构建：`npm run build` 通过；仅保留既有的产物 chunk 大小提示，无构建错误。
- 浏览器验收：本地游戏页已逐项核对普通游戏态、Spot 商店态与学生 Workspace；学生页外层为 `workspace-frame workspace-frame--character character-workspace`，三栏标准 Tabs Host 均命中，旧版角色专用 Tabs Host 为 0；普通主题下桌面布局视觉一致。

## 剩余工作

- 无。

## 相关路由

- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/plan-work/active/task-0040-unified-workspace-frame]]
- [[docs/plan-work/active/roadmap-0018-ui-host-registry]]
