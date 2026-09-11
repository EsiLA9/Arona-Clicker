# UI 结构重塑草案：Geometry Contract、Workspace Frame 与视觉基础设施

状态：✅ 已转 Task-0044，实施完成；本文件保留为上游方案与未裁定项记录

上游：用户提供的《Task 004x：UI Geometry Contract 与 Workspace 视觉基础设施重塑》

本地基线：[[docs/0x-plan&work/active/task-0040-unified-workspace-frame]]、[[docs/0x-plan&work/active/task-0042-character-workspace-ui-convergence]]、[[docs/0x-plan&work/active/task-0043-topbar-settings-workspace]]、[[docs/0x-plan&work/newPlan/10-inventory-workspace]]、[[docs/docs-828/02-modules/ui]]

本文是结合当前 ACProgram 源码整理出的施工前草案，不代表已经形成 ADR，也不直接替代 `docs/docs-828/` 中的机制事实源。

## 目标

把现有 UI 中分散在 `WorkspaceFrame`、`WorkspaceColumn`、`.panel`、`.service-column`、业务 Workspace 类名、Host Registry 与主题展示层中的几何职责重新收拢，形成可持续扩展的 UI 结构契约：

```text
AppShell / 当前路由分支
  → WorkspaceFrame：三栏、间距、尺寸预设、响应式骨架
    → WorkspaceColumn：槽位、语义角色、Host 挂载、尺寸链
      → Panel：一份外层表面、边框、圆角、裁剪
        → PanelTabsRegion / PanelHeaderRegion
        → PanelBody / ListRegion / InspectorRegion / ActionRegion
          → 业务内容
```

同时保留现有主题与背景基础设施的职责：

```text
Theme / Presentation：背景、前景、装饰、状态、语义形状
Geometry Contract：列宽、间距、内外层尺寸、滚动归属
UI Host Registry：稳定的语义挂载点与父子关系
Controller：路由、动作、刷新；不把 PlayerState 写入 UI
```

最终目标是让新建或迁移 Workspace 时只需要声明 frame preset、列角色、Host ID、表面结构和 scroll owner；不再从某个旧页面复制一组恰好能工作的 CSS。

## 设计边界

### 本次范围

- `src/ui/components/workspace-frame.ts` 的 Frame/Column 几何契约与数据属性。
- `.workspace-frame`、`.workspace-column`、`.panel`、`.panel-body` 及 service/Shop/Character/Inventory 旧样式的职责收敛。
- 已存在的 `renderPanelTabsRegion`、`renderPanelHeaderRegion`、`renderUIHost`、`renderBackground` 的结构边界。
- 三栏 Workspace 的响应式、最小尺寸、header/body/footer 和滚动归属。
- Game、Service/Settings、Shop、Character、Inventory 的结构盘点、迁移顺序、测试和浏览器验收。
- Host Registry 的物理列 Host、兼容别名和主题/预览安全边界。

### 非目标

- 不修改玩法、PlayerState、Datapack 机制、交易、背包物品规则或角色关系机制。
- 不在本任务内实现完整 Talklet/Presentation 编辑器或全新的主题视觉语言。
- 不把 `tools/datapack-editor/` 当作当前游戏内 UI 的默认修改目标。
- 不在调查完成前进行整份 `layout.css` 的机械重写或删除全部 legacy class。
- 不在本任务内强行引入 `WorkspaceRouter`、route union 或存档迁移。路由统一可另立 Task/ADR；当前 `PanelState.service` 与 `PanelState.workspace` 的并存是已知基线。

## 上游原则的本地化裁定

上游草案的核心原则全部保留：Frame 负责大结构，Primitive 负责局部组成，Theme 只负责外观；业务页面不直接控制三栏几何；稳定的语义 Host 不依赖 DOM 路径。

结合本地代码，做以下调整：

