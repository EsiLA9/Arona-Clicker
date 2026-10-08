# Receipt 0241-U12：SceneAction 准入与角色战术候选分离

## Result

Completed within the U12 whitelist. SceneAction and shared `playerSceneDeck` performer admission now checks student participant kind and required capabilities independently of tactical `eligibleActionIds` / Character Hand membership. The Carousel sample still omits its three SceneAction IDs from tactical profile candidate and priority lists.

The sample now verifies that the Carousel Run starts with no SceneAction in student Character Hands, that `team-first-aid` resolves eligible actors and a relation-correct target, that the card action commits for the selected actor, and that the first-aid SceneAction and a legal player card are available again at the exit location.

The former “noIntervention” fixture no longer represents a no-action beat: E1's default preparation uses the first legal Character Hand action. With seed 17, Hoshino's first Hand action is emergency stop; the test now asserts that action and its resolution. Other selected actions retain their own costs and actor-plan assertions. Skill checks are asserted only when Serika's selected action matches the authored signal trigger, and deterministic reruns must match.

## Modified paths

- `src/arona-clicker/services/operation-action-content-validation.ts`
- `tests/engine/gameplay-b-operation-sample.test.ts`

## Verification

- `npx vitest run tests/engine/gameplay-b-operation-sample.test.ts --reporter=dot` — passed, 4/4.
- `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/gameplay-b-card-inspector.test.ts --reporter=dot` — 13 passed, 5 failed. The card inspector file passed; all 5 failures are in the existing Operation Controller UI file:
  - the formal event-flow test expected the selected target actor list `[carousel]`, but received `[]`;
  - mouse/Enter selection of a target alternative threw `OperationInterventionPreviewError` for stale PreparedBeat;
  - drag selection of a legal target threw the same stale PreparedBeat error;
  - keyboard/drag target test found no action face with a legal target;
  - stale `planVersion` test expected one region refresh, but observed zero.

  Each failing controller case reached a started Operation Run; none failed because Carousel start was rejected. UI files are outside U12's whitelist and were not changed.
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed for the U12 modified paths.

## Boundary

No UI, Datapack/sample content, Director U10/U11, or GALHCG paths were modified. The five controller UI test failures are recorded for root review and need a separate UI-scoped decision if they require code changes.
