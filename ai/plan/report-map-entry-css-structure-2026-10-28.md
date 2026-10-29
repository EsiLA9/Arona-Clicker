# 地图准备页（MapEntry）CSS 结构调查

> 范围：`createMapEntryWorkspaceFrame` / `renderMapEntryWorkspace` 及其样式文件 `src/ui/css/map-entry-workspace.css`，对照项目通用工作区结构 CSS（`src/ui/css/layout.css`）与同族 `src/ui/css/map-workspace.css`、`src/ui/css/area-map.css`。
> 结论只描述现状，不含改动。

---

## 1. 结论摘要

地图准备页的 CSS 是一份**完全自足、与通用 Frame 骨架解耦**的样式：

- 它只认自己的 BEM 类（`.map-entry-workspace__*`）+ 一个外壳覆写（`.workspace-frame--map-entry`），**不写任何 `[data-column-origin]` / `.workspace-column__*` 选择器**；
- 面板表面（底色、描边色、圆角）**不写死 panel token**，交给主题宿主（theme cluster / node line / `--presentation-corner-radius`）——与 `map-workspace.css` 明确写死 `--panel` / `--line` / `--panel-radius` 的做法相反；
- 顶栏不通过 `WorkspaceColumnSpec.header`，而是**内联进 `content`**，因此页面里**不存在 `.workspace-column__header` 元素**；
- 三栏宽度、`gap`、滚动归属沿用通用机制，但**没有任何响应式 media query**，窄屏只剩 `layout.css` 的通用降级；
- 按钮全部复用全局类（`.story-trigger` / `.mini-action`），并且**跨文件借用了 `map-workspace.css` 的 `.map-workspace__hero-action--danger`**；
- 与项目其它页面相比，**缺少禁用态、焦点态、悬停态与动效降级**的本地定义。

---

## 2. 文件与依赖清单

| 角色 | 位置 |
| --- | --- |
| 帧构造 | `src/ui/components/map/map-entry-workspace.ts:119-166`（`createMapEntryWorkspaceFrame`） |
| 页面根 | `src/ui/components/map/map-entry-workspace.ts:168-171`（`renderMapEntryWorkspace`） |
| 本页样式 | `src/ui/css/map-entry-workspace.css`（179 行，26 条规则） |
| 通用骨架 | `src/ui/css/layout.css:320-386`（`.workspace-frame` / `.workspace-column*`） |
| 顶栏宿主 | `src/ui/css/chat.css:26-33`（`.panel-tabs-region`） |
| 按钮类 | `src/ui/css/story-nav.css:59-74`（`.story-trigger`）、`src/ui/css/cards.css:158-183`（`.mini-action`） |
| 跨文件借用 | `src/ui/css/map-workspace.css:229-236`（`.map-workspace__hero-action--danger`） |
| 样式契约测试 | `tests/ui/map-shell-layout.test.ts:15-49` |

挂载链：`main.console-shell` → `.map-entry-workspace` → `.workspace-frame.workspace-frame--map-entry` → 三列 `section.workspace-column`。

---

## 3. 实际生成的结构

