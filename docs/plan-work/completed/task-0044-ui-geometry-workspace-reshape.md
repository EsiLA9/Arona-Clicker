# Task 0044：UI Geometry Contract 与 Workspace 视觉基础设施重塑

状态：✅ 已完成（P0–P7 已实施并通过自动化、Chrome/CDP 与工程门禁；CUA 连接故障不影响浏览器证据）

上游：[[docs/plan-work/newPlan/12-ui-geometry-workspace-reshape]]（本地化结构重塑草案）

依赖：[[docs/plan-work/active/task-0040-unified-workspace-frame]]、[[docs/plan-work/active/task-0042-character-workspace-ui-convergence]]、[[docs/plan-work/active/task-0043-topbar-settings-workspace]]、[[docs/plan-work/newPlan/10-inventory-workspace]]

本文是可执行的 UI 结构施工任务表。它只负责 `src/ui/` 的 Workspace 几何、Panel/Region/Host 结构与视觉边界，不修改玩法机制、PlayerState、Datapack 机制或业务内容规则。

## 目标

建立并落地一套单一所有者的 UI 结构契约：

```text
AppShell / 当前路由分支
  → WorkspaceFrame：三栏、间距、preset、响应式骨架
    → WorkspaceColumn：slot、role、Host、尺寸链
      → Panel：border、radius、clip、surface
        → PanelTabsRegion / PanelHeaderRegion
        → PanelBody / 业务 Region
```

完成后：

- 新的三栏页面统一使用 `WorkspaceFrame`。
- 外层 columns、gap、列宽 preset 和主要响应式切换只有 Frame 一个所有者。
- Column 不再与 Panel 重复绘制面板表面。
- Tabs、Panel、Background、Presentation、Host Registry 的职责可被测试和文档准确描述。
- Game、Service/Settings、Shop、Character、Inventory 的结构和滚动行为可以按同一张验收表回归。

## 设计边界

### 纳入范围

- `src/ui/components/workspace-frame.ts` 的 Frame/Column 契约、`data-*` 属性和 preset。
- `src/ui/css/variables.css`、`src/ui/css/layout.css` 中 Workspace/Panel/Region 的公共几何规则。
- `renderPanelTabsRegion`、`renderPanelHeaderRegion`、`renderUIHost`、`renderBackground` 的组合边界。
- Game、Service、Settings、Shop、Character、Inventory 的几何、表面、响应式和滚动迁移。
- Host Registry 的稳定物理列 Host、服务子 Host 和兼容别名验证。
- 对 `src/ui/scroll.ts`、Controller 的完整渲染/局部刷新路径进行结构回归。

### 不纳入范围

- 不新增 `WorkspaceRouter` 或重构 `PanelState.service` + `PanelState.workspace` 的路由联合；如后续需要，另立任务。
- 不实现完整 Talklet/Presentation 编辑器，也不新建全局视觉主题。
- 不立即加入 `visual-heavy` preset；只有盘点证明存在稳定需求后才另行裁定。
- 不改变背包筛选、排序、使用、装备或效果逻辑；背包内容与交互以 `10-inventory-workspace` 为准。
- 不删除 Host 兼容别名、legacy class 或存档迁移代码，除非本任务的验证门槛已经满足。

## 当前事实

