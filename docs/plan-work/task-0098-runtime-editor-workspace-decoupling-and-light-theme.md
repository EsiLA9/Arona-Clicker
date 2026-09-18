# Task：Runtime Editor 通用工作区、亮色主题与内容浏览器解耦

状态：active — 🟡 核心迁移与自动化验收已完成，待浏览器视觉验收

## 目标

修正 Runtime Editor 在 task-0095 之后暴露出的结构性问题：编辑器入口、编辑中 Mod、内容浏览器、Definition 表单和 Debug 编辑态仍然存在生命周期与视觉层级耦合。

本 Task 将 Runtime Editor 收敛为一个稳定的、亮色的、可复用的通用 Editor Workspace：

- 编辑器打开后保持在前台，不因点击内容、切换筛选、保存 Draft 或 Apply 而消失；
- `IS_DEBUG_EDITING=1` 能预先建立并 hydrate 编辑态，不因隐藏编辑器或重建页面而丢失；
- 内容浏览器成为独立页面，不再依附于“编辑中 Mod”面板；
- Mod、Init、Area、Spot 使用同一套编辑器框架，不再由右侧浮窗和全屏 Modal 分裂承载；
- Apply 后保留当前页面、当前内容类型和当前上下文，不自动退回 Runtime Editor 总入口。

前置任务：[[task-0095-runtime-editor-mini-launcher-and-init-default-area]]、[[task-0094-runtime-editor-floating-pane-launcher]]。

## 设计方向

### 亮色 Schale Editor

采用“档案纸面 + 青色信号线”的视觉方向，编辑器是内容制作工作台，不是游戏 HUD 的暗色工具窗。

| Token | 用途 |
| --- | --- |
| `#f6f8fc` | Workspace 背景 |
| `#ffffff` | 编辑器纸面与表单卡片 |
| `#14233d` | 主文字与标题 |
| `#c9d8ea` | 分隔线与输入边界 |
| `#2f80ed` | 主操作与当前选中态 |
| `#0b99a8` | 编辑器识别用信号线 |
| `#c88719` | 警告与待处理状态 |

唯一视觉记忆点是左侧贯穿 Workspace 的青色“注册信号线”，用于标识当前内容属于编辑器上下文；不再为每个浮窗叠加不同颜色和阴影。

### 通用编辑器框架

```text
┌─────────────────────────────────────────────────────────┐
│ Runtime Editor / 内容浏览器              保存 Draft Apply │
├────────────────┬────────────────────────────────────────┤
│ 工作区导航     │ 当前内容编辑区                         │
│ Mod 信息       │ 标题 / 来源 / 状态                     │
│ 内容浏览器     │ 基础 / 区域 / 功能 / 诊断               │
│ 诊断与差异     │ 错误、差异与保存反馈                   │
└────────────────┴────────────────────────────────────────┘
```

编辑器页面使用稳定 Workspace host；表单切换是内部状态切换，不通过一次性 Modal 替换整个编辑器。只有条件树、支付方案等真正的局部复杂对象可以使用受控子弹窗。

## 边界与不变式

- 不改变 Init / Area / Spot 的引擎定义、Policy、Registry、PlayerState 或存档结构。
- 不把 Runtime Editor Draft 写入玩家存档。
- 不通过提高 `z-index` 掩盖生命周期问题；前台保持必须来自稳定宿主与明确的打开 / 关闭状态。
- 编辑器可隐藏但不能因内容操作被隐式关闭；只有用户明确点击关闭编辑器或放弃编辑才清除 UI 状态。
- `IS_DEBUG_EDITING` 只负责 Debug 编辑态的预加载，不决定编辑器页面是否可见。
- 内容浏览器的当前 Mod、内容类型、筛选、选中条目和编辑 Draft 必须独立于 Mod 信息页面的显隐。
- Apply 成功后保留当前编辑上下文；成功反馈使用页面内状态，并可辅以短暂 Toast，不触发强制路由回退。

## 施工切片

### P0：状态生命周期与前台保持

- [x] 将 Debug seed 拆分为“已初始化 / 已 hydrate / UI 是否打开”，避免 `debugEditingSeeded` 抢先置位导致无法恢复。
- [x] `IS_DEBUG_EDITING=1` 时预先建立 Debug Mod 编辑态，并在 Runtime Mod 可用时加载可编辑内容。
- [x] 所有直接打开入口（含迷你浮窗与“开启编辑态”按钮）先执行 Debug 编辑态保障，不再把默认编辑内容覆盖为空白状态。
- [x] 关闭面板只隐藏 Workspace；显式放弃编辑才清理 Draft。
- [x] 内容点击、筛选、保存、Apply、跨路由重建均不得隐式清除 Workspace 宿主。
- [x] 明确 Launcher、Editor Workspace、局部子弹窗和 Toast 的层级与关闭契约。

### P1：通用亮色 Editor Workspace

- [x] 建立统一 Workspace frame、导航区、标题区、内容区、状态区和操作区。
- [x] 将 Mod 信息、Init、Area、Spot 接入同一编辑器框架。
- [x] 移除 Mod 信息与内容表单的右侧出栏差异；统一宽度、间距、按钮、焦点和错误呈现。
- [x] 统一亮色 Token，移除 Launcher 与完整编辑器之间的暗亮主题分裂。
- [x] 保留键盘焦点、窄屏布局和 `prefers-reduced-motion` 支持。

