# Receipt 0326-S1 — 三来源新开局与真实节点内容

> Parent Task: [[docs/plan-work/archive/task-0326-variant-translation-real-card-workspace]]
> Unit: [[docs/plan-work/archive/task-0326-units/task-0326-s1]]

- **结果**：完成。新增场景内容与 binding contract；prepare 按 `owned → normal → enhanced` 每份执行 preview+confirm，生成固定 mapId 与三个独立 Encounter 节点。每节点由自己的冻结 HP/敏捷初始化；三场共享相同敌人，并在真实 Hand 中提供伤害、敏捷不同的快速/强力行动。旧单战开发诊断未修改。
- **验证**：先运行 `npx vitest run tests/engine/variant-training-scenario.test.ts`，因新模块尚不存在而红；实现后同命令 5 tests 通过，其中验证三次 preview/confirm 的固定顺序、三场参数/敌人/Hand 和无持有时整次准入失败。`npx tsc --noEmit` 通过。
- **未完成 / 接合**：Scenario fresh binding 已交给主 Runtime 使用。partySetup生成Schema已由主Agent同步；此Unit只通过可信动态场景生成该字段，不引入静态Registry作者能力。