| 上游建议 | ACProgram 的落地方式 |
| --- | --- |
| 从零建立 Workspace Frame | 不从零建立。`WorkspaceFrame`、`WorkspaceColumnSpec`、`renderUIHost` 已存在，先补契约和收敛重复样式。 |
| 新增 `WorkspaceRouter` | 暂不新增。`renderAppShell` 目前直接按 `service` / `workspace` 分支；先稳定 Frame 与路由输入，避免把几何重塑和路由重构绑死。 |
| `role` 不进入 Frame API | 当前 `WorkspaceColumnSpec` 已有 `role`。保留它作为语义角色并输出 `data-workspace-role`，明确禁止用它选择列宽或承担业务状态。 |
| 新增 `default`、`center-heavy`、`visual-heavy` | 首期只承认源码已有的 `default`、`center-heavy`。`visual-heavy` 只有在盘点证明存在稳定的第三种几何需求后才加入。 |
| 使用 `workspace.*` 作为根 Host | 不替换当前物理根 Host。继续以 `leftPanel`、`centerPanel`、`rightPanel` 为兼容基线，在其下挂 `*.shop.*`、`*.character.*` 等语义 Host。 |
| 新建 Tabs Primitive | 不重复建设。当前 `renderPanelTabsRegion` 已是独立的 `panel-tabs-region` 结构 Host，`.switch-tabs` 只保留 tablist/tab 的排列与交互职责。 |
| 立即实现 VisualStage | 先做 VisualStage 需求审计和最小原型；如果只有单页使用，则保持页面局部实现，不为抽象而抽象。 |

## 当前事实与代码落点

### 已有基础设施

- `src/ui/components/workspace-frame.ts` 已输出 `workspace-frame`、`workspace-column`、slot、role、Host、surface、scroll owner、responsive profile 和 `data-*`；当前 layout preset 是 `default | center-heavy`。
- `src/ui/components/app-shell.ts` 当前直接分支渲染 Game、Service、Shop、Character、Settings、Inventory；尚无独立的 `WorkspaceRouter`。
- `src/ui/components/tabs.ts` 已提供 `renderPanelTabsRegion` 与 `renderPanelHeaderRegion`；Game 的 Rail、Center、Right Panel 已采用 `panel-tabs-region` 和 `.panel-body`。
- `src/ui/presentation-service.ts` 与 `src/ui/ui-host-registry.ts` 已承担 Host 层级、背景、状态、形状、文本模式和可编辑挂载点；主题不能注入任意 CSS/DOM。
- `src/ui/scroll.ts` 当前按内容 `.panel` / `.panel-body` 保存和恢复滚动位置；Workspace 外层 surface 不应进入这份快照。因此，新增外层 Panel 或改变内容 Panel 顺序必须先评估滚动兼容性。
- `src/ui/css/variables.css` 已有色彩、字体、面板和 `--workspace-*` 相关 token；后续新增几何变量应集中到 token，而不是在业务类中继续写 magic number。

### 当前缺口与重复职责

| 位置 | 当前情况 | 重塑时的处理 |
| --- | --- | --- |
| Frame/Column | Frame 负责三栏网格，但 `service-column`、Shop/Character 的 Workspace 类和 Inventory 的列样式仍重复设置边框、圆角、背景、padding、overflow。 | 先建立所有权表，再逐页删除重复几何；Column 保持结构容器，Panel 成为表面单一所有者。 |
| Game | Frame 外层是结构网格，Rail/Center/Right 内部各自渲染 `.panel`，且已使用 Tabs Region 与 Panel Body。 | 作为 Panel/Tabs/滚动的第一参考；不为了统一而再包一层 Panel。 |
| Service/Settings | `service-workspace` 与 `service-column` 同时承载部分面板外观和内容尺寸；Registry 既有物理列 Host，也保留部分 center-root 兼容 Host。 | 先把外观收敛到 Panel/Region；兼容 Host 暂不删除，待运行时、主题和预览验证后再清理。 |
| Shop | 已使用 Frame 与 Shop 专属 Host；源码当前没有实际选用 `center-heavy`，但旧 Task 0040 曾把 Shop 描述为 center-heavy 参考。 | 先核对视觉意图和实际测量，再决定是否补 preset，不能只按旧文档改 CSS。 |
| Character | Task 0042 已完成外层 Frame 接入和顶部 Header Region 收敛，内容语义较完整。 | 作为业务内容与 Host 语义参考，不让 Character 内容重新定义外层网格。 |
| Inventory | 已改为点击顶栏直接打开完整 `inventory` Workspace；Task 0044 首片已补上 `inventory-workspace` Frame legacy class，CSS 父类选择器现可命中。 | 作为本任务的真实回归样本，继续统一列面板与响应式；内容和交互继续遵循 `10-inventory-workspace`。 |
| Host Registry | Service definitions 中存在物理列 Host 与兼容中心根 Host 并存。 | 以稳定语义 ID 为合同，兼容别名采用有测试的过渡策略，不直接删除历史主题目标。 |
| 响应式 | `layout.css` 中存在 900/760/640 等分散断点，Shop/Character/Service/Inventory 的行为并不完全一致。 | Frame 统一大结构切换；页面只声明内容特有的折叠、排序、工具栏和 inspector 行为。 |

