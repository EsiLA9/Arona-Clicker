# Unit 0241-U6：actorPosition 作者合同与准入校验

## Goal

为 Operation Action 增加有限的 `actorPosition` Effect 作者定义，并在静态定义与 Event/Action 准入时拒绝 malformed 或缺少目标的定义。本 Unit 只建立作者合同和准入边界；纯 Resolution delta 由依赖本 Unit 的 U7 实现。

## Constraints

- Effect 仅允许 `recipient: actor | target` 与非空 `positionId`。
- Action 的既有 `strategyTagIds` 字段通过 Tactical definition validator 做非空且唯一的 ID 校验。
- actor 是当前执行者，target 使用既有 Actor target contract；target recipient 必须有 Actor target。
- position 是 Run-local 状态，不更改 Character 长期数据、武器或其他事实。
- U6 必须先于 U7；U7 只消费此处确定的合同，不重新定义作者字段。

## Allowed Files

- `src/data-services/contracts/operation.ts`
- `src/arona-clicker/services/operation-tactical-definition-validation.ts`
- `src/arona-clicker/services/operation-action-content-validation.ts`
- `tests/engine/operation-participant-admission.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json` (generator output only)

## Verification

- actorPosition actor recipient 被接受；未知字段、空 positionId、非法 recipient 被拒绝。
- Action 的 `strategyTagIds` 合法字段被 Admission 接受；空 ID/重复 ID 被 Definition validator 拒绝。
- target recipient 没有 actor target 时 Admission 拒绝，不能部分准入。
- `npx vitest run tests/engine/operation-participant-admission.test.ts`
- `npx tsc --noEmit`（若 union 引起 Planner exhaustiveness，立即继续 U7 并联验收。）
- `npm run gen:schema` followed by `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts`

## Receipt

见 `receipts/receipt-0241-u6-operation-position-effect-contract.md`。
