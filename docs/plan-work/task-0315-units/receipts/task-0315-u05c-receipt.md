# Task 0315 U05c Receipt：Planner / Program 旧夹具迁移

状态：completed。

## 修改

- `tests/engine/gameplay-b-effect-planner.test.ts`：删除仅证明旧 Action 数组可按 legacy HP/resource phase 分段执行、并可跳过访问预算的测试。保留已有纯 Program damage/heal、条件、资源账本、预算、clamp 与失败边界覆盖。
- `tests/engine/gameplay-b-effect-program.test.ts`：删除依赖旧 `hpEffects` 的 Ability heal 测试，该测试断言旧 Ability HP 阶段晚于新 Item guard；该历史隐式阶段不再是新 Program 合同。保留其他新 Program 的真实 Owner Preview、Commit、Prepare、费用失败、Ability/Item 来源与预算覆盖。
- 两个目标文件中不再有 `hpEffects` / `cardEffects` Action fixture 或直接 legacy-normalizer 成功合同。`legacyGoldenMap` 测试工厂仍用于创建 Owner 测试底座；其保留的 Action 均用新 `effectProgram` 或无效果，不表示旧数组仍可执行。
- 未修改产品源码、Receipt validator 或 U05c 白名单以外文件。

## 验证

- 实际运行：`npx vitest run tests/engine/gameplay-b-effect-planner.test.ts tests/engine/gameplay-b-effect-program.test.ts`，**2 files / 18 tests passed**。
- 实际运行 U05c 白名单 `git --no-pager diff --check`，通过；未跟踪 Unit 与 Receipt 的尾随空白检查无命中。
