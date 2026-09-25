# Execution Receipt：task-0151-PU-4

## Outcome

Completed. Added Milestone-specific capability analysis and a narrow EB-T adapter. Supported definitions derive deterministic desired watches, register precise wake filters, re-read and evaluate the full condition on wake, then commit through StateMutationService and withdraw their registrations.

## Changed Files

- `src/engine/effect/trigger-system.ts`
- `src/arona-clicker/services/milestone-domain.ts` (new)
- `src/arona-clicker/services/milestone-adapter.ts` (new)
- `tests/engine/trigger-system.test.ts`
- `tests/engine/milestone-adapter.test.ts` (new)

## Verification

| Command | Result |
| --- | --- |
| `npx vitest run tests/engine/trigger-system.test.ts tests/engine/milestone-adapter.test.ts --silent` | Passed; 2 files, 23 tests |
| `npx tsc --noEmit` | Passed; exit code 0 |
| `npm run check:architecture` | Passed |
| `git --no-pager diff --check` | Passed; no whitespace errors |

## Findings / Remaining

- `resource` watch derivation rejects global resource IDs because the Condition evaluator reads per-Init `resources`; `spotLevel` and story watches use their exact existing ID filters. `alwaysTrue` remains admission-only.
- The runtime action route is composed in PU-5 so this Unit does not replace Reveal's existing handler.
- Registration keys are retained only after registration succeeds; if synchronous reentry completes the target during registration, the returned registration is withdrawn immediately after registration returns.
- No new event kind, completion event, polling loop, or shared reactive-condition service was added.
