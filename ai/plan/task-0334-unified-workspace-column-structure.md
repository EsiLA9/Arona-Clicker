# Task 0334：统一 Workspace 与内容栏的结构和基础样式

状态：代码与自动化验收完成 — 全量调用方已按共享结构迁移；主 Agent 独立验收通过。用户暂不允许浏览器访问，实际视觉验收保留待办而不归档。

## 目标、依赖与范围

依据 [[ai/plan/report-map-entry-css-structure-2026-10-28]] 暴露的差异，统一 Workspace 的高度/间距归属、栏根伸展、标题/正文/固定操作区、滚动与面板表面。Map Entry、MapRun 及其他页面使用同一套结构基础，业务样式只保留内容排版与明确的差异。

与 [[ai/plan/task-0333-semantic-columns-and-workspace-composition]] 的分工：

| Task | 负责结果 | 衔接约束 |
| --- | --- | --- |
| 0333（当前施工中） | 内容栏提取、Workspace 组织、动作与实例级刷新、旧位置分发器收敛 | 本轮不修改其源码、进度或接口，不要求为 0334 中断现有施工 |
| 0334 | 在 0333 正式栏入口上统一 DOM/CSS 结构与基础交互样式，迁移页面并清理重复结构规则 | 施工前读取 0333 实际交付，复核类型、正式路径、刷新锚点与测试；不能按报告中的旧路径恢复旧实现 |

0334 可以提前完善结构清单；实际共享渲染器、正式栏工厂与 Controller 的迁移须在 0333 对应交付稳定后开始。0333 未完成项由其原 Task 记录，0334 不重复接管或宣称已解决。

实施范围是所有游戏内 `renderWorkspaceFrame()` 调用方及直接影响的完整栏：Game、Area、Area Map、Map Entry、MapRun、Contacts、Character、Story、Inventory、Shop、Settings、Service 与 Operation。按共享结构迁移；复杂页面保留业务协调器与内容差异，不能只修 MapEntry 而留下同类高度链和表面覆盖问题。

明确边界：

- 沿用现有主题、字体、控件与桌面宽屏设计，不统一所有业务字号、内容密度、栏数或列宽比例；宽度仍由 Workspace 有序装配决定。
- 不新增移动端/竖屏需求。报告提到的 media query 数量差异不直接转为开发清单；保留现有兼容，不顺手移除已有行为。
- 不重写 MapRun / Operation / Story Runtime、导航历史或领域状态；不修改存档、主题 Schema、生成产物。
- Runtime Editor 内容工具的纯布局入口继续隔离游戏主题与 Shell；明确的工具/浮层布局保留其范围例外。
- 不增加第二套 Column runtime、更新调度器、主题体系或为每页建立一份新的基础结构 CSS。

## 报告核对与问题判断

报告是调查输入，行号和调用关系会被 0333 改动。以下是本轮对当前文件的核对，不表示最终施工基线已冻结。

