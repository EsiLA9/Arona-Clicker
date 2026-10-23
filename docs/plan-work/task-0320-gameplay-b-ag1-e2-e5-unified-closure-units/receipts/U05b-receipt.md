# Receipt 0320-U05b

| 项 | 内容 |
| --- | --- |
| 状态 | 已完成 |
| 实际修改 | `map-run.ts` 增加 AG-1 start snapshot、完整 U02 排序键及 terminal 证据合同；`map-run-service.ts` 在纯 plan 起点捕获并深拷贝快照、沿用 U04 候选排序键、生成 Preview/Receipt 一致的 terminal；`gameplay-b-map-ag1-commit.test.ts` 增加快照、排序、锁定/自动目标与 checkpoint 行为用例。 |
| 未完成内容 | 无；U06 的 Restore 与实际历史重算仍由 U06 实施。 |
| 范围外变更 | 无；未修改 Restore、双 Owner coordinator、UI 或 GALHCG。 |
| GALHCG 影响闭环 | 本工作节点的源码、定向测试与 Unit/Receipt 文档均收敛在批准范围；未授权图编辑、刷新或 freshness 写入。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| AG-1 起点/排序/终局证据 | `npx vitest run tests/engine/gameplay-b-map-ag1-commit.test.ts --reporter=dot --silent` | 通过，14/14 | 含二轮 Status terminal checkpoint、目标自动 fallback 与 snapshot detached 行为 |
| E1 MapRun 兼容 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts --reporter=dot --silent` | 通过，49/49 | E1 既有边界通过 |
| Item coordinator | `npx vitest run tests/engine/gameplay-b-map-source-transactions.test.ts --reporter=dot --silent` | 通过，7/7 | 双 Owner 安装与幂等边界通过 |
| TypeScript | `npx tsc --noEmit` | 通过 | 退出码 0 |
| 差异检查 | `git --no-pager diff --check` | 通过，退出码 0 | 全工作树无空白错误；Git 对若干已有 CRLF 文件提示下次写入会转为 LF，不影响检查结果 |

## 遇到问题

- U06 只读审查确认 U05 的实际 delta 与已选来源序列不足以回放来源开始余额／HP、目标锁定输入及 terminal checkpoint，特别是活动 Encounter 关闭后。因此按 U06 硬停止门先补充本 Unit，再开始 Restore 源码施工。U05b 已保存规划器实际读取的输入；历史 Restore 尚未在本 Unit 验证。

## 需上游确认项

- 无；这是为满足已批准 AG-1 Save/Resume 独立重算而补齐 Receipt 证据，不改变玩法与 U05 支付／顺序合同。
