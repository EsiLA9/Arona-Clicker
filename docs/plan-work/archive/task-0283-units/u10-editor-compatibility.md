# Unit task-0283-u10-editor-compatibility：原编辑器导出回归夹具对齐

## Goal / Confirmed Facts

B要求保留原Editor流程。现有pack-export测试两处UIContext夹具只有escapeHtml，缺少game；现有目标包选择器在HEAD中已经读取ctx.game.getPackCatalog，导致回归在渲染前失败。仅补齐夹具的真实只读合同，不改生产导出流程。

## Allowed Files / Read Set

- `tests/ui/runtime-editor-pack-export.test.ts`
- `src/ui/runtime-editor/view.ts`、actions.ts（只读确认接口）
- `docs/plan-work/archive/task-0283-units/receipts/receipt-task0283-u10-editor-compatibility.md`

## Constraints / Verification

遵循PROJECT-CONSTITUTION停止条件；不改导出格式、玩家状态或包库。`npx vitest run --silent tests/ui/runtime-editor-pack-export.test.ts`通过；记录本次夹具修正及结果。