| 报告问题 | 本轮核对 | 0334 处理方向 |
| --- | --- | --- |
| MapEntry 与共享 Frame 完全解耦 | 说法过强。它实际使用共享 Frame、主题宿主、通用宽度和滚动元数据，只是部分结构规则由页面重复承担 | 收敛结构职责，不推倒已有共享能力 |
| 外壳和 Frame 分别管理高度/间距 | 当前直接 Frame 有 margin-top / height / flex；MapEntry 增加纵向 flex 外壳并清除 Frame 间距，MapRun 的普通块外壳又依赖内层 height:100% | 提供一个共享页面内容区与嵌入 Frame 的明确契约，避免重复或缺失间距和互相补丁式高度链 |
| 标题有 header 与内联 content 两种位置 | 确实存在。Map 的部分栏用 `WorkspaceColumnSpec.header`；MapEntry、Contacts / Story 的部分栏和现有内容工厂仍将 heading 拼入 content。报告将 Contacts / Story 全部视为 header 调用不准确 | 统一真正的栏头部入口；正文内部的小标题继续由业务内容拥有 |
| 不写 data-column-origin 就无法跨宿主复用 | 不能如此断言。MapEntry 的栏 className/BEM 类会随栏定义一起渲染；问题在于规则是否依赖外层 Workspace、作用点和依赖是否完整 | 用跨宿主实际渲染验证；优先共享结构类与随栏携带的内容类，仅在需要兼容来源主题时保留 origin 规则 |
| Map 表面使用普通 panel token，MapEntry 走主题宿主 | 当前 Map 的高特异性选择器确有 background / border / radius 覆盖，共享规则则消费 theme host 变量；但普通 token 本身也可能随运行时主题变化，不能仅凭文本判断所有主题都失效 | 统一 Presentation 的表面与几何优先级，使用不同颜色、圆角、背景图层的真实主题验证覆盖结果 |
| 放弃按钮借用另一个 Workspace 的 danger 类 | MapEntry 仍引用 `map-workspace__hero-action--danger`，本页 CSS 不拥有该定义 | 抽到已有公共动作样式的语义危险变体，消除兄弟 Workspace 样式加载依赖 |
| 主按钮缺乏明确禁用视觉且 hover 仍命中 | `.story-trigger` 基础/hover 规则与本页主按钮组合存在此风险；其他控件已有部分全局状态 | 公共按钮入口承担 enabled / disabled / hover 等状态，禁用不能保留可用态反馈；不用每页各写一套 |
| 滚动区和百分比资源区约束不一致 | MapEntry 队伍与说明内滚动，资源区另有 max-height:42%；Map 则有 scrollbar-gutter 与其他内容流 | 明确主/辅助滚动区、稳定高度和滚动身份；保留合理的资源区上限，用极端内容验证主区与动作仍可达 |
| CSS 无本地 focus、reduced-motion、兜底值、专用响应式 | 缺少本地规则不等于缺少最终行为；没有动画也无需新增动效降级；全局 variables 已提供基础 token | 核对实际继承与支持范围，只补真实缺口；不为了形式统一复制规则、添加默认值或新建 token 系统 |
| 当前样式测试未覆盖真实表面和跨文件依赖 | `map-shell-layout.test.ts` 主要验证部分计算样式与不可用入口，不能证明浏览器几何和全部状态正确 | 保留必要契约并扩展可观察行为，增加真实样式依赖与桌面几何验收 |

已核对入口：`src/ui/components/shared/workspace-frame.ts`、`src/ui/css/layout.css`、`map-entry-workspace.css`、`map-workspace.css`、`story-nav.css`、`cards.css`、`src/ui/components/map/map-entry-workspace.ts`、`src/ui/components/character/contacts-workspace.ts`、`src/ui/columns/content-columns.ts`、`tests/ui/map-shell-layout.test.ts`。0333 已在建立 `src/ui/columns/`，最终文件位置以其交付为准。

## 统一的结构职责

### 1. Shell、页面内容区与 Frame

- Shell 负责视口边界、全局 topbar 和 footer。topbar 不参与纵向压缩，底部分隔保持；不是由页面内容凑出 Shell 高度。
- 共享页面内容区负责占用剩余高度、与 topbar 的间距以及 min-width/min-height 收缩约束。有业务身份 wrapper 的页面可复用该节点，没有 wrapper 的页面由共享入口提供同等约束；不要求为了统一强加一层无用途 div。
- Frame 只负责有序网格、gap、单栏 track 和超宽处理。作为页面内容时由共享装配适配；作为嵌入内容时不自动增加页面间距或视口高度。
- 消除每个页面反复写 `margin-top:16px`、清除 Frame margin 和修补 height:100% 的做法；最终同一层间距只有一个 owner。保持当前默认数值，允许有依据的显式页面配置。
- 工具纯布局继续使用 `renderWorkspaceLayout()`，其主题隔离和自有尺寸契约不被游戏页面默认值污染。

