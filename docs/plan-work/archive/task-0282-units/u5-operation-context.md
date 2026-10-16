# Unit task-0282-u5-operation-context：拆出 Operation owner 上下文与局部声明定位，保持提取行为不变。

## Goal

拆出 Operation owner 上下文与局部声明定位，保持提取行为不变。

## Must Read / Read Set

- [[docs/plan-work/archive/task-0282-super-codex-phase-a-reliable-relations]]
- [[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/testing]]、[[docs/ai/PROJECT-CONSTITUTION]]
- `src/data-services/contracts/operation.ts`
- `src/data-services/registry/runtime-content-reference-types.ts`
- `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`
- `src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts`

## Context Budget

目标上下文 10k–30k token；历史文档 0；通常 3–5 文件、300–500 行净改动。超预算先由主线程拆分，不自行扩大。

## Optional Read Set

按实际引用字段读取对应契约及直接消费者；新增超过 2 个未列路径先上报主线程。

## Do Not Read by Default

独立编辑器、历史快照、无关 Runtime 服务及全仓源码。

## Confirmed Facts

OperationActor／Objective 等为 owner 局部对象，OperationAction 等为顶层定义；见 contracts/operation.ts。

## Constraints

只读查询，不改变定义契约／Schema／玩家状态；遵守父 Task 边界。规则模块接口由主线程协调，禁止其它代理同时写同一文件。

## Allowed Files

- `src/data-services/registry/runtime-content-operation-context.ts`

- 本 Unit 的 Receipt：`docs/plan-work/archive/task-0282-units/receipts/receipt-task0282-u5-operation-context.md`

## Explicit Non-goals

阶段 B 界面重塑、阶段 C 编辑器迁入、完整来源台账、玩法规则及发布数据修改。

## Stop Conditions

采用 PROJECT-CONSTITUTION 六项停止条件；向主线程报告可独立完成的进展，不覆盖其它工作区修改。

## Completion Criteria

- [ ] Goal 对应行为及回归可验证，保留未知内容与路径。
- [ ] 指定定向测试通过，主线程完成集成类型／架构验证。
- [ ] Receipt 记录实际修改、测试、限制及只读地图复核。

## Verification

`npx vitest run --silent tests/data/runtime-content-operation-references.test.ts`；主线程另运行 `npx tsc --noEmit` 与 `npm run check:architecture`。UI 验收由主线程协调。

