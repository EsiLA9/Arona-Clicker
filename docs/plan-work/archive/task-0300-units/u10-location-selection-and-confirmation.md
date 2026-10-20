# Unit 0300-U10：地点选择会话与 Workspace Click 提交

状态：completed — 2026-10-19。

## Goal

在唯一 `MapRelationInteraction` 中暂存有效的地点选择，由 Map Workspace 现有 Click 入口提交并调用现有移动命令。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0300-gameplay-b-reusable-card-interaction.md` P6 | 选择生命周期、确认与失败行为 |
| 文档 | `docs/docs-829/05-conventions/architecture-discipline.md` | UI 暂存和 Owner 命令边界 |
| 源码 | `src/ui/workspace/map-relation-interaction.ts:constructor`, `reconcile`, `reset`, `dispose` | 唯一 Workspace 交互会话与生命周期 |
| 源码 | `src/ui/controller.ts:commitMapLocationFromFlow`, MapRelationInteraction 构造 | Controller 复核并接既有命令 |
| 源码 | `src/ui/controller-actions-operation.ts:handleMapClick` | 移除旧的直接移动入口 |
| 测试 | `tests/ui/map-relation-interaction.test.ts`, `tests/ui/gameplay-b-map-workspace.test.ts` | 输入优先级与实际移动验收 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 约 16k–30k token |
| 文档 Read Set | 2 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k token 时拆分或交回上游 |

## Optional Read Set

- `src/ui/workspace/map-dom-updates.ts`，仅当 DOM patch 生命周期测试失败时读取

## Do Not Read by Default

- `docs/plan-work/archive/**`
- 旧 Operation / EventRun UI

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| `MapRelationInteraction` 已集中处理卡牌 Hover / Focus、目标编辑、Click 与键盘输入，并在 reconcile / reset / dispose 清理瞬态状态。 | `src/ui/workspace/map-relation-interaction.ts` | 地点选择继续使用同一实例 |
| `commitMapLocationFromFlow` 复核 Run、Map、来源、Node Key、当前边条件，再调用现有 `commands.moveMap`。 | `src/ui/controller.ts:commitMapLocationFromFlow` | 不新增 Owner 命令 |
| 旧 `data-map-move-to` 分支已从事件委托移除；Workspace Click 提交由唯一 `MapRelationInteraction` 捕获。 | `src/ui/controller-actions-operation.ts:handleMapClick`, `src/ui/workspace/map-relation-interaction.ts` | 无旧直接移动入口 |

## Constraints

- 服从 Task P6、Owner 重新验证规则与 U8 的地点候选适配。
- 选中态只保存在现有交互实例；以 Run + Map + 来源地点隔离，不进 Save / Receipt。
- 选择和目标编辑互斥；旧来源重复提交不得再次移动。
- Controller 重新读取最新 View；MapRun 仍最终验证边条件和活动状态。

## Allowed Files

- `src/ui/workspace/map-relation-interaction.ts`
- `src/ui/controller.ts`
- `src/ui/controller-actions-operation.ts`
- `tests/ui/map-relation-interaction.test.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`

## Explicit Non-goals

- 不改 MapRun Owner、Runtime View、GameCommands、地图规则或 Save。
- 不建立独立地点选择状态机或额外 Hover 服务。
- 不改 P4 多目标或 P5 作用线。

## Stop Conditions

使用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件全部 6 条。特别是：若现有 `moveMap` 无法复验合法性、需要改变 Owner 规则、需要跨出本 Unit 白名单或增添持久状态，停止并上交。

## Completion Criteria

- [x] 点击可选地点只更新唯一 session 的 pending selection；改选只替换选择。
- [x] Hover / Focus 不选择；键盘 Enter / Space 与指针均可选择，且一次输入只触发一个处理方。
- [x] 只有有效选择时 Workspace Click 按钮启用；Click 仅调用一次 Controller 提交。
- [x] Controller 复核当前 Run、来源、候选和最新条件；旧来源、锁定地点、stale Run 均不移动。
- [x] 数值刷新与仍有效的同一地点副本保留选择；条目移除、候选失效、来源改变、reset / dispose 清除选择。
- [x] 成功移动后只记录一次移动并回收旧 chooser；Encounter Click 不串成移动或战斗 Commit。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `node node_modules/vitest/vitest.mjs run tests/ui/map-relation-interaction.test.ts tests/ui/gameplay-b-map-workspace.test.ts tests/ui/map-flow-adapter.test.ts tests/ui/card-host.test.ts tests/ui/map-location-card-render.test.ts --maxWorkers=1 --minWorkers=1 --reporter=dot --silent` | 通过，共 71 项 |
| 类型检查 | `node node_modules/typescript/bin/tsc --noEmit` | 通过 |
| 架构检查 | `node scripts/check-architecture-boundaries.mjs` | 通过 |
| 差异检查 | `git diff --check` | 通过 |
