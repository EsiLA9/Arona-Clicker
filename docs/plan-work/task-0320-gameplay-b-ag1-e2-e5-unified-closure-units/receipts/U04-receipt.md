# Receipt 0320-U04

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | 新增 `src/arona-clicker/services/map/gameplay-b-ag1-source-adapter.ts` 与 `tests/engine/gameplay-b-ag1-source-adapter.test.ts`；更新 U04 Unit 实施记录与本 Receipt。 |
| 对外入口 | `buildGameplayBAg1ExecutionSources(input: GameplayBAg1SourceAdapterInput): readonly GameplayBAg1ExecutionSource[]`；来源包含 `sourceKey/sourceKind/owner/actionId/cardRef/target/skipReason/baseAgility/actorAgility/finalAgility/orderCandidate`。 |
| 边界 | 纯 detached 适配器调用 `resolveGameplayBAg1SourceOrder`。未接 MapRun Owner、费用、效果、Receipt/Save/UI；未改其他源码/测试、GALHCG 或 Schema。 |
| 未完成内容 | 无。 |

## 覆盖范围

- Party natural、Swap、PlayerCommand 均只从最终 Prepared 行各自产生一条来源；Wait 排除。PlayerCommand 必须匹配 `playerCommand` Catalog zone 和 Hand 长度 logicalIndex。
- Enemy 只使用 `preparedEnemyActions.naturalActionId` 的真实 Hand 来源；未选 Hand 与展示 Intent 不入队。
- `noLegalTarget` 仍进入排序序列并保留 skipReason。Ability/Item 只允许 source preview 中的唯一已选项，校验当前 Encounter 声明及映射；它们使用 actor agility 0，CardRef 为 null。
- roster 与 U03 agility 快照必须完整、唯一且顺序一致，并逐身份与当前 Map／Encounter 作者敏捷值相同（作者字段稀疏缺省为 0）；快照行执行闭合字段及数据属性检查。来源敏捷按安全边界公式计算；sourceKey 使用 Draft §13.2 的规范 JSON 元组。
- 实体卡要求唯一 Catalog 映射，检查 owner、Action ID、zone、prepared、controllable、logicalIndex、规范 ID 与完整当前 Scope；不从 UI 顺序或候选项构造 CardRef。目标 actor 与目标 CardRef 同样受 roster/scope 校验。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 来源适配 | `npx vitest run tests/engine/gameplay-b-ag1-source-adapter.test.ts --reporter=dot --silent` | 通过，7/7 | 覆盖 natural、Swap、PlayerCommand、Enemy、Ability/Item、skip 保留、大敏捷溢出边界、伪造/错 Scope/多义 CardRef、稀疏作者值默认0、Party/Enemy作者漂移拒绝及闭合快照行。 |
| TypeScript | `npx tsc --noEmit` | 通过 | 初次 U04 交付和后续作者值核对变更后均退出码 0。 |
| 差异检查 | `git --no-pager diff --check -- <四个 U04 白名单文件>` | 通过 | 初次 U04 交付和后续作者值核对变更后均退出码 0。 |
| 首轮适配测试 | 同定向 Vitest 命令 | 失败，1/4 | 测试误把 `base=5, actor=3, max=MAX_SAFE_INTEGER` 预期为 MAX；修正测试快照使 actor 为 MAX 后复跑通过，公式以不溢出的方式得到 MAX。 |

## 需上游确认项

- 无。U04 不接唯一 Owner Commit planner；真实来源组装与费用／效果／Receipt 接线留给后续 Unit。