### 2. 栏根、头部、正文与固定区

目标责任结构如下；最终节点标签、字段名和最小迁移方案在施工初期确定并记录，不视为已有实现：

```text
Column root [data-column-instance]，唯一 surface/geometry owner
  Presentation 背景层 + content（保留既有直接层级契约）
    Column slot（纵向、可收缩并撑满宽度）
      Header（可选，不参与正文滚动）
      Body（占剩余空间；滚动模式显式）
        业务内容、具名主/辅助滚动区、内容浮层
      固定操作区（可选，不被正文挤出）
```

- 优先使用已有 `WorkspaceColumnSpec.header` 承载栏标题/Tabs，统一渲染位置与 CSS。无栏标题时不增加空 header；正文 h1/h2、卡片标题与业务工具栏不机械移入栏头。
- Header 与正文滚动边界分开。共享渲染器应提供正确的纵向 flex / min-size / stretch，不再由 MapEntry 的 center/right 类或目的 Workspace 补齐基本撑宽与撑高。
- 当前 header 生成于 `.workspace-column__body` 内；若正文滚动导致标题一起滚动，需要在共享渲染器中调整边界，并同步所有依赖选择器和更新器，不只把字符串挪到 header 字段。
- 固定操作区优先复用现有结构；如需新增可选 footer 字段，只表达确定的内容插槽。现有 `actions` 是事件字典，不能被新布局字段占用或混淆。
- 不增加双层 Panel。`surface:'panel'` 与 `surface:'none'` 的真实表面 owner 必须明确；0333 遗留的内层业务 Panel 如需兼容，记录适配与移除范围。
- 保持已有 Presentation 背景/content 的直接子层契约，背景装饰不重复、几何作用到真实表面。

### 3. 滚动和操作区

- 主滚动区明确唯一 owner；允许队伍与局内资源等不同信息区分别滚动，不能为了“唯一滚动”强行合并业务区，也不能让祖先和其内部主区重复滚动。
- 说明、队伍、资源、日志、聊天等主/辅助滚动区具有可区分的稳定身份；同栏多滚动区都能捕获与恢复，不能只恢复遇到的第一个节点。
- 带资源区上限的布局必须有确定可用高度。验证大量资源、空队伍、长说明、地图管理展开等组合；固定按钮始终可达，队伍区不被压成不可用高度。
- 普通列表可采用共享 scrollbar-gutter 策略以减少宽度跳变；Canvas、聊天贴底和专门流的滚动策略继续由其业务适配声明，不一律添加 gutter。
- 保留聊天/Map feed 的阅读位置与贴底语义，普通区域刷新不改变其他栏的滚动和焦点。

### 4. 表面、控件和内容样式

- Panel 的底色、边线、文字、圆角、背景图层和装饰优先级统一由现有 Presentation 入口与共享样式承担。页面不再用更高特异性把宿主配置无声盖回普通 panel token。
- 来源主题随内容栏保留，宿主覆盖必须显式。旧 hostId / scope 继续兼容；不因结构统一重命名全部主题标识。
- 主操作、次要动作、危险动作、返回按钮复用已有公共控件入口，补齐真实缺失的禁用/hover 状态。公共返回样式可以保留旧 conversation-back 别名，但不再要求业务依赖聊天 CSS 的命名含义。
- MapEntry 放弃动作仅加载公共基础样式与自身内容样式时仍有正确危险状态，不能隐式依赖 MapRun CSS。
- MapEntry 继续可使用原生 details/summary；是否原生 disclosure 不作为结构缺陷，要求展开后布局、操作可达与刷新状态正确。
- 业务 CSS 只保留内容排版、卡片/头像等展示、业务工具栏与明确上限；共同的 flex、表面、header 复位与基础滚动约束收敛到公共层。共享内容类随栏可复用，不强制给所有选择器追加 origin 分支。
- 保留上栏统一最小内容高度、长标题自动增高和返回键不挤压的规则；不把紧凑 Map 字号强加到所有工作区。

