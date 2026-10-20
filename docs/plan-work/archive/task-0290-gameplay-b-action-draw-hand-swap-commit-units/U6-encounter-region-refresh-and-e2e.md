# U6：Encounter 区域局部刷新与端到端验收

**状态：complete — 实现、回归与独立复核通过**

## 目标

将 C3 高频的 Hand、Target、Override 和 Commit 更新限制在 Map Workspace 右侧 Encounter region；保留地图导航、当前 Node、Workspace route、滚动和焦点。随后从正常 Datapack / Registry / Resolver / Spot 入口跑通真实行动回合。

## 允许改动文件

- `src/ui/controller.ts`
- `src/ui/components/map-workspace.ts`
- `tests/ui/gameplay-b-map-vertical-slice.test.ts`
- `ui-style/patterns.md`

若需修改全局 UI 更新协议或其它页面，先交回总控拆分。不得静默退回整张 Map Workspace 重绘。

## Read Set

- Task 0290 UI 合同与 U5 界面实现。
- `docs/docs-829/06-wiki/50-ui/refresh-update.md`、`workspace-routing.md`。
- `docs/ai/frontend-design-project-overlay.md` 与 `ui-style/00-index.md`、`ui-style/patterns.md`。
- `frontend-design` skill 与 [[ui-style/patterns]] 的 Map / Workspace 更新模式。
- `controller.ts` 中 `refreshMapWorkspaceRegion()`、Map Workspace `region` 请求和现有 UI refresh continuity 测试。
- `tests/ui/gameplay-b-map-vertical-slice.test.ts` 的正常 Datapack → Spot → Map 测试入口。

## 已核实的现状

Map Workspace 目前由一个 `[data-map-workspace-region]` 包住三列；`refreshMapWorkspaceRegion()` 当前替换整个 Map 区域。每轮行动改动会频繁发生，继续整体替换会重建地图导航和当前 Node，违反本 Task 的更新边界。

## 约束

- 在 Map Workspace 右栏 Encounter 内容内部增加稳定的 `[data-map-encounter-region]`；外层 Map route、三栏 Frame、左侧节点列表和中间当前 Node 保持挂载。
- Map 行动命令只请求 encounter-region update；Controller 从当前 detached View 渲染同一 runId 的 Encounter 内容并替换该子区域。只有 Encounter 子区域缺失、runId 不匹配或 route 已结束时才能退回明示的 Map Workspace 恢复刷新。
- 事件委托绑定在稳定宿主；替换 Encounter region 前处理区域内 anchored overlay。更新后按稳定 actorId/actionId 恢复有效焦点，不恢复已失效目标；维持 Encounter region 内滚动位置。
- 真实入口必须使用正式 Datapack、Registry、Map Resolver、Spot Entry、Controller 和 MapRun Owner；不得直接 new MapRun 代替入口验收。
- End-to-end 样例必须证明：至少两名角色抽牌 → 一次免费 Swap → 一次 PlayerCost Command 失败或成功路径 → 一次成功整轮 Commit 与资源效果 → Encounter 完成并回到原 Node。既有 C1/C2 入口和成功终态不能回退。

## 完成条件

- [x] 每次行动区域刷新后左 / 中列 DOM 节点身份不变，地图当前位置、焦点与滚动稳定。
- [x] Encounter 操作后新增 Map Workspace 之外的 route / shell 重绘数为零；缺失子区域的恢复路径有测试。
- [x] 玩家可由正常 Spot 入口操作新 Encounter，并看到本轮行动和资源效果。
- [x] 失败提交 / 过期 Preview 不刷新抽牌；成功 Commit 只刷新一次并出现下一轮 Hand。
- [x] 清除 Override 或 Commit 后，如果原控件失效或消失，焦点落到 Encounter 标题或当前遭遇内下一个有效行动控件，不跳回地图中央地点标题。
- [x] C1 / C2 Map 测试仍通过；独立审查确认真实入口与刷新范围，无阻塞发现。
- [x] `ui-style/patterns.md` 更新当前 Map / Encounter Workspace 的已验证复用模式与局部刷新边界。
- [x] Receipt 记录端到端路径、稳定 DOM 区域与测试结果。

浏览器验收未执行：computer-use skill 的 Edge 窗口激活连续两次失败，按其恢复规程停止 Windows UI 操作。正式 Spot 入口的自动化 UI 竖切片、局部刷新测试、类型检查和独立源码审查均通过。

