# Task：RuntimeEditor 超级图鉴详情密度与关系导航

状态：closing — 🟢 实现、测试、架构、文档和构建验收已完成；浏览器截图验收受当前环境限制

## 目标

改进 `runtime-editor-codex__detail-body` 的信息层级和阅读密度，并让详情中的相关组分可以快捷进入超级图鉴中的另一个 Def，同时提供简单、可预测的返回 / 前进查看栈。

本任务只扩展 Runtime Editor 的只读浏览体验，不新增编辑、Apply、Registry 写入、PlayerState 写入或数据包加载能力。

## 设计边界

### 必须遵守的三条产品约束

1. **避免大规模 DOM 刷新**：交互必须明确刷新范围；详情跳转、页签切换、返回 / 前进不得重建整个超级图鉴工作区。
2. **保持内容克制**：不增加大段描述型文本、教程式组件、装饰性组件或新的统计服务。界面只展示已有 Runtime 查询快照、已有关系诊断和已有 Profile 摘要；不为了填充空间创建新的计数、指标或后台服务。
3. **避免巨大或占位过多的前端元素**：不引入全屏详情、巨大卡片、固定高度的大型图表、宽幅说明面板或常驻占位区域；详情区优先使用紧凑分组、可折叠内容和自然滚动。

### 数据与职责边界

- 数据来源继续是 `RuntimeContentBrowser` 的当前有效 Runtime 视图。
- UI 只能消费只读 ViewModel；相关组分跳转只改变 Codex 选择状态。
- 关系目标沿用现有 `resolved / missing / ambiguous` 与 `declared / inferred` 语义。
- 不新增独立的 Registry 查询入口；不把 UI 组件变成 Registry 或内容服务的代理。
- 不因视觉优化引入新的统计、埋点、聚合或持久化服务。

## 当前事实与代码落点

- 三栏外壳和局部替换已存在：`src/ui/runtime-editor/codex/view.ts`、`src/ui/runtime-editor/actions.ts`。
- 详情页签已存在：概览、关系、原始数据，渲染位于 `src/ui/runtime-editor/codex-details/render.ts`。
- 关系目标已经可以通过 `data-codex-reference-target` 点击跳转，但目前直接替换当前 Def，没有查看栈。
- 当前 `CodexShellState` 只有查询、筛选、当前条目、移动端栏位和筛选折叠状态，没有 back / forward 状态。
- 当前详情主体主要由 `.runtime-editor-codex__detail-body` 的滚动与内边距承载，语义摘要、关系列表和字段树的层级仍偏弱。
- 已有测试覆盖详情渲染、只读关系跳转、局部条目刷新、页签切换和复制 JSON：
  - `tests/ui/runtime-editor-codex-details.test.ts`
  - `tests/ui/runtime-editor-codex-integration.test.ts`
  - `tests/ui/runtime-editor-codex-shell.test.ts`
- 当前事实入口：[[docs/docs-828/00-INDEX]]、[[docs/docs-828/02-modules/runtime-editor]]、[[docs/docs-828/02-modules/registry]]、[[docs/docs-828/02-modules/ui]]。

## 施工切片

### P0：详情区密度与视觉层级

- 将详情头部、页签、主体内容、关系条目和原始字段树整理为紧凑的层级结构。
- 概览页只保留已有信息：身份、来源 / 状态、已有 Profile 摘要、已有语义摘要。
- 关系页按已有关系方向和诊断状态分组；不增加额外解释段落或统计卡片。
- 原始数据页继续支持字段树和复制 JSON；只改善路径、类型、值的可读性和长内容换行。
- 使用小型分组、边框、留白和折叠表达层级；不使用大幅装饰、插画、图表或新的视觉服务。
- 保持现有窄屏三栏切换，不把详情升级为全屏或固定大尺寸子页面。

### P1：相关组分快捷入口

- 在概览或关系内容的自然位置提供已有关系目标入口。
- 优先复用 `references` / `reverseReferences`，不另造一套关系发现算法。
- resolved 目标可点击进入对应 Def；missing 目标只显示诊断；ambiguous 目标显示已有候选目标。
- 入口显示关系名、类型和 ID；不额外生成长说明文案。
- 点击入口只更新当前条目、详情栏和列表选中态，不刷新 Mod 栏或整个外层工作区。

### P2：查看栈与返回 / 前进

- 为 Codex 增加有限长度的内存查看栈，默认只保存当前会话内的 Def 位置。
- 栈项至少保存：`entryKey`、Inspector 页签；是否保存移动端栏位由实现时验证决定。
- 从一个 Def 点击另一个 Def 时压入历史；同一 Def 重复点击不重复压栈。
- 返回恢复前一个 Def；前进恢复被返回的 Def。
- 新的关系跳转清空 forward 栈。
- 当前 Runtime 视图变化后，自动丢弃已不存在的历史项，不能渲染失效目标。
- 返回 / 前进按钮只在有对应历史时可用；不添加长说明提示或额外导航面板。

## DOM 刷新边界（硬性要求）

所有实现和测试必须遵守下表。若需要扩大刷新范围，必须在本 Task 中补充原因和验收项。

