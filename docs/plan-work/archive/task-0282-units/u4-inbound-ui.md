# Unit task-0282-u4-inbound-ui：修复反向关系端点并保留原始边／局部位置，在现有界面验证跳转。

## Goal

修复反向关系端点并保留原始边／局部位置，在现有界面验证跳转。

## Must Read / Read Set

- [[docs/plan-work/archive/task-0282-super-codex-phase-a-reliable-relations]]
- [[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/testing]]、[[docs/ai/PROJECT-CONSTITUTION]]
- `src/ui/runtime-editor/view.ts`
- `src/ui/runtime-editor/codex-details/types.ts`
- `src/ui/runtime-editor/codex-details/render.ts`
- `src/data-services/contracts/runtime-content-browser.ts`
- `tests/ui/runtime-editor-codex-integration.test.ts`

## Context Budget

目标上下文 10k–30k token；历史文档 0；通常 3–5 文件、300–500 行净改动。超预算先由主线程拆分，不自行扩大。

## Optional Read Set

按实际引用字段读取对应契约及直接消费者；新增超过 2 个未列路径先上报主线程。

## Do Not Read by Default

独立编辑器、历史快照、无关 Runtime 服务及全仓源码。

## Confirmed Facts

inspectorView 的 reverseReferences 当前与 outgoing 同用 target 端点，见 view.ts。

## Constraints

只读查询，不改变定义契约／Schema／玩家状态；遵守父 Task 边界。规则模块接口由主线程协调，禁止其它代理同时写同一文件。

## Allowed Files

- `src/ui/runtime-editor/view.ts`
- `src/ui/runtime-editor/codex-details/types.ts`
- `tests/ui/runtime-editor-codex-integration.test.ts`
- 本 Unit 的 Receipt：`docs/plan-work/archive/task-0282-units/receipts/receipt-task0282-u4-inbound-ui.md`

## Explicit Non-goals

阶段 B 界面重塑、阶段 C 编辑器迁入、完整来源台账、玩法规则及发布数据修改。

## Stop Conditions

采用 PROJECT-CONSTITUTION 六项停止条件；向主线程报告可独立完成的进展，不覆盖其它工作区修改。

## Completion Criteria

- [ ] Goal 对应行为及回归可验证，保留未知内容与路径。
- [ ] 指定定向测试通过，主线程完成集成类型／架构验证。
- [ ] Receipt 记录实际修改、测试、限制及只读地图复核。

## Verification

`npx vitest run --silent tests/ui/runtime-editor-codex-integration.test.ts`；主线程另运行 `npx tsc --noEmit` 与 `npm run check:architecture`。UI 验收由主线程协调。