### Workspace 盘点矩阵

| Workspace | Frame/preset 基线 | 三栏内容与语义 | 当前主要风险 |
| --- | --- | --- | --- |
| Game | `id=game`，默认三栏；宽度目前约为左 230 / 中心自适应 / 右 300 | `leftPanel.*`、`centerPanel.*`、`rightPanel.*`；顶部多为 Panel Tabs Region | 外层结构列与内层 Panel 的职责必须保持清楚，不能引入双重表面或双重滚动。 |
| Service | `id=service-${service}`，默认三栏 | navigation / main / inspector；settings、datapack、saves、records 等有各自 service Host | `service-column` 仍拥有部分外观；兼容 Host 和实际物理列 Host 的映射需保持。 |
| Shop | `id=shop`，当前保持 `default` | feed / catalog / settlement | 当前默认列宽已经让中心栏消费剩余空间；`center-heavy` 在宽屏下反而重新分配左右栏，暂不按历史文档强行启用。 |
| Character | `id=character`，默认基线 | contacts / story / progression | 已完成收敛，但旧 Workspace 外观规则仍需逐项归属。 |
| Inventory | `id=inventory`，当前实现按默认宽度 | filters / item list / inspector；点击顶栏直达完整页 | legacy class 缺口导致部分响应式规则不命中；筛选工具栏与列表滚动需要避免互相抢占。 |
| Settings | `id=settings`，`responsive=two-column` | settings navigation / form content / inspector 或 actions | 与 Service 共用 Frame 响应式骨架和 Panel surface；内容高度规则仍由页面保留。 |
| Lobby/Selector | 非三栏 Workspace | selector、orb、viewport、全局背景 | 本任务只把它作为背景/Host 参考，不把它硬套进 Frame。 |

当前浏览器基线在 1280×720 下普通 Game 与完整 Inventory 均可测得三栏高度约 580px；Inventory 的列宽约为 230 / 620 / 300。该数据用于回归比较，不直接固化为新的业务 CSS。

## 目标结构契约

### WorkspaceFrame

`WorkspaceFrame` 是三栏业务页面的唯一外层几何所有者，至少负责：

- `left / center / right` 三个 slot 的存在性和顺序。
- `gap`、可用高度、`min-height: 0`、页面级 overflow 和列宽 token。
- `default`、`center-heavy` 等已登记 preset 的列宽映射。
- 桌面到窄屏的主要布局模式切换。
- 稳定的 `data-workspace-frame` 与 `data-layout`。

Frame 不负责：业务数据、具体 card/list 排列、Tab 交互、主题状态、PlayerState 写入或页面内部的二次网格。

首期建议继续沿用现有 `WorkspaceFrameSpec`，仅补强类型、测试和 token。不要为了“纯洁”立刻改造所有调用方。

### WorkspaceColumn

`WorkspaceColumn` 是结构容器和 Host 挂载点，不是 Panel 表面。它负责：

- slot、可见性、语义 `role`、Host ID、theme scope。
- `min-width: 0`、`min-height: 0` 和列高度链。
- `scroll` 声明或等价的 scroll owner 语义。
- header/content slot 的结构承载。