| 事实 | 当前落点 | 施工含义 |
| --- | --- | --- |
| Frame 已存在 | `src/ui/components/workspace-frame.ts` | 本任务是契约化和收敛，不从零造布局系统。 |
| 路由直接分支 | `src/ui/components/app-shell.ts` | 不把路由重构和几何重塑绑定。 |
| 当前 preset 只有 `default`、`center-heavy` | `WorkspaceLayoutSpec` | 首期保持闭集；Shop 是否使用 center-heavy 先核对源码和视觉测量。 |
| `WorkspaceColumnSpec` 已有 `role` | `workspace-frame.ts` | role 保留为语义数据属性，不参与列宽或业务状态。 |
| Panel Tabs Region 已存在 | `src/ui/components/tabs.ts` | 不重复建设 Tabs Primitive；重点是 Panel/Region 所有权。 |
| Host 根以物理列为主 | `leftPanel`、`centerPanel`、`rightPanel` | 保持现有根 Host，服务子树和兼容别名渐进治理。 |
| ScrollManager 依赖 `.panel` / `.panel-body` | `src/ui/scroll.ts` | 禁止未经验证地增加嵌套 Panel 或改变 Panel 顺序。 |
| Inventory 已可由顶栏直达完整页面 | `controller-actions-topbar.ts`、`inventory-workspace.ts` | 以完整 Inventory Workspace 作为真实回归样本。 |
| Inventory 父类选择器偏差已修正 | Task 0044 已让 Frame 输出 `inventory-workspace`，相关 CSS 父类选择器可命中 | P3 已完成完整页、返回、刷新和多断点回归。 |
| 当前工作树可能含其他任务改动 | Git 工作区 | 每个切片只修改本任务范围，禁止 reset 或覆盖既有改动。 |

## 施工任务表

