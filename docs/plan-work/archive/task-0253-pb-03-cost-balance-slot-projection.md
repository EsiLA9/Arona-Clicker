# Task：PB-03 — 按 OperationView 当前余额显示 Cost 槽

状态：completed — Cost 视图按当前余额显示；余额 6 可见，高余额使用紧凑数字显示。
> Goal Owner 统一裁定（2026-10-08）：PB-03 的施工默认规则见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；其中规则覆盖本 Task 在该裁定前写成“待定 / 待确认”的历史措辞。仅符合总裁定列出的升级条件时暂停。
> 实施状态（2026-10-08）：已按裁定完成；实现和自动化验收见“实施结案”。

## 目标

让 Cost 数字和余额槽准确呈现 Runtime 已投影的当前 `playerCost`。在余额为 6 时显示 6 个可用槽；消费 Cost 后即时减少；跨地点时能与既有入场增量及离场携带截断相符。

本 Task 只修显示，不更改 PlayerCost 产生、扣除或离场携带规则。

## 设计边界

- 本 Task 包含：移除 UI 的固定五格假设；余额数值和槽位均从只读 `OperationView.playerCost` 渲染；保持现有 Cost 预览、入场记录和路线历史可核对。
- 明确非目标：新增场景容量字段、增加通用 Resource/Cost 系统、更改战斗资源费或 SceneAction 费用、改变余额上限、改变手牌费用或路线截断行为。
- 已裁定来源：[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]]。`maxCarryCost` 是来源地点离场时的截断值；它不能作为“当前能持有几格”的替代值。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| UI 槽数被定为 5，按槽索引对比当前余额。 | `src/ui/components/operation-workspace.ts`：模块常量 `MAX_COST_SLOTS = 5`，`renderMain()` 以 `Array.from({ length: MAX_COST_SLOTS })` 生成槽，并以 `index < view.playerCost` 标记当前余额。 | 当 View 余额大于 5 时，数字与槽位分离；应按当前余额或有界可见表示显示，不由旧样例数字决定。 |
| 运行时允许超过 5 的余额，Strategy Park 启动即可形成 6。 | `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`：`eventDefinition.playerRouteState.playerCost = 5`；West Gate `costGain: 1, maxCarryCost: 5`。`operation-runtime-service.ts` 的 `start()` 在构造 Run 后调用 `applyLocationEntryCost()`，后者先算 `balanceBefore + gain`。 | 正常点击策略园入口后，余额 6 是实际定义产生的结果，不是人工改 View 的特例。 |
| 离场截断在转场时执行，位置/职责不同于当前余额。 | `operation-runtime-service.ts`：`transitionRoute()` 计算 `playerCostAfterCarryLimit = Math.min(playerCostBeforeExit, sourceLocation.maxCarryCost)`，随后切换地点，再执行目标 `costGain`。`operation-view-projector.ts` 将当前 `playerCost` 和当前地点 `maxCarryCost` 分别投影。 | 显示以 `playerCost` 为余额；不得用 `maxCarryCost` 截断当前槽或改 Runtime 数值。 |
| View 当前已有 Cost 数值/预览和历史记录。 | `src/arona-clicker/contracts/operation-view.ts`：`playerCost`、`maxCarryCost`、`locationEntryCostHistory`、`routeHistory`；`operation-view.md` 说明 Cost 是只读 View 投影。 | 若 Task 只改槽 DOM，不需增加运行状态字段或 Data Services 合同。 |
| 当前契约不存在独立 scene capacity。 | `src/data-services/contracts/operation.ts`：`OperationPlayerRouteStateDef.playerCost`，Location 有 `costGain` 与 `maxCarryCost`，没有 capacity 字段；`tests/engine/operation-runtime-service.test.ts` 验证初始余额可超过 5，且可更新到 50。 | Roadmap 的“场景容量”当作待裁定词，不擅自添加第三个上限或新字段。 |

## 责任迁移与不迁移