它默认不负责边框、圆角、阴影、面板背景和业务 padding。若为 `renderUIHost` 需要保留一层结构 wrapper，必须把 wrapper 视为 Host/布局节点，并由测试保证不会与 Panel 重复绘制表面。

### Panel 与 PanelRegion

每个可见列在收敛后的目标结构是“一列一份外层 Panel 表面”：

```text
WorkspaceColumn [结构 / Host]
└── Panel [border / radius / clip / surface background]
    ├── PanelTabsRegion 或 PanelHeaderRegion
    ├── PanelBody [content padding / scroll owner]
    └── 可选 PanelFooter / ActionRegion
```

- `Panel` 统一拥有外层 border、radius、clip、surface shadow 和默认表面入口。
- `PanelTabsRegion` / `PanelHeaderRegion` 统一拥有顶部区域的高度、divider、局部背景和内边距。
- `PanelBody` 统一拥有内容 padding 与实际滚动；列表或 inspector 需要独立滚动时显式声明，而不是靠嵌套 `overflow:auto` 猜测。
- `PanelRegion`、`ListRegion`、`InspectorRegion`、`ToolbarRegion`、`ActionRegion` 只有在至少两个 Workspace 共享同一语义和滚动/Host 需求后才抽为正式 Primitive。
- 禁止用负 margin 把业务内容“拉回”到 Panel 边界；需要跨区视觉效果时使用 Region 或 Presentation background。

迁移期间允许保留“Host wrapper + 现有 Panel”结构，但必须标注谁是表面所有者；禁止同时让 `.service-column`、`.workspace-column` 和 `.panel` 都画一套 border/radius/shadow。

### SwitchTabs

`.switch-tabs` 及其渲染函数只负责 tablist、tab、active/hover/focus、indicator、方向和排列。它不负责：

- Panel 的圆角、边框、阴影、整体背景。
- 列宽、列高、页面 grid 或业务内容 scroll。
- 用 tab class 反向改变 Workspace Frame 的几何。

顶部齐平的目标由 `PanelTabsRegion` 与统一 tabs token 实现，保持当前 Shop 风格的平齐效果；不通过各页面单独调负 margin 达成。

### VisualStage

VisualStage 作为后续候选 Primitive，只抽象“主要视觉区域”的共同语义，不承载完整 Talklet：

```text
VisualStage
  size: small | medium | large | fill
  fit: contain | cover | natural
  align: center | bottom | start
  scroll: none | auto
  hostId / themeScope
```

实际引入前须先完成 Character、Shop、背景/预览等现有视觉区域的盘点。若不能证明至少两个页面有相同的 size/fit/align/Host 语义，则只记录局部组件，不增加全局 Primitive。

## 几何与视觉的所有权表

| 事项 | 唯一默认所有者 | 允许被主题影响的范围 |
| --- | --- | --- |
| 三栏、顺序、gap、列宽 preset | WorkspaceFrame | 不允许主题改写业务列结构 |
| 列的最小尺寸、可用高度、页面级 overflow | Frame + Column 合同 | 不允许由 card 或 tab 偶然撑开 |
| 外层 border、radius、clip、shadow | Panel | 主题可提供语义 shape/token，但不得制造第二套结构边界 |
| 顶部 Tabs/Header 的背景、divider、height | PanelTabsRegion / PanelHeaderRegion | 主题可改变表面和状态，不改变三栏几何 |
| Tab 排列、active、focus、indicator | SwitchTabs | 主题可改变颜色、装饰和状态表达 |
| 内容 padding、列表/Inspector 的 scroll | PanelBody / Region | 主题只改变 token，不改变 scroll owner |
| 背景、前景、装饰、状态、文本模式 | Presentation / Theme | 只能通过现有 Host/background 入口生效 |
| Host ID、父子关系、兼容别名 | UI Host Registry | 主题/编辑器消费合同，不由 CSS selector 猜测 |
| 路由、动作、刷新时机 | Controller / AppShell | 不由主题或 Panel 组件触发状态写入 |