## 实施顺序与施工衔接

1. **以 0333 交付重新盘点。** 为全部 Frame 调用方建立结构清单：页面内容区 owner、表面、标题、正文、固定区、滚动区、专用更新器、跨样式依赖。标明当前已统一、待迁移和确需例外，不按旧报告行号施工。
2. **确定最小共享契约。** 在现有 Frame/栏类型和 CSS 中落实上述边界，记录 DOM 前后草图、增加/移除的 wrapper、稳定锚点及各例外；不新增庞大的布局模式枚举。
3. **迁移 MapEntry 与 MapRun。** 两者同时验证高度、间距、头部与表面；MapEntry 覆盖 fresh / resume / blocked / unavailable，保留导航、准入和 Map 命令。
4. **迁移其余 Workspace 与正式栏。** Game / Area / Area Map / Contacts / Character / Story / Inventory / Shop / Settings / Service / Operation 逐项落清单，删除重复结构覆写。复杂流程不重写 Run 协调，只适配其 DOM 和样式边界。
5. **回归并收敛文档。** 完成行为与视觉验收，更新共享结构机制和 `ui-style/`；把报告中的局限、旧实现与最终解决结果区分记录，完成集中地图只读复核。

0334 改结构时继续使用 0333 实例身份与现有 behavior / element / region / structure 调度。换序、仅改宽度不重建实例；普通更新限定到实际消费者。Map / MapEntry / AreaMap / Operation / Shop 的 keyed 更新需要同步新边界，保留或显式映射 `data-map-region-key` 等稳定锚点，不能因选择器失效退回每次全 App render。

## 验收标准

| 场景 | 必须可观察的结果 |
| --- | --- |
| 页面高度与间距 | 直接 Frame 和带业务 wrapper 的页面都占同一 Shell 剩余区；topbar 高度和分隔线保持，顶部间距无重复、无丢失；内容增长不把整个页面撑长 |
| 标题/正文/操作区 | 一套可解释的公共边界；有标题的栏在正文滚动时保留头部，固定动作始终可达；空标题不产生空白占位；长标题自然增高 |
| 任意装配 | 代表性栏在 1/2/4 栏、换序、跨 Workspace、普通定尺寸容器内均能撑满宽高；不依赖原页面祖先完成基本 flex，宽度仍由装配决定 |
| 独立样式依赖 | MapEntry 不加载 MapRun CSS 仍完整呈现危险动作、禁用主按钮和返回控件；不存在为绕过问题把所有 Workspace CSS 强制打包的做法 |
| 主题与表面 | 默认及不同背景/边线/圆角/装饰配置均作用到真实栏；单份表面，没有双框或覆盖背景；来源主题与显式宿主覆盖均可验证 |
| 极端内容 | 长中英文说明/标题、空或大量队伍、长资源列表、details 展开、操作不可用均不挤出按钮；各主/辅助滚动区可操作且刷新后位置独立恢复 |
| 行为连续性 | 只更新一张卡/列表项时兄弟栏、输入、焦点、scroll、范围外浮层保持；范围内浮层按既有生命周期处理；一次动作执行一次 |
| Map 系列 | 准备/续行/门控/不可用、进入战斗及结果页、返回恢复均通过；专用 keyed 更新不会因结构改变失效或普遍升级刷新范围 |
| 全量结构覆盖 | 清单内每个游戏 Frame 调用方都已迁移或有明确、经过验证的范围例外；不能只列“后续再统一”而宣布完成 |
| 工具隔离 | Runtime Editor 纯布局无新增游戏主题宿主、页面 margin 或固定视口高度 |
| CSS 收敛 | 删除失效和重复结构规则；保留的页面覆写有实际内容/展示理由；没有复制另一套共享骨架或无限提高特异性 |

