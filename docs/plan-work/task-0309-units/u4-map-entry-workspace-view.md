# Unit 0309-U4：渲染 MapRun 准备页

## Goal

使用共享三栏 Workspace 与主题宿主渲染 fresh / resume / blocked / unavailable 的准备页，只展示 MapEntryView 的真实内容。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` §“推荐页面与操作结构”及信息优先级 | 内容层级和业务限制 |
| 风格 | `ui-style/foundations.md`、`ui-style/patterns.md` | 复用既有主题、三栏与标题栏 |
| 源码 | `src/ui/components/shared/workspace-frame.ts:renderWorkspaceFrame` | 列宿主、Theme Scope 与滚动 owner |
| 源码 | `src/ui/components/world/area-workspace.ts:renderAreaWorkspace` | 桌面 route-only 三栏页面结构 |
| 源码 | `src/ui/components/shared/workspace-titlebar.ts:renderWorkspaceTitlebar` | 复用标准标题栏与返回操作 |
| 源码 | `src/ui/workspace/workspace-renderer.ts:renderWorkspaceBody` | route 到页面组件分发 |
| 契约 | `src/arona-clicker/contracts/map/map-entry.ts:MapEntryView` | 只读内容来源 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k tokens |
| 文档 Read Set | 3 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 停止并拆分 |

## Optional Read Set

- 无；点击 gate、提交、增量刷新由后续 Unit 处理。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `tools/datapack-editor/**`

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| `renderWorkspaceFrame` 为每列声明 hostId、themeScope、surface、scroll owner 与 workspaceOwner | `src/ui/components/shared/workspace-frame.ts` | 复用共享三栏骨架 |
| route-only Area 页面使用 `renderWorkspaceTitlebar`、左侧 rail、中心与右侧 panel surface | `src/ui/components/world/area-workspace.ts` | 当前可复用入口 |
| MapEntryView 的名字、准入、HP、资源和进度来自 Runtime 的只读 DTO | `src/arona-clicker/contracts/map/map-entry.ts` | UI 不访问 Owner |

## Constraints

- 使用现有主题与共享三栏，不引入新配色、字体或视觉体系。
- 左栏复用 `renderLeftPanel`；中栏展示 Map 名称、可选说明 / 提示、真实进度和开始/继续；右栏只展示固定队伍与局内资源。
- 新增四个内容宿主：中栏说明滚动区、中栏主操作区、右栏队伍滚动区、右栏资源区。列 Host：`leftPanel.map-entry.navigation` / `centerPanel.map-entry.main` / `rightPanel.map-entry.party`；成员语义 key 使用 `characterId`。
- 中栏/右栏使用共享 Workspace titlebar；Frame、列 Host 与其余列在内容值变化中保持稳定。局部更新范围及锚定浮层在后续 Unit 实现。
- 页面不显示未来节点 / 敌人、全图进度百分比、战力、奖励或长期资源；提示和所有文本均安全转义。
- 遵守 Task 0309、`AGENTS.md`、frontend-design skill 与 `docs/ai/frontend-design-project-overlay.md`。

## Allowed Files

- `src/ui/components/map/map-entry-workspace.ts`
- `src/ui/css/map-entry-workspace.css`
- `src/ui/workspace/workspace-renderer.ts`
- `src/ui/components/shared/workspace-titlebar.ts`

## Explicit Non-goals

- 不接设施入口、点击 handler、重开 / 放弃命令、前台门控或区域刷新。
- 不修改 MapRun / SaveData 或 `MapEntryView` 字段。
- 不修改或运行测试。

## Stop Conditions

适用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件的 6 条。若必须新增第五个文件、访问 Owner、建立新视觉方向或扩大内容合同，停止。

## Completion Criteria

- [ ] route `map-entry` 渲染对应准备页，未知 / 不可用状态提供可理解提示。
- [ ] fresh / resume / blocked / unavailable 展示准确且不混淆初始与当前值。
- [ ] Frame 与四个内容宿主职责清晰，队员使用稳定语义 key；样式只用现有主题角色。
- [ ] 所有用户文本转义，且不出现选队、未来地点、战力或长期资源误导。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 源码类型检查 | 继承仓库 `tsconfig.json` 的临时 config，仅入口 `workspace-renderer.ts` 与 `map-entry-workspace.ts` | 无新增错误 |
| 差异检查 | `git --no-pager diff --check` | 通过 |
| 测试 | 未要求；不修改或运行测试 | — |

## Pre-flight

- Goal：把只读 MapEntryView 渲染为三栏准备页；Allowed Files 仅组件、作用域 CSS、Workspace 分发与共享标题栏；共享主题与 rail；四个内容宿主按本 Unit 定名；不做 gate / 命令 / 刷新器，保持身份、滚动与安全转义。