| 编号 | 任务 | 主要落点 | 交付物 | 状态 |
| --- | --- | --- | --- | --- |
| P0.1 | 盘点 Game / Service / Settings / Shop / Character / Inventory 的 Frame、Column、Panel、Tabs/Header、Body、Host、Background、Scroll Owner | `src/ui/components/*`、`layout.css`、`scroll.ts` | Workspace Geometry Map | ✅ |
| P0.2 | 记录 900/760/640 断点及每页实际命中规则，确认双栏、堆叠、Inspector 下移行为 | `src/ui/css/layout.css` + 浏览器 | 响应式矩阵与问题清单 | ✅ 静态与 Chrome/CDP 已完成 1280/900/760/640/375；CUA 连接故障已记录 |
| P0.3 | 核对 Shop `center-heavy` 的源码意图和实际几何，核对 Inventory legacy class 命中情况 | Shop/Inventory 组件与浏览器 | 两项裁定记录 | ✅ Shop 保持 `default`；Inventory class 命中与窄屏内部滚动均已确认 |
| P1.1 | 固化 Frame preset、slot、role、Host、visible、surface、scroll、responsive 的类型与 `data-*` 结构 | `workspace-frame.ts` | Geometry Contract 初版 | ✅ 首片完成 |
| P1.2 | 整理 Workspace/Panel 几何 token，保留必要兼容变量 | `variables.css`、`layout.css` | 公共 token 表 | ✅ 首片完成 |
| P1.3 | 增加 preset、DOM 结构、列属性、不可重复外层 grid 的自动化测试 | `tests/ui/` | Contract 测试 | ✅ DOM、CSS 静态约束已覆盖 |
| P2.1 | 以 Game 现有 Panel Tabs/Header/Body 为基线，定义“Column 结构 + 单一 Panel surface”组合方式 | Game 组件、`tabs.ts`、`presentation-service.ts` | 组合试点与结构测试 | ✅ Game 保留列内 Panel，服务/功能页使用列级 surface；结构、几何与组合测试通过 |
| P2.2 | 选择一个 Service 页面完成 Panel surface 试点，再迁移 Settings | `service-workspace.ts`、`settings-workspace.ts`、相关 CSS | Service/Settings 首批迁移 | ✅ Service/Settings 已迁移并通过三栏与 Inspector 下移回归 |
| P2.3 | 删除试点范围内 Column/Service/Workspace 类的重复 border/radius/shadow/padding/overflow | `layout.css` | 重复几何减少且视觉等价 | ✅ 重复外框已清理，内容 padding/overflow 保留在业务 Region |
| P3.1 | 明确 Frame、Column、Panel、PanelBody、List/Inspector 的唯一滚动归属 | `scroll.ts`、Workspace 组件 | Scroll Owner 表与测试 | ✅ `data-scroll-owner`、ScrollManager 排除外层 surface、Frame/内容区滚动链均已验证 |
| P3.2 | 统一 Frame 级响应式骨架，保留页面内容特有规则 | `workspace-frame.ts`、`layout.css` | 响应式规则收敛 | ✅ `default` / `two-column` / `single-column` profile 已落地并完成五档 Chrome 断点矩阵 |
| P3.3 | 修正 Inventory `inventory-workspace` class/selector 契约，验证顶栏直达、返回、刷新和窄屏布局 | Inventory/Topbar/CSS/测试 | Inventory 结构回归 | ✅ 顶栏直达完整页、筛选/排序/选择、返回/刷新与窄屏列高均已有自动化及 Chrome 证据 |
| P4.1 | 审计 Character、Shop、背景预览等视觉区域是否有重复的 size/fit/align/Host 语义 | Character/Shop/Presentation | VisualStage 取舍记录 | ✅ 静态审计未发现跨页稳定的大图舞台语义 |
| P4.2 | 仅在存在跨页证据时实现最小 VisualStage；否则保留局部组件 | 由 P4.1 决定 | 最小 Primitive 或明确不实现 | ✅ 首期不新增 VisualStage，保留局部视觉组件 |
| P5.1 | 迁移 Shop，先落实 P0.3 对 `center-heavy` 的裁定 | `shop.ts`、相关 CSS/测试 | Shop 结构迁移 | ✅ surface 完成；保持 `default`，Chrome 已确认 1280/900/760/640/375 |
| P5.2 | 迁移 Character，保持 Task 0042 已完成的内容语义和 Host | `character-workspace.ts`、相关 CSS/测试 | Character 结构迁移 | ✅ surface 完成；角色全界面五档断点无重叠 |
| P5.3 | 迁移 Inventory，保持 `10-inventory-workspace` 的筛选/排序/交互行为 | `inventory-workspace.ts`、相关 CSS/测试 | Inventory 结构迁移 | ✅ surface、筛选/排序/选择、use/返回/刷新与 640/375 内部滚动均有自动化/Chrome 证据 |
| P6.1 | 验证物理列 Host、服务 Host、兼容别名、主题预览和编辑器发现 | `ui-host-registry.ts`、`service-definitions.ts` | Host 兼容清单 | ✅ 物理列/服务 Host/legacy region resolver/动态目标发现与主题实时预览已通过测试和 Chrome |
| P6.2 | 分批清理只承担旧几何的 legacy CSS；保留仍表达业务语义的类名 | `layout.css`、各 Workspace CSS | 清理差异与回归记录 | ✅ Shop/Character/Inventory 外层重复 grid/surface 已清理；业务语义、兼容类名和独立 Shop modal 保留并有静态审计 |
| P7.1 | 更新 UI 模块事实文档、Task 状态、索引和相关机制聚合链接 | `docs/docs-828/02-modules/ui.md`、`docs/plan-work/00-index.md` | 文档同步 | ✅ UI 事实、Task/索引均已同步 |
| P7.2 | 完成全量测试、架构检查、构建和浏览器验收后归档或拆分后续 ADR/Task | `active/`、`completed/` | 完成记录/后续任务 | ✅ 已完成门禁，本 Task 已归档 |

## 实现规则

### Geometry Contract

- Frame 是外层三栏、gap、列宽、可用高度和主要响应式切换的唯一所有者。
- 首期只使用 `default`、`center-heavy`；不得在业务组件中直接声明外层 `grid-template-columns`。
- `role` 只输出语义属性，例如 `data-workspace-role`，不作为几何开关。
- Column 必须具备 `min-width: 0`、`min-height: 0` 的可收缩尺寸链；其 `scroll` 语义必须可追踪。
- 任何新 Workspace 必须在代码评审前声明 preset、三栏 role、Host ID、surface、scroll owner 和响应式行为。

