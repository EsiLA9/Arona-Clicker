# Receipt 0301-U5b

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | Enemy `damage` / `enemyAttacks` 源合同、Registry、MapRun / Runtime / Flow 解析与投影；正式 Schema 输出；受影响的测试 fixture 和旧字段拒绝用例。 |
| 未完成内容 | 无。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | Enemy 的 HP 攻击结果完全由普通 Action Commit 与 Receipt 记录；移除了旁路固定伤害 Owner。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Schema | `npm run gen:schema` | 通过 | 从源合同重新生成编辑器 Schema。 |
| Schema sync | `npx vitest run --silent tools/datapack-editor/schema/engine-schema.sync.test.ts` | 通过 | 10 项通过；Legacy damage 被 Registry 拒绝。 |
| Registry / MapRun / Save | `npx vitest run --silent tests/data/gameplay-b-map-registry.test.ts tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts` | 通过 | Registry 135、MapRun 46、Save / Resume 7 项通过。 |
| 类型 | `npx tsc --noEmit` | 通过 | 契约使用方无遗漏。 |

## 遇到问题

- 移除固定伤害后，依赖其造成玩家失败的事务测试没有显式 Enemy Action。测试 fixture 已增加对应 Action，以便继续验证原本的玩家物品扣除与失败事务合同。

## 需上游确认项

- 无；旧 Save / Resume 格式已按已批准版本断代规则拒绝，不提供迁移层。