桌面视觉至少覆盖 1366×768 与 1920×1080，并检查缩短可用高度、默认/自定义主题、出现/消失滚动条和长内容。DOM/CSS 计算样式测试不能替代实际几何与截图验收。已有浏览器访问限制继续有效，取得有效授权后再验收，不绕过限制，也不将视觉未验收写成完成。

## 相关文件与测试

路径是调查与迁移入口，不是修改白名单；0333 重命名后的路径在施工前更新。

| 路径 / 范围 | 用途 / 本轮状态 |
| --- | --- |
| `ai/plan/report-map-entry-css-structure-2026-10-28.md`、`ai/plan/task-0333-semantic-columns-and-workspace-composition.md` | 已读；保留报告与当前施工记录，本轮不修改 |
| `src/ui/components/shared/workspace-frame.ts`、`workspace-titlebar.ts`、`tabs.ts`、`src/ui/workspace/workspace-renderer.ts` | 已初核共享渲染与标题入口；待确定统一边界 |
| `src/ui/columns/`、`src/ui/components/*/*workspace.ts`、`src/ui/components/shared/service-workspace.ts` | 0333 新栏及全部游戏 Frame 调用方；施工后重新盘点并逐项迁移 |
| `src/ui/css/layout.css`、`chat.css`、`conversation.css`、`background.css`、`cards.css`、`story-nav.css` | 公共结构、表面、头部与控件；集中共享职责 |
| `src/ui/css/map-entry-workspace.css`、`map-workspace.css`、`area-map.css`、`operation-workspace.css` | 已部分初核；删除结构重复和兄弟页面样式依赖，保留业务内容规则 |
| `src/ui/presentation/presentation-service.ts`、`src/ui/runtime/ui-host-registry.ts` | 表现层级与旧主题兼容，按实际影响复核，不默认改 Schema |
| `src/ui/controller/controller.ts`、`src/ui/workspace/` 的专用 DOM 更新器、`src/ui/interaction/scroll.ts` | 同步结构锚点、所有滚动 owner 和范围生命周期；不接管 0333 的状态迁移 |
| `tests/ui/workspace-frame.test.ts`、`workspace-columns.test.ts`、`content-columns.test.ts`、`map-shell-layout.test.ts` | 共享结构/装配/实例及页面高度回归；更新旧实现细节断言为有效结构职责断言 |
| `tests/ui/presentation-service.test.ts`、`context.test.ts`、`theme-tree.test.ts`、`presentation-text-color-css.test.ts` | 表面与子宿主继承、真实样式加载及隔离；基线按 0333 结果重核 |
| `tests/ui/gameplay-b-basic-map-p0-p3.test.ts`、`map-dom-updates.test.ts`、`area-map-controller.test.ts`、`operation-workspace.test.ts`、`shop-modal.test.ts` | 复杂页面行为和 keyed 更新范围 |
| `tests/ui/scroll.test.ts`、`popovers.test.ts`、`workspace-lifecycle.test.ts`、`ui-update-dispatcher.test.ts` | 多滚动区、交互连续性、返回与实例失效 |
| `docs/docs-830/04-presentation/`、`ui-style/foundations.md`、`ui-style/patterns.md` | 施工后维护共享结构事实与合理例外；本轮不把提案升级为已实现约定 |

施工优先补关键复现与回归；测试统一经 `npm test`，日志 `.test-artifacts/latest.log`。完成定向 UI、类型、架构、文档检查及输出至 `.test-artifacts/` 的构建后，按上表做浏览器验收；不靠只搜索 CSS 字符串证明几何正确。

## 当前进度与验证记录

- [x] 读取报告、核对主要源码并识别报告中需要修正的推断。
- [x] 明确与施工中 0333 的职责和先后关系，记录统一方案及验收矩阵。
- [x] 0333 交付后复核正式入口与完整结构清单。
- [x] 实现共享结构、迁移页面并清理重复样式。
- [x] 完成最终自动化整合验收，记录真实结果。
- [ ] 实际桌面视觉验收：用户暂不允许浏览器，保留待办。

