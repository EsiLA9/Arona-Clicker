# Receipt 0301-U2b

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/arona-clicker/contracts/map-run.ts`；`src/arona-clicker/services/map-run-service.ts`；`tests/engine/gameplay-b-map-run.test.ts`；更新 Task 0301 与 U2b 状态；新增本 Receipt。 |
| 未完成内容 | 受影响正式 Map 的 `resumeVersion` 收口由 U2c 完成；Enemy Action Commit / Receipt 和只读 UI 由 U3 / U4 完成。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 此 Unit 只扩展 MapRun Owner 持有的 Encounter snapshot，不增加写入者或跨层依赖；未写语义图。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Runtime / MapRun | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts` | 通过 | 1 文件、43 项通过；新增真实 MapRun Enemy Hand / Actor / Team snapshot 与 Save / Resume 重演，以及手牌损坏、Actor 费用余额不符、遗漏初始余额拒绝用例。 |
| 类型 | `npx tsc --noEmit` | 通过 | 无类型错误。 |
| 架构 | `npm run check:architecture` | 通过 | 没有新增 forbidden outward imports。 |
| 差异 | `git diff --check -- <Unit 影响文件>` | 通过 | 无空白错误。 |

## 遇到问题

- 无。旧 Save Snapshot 迁移由现有 Map `resumeVersion` 规则管理，具体版本更新列入 U2c。

## 需上游确认项

- 无。MapRun Owner 和 Enemy 资源生命周期已由 Task 0301 批准。

## 事实更新建议

- Task 0301 U2b 已确认：双方 Hand 与 RNG 可在同一 Encounter snapshot 中保存并重演；Enemy Actor / Team 资源保存在 Encounter-local 状态，不写入 MapRun 角色资源池。