```
main.console-shell
└─ div.map-entry-workspace                      [data-map-entry-workspace][data-map-region-key=entry-root]
   └─ section.workspace-frame.workspace-frame--map-entry
        [data-layout=default][data-responsive=default][data-composition=columns][data-ordered-columns]
      ├─ section.workspace-column.workspace-column--left.map-entry-workspace__left
      │      （surface: none → 无 .panel、无 host geometry）
      │   └─ .presentation-host-content > .workspace-column__slot
      │      └─ .workspace-column__body[data-scroll=none][data-scroll-owner=delegated]
      │         └─ 游戏左栏 rail（renderLeftPanel，无本页样式）
      ├─ section.workspace-column.workspace-column--center.panel.map-entry-workspace__center
      │      （surface: panel → .panel + host geometry）
      │   └─ .presentation-host-content > .workspace-column__slot
      │      └─ .workspace-column__body[data-scroll=none][data-scroll-owner=delegated]
      │         ├─ .ui-cluster.panel-tabs-region.presentation-host-target   ← 顶栏（titlebar 内联）
      │         │   └─ .presentation-host-content > .conversation-heading
      │         │       ├─ button.conversation-back[data-map-entry-leave]
      │         │       └─ .conversation-title > b「地图准备」
      │         └─ div.map-entry-workspace__center-body
      │            ├─ div.map-entry-workspace__overview-scroll[data-scroll-owner=content-region]
      │            │   ├─ section.map-entry-workspace__overview > h1 + p + ul.__tips
      │            │   ├─ section.map-entry-workspace__progress-section > h2 + div.__progress
      │            │   └─ p.map-entry-workspace__notice[role=status]
      │            └─ div.map-entry-workspace__actions[role=group]
      │               ├─ button.story-trigger.map-entry-workspace__primary
      │               └─ details.map-entry-workspace__management
      │                   └─ summary「地图管理」> div[role=group]
      │                       ├─ button.mini-action[data-map-restart]
      │                       └─ button.mini-action.map-workspace__hero-action--danger[data-map-abandon]
      └─ section.workspace-column.workspace-column--right.panel.map-entry-workspace__right
         └─ … .workspace-column__body
            ├─ .panel-tabs-region（顶栏「固定队伍」）
            └─ div.map-entry-workspace__right-body
               ├─ div.map-entry-workspace__party-scroll[data-scroll-owner=content-region]
               │   └─ article.map-entry-workspace__member × N
               └─ section.map-entry-workspace__resources > h2 + div.__resource-row × N
```

要点：**列 body 里没有 `.workspace-column__header`**，顶栏是 body 的第一个直接子元素。

---

## 4. 本页 CSS 的分层拆解

| 层 | 规则 | 作用 |
| --- | --- | --- |
| 外壳 | `.map-entry-workspace`（`:1-8`） | 接管 Shell 剩余高度（`flex: 1 1 0`）与顶部间距（`margin-top: 16px`） |
| Frame 覆写 | `.workspace-frame--map-entry`（`:10-14`） | `height: auto; min-height: 0; margin-top: 0` —— 把通用 Frame 的间距与满高让给外壳 |
| 列根 | `.__center, .__right`（`:16-22`） | 列根变纵向 flex 容器，`overflow: hidden` |
| 列内 body | `.__center-body, .__right-body`（`:24-31`） | `flex: 1 1 auto` 撑满剩余高度 |
| 滚动区 | `.__overview-scroll, .__party-scroll`（`:33-43`, `:120-123`） | `overflow: auto` + `overscroll-behavior: contain` + `padding: var(--panel-content-padding)` |
| 固定区 | `.__resources`（`:160-166`） | `flex: 0 0 auto; max-height: 42%; overflow: auto`，百分比上限依赖父级确定高度 |
| 动作区 | `.__actions`（`:92-97`） | `flex: 0 0 auto; justify-content: flex-end`，按钮不参与收缩 |
| 内容样式 | `:45-90`, `:99-118`, `:125-178` | 纯 BEM 排版：h1/h2/正文/状态/头像/资源行 |

---

## 5. 与「一般结构 CSS」的差异（逐条）

### 5.1 间距与高度的所有权：从 Frame 转移到外壳 wrapper

- 通用：`.workspace-frame { margin-top: 16px; height: 100%; flex: 1; }`（`layout.css:320-332`）——间距属于 Frame。
- map-entry：`.map-entry-workspace` 拿到 `flex: 1 1 0; margin-top: 16px; display: flex; flex-direction: column`，`.workspace-frame--map-entry` 把 Frame 的 `margin-top` 清零、`height` 改 `auto`（`map-entry-workspace.css:1-14`）。
- 同族对照：`map-workspace.css` 用同样的"外壳接管间距"思路，但外壳 `.map-workspace__region` 是**普通块级**容器（`flex: 1 1 0; width: 100%; height: auto; margin-top: 16px`），Frame 仍保留 `height: 100%`（`map-workspace.css:1-6, 51-58`）。map-entry 的外壳是**列向 flex 容器**，Frame 高度由 `flex: 1` + `height: auto` 决定——两者的剩余高度来源机制并不相同。

> 契约测试同时锁定了这两点：`tests/ui/map-shell-layout.test.ts:31-35`（外壳 `flexGrow:1`/`marginTop:16px`，Frame `marginTop:0`）。

### 5.2 三栏宽度沿用通用变量，但没有 gap 与响应式覆写

