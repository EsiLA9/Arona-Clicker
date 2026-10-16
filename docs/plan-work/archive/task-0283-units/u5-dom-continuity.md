# Unit task-0283-u5-dom-continuity：保持输入、列表、详情宿主与浮层锚点连续；连续历史恢复阅读位置。

## Goal

保持输入、列表、详情宿主与浮层锚点连续；连续历史恢复阅读位置。

## Must Read / Read Set

[[docs/plan-work/archive/task-0283-super-codex-phase-b-friendly-workspace]]、[[docs/ai/PROJECT-CONSTITUTION]]、[[docs/ai/frontend-design-project-overlay]]；下列 Allowed Files 及直接接口。

## Allowed Files

- `src/ui/runtime-editor/actions.ts`
- `src/ui/runtime-editor/codex/dom-updates.ts`
- `docs/plan-work/archive/task-0283-units/receipts/receipt-task0283-u5-dom-continuity.md`

## Constraints / Explicit Non-goals

预算3–5文件、500行净改动；不改变编辑器会话／玩法／存档；按父Task DOM合同与scope更新，不刷新图谱。停止条件遵循PROJECT-CONSTITUTION，超范围由主线程拆分。

## Verification / Completion Criteria

`npx vitest run --silent tests/ui/runtime-editor-codex-integration.test.ts tests/ui/runtime-editor-codex-shell.test.ts`；主线程运行类型与架构检查，填写实际Receipt。
