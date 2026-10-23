# Receipt 0320-U03

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | `contracts/map-run.ts` 增加可选 AG-1 Run `partyAgility` 与 Encounter `enemyAgility` 快照；`map-run-service.ts` 在 start／Encounter 创建时物化输入，并在 Restore 核对闭合字段、Roster身份与顺序、非负安全整数及当前作者输入；两份 Engine 测试覆盖创建、空 Enemy、存档往返、被篡改快照、同版本作者数据漂移及 E1 注入。 |
| 保持边界 | 未改 `resolveEncounterCommitPlan`、费用、队列、效果、Receipt／Commit规划或安装；未接入 Cultivate/Gear/实时角色数值；未改 GALHCG。 |
| 范围外变更 | 无。仅修正 Allowed Files 内 Save/Resume 测试过时的“所有 Map resumeVersion 至少为 3”断言；新加入的两个 Map 样例实际版本为 1，Registry 测试已有逐 Map 精确版本表。 |
| 未完成内容 | 无。AG-1 finalAgility计算、来源组装、排序、费用及执行序列归后续 U04。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| MapRun 初始化与 Encounter 创建 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts --reporter=dot --silent` | 通过，49/49 | 覆盖固定 Party 顺序、稀疏默认0、Enemy顺序、空 Enemy 与 Restore 防伪造。 |
| Save/Resume 边界 | `npx vitest run tests/engine/gameplay-b-map-save-resume.test.ts --reporter=dot --silent` | 通过，7/7 | E1 checkpoint 未增加 AG-1 字段，现有 round-trip 继续通过。 |
| 两文件定向复跑 | 两个上述文件同一次 Vitest 命令 | 通过，56/56 | 最终代码状态。 |
| 首次测试失败 | 两文件首次联合运行 | 1项失败 | 既有 Save/Resume 测试在第375行断言所有 Map 的 `resumeVersion >= 3`；新 Status／Prepared Tag 示例均为版本1。已按有效合同改为检查正安全整数。 |
| TypeScript | `npx tsc --noEmit` | 通过 | 退出码 0。 |
| 差异检查 | `git --no-pager diff --check -- <四份源码/测试白名单文件>` | 通过 | 退出码 0。 |

## Restore边界覆盖

- AG-1：遗漏、重复、未知、乱序 Party/Enemy ID，额外对象字段、负值、小数、非安全整数、当前作者值变化均拒绝；闭合行也拒绝 Symbol 与 getter/setter，避免读取不可信快照时执行属性访问器。
- E1：Run 和 Encounter 均省略 AG-1 快照字段；向 E1 Run 或 active Encounter 注入 Party／Enemy 敏捷快照会以 `invalid-run` 拒绝。
- 版本：Map `resumeVersion` 不匹配仍先由原有头部校验返回 `content-version-mismatch`；相同版本但作者敏捷输入与保存快照不一致则由独立数值比对拒绝。
