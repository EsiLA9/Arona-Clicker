# Task 0043：顶栏导航与设置 Workspace 统一管理

状态：✅ 已完成（代码、自动化测试与浏览器冒烟验收通过）

> 本文由原 `active/策划.md` 整理为可执行工作计划。它承接 `task-0040-unified-workspace-frame` 的统一三栏工作区能力，聚焦顶栏导航、设置 Workspace、服务入口和背包路由；不直接修改引擎状态或新增存档字段。

本文回答顶栏如何收敛为“主题 / 游戏 / 背包 / 设置”，以及设置、存档、数据包、记录之间如何统一使用现有 Workspace 式三栏管理。

## 目标

- 顶栏只保留四个一级入口：主题、游戏、背包、设置。
- 存档、数据包、记录不再占用顶栏一级入口，统一从设置页进入。
- 设置页本身也是三栏 Workspace；中心只提供三个服务入口按钮。
- 游戏、设置、存档、数据包、记录、角色和商店统一使用 `WorkspaceFrame` 作为三栏物理骨架。
- 背包不新建第二套页面骨架，复用普通游戏 Workspace，并自动定位到右栏背包面板。
- 主题继续作为顶栏浮动工具存在；它是跨 Workspace 的即时工具，不另造主题页面 Workspace。

## 设计边界

### 一级顶栏

| 入口 | 行为 | Workspace 归属 |
| --- | --- | --- |
| 主题 | 打开/关闭现有主题浮窗 | 浮动工具，继承当前 Workspace |
| 游戏 | 返回普通游戏三栏 | `data-workspace-frame="game"` |
| 背包 | 返回普通游戏三栏，并激活右栏背包内容 | `game` Workspace + `rightTab = other` |
| 设置 | 进入设置三栏 | `data-workspace-frame="settings"` |

顶栏不再直接渲染存档、数据包、记录按钮；帮助入口也移入设置页，避免一级导航继续膨胀。

### 设置 Workspace

设置页使用现有 `WorkspaceFrame`，不创建独立的页面容器或第二套三栏 CSS。

```text
┌──────────────┬──────────────────────────┬──────────────┐
│ 设置导航      │ 设置中心                 │ 设置说明      │
│              │                          │              │
│ 服务入口      │ [存档管理]               │ 当前存档状态   │
│              │ [数据包管理]              │ 当前数据包状态 │
│              │ [记录与图鉴]              │ 关于 / 帮助    │
└──────────────┴──────────────────────────┴──────────────┘
```

中心的三个按钮只负责切换 `PanelState.service`：

- `saves` → 现有存档三栏服务；
- `datapack` → 现有数据包三栏服务；
- `records` → 现有记录/图鉴三栏服务。

服务内容不嵌入设置页，不使用弹窗替代三栏服务；点击后直接进入对应的既有 Workspace。

### 统一 Workspace 约束

所有页面级功能必须满足以下约束：

1. 由 `renderAppShell()` 根据顶层路由选择 Workspace 渲染器。
2. 三栏结构统一由 `renderWorkspaceFrame()` / `WorkspaceFrame` 产出。
3. 每个 Workspace 声明固定的 `left / center / right` 列、布局 preset、业务 role 和稳定 Host ID。
4. 主题表现通过 UI Host Registry 和 `renderUIHost` 接入，不在新页面内手写另一套主题背景/边框逻辑。
5. 控制器只负责路由和命令编排，组件只读取 `GameReadModel`；不新增 UI 直接写 `PlayerState` 的路径。
6. Workspace 切换只改变临时 `PanelState`，不增加存档字段，也不改变引擎状态层。

统一关系如下：

```text
顶栏 / 设置中心入口
          │
          ▼
PanelState.service + workspace 状态
          │
          ▼
renderAppShell
          │
          ▼
renderWorkspaceFrame / WorkspaceFrame
          │
          ├─ game：普通游戏三栏
          ├─ settings：设置三栏
          ├─ service-datapack：数据包三栏
          ├─ service-saves：存档三栏
          ├─ service-records：记录三栏
          ├─ character：学生 Workspace
          └─ shop：商店 Workspace
```

背包是 `game` Workspace 的一个导航投影，不作为 `WorkspaceState` 新增类型。主题浮窗是跨页面工具，不作为三栏页面。

## 路由与状态方案

### 顶层 service 类型

将 `PanelState.service` 扩展为：

```ts
'game' | 'settings' | 'datapack' | 'saves' | 'records'
```

`settings` 属于顶层服务路由；`datapack`、`saves`、`records` 保留原有服务 ID 和既有三栏渲染逻辑。

### 路由流转

```text
游戏 ── 设置 ──→ 设置 Workspace
                    ├─ 存档管理   → saves Workspace
                    ├─ 数据包管理 → datapack Workspace
                    └─ 记录与图鉴 → records Workspace

任意页面 ── 游戏   → game Workspace
任意页面 ── 背包   → game Workspace + rightTab = other
任意页面 ── 设置   → settings Workspace
```

### 数据包草案

- 从数据包 Workspace 进入设置时，保留 `datapackWorkspace` 草案，不丢弃用户编辑。
- 从数据包 Workspace 直接进入游戏或背包时，继续使用现有“未应用数据包修改”确认流程。
- 从设置再次进入数据包时，恢复原有草案、选中项和分类状态。

### 学生/商店 Workspace

学生 Workspace 与商店 Workspace 保持现有 `WorkspaceState` 管理，不改成设置页的子面板，也不复制设置页布局。

当从学生或商店 Workspace 点击游戏、背包、设置时，沿用现有 Workspace 退出与返回上下文规则；若退出商店，先执行既有临时主题清理。

