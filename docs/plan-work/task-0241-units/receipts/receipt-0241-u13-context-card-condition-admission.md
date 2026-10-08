# Receipt 0241-U13：Context 与 CardCondition Admission 闭环

## Result

Completed within the U13 whitelist. Runtime Event validation now accepts Location `interactionSceneId`, `activityId`, and `cardPoolIds`, while checking context IDs are non-empty and Pool IDs are unique. Runtime Action validation now accepts `cardCondition` and closes it to the six E1 selector/Event Fact fields; every supplied field must be a unique, non-empty ID array.

The added Admission test loads the existing Strategy Park Datapack through the standard Registry resolver and starts it through `OperationEntry.start()`. It separately checks that the exploration Pool matches while the combat/backline Pool does not, then checks that `searchMaze` is present in the matched exploration Pool but filtered from the Hand because its Activity Condition does not match the briefing Location. The matching `brief` Action enters Hoshino's Hand. Admission rejects malformed condition arrays, unsupported selector fields, Event Fact references absent from the Event, blank Location context IDs, and duplicate Location Pool IDs.

## Modified paths

- `src/arona-clicker/services/operation-definition-validation.ts`
- `src/arona-clicker/services/operation-tactical-definition-validation.ts`
- `tests/engine/operation-participant-admission.test.ts`

## Verification

- `npx vitest run tests/engine/operation-participant-admission.test.ts tests/engine/gameplay-b-strategy-park-sample.test.ts tests/engine/gameplay-b-operation-sample.test.ts --reporter=dot` — passed, 25/25 (independently rerun after U13 completion).
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed for U13 code/test paths.

## Boundary and handoff

No Registry resolver, Data Services validator, Schema, sample content, UI, Editor, Director U10/U11, or GALHCG map was modified. The existing Registry resolver already carries Location definitions and referenced Action/CardPool definitions into Admission; the missing links were the two runtime closed-field validators. GALHCG Engine Evidence/maps_to refresh is a separate required stage before Director resumes; this Unit records the relevant changed paths for that increment but does not execute it.
