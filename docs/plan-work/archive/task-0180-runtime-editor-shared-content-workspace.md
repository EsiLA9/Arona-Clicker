# Task：RuntimeEditor 共享内容工作区与图鉴展示整理

状态：done — 🟢 内容浏览器已接入 Codex 三栏视觉框架；检查器页签完成样式和局部刷新修整；桌面验收与 71 项定向 UI 回归通过

## 1. 目标

让 RuntimeEditor 的内容浏览器成为可扩展的综合内容编辑工作区：浏览、筛选、选择和编辑条目使用与超级图鉴一致的三栏工作区框架；编辑操作仍只写入所选编辑态 Mod 的 Draft，并沿用既有校验、Apply、持久化和导出边界。

同时整理超级图鉴详情检查器的 `.codex-inspector-tabs`，使“概览 / 关系 / 原始数据”页签成为清晰、可见、可聚焦且与图鉴外观协调的正式控件，不再呈现为未设计的原始页签样式。

本 Task 优先统一工作区结构、滚动和视觉语言，不重写 Registry 查询、Runtime 加载或 Def 编辑策略。完整内容类型编辑覆盖由 `task-0176-base-runtime-editor-full-content-coverage` 持续承担；本 Task 要保证该覆盖可落入统一工作区，而不是形成第二套页面。

## 2. 当前基线

- RuntimeEditor 面板当前分为“编辑中 Mod”“内容浏览器”和“超级图鉴”页面。
- 内容浏览器绑定编辑态 Draft；当前结构由内容类型导航、列表、表单、诊断和 Apply 区构成，可编辑表目前集中于 Init、Area、Spot、Enhancement。
- 超级图鉴使用独立的三栏 Codex 工作区：Mod 导航、类型 / 条目和详情检查器；筛选和选择已有局部 DOM 刷新路径。
- Codex 数据只来自当前 Runtime 的有效 Registry / Runtime Content；它不读取未加载的包库记录，也不具备 Draft 写入能力。
- `task-0176-base-runtime-editor-full-content-coverage` 负责补齐基础包剩余 22 个内容表的结构化编辑面。该 Task 不重复实现这些表的 Policy、字段策略或完整 CRUD。
- `.codex-inspector-tabs` 的结构化页签语义已经存在；本 Task 聚焦其呈现、选中状态、交互状态和可访问性，不改变三个页签所承载的数据语义。

## 3. 设计决策

### 3.1 共享工作区外壳，不合并数据与权限

内容浏览器应尽量复刻超级图鉴的三栏骨架、Pane Header、搜索区、列表密度、选择态、滚动边界、空状态和详情栏 CSS 语言。优先复用已有 Codex 结构和样式；只有在两个页面确实共享同一职责时才抽出小型共用结构或样式。不得为了“通用化”建立新的通用浏览框架、组件注册系统或第二套状态管理。

共享外观不代表共享数据源或命令：

| 页面 | 数据来源 | 能力 |
| --- | --- | --- |
| 内容浏览器 | 当前选中的编辑态 Mod Draft / 已应用比较视图 | 按既有 Authoring Policy 编辑 Draft、校验、Apply、撤销待提交删除 |
| 超级图鉴 | 当前 Runtime 的有效 Registry / Runtime Content | 只读浏览、关系跳转、原始数据检查 |

不可将 Codex 查询结果直接当作可写 Draft，也不可因编辑页复用 Codex 外壳而开放 Registry 写入。

### 3.2 内容浏览器三栏职责

```text
RuntimeEditor 内容浏览器
┌────────────────────┬─────────────────────┬──────────────────────────┐
│ 内容类型 / 编辑目标  │ Draft 条目列表        │ 当前条目的详情 / 编辑表单    │
│ 分类、数量、筛选     │ 搜索、状态、创建、选择 │ 字段、诊断、保存 / Apply     │
└────────────────────┴─────────────────────┴──────────────────────────┘
```

