# Unit 0241-U7：纯 Resolution Position Delta

## Goal

消费 U6 已定型的 `actorPosition` Effect，在纯 Operation Resolution Planner 中形成可验证的字符串位置变化计划，不直接写 Run。

## Dependencies and boundaries

- Depends on U6 author union and Admission validation.
- U7 owns only the planner contract, planner, and planner tests. Runtime ownership, save/resume, atomic installation, and post-commit hand re-resolution belong to U8.
- Position is an explicit Operation-local actor fact. Do not add arbitrary facts, weapon changes, or other Position semantics.

## Allowed Files

- `src/arona-clicker/contracts/operation-resolution.ts`
- `src/arona-clicker/services/operation-resolution-planner.ts`
- `tests/engine/operation-resolution-planner.test.ts`

## Acceptance

- Actor recipient plans source actor position; target recipient plans the resolved target actor position.
- Missing target / unknown actor / malformed effect produces no partial delta.
- Position deltas are detached and planner does not mutate the input snapshot.
- Repeated effects for one actor have deterministic before/after and source ordering.

## Verification

- `npx vitest run tests/engine/operation-resolution-planner.test.ts`
- `npx tsc --noEmit`

## Receipt

见 `receipts/receipt-0241-u7-operation-position-resolution.md`。
