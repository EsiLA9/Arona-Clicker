# Unit task-0282-u6-published-regression：真实发布包关系回归

## Goal

在隔离内存 GameInstance 装载正式三包，验证查询合同对真实内容成立，不写本地包库或玩家存档。

## Must Read / Read Set

- [[docs/plan-work/archive/task-0282-super-codex-phase-a-reliable-relations]]
- `src/arona-clicker/content/default-datapack.ts`、两份正式 gameplay-b Datapack
- `src/arona-clicker/runtime-game-instance.ts` 的 init / runtimeContentBrowser
- `tests/engine/runtime-content-browser-rules.test.ts`

## Context Budget

目标 10k token 以内；一个测试文件约 100 行，历史 0 篇。

## Optional Read Set

仅失败字段的源契约、验证器和消费者。

## Do Not Read by Default

其它玩法服务、独立编辑器、历史快照。

## Confirmed Facts

正式三包纯 Registry 有 453 个目录条目；内存 GameInstance 接入当前 Runtime 规则补充源后为 480。当前定向审计发现 3 个剧情目标类型和 3 个局部资源多位置误诊断，分别由 U1 / U2 修正。

## Constraints

只读行为回归，不通过修改发布数据或抑制确定诊断使测试通过。

## Allowed Files

- `tests/engine/runtime-content-browser-published-content.test.ts`
- 本 Unit Receipt：`docs/plan-work/archive/task-0282-units/receipts/receipt-task0282-u6-published-regression.md`

## Explicit Non-goals

全量测试、发布内容修订、玩法运行与存档。

## Stop Conditions

采用 PROJECT-CONSTITUTION 六项条件；若测试发现确有坏引用，保留事实并回主线程裁定，不能删断言或篡改内容。

## Completion Criteria

- [ ] 正式内容关键世界／资源／剧情／六类 Operation 关系可查，无已发现的假诊断回归。
- [ ] 测试实际运行通过，Receipt 记录结果。

## Verification

`npx vitest run --silent tests/engine/runtime-content-browser-published-content.test.ts`。
