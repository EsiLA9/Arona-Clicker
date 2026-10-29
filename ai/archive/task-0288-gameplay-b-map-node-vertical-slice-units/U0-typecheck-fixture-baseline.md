# Unit 0288-U0：补齐既有 UI 测试的 Operation 入口 fixture

## Goal
修复两条现有 Operation UI 测试的编译与入口 fixture 前置：每份测试都覆盖 Gameplay B Carousel 与 Strategy Park 两种入口，因此两边的入口 Spot 都要具备已拥有状态；手动 Workspace fixture 也须补齐返回上下文，使全仓类型检查可用。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 源码 | `src/ui/components/app-shell.ts` 中 `OperationWorkspaceState` | 确认必填字段 |
| 源码 | `src/ui/controller.ts` 的 `openOperationWorkspace()` | 测试应走正式入口 |
| 源码 | `src/arona-clicker/services/spot-functionality.ts` 的 `definitionsOf()` | 确认 Spot 功能的持有门槛 |
| 源码 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`、`gameplay-b-strategy-park.ts` | 样例 Spot ID |
| 测试 | `tests/ui/gameplay-b-operation-controller.test.ts` | 第一处旧 fixture |
| 测试 | `tests/ui/gameplay-b-strategy-park-map.test.ts` | 第二处旧 fixture |

## Context Budget
- 目标 5k–12k tokens；不读历史文档；最多修改 2 个文件 / 120 行净改动。

## Confirmed Facts
| 事实 | 依据 |
|---|---|
| `OperationWorkspaceState.returnContext` 在当前 HEAD 已是必填字段。 | `src/ui/components/app-shell.ts`，`git show HEAD:` 复核 |
| 两条测试绕开正式入口，直接写入 `{ type: 'operation', runId }`。 | 两个测试报错位置 |
| Controller 的 `openOperationWorkspace(runId)` 会建立返回上下文。 | `src/ui/controller.ts` |
| `SpotFunctionalitySystem.definitionsOf()` 只为已拥有 Spot 或显式 `requiresOwned: false` 的功能返回定义。 | `src/arona-clicker/services/spot-functionality.ts` |
| 两个测试分别使用 Carousel 与 Strategy Park 入口；缺少任一 Spot 都会使对应入口用例缺按钮。 | 两个测试文件的辅助函数与入口测试 |

## Constraints
- 仅修复测试 fixture 前置；不把返回上下文改成可选，不改变 Spot 拥有规则或其他生产行为。
- 保持原测试的路由与渲染流程，只给手动构造的 Workspace fixture 增加 `returnContext: controller.workspaceLocation()`；若该形状仍不能覆盖当前类型，再停报，不强行改走不同的 Controller 路由流程。
- 在两个测试辅助函数中都通过 `game.mutations.setSpotLevel()` 取得 Carousel `GAMEPLAY_B_OPERATION_SPOT_ID` 与 Park `gameplay-b-strategy-park:spot:park_terminal`；不修改 Datapack Spot 定义。
- 不修复与这两项 fixture 前置无关的旧 Operation UI 断言。若补齐所有入口 Spot 与 Workspace 字段后仍有这类失败，记录失败表现和源码原因，交由独立 Operation UI 任务处理；不得据此改生产代码或旧玩法行为。

## Allowed Files
- `tests/ui/gameplay-b-operation-controller.test.ts`
- `tests/ui/gameplay-b-strategy-park-map.test.ts`

## Explicit Non-goals
- Operation Workspace 生产代码、Controller、Workspace 路由或样式改动。
- 修改 U1 Map 数据合同或全仓 TypeScript 配置。

## Stop Conditions
1. 两处 fixture 必须改动测试以外的文件才能修复。
2. 正式 `openOperationWorkspace()` 入口使测试出现与其预期无关的行为差异。
3. 补齐两个入口 Spot 与 Workspace 前置后，`npx tsc --noEmit` 仍报告这两处 fixture 类型错误，或定向测试出现可归因于 U0 变更的新失败。

## Completion Criteria
- [ ] 两个测试辅助函数都为 Carousel 与 Strategy Park 入口提供已拥有状态。
- [ ] 两个手动构造的 Workspace fixture 都含有合法 `returnContext`。
- [ ] `npx tsc --noEmit` 不再报告这两处缺少 `returnContext`。
- [ ] 定向测试运行结果与非 U0 失败原因已记录；这两份旧 Operation UI suite 不作为 Map 功能验收。

## Verification
| 项 | 命令 | 期望 |
|---|---|---|
| 定向测试 | `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/gameplay-b-strategy-park-map.test.ts` | 记录结果；fixture 修复应消除入口 Spot 不存在导致的失败，其他旧 Operation UI 断言不在 U0 修复范围 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误，且不再报告两个 fixture 缺少 `returnContext` |
