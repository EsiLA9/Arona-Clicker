# Task：Map Workspace 当前场景结束条件悬浮提示

状态：proposed — 源码与 UI 行为已调查；任务范围已确定，尚未实施。

## 目标

玩家在 Map Workspace 将鼠标悬停于 `map-workspace__hero-progress` 进度标记时，可以查看当前活动或单场遭遇的结束条件。提示随当前 Run 与活动变化，条件来源取只读 Workspace View；玩家能读出规则条项和需要参考的当前局部值。

## 设计边界

- 本 Task 包含：在现有进度标记上挂接现有浮动 Tooltip；按当前活动类型呈现结束规则；条件式遭遇显示完整的条件组合与 Counter / Flag 当前值。
- 条件树以 `all`（全部）、`any`（任一）、`not`（取反）保留组合关系；叶项显示 Counter 比较和值或 Flag 预期值，并显示该引用的当前值。
- 战斗显示胜利判定“所有敌人 HP 为 0”与失败判定“我方全员 HP 为 0”；休整显示当前回合 / 声明回合数；手动遭遇显示其手动完成标签；商店显示“离开商店时结束”。
- 当前数据不提供各条件叶项的权威“已满足 / 未满足”状态。提示只陈述声明和值，不由 UI 计算条件真假，也不伪造逐条判定状态。
- 明确非目标：改动结束规则、Owner 判定、存档或 Schema；改变进度标记位置和文案；增加新弹层系统、按钮、视觉方向或 CSS/token；支持竖屏或键盘操作。
- 已裁定来源：当前源码、测试及 [[docs/docs-829/06-wiki/50-ui/read-model-context]]；当前悬浮提示与 Map 局部刷新遵守 [[docs/docs-829/06-wiki/50-ui/refresh-update]] 和 [[docs/ai/frontend-design-project-overlay]]。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `renderActiveCenter()` 只在进度标签存在时输出 `<span class="map-workspace__hero-progress">`，目前没有 Tooltip 锚点。 | `src/ui/components/map/map-workspace.ts`：`renderActiveCenter`；`src/ui/css/map-workspace.css`：`.map-workspace__hero-progress` | 保留该元素和现有布局，在原元素上复用 `.hover-wrap[data-tooltip]`。 |
| `GameReadModel.mapRun.getWorkspaceView(runId)` 返回只读 Workspace 快照；active view 包含当前 Encounter、活动序列及当前 Shop 投影。 | `src/arona-clicker/contracts/runtime/runtime.ts`：`MapRunQuery`、`MapRunActiveWorkspaceView`、`MapEncounterQueryView`、`MapWorkspaceActivityView`；`src/arona-clicker/runtime/runtime-game-instance.ts`：`getMapActivitiesView`、`getCurrentMapEncounter` | Tooltip 通过 Run ID 获取当前快照，不复制或缓存旧条件。 |
| Encounter 查询提供 manual / condition 完成声明、条件式完成时的当前 locals、Rest 的 round / rounds，以及队伍和敌方 HP。 | `src/arona-clicker/contracts/runtime/runtime.ts`：`MapEncounterQueryView`；`src/arona-clicker/runtime/runtime-game-instance.ts`：`getCurrentMapEncounter` | 可覆盖手动、条件、休整和战斗结束规则。 |
| 战斗以所有敌人被击败结束，队伍全灭为失败；有限回合非战斗 Encounter 按声明回合数结束；条件式完成由 Owner 在提交后判定。 | `src/arona-clicker/services/map/map-run-service.ts`：`resolveEncounterCommitPlan`、`encounterCompletionSatisfied`；`src/data-services/validation/gameplay-map-effect-context.ts`：Encounter completion 校验 | 提示复述现有规则；不得在 Tooltip 中运行终局或条件求值。 |
| 条件完成限制为非战斗、非固定回合遭遇；条件引用 Counter / Flag 必须已声明。 | `src/data-services/validation/gameplay-map-effect-context.ts`：`validateEncounter` | 展示条件组合树及其 Counter / Flag 当前值；不添加 HP 条件说明。 |
| 现有浮动 Tooltip 由 `.hover-wrap[data-tooltip]` 与 `PopoverManager` 处理，统一内容入口为 `getTooltipContent()`；其 `UIContext.game` 可读取 MapRun 查询。 | `src/ui/interaction/popovers.ts`：悬停委托；`src/ui/components/tooltip/tooltip.ts`：`getTooltipContent`；`src/ui/runtime/context.ts`：`UIContext` | 扩展现有 Tooltip 路由和内容渲染，沿用已有浮层定位与生命周期。 |
| 当前右栏活动进度已显示条件标签、声明摘要和局部状态，但不显示逐叶满足状态。 | `src/ui/components/map/map-workspace.ts`：`renderActivityProgress`、`renderEncounterProgress`；`docs/plan-work/task-0312-units/receipts/task-0312-u16-receipt.md` | Hero 提示补充就近查看入口；不扩大为新的判定能力。 |

## 施工切片

