# Receipt 0299-U6

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | src/arona-clicker/services/gameplay-b-hand-resolver.ts；tests/engine/gameplay-b-map-run.test.ts；tests/engine/gameplay-b-map-cards.test.ts；更新 U6 Unit 与 Task 0299 进度；新增本 Receipt |
| 未完成内容 | 无；Task 0299 后续进入 U7（P4 卡牌目标）。 |
| 范围外变更 | 未修改 MapRun 真实资源写入、Commit 收费逻辑或保存字段；先前已有的 UI 关系标记改动保持原样。 |
| GALHCG 影响闭环 | 项目身份 acprogram 已核对；直接复核 Hand resolver、MapRun 创建 / 恢复调用点和受影响费用 / 卡牌测试；未改图、未刷新或写 freshness。 |

## 结果

- 每名角色的自然 Hand[0] 在固定队伍顺序下按此前自然行动的虚拟 Team cost 预留过滤后抽取。
- 自然 Hand[0] 选定后，只有本地虚拟余额扣减对应 Team cost；Actor / Team 真实余额只由 Commit 修改。
- 后续角色没有可负担的自然 Action 时获得空 Hand / Wait，不额外消耗 RNG，也不占预算。
- 同角色的其他 Hand 候选仍按本轮起始 Actor / Team 余额、情境权重和无放回规则产生；因此玩家 Swap 后可能形成费用不足组合，并由现有 Preview / Commit 费用校验拒绝。
- 保存恢复从原 Encounter snapshot 重演同一 Hand 和 RNG 状态；无需另存虚拟预算。
- 原先独立抽牌后才发现团队超支的回归改为显式玩家 Swap 构造冲突；卡牌折扣仍不能抵消 Team resource cost。已有 UI 关系标记文件没有纳入本 Unit。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Runtime / Hand / 卡牌回归 | npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-cards.test.ts | 通过 | 3 files、63 tests；包含 Team=3 / 两个 cost=2、自然 Wait、无额外 RNG、可支付自然 Commit、Swap 超支、Save / Restore 稳定及既有卡牌折扣回归。 |
| 类型检查 | npx tsc --noEmit | 通过 | — |
| 差异空白 | git diff --check | 通过 | 只提示工作树既有 CRLF 转换信息。 |

## 遇到问题

- 一项既有卡牌折扣回归曾依赖两名角色分别自然选择同一份共享预算下的 Action。该前提与本 Unit 明确的新自然费用规则冲突，已将用例改为玩家显式 Swap 形成超支组合；测试仍验证折扣不会资助不相关 Team cost。
- 修改后的多目标卡牌用例显式设定合法目标，使其只验证共享费用与卡牌折扣，不依赖 P4 尚未实施的多卡目标默认行为。

## 需上游确认项

- 无；队序虚拟预留和“无自然可付 Action 则空 Hand / Wait”由 Task-0299 P0 / P3 冻结。

## 事实更新建议

- Hand draw 会分别从真实起始 Team 余额和剩余虚拟 Team 余额构建候选池：自然首牌从后者抽取，备选牌从前者抽取。共享费用预留是准备计算，不是资源交易，也不增加 Save 字段。