## 当前事实与代码落点

| 现有事实 | 代码落点 | 本次策划处理 |
| --- | --- | --- |
| 普通游戏、商店、角色、服务都已有 WorkspaceFrame 骨架 | `src/ui/components/workspace-frame.ts`、`src/ui/components/app-shell.ts` | 继续复用，不新建布局系统 |
| 存档、数据包、记录已各自有三栏服务渲染器 | `src/ui/components/service-workspace.ts` | 保留内容，只调整入口位置 |
| 顶栏当前直接暴露数据包、存档、记录 | `src/ui/components/header.ts` | 收敛为设置入口 |
| 顶栏事件已统一由 `data-service` 处理 | `src/ui/controller-actions-topbar.ts` | 扩展 `settings`，设置中心复用同一事件通道 |
| 背包当前位于右栏 `other` Tab | `src/ui/components/right-panels.ts` | 顶栏背包定位到该 Tab，内部 ID 暂不迁移 |
| 服务表现 Host 已集中注册 | `src/ui/service-definitions.ts`、`src/ui/ui-host-registry.ts` | 增加 settings Host，不在组件内散落定义 |
| 现有服务路由只接受 datapack/saves/records | `src/ui/components/service-workspace.ts` | settings 单独由 `settings-workspace.ts` 渲染，避免污染既有服务类型 |

## 施工切片

### P0：路由契约收敛

- 扩展 `PanelState.service` 的 `settings` 联合类型。
- 明确 `renderAppShell` 的路由优先级：服务页 → settings → workspace → game。
- 保证设置切换不进入 `PlayerState`、不修改存档结构。

### P1：顶栏四入口

- `header.ts` 只渲染主题、游戏、背包、设置四个一级入口。
- 主题保留当前浮窗和开关状态。
- 新增背包动作载荷，统一清理/退出当前临时 Workspace 后回到游戏右栏 `other`。
- 帮助按钮移动到设置 Workspace 的右栏。

### P2：设置三栏 Workspace

- 新增 `src/ui/components/settings-workspace.ts`。
- 使用 `renderWorkspaceFrame()` 输出 settings 三栏。
- 中心提供存档、数据包、记录三个入口按钮。
- 左栏提供“设置 / 服务入口”语义标题；右栏提供当前状态和关于/帮助，不承载新的业务编辑逻辑。

### P3：服务入口与草案保留

- 设置中心按钮复用 `data-service` 路由事件。
- 调整数据包草案离开判断：进入设置保留草案；真正离开数据包编辑范围时继续提示。
- 从服务页可通过顶栏设置按钮返回 settings，而不嵌套服务内容。

### P4：Host 与样式

- 为 `settings` 注册 `leftPanel.service.settings.navigation`、`centerPanel.service.settings.main`、`rightPanel.service.settings.inspector`。
- 设置页沿用现有 panel、service-card、主题 Host 和响应式三栏规则。
- 中心三个入口采用同一组服务卡片结构，仅通过图标、标题和说明区分功能。
- 不引入新的视觉主题、依赖或弹窗布局。

### P5：回归与人工验收

- 更新顶栏渲染测试：只存在四个一级入口。
- 新增设置 Workspace 三栏、三个中心按钮和稳定 Host 测试。
- 新增背包按钮路由测试。
- 新增数据包草案“进入设置不丢失、离开到游戏仍提示”测试。
- 验证学生 Workspace、商店 Workspace、Lobby 和普通游戏态的顶栏行为。

## 测试与验收

- `npx vitest run tests/ui/...`：顶栏、设置 Workspace、服务路由、背包路由专项测试。
- `npx tsc --noEmit`：确认 `settings` 路由在 `PanelState`、控制器和组件之间完整收敛。
- `npm test`：全量 UI / 引擎回归。
- `npm run build`：确认选择页、Lobby、普通游戏和服务页构建产物正常。

验收必须满足：

1. 顶栏可见一级入口只有主题、游戏、背包、设置。
2. 存档、数据包、记录只能从设置中心进入，不再从顶栏直达。
3. 设置页存在完整三栏 Workspace，中心只有三组服务入口。
4. 存档、数据包、记录打开后仍是各自完整三栏 Workspace，而不是嵌套在设置页内部。
5. 游戏、设置、服务、角色和商店均能在 DOM 中提供稳定的 `data-workspace-frame` 与 Host 语义。
6. 背包入口进入普通游戏 Workspace 并展示现有背包内容。
7. 主题浮窗可从所有 Workspace 使用，并不改变当前路由。
8. 数据包草案、学生返回上下文、商店临时主题清理均不回归。

## 实施记录

- P0–P4：已完成 `settings` 顶层路由、四入口顶栏、设置三栏 Workspace、服务卡片路由、数据包草案保留/离开提示、settings Host 注册与响应式样式。
- P5：已补充顶栏/设置/背包/草案路由专项测试，并完成 Lobby、设置、存档、数据包与普通游戏态的浏览器冒烟验收。
- 设置右栏保留帮助入口；背包继续复用右栏 `other` 面板并包含效果追踪，均按本文默认方案落地。

## 验证结果

- `npx tsc --noEmit`：通过。
- `npm run check:architecture`：通过。
- `npm test -- --reporter=dot`：135 个测试文件、1257 个测试通过。
- `npx vite build --outDir <临时目录>`：通过；未写入受保护的 `web-dist/`。

## 相关路由

- [[docs/docs-828/02-modules/ui]]
- [[docs/0x-plan&work/active/task-0040-unified-workspace-frame]]
- [[docs/0x-plan&work/active/roadmap-0020-service-workspaces]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
