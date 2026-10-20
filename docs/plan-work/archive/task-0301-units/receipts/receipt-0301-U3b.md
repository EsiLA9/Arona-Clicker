# Receipt 0301-U3b

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/arona-clicker/contracts/runtime.ts`、`src/arona-clicker/runtime-game-instance.ts` 的只读投影；`src/arona-clicker/services/map-run-service.ts` 的资源结算与 Receipt Save / Resume 校验；Owner、卡牌效果和 Runtime 集成测试；U3b Unit 与 Task 0301。 |
| 未完成内容 | 无；U5b 已完成旧固定字段与 legacy Receipt 路径删除。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 所有 Enemy 余额及结算仍由 MapRun Owner 管理；Runtime 只投影结果。没有建立第二个状态归属。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Owner / card settlement | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts` | 通过 | 69 项通过；覆盖 Actor / Team 费用隔离、卡牌费用减免、HP 与资源效果、目标修复、击杀跳过和 Receipt 投影。 |
| 类型 | `npx tsc --noEmit` | 通过 | Enemy Prepared Action、Preview 与 Receipt 类型一致。 |
| 差异 | `git diff --check` | 通过 | 无空白错误。 |

## 遇到问题

- 无。

## 需上游确认项

- 无；依照已批准合同，Enemy 行动没有合法目标或可支付费用时免费跳过。