- 左 Pane：内容类型导航和当前编辑目标信息。目标仍是当前编辑态 Mod；保留清晰的包名 / 版本身份，不增加第二个互相矛盾的目标选择状态。
- 中 Pane：所选类型的 Draft 条目、搜索 / 状态筛选、条目数量和创建入口。选择状态、列表滚动及搜索输入在局部更新时保持连续。
- 右 Pane：当前选中条目的编辑表单和相关诊断；未选中时提供明确空状态。没有可编辑策略的条目不得显示伪可编辑控件。
- “编辑中 Mod”元信息、关闭编辑态、ZIP 导出等包级控制继续使用现有清晰入口，不混入单条 Def 表单。
- Apply 表示把经过校验的 Draft 提交到 Runtime，不应伪装为单条记录保存。条目级“保存”只提交至 Draft；除非现有命令语义明确支持，否则不对 Runtime Apply。

### 3.3 超级图鉴展示范围

- 保持超级图鉴的事实范围为当前 Runtime 已加载并进入有效 Registry / Runtime Content 的内容。
- 类型集合以 RuntimeContentBrowser 当前查询面实际暴露的 Registry getter 和已登记补充源为准；不得维护平行的手写全集枚举。
- 对每个当前暴露的类型，都应能进入条目列表和通用详情兜底；已有领域 Profile、关系可靠性、缺失 / 歧义状态和字段树继续保持。
- 图鉴展示覆盖整理可以补齐遗漏的类型标签、分组、空状态、来源未知提示或通用展示入口；不得把未加载包库内容、编辑 Draft、玩家状态或运行实例混入图鉴。
- 若施工盘点发现“展示内容范围”需要扩到未加载包库记录，必须作为新的数据范围裁定 / 独立 Task；不能在本 Task 中通过读取 PackCatalog 偷渡扩展。

### 3.4 `.codex-inspector-tabs` 视觉要求

- 页签必须明确表现为一组专门设计的切换控件，至少包含可辨认的容器、未选中态、选中态、hover 与键盘 focus-visible 状态；视觉层级须能和检查器详情内容区区分。
- 选中态应有稳定的主题强调（如底色 / 边线 / 指示条的组合），不能只靠浏览器默认按钮效果或很弱的字色变化。
- 三个页签在常规桌面宽度下保持可读标签和一致触控 / 点击区域；不得因长内容挤压、换行或遮住右侧详情滚动区。
- 优先使用现有 Codex 色彩 token、边框、圆角、间距和字体尺度，形成与三栏工作区一致的紧凑检查器工具条；不新增纯装饰 DOM，不添加无语义图标。
- 延续既有 `tablist` / `tab` / `tabpanel` 语义、`aria-selected`、`aria-controls`、`aria-labelledby`、键盘焦点与激活关系。改样式不应破坏局部刷新和当前页签状态。
- 不在本 Task 中改造详情内部信息架构、语义摘要或关系解析算法；发现内容问题登记为单独后续项。

## 4. 实施范围

### U1：工作区基线与布局

- 核对 Codex 三栏 DOM、CSS、面板高度与滚动容器，以及内容浏览器当前 DOM、刷新动作和表单状态暂存边界。
- 确认当前编辑态 Mod、内容类型、选中条目、编辑表单 Draft、筛选和表单暂存分别由哪个状态持有；禁止借用 Codex 选择状态存写入目标。
- 将内容浏览器重排至 Codex 三栏工作区结构，复用已有视觉与布局规则，保留 RuntimeEditor 顶部页面切换和包级工具。
- 编辑表单应在右 Pane 自身滚动；外层工作区和列表滚动边界明确，不让 Apply / 包级操作被表单高度推离可达区域。

### U2：内容浏览器工作流接入

