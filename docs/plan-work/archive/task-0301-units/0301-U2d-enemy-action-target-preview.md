# Unit 0301-U2d：Enemy 自然行动与目标预览

## Goal

让 Runtime 使用现有 Gameplay B Action Preview 规则，为 Enemy Hand[0] 生成只读自然行动与合法自动目标。双方在一轮内看到一致的当前准备，不增加 Enemy 的玩家指令或独立策略状态。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`：P2 / P4 | 已冻结的准备与只读控制权 |
| 源码 | `src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`：resolveGameplayBActionPreview | Character 目标偏好与预览的现有实现 |
| 源码 | `src/arona-clicker/services/gameplay-b-target-selection.ts`：selectGameplayBUnitTarget | 目标偏好及稳定平局规则 |
| 源码 | `src/arona-clicker/services/map-card-catalog.ts` | 当前轮真实卡牌目标候选目录 |
| 源码 | `src/arona-clicker/runtime-game-instance.ts` / `contracts/runtime.ts` | Runtime 只读 Workspace 投影 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts` 与 Gameplay B runtime view tests | 目标、Action 只读投影与随机稳定性 |

## Constraints

- Enemy 只使用自然 Hand[0]；不接受 Swap、PlayerCommand、手动目标或 PlayerCost。
- Enemy target `partyCharacter` 从存活玩家角色中选；`enemy` 从存活 Enemy roster 中选；`self` 只指当前 Enemy。
- 目标偏好沿用稳定顺序、最低 HP 比例、最高损失 HP 比例；card 目标在双方 Hands 完成后用真实卡牌实例及现有稳定卡牌顺序解析。
- Enemy Actor / Team 资源用于验证其当前 Hand；不能查询或消耗玩家侧余额。
- 默认目标只从当前 snapshot 稳定推导，不写入额外随机结果。没有合法目标时明确标为不可执行 / 可安全跳过。
- Runtime view 暴露 Enemy Hand / 行动 / 目标供只读 UI 使用，目标逻辑不落在 UI。

## Allowed Files

- `src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`
- `src/arona-clicker/services/map-card-catalog.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `tests/engine/gameplay-b-map-run.test.ts`
- 相关 Gameplay B Runtime view 测试
- Task 0301 与本 Unit / Receipt

## Completion Criteria

- [ ] Preview 返回每名 Enemy 的只读 Hand、自然 Action、合法目标和自动选定目标。
- [ ] 三种单位 target preference 在双方队列上按正确 HP 与稳定 roster 顺序计算。
- [ ] Enemy Action card target 在双方 Hand 确定后从真实合法卡牌中稳定选择。
- [ ] Preview 不修改 snapshot / RNG；重复调用结果相同；Enemy 没有玩家指令入口。
- [ ] Workspace Runtime view 投影完整只读 Enemy 行动信息。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Runtime / MapRun | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts` | 通过 |
| Runtime Workspace | 运行对应 Gameplay B Map workspace / runtime integration tests | 通过 |
| 类型 | `npx tsc --noEmit` | 通过 |
| 差异 | `git diff --check` | 无空白错误 |
