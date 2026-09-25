# Execution Receipt：task-0151-PU-5

## Outcome

Completed. Runtime wiring now routes Reveal and Milestone actions through their respective adapters, and InitService's existing projection lifecycle wrappers reconcile or withdraw both projections. Save restore continues to use those wrappers.

## Changed Files

- `src/arona-clicker/services/information-reveal-adapter.ts`
- `src/arona-clicker/services/milestone-adapter.ts`
- `src/arona-clicker/runtime-wiring.ts`
- `src/arona-clicker/services/init-service.ts`
- `tests/engine/milestone-runtime.test.ts` (new)

## Verification

| Command | Result |
| --- | --- |
| Targeted Vitest: Milestone runtime / adapter, TriggerSystem, and Information Reveal adapter / lifecycle / Save rebuild tests | Passed; 6 files, 39 tests |
| `npx tsc --noEmit` | Passed; exit code 0 |
| `npm run check:architecture` | Passed |
| `git --no-pager diff --check` | Passed; no whitespace errors |

## Findings / Remaining

- Reveal retains its standalone handler behavior; runtime composition installs the combined route after both adapters are constructed.
- Save restore rebuilds unfinished registrations, preserves completed and orphan IDs, and skips completed targets.
- A synchronous event during registration can complete and withdraw the target before the registration call returns. The adapter detects the withdrawn record and immediately withdraws the just-returned registration. The reentry test observes exactly one successful `completeMilestone` mutation and zero remaining target registrations.
- No Save migration, UI, reward, completion event, or generic projection service was added.