- map-entry 的 `layout: { composition: 'columns', responsive: 'default' }`，因此吃通用规则 `.workspace-frame[data-layout='default'][data-composition='columns'] { --workspace-left-width: 250px; --workspace-right-width: 320px; }`（`layout.css:334-337`）与通用 `gap: var(--workspace-gap)`。
- `map-workspace.css` 额外显式写了 `gap: var(--workspace-gap, 14px)`、`min-width: 0`，并有**两段响应式 media query**（900px / 760px）给列设 `height: min(70vh, 650px)` 之类的上限（`map-workspace.css:1-6, 1431-1480`）。
- map-entry **没有任何 media query**：窄屏只能落到 `layout.css:648-657`（900px 右栏整行）与 `layout.css:659+`（640px 转纵向 flex、`height: auto`）的通用降级，而 `.map-entry-workspace__resources { max-height: 42% }` 这类百分比高度是按宽屏定高假设写的。

### 5.3 面板表面：主题驱动（与 map 相反）

- `map-workspace.css:19-27` 显式声明 map 列的表面：`border: 1px solid var(--line); border-radius: var(--panel-radius); background: var(--panel); box-shadow: var(--panel-shadow)`——固定 token，**盖过主题**（选择器 `[data-column-origin="map"].panel.presentation-host-target` 特异性高于 `layout.css:420`）。
- map-entry **没有这一段**。中/右列的底色、描边色、圆角实际来自：
  - `.workspace-column.panel.presentation-host-target { border-color: var(--theme-node-line, var(--line)); background: var(--theme-cluster-background, var(--panel)); color: var(--theme-node-text, var(--ink-on-panel)); }`（`layout.css:420-424`）
  - `.panel.presentation-host-target { border-radius: var(--presentation-corner-radius, var(--panel-radius)); }`（`layout.css:824-829`），而 `--presentation-corner-radius` 由 `renderPresentationHostGeometryStyle` 按主题注入（`presentation-service.ts:393-402`；`surface: 'panel'` 时 `useHostGeometry` 为真）。
- 结果：**map 的面板是"写死 token 的游戏面板"，map-entry 的面板是"主题宿主画的面板"**；map-entry 主题切换时表面跟着变，map 不会。

### 5.4 flex 的作用点不同：列根 vs 列 body

- map：`.workspace-frame--map ... .workspace-column__body { display: flex; flex: 1 1 auto; flex-direction: column; padding: 0; overflow: hidden; }`（`map-workspace.css:29-36`）——flex 落在 **body**。
- map-entry：`.__center, .__right { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }` 落在**列根 `<section class="workspace-column …">`**（`map-entry-workspace.css:16-22`），再由 `.__center-body/.__right-body { flex: 1 1 auto }`（`:24-31`）撑开。
- 后果：列根与 `.presentation-host-content` 之间靠 `layout.css:381`（`.workspace-column > .presentation-host-content { height: 100%; min-height: 0; }`）这条**通用 height:100% 链**衔接，而不是 flex-grow；map-entry 的纵向 flex 实际只作用在 `.presentation-host-content` 之上。

### 5.5 顶栏：内联进 content，没有 `.workspace-column__header`

- 通用/同族：map、contacts、story 走 `WorkspaceColumnSpec.header` → 渲染成 `<header class="workspace-column__header">`（`workspace-frame.ts:141`），并由 `layout.css:380`（`.workspace-column__header { flex: 0 0 auto; }`）与 `map-workspace.css:38-45`（把 header 的 padding/border/background 清空）共同约束。
- map-entry：`createMapEntryWorkspaceFrame` **没有 `header` 字段**，而是把 `renderWorkspaceTitlebar(ctx, 'center', …)` 直接拼到 `content` 开头（`map-entry-workspace.ts:132, 143`）。因此页面上**没有 `.workspace-column__header` 元素**，顶栏实际是 `.panel-tabs-region`，其"不收缩"来自 `chat.css:26-33`（`.panel-tabs-region { flex: 0 0 auto; }`）而不是 `.workspace-column__header`。
- 副作用：map 需要的 "header 复位" 规则（`map-workspace.css:38-45`）在 map-entry 里不存在也不需要；但 map-entry 也因此**没有 header 语义元素**（`<header>`），只有 `.panel-tabs-region`。
- `renderWorkspaceTitlebar` 为此扩展了返回动作枚举：新增 `'data-map-entry-leave'`（`workspace-titlebar.ts:4-9, 24-26`），并渲染 `button.conversation-back`——**返回键复用 Chat 的返回按钮样式**，而非工作区统一返回键。