本地主题系统已有 `presentation-host-target`、`presentation-host-background`、Host state、corner radius、skew 和 decoration 能力。应明确：这些能力可以改变视觉层的表达，但不能改变 Frame 的 columns、业务 DOM 层级、scroll owner 或内容比例。

## Token 与响应式方案

### Token

整理现有变量时优先保留兼容变量，并逐步收拢为明确命名：

```text
--workspace-gap
--workspace-left-width
--workspace-center-width
--workspace-right-width
--panel-radius
--panel-border
--panel-shadow
--panel-content-padding
--panel-region-gap
--panel-header-height
```

具体默认值以当前 CSS 和浏览器测量为准；草案不在业务页再次硬编码一套数字。`center-heavy` 只改变列宽 token，不改变 Panel 的圆角、内容 padding 或主题语义。

### 响应式

- Frame 统一负责三栏到双栏/堆叠/窄屏的主要布局模式。
- Column 负责 `min-width: 0`、`min-height: 0`，确保内部 flex/grid 可以真正收缩。
- 页面只负责内容特有行为，例如 Inventory 的 inspector 下移、Shop 的筛选工具栏折叠、Character 的故事区高度策略。
- 当前 900、760、640 断点先做证据盘点，不立即合并为单一断点；统一的是所有权，不是强行统一每个页面的视觉结果。
- 窄屏下仍要保持 header 可见、主内容可访问、focus 顺序稳定，并禁止 Frame、Column、PanelBody 形成无界的多重滚动。
- `prefers-reduced-motion` 下不依赖动画完成布局或恢复滚动；主题装饰降级不能影响可读性。

## 施工切片

### P0：证据盘点与 Geometry Map

- 逐页记录 Frame root、列 root、Panel root、Tabs/Header、Body/List/Inspector、Host ID、背景入口和 scroll owner。
- 记录每个页面实际的 `grid-template-columns`、border/radius/padding/overflow 来源和媒体查询命中情况。
- 重点确认 Shop 的 `center-heavy` 意图、Inventory legacy class 缺口、Service/Settings 的重复表面和 Game 的 ScrollManager 依赖。
- 输出一张源码路径与浏览器 DOM 对照表；不在此阶段大规模删 CSS。

### P1：契约、Token 与结构测试

- 固化 `WorkspaceLayoutPreset` 的首期闭集：`default | center-heavy`。
- 为 Frame preset、slot 顺序、role/Host/data attribute、visible/scroll 语义补纯函数和 DOM 结构测试。
- 增加静态检查或测试，阻止新业务 Workspace 再声明外层 `grid-template-columns`。
- 为 Panel 表面单一所有者、PanelBody scroll owner、`min-width/min-height: 0` 建立验收口径。

### P2：Panel / Tabs / Host 表面收敛

- 以 Game 现有 `PanelTabsRegion`、`PanelHeaderRegion`、`.panel-body` 为结构参考。
- 选一个 Service 页面做“Column 结构 + 一份 Panel 表面”的试点，再迁移 Settings。
- 处理 `service-column`、Shop/Character/Inventory Workspace 类中重复的边框、圆角、背景、padding、overflow。
- 保留 Host wrapper 的稳定挂载能力，确认 `renderUIHost` 与 Panel 不产生双重背景或双重裁剪。

### P3：滚动与响应式统一

- 为每个列和主要 Region 写出唯一 scroll owner；验证 header 固定、body 可滚动、列表/Inspector 不互相抢高度。
- 将共同的 Frame 响应式骨架集中管理为 `responsive=default|two-column|single-column` profile，页面只留下内容特有 media rule。
- 更新 Inventory 的 `inventory-workspace` class/selector 契约，并验证顶栏直达完整背包后的首次渲染、返回和刷新路径。
- 通过 1280×720、900、760、640 和窄屏浏览器检查，记录实际宽高而不是只看截图。

### P4：VisualStage 决策与最小实现

