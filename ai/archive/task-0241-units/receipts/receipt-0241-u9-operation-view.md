# Receipt 0241-U9：OperationView 角色 Hand 诊断

## Result

Completed. OperationView now projects the current Actor position and stored Character Hand diagnostics, including selected Action IDs, matched Pool IDs, candidate eligibility/reasons, source Pools, base weight, Strategy factor, and final weight. Projector copies every Hand array into the detached View. Character Hands remain separate from `playerCards`.

## Modified paths

- `src/arona-clicker/contracts/operation-view.ts`
- `src/arona-clicker/services/operation-view-projector.ts`
- `tests/engine/operation-view-projector.test.ts`

## Verification

- `npx vitest run tests/engine/operation-view-projector.test.ts` — 1 passed.
- The Runtime-to-View test confirms an authored Strategy bias of 12000 bps projects as a 12000 bps factor and changes weight 5 to 60000; the stored Run and tactical RNG remain unchanged after View reads and mutations to a detached copy.
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed (only existing line-ending notices).

## Boundary

No UI component or presentation code changed. Director phase owns any on-screen rendering or virtual-play interface.