本轮只新增 0334 和活动索引条目，不改报告、0333、产品源码、测试或现行机制/风格结论。

以上为立项轮次的历史记录。2026-10-28 用户随后授权主 Agent 负责指令发布和验收，并可分派 Luna 施工；下面记录本次实际交付，不能把立项轮次的未施工状态作为当前结论。

| 本轮检查 | 实际结果 |
| --- | --- |
| `npm run check:docs` | 未通过：检查时扫描 103 份 Markdown，4 处旧源码路径失效，均位于施工中的 0333 或 ui-style/patterns；0334 与本轮索引条目无错误报告 |
| 失败范围 | 0333 三处旧组件路径引用（right-panels 两处、center-panel 一处），ui-style/patterns 一处 right-panels 引用；与当前组件迁移直接相关，留给 0333 施工收敛，不恢复已删除文件、不修改其进行中的记录 |
| 直接改动的 diff / 行尾空白 | 通过，另用文件内容检查覆盖未跟踪的新增 Task |
| 地图只读复核 | 两份计划路径均为 unreferenced_path，无直接 Evidence / maps_to；未改图、刷新或写 freshness |
| 产品测试 / 构建 / 浏览器 | 未执行，本轮仅调查和编写计划；不将已有布局修复或测试结果作为 0334 已实现的证据 |

## 2026-10-28 施工与整合验收

主 Agent 负责设计裁定、独立源码审查、测试协调及最终收敛；三位 Luna 分别负责 0333 行为与滚动、0334 公共结构及普通页面、Map 系列与 Operation 的结构适配。用户明确暂不允许浏览器，先完成代码和自动化验证；未访问浏览器，也不将计算样式当成桌面几何证据。

共享结构保持 `Column > Presentation background + content > slot > header? + body + footer?`。只增加 Shell 内有明确尺寸职责的 `.workspace-page-content`，保留原水平留白；没有另建 Column runtime、主题体系或调度器。`footer?: string` 表达固定内容，`actions` 仍是回调字典；各类真实栏标题已迁出正文滚动边界。

| 全量调用方 | 本次实际适配 |
| --- | --- |
| Game | 语义工厂输出独立 header，装配保留默认展示组、宽度及资源条选择 |
| Area | 概览、详情标题移入 header，区域列表保留独立滚动 |
| Area Map | 标题、画布正文与右侧固定动作分离；恢复器按新 slot/footer 补缺，保留 SVG 与详情区 |
| Map Entry | 准备/队伍标题进 header，主操作进 footer；说明、队伍、资源有独立滚动身份；移除 wrapper 顶部间距及兄弟危险样式依赖 |
| MapRun | 保留 header、feed、action dock 的稳定键；删除重复高度/表面覆写，使用公共危险变体 |
| Contacts / Character | 工厂标题和空会话标题均进入 header；显式 owner、详情与聊天正文继续由各自业务拥有 |
| Story | 导航、正文、详情标题全部进入 header；归档列表和剧情正文保留原交互 |
| Inventory | 筛选、物品库、详情 Tabs 进入 header；保留搜索/排序及业务列表滚动 |
| Shop | 三栏标题独立，结算操作进 footer；专用 region 更新后重新登记栏根并恢复滚动 |
| Settings | 三栏标题独立；设置卡片保留正文 |
| Service saves / records | 导航、主标题与检查器标题进入 header；正文内容和命令保持 |
| Service datapack | 两栏组合保留，顶层标题进入 header；包目录内部小节标题仍属于正文，不当成漏迁 |
| Operation | 保留业务 header、日志、提交 dock 和 keyed 更新；移除重复表面/高度及旧标题负 margin 补偿 |
| Runtime Editor Codex | 继续使用纯布局 renderWorkspaceLayout；无新增游戏主题宿主或页面间距 |