### 5.6 滚动：全部下沉到内容区 + 一个百分比高度的资源区

- 三列统一 `scroll: 'none'` → `data-scroll="none"` → `layout.css:379`（body `overflow: hidden`），滚动完全交给内部 `data-scroll-owner="content-region"` 容器（`map-entry-workspace.ts:134, 145`）。这与 map 的做法一致，属于项目约定。
- 差异细节：
  - map 的滚动容器带 `min-width: 0` 与 `scrollbar-gutter: stable`（`map-workspace.css:105-114`），map-entry 的 `__overview-scroll` / `__party-scroll` **两者都没有**（`map-entry-workspace.css:33-43, 120-123`）→ 出现滚动条时内容宽度会跳变。
  - map-entry 右列多出一个**非 flex 收缩**的资源区 `.__resources { flex: 0 0 auto; max-height: 42%; overflow: auto; }`（`:160-166`）。百分比上限依赖父级有确定高度，这是本页独有写法；map 侧对应区域是普通 flow 段落。
  - map 的 feed 有"贴底跟随"的滚动语义（`mapFeedScroll`），map-entry 无此机制，刷新时只按 `[data-scroll-owner="content-region"]` 恢复 `scrollTop/scrollLeft`（`controller.ts:1647-1658`）。

### 5.7 作用域：只写 BEM 类，不参与 `data-column-origin` 复用路径

- `map-workspace.css` 每条结构规则都写两遍：`.workspace-frame--map … :not([data-column-origin])` 与 `[data-column-origin="map"]`，以同时支持"自有列"和"被复用列"（`map-workspace.css:8-17, 19-27, 29-36, 38-45`）。
- `map-entry-workspace.css` **一次都没有出现** `data-column-origin`、`.workspace-column__body`、`.workspace-frame--map` 之类的通用选择器；只有 `.workspace-frame--map-entry` 一条 Frame 级覆写。
- 结果：map-entry 的三列样式**只在 map-entry 自己身上成立**，一旦这些列被别的 Workspace 复用（`ui-style/patterns.md` 描述的"跨宿主沿用来源主题与 `data-column-origin` 样式"路径），本页的结构 CSS 不会跟随。

### 5.8 按钮：复用全局类 + 跨文件借用，与一般游戏页视觉不同

- 主按钮用 `class="story-trigger map-entry-workspace__primary"`（`map-entry-workspace.ts:101, 104, 116`）。`.story-trigger` 来自 `story-nav.css:59-74`：**青色描边、透明底、11px 字号、`padding: 4px 10px`**；本页只补了 `min-width: 10rem`。
- 由于 map-entry 的 Frame id 是 `map-entry`，`legacyWorkspaceClass()` 返回空（`workspace-frame.ts:119-129`）→ 没有 `.workspace` 类；列的 `data-column-origin` 是 `map-entry`，不是 `game`/`character`。因此 `layout.css:75-141` 那套"三栏中性按钮"（白底、`#ebebeb` 描边、主题色 hover）**全部不命中** → map-entry 的按钮不会与其它游戏页保持同一套外观。
- "放弃当前地图"按钮用了 `mini-action map-workspace__hero-action--danger`（`map-entry-workspace.ts:109`）：`.mini-action` 来自 `cards.css:158-183`，而 **`--danger` 的描边与文字色定义在 `map-workspace.css:229-236`**。也就是说本页的"危险色"来自另一个 Workspace 的样式文件，跨文件耦合是隐式的（`map-entry-workspace.css` 自己没有 import 也没有定义 danger 变体）。
- 禁用态缺失：`.story-trigger` 全项目**没有 `:disabled` 规则**（只搜到 `story-nav.css:59-74` 的基础与 hover）→ 不可用的主按钮（"入口暂不可用"）与可用态几乎同形，只是不可点击；`.mini-action:disabled` 有 `opacity: .4`（`cards.css:180-183`），两种按钮的禁用表现还不一致。对照 `area-map.css:51` 明确写了 `.area-map-entry:disabled { border-color: var(--line); background: var(--panel); }`。

### 5.9 交互状态与动效