### P2：内容浏览器独立页面

- [x] 增加独立的 Content Browser Workspace 页面，不再把内容浏览器作为 Mod 信息面板的附属区块。
- [x] 内容浏览器独立维护内容类型、筛选、选中条目和 Draft / Applied 差异。
- [x] 从 Launcher 提供“打开内容浏览器”入口；“编辑中 Mod 信息设置”只进入 Mod 设置页面。
- [x] 内容浏览器打开 Init / Area / Spot 编辑时保持当前 Workspace 和上下文。
- [x] Apply 后留在内容浏览器或当前 Definition 编辑页，不自动回到总编辑器。

### P3：表单与命令协调

- [x] 将现有 Definition / Spot 主表单迁移到通用 Editor Workspace 内部页面；复杂集合子编辑保留受控子弹窗。
- [x] 保持 Draft、Policy、prospective graph、Apply 和错误诊断边界不变。
- [x] 保存 Draft、Apply 成功或失败后保留当前编辑上下文。
- [x] 内容浏览器和 Mod 页面共享 Runtime Editor state，但不共享页面显隐状态。

### P4：测试与验收

- [x] 测试 `IS_DEBUG_EDITING=1` 在进入页面前已建立编辑态并能获得预加载内容。
- [x] 测试点击内容、切换筛选、保存 Draft、Apply 和全量 render 后 Editor Workspace 仍在前台。
- [x] 测试 Mod 设置、内容浏览器、Init、Area、Spot 使用统一 Workspace frame。
- [x] 测试内容浏览器是独立页面，关闭 Mod 设置不会清除内容浏览器 Draft。
- [x] 测试 Apply 成功后保留当前页面和选中条目，不强制回退。
- [x] 完成代码层亮色 Token、键盘焦点、窄屏布局和 reduced-motion 规则；浏览器视觉验收待补充。
- [x] 完成 Runtime Editor 专项测试、全量测试、类型检查、架构检查和文档检查；浏览器视觉验收待补充。

## 主要代码落点

| 层 | 预计责任 |
| --- | --- |
| `src/ui/controller.ts`、`src/ui/runtime-editor/debug.ts` | Debug 编辑态预加载、Workspace 生命周期与跨 render 保持 |
| `src/ui/runtime-editor/actions.ts` | Workspace 路由、页面切换、Draft / Apply 后上下文保持 |
| `src/ui/runtime-editor/view.ts` | 通用 Editor frame、Mod 设置页、Content Browser 页和 Definition 编辑页 |
| `src/ui/runtime-editor/state.ts` | 页面上下文与编辑态生命周期状态分离 |
| `src/ui/runtime-editor/launcher.ts` | 新增内容浏览器入口并维持扩展注册接口 |
| `src/ui/css/runtime-editor.css` | 亮色 Token、通用 Workspace、前台层级与响应式布局 |
| `tests/ui/` | 生命周期、路由独立性、统一框架、Apply 保持上下文和视觉契约回归 |

## 当前核验（2026-09-18）

- 已将 Definition / Spot 主表单从 `ModalManager` 迁移到 body 级通用 Editor Workspace；复杂集合编辑仍使用受控子弹窗。
- `renderRuntimeEditorPanel()` 现在区分 Mod 设置、内容浏览器、Definition 编辑和 Spot 编辑页面；内容浏览器不再与 Mod 表单同屏附属。
- `seedDebugEditing()` 现在区分初始化与 hydrate，`IS_DEBUG_EDITING=1` 时会预加载已有 Runtime Mod；隐藏 Workspace 不清除 `runtimeDatapackEditor`。
- Launcher、完整面板和表单已统一为亮色 Token，并将 Workspace 层级提高到 Toast 之外的稳定编辑层；Toast 仍用于短反馈。
- 已新增“打开内容浏览器”入口；Apply 和保存操作保留当前编辑页面。
- 已通过：`npx tsc --noEmit`；Runtime Editor / 顶栏专项测试（20 tests）。
- 自动化核验已完成：`npx tsc --noEmit`、Runtime Editor 定向 22 tests、全量 `npm test -- --run`（170 files / 1582 tests）、`npm run check:architecture`、`npm run check:docs` 与 `git diff --check` 均通过。
- 回归核验补充通过：`tests/ui/topbar-settings-workspace.test.ts` 11 tests，覆盖直接从迷你入口打开时自动建立并填充 Debug Mod 信息。
- 尚未完成：浏览器级视觉验收；本轮未启动浏览器交互验收，因此不把它标记为已完成。
- task-0096 的未提交刷新边界改动及其任务文档属于独立工作，不纳入本 Task 的实现范围。

## 验收命令

```text
npx tsc --noEmit
npx vitest run tests/ui/runtime-editor-definition.test.ts tests/ui/runtime-editor-form.test.ts tests/ui/topbar-settings-workspace.test.ts
npm test -- --run
npm run check:architecture
npm run check:docs
```

浏览器验收需确认：编辑器始终在前台、点击内容不消失、Debug 内容预加载、内容浏览器独立页面、Apply 后上下文保持，以及亮色视觉统一。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[task-0094-runtime-editor-floating-pane-launcher]] · [[task-0095-runtime-editor-mini-launcher-and-init-default-area]]
