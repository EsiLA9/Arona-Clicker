# Unit 0301-U0a：建立敌方自主行动卡牌 Task 与合同

## Goal

建立可执行的敌方自主行动卡牌 Task，登记活动入口并冻结用户批准的产品规则。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/goal-workflow.md` | Task 独立边界与登记规则 |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md` | Patch Unit 与 Receipt 纪律 |
| 文档 | `docs/plan-work/archive/task-0291-gameplay-b-hp-enemy-ability-item.md` | 原固定敌方行动合同 |
| 文档 | `docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy.md` | 已完成我方策略规则及敌方排除边界 |
| 源码 | `src/data-services/contracts/gameplay-map.ts:38–326` | Action、Character pool 与 Enemy 数据结构 |
| 源码 | `src/arona-clicker/services/gameplay-b-hand-resolver.ts:13–370` | 当前策略抽牌合同 |
| 源码 | `src/arona-clicker/contracts/map-run.ts:251–281` | 当前 Encounter 持久状态 |
| 源码 | `src/arona-clicker/services/map-run-service.ts:1225–1241` | 固定 damage 行动结算 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 5 篇；只读取与 Task 入口、旧合同直接相关部分 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分或上交，不扩大白名单 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Enemy 当前无行动候选，只配置固定 `damage`。 | `GameplayEncounterEnemyDef`；Registry `enemies` 验证 | 用户要求将此变为 Enemy 自主 Action。 |
| 当前 Hand resolver 只为 fixed party 抽牌，但已有随机、权重、目标资格、资源预留算法。 | `drawGameplayBHands()` | 新行为需要复用此算法，不复制一套 AI。 |
| Task 0291 / 0299 仍写有旧固定 Enemy 行动或隐藏意图时序。 | 两 Task 当前文本 | U0b 会专门回写，不在本 Unit 改历史合同。 |

## Constraints

- 只创建并登记 Task；详细架构与后续 Unit 留在 Task 0301。
- 不修改产品源码、生成 Schema 或旧任务合同；它们由 U0b / U1 处理。
- 遵守 `AGENTS.md`、架构边界、Schema 同步和禁止存档迁移层规范。

## Allowed Files

- `docs/plan-work/00-index.md`
- `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`
- `docs/plan-work/archive/task-0301-units/0301-U0a-task-and-contract.md`
- `docs/plan-work/archive/task-0301-units/receipts/receipt-0301-U0a.md`

## Explicit Non-goals

- 不修改运行时 / Datapack / UI。
- 不更新 Task 0291、0299 或 Draft 0287；由 U0b 协调。
- 不恢复旧 Operation 敌方意图实现。

## Stop Conditions

- Task 新边界与用户已批准方向冲突。
- 要写入 Allowed Files 外文件或发现产品规则仍需负责人选型。
- `npm run check:docs` 无法执行或结果无法解释。

## Completion Criteria

- [ ] Task 0301 写明共用策略、敌方只读、准备 / 结算、费用、存档、旧合同变更及 P0–P5 验收。
- [ ] Task 0301 在 `docs/plan-work/00-index.md` 登记为 active。
- [ ] 文档检查未报告本 Unit 新增的路径错误；全仓其他旧路径错误如实记录。
- [ ] 差异检查通过。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档路由 | `npm run check:docs` | 本 Unit 修改文件无路径错误；另记录全仓旧路径错误 |
| 差异 | `git diff --check` | 无空白错误 |
