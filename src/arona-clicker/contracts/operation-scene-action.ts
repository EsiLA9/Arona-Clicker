import type { OperationRunVersionCommand } from './operation';

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
  readonly actionMode: 'individual' | 'global';
  readonly selections: readonly OperationSceneActionSelection[];
  readonly cards: readonly (OperationSceneCardSelection & { readonly actionId: string; readonly playerCost: number })[];
  readonly cost: OperationSceneActionCostPreview;
  /** Actor/Team resource costs from ActionDef, previewed with PlayerCost in one transaction. */
  readonly actionCosts: readonly OperationSceneActionResourceCostPreview[];
  readonly sceneActionBatchesUsed: number;
  readonly sceneActionBatchesLimit: number;
}

/** Runtime-owned, explicitly staged player batch. The preview preserves its accepted fee snapshot. */
export interface OperationSceneActionBatchDraft {
  readonly command: OperationSceneActionBatchCommand;
  readonly preview: OperationSceneActionBatchPreview;
}
