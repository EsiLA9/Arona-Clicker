# Receipt 0320-U05

| 项 | 内容 |
| --- | --- |
| 状态 | U05 已完成；U06 等待 U05b 补齐回放证据合同 |
| 实际修改 | `src/arona-clicker/contracts/map/map-run.ts` 增加调度序列/Preview/Receipt 合同；`src/arona-clicker/contracts/runtime/runtime.ts` 仅扩展 RecentCommit／CommitPreview 的 `executionContractId` 联合类型；`src/arona-clicker/services/map/map-run-service.ts` 保留 E1 分组计划并增加 AG-1 逐源计划/结算；`tests/engine/gameplay-b-map-ag1-commit.test.ts` 补全行为边界；本 Unit 实施记录。 |
| 未完成内容 | Restore 对 executionSequence 的独立重算与分组投影互校由 U06 实施；执行顺序 UI 投影由 U07 实施。U06 所需的历史 source-start HP／余额、目标意图和 terminal checkpoint 证据由 U05b 冻结并补齐。 |
| 范围外变更 | 无；未修改 coordinator、Restore validator、UI 或 GALHCG。 |
| GALHCG 影响闭环 | 未更新；遵照项目规则集中到可验收工作节点结束后统一复核。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| AG-1 全序与逐源提交 | `npx vitest run tests/engine/gameplay-b-map-ag1-commit.test.ts` | 通过，11/11 | 覆盖 E1/AG-1 dispatch、逐源资源可见性、成本错误零安装、终局跳过、目标锁定、Item coordinator、无 Program Receipt、自源不能支付成本与 Enemy 免费 unaffordable。 |
| E1 MapRun 兼容 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts --reporter=dot --silent` | 通过，49/49 | E1 原有定向回归。 |
| Item 双 Owner 原子性 | `npx vitest run tests/engine/gameplay-b-map-source-transactions.test.ts --reporter=dot --silent` | 通过，7/7 | 双 Owner Item 集成与幂等回归。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 退出码 0；在最后的快照断言修正后重跑。 |
| 差异检查 | `git --no-pager diff --check -- src/arona-clicker/contracts/map/map-run.ts src/arona-clicker/contracts/runtime/runtime.ts src/arona-clicker/services/map/map-run-service.ts tests/engine/gameplay-b-map-ag1-commit.test.ts` | 通过 | U05 白名单实现文件无空白错误。 |

## 遇到问题

- 首版 Enemy unaffordable 用例尝试在初始资源不足时选择 Enemy Action；运行时在来源选择阶段就过滤该 Action，无法形成已选来源。修正后使用两个已选 Enemy 来源：首源成本与资源效果依序扣除，令后源到达执行时不可支付，成功验证免费 `unaffordable` 跳过并继续。
- Enemy 过滤证据说明：本 Unit 可验证的是已选来源在前序变化后变得不可支付；初始候选资格仍由既有选择逻辑控制，未更改该边界。
- 自源付费用例使用自然 Party 来源：较快的来源扣完起始余额后，后续补给 Action 的固定成本校验失败，Preview／Commit 拒绝；与 Commit 前的完整 MapRun snapshot 对比确认 HP、余额与版本等状态没有安装变化。初始余额为 0 时现有候选规则会过滤该 Action，因此无法形成已选来源；本例覆盖前序变化后的成本门，未改变来源资格合同。
- `executionSequence` 目前不能独立回放所有历史 source-start 输入；U06 的独立重算需等待 U05b 冻结并交付相应证据字段。

## 需上游确认项

- 无；统一队列、逐来源支付及终局规则由 Draft 0312 §13.1–13.4 批准。
- Restore 对 executionSequence 的独立重算与分组投影互校由紧随其后的 U06 实施。
