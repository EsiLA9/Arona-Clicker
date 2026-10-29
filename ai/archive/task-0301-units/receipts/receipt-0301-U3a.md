# Receipt 0301-U3a

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/arona-clicker/services/map-run-service.ts` 的 Encounter Commit plan；`src/arona-clicker/services/map-card-effects.ts` 的双阵营效果选择；`src/arona-clicker/contracts/map-run.ts` 的 Enemy settlement / Preview 合同；更新本 Unit 与 Task 0301。 |
| 未完成内容 | U3b 的资源、HP、Receipt、Runtime 投影与 Save / Resume 校验记录在独立 Receipt；正式内容迁移留给 U5。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 扩展已有 MapRun Owner 内的纯 Commit 计划；没有新增状态 Owner、planner 或旧 Operation 依赖。 |

## 测试与验证结果

| 项 | 结果 | 备注 |
| --- | --- | --- |
| 行动执行顺序 | 通过 | Character → Ability / Item → Enemy roster。 |
| 目标失效与跳过 | 通过 | 自动目标在实际执行时按当前 HP / roster 重新选择；无目标、已倒下及费用不足均跳过。 |
| 终局 | 通过 | 整轮事务按实际 HP 变化确定最终结果。 |

## 遇到问题

- 无。

## 需上游确认项

- 无；此范围由已批准的 Task 0301 规则授权。
