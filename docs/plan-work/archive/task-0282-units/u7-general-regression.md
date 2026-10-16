# Unit task-0282-u7-general-regression：通用引用语义回归

## Goal

补充关键行为回归，验证提取规则的契约语义与不确定边界。

## Must Read / Read Set

- [[docs/plan-work/archive/task-0282-super-codex-phase-a-reliable-relations]]
- 对应 u1-general-rules 规则模块与指定测试。

## Context Budget

继承规则 Unit 已核对上下文；仅一个测试文件，300 行以内，历史 0 篇。

## Optional Read Set

实际失败字段的源契约／消费者。

## Do Not Read by Default

全仓、历史快照、独立编辑器。

## Confirmed Facts

规则 Unit 的测试需同时覆盖合法目标、缺失或多候选、owner 与候选隔离；未知字段不能冒充确定错误。

## Constraints

不删掉揭示真实问题的断言，不修改源定义或发布包让测试通过。

## Allowed Files

- `tests/data/runtime-content-reference-rules.test.ts`
- 本 Unit Receipt：`docs/plan-work/archive/task-0282-units/receipts/receipt-task0282-u7-general-regression.md`

## Explicit Non-goals

生产实现、UI、存档／发布内容修改。

## Stop Conditions

采用 PROJECT-CONSTITUTION 六项停止条件；新发现由主线程协调，不改其它代理文件。

## Completion Criteria

- [ ] 对应规则行为与边界有有效回归并通过。
- [ ] Receipt 记录实际命令、结果及未覆盖边界。

## Verification

`npx vitest run --silent tests/data/runtime-content-reference-rules.test.ts`。