- 迁移：槽位数量的表现责任归 UI 按只读 View 的当前余额绘制；预览组件继续显示选择费用与余额。
- 不迁移：`playerCost` 写入仍归 EventRun/`OperationRuntimeService`；费用核对和离场截断继续使用 Runtime 原规则；UI 不维护另一份成本余额。

## 施工切片

### P0：删除固定槽数并确定零余额表现

- `renderMain()` 对正余额生成同数槽；余额为 0 时保留数字 0 与清晰的空/耗尽状态，不生成负数或历史最大容量的幻影槽。
- 不从 `maxCarryCost` 推导余额槽数量；若设计希望显示上限，先另行确定上限字段与语义。

### P1：核验策略园入场、消耗和转场

- 保留数字、预览、槽位在局部更新/全量重建后的同步。
- 不修改 `OperationRuntimeService`；如果现有 View 已能提供验收所需信息，不增加 Engine 测试设施。

## 测试与验收

- [ ] 在夏莱办公室点击“开始策略园试玩”；西门新 Run 的 Cost 余额为 6，坞站展示 `Cost 6` 和 6 个可用槽。
- [ ] 完成免费的西门简报，查看路线履历：离开西门记录应呈现既有的 `6 → 5` 携带截断；进入连廊记录 `5 + 1 = 6`；余额仍为 6 个槽。该步确认 UI 按 Runtime View 呈现数值，而不把离场上限当余额。
- [ ] 到有付费场景行动的地点，选入一项费用行动并提交；数字和槽减少到实际剩余余额，不必把可用 Cost 花完。
- [ ] 旧旋转木马起始余额 5 仍显示 5 个槽；普通 View 余额 0 与大于 5 的状态各有清楚表现。
- [ ] 更新 `tests/ui/operation-workspace-view.test.ts` 覆盖 0、5、6；在 `tests/ui/gameplay-b-operation-controller.test.ts` 加入策略园启动和提交后的可见回归。若没有 Runtime 规则变化，不新增 Runtime 算法测试。
- [ ] Edge 实际点击策略园入口、简报、路线与一次付费场景行动；不以 HTML 槽数断言替代实际显示验收。

建议定向命令：`npx vitest run tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-controller.test.ts tests/engine/operation-runtime-service.test.ts`。最后一个既有 Engine 测试用于确认显示 Task 没有意外改变费用/截断规则，不等同于要求新增测试。

## Read Set

- `docs/docs-829/00-INDEX.md`、`docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/05-conventions/testing.md`
- `docs/ai/context-packs/ui-presentation.md`、`docs/ai/PROJECT-CONSTITUTION.md`
- `src/arona-clicker/contracts/operation-view.ts`、`src/data-services/contracts/operation.ts`、`src/arona-clicker/services/operation-runtime-service.ts`、`src/arona-clicker/services/operation-view-projector.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`、`src/ui/components/operation-workspace.ts`
- `tests/ui/operation-workspace-view.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`、`tests/engine/operation-runtime-service.test.ts`

## 明确非目标

- 不增加 `sceneCapacity`、`maxPlayerCost` 或其它新 schema/state 字段。
- 不改任何入场 `costGain`、地点 `maxCarryCost`、手牌/场景行动费用、扣费顺序或路线规则。
- 不把旧的“5 格”扩大成某个固定全局上限；UI 应呈现余额本身。
- 不通过渲染新标签替代 Runtime View；不让 UI 持有 mutable EventRun。

## 实施结案（2026-10-08）

- Cost 标记与数字按只读 View 的 playerCost 余额投影；余额 6 显示六个可用标记，较高余额使用准确数字。maxCarryCost 仍只表达离场限制，未引入容量字段。
- 定向回归：operation-workspace-view 覆盖 6 点余额与高余额显示。整组 9 文件定向套件共 133 项通过；类型检查通过。
- GALHCG：Task 已移至 docs/plan-work/archive/；迁移后路径映射已复核。
## 相关路由

[[draft-0251-gameplay-b-atomic-scenes-phase-i-v1-corrections]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]
