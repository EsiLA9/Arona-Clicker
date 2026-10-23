# Task 0316 U04 Receipt：Owner 接线与投影

状态：complete

## 交付

- MapRun 将实际 Party roster、Encounter Enemy 定义顺序和 Round 传给 Planner；Owner 继续按现有 source schedule 使用 detached HP / locals 计划并通过原 HP settlement 安装。
- TargetSet 和每次命中进入 Preview / Receipt Trace；作者声明与 Preview 文案展示集合侧别、排序、数量及每名目标实际 HP 变化。
- 修复检查中暴露的 cost-only Action 账本空路径：无 `effectProgram` 的合法 Action 可有普通成本；Actorless / Enemy 费用探测继续走空账本。
- Receipt restore 的 HP projection 现在允许 E2 集合效果命中多个 roster 单位，具体身份仍由回执重放复核。

## 验证

- `tests/engine/gameplay-b-effect-program-commit.test.ts`：12/12；含 E2 Value 运行时错误整轮拒绝、Owner 状态不变。
- `tests/ui/gameplay-b-effect-workspace.test.ts`：1/1。
- `tests/ui/map-flow-adapter.test.ts`：16/16。
- `npx tsc --noEmit`：通过。
