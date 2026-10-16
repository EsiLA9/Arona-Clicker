# Unit task-0283-u9-detail-regression：详情分类、引用分组和资料语义回归

## Goal / Read Set

详情分类、引用分组和资料语义回归。读取父Task、PROJECT-CONSTITUTION、frontend-design、U3与目标文件；允许定向读真实字段契约和直接消费者。

## Allowed Files

- `tests/ui/runtime-editor-codex-details.test.ts`
- `docs/plan-work/archive/task-0283-units/receipts/receipt-task0283-u9-detail-regression.md`

## Constraints / Explicit Non-goals

预算500行；不改玩法、Schema、写命令或独立编辑器；遵循PROJECT-CONSTITUTION停止条件，超范围由主线程拆分。

## Verification / Completion Criteria

`npx vitest run --silent tests/ui/runtime-editor-codex-details.test.ts`及主线程类型检查；字段与真实消费契约一致，填写实际Receipt，只读地图复核。
