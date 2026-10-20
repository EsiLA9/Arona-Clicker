# Unit 0288-U7：增加 Map / Encounter 工作区投影

## Goal
在现有 Workspace 外壳内呈现当前 Map Node、可移动的相邻节点与活动 Encounter，并展示移动锁定和结算结果。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 文档 | `docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice.md` | UI 验收与禁止项 |
| 文档 | `docs/docs-829/02-modules/ui.md`、`docs/docs-829/05-conventions/architecture-discipline.md` | UI 读取与命令边界 |
| UI 规范 | `ui-style/00-index.md`、`ui-style/patterns.md` | 复用项目视觉约定 |
| UI 规范 | `ui-style/foundations.md`、`docs/ai/frontend-design-project-overlay.md` | 沿用视觉角色与本项目刷新 / DOM 约定 |
| 源码 | `src/ui/workspace/workspace-router.ts`、`workspace-renderer.ts` | Workspace Route / 内容渲染 |
| 源码 | `src/ui/components/operation-workspace.ts`、`src/ui/css/operation-workspace.css` | 当前复杂工作区样式仅作外壳/令牌参考 |
| 源码 | `src/arona-clicker/contracts/runtime.ts`、`src/arona-clicker/runtime-game-instance.ts` | 当前 MapRun ReadModel 不提供地图 Node / Edge 内容；需补只读投影供 UI 使用 |
| 测试 | `tests/ui/workspace-router.test.ts` | 路由回归 |

## Context Budget
- 目标 12k–28k tokens；历史文档 0 篇；最多 8 个实现文件 / 700 行净改动。Unit 要求的 Receipt 是强制流程记录，不计入实现文件数或净改动预算。

## Confirmed Facts
| 事实 | 依据 |
|---|---|
| Workspace Route 当前有独立 `operation` runId 路由。 | `workspace-router.ts` |
| Map View 必须用 Game ReadModel 投影，不维护第二份可写位置。 | 阶段 B 合同与 `contracts/runtime.ts` |
| 当前 `MapRunQuery` 只提供 Run snapshot / 当前 Encounter；`ContentCatalogQueryPort` 和 `WorldCatalogQueryPort` 都不公开 Maps，因此 UI 尚无途径读取 Map 名称、Node 与 Edge。 | `contracts/runtime.ts`、`contracts/content-catalog.ts`、`contracts/world-catalog.ts` |

## Constraints
- 先沿用现有 Workspace frame、返回上下文和组件约定；不复制旧 Strategy Park 静态地图布局。
- 新增的 `map` Workspace route 只携带 MapRun ID 作为定位信息；在 legacy `PanelState.workspace` 为空且 service 为 game 时，Router 必须保留合法 Map route。不得增加第二份可写 Workspace / MapRun 状态。
- Map 与 Encounter 视图根据同一个 MapRun ReadModel 投影切换；Encounter 活跃时仍在同一 MapRun route 内显示。
- 扩展 MapRun ReadModel 提供当前 Map 的 detached / readonly 展示内容（名称、Node 标题/说明/遭遇标记、Edge 与起点/出口）；UI 不直接查询 Registry 或复制 Datapack 数据。
- 地图内容使用 Map 当前 Node 的相邻边投影，不展示任意远端节点作为可移动操作。
- Encounter 活跃时显示“遭遇进行中”与移动锁定原因；Map 命令的 UI 委托由 U8 接入 GameCommands。
- 维护局部刷新边界；普通按钮点击不得引发无关整页刷新。
- 实施 UI 前在 Receipt 记录简洁 DOM/component sketch；复用现有中文、卡片、按钮与状态视觉。

## Allowed Files
- src/ui/workspace/workspace-router.ts
- src/ui/workspace/workspace-renderer.ts
- New file: src/ui/components/map-workspace.ts
- New file: src/ui/css/map-workspace.css
- src/arona-clicker/contracts/runtime.ts
- src/arona-clicker/runtime-game-instance.ts
- New file: tests/ui/gameplay-b-map-workspace.test.ts
- ui-style/patterns.md (only add the implemented Map Workspace reuse pattern with source references)

强制流程记录：`docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice-units/receipts/receipt-U7-map-workspace.md`；不计入上述 8 个实现文件预算。

## Explicit Non-goals
- Spot Entry、Controller 命令处理、复杂画布布局、Strategy Park 样式重写。

## Stop Conditions
1. 需要读取 UI 规范外的实现路径才能确定实际加载点，或需要白名单外修改。
2. 组件必须自行创建 / 修改 MapRun 状态或调用旧 Operation Route。
3. 超过 8 个文件 / 700 行；UI 需要新的视觉系统或复杂交互。
4. 定向 UI / Router 测试或类型检查失败且原因不明。

## Completion Criteria
- [ ] Map 和 Encounter 各有正确 Workspace 显示，并可返回正常游戏页面。
- [ ] Map 显示当前节点、相邻节点、访问/完成状态与出口状态。
- [ ] 活动 Encounter 的锁定原因及结束后的返回提示可观察。
- [ ] 当前页不以样例 ID 或旧 Operation Map 专门分支渲染。
- [ ] `ui-style/patterns.md` records the implemented Map Workspace pattern and actual reuse entry points; it does not establish a new visual system.

## Verification
| 项 | 命令 | 期望 |
|---|---|---|
| 定向测试 | `npx vitest run tests/ui/gameplay-b-map-workspace.test.ts tests/ui/workspace-router.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
