# Unit 0301-U3b：Enemy 资源、HP 与 Receipt

## Goal

让 Enemy 自然行动的 Preview、实际费用、HP / resource 效果与持久 Commit Receipt 一致，并能通过当前 Save / Resume 合同恢复和重验。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`：P3 规则 | Enemy 行动顺序及资源隔离合同 |
| 源码 | `src/arona-clicker/services/map-run-service.ts`：Commit plan / Receipt restore | 原子计划、Receipt 编码与恢复验证 |
| 源码 | `src/arona-clicker/contracts/map-run.ts` | Enemy settlement 数据合同 |
| 源码 | `src/arona-clicker/runtime-game-instance.ts` / `contracts/runtime.ts` | Preview、最近 Receipt 的只读投影 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-map-runtime-integration.test.ts` | 费用、效果、Receipt 与 Runtime 一致性 |

## Completion Criteria

- [x] Enemy Actor / Enemy Team 余额在 Encounter 内独立保存和扣除，不影响我方 Team 或 PlayerCost。
- [x] Enemy 行动的费用、资源变化、HP 变化、目标和跳过原因进入 Receipt。
- [x] Preview 与提交使用同一纯结算计划；目标失效、击杀跳过、费用不足均有确定结果。
- [x] Save / Resume 保留并校验 Enemy settlement Receipt。
- [x] Runtime Workspace 提供只读 Prepared Action、Commit Preview 和最近 Receipt。

## Verification

| 项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| Owner / Receipt / cards | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts` | 通过；见 Receipt 0301-U3b |
| 类型 | `npx tsc --noEmit` | 通过；见 Receipt 0301-U3b |
| 差异 | `git diff --check` | 通过；见 Receipt 0301-U3b |
