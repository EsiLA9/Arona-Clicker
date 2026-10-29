# Receipt 0320-U02

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | 新增纯排序器 `src/arona-clicker/services/map/gameplay-b-ag1-scheduler.ts` 与定向行为测试 `tests/engine/gameplay-b-ag1-order.test.ts`；补齐 U02 的已验证排序字段、闭合检查和最终敏捷不变量。 |
| 导出入口 | `resolveGameplayBAg1SourceOrder(candidates: readonly GameplayBAg1SourceOrderCandidate[]): readonly GameplayBAg1SourceOrderCandidate[]`；输入为七字段标量候选，输出新数组。 |
| 不变边界 | 未修改 MapRun Owner、来源组装、费用、Receipt / Save、UI、Schema 或 GALHCG；未写入或排序实际运行时来源。 |
| 尚未完成内容 | 本 Unit 范围内无。后续 U03 负责构造候选并接线。 |

## 验证结果

| 项 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 排序行为 | `npx vitest run tests/engine/gameplay-b-ag1-order.test.ts` | 通过，12/12 | 5 个候选的所有输入排列均验证出相同顺序。 |
| TypeScript | `npx tsc --noEmit` | 通过 | 退出码 0。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 退出码 0；共享工作区有既有换行格式告警，无空白错误。 |

## 行为记录

- 排序键按 `finalAgility DESC, baseAgility DESC, sideRank ASC, sourceRank ASC, ownerDeclarationIndex ASC, logicalIndex ASC, sourceKey` 代码单元字典序升序比较。
- Party 合法 rank 为 0/1/2；Enemy 仅允许 0。所有数值字段均拒绝负数、小数和超出安全整数；另拒绝 `finalAgility < baseAgility`、空／重复 sourceKey、未知字段及访问器字段。
- 排序只复制数组再排序，不写入或改动候选对象；相同完整键因 sourceKey 唯一性不会依赖输入顺序打破平局。

## 遇到问题与需上游确认

- 无阻塞项，无需上游确认。
