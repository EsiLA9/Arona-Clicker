# Receipt 0241-U11：Strategy Park headless virtual play

## Result

**Completed — real Runtime replay and deterministic repeat passed.** Added a test-driven human decision script and readable transcript for the U10 Strategy Park Event. The script constructs the default Datapack + independent Strategy Park Datapack, acquires the fixed roster, starts through the Registry-backed `OperationEntryFacade`, and makes every scene, battle, and route choice through the existing facade. No browser, UI, Editor, engine changes, CLI dependency, or resolver mock is involved.

## Human-editable decisions

The command list is `DECISION_SCRIPT` near the top of `tests/engine/gameplay-b-strategy-park-virtual-play.test.ts`:

- Seed is the fixed Event seed `241024`.
- At the kiosk, choose the Arcade route; at the Ferris maintenance corridor, choose the pass-gated Fireworks route.
- Submit specific SceneActions with explicit performer and targets, including the Negotiation request for a maintenance pass.
- On the first Beat of each battle stage, choose Hoshino `stepForward`, Hoshino `frontGuard` on Serika, and Serika `quickShot` on the boss. The selected Action must be in that Actor's current Hand; Operation's canonical default plan handles the other Actors and is shown in the transcript.

To explore another route or card, edit the corresponding route, scene, or beat command in that object and rerun the test. This is a deterministic Vitest scenario script, not an interactive terminal CLI.

## Transcript contents

For each visited location, the transcript prints scene/activity Context, available routes, current actor position and weapon, Character/Profile Strategy biases, matched Pools, candidate eligibility/filter reason, source Pool, base weight, Strategy factor and final weight, and the current Hand. It separately records:

- SceneAction wrapper selection, explicit targets, PlayerCost and scene Resolution.
- Per Beat human Intervention when present, canonical plan for every Actor, target and cost, Resolution deltas, and Position changes.
- Automatic and player-selected route transitions, including required/consumed items.
- Final status, achieved objective, route history, combat Beat counts, Event facts/items and resolution count.

Negotiation is reported accurately: Hoshino and Serika's Hand diagnostics show the `negotiation` Pool and different Strategy factors for `deescalate`; the selected request-for-pass action is actually committed through the Location's SceneAction wrapper. The transcript explicitly says the SceneAction command is the submission entry point; it does not imply that a social action is submitted directly from Character Hand.

The final Exit has a dedicated selector-matched `handoff` Pool from the U10 correction. The transcript shows that pool and does not report legacy fallback at `social/handoff`.

## Abstract gameplay review

- Context scopes candidate Pool matching across combat, exploration, recovery and social/negotiation locations.
- Pool entries reference the same Operation Actions used by Beat plans or Location SceneActions; there is no separate combat or social AI.
- Strategy affects weights and Hand draw only. The chosen SceneAction still uses the existing scene wrapper; the chosen battle intervention must be present in the current Hand and passes normal target/cost validation.
- Hoshino's `stepForward` resolution changes position from back to front; the following Hand reports the frontline Pool and front-only action.
- Fixed roster and no runtime Actor join are explicitly surfaced as BDemo omissions. Runtime-injected/random ActionPools also remain out of scope.
- The full route visits all 12 locations and resolves three combat stages, Negotiation, recovery/exploration activities, a route branch, a held-item gate and an objective-backed final handoff. This is enough to manually inspect the copied route beats and the new Strategy/Pool loop; it does not claim exact parity with the prototype's provisional enemy AI, random skill, camp modifiers or combat recipes.

## Verification

- `npx vitest run tests/engine/gameplay-b-strategy-park-virtual-play.test.ts --reporter=verbose` — passed; the complete transcript was emitted by the test. The test runs the scenario twice and asserts equality of the full transcript and summary for the same seed and decisions.
- Replay summary: all 12 locations visited; route included Arcade/Negotiation, the pass-gated Fireworks route, and final handoff; combat Beat counts were 3 / 3 / 4; 19 Operation Resolutions; terminal status `success`; primary objective achieved.
- `npx tsc --noEmit` — passed after the U10 handoff Pool follow-up.
- `git --no-pager diff --check` — passed; only existing worktree line-ending notices were reported.

No GALHCG data-stage updates were made. Task Owner review is required before D1/D2 map batches.