### Panel / Region

- Column 是结构节点，Panel 是默认外层表面；不能让两者同时绘制完整 border/radius/shadow。
- PanelTabsRegion/HeaderRegion 负责顶部区域，不让 `.switch-tabs` 拥有 Panel 几何。
- PanelBody 或明确的 List/Inspector Region 才能成为内容滚动 owner；禁止无界嵌套 `overflow:auto`。
- 迁移不得为了统一而给 Game 的 Rail/Center/Right 再包一层 Panel；必须尊重现有 ScrollManager 识别方式。
- 禁止使用负 margin 修补 Panel 与业务内容的边界关系。

### Host / Theme

- Host ID 使用稳定语义和 Registry 注册关系，不以 DOM 路径或 CSS selector 作为外部合同。
- 继续复用 `renderUIHost`、`presentation-host-target`、`presentation-host-background` 和 `renderBackground`。
- Theme/Presentation 可以改变背景、前景、装饰、状态、文本模式和语义形状；不能改变 columns、业务 DOM 层级、内容比例或 scroll owner。
- 删除兼容 Host 前必须证明运行时、主题预览和 Host Registry 测试均不再依赖。

### Controller / 状态

- 组件继续只读消费 `getView()` / `createUIContext()`。
- UI 路由和筛选/排序等临时视图状态留在现有 Controller/PanelState 边界，不增加 PlayerState 或存档字段。
- 结构变更必须分别验证完整 render、`refreshPanels()`、路由返回和主题切换，避免把视觉迁移误判为纯 CSS 改动。

## 验收矩阵

| 验收面 | 必须证明 |
| --- | --- |
| Frame | 每个三栏页面都由一个 Frame 生成；列顺序、preset、gap、height chain 可从 DOM/契约追溯。 |
| Column | slot、role、Host、visible、min size 和 scroll 语义稳定；Column 不重复拥有 Panel 表面。 |
| Panel | 每列最多一份默认外层 surface；border/radius/clip/shadow 来源唯一。 |
| Tabs/Header | 顶部区域齐平；Tabs 只承担 tablist/tab 交互与排列，Header/Tabs Region 承担区域外观。 |
| Scroll | Frame 不滚动内容；PanelBody/List/Inspector 的滚动 owner 明确；没有双重滚动条；位置恢复不乱序。 |
| Theme | Host 背景、状态、装饰、语义形状仍可生效；主题不会改变三栏几何或业务排列。 |
| Responsive | 1280×720、900、760、640、窄屏均能访问内容；折叠/堆叠行为符合页面定义；focus 顺序稳定。 |
| Inventory | 顶栏背包直达完整 Workspace；筛选、排序、使用、返回、刷新与窄屏布局不回归。 |
| Existing pages | Game、Service、Settings、Shop、Character、Inventory 都保留既有业务内容、空态、错误态和路由行为。 |
| 工程 | 类型检查、全量测试、架构检查、构建和浏览器冒烟均通过；文档和索引状态一致。 |

## 测试清单

### 自动化

- [x] Frame preset/slot/role/Host/visible/scroll 单测（首片覆盖）。
- [x] Game、Service、Settings、Shop、Character、Inventory 的 Frame DOM 结构测试（首片覆盖）。
- [x] Panel Tabs/Header/Body 组合测试，覆盖隐藏列、空内容和无 Tab。
- [x] ScrollManager 位置保存/恢复测试，覆盖结构迁移前后 Panel 顺序（Workspace 外层 surface 已排除）。
- [x] Host Registry 物理列、服务子 Host、兼容 alias、父子关系验证（运行时 Registry 与 legacy region 解析已覆盖）。
- [x] CSS 静态检查：新业务 Workspace 不得声明外层 grid 几何；重复表面规则必须在迁移范围内。
- [x] Workspace 生命周期测试：Settings/Inventory/Character 的完整渲染、刷新、返回，以及 Shop 错误态结构保留。
- [x] 完整 render、局部 refresh、返回、主题切换/预览、错误/空态回归（生命周期测试覆盖刷新/返回/错误/空态，Chrome/CDP 覆盖主题预览与页面断点）。

