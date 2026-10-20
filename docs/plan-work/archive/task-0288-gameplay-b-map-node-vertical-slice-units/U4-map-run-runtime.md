# Unit 0288-U4：建立 MapRun 最小状态机

## Goal
建立 MapRun 状态模型与独立运行服务，支持开始地图、相邻移动、自动进入未完成 Encounter、成功完成后回到原 Node 以及到达出口结束；本 Unit 不接 GameInstance 或 UI。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 文档 | `docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice.md`、`docs/plan-work/archive/draft-0287-gameplay-b-phase-b-contract.md` | 固定状态边界 |
| 文档 | `docs/docs-829/05-conventions/architecture-discipline.md` | 状态写入与服务边界 |
| 源码 | U3 实现的 Map Resolver 只读接口 | MapRun 状态机只依赖解析后的 Map 定义 |
| 源码 | `src/arona-clicker/services/operation-runtime-service.ts` | 仅参考单一状态 Owner 的相关模式 |
| 测试 | `tests/engine/gameplay-b-event-runtime-integration.test.ts` | Runtime 行为测试结构 |

## Context Budget
- 目标 8k–18k tokens；历史文档 0 篇；最多 3 个文件 / 450 行净改动。

## Confirmed Facts
| 事实 | 依据 |
|---|---|
| Map Resolver 在 U3 提供从正式 Registry 解析 Map 的只读入口。 | `contracts/map-content-resolver.ts` |

## Constraints
- 本 Unit 仅实现单一 MapRun 状态机；GameInstance 所有权和 Commands 接线由 U5 完成。
- Run 内每项状态遵守三种生命周期；C1a 不创建未使用的 Hand / PlayerCost / Actor 战斗状态。
- Movement 校验真实有向邻接；遭遇活动时禁止移动；拒绝命令保持状态完全不变。
- 只有当前活动 Encounter 声明 `completion.kind === "manual"` 时，才允许其完成命令成功；成功后标记节点完成并清除局部状态，不自动移动到下一 Node。
- 服务从 Map Resolver 读取冻结定义，拒绝命令不变更状态；不写 PlayerState。

## Allowed Files
- New file: src/arona-clicker/contracts/map-run.ts
- New file: src/arona-clicker/services/map-run-service.ts
- New file: tests/engine/gameplay-b-map-run.test.ts

## Explicit Non-goals
- GameInstance / GameCommands 接线、Save / Resume、UI、Hand / Swap、战斗、奖励写回、C5 旧系统退役。

## Stop Conditions
1. 需要修改白名单外文件、绕过 StateMutationService 或另建可写位置副本。
2. Encounter 起点触发规则、出口规则与冻结合同不一致。
3. 超过 3 个文件 / 450 行，或读取白名单外超过 2 个实现文件。
4. 必需 Runtime 验证不可运行或失败且原因不明。

## Completion Criteria
- [ ] MapRun 通过正式 Map Resolver 开始，固定 Map ID / Run ID / 起点与节点进度。
- [ ] 只能移动到实际相邻节点；失败命令不改任何状态。
- [ ] 移至 B 自动开启最简 Encounter；遭遇期间移动命令失败且状态不变。
- [ ] 合法完成后回到 B、记录完成；移至 C 后 MapRun 成功终止。
- [ ] 服务拒绝创建第二个并行 MapRun。

## Verification
| 项 | 命令 | 期望 |
|---|---|---|
| 定向测试 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
