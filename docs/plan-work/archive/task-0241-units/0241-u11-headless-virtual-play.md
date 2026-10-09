# Unit 0241-U11：Headless 虚拟游玩与人工决策脚本

## Goal

为 U10 的完整 Strategy Park 样例提供可在无浏览器环境运行的、可编辑人手决策输入的 deterministic headless 回放；输出便于对标原型 BDemo 的 Context、Pool、Hand、选择/费用/目标、Resolution、路线与结果 Transcript。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md` E0 / D1 / D2 | 虚拟游玩与人手验收目标 |
| Receipt | `docs/plan-work/archive/task-0241-units/receipts/0241-e1-operation-runtime-and-galhcg.md` | facade/View/Hand 可用入口和边界 |
| Content Unit | `docs/plan-work/archive/task-0241-units/0241-u10-strategy-park-sample.md` | 新事件 ID、实际内容路线和终局 |
| Mechanism | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 受控 OperationEntry 命令边界 |
| Tests | `tests/engine/gameplay-b-scene-action-sample.test.ts`、`tests/engine/gameplay-b-route-sample.test.ts` | 真实 Runtime 回放模式 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–22k tokens |
| Read Set | Task/Receipt/Operation Runtime 与已有样例回放测试 |
| 超预算处理 | 采用一个 Vitest 驱动的可编辑决策脚本，不新增运行器依赖 |

## Constraints

- 不调用 UI 或 Browser；不修改 Datapack Editor/游戏 UI/Engine。
- 当前根项目只有 Vitest+TS，没有现成可交互 Operation CLI；本 Unit 产物诚实定位为测试驱动虚拟游玩脚本，不宣传为 Runtime CLI。
- 回放必须经真实 `Registry` / `GameInstance` / `OperationEntryFacade`，不能以 resolver mock 代替全流程。
- 决策记录应从测试文件顶部可编辑的 scenario command/script 驱动；固定 Seed、支持重复运行；Transcript 每阶段列 Context、命中池/候选过滤原因/权重、当前 Hand、提交行动、目标/费用、Resolution、SceneAction/路线与最终结果。
- 至少能支撑人手核查对标表每个复制的核心阶段；动态加入/动态临时 Pool 的缺口按 D1 对标表展示为未复制项。
- 测试输出无需成为长期快照文本；但运行步骤必须可由 Task Owner 修改命令列表后重新运行。

## Allowed Files

- `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts`（new）
- `docs/plan-work/archive/task-0241-units/receipts/0241-d2-headless-virtual-play.md`（new）

## Explicit Non-goals

- U10 Datapack/玩法内容路径。
- Browser、Terminal runtime framework、UI 或 Editor 流程。
- 修改 E1 Engine 行为或改写 BDemo 原型规则。

## Stop Conditions

使用 PROJECT-CONSTITUTION §停止条件全部 6 条；若现有 Run facade 无法覆盖手工验收，则记录最小复现和推荐接口交 Task Owner，不创建新的 runtime 命令。

## Completion Criteria

- [x] 测试可通过单条命令执行并启动 U10 的标准 Run；决策数据有清楚的人手编辑点。
- [x] Transcript 解释 Strategy/Pool/Context/Hand/action/target/cost/Resolution 与路线结果，并说明 Negotiation 实际由 Location SceneAction wrapper 提交。
- [x] 相同 seed 与决策输入重放一致；脚本覆盖战斗、位置变化、Negotiation、路线分支与终局。
- [x] D2 Receipt 附实际运行命令、结果摘要和人工下一步验收说明。

## Verification

- `npx vitest run tests/engine/gameplay-b-strategy-park-virtual-play.test.ts --reporter=verbose`
- `npx tsc --noEmit`
- `git diff --check`

## Receipt

`docs/plan-work/archive/task-0241-units/receipts/0241-d2-headless-virtual-play.md`
