# Receipt 0320-U12c

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | AG-1 在每个来源固定费用扣除后构造 Actor/Team 余额快照，并在本来源效果结算后让后续来源看到已兑现变化。Planner Facts 以 detached 状态沿 AG-1 顺序聚合；最终值写入既有 Receipt `plannedMapRunFacts` 并安装到 MapRun 根状态。Restore 从 scheduler v2 起点重放并校验计划结果、当前 Facts 与余额。 |
| 未完成内容 | Effect RNG/scheduler v3 与 additionalTarget Runtime 身份仍未实现。 |
| 修改文件 | `src/arona-clicker/services/map/map-run-service.ts`；`tests/engine/gameplay-b-map-ag1-commit.test.ts`；`tests/engine/gameplay-b-map-ag1-restore.test.ts`。 |
| 范围外变更 | 无；只修改三个实现白名单路径。 |
| GALHCG 影响闭环 | 只读核对；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| AG-1 Commit | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-commit.test.ts` | 通过，15/15 | 费用后冻结快照、跨来源可见性、Facts 安装和原子失败 |
| AG-1 Restore | `npx vitest run --silent tests/engine/gameplay-b-map-ag1-restore.test.ts` | 通过，37/37 | 从 scheduler v2 起点重放，并拒绝 Facts/余额篡改 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码 0 | 全工作树 |
| 文档链接/结构 | `npm run check:docs` | 通过，0 errors | U12c Agent 与 Task Owner 验证 |
| 差异检查 | `git --no-pager diff --check` | 通过，退出码 0 | 仅共享工作树 CRLF 提示 |

## 遇到问题

- 无。

## 需上游确认项

- 无；Owner 时点与事实重放由 U08、U09c、U12b 已冻结。

## 事实更新建议

- E2 `forTargets`、资源余额和 MapRun Facts 已接入 AG-1 Commit/Restore；随机 TargetSet 与 additionalTarget Runtime 仍未接线。
