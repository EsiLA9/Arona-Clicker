# Receipt 0241-E1：Operation Runtime 与 GALHCG

## Result

Completed. E0 decisions and U1–U9 engine/runtime Units are implemented within the approved Operation scope. Candidate resolution, strategy weighting, Character Hand draw/selection, position re-resolution, save/resume and detached View diagnostics are covered by focused behavior tests. The final cross-Unit run passed 147 tests; `npx tsc --noEmit` and `git diff --check` passed.

## GALHCG updates

- Project `acprogram` was resolved against the workspace root and refreshed for the 34 direct engine/schema/test paths.
- Updated Evidence for `concept:operation-event-run-runtime`, `concept:operation-student-profile-admission`, `concept:datapack-to-registry-flow`, and `module:data-services`; updated maps_to relationships for E1 source, generated schema and tests. Added maps_to evidence for the new candidate resolver and its test and for the new OperationView projector test. Preserved the existing Runtime → Registry dependency and refreshed its resolver evidence.
- The narrow `src/engine/core/entity-id.ts` identity vocabulary extension maps to Registry and ContentAuthoringPolicy; its existing Runtime Datapack Editor UI mapping remains semantically accurate. No Editor behavior, UI, or schema metadata was changed.
- No new Concept was needed. The SOL proposal is still represented by the Task; this receipt does not promote it into current mechanism documentation.

## Non-E1 owners checked

For each owner below, the relationship still describes the code after E1; only its Evidence version token was refreshed. No relation, summary, endpoint, or owner meaning needed revision:

- `module:data-services` → E1-touched Datapack/Registry contract and implementation files; Data Services continues to own the Registry definitions and their registration.
- `Operation EventRun Runtime → src/data-services/contracts/operation.ts`; the file still declares Operation runtime content contracts.
- `Operation Student Profile Admission → src/arona-clicker/contracts/operation.ts`; the file still declares actor profile/content handoff contracts.
- `Operation Student Profile Admission → CharacterSystem` and `→ Roster and Character Acquisition`; Admission continues to use these character identity and roster sources.
- `ContentAuthoringPolicy → Registry` and `Data Services → Registry`; the authoring-to-registry dependency and module ownership remain unchanged.
- `RuntimeContentCoordinator → Registry`; the existing Runtime registry lifecycle dependency remains unchanged.
- `ContentAuthoringPolicy → src/engine/core/entity-id.ts` and `Runtime Datapack Editor UI → src/engine/core/entity-id.ts`; both existing consumers still rely on the shared entity type vocabulary.
- `module:datapack-editor` and `Registry → tools/datapack-editor/schema/engine-defs.gen.json`; the generated schema remains downstream of Engine/Registry contracts. Editor implementation and metadata were outside this Unit.

The reviewed stale owners were updated by Evidence-only upserts after plan and valid dry-run. Final `review_changes` over all 34 direct E1 engine/schema/test paths returned no stale Evidence or metadata references. The review did not request broader filesystem-owner changes.

## Verification and handoff

- GALHCG `plan_map_updates` was complete for each batch; each batch was committed only after `update_map` returned `valid: true` on dry-run.
- `review_changes` confirmed the new/updated E1 mappings against current file versions. Remaining work belongs to Director D1/D2: independent gameplay content, a no-browser virtual play path, content-level abstraction review and that content phase's GALHCG updates. Run roster remains fixed; dynamic actor joining is explicitly unreplicated and is not an engine gap in this Task.
- Strategy bias uses E0's linear additive deviation from 10000 BPS, not multiplication across matching tags; Director content and transcripts should describe examples with that formula.
