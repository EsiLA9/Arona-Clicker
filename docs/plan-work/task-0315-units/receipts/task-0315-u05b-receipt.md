# Task 0315 U05b Receipt：MapRun 核心测试夹具迁移

## 结果

- 五个核心测试文件中的有效 Action 旧 `effects` / `hpEffects` / `cardEffects` 夹具已改为 `effectProgram`：HP 使用正量 `damage` / `heal`，Actor / Team 资源使用 `resourceChange`，卡牌折扣使用 `prepare.discountSCost`。
- 资源平衡测试显式声明原本默认为 0 的 Map / Actor 余额，保持其既有初始数值；费用、目标、来源事务、Enemy 时序、CardRef 与 MapRun 原子提交断言保留。
- `gameplay-b-map-relations.test.ts` 中关系专用 HP 夹具保留合法的公开 `effectProgram.hpChange`，因为该测试验证声明摘要与 HP 受用关系，且 U05b 不修改摘要实现；这不是旧 Action 数组。当前 `map-effect-summary.ts` 尚未将 damage/heal 转为 HP 声明摘要，留给 U08 支持后再补相应关系摘要核验。
- 卡牌和关系回归从 legacy `effectRecipients` 改读 Program `declaredEffects`，保持对准备目标、Actor / Team 账户受用者和无写入行为的验证。
- 一条手工改写存档 HP 的败北测试在 Damage Receipt 校验后改为断言 `invalid-run` 拒绝：旧测试保留真实成功 Commit 的 Receipt，却人为篡改其 HP 快照；U03b 新规则会发现 Receipt/HP 链不一致，因此这份伪造 checkpoint 不再可当作合法败北恢复。其他目标、击倒和存档断言保持。

## 修改文件

- `tests/engine/gameplay-b-map-run.test.ts`
- `tests/engine/gameplay-b-map-source-transactions.test.ts`
- `tests/engine/gameplay-b-basic-map-p0-p3.test.ts`
- `tests/engine/gameplay-b-map-cards.test.ts`
- `tests/engine/gameplay-b-map-relations.test.ts`
- `docs/plan-work/task-0315-units/task-0315-u05b-core-test-fixtures.md`

## 首次失败与修正

- 首轮五文件执行：79 项通过、13 项失败。失败原因包括新 Program 账户需在 Map 中明确声明余额、卡牌 / 关系断言仍检查旧 `effectRecipients`、一个 actionValue helper 仍读 `effects` 字段，以及合成败北 checkpoint 与 Damage Receipt 不一致。
- 在本 Unit 测试白名单内补充等于旧默认值的 0 余额、改用 Program `declaredEffects`、从新 resourceChange 读取测试数值，并按 Receipt 规则更新伪造 checkpoint 断言。

## 验证

- `npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-basic-map-p0-p3.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-relations.test.ts --reporter=dot --silent`：通过，5 个测试文件、92 项测试。
- `git --no-pager diff --check`（五个测试文件）：通过；仅有既存 `CRLF will be replaced by LF` 提示。
- `rg -n "hpEffects|cardEffects|effects:"` 对上述五个文件无匹配。

## 边界

- 未改产品源码、摘要实现、Schema 或 Receipt 验证器；damage/heal 的 relation declaration summary 待 U08。
