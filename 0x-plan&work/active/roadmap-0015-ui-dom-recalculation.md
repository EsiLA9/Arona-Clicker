# Roadmap-0015 — 正常游玩过程 DOM 重算收敛

> 本文只记录正常游玩过程中的 DOM 重算治理任务；主题编辑器自身的高级编辑刷新另见 `roadmap-0014-theme-editor-convergence`。代码与运行机制以 `src/ui/` 为准。

## 目标

降低正常游玩过程中的整页 `#app` 重建次数，保持聊天滚动、按钮焦点、主题浮窗和折叠状态稳定，并将“必须重建”的结构变化与“只需更新数据/样式”的变化分开。

## 优先级

### P0 — 先消除高频全量重建

- [x] 将普通 Tick、资源产出、帧数与 Spot 产出继续限制在 `refreshLight()` 的局部文本更新范围内；顶部“推进”按钮也直接走该入口。
- [x] 排查主要正常按钮事件中的无条件 `ctrl.render()`，并将普通动作切换到合并刷新入口。
- [x] 对常用内容操作改为面板级局部更新：背包使用、强化购买/升级、角色成长、装备、已读状态等不再重建 `#app`。
- [x] 保留 `scheduleRender()` 的合并机制，禁止普通动作在同一同步事件链中连续调用多次全量 `render()`。
- [x] 验收第一批：左/中/右栏 Tab 只替换受影响面板；普通升级、资源 Tick 与常用内容操作不触发 `root.innerHTML` 重建。

### P1 — 将必要结构刷新限制到局部

- [x] 把聊天追加、故事推进和日志追加从整页重建收敛为对应流容器的局部更新。
  - [x] 页级打字/门控计时到期已先收敛为中心聊天面板刷新，不再触发三栏整页重建。
  - [x] 一般聊天的演出文本、羁绊尾巴已走聊天面板局部刷新。
- [x] 日志可见时只替换 `.log-panel`，不重建中心栏骨架。
- [x] 将 Tab 切换限制为受影响面板更新，避免重新生成三栏骨架。
- [x] 将 Tab/操作按钮的 active、文本颜色和 SVG 状态限制在目标面板及其按钮组内更新。
- [x] 对揭示状态变化建立按区域的局部刷新入口，左栏与右栏局部更新，不重建顶部栏和中心聊天。
- [x] 对弹窗打开/关闭、主题浮窗开关与拖拽保留现有独立 DOM 生命周期，不因主界面刷新重复创建。
- [x] 验收：专项测试验证未受影响面板节点身份不变；局部刷新保留聊天/面板滚动。

### P2 — 建立可观测的刷新边界

- [x] 为 `render()`、面板刷新、主题应用、`refreshLight()` 增加开发检查计数，可通过 `UIController.getRefreshStats()` 或 `#app` 的 `data-ui-refresh-*` 属性读取。
- [x] 区分“DOM 重建”“样式变量注入”“文本节点更新”三类应用内成本；布局/绘制由 Edge Performance 面板观测，不伪装成 JS 计数。
- [x] 测试覆盖普通 Tick、Tab 切换、聊天追加、主题预览、表现层编辑和结构性增删相关路径。
- [x] 增加刷新预算：正常 Tick 不得触发全量 DOM 重建；单次普通用户操作最多一次结构刷新。
- [x] 验收：Edge 实测普通推进前后 `data-ui-refresh-full` 保持 `1`、`data-ui-refresh-light` 增加 `1`；右栏切换仅增加面板计数。

## 当前进度

P0/P1/P2 已完成当前范围：Tick 直接使用 `refreshLight()`；普通事件使用 `scheduleRender()` 合并；常用操作与 Tab 使用面板级刷新；一般聊天、日志和揭示列表按局部区域更新；主题/弹窗等生命周期保持独立。`UIController.getRefreshStats()` 与 `#app[data-ui-refresh-*]` 提供 DOM、面板、轻量文本和主题应用计数。Edge 已在主题实验 Init 中验证普通推进不增加整页计数、右栏切换不影响整页计数；全量测试、类型检查、架构检查和构建均通过。

## 重点代码入口

| 范围 | 入口 |
| --- | --- |
| 全量重建 | `src/ui/controller.ts` 的 `render()` |
| 轻量 Tick | `src/ui/controller-core.ts` 的 `refreshLight()` |
| 合并刷新 | `src/ui/controller.ts` 的 `scheduleRender()` |
| 主题变量 | `src/ui/controller-theme.ts` 的 `applyTheme()` / `refreshTheme()` |
| 编辑器刷新 | `src/ui/controller-modals.ts` 的 `refreshUserThemeEditor()` 与 `refreshPresentationHostCard()` |
| 主界面动作 | `src/ui/controller-actions-*.ts` |

## 暂不处理

- 不在本任务中重构主题树的颜色派生算法。
- 不取消确实需要改变 UI 构成树的结构刷新，例如进入新页面、切换对话主体或增删表现目标。
- 不以 MutationObserver 取代明确的状态更新入口；观测工具只用于开发检查。
- 不为历史存档增加迁移兼容层。

## 完成标准

- [x] P0 完成并通过类型检查、构建与相关 UI 测试。
- [x] P1 完成后，Edge 中正常操作不再出现无关区域整页闪动，局部滚动状态得到保留。
- [x] P2 完成后，开发检查可以定位全量刷新、面板刷新、轻量刷新和主题应用次数及范围。
