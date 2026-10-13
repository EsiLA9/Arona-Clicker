import type { OperationRunVersionCommand } from './operation';
import type { OperationPreparedActorPlan } from './operation-beat';
import type { OperationResolutionIntervention } from './operation-resolution';

/** One performer selects one trusted location-scoped action; target IDs are checked against its ActionDef. */
export interface OperationSceneActionSelection {
  readonly sceneActionId: string;
  readonly actorId?: string;
  readonly targetActorIds: readonly string[];
}

export interface OperationSceneCardSelection {
  readonly cardInstanceId: string;
  readonly actorId?: string;
  readonly targetActorIds: readonly string[];
}

/** Selecting this ID requests one purchase; all price and effect data stay in trusted content. */
export interface OperationScenePurchaseSelection {
  readonly offerId: string;
}

/** A complete atomic scene batch. No cost or effect values are accepted from the caller. */
export interface OperationSceneActionBatchCommand extends OperationRunVersionCommand {
  readonly selections: readonly OperationSceneActionSelection[];
  readonly cards?: readonly OperationSceneCardSelection[];
  readonly purchases?: readonly OperationScenePurchaseSelection[];
  /** Explicitly applies the existing skip-batch behavior; it cannot carry selectable offers. */
  readonly skip?: true;
}

/** Ephemeral Scene-local selection value; it carries no trusted costs or effects. */
export interface OperationScenePlan extends OperationRunVersionCommand {
  readonly eventId: string;
  readonly locationId: string;
  readonly sceneId: string;
  readonly selections: readonly OperationSceneActionSelection[];
  readonly cards: readonly OperationSceneCardSelection[];
  readonly purchases?: readonly OperationScenePurchaseSelection[];
  readonly skip?: boolean;
}

export interface OperationSceneActionCostPreview {
  readonly balanceBefore: number;
  readonly totalCost: number;
  readonly balanceAfter: number;
}

export interface OperationSceneActionResourceCostPreview {
  readonly actorId: string;
  readonly actionId: string;
  readonly scope: 'actor' | 'team';
  readonly scopeId: string;
  readonly resourceId: string;
  readonly amount: number;
}

export interface OperationSceneActionBatchPreview {
  readonly runId: string;
  readonly eventId: string;
  readonly basePlanVersion: number;
  readonly locationId: string;
  readonly sceneId: string;
  /** Lightweight value projection used for pure preview; never stored as a second owner state. */
  readonly plan: OperationScenePlan;
  readonly actionMode?: 'individual' | 'global';
  readonly selections: readonly OperationSceneActionSelection[];
  readonly cards: readonly (OperationSceneCardSelection & { readonly actionId: string; readonly playerCost: number })[];
  readonly purchases?: readonly (OperationScenePurchaseSelection & {
    readonly actionId: string;
    readonly playerCost: number;
    readonly purchaseFactId: string;
  })[];
  readonly skip?: boolean;
  readonly cost: OperationSceneActionCostPreview;
  /** Actor/Team resource costs from ActionDef, previewed with PlayerCost in one transaction. */
  readonly actionCosts: readonly OperationSceneActionResourceCostPreview[];
  readonly sceneActionBatchesUsed: number;
  /** null means the current Scene has no authored batch ceiling. */
  readonly sceneActionBatchesLimit: number | null;
  /** Present only for Scenes with autoCharacterActions enabled. */
  readonly actorPlans?: readonly OperationPreparedActorPlan[];
  /** The single Scene Intervention preview, or null when there is no override. */
  readonly intervention?: OperationResolutionIntervention | null;
}

/** Runtime-owned, explicitly staged player batch. The preview preserves its accepted fee snapshot. */
export interface OperationSceneActionBatchDraft {
  readonly command: OperationSceneActionBatchCommand;
  readonly preview: OperationSceneActionBatchPreview;
}
