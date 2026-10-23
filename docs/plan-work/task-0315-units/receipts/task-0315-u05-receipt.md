# Task 0315 U05 Receipt：旧金样转新语义回归

状态：completed

## 实际修改

- `tests/engine/gameplay-b-effect-legacy-goldens.test.ts`：将旧 HP 数组改写为冻结的新节点，负值转正数 `damage`，正值转正数 `heal`；将 Team 资源变更改为 `resourceChange(account: 'sourceTeam')`；将旧卡牌费用折扣改为 `effectProgram.prepare.discountSCost`。
- 改写后的程序按显式列表顺序表达效果；原来的组合字段用例现声明 `damage` 后 `resourceChange`。原来该来源因 `noLegalTarget` 被跳过，断言仍验证费用和全部程序效果均未安装。
- 将 Source Order、Source Phase、Save Continuation 的标题改为 Program 行为表述；保留旧金样编号、回合结算、费用、倒地目标、Enemy skip、CardRef 折扣、Ability/Item 原子扣除及保存恢复断言目的。
- `tests/engine/gameplay-b-effect-card-prepare.test.ts`：移除仅覆盖旧 `cardEffects` 混用拒绝的案例，改为验证新 Program prepare 确实降低所选卡的 Actor `sCost`，但 `PlayerCost` 不变；将未激活 Hand 卡目标用例改用 Program prepare，保留真实 Owner CardRef 和不向另一张执行卡转移折扣的断言。
- 未修改产品文件。

## 阻塞与后续

- U01 AST / Syntax 已在工作树提供 `{op:'damage'|'heal', target:'primary', amount}` 语法；U02 Planner 及 U03 Owner 安装仍未完成。
- 初期因 U02 Planner / U03 Owner 未完成，U05 测试暂缓；负责人完成 U03 后继续验证并关闭本 Unit。

## 验证

- `npx vitest run tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-effect-card-prepare.test.ts`：通过，2 个文件、20 项测试。
- `git --no-pager diff --check -- tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-effect-card-prepare.test.ts`：通过。
