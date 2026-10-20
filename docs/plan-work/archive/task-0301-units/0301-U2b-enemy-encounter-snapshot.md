# Unit 0301-U2b：Enemy Hand 与资源快照

## Goal

将 U2a 生成的 Enemy Hands 接入 MapRun 的权威 Encounter snapshot，并保存 Enemy Actor / Team 资源，使当前准备结果可以跨 UI 刷新与 Save / Resume 保持稳定。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`：P2 | 已冻结的快照、资源与随机顺序 |
| 源码 | `src/arona-clicker/contracts/map-run.ts`：MapRunEncounterSnapshot | 当前 Encounter 状态归属 |
| 源码 | `src/arona-clicker/services/map-run-service.ts`：createEncounterSnapshot / restoreEncounterSnapshot / snapshotOf | 唯一 MapRun 写入与 Save / Resume Owner |
| 源码 | `src/arona-clicker/services/gameplay-b-hand-resolver.ts`：drawGameplayBHands | Enemy Hand 确定性重演 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`：Hand / Save / Resume | MapRun 行为回归 |

## Constraints

- Enemy Hands 按 Encounter Enemy roster 保存，Enemy Actor 资源按 Enemy + resource ID 唯一化；Enemy Team 资源是独立的 Encounter-local 余额。
- 初入 Encounter 时从 Enemy / Enemy Team 的声明初始资源建立余额；新回合继续使用结算后的余额，不重置。
- 准备时将 Enemy roster、当前 HP、Enemy Actor / Team 余额全部交给 U2a resolver；输出 Enemy Hand 与 RNG cursor 保存到同一 Encounter snapshot。
- Save / Resume 保留这些字段并使用已保存的 HP、资源与 draw cursor 重演双方 Hands；不增加 Enemy 用的第二状态 Owner。
- 不新增旧版 Snapshot 迁移。若缺失新字段、手牌不能重演、资源重复或初始资源项丢失，应拒绝恢复。
- 旧固定伤害结算、Enemy Action Commit 和 UI 仍留给 U3 / U4。

## Allowed Files

- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/services/map-run-service.ts`
- `tests/engine/gameplay-b-map-run.test.ts`
- `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`
- 本 Unit 与其 Receipt

## Completion Criteria

- [x] 新 Encounter snapshot 含有每个 Enemy 的 Hand、Enemy Actor 余额与 Enemy Team 余额。
- [x] 下一轮以当前 Enemy HP / 资源和上一轮保存的 RNG cursor 抽牌。
- [x] UI View / Snapshot clone 返回不可变、完整的 Enemy 状态。
- [x] Save / Resume 恢复出同一 Enemy Hand / 资源 / RNG，并通过 Hand 重演。
- [x] 没有初始 Enemy 资源行、重复余额、坏 Hand 或错误重演的 Snapshot 会被拒绝。

## 实施结果

- `MapRunEncounterSnapshot` 增加 `enemyHands`、`enemyActorResources`、`enemyTeamResources`；MapRunService 仍是唯一写入者。
- 入场时 Enemy 资源来自 Encounter 定义，下一轮准备沿用同一 Encounter 内余额；Character 与 Enemy Team 的预算一直隔离。
- Save / Resume 严格读取 Enemy roster 顺序、Hand、Actor / Team 资源行，并通过 U2a resolver 重演 Character 与 Enemy Hands / RNG。初始配置资源不得从快照中遗漏。
- 固定 damage Commit 尚在使用；Enemy Action 实际费用和资源变化由 U3 接入。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Runtime / MapRun | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 通过 |
| 差异 | `git diff --check` | 无空白错误 |
