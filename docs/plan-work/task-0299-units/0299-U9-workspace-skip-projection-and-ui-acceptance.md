# Unit 0299-U9：Skip 状态的 Workspace 投影与 UI 验收

## Goal

只读投影 MapRun Owner 的 `noLegalTarget` 结果，使 UI 明确显示已抽自然行动为何跳过、仍允许其余合法行动提交，并验收 U8 正式 Map-only 战斗样例的交互。

## State

**等待 Task 0291 U4 Workspace / Runtime View 接口稳定后施工。** Task 0291 当前头部仍标记 `approved / active — U4 Workspace 施工中`，且 U4 白名单覆盖本 Unit 需要改动的 View、Map Workspace、Controller、CSS 与 UI 测试。本 Unit 暂不改这些共享文件。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | Patch Unit 边界和冲突停止规则 |
| 文档 | docs/docs-829/05-conventions/testing.md | UI 行为 / 回归验收范围 |
| 文档 | docs/plan-work/task-0299-gameplay-b-autonomous-action-target-strategy.md：P0、P5、U7–U9 | Skip 产品合同与正式样例验收 |
| 文档 | docs/plan-work/task-0291-gameplay-b-hp-enemy-ability-item.md：U4 | 并行 Workspace 写集与当前状态 |
| 源码 | src/arona-clicker/services/gameplay-b-action-preview-resolver.ts：skipReason | Owner 只读结果来源 |
| 源码 | src/arona-clicker/services/map-run-service.ts：Commit Preview / settlement Receipt | 行动跳过和可提交条件 |
| 源码 | src/arona-clicker/runtime-game-instance.ts：getMapEncounterWorkspaceView | Runtime Preview → Workspace DTO 映射 |
| 源码 | src/ui/components/map-workspace.ts：renderActionDock、Prepared Action rows | 当前 commit / target / action 展示 |
| 测试 | tests/ui/gameplay-b-map-workspace.test.ts；tests/ui/gameplay-b-map-vertical-slice.test.ts | 行为测试与正常 Spot → Map → Battle 路径 |

## Constraints

- Runtime / Workspace 只读取 Owner 已确定的 `skipReason`、目标、费用、Receipt；不再次推导卡牌目标、不执行策略、不写 MapRun 状态。
- 有 `noLegalTarget` 的行动明确显示跳过原因，不要求选择不存在的目标；此 Skip 本身不阻止整轮 Commit，其余行动仍按 Owner Preview 的 `canCommit` 决定。
- 普通单位目标、卡牌目标、Ability / Item 和费用可用性保持 Owner 当前合同。UI 只通过现有命令处理 Swap、目标选择、Commit、Save / Resume。
- 更新由 P1 自动目标造成的旧测试断言：多合法单位 / 卡牌目标时无需先点击目标即可 Commit；不把自动目标写成玩家手动目标。
- 使用 U8 `gameplay-b:map:autonomous-target-battle` 样例完成正常 UI 路径；不加载旧 Operation、作用线或视觉目标推断。
- 施工前确认 Task 0291 U4 已结束或其负责人明确释放重叠文件；若仍冲突，停止 U9，继续不冲突单元。

## Allowed Files

- src/arona-clicker/contracts/runtime.ts
- src/arona-clicker/runtime-game-instance.ts
- src/ui/components/map-workspace.ts
- tests/ui/gameplay-b-map-workspace.test.ts
- tests/ui/gameplay-b-map-vertical-slice.test.ts
- 本 Unit 与其 Receipt；必要时更新 Task-0299 的 Patch Unit 状态。

## Explicit Non-goals

- 不改变 `noLegalTarget` 规则、费用、Action / Effect / Receipt、手牌或 RNG。
- 不重做 Workspace 布局 / 样式，不添加 UI 目标推断、第二策略 Owner 或新的 PlayerCommand。
- 不修改 Task 0291 U4 的接口文件直到共享施工冲突解除。

## Stop Conditions

- Task 0291 U4 仍在施工或需要编辑其当前正在修改的共享文件：停止本 Unit，不抢写文件。
- Runtime ReadModel 缺少 Owner 合同可表达的字段，或 UI 必须自行猜测目标 / 费用 / 可执行状态：停止并指出具体接口缺口。
- 需要新增产品行为、修改正常 Commit readiness 或视觉重塑：先修订 Task / Unit。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [ ] Workspace DTO 只读携带 Skip reason；Refresh、Hover、Focus、Save / Resume 不改变 Owner 状态。
- [ ] 无目标行动显示明确的 skipped 状态 / 原因，不显示虚构 target 选择器或虚构 Wait；它不阻止合法队友行动提交。
- [ ] 自动合法目标在 UI 首次进入即显示，首轮不操作即可提交；旧“必须点击目标”的断言改为新合同。
- [ ] 使用 U8 正式 Map-only 样例验证 2 角色 / 3 敌、多轮击杀后重选、Swap、手动目标、保存恢复与 Commit Receipt 投影。
- [ ] UI 与 Runtime 定向测试、类型检查、文档检查和差异空白检查通过；没有对 Operation、作用线或 UI 目标推断的依赖。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Workspace / UI | npx vitest run --silent tests/ui/gameplay-b-map-workspace.test.ts tests/ui/gameplay-b-map-vertical-slice.test.ts | 通过 |
| Owner / Runtime | npx vitest run --silent tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-save-resume.test.ts | 通过 |
| 类型 / 文档 / 差异 | npx tsc --noEmit；npm run check:docs；git diff --check | 通过 |

## Current Blocker Evidence

- `docs/plan-work/task-0291-gameplay-b-hp-enemy-ability-item.md` 头部仍为 `approved / active — U1–U3 已完成并经主控独立复核；U4 Workspace 施工中`。
- Task 0291 U4 写集包含 Query / Workspace View / Map Workspace / Controller / CSS 及定向 UI 测试；上述与本 Unit Runtime projection / UI 测试写集重叠。
- U7 施工后运行了 `tests/ui/gameplay-b-map-workspace.test.ts`：21 tests 中 3 failed，均为遭遇完成 / 提交状态仍期待旧的手动目标门槛；另外 2 个关系 UI 测试文件 18 tests 通过。失败详情见 Receipt 0299-U7。
- U9 尚未修改源代码或测试；共享接口解除冲突后需先重新核对 Task 0291 当前状态与文件差异，再实施本 Unit。
