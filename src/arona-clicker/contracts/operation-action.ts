export type {
  OperationActionCostDef,
  OperationActionDef,
  OperationActionEffectDef,
  OperationActionTargetDef,
  OperationActionTargetRelation,
  OperationCombinationRuleDef,
  OperationCombinationTargetMatch,
  OperationLocationDef,
  OperationRouteEdgeDef,
  OperationSceneActionDef,
  OperationSceneActionMode,
} from '../../data-services/contracts/operation';

/** One disjoint pair selected by the current Location's deterministic Combination ordering. */
export interface OperationCombinationMatch {
  readonly ruleId: string;
  readonly priority: number;
  readonly actorAId: string;
  readonly actorBId: string;
  readonly actionAId: string;
  readonly actionBId: string;
  readonly targetActorId: string | null;
}

/** Detached Combination projection tied to the exact base Beat it consumed. */
export interface OperationCombinationPreview {
  readonly planVersion: number;
  readonly locationId: string;
  readonly matches: readonly OperationCombinationMatch[];
}

export type { OperationActorKind } from '../../data-services/contracts/operation';