- 盘点 Character/Shop/背景预览中重复的视觉区域需求。
- 只有出现跨页稳定语义时，才加入 `VisualStage`；首版只支持 size/fit/align/Host 接入。
- 不把 Talklet 的复杂交互、资源编辑、完整动效或业务状态塞入 VisualStage。

### P5：逐页迁移

迁移顺序建议为：

1. Game：作为结构与滚动基线。
2. Service/Settings：共享度最高，优先清理 `service-column` 重复外观。
3. Shop：保持 `default` preset；使用 `single-column` 响应式 profile，避免把历史 center-heavy 描述误当成当前产品裁定。
4. Character：保持 Task 0042 已完成的内容语义，移除外层几何重复。
5. Inventory：以 `10-inventory-workspace` 的内容/交互为基线，修复 class、响应式和三栏 surface。

每页迁移必须独立验证，不能以“全站 CSS 统一后再一起看”作为验收方式。

### P6：兼容层与旧样式清理

- 先确认 Host Registry 的物理列 Host、兼容 center-root Host、主题预览和编辑器读取均有测试覆盖。
- 再分批移除只承担旧几何的 `.shop-workspace`、`.character-workspace`、`.service-column` 等规则；保留仍表达业务语义的类名。
- legacy class 不是新的实现参考，但在兼容期内不能无证据删除。
- 清理后回看 `src/ui/scroll.ts`、部分刷新路径和背景层，避免结构变化造成隐蔽回归。

### P7：文档与后续任务拆分

- 更新 `docs/docs-828/02-modules/ui.md` 中已稳定的结构事实。
- 若需要正式裁定 route union、Host 命名迁移或第三种 preset，再另立 ADR/Task，不把未裁定内容写成机制事实。
- 将完成后的实现切片移入 `active/` 或 `completed/`，同步 `docs/0x-plan&work/00-index.md`。

## 硬约束

- 任何新的三栏功能页面必须通过 `WorkspaceFrame`。
- `WorkspaceFrame` 是外层 columns、gap、height chain、layout preset 的唯一来源。
- 业务 Workspace CSS 不得重新声明外层 `grid-template-columns`、主列 gap 或列级表面。
- `WorkspaceColumn` 默认是结构/Host 节点，不与 Panel 同时拥有一套边框、圆角、阴影。
- 一列只有一个默认 Panel 表面所有者；不得因 Host wrapper 再叠加第二层视觉 Panel。
- `PanelTabsRegion` / `PanelHeaderRegion` 是顶部结构区；`.switch-tabs` 不拥有 Panel 几何。
- 主要视觉区域使用已审计的 VisualStage 语义；没有跨页证据时不新增全局抽象。
- Host ID 是稳定语义合同，优先使用当前物理列根并通过 Registry 管理服务子树；不以 DOM 路径或 CSS selector 作为主题 API。
- Theme/Presentation 不得改变业务 columns、DOM 结构、内容比例、scroll owner 或数据状态。
- 每个滚动区域必须能回答“谁滚动、谁恢复、谁不滚动”；禁止无界的多重 `overflow:auto`。
- `min-width: 0` 与 `min-height: 0` 是可收缩列和可滚动 body 的必要条件。
- UI 继续只读消费 `getView()` / `createUIContext()`；状态变化继续走现有 mutation/service 边界。
- 不新增存档迁移；几何偏好如仍是临时 UI 状态，就留在 `PanelState` 或等价 UI context。
- 新增 UI 前先声明 preset、Host ID、surface primitive、scroll owner、responsive 行为，再写业务内容。

## 测试与验收

### 自动化

- `WorkspaceFrame` preset 与列宽映射单测。
- Frame/Column 的 slot、role、Host、`data-*` 和 visible 结构测试。
- Panel/Tabs/Header/Body 的结构测试，覆盖无 tab、单 tab、多 tab、隐藏列和空内容。
- scroll owner 与滚动位置恢复测试，覆盖外层 Workspace Panel 排除和内容 Panel 顺序稳定。
- Host Registry 的物理列 Host、兼容别名、父子关系和 service 注册验证。
- 静态 CSS 检查：新增业务 Workspace 不得拥有外层 grid 几何；重复 surface 规则必须有迁移标记。
- 每个已迁移页面至少覆盖完整渲染、局部刷新、返回、主题切换/预览和错误/空态。

