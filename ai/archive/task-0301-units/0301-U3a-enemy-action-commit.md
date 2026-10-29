# Unit 0301-U3a：Enemy Action 原子结算

## Goal

把每名 Enemy 的 Hand[0] 放进现有完整回合 Commit 计划，按同一 HP、资源、目标和回执规则执行；Enemy 仍只读，不产生玩家命令。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | Task 0301：P3 与冻结的 Commit 顺序 | Enemy 在玩家行动之后执行，不能更改回合所有权 |
| 源码 | `src/arona-clicker/services/map-run-service.ts`：resolveEncounterCommitPlan / prepareEncounterRoundCommit | 现有纯计划、事务与安装边界 |
| 源码 | `src/arona-clicker/services/gameplay-b-action-preview-resolver.ts` | Enemy 已准备 Action / Target 的共同 Preview |
| 源码 | `src/arona-clicker/services/map-card-effects.ts` | Action 卡目标和 sCost 效果顺序 |
| 源码 | `src/arona-clicker/contracts/map-run.ts` | Commit Preview / Receipt 合同 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-map-cards.test.ts` | 战斗、资源、目标重选与保存恢复回归 |

## Constraints

- 结算顺序固定为 Character → Ability / Item → Enemy roster；玩家 HP / Enemy HP 在各阶段内按顺序更新。
- Enemy 只执行当前 Hand[0]，不因没有 Action pool 而恢复固定 damage 回击。
- Enemy 在实际行动前已倒下则免费跳过；自动目标失效时沿用当前 Action preference 在剩余合法对象重选；没有合法目标或费用不足时免费跳过。
- Enemy Actor / Enemy Team 费用与变化保存在 Encounter-local 余额；不能从 PlayerCost 或我方 Team 支付。显式目标 Actor effect 可以改变指定一方的 Actor 资源。
- Enemy 卡牌目标通过真实卡牌目录核验；Character 行动前的卡效果可影响当轮 Enemy 行动，Enemy 只能影响之后按 roster 执行的 Enemy 行动。
- Preview、Commit、Receipt 和 Save / Resume 共用同一确定性结算结果；未改变抽卡或 Run Owner。

## Allowed Files

- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/services/map-run-service.ts`
- `src/arona-clicker/services/map-card-effects.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `tests/engine/gameplay-b-map-run.test.ts`
- `tests/engine/gameplay-b-map-cards.test.ts`
- `tests/engine/gameplay-b-map-runtime-integration.test.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- Task 0301 与本 Unit / Receipt

## Completion Criteria

- [x] 完整 Commit plan 按 Enemy roster 执行自然行动并确定终局。
- [x] 自动目标重选、目标消失免费跳过、Enemy 已死免费跳过与费用不足免费跳过均有行为证据。
- [x] Enemy Actor / Team cost 与 effect 的 Preview、Commit、Snapshot、Receipt 一致且资源池隔离。
- [x] Character / Enemy card target 的当前行动费用效果按执行先后顺序生效。
- [x] Enemy 行动与真实效果出现在 Commit Preview 和持久 Receipt；Save / Resume 可重验 Receipt。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Owner / card rules | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts` | 通过 |
| Workspace | `npx vitest run --silent tests/ui/gameplay-b-map-workspace.test.ts tests/ui/map-flow-adapter.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 通过 |
| 架构 | `npm run check:architecture` | 通过 |
| 差异 | `git diff --check` | 无空白错误 |

## 结果

- P3 的纯计划、顺序执行、目标失效修复、免费跳过、Enemy Actor / Team 扣费与资源效果、HP 变化、终局判定已接入现有 MapRun 原子 Commit。
- CommitPreview 与持久 Receipt 来自相同计划；Save / Resume 对 Enemy 行动回执及其资源和 HP 变化进行校验。
- 固定 `damage` 字段已在 U5b 随正式内容迁移完成而删除。
- 测试证据由 U3b Receipt 记录。
