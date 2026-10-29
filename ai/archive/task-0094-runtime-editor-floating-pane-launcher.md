# Task：Runtime Editor 浮动工作区与全局入口

状态：active — 🟡 浮动面板与全局入口已落地，待浏览器验收与最终准出

## 前置与目标

前置任务：[[task-0093-init-editor-design]]。

当前 Runtime Editor 的创建入口通过 Toast 提供。Toast 是短暂反馈层，且入口依赖顶栏动作绑定与数据包服务页面生命周期，导致 Init 选择大厅可能看不到编辑入口，用户必须先进入设置 / 数据包页面才能触发编辑器状态。

本 Task 将 Runtime Editor 改造成独立的 body 级浮动工作区，使编辑器可以从 Init 选择页、游戏页、设置页和数据包页直接打开。Toast 只保留保存、应用和错误等短暂反馈。

本 Task 只处理游戏内 `src/ui/` Runtime Editor 的承载与入口，不恢复 `tools/datapack-editor/`，不改变 Init / Area / Spot 的引擎语义和 Policy 授权范围。

## 设计裁定

### 1. 入口与生命周期

- 全局顶栏增加“编辑器”入口；普通游戏页与 Init / Global Enhancement 选择页都必须渲染。
- 入口不依赖 active Init，也不依赖已进入设置页或数据包页。
- 点击入口只打开浮动工作区，不改变当前服务路由，不离开 Init 选择大厅。
- 浮动工作区挂在 `document.body`，不挂在会被全量重建的 `#app` 内。
- `render()`、切换服务和选择页翻面不能自动关闭工作区或清除草稿。
- `Esc` 和关闭按钮只关闭视图；清除草稿必须由用户显式确认。

### 2. 浮动工作区形态

首版采用右侧 Dock：

```text
┌──────────────────────────────────────────────┐
│ AronaClicker       编辑器  主题  游戏  设置   │
└──────────────────────────────────────────────┘

                       ┌────────────────────────┐
                       │ Runtime Editor      × │
                       │ Runtime Mod 状态       │
                       │ [Init] [Area] [Spot]  │
                       │                        │
                       │ 内容列表 / 编辑表单    │
                       │ 诊断 / Draft / Applied │
                       │                        │
                       │ [保存草稿] [应用]      │
                       └────────────────────────┘
```

- 桌面端：右侧固定浮动面板，宽度约为视口的 40%～55%，高度避开顶栏。
- 窄屏端：切换为底部抽屉或接近全屏的单列面板。
- 面板标题、状态条和主要操作固定，列表 / 表单区域独立滚动。
- 初版不支持拖拽定位，避免增加焦点、越界和窄屏恢复复杂度。

### 3. 面板状态

浮动面板的打开状态、当前视图和位置属于 UI 状态；Draft、Applied、诊断和编辑内容仍属于现有 `runtimeDatapackEditor` 状态。

面板至少支持三种状态：

1. 未开启编辑态：提供“开启编辑态”。
2. 已开启但未配置 Mod：直接展示 Mod 元信息表单，不跳转设置。
3. 已配置 Mod：展示 Init / Area / Spot 内容浏览器和完整编辑工作区。

关闭面板不影响草稿；重新打开后恢复当前内容类型、条目、Switch 和表单暂存。

### 4. Toast 职责收缩

保留：

- 草稿保存成功 / 失败；
- Apply 成功 / 失败；
- 删除撤销或危险操作结果。

移除：

- 新建 Init / Area / Spot 的 Toast 入口；
- 编辑器状态展示；
- 编辑器主导航；
- 需要用户长期依赖的操作按钮。

## 预计实现切片

### F1：全局入口

- [x] 在普通 Header 和选择页 Header 增加编辑器按钮。
- [x] 统一入口的 active、aria-expanded 和 disabled 语义。
- [x] 将现有“打开编辑器”动作改为打开浮动工作区，不导航到设置。

### F2：浮动工作区宿主

- [x] 增加 body 级 Runtime Editor Dock 的渲染与挂载生命周期。
- [x] 将现有编辑器 Toggle、Mod 元信息、内容浏览器和 Definition 表单接入 Dock。
- [x] 保证全量 `#app` 重渲染时只更新面板内容，不重复挂载宿主。

### F3：操作与关闭策略

- [x] 面板内完成开启、保存 Mod、切换内容、编辑、Apply、关闭和放弃草稿。
- [x] 关闭时保留 Draft；存在未应用变更时提供明确状态，不使用 Toast 代替确认。
- [x] 删除 Toast 创建入口，保留临时结果反馈。

### F4：视觉与可访问性

- [x] 使用 Runtime Editor 专用面板层级，不复用 Toast 的视觉语义。
- [x] 对齐 Arona / Schale 控制台风格：深色半透明面板、青蓝状态线、窄型等宽标签。
- [x] 添加焦点可见、Esc 关闭、窄屏单列、减少动画和面板内滚动规则。

### F5：验证

- [x] 测试 Init 选择页入口和没有 active Init 时的编辑器引导。
- [x] 测试数据包页入口及既有编辑器工作流。
- [x] 测试 Toast 不再承载 Runtime Editor 创建入口。
- [x] 完成类型、专项测试、架构、文档和全量测试。
- [ ] 完成面板跨 `render()` 的浏览器状态验收与桌面视觉验收。

## 当前实施记录（2026-09-18）

- 在 `header.ts` 的普通 Header 与 Init 选择页 Header 增加全局编辑器入口；`actions.ts` 统一绑定入口并清理历史 Runtime Editor Toast action。
- 在 `view.ts` 增加 body 级 Runtime Editor 面板渲染；面板打开状态由 `UIController` 保留，内容仍复用现有 Runtime Editor Draft / Applied / Policy / Apply 逻辑。
- `runtime-editor.css` 增加右侧 Dock、窄屏抽屉、面板内滚动、焦点和减少动画规则。
- 主编辑器不再通过 Toast 的“新建 Init / Area / Spot”动作承载；Apply 结果改为普通短暂 Toast，编辑器导航与状态留在面板内。
- 回归证据：`npx tsc --noEmit` 通过；Runtime Editor 与顶栏专项测试通过（17 tests）；全量测试、架构检查和文档检查待本阶段最终复跑。
- 当前剩余：真实 Edge 视觉验收仍受桌面浏览器通道无法可靠确认 URL 的环境限制；构建仍不执行，以避免写入项目禁止修改的生成目录。

## 不做的内容

- 不改变 `RuntimeWorldDraft`、Registry mutation、Policy 或 Init / Area / Spot 运行时语义。
- 不开放新的复杂字段，不处理 `tools/datapack-editor/`。
- 不把编辑器状态写入存档，不增加存档迁移。
- 不在本 Task 引入通用跨业务窗口管理系统；只有出现第二个明确消费者时才抽象通用 Floating Panel Manager。
- 不用 Toast、浏览器原生 alert 或路由跳转替代编辑器面板。

## 验收口径

- 在 Init 选择大厅无需进入设置即可看到并打开“编辑器”。
- 没有 active Init 时，编辑器仍能完成 Runtime Mod 配置和新建 Init。
- 打开编辑器不会改变当前选择页、游戏状态或服务路由。
- 面板关闭后 Draft 仍存在，再次打开可继续编辑。
- Apply、诊断、差异和错误均在编辑器面板内可理解；Toast 仅显示短暂结果。
- 桌面端与窄屏端均可完成打开、切换、编辑、关闭和键盘操作。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[task-0093-init-editor-design]]