滚动快照共用 `interaction/workspace-scroll.ts`：按实例和具名区域恢复多个主/辅助区，忽略嵌套子栏的滚动所有权，聊天另走 FlowScroll。匿名同类多区无法靠位置保证稳定，动态分区应提供显式 `data-scroll-key`。Map / Operation 的 Run 协调器与 Map 的 action dock 保留业务职责，属于经过审查的适配，不是后续待迁移的遗漏。

首轮整合覆盖全部 UI 与原 0333 五个复现，共 102 文件、914 项：908 通过、6 失败。失败分别为一项旧滚动替身兼容、两项 Map 测试合同/选择器，以及三项新增结构测试的夹具断言；完整输出 `.test-artifacts/task-0333-0334-acceptance-first.log`。同轮独立审查还发现全局 footer 样式污染与公共顶部样式仍依赖 Chat CSS，继续修复后再作最终验收，不以这轮结果宣告完成。

### 最终交付与验证

公共顶部、Tabs、返回/标题与兼容 story-trigger 的按钮样式已迁到 `src/ui/css/workspace-controls.css`，由 `main.ts` 加载；Chat / Conversation / Story 样式只保留其内容差异。危险动作使用公共变体，默认 hover 排除禁用态；Shell 页脚样式限定到 `.console-shell > footer`，不会污染栏的固定操作区。各页面重复的正文高度/overflow 补丁已删除，保留 Service 内容 padding/gap、Inventory 既有响应式尺寸及 Map 专用内容布局的必要差异。

整合审查追加修复了外部栏公开刷新、App 重建后外部实例保留、同流聊天局部更新的阅读位置，以及旧滚动入口兼容；正式测试覆盖这些行为，默认主题宿主和 Presentation 直接层级不变。定尺寸容器中的 1/2/4 栏、换序、改宽、动作与 token 生命周期均有自动化回归。MapRun action dock、Operation 协调器、Datapack 正文内部目录标题和纯布局 Codex 是明确保留的职责边界，无未迁移页面被简单标为“以后再做”。

| 最终验收 | 结果 |
| --- | --- |
| 完整 UI + 原 0333 审查复现 | 102 文件、918 项全部通过；76.97 秒；无 Map 套件排除 |
| 验收命令 | `npm test -- --config .test-artifacts/task-0333-0334-acceptance.config.mts --maxWorkers=3 --minWorkers=1 --silent --reporter=dot` |
| 完整输出 | `.test-artifacts/task-0333-0334-acceptance-final.log`；统一 runner 同时写 `.test-artifacts/latest.log` |
| 共享结构/CSS 定向 | 4 文件、35 项通过，日志 `.test-artifacts/task-0334-shared-css-verification.log`；后续已纳入完整 UI 运行 |
| 类型 / 架构 | `npx tsc --noEmit`、`npm run check:architecture` 通过 |
| 文档与空白 | `npm run check:docs` 通过，104 份 Markdown、0 错误；直接差异的 git diff --check 与 18 份内容文件的额外行尾空白检查通过 |
| 生产构建 | 输出 `.test-artifacts/task-0333-0334-build`，通过；保留现有大 chunk 提示，未修改禁改产物目录 |
| 地图只读复核 | 52 个直接路径及旧分发器；26 content_changed、26 unreferenced_path，旧两个路径 missing，36 条旧 Evidence 待维护；已完成所需分页，未写图/刷新/freshness |
| 机制与风格 | 更新 `workspace-columns-and-layout.md`、ui-style/patterns 与 foundations；任务记录保留历史失败和本次修复的区别 |
| 桌面视觉与主题几何 | 未执行，用户明确暂缓；不能由 DOM/计算样式代替 |

本阶段验收结论：**0334 的代码、结构覆盖和自动化行为验收通过；实际桌面视觉验收仍待用户授权。** 未关闭此待办，因此两项 Task 保留在活动索引中，不归档为全部验收完成。
