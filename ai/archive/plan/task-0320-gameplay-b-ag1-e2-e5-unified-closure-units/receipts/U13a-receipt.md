# Receipt 0320-U13a

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | 新增独立 `gameplay-b-effect-rng.ts`，实现冻结的 fmix32/Domain seed、cursor-addressed raw word、拒绝采样和有序部分 Fisher–Yates。Planner 接收/返回 detached Effect RNG state，随机 damage/heal TargetSet 与 `forTargets` 共用 cursor，要求运行时 `limit` 1..32，并在 Trace 记录抽取 identity 顺序及 cursor 前后；随机缺 state、cursor 耗尽、错误或预算拒绝不会修改调用输入。新增 RNG 固定向量和边界测试，并扩充 Planner 随机集合测试。 |
| 未完成内容 | MapRun Owner 持有/Encounter 派生、跨来源连续传递、scheduler v3 Receipt/Save/Resume/Restore 由后续 U13b 接线。独立 Receipt Validator 目前只走 E1/legacy 分支，不是 AG-1 随机回放的第二入口。 |
| 修改文件 | `src/arona-clicker/contracts/map/map-effects.ts`；`src/arona-clicker/services/map/gameplay-b-effect-rng.ts`；`src/arona-clicker/services/map/map-effect-planner.ts`；`tests/engine/gameplay-b-effect-rng.test.ts`；`tests/engine/gameplay-b-effect-planner.test.ts`。 |
| 范围外变更 | 无；仅修改五条实现白名单路径。 |
| GALHCG 影响闭环 | 只读核对；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| RNG + Planner | `npx vitest run --silent tests/engine/gameplay-b-effect-rng.test.ts tests/engine/gameplay-b-effect-planner.test.ts` | 通过，31/31 | RNG 5 项、Planner 26 项 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码 0 | 全工作树 |
| 文档链接/结构 | `npm run check:docs` | 通过，扫描1243篇、errors: 0 | 新实现路径已落盘 |
| 差异检查 | `git --no-pager diff --check` | 通过，退出码 0 | 仅共享工作树 CRLF 提示 |

## 遇到问题

- 无。

## 需上游确认项

- 无；抽样算法和 Effect RNG 独立于 Hand RNG 已由 U08 冻结。

## 事实更新建议

- 本 Unit 只交付纯算法与 Planner next-state；Effect RNG 只有经 U13b MapRun Owner/scheduler v3 Unit 接线后才可在运行时提交。AG-1 Restore 的真实计划重放是随机 Receipt 的权威核验入口。