| 行为 | 允许刷新 | 不允许刷新 |
| --- | --- | --- |
| 选择 Mod | 条目栏；必要时详情栏；移动端栏位状态 | 外层 Runtime Editor、Mod 栏自身、Launcher |
| 选择类型 / 搜索 | 条目栏；无效选择时详情栏 | Mod 栏、外层工作区 |
| 选择条目 | 列表条目的选中态；详情栏 | Mod 栏、条目列表容器身份、外层工作区 |
| 点击相关组分 | 当前条目选中态；详情栏；必要时移动端栏位状态 | Mod 栏、条目列表容器、外层工作区 |
| 返回 / 前进 | 当前条目选中态；详情栏；导航按钮状态 | Mod 栏、条目列表容器、外层工作区 |
| 切换详情页签 | 详情栏内部页签与内容面板 | Mod 栏、条目栏、外层工作区 |
| 复制 JSON | Toast 或复制按钮的短暂状态 | 任意 Codex pane |
| Runtime 视图整体变化 | 允许按现有整体重建路径重新生成 Codex | 不得借导航功能额外扩大刷新范围 |

实现上应继续使用现有的 `renderRuntimeEditorCodexParts`、`replaceRuntimeCodexPane` 和选中态同步机制，优先替换详情 pane 内部或最小必要节点；不得在每次关系跳转时调用整页 `innerHTML` 重建作为快捷实现。

## 状态与交互契约

建议把查看栈作为 Codex UI 状态的一部分，而不是引入浏览器 URL 或全局导航服务：

- `current`：当前 Def 和 Inspector 页签。
- `backStack`：可返回的查看位置。
- `forwardStack`：可前进的查看位置。
- 栈只存在于当前 UI Controller 生命周期，不做存档，不写 localStorage。

条目列表点击是否进入 back stack 必须在实现前固定并测试；建议：列表选择建立当前位置，关系跳转建立历史，以避免用户在列表中连续浏览时返回路径过长。

## 测试与验收

### 功能验收

- 概览、关系、原始数据三页仍可渲染，已有只读数据和复制 JSON 行为不回归。
- resolved 关系可进入目标 Def；missing / ambiguous 关系保持诊断语义。
- 连续关系跳转可以返回；返回后可以前进；产生新跳转后 forward 栈清空。
- 重复点击同一目标不会制造重复栈项。
- Runtime 视图刷新后无效历史项不会导致异常或显示过期详情。
- 窄屏栏位切换、键盘焦点和 ARIA 属性保持可用。

### DOM 刷新验收

- 条目容器在详情跳转、返回 / 前进和页签切换时保持节点身份。
- Mod pane 在上述操作中保持节点身份。
- 外层 `.runtime-editor-panel` 和 `[data-runtime-editor-codex]` 不因详情导航被替换。
- 测试必须直接断言允许刷新的节点和禁止刷新的节点身份，而不能只断言最终文本。

### 内容与尺寸验收

- 不新增统计服务、统计卡片或无数据依据的计数。
- 不新增长篇说明、教程段落或装饰性空状态。
- 详情内容在正常桌面宽度下可滚动但不产生异常巨大固定高度；窄屏不出现横向溢出。
- 关系入口和字段树不会因为长 ID 撑宽页面；长文本可换行或折叠。
- CSS 测试覆盖紧凑布局、窄屏布局、焦点态和 `prefers-reduced-motion`。

### 命令

```text
npx tsc --noEmit
npx vitest run tests/ui/runtime-editor-codex-details.test.ts tests/ui/runtime-editor-codex-shell.test.ts tests/ui/runtime-editor-codex-integration.test.ts
npm run check:architecture
npm run check:docs
npm run build
```

浏览器验收待施工后补充，至少检查：桌面三栏、窄屏切换、长 ID、关系连续跳转、返回 / 前进和过滤条件保持。

## 当前核验（2026-09-20）

- 已读取 `docs/docs-828/00-INDEX.md`，并按路由检查 Runtime Editor、Registry、UI、文档维护规范。
- 已检查当前 Codex 外壳、详情渲染、事件绑定和三组 UI 测试。
- 已确认现有关系跳转可用，但没有查看栈；详情主体存在密度和层级改进空间。
- 已实现详情区紧凑分组、相关组分入口、关系跳转查看栈和返回 / 前进按钮。
- 已实现局部刷新：关系跳转、返回 / 前进只替换详情 pane 并同步条目选中态，不替换 Mod pane、条目 pane 容器或外层 Codex。
- `npx tsc --noEmit`：通过。
- Codex 定向测试：通过，3 个测试文件、27 个测试。
- `npm run check:architecture`：通过。
- `npm run check:docs`：通过，错误数 0。
- `npm run build`：通过；仅有既有大 chunk warning。
- `npm test -- --run --reporter=dot`：通过，187 个测试文件、1706 个测试。
- 浏览器级视觉验收：已尝试，但当前 Computer Use 无可用浏览器窗口，无法进行真实截图检查；待有浏览器运行环境时补做桌面 / 窄屏目视确认。

## 剩余工作

- 待在可用浏览器环境中补充窄屏、长 ID、长字段和查看栈目视验收。
- 目视验收完成后，将本 Task 移入 `archive/` 并更新状态为 `done`。
- 完成后按文档维护规则记录最终核验，再将本 Task 移入 `archive/`。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[task-0128-runtime-editor-loaded-content-codex]] · [[task-0129-runtime-editor-codex-workspace-optimization]] · [[task-0130-runtime-editor-codex-def-inspector-plan]]