### P0：进度标记接入现有悬浮提示

- 在 `map-workspace__hero-progress` 上挂接现有 Tooltip 锚点，并携带当前 MapRun 身份。
- 复用 `PopoverManager` 与 `getTooltipContent()`；不增加独立事件监听或全局刷新路径。

### P1：按当前活动呈现结束规则

- Tooltip 请求时通过只读 `getWorkspaceView(runId)` 取得最新活动状态；单遭遇 Node 使用当前 Encounter，多活动 Node 使用当前活动及相应 Encounter / Shop。
- 条件式 Encounter 递归呈现完整规则树与参与比较的 Counter / Flag 当前值；手动 Encounter、战斗、休整、商店按“设计边界”分别显示结束规则。
- 缺少或失效的 Run / 活动数据不显示陈旧规则；活动切换后重新悬停应看到新活动内容。

### P2：行为验证与浏览器验收

- 覆盖 Tooltip 文本来源、条件嵌套、局部值、活动类型和失效数据；覆盖实际 Hover 锚点打开提示。
- 宽屏鼠标浏览器中至少检查条件式 Encounter 与一种非条件活动；确认提示定位可读，活动推进后不保留上一个活动的结束规则。

## 测试与验收

- [ ] Hover `map-workspace__hero-progress` 时由现有浮动 Tooltip 展示标题明确的“场景结束条件”，无须点击。
- [ ] 提示总是读取当前 MapRun / 当前活动；活动切换后显示新条件，失效或不存在的活动不显示过期内容。
- [ ] Condition、manual、battle、rest、shop 五类行为分别显示对应结束规则；Condition 的 `all` / `any` / `not` 结构和引用的 Counter / Flag 当前值准确可读。
- [ ] 不展示 UI 计算的子条件满足状态；不改变 Owner 终局、状态或活动推进行为。
- [ ] 复用既有 Popover 生命周期；不新增全量 UI render、刷新调度器或不必要 DOM 包装。
- [ ] 定向 UI 测试、类型检查、浏览器宽屏鼠标验收与文档检查均记录实际结果；未实际运行的项目不得标为通过。

## Read Set 与验证入口

- 文档：[[docs/ai/context-packs/ui-presentation]]（只读“只读数据边界 / Controller 与 Runtime 协作”及“DOM 刷新 / 交互连续性”）；[[docs/docs-829/06-wiki/50-ui/read-model-context]]；[[docs/docs-829/06-wiki/50-ui/refresh-update]]；[[docs/ai/frontend-design-project-overlay]]；[[ui-style/patterns]]。
- 源码：`src/ui/components/map/map-workspace.ts`（`renderActiveCenter`）；`src/ui/components/tooltip/tooltip.ts`（`getTooltipContent`）；`src/ui/interaction/popovers.ts`（hover 展示与锚点生命周期）；`src/arona-clicker/contracts/runtime/runtime.ts`（MapRun query / Workspace View）；`src/arona-clicker/services/map/map-run-service.ts`（Encounter 终局判定）；`src/data-services/contracts/gameplay-map-effects.ts`（条件定义）。
- 测试：`tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/components/tooltip.test.ts`、`tests/ui/popovers.test.ts`。
- 验证命令：`npx vitest run tests/ui/gameplay-b-map-workspace.test.ts tests/ui/components/tooltip.test.ts tests/ui/popovers.test.ts`；`npx tsc --noEmit`；`npm run check:docs`；`git --no-pager diff --check`；宽屏鼠标浏览器验收。

## 当前核验（2026-10-22）

- 已只读核对进度标记、MapRun Workspace ReadModel、Encounter completion 投影、Owner 终局判定、现有 Tooltip 路由及 U16 进度呈现 Receipt。
- 本 Task 仅建立施工边界；未修改产品实现，未运行产品测试或浏览器验收。

## GALHCG 影响闭环

- 发现路径：项目身份已由本轮任务上下文确认 `acprogram`；按 `hero-progress`、`MapEncounterQueryView`、`getTooltipContent`、`encounterCompletionSatisfied` 定向核对源码及相关 Receipt / 测试。
- 收尾健康管理：产品施工完成后按直接影响文件统一进行 `graph_health(check="changed", options={"path":"<相对路径>"})` 只读复核（simple）；本任务文档写作不授权编辑图、刷新或写 freshness。
- 地图维护：本 Task 不预授权；确有维护需要时遵守 [[docs/ai/galhcg-project-map]] 与 `.galhcg/agent-maintenance.md`。

## 剩余工作

- 产品实现、定向行为验证和宽屏浏览器验收均待执行。
- 完成后仍按当前机制文档维护规则判断是否需要更新 `docs/docs-829/`；Task 完成不自动替代机制页核实。

## 相关路由

- [[docs/ai/context-packs/ui-presentation]]
- [[docs/docs-829/06-wiki/50-ui/read-model-context]]
- [[docs/docs-829/06-wiki/50-ui/refresh-update]]
- [[docs/plan-work/task-0312-units/receipts/task-0312-u16-receipt]]
