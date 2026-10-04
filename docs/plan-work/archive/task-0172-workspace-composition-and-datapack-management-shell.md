# Task：Workspace 组合布局与数据包管理壳层

状态：done — Workspace 合并能力与数据包管理单 Workspace 基础工程完成（2026-10-02）

## 目标

为后续数据包自动加载与管理重构建立 workspace 结构基础：每个场景路由只呈现一个对应 workspace；通用 frame 支持 left+center、center+right 与全列合并；数据包管理先将分类导航和主体放入同一个左侧 workspace，详情操作保留在右侧。

本 Task 当前只交付 workspace 壳层，不代表自动文件夹加载或完整数据包管理器已完成。

## 设计边界

- 本 Task 包含：通用 workspace 列组合、组合后不输出被吸收列的宿主、datapack 场景的唯一 frame 与左右结构。
- 后续阶段：经典包启用/禁用拖放器、任意未启用包存储与删除、编辑态版本复制规则、指定目录内 ZIP 与展开目录的启动加载及编辑态辨识。
- 明确非目标：本次不改 PackManager 数据语义、Datapack schema、启动加载、文件夹/ZIP 解析、编辑态转换行为或页面操作规则。
- 视觉刷新等级：结构变化，仅在切换到 datapack route 时重建对应 workspace；分类交互仍沿用现有事件和刷新策略。
- DOM budget：workspace frame 新增 `data-composition` 属性；数据包 workspace 使用既有三个语义区域中的两个，新增两个有职责的分区 wrapper（导航、主体），不新增装饰节点。被合并的列不生成 host DOM。
- Interaction preservation：场景切换采用现有 workspace route 生命周期；分类和包选择遵守当前 UI 更新机制；右侧 inspector 的 host ID 稳定。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| service route 以 `service:<page>` 作为唯一 route key，workspace renderer 根据当前 route 输出 service frame。 | `src/ui/workspace/workspace-router.ts:workspaceRouteKey`、`src/ui/workspace/workspace-renderer.ts:renderWorkspaceBody` | 一个 datapack 场景固定映射到 `service-datapack` frame。 |
| WorkspaceFrame 原先固定输出 left、center、right 三列。 | `src/ui/components/workspace-frame.ts:WorkspaceFrameSpec`、`renderWorkspaceFrame` | 增加显式组合值，并确保组合后只输出保留的列。 |
| 数据包服务原先分别在导航、主体、检查区列上渲染。 | `src/ui/components/service-workspace.ts:renderServiceWorkspace` | datapack 将导航和主体装入 left workspace，右侧保留检查区。 |
| UI Host Registry 通过稳定 host ID 登记服务可编辑区域。 | `src/ui/service-definitions.ts` 的 datapack 服务定义 | datapack 合并后的导航/主体必须共用唯一左侧宿主，检查区单独登记。 |

## 施工切片

### P0：通用 Workspace 组合与 datapack 壳层

- [x] WorkspaceFrame 声明列组合，并且只渲染组合保留的 workspace host。
- [x] datapack scene 输出唯一 `service-datapack` frame；左侧组合导航与主体，右侧为详情与操作。
- [x] 运行 WorkspaceFrame、service-workspace 定向测试及类型检查。
- [x] 用实际游戏 UI 核对桌面布局、滚动区域和 host/theme 目标；本 Task 不包含窄屏适配。

## 测试与验收

- [x] `tests/ui/workspace-frame.test.ts` 覆盖 left+center、center+right、all 合并只渲染保留宿主。
- [x] `tests/ui/service-workspace.test.ts` 证明 datapack 场景只输出一个 WorkspaceFrame，且保留左右目标 host。
- [x] `npx tsc --noEmit` 无新增类型错误。
- [x] 浏览器验收 datapack route 仅输出一个 frame；桌面左侧包含分类与主体，右侧显示详情检查区。

## 当前核验（2026-10-02）

- `npx vitest run tests/ui/workspace-frame.test.ts tests/ui/service-workspace.test.ts`：通过，2 个文件、25 个测试。
- `npx tsc --noEmit`：通过。
- `npm run check:docs`：通过，517 篇 Markdown、0 errors。
- Vite 浏览器：桌面 1121×811 确认导航、主体与右侧详情列；窄屏不属于本 Task 验收范围。

## 剩余工作

- 本 Task 已完成；下一阶段由 [[task-0173-development-datapack-source-loading-and-management]] 承载。
- 原始需求中的自动目录加载、经典包启用/未启用拖放、任意未启用包名/版本共存、删除与形态转换、编辑态复制前更改 VersionName 及右侧控制规则均未在本 Task 实现。

## 相关路由

- [[docs/docs-829/00-INDEX]]
- [[docs/docs-829/02-modules/ui]]
- [[docs/ai/context-packs/ui-presentation]]
- [[docs/ai/frontend-design-project-overlay]]
- [[docs/ai/PROJECT-CONSTITUTION]]
