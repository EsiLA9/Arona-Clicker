import type { OperationRunVersionCommand } from './operation';

/** One performer selects one trusted location-scoped action; target IDs are checked against its ActionDef. */
export interface OperationSceneActionSelection {
  readonly sceneActionId: string;
  readonly actorId: string;
  readonly targetActorIds: readonly string[];
}

export interface OperationSceneCardSelection {
  readonly cardInstanceId: string;
  readonly actorId: string;
  readonly targetActorIds: readonly string[];
}

/** A complete atomic scene batch. No cost or effect values are accepted from the caller. */
export interface OperationSceneActionBatchCommand extends OperationRunVersionCommand {
  readonly selections: readonly OperationSceneActionSelection[];
  readonly cards?: readonly OperationSceneCardSelection[];
}

export interface OperationSceneActionCostPreview {
  readonly balanceBefore: number;
  readonly totalCost: number;
  readonly balanceAfter: number;
}

export interface OperationSceneActionBatchPreview {
  readonly runId: string;
  readonly eventId: string;
  readonly basePlanVersion: number;
  readonly locationId: string;
  readonly actionMode: 'individual' | 'global';
  readonly selections: readonly OperationSceneActionSelection[];
  readonly cards: readonly (OperationSceneCardSelection & { readonly actionId: string; readonly playerCost: number })[];
  readonly cost: OperationSceneActionCostPreview;
  readonly sceneActionBatchesUsed: number;
  readonly sceneActionBatchesLimit: number;
}
