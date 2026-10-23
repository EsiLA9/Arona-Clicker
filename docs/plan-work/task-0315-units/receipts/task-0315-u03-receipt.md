# Task 0315 U03 Receipt：Owner 安装与 Damage / Heal Receipt

## 结果

- MapRun Owner 现在把 Planner 的 `damage` / `heal` Trace 与原 `hpChange` 一样投影为实际 signed `hpChanges`，包含 0 delta 事件。
- 新增 Preview 只读用例：同一 primary 按 heal→damage 顺序规划，Trace 保留操作身份和实际变化，settlement 记录真实变化，Owner 快照不变。
- 新增 Commit / replay 用例：成功 Commit 安装 HP 结果；Receipt Trace 区分 `heal` 与 `damage` 并保留 requested amount / actual delta；相同 requestId 重放不重复安装。
- 扩充既有整轮费用冲突用例，使其在后续 PlayerCommand 同时规划 damage 与资源变化；费用预检失败后，整轮 MapRun / PlayerState / stats 未写入，敌方 HP 保持原值。
- 未改 Save/Resume Receipt validator、旧 phase 调度路径、Schema、内容或 effect summary。

## 修改文件

- `src/arona-clicker/services/map/map-run-service.ts`
- `tests/engine/gameplay-b-effect-program.test.ts`
- `tests/engine/gameplay-b-effect-program-commit.test.ts`
- `docs/plan-work/task-0315-units/task-0315-u03-owner-installation.md`

## 验证

- 首次执行 `npx vitest run tests/engine/gameplay-b-effect-program.test.ts tests/engine/gameplay-b-effect-program-commit.test.ts`：18 项通过、1 项失败；失败是新断言从 MapRun 根对象读取 Enemy HP，实际字段属于 `activeEncounter.enemies`。
- 修正断言读取路径后，重跑同一命令：通过，2 个测试文件、19 项测试。
- `git --no-pager diff --check`（U03 白名单）：通过。

## 边界

- `contracts/map-run.ts` 在本 Unit 无需改动；其 `effectTrace` 已通过 `MapEffectTraceEntry` 使用新的 Trace union，Owner 事件留在 `hpChanges` signed delta 中。
- U03b Receipt 校验仍待后续；没有改 restore / Receipt validator 分支。
