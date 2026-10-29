# Receipt 0320-U13b

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | `map-run.ts`、`map-run-service.ts` 与 AG-1 Commit/Restore 测试接入 Effect RNG Owner 生命周期。新 Encounter 从初始 Hand seed 派生独立 state，同 Encounter 跨 Round 保留；AG-1 来源队列共享同一游标。scheduler 升至 v3，保存 start/after state 和目标随机 Trace；成功 Commit 才安装 after state。测试 Map `resumeVersion` 升至4，E1 Map 保持原版本。 |
| 未完成内容 | additionalTarget Runtime、additionalActor/loopTargetActor 资源写账户、独立 E1 Receipt Validator 的随机回放均不在本 Unit。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 只读核对；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| AG-1 Commit | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-commit.test.ts` | 19/19 passed | Agent 与 Task Owner 独立复核均通过 |
| AG-1 Restore | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-restore.test.ts` | 48/48 passed | 拒绝旧 scheduler、起点/终点 state、随机身份/游标 Trace 与 `resumeVersion:3` 篡改 |
| 类型检查 | `npx tsc --noEmit` | passed | Task Owner 独立复核，exit 0 |
| 文档链接/结构 | `npm run check:docs` | passed | Task Owner 独立复核，1245 篇、0 errors |
| 差异检查 | `git --no-pager diff --check` | passed | Task Owner 独立复核；仅有共享工作树 CRLF 提示 |

## 遇到问题

- 无。

## 需上游确认项

- 无；Effect RNG 算法、seed domain、Encounter/Round 边界和 scheduler v3 已由 U08 冻结。AG-1 专用 Restore 已承担随机 Receipt 全量重放，独立 E1/legacy Validator 不属于本 Unit 的路径。

## 事实更新建议

- AG-1 Commit 现可提交随机 E2 TargetSet 并经 scheduler v3 Restore 重放；独立 Effect Receipt Validator 继续限于 E1/legacy 兼容路径。
