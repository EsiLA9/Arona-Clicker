# Receipt 0320-U09c

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | `src/arona-clicker/contracts/map/map-run.ts` 与 `src/arona-clicker/services/map/map-run-service.ts` 把 AG-1 scheduler 从 v1 升到 v2；起点快照在 Run 根层保存 detached MapRun Facts，Preview/Receipt 保存重新规划得到的 `plannedMapRunFacts`。Restore 按当前 Map 声明校验快照并重建历史 Run，重跑真实 AG-1 planner，比较回执结果及当前 Owner 状态。`tests/engine/gameplay-b-map-ag1-commit.test.ts` 与 `tests/engine/gameplay-b-map-ag1-restore.test.ts` 覆盖声明/未声明 Facts、格式版本和起点/结果/当前状态篡改拒绝；测试 Map `resumeVersion` 2→3。 |
| 未完成内容 | 无。本 Unit 不实现 Facts Effect 读写。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 未改图、未刷新或写 freshness；Task 0320 收尾统一核对 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| AG-1 Commit | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-commit.test.ts` | 通过，14/14 | v2 scheduler 起点快照与计划 Facts 回执；未声明 Facts 时保持省略 |
| AG-1 Restore | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-restore.test.ts` | 通过，34/34 | 从起点 Facts 重建并重跑；拒绝 v1/未知版本及起点、计划结果、当前 Owner 篡改 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0 | 面向共享工作树当前源码 |
| 差异检查 | `git --no-pager diff --check` | 通过，退出码0 | 仅有其他已修改文件的 CRLF→LF 提示 |

## 遇到问题

- 无。

## 需上游确认项

- 无。

## 事实更新建议

- scheduler v2 仅在 Map 声明 Facts 时向起点快照和 `plannedMapRunFacts` 计划结果中加入闭合根状态；对无 Facts Map 维持省略。当前暂无 Fact Effect，因此计划值等于起点值。