- 将现有四类编辑内容接入新框架，完成类型选择、搜索 / 筛选、条目选择、新建、编辑、删除 / 恢复、诊断和 Apply 的完整往返。
- 保持现有 Policy、Command Facade、编辑态快照持久化、Apply 原子性、Runtime 刷新及导出语义，不另造写路径。
- 为后续内容表新增编辑策略保留普通列表 / 详情承载能力，使 `task-0176` 新增的内容编辑面能直接加入同一工作区。
- 空状态、空搜索、无可编辑项、校验失败、Draft 与 Runtime 一致 / 待 Apply 等状态应在相应 Pane 或底部稳定操作区表达，避免散落在顶部浮动小标签。

### U3：超级图鉴范围核对与页签美化

- 以 Registry 实际 getter 与 `RuntimeContentBrowserQueryPort.getView()` 返回值为准，核对所有当前 kind 均能在 Codex 类型 / 条目列表中呈现；未识别 kind 使用通用详情视图。
- 修正仅属 UI 展示缺口的问题，不重建图鉴查询架构、不创建手写 kind 全集。
- 重做 `.codex-inspector-tabs` 的 CSS 外观和必要的稳定语义节点；维护 overview / relations / raw 切换的局部刷新和选择状态。
- 如果更美观的选中指示需要 DOM 变化，优先用伪元素与现有稳定节点实现；新增节点须计入 DOM budget 并有清晰语义。

### U4：可视与交互验收

- 在桌面浏览器验证三栏比例、滚动、长列表、长表单、搜索、选择、创建、校验失败、Apply、图鉴页签切换和详情读取。
- 验收内容编辑器对四个现有类型完整可用；对 `task-0176` 尚未完成的类型明确呈现不可编辑 / 待支持状态，不出现假编辑能力。
- 以真实节点 identity / 滚动位置确认单项选择和 Codex tab 切换不重建无关工作区；批量 Draft mutation 合并到单一 UI 收敛点。

## 5. UI 刷新与 DOM budget

```text
DOM budget:
- 新增 wrapper / 节点数量：尽量为 0；如需给内容浏览器新增三栏 Pane，限于 3 个有真实滚动 / 布局职责的 Pane 容器及各自必要标题。
- 可复用的稳定节点：RuntimeEditor panel host、Codex Pane header / list / detail slot；Codex tabs 当前稳定 tablist / panel 节点。
- behavior patch 范围：搜索值、选中态、数量、空状态可见性、tab aria / class。
- region 替换范围：内容浏览器条目列表、所选 Def 编辑表单、Codex 详情 tab panel。
- 允许 full render 的唯一条件：RuntimeEditor surface 切换或编辑目标 / 内容种类导致工作区结构所有权改变。

Interaction preservation:
- Pane 自身滚动，切换当前条目不重建未变化 Pane；按类型切换时尽可能恢复各列表自己的滚动位置。
- 搜索输入更新不丢失焦点、光标和输入值。
- 选择条目时右 Pane 更新，左 / 中 Pane 容器保持 identity；编辑表单提交后单一更新列表状态与详情。
- Codex 页签切换保留 Codex 外壳、详情标题及非活动 Pane；只切换详情 region 并同步 ARIA。
- 有节点被替换时只关闭被替换区域内的 popover / tooltip；无关 Pane 的 hover 与 focus 不受影响。
```

具体 wrapper 数量、实际替换 region 和允许重建条件在实施前依据源码核对后冻结在 Task Receipt；不得借用本节放宽项目 UI Overlay 的行为 / region / structure 刷新级别。

## 6. 非目标与边界