### 浏览器

- 宽屏：三栏左右边界、列高、gap、Panel radius/border/clip、顶部 Tabs 是否齐平。
- 窄屏：900/760/640 断点命中、列折叠/堆叠、Inspector 位置、列表可滚动性。
- 滚动：Frame 不滚动内容；PanelBody/List/Inspector 只在声明位置滚动；无双滚动条。
- 视觉：普通 Game、Shop、Character、完整 Inventory、Settings 之间保留同一套基础面板语义；主题背景、形状、装饰仍通过 Host/Preset 入口生效。
- 交互：Tab focus/keyboard、按钮 focus、返回路径、顶栏背包直接打开完整页面、`prefers-reduced-motion`。

### 项目级命令

```text
npx tsc --noEmit
npm test
npm run check:architecture
npx vite build --outDir <临时目录>
```

`web-dist/`、`dist/` 等受保护输出目录不作为本任务的改写目标；浏览器验收使用本地开发服务器或项目既有 UI 入口。

## 当前核验（2026-09-11）

- 已阅读上游 Task 004x 草案和本地 `docs/docs-828/00-INDEX`、UI 模块卡片、Task 0040/0042/0043、背包 Workspace 草案及相关 UI 源码。
- 已确认当前 Frame、Panel Tabs Region、Host Registry、Presentation/Background 服务均已存在；本任务是收敛与契约化，不是从零搭建。
- 已确认当前完整背包由顶栏直接进入 `inventory` Workspace；新方案不再按旧历史描述把背包默认视为右侧抽屉。
- 已确认 Inventory 的 Frame legacy class 偏差已由 Task 0044 修正，现有父类 CSS 选择器可以命中；Chrome/CDP 已完成完整页、1280/900/760/640/375 多断点与窄屏滚动回归。
- 已确认当前普通 Game 与完整 Inventory 的宽屏列高/列宽可作为浏览器回归基线；Task 0044 已按本草案完成 Geometry token、Panel surface 和 Workspace class 收敛。

## 待裁定问题

1. 已采用 `WorkspaceColumn.surface` 显式声明外层 `panel|none`；Game 保留 `none`，其余首批 Workspace 使用唯一外层 Panel surface。
2. 已作源码级裁定：Shop 暂不启用 `center-heavy`；默认列宽在宽屏下将剩余空间给中心目录，历史描述不足以推翻当前实现。
3. 已采用 `WorkspaceLayoutSpec.responsive` 的 `default|two-column|single-column` 闭集，统一 Frame 级切换（default/two-column 在 900px 进入二栏，default/single-column 在 760px 进入单栏），页面继续保留内容特有规则。
4. `role` 是否收敛为闭集 union，还是保留可扩展 string；应以 Host/编辑器消费需求决定。
5. 已新增 `data-scroll-owner`，并让 ScrollManager 排除 Workspace 外层 surface；Chrome/CDP 已完成内容区滚动确认，刷新/返回路径已有生命周期自动化覆盖。
6. `visual-heavy` 何时有足够的跨页证据可以加入 preset；在此之前不应为了对齐上游草案而增加。
7. 兼容 center-root Host 何时可删除；以运行时、主题预览和 Host Registry 测试均不依赖为门槛。

## 相关路由

- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/refactoring]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/0x-plan&work/active/task-0040-unified-workspace-frame]]
- [[docs/0x-plan&work/active/task-0042-character-workspace-ui-convergence]]
- [[docs/0x-plan&work/active/task-0043-topbar-settings-workspace]]
- [[docs/0x-plan&work/newPlan/10-inventory-workspace]]
- [[docs/0x-plan&work/active/roadmap-0015-ui-dom-recalculation]]
- [[docs/0x-plan&work/active/roadmap-0018-ui-host-registry]]
- [[docs/0x-plan&work/active/roadmap-0020-service-workspaces]]