### 命令

```text
npx tsc --noEmit
npm test
npm run check:architecture
npx vite build --outDir <临时目录>
```

项目的 `dist/`、`web-dist/`、`src/ui/dist/`、`node_modules/` 仍是禁止修改目录。构建检查使用临时输出目录，不能将生成物写入受保护目录。

## 风险与停止条件

| 风险 | 处理方式 | 停止条件 |
| --- | --- | --- |
| 嵌套 Panel 改变 ScrollManager 行为 | 先做单页试点并检查 DOM/滚动索引 | 位置恢复或局部刷新不稳定时停止扩大迁移。 |
| Host alias 删除造成主题丢失 | 保留兼容层并做 Registry/预览测试 | 仍有运行时或编辑器目标引用时不得删除。 |
| 过早加入 `visual-heavy` / VisualStage | 以跨页重复语义为证据 | 只有单页需求时不抽象。 |
| 业务 CSS 与 Frame 几何继续竞争 | P0 输出来源表，P1 静态约束 | 无法确认唯一所有者时不清理旧规则。 |
| Inventory selector 与 Frame class 不一致 | 先补 class/selector 测试，再改响应式 | 直达完整页或窄屏布局回归时停止后续迁移。 |
| 部分刷新假设结构未变 | 同时测完整 render 与 `refreshPanels()` | 出现不必要整页重建或 stale node 时回退到试点范围。 |
| 与工作树其他任务冲突 | 只改本任务文档/代码范围，保留既有修改 | 无法区分归属时先暂停并记录冲突文件。 |

## 完成定义

只有同时满足以下条件，Task 0044 才能标记完成：

1. P0 Geometry Map 和问题裁定已记录。
2. P1 契约、token 和自动化结构约束已落地。
3. 至少一个 Service 页面完成 Panel surface 试点，并完成 Game/Settings 回归。
4. Shop、Character、Inventory 的外层几何不再自行定义 Frame 级布局；Inventory 直达完整页与窄屏规则已验证。
5. 所有已迁移页面的 Panel、Tabs/Header、Body、Host、Background、Scroll Owner 关系可解释且有测试。
6. legacy CSS/Host 兼容层的保留和删除均有证据，不以“看起来不用了”作为依据。
7. 类型检查、测试、架构检查、构建和浏览器验收全部通过。
8. 稳定事实已同步到 `docs/docs-828/02-modules/ui.md`，未裁定事项已拆成后续 Task/ADR 或明确保留在计划文档中。

## 当前核验（2026-09-11）