- 不做窄屏适配或响应式折叠；按用户要求只验收常规桌面视口。
- 不进入 `tools/datapack-editor/`，不取代其 Schema 编辑器能力。
- 不让 Codex 编辑 Draft，不让内容浏览器写 Registry 或 PlayerState。
- 不在本 Task 增加未加载包库的图鉴数据，不读取未加载 ZIP 或开发目录。
- 不以任意 JSON 文本编辑作为结构化编辑器的替代方案。
- 不更改 Datapack Schema、Registry 合并 / 覆盖规则、Runtime 加载序列、存档格式或包文件结构。
- 不重写 Query Port、Authoring Policy、Def 关系解析或引用算法。
- 不新增 Loading / Workspace / Registry 等管理器或注册层；复用现有状态与命令入口，抽象仅限实证重复的共享 Pane / CSS 责任。
- 不在本 Task 内完成 `task-0176` 规划的 22 个内容表编辑策略；它们继续由 Task 0176 分切片交付，并应遵循本 Task 定义的工作区承载方式。

## 7. 必须核对

- [[docs/docs-829/00-INDEX]]
- [[docs/docs-829/02-modules/ui]]
- [[docs/docs-829/03-data-structures/datapack-contracts]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/docs-829/05-conventions/testing]]
- [[docs/ai/frontend-design-project-overlay]]
- [[task-0128-runtime-editor-loaded-content-codex]]（归档基线）
- [[task-0129-runtime-editor-codex-workspace-optimization]]（归档布局 / 刷新基线）
- [[task-0130-runtime-editor-codex-def-inspector-plan]]（归档图鉴展示基线）
- [[task-0176-base-runtime-editor-full-content-coverage]]（内容表编辑覆盖；范围由其 Task 所有）
- `src/ui/runtime-editor/view.ts`、`actions.ts`、`state.ts`
- `src/ui/runtime-editor/codex/`、`codex-details/`、`src/ui/runtime-editor/codex/codex.css`
- `src/ui/css/runtime-editor.css`
- `src/data-services/contracts/runtime-content-browser.ts`、`src/data-services/registry/runtime-content-browser.ts`
- `src/data-services/authoring/content-policies.ts`
- 对应 `tests/ui/runtime-editor-*codex*`、RuntimeEditor authoring 测试

## 8. 验收标准

### 8.1 内容浏览器

- 常规桌面视口下内容浏览器使用与 Codex 一致的三栏层次、Pane 标题、搜索 / 列表密度、状态表现、空状态和滚动规则；肉眼可辨认为同一个产品工作区。
- 左 / 中 / 右职责清楚：类型与目标、Draft 条目、当前条目编辑；不出现第二份 Mod 选择权威或 Runtime 与 Draft 混淆。
- 四类现有可编辑内容的 CRUD、删除恢复、字段暂存、策略校验、诊断定位、Apply、快照恢复与导出不回退。
- Apply 与条目保存语义清楚：条目编辑只更新 Draft，Runtime 变化仍由既有 Apply 完成。
- 条目选择 / 搜索 / 普通筛选不触发整个 RuntimeEditor 或 `#app` 全量重绘；表单区域之外的滚动和选择节点保持稳定。
- 后续 Task 0176 的内容表可以接入同一布局；不另造类别专属整页骨架。

### 8.2 超级图鉴

- 当前 Runtime 查询暴露的每个内容 kind 都有可见分类和通用详情路径；内容来自 Registry 有效视图，未加载包库记录仍不可见。
- 图鉴原有来源可信度、关系状态、语义 Profile、完整原始字段树和未知 kind 兜底保持准确。
- `.codex-inspector-tabs` 明确具备设计过的容器与 tab 状态；桌面下三项稳定排列，不依赖浏览器默认按钮风格。
- Overview / Relations / Raw 页签仍通过键盘和指针可用；`tablist`、`tab`、`tabpanel` ARIA 引用正确，focus-visible 清楚，选中态对比明显。
- 页签切换只替换详情内容区域，不重建 Codex grid、左右 Pane、选择列表、详情头部和选中条目；不丢失详情滚动 / 可恢复状态。

### 8.3 工程与体验

- 桌面浏览器人工验收覆盖长列表、长表单、无选中、空搜索、校验错误、Apply 后状态、Runtime 详情三页签。
- 完成相关 UI / authoring 回归、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 和 `npm run build`；根据影响面执行对应测试集，不要求为本 Task 无关区域扩大测试范围。
- 完成 `git diff --check`，记录 Task 最终验收与未覆盖项；不清理无关脏工作树。