- 本页 CSS **没有任何** `:hover`、`:focus-visible`、`:disabled`、`prefers-reduced-motion` 规则；只补了一个 `.__management summary { cursor: pointer; }`（`:108-110`）。
- "地图管理"用原生 `<details>/<summary>`（`map-entry-workspace.ts:105-111`），折叠标记未定制（无 `summary::-webkit-details-marker` 处理），展开区用 `.__management > div { display: flex; flex-wrap: wrap; justify-content: flex-end; }`（`:112-118`）。项目其它页面的"管理"操作都是按钮组，没有第二处用原生 disclosure。

### 5.10 token 与排版尺度

- map-entry 的 `var()` **一律无兜底值**（`var(--panel-content-padding)`、`var(--panel-region-gap)`、`var(--panel-radius)`、`var(--panel-light)`、`var(--line)`、`var(--ink-on-panel)`、`var(--muted-on-panel)`）；`map-workspace.css` 则大量使用 `var(--x, fallback)`（如 `map-workspace.css:5, 66, 101, 110`）。map-entry 依赖 `variables.css:11-47` 的兜底层始终存在。
- 排版尺度与项目主流不同：map-entry 用 `h1` 默认字号、`h2` 0.95rem、头像 2.75rem、区块间距 `var(--panel-region-gap)`；map/其它游戏面板走 8–12px 的紧凑字号 + DM Mono（`map-workspace.css:73-88, 208-218`）。因此本页在视觉上更接近"通用仪表盘"，而不是游戏内密集面板。

### 5.11 冗余类名

- `map-entry-workspace.ts:152` 声明的 `className: 'map-entry-workspace__left'` 在 CSS 中**没有任何对应规则**（左栏完全由共享 rail 样式负责）。这一模式在项目里并非独有（`area-map-workspace.ts:91-92` 的 `area-map-center` / `area-map-inspector` 同样无规则），但说明列根 className 不是强契约。

---

## 6. 风险清单

| 级别 | 问题 | 证据 |
| --- | --- | --- |
| 中 | "放弃当前地图"的危险色依赖 `map-workspace.css`；若将来 map 工作区 CSS 被拆分/改名，本页会静默丢样式 | `map-entry-workspace.ts:109` + `map-workspace.css:229-236` |
| 中 | 不可用主按钮与可用态几乎同形，且 `:hover` 仍会触发青色填充 | `story-nav.css:59-74` 无 `:disabled` |
| 中 | 无窄屏 media query；`.__resources` 的 `max-height: 42%` 在通用窄屏降级（640px 转纵向）下语义改变 | `map-entry-workspace.css:160-166` vs `layout.css:659+` |
| 低 | 滚动条出现时内容宽度跳变（无 `scrollbar-gutter: stable`） | `map-entry-workspace.css:33-43, 120-123` |
| 低 | 结构 CSS 不含 `data-column-origin` 分支，列被复用时样式不跟随 | `map-entry-workspace.css` 全文 |
| 低 | 样式契约测试只加载 `layout.css` + `map-entry-workspace.css`，未覆盖跨文件依赖与面板表面 | `tests/ui/map-shell-layout.test.ts:18-19` |

---

## 7. 与项目既有约定的对齐情况

`ui-style/patterns.md:29` 已记录本页的定位：外壳承接 Shell 剩余高度与顶部间距、Frame 保留通用三栏宽度且不重复加间距、中右面板纵向 flex、长说明与队伍列表内部滚动——**这些都与现状一致**。`ui-style/patterns.md:23` 还记录了本页"复用 titlebar、panel surface、主题宿主与内容滚动区"。

需要注意的是：本页"复用 panel surface"的方式与 map 不同（主题宿主 vs 写死 token），"复用 titlebar"的方式也与其它 Workspace 不同（内联 content vs `header` 字段）。这两点在文档里没有被显式区分，属于**实现与描述之间的未声明差异**。

---

## 8. 一句话总结

`createMapEntryWorkspaceFrame` 系列的 CSS 是一份**独立于通用 Frame 骨架的自定义壳**：外壳接管高度与间距、列根承担纵向 flex、顶栏内联进正文、滚动全部下沉到 `content-region`、表面交给主题宿主、按钮复用全局类且跨文件借用 map 的 danger 变体；它与"一般结构 CSS"的差别集中在**作用域（无 `data-column-origin`）、表面来源（主题 vs token）、顶栏位置（内联 vs header 字段）、响应式（无 media query）**这四处。
