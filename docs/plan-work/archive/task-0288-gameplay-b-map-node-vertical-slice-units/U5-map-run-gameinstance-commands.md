# Unit 0288-U5：接入 GameInstance 与正式命令面

## Goal
将 U4 MapRun 状态机挂入 GameInstance，增加只读 Runtime 查询与正式 GameCommands，使应用层能够合法开始、移动及结束 Encounter。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 文档 | `docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice.md`、`docs/plan-work/archive/draft-0287-gameplay-b-phase-b-contract.md` | 冻结状态与命令语义 |
| 文档 | `docs/docs-829/05-conventions/architecture-discipline.md` | Controller / Commands / Owner 边界 |
| 源码 | `src/arona-clicker/contracts/runtime.ts` | ReadModel 与 Commands 契约 |
| 源码 | `src/arona-clicker/runtime-game-instance.ts` | Owner 生命周期与 facade 组装 |
| 源码 | `src/arona-clicker/runtime-commands.ts` | GameCommands 实际适配器 |
| 测试 | `tests/engine/gameplay-b-event-runtime-integration.test.ts` | GameInstance 命令集成结构 |

## Context Budget
- 目标 10k–22k tokens；历史文档 0 篇；最多 4 个文件 / 450 行净改动。

## Confirmed Facts
| 事实 | 依据 |
|---|---|
| GameReadModel 与 GameCommands 分别定义查询和写入面。 | `contracts/runtime.ts` |
| `createGameCommands()` 负责把正式写命令接到 GameInstance 服务。 | `runtime-commands.ts` |
| GameInstance 当前拥有 Operation Runtime Owner 生命周期。 | `runtime-game-instance.ts` |

## Constraints
- 复用 U4 MapRunService；不得在 GameInstance、Controller、View 创建第二份当前位置。
- ReadModel 返回 detached / readonly MapRun 投影；开始/移动/完成仅通过 GameCommands。
- GameInstance init/load/reset/dispose 生命周期按既有 Owner 规则清理易失状态；存档行为留给 U6。
- 完成请求仅由 Runtime 根据当前活动 Encounter 定义判定；调用方不能提交任意 success/failure 结果。

## Allowed Files
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `src/arona-clicker/runtime-commands.ts`
- New file: tests/engine/gameplay-b-map-runtime-integration.test.ts

## Explicit Non-goals
- Save / Resume、UI、Spot Map Entry、状态写入 PlayerState、旧 OperationRun 政策或 C5 退役。

## Stop Conditions
1. 需要修改白名单外文件、绕过正式 GameCommands 或新建可写 UI / PlayerState 副本。
2. U4 Runtime API 无法通过冻结的 Resolver / MapRun 合同接线。
3. 超过 4 个文件 / 450 行或需读取 Read Set 外超过 2 个实现文件。
4. 集成测试或类型检查失败且原因无法定位。

## Completion Criteria
- [ ] GameInstance 只持有一个 MapRunService owner，并按既有生命周期管理。
- [ ] 正式 ReadModel 可观察 detached MapRun 与当前 Encounter；没有活动 Run 时为明确空值。
- [ ] GameCommands 提供开始 Map、移动到相邻 Node、完成当前手动 Encounter 的窄命令。
- [ ] 每个命令委托给 U4 服务并将非法请求原子拒绝。
- [ ] Engine 集成测试通过 GameInstance / GameCommands 覆盖移动、遭遇锁定及回图。

## Verification
| 项 | 命令 | 期望 |
|---|---|---|
| 定向测试 | `npx vitest run tests/engine/gameplay-b-map-runtime-integration.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