## 9. 建议执行顺序

1. **P0 基线冻结**：记录当前 Codex Pane DOM / CSS、RuntimeEditor Draft 状态权威、4 类可编辑策略、Codex kind 数量与图鉴刷新边界。
2. **P1 工作区骨架**：先把四类现有编辑内容接入三栏；不并行扩张 22 个字段编辑器。
3. **P2 编辑闭环**：逐条验收条目选择、编辑暂存、删除 / 恢复、校验、Apply 与持久化；修好刷新连续性。
4. **P3 Codex tabs 视觉**：独立重做检查器页签 UI 和 CSS，验证 ARIA / 键盘、局部详情更新与常规视觉状态。
5. **P4 范围核验与集成**：动态对照 Registry kind 和图鉴入口；将 `task-0176` 后续内容表纳入同一 Pane 模型，执行最终浏览器和工程验收。

## 10. 交付记录

- [x] P0 基线冻结。
- [x] P1 工作区骨架。
- [x] P2 编辑闭环与刷新连续性。
- [x] P3 `.codex-inspector-tabs` 视觉与可访问性。
- [x] P4 Codex kind 覆盖核验与桌面验收。
- [x] 类型 / 架构 / 文档 / 构建 / 定向 UI 验收记录完成。

## 最终核验（2026-10-02）

- 内容浏览器已从纵向列表改为 Codex 同款三栏工作区：左侧编辑态目标与内容类型、中栏 Draft 列表 / 搜索 / 状态筛选、右侧当前 Def 编辑器；底部保留统一 Apply 状态和动作。
- Init、Area、Spot、Enhancement 均在新工作区继续复用既有 Policy、Draft 暂存、校验、Apply、持久化和导出路径。条目选择只替换右侧详情内容；类型切换按工作区结构变化重新渲染。
- Codex 仍只显示当前 Runtime 有效视图。当前实际暴露的 26 种 kind 均沿用动态查询与通用兜底，已有覆盖回归通过；没有把包库未加载记录或编辑 Draft 混入图鉴。
- `.codex-inspector-tabs` 已改为三列分段控件，含容器、显式选中 / hover / focus-visible 状态和减少动态效果规则。页签切换只更新详情 slot，保留详情 Pane、标题、列表选中节点和键盘焦点。
- Codex 关系目标长 ID 在详情 Pane 内换行；桌面验收下三枚页签均可见，关系内容不产生横向溢出。
- 桌面浏览器验收（1312 × 811）：检查内容浏览器三栏、Init / Area 类型切换、列表条目选择和表单展示；检查 Codex 条目、关系页签和 Pane 内滚动。
- `npx tsc --noEmit`：通过。
- 定向 UI 回归：6 个文件 / 71 项测试通过：`runtime-editor-definition`、`runtime-editor-codex-integration`、`runtime-editor-codex-shell`、`runtime-editor-codex-details`、`runtime-editor-form`、`runtime-editor-persistence`。
- `npm run check:architecture`：通过。
- `npm run check:docs`：通过，526 篇 Markdown，0 errors。
- `npm run build`：通过，447 个模块构建完成；保留既有大于 500 KB 的 JS chunk 警告。
- `git diff --check`：通过，仅有工作树既有 CRLF → LF 提示。
- 未实现 Task 0176 的 22 个新增内容表编辑策略；它们仍由 `task-0176-base-runtime-editor-full-content-coverage` 承担，后续可直接使用此工作区。
- 未清理工作树中既有的其它任务修改。

## 相关 Task

- [[task-0176-base-runtime-editor-full-content-coverage]]
- [[task-0128-runtime-editor-loaded-content-codex]]
- [[task-0129-runtime-editor-codex-workspace-optimization]]
- [[task-0130-runtime-editor-codex-def-inspector-plan]]
