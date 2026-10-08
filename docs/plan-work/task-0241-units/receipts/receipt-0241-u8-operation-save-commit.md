# Receipt 0241-U8：角色 Hand 的 Run、恢复与 Commit

## Result

Completed. Standard tactical Runs now retain Run-local Actor position and detached per-student Character Hands. Hands are resolved from current context at start, after successful Beat or SceneAction commits, and after Location entry. Preparation and the pure Commit planner use the same detached Profile projection of each committed Hand. Position changes and the resulting Hand are installed only by replacing the completed Run clone after all validation succeeds.

Save restore re-resolves each active Run's Hand from current frozen content, context, and committed beat index, then requires an exact match with the saved Hand. It does not draw or advance the tactical RNG cursor. Hands remain a distinct field from `playerRouteState.cards`.

## Modified paths

- `src/arona-clicker/contracts/operation.ts`
- `src/arona-clicker/services/operation-runtime-service.ts`
- `tests/engine/operation-runtime-service.test.ts`
- `tests/engine/gameplay-b-save-resume.test.ts`

## Verification

- `npx vitest run tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-save-resume.test.ts` — 36 passed.
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed (only existing line-ending notices).

Behavior checks include back→front Pool re-resolution, rejecting an Action outside the current Hand, preserving Hands and RNG after preview/rejected commands, exact Save/Resume continuation, and rejecting a tampered saved Hand. Existing gameplay sample expectation now records `tacticalCursor: 0` for this encounter because the independent Character Hand draw does not advance the tactical stream; the Runtime test suite separately verifies persistence of a non-zero tactical skill cursor.

## Boundary

No View projection or UI presentation was changed; U9 owns the detached diagnostics projection.
