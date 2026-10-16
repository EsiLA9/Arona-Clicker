# Unit task-0283-u6-navigation-regression：验证分类、跨范围连续导航、50条历史及DOM身份／输入法／scroll保留。

## Goal

验证分类、跨范围连续导航、50条历史及DOM身份／输入法／scroll保留。

## Must Read / Read Set

[[docs/plan-work/archive/task-0283-super-codex-phase-b-friendly-workspace]]、[[docs/ai/PROJECT-CONSTITUTION]]、[[docs/ai/frontend-design-project-overlay]]；下列 Allowed Files 及直接接口。

## Allowed Files

- `tests/ui/runtime-editor-codex-integration.test.ts`
- `tests/ui/runtime-editor-codex-dom-updates.test.ts`
- `docs/plan-work/archive/task-0283-units/receipts/receipt-task0283-u6-navigation-regression.md`

## Constraints / Explicit Non-goals

预算3–5文件、500行净改动；不改变编辑器会话／玩法／存档；按父Task DOM合同与scope更新，不刷新图谱。停止条件遵循PROJECT-CONSTITUTION，超范围由主线程拆分。

## Verification / Completion Criteria

`npx vitest run --silent tests/ui/runtime-editor-codex-integration.test.ts tests/ui/runtime-editor-codex-shell.test.ts`；主线程运行类型与架构检查，填写实际Receipt。