- 已完成上游草案的本地化拆解，并形成 `newPlan/12-ui-geometry-workspace-reshape.md`。
- 已核对 Task 0040–0043、Inventory 方案、UI 模块卡片及当前 Frame/Panel/Tabs/Host/Background/Scroll 实现。
- P0.1 Geometry Map 已记录在上游本地化草案和本任务的当前事实/盘点矩阵中。
- 已完成首个低风险代码切片：Frame preset/scroll 类型显式化、Workspace/Panel 基础 token 接入、Shop/Character 重复外层 grid 声明移除、Inventory Frame legacy class 修正及对应结构测试。
- 已完成 Service/Settings 的首个 Panel surface 试点：列节点使用显式 `surface: panel`，内容 padding 下移到 `workspace-column__body`，并补充结构测试。
- 已将 Shop、Character、Inventory 的列接入同一套 `workspace-column.panel.presentation-host-target` surface 规则，并移除三者重复的外层 surface 定义；业务内容 CSS 保持不变。
- 已为 `WorkspaceColumn` 输出 `data-scroll-owner`，保留原有 `data-scroll` 兼容语义；Shop 中部目录补齐实际内容滚动。
- 已将 `surface: panel|none`、`data-workspace-surface` 和 `responsive: default|two-column|single-column` 纳入 Frame 契约；Game 明确保留列内 Panel，其余首批 Workspace 由 Frame 列 surface 承担外框。
- 已修正 ScrollManager 只捕获内容 Panel，避免 Workspace 外层 Panel 改变既有滚动索引；新增对应单测。
- 已作源码级裁定：Shop 保持 `default` preset，使用 `single-column` 响应式 profile；`center-heavy` 暂不启用。Chrome/CDP 已补齐 Shop 在 1280/900/760/640/375 下的列几何与窄屏滚动测量。
- 已为 Character Workspace 登记 `leftPanel.character.contacts`、`centerPanel.character.story`、`rightPanel.character.progression`，并验证其物理列父级与 `serviceId`。
- 已完成 VisualStage 静态审计：当前视觉需求分别落在联系人头像、Host 背景/装饰和局部剧情内容，没有足够的跨页 size/fit/align 复用证据，首期明确不抽象 VisualStage。
- 最终已完成本地 Chrome/CDP 的 Game、Inventory、Settings、Shop、Character 多断点验收；主题色切换、用户主题编辑器目标发现与实时预览已通过冒烟。CUA 连接返回 `nodeRepl.fetch request failed`，但不影响同一 Chrome 实例的 CDP 证据。

### 已执行核验

- `npx tsc --noEmit`：通过。
- `npx vitest run tests/ui/presentation-text-color-css.test.ts tests/ui/workspace-frame.test.ts tests/ui/scroll.test.ts tests/ui/ui-host-registry.test.ts --reporter=dot`：4 个文件、31 个测试通过。
- `npm test -- --reporter=dot --silent`：139 个测试文件、1291 个测试通过。
- `npx vitest run tests/ui/workspace-lifecycle.test.ts --reporter=dot`：3 个生命周期测试通过。
- `npx vitest run tests/ui/workspace-frame.test.ts --reporter=dot`：7 个 Frame 契约测试通过，覆盖隐藏列、无标题/空内容、Tabs/Header/Body 组合和 delegated scroll owner。
- `npm run check:architecture`：通过。
- `git diff --check`：通过（仅报告现有工作树的 LF/CRLF 提示）。
- `npx vite build --outDir C:\\Users\\15229\\AppData\\Local\\Temp\\acprogram-task0044-build-check-6`：通过；仅有既有 chunk size warning，未写入受保护输出目录。
- 本地 Vite 服务已在 `http://127.0.0.1:5175/` 完成 Chrome/CDP 实机验收：Game、Inventory、Settings、Shop、Character 均检查 1280/900/760/640/375；Inventory 直达、筛选/排序/选择、Character 全界面、Shop surface 与主题编辑器目标发现均通过。CUA 连接仍返回 `nodeRepl.fetch request failed`，因此人工 CUA 视觉复核仍未完成。
- Chrome/CDP 断点证据：窄屏 WorkspaceFrame 列按顺序堆叠且无矩形重叠；Inventory 在 640/375 下三栏内部高度链闭合，导航区保持可滚动；Character 在 640/375 下联系人/故事/成长区分别可访问。

## 相关路由

- [[docs/plan-work/newPlan/12-ui-geometry-workspace-reshape]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/refactoring]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/plan-work/active/task-0040-unified-workspace-frame]]
- [[docs/plan-work/active/task-0042-character-workspace-ui-convergence]]
- [[docs/plan-work/active/task-0043-topbar-settings-workspace]]
- [[docs/plan-work/newPlan/10-inventory-workspace]]
- [[docs/plan-work/active/roadmap-0015-ui-dom-recalculation]]
- [[docs/plan-work/active/roadmap-0018-ui-host-registry]]
- [[docs/plan-work/active/roadmap-0020-service-workspaces]]
