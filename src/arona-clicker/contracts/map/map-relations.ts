import type { MapRunEncounterDraftToken } from './map-run';
import type { MapRunCardRef } from './map-cards';
import type { GameplayMapEffectConditionDef, GameplayMapEffectTargetSetDef, GameplayMapEffectValueDef } from '../../../data-services/contracts/gameplay-map-effects';

/** Logical context, independent of DOM placement and display copies. */
export interface MapRelationScope {
  readonly runId: string;
  readonly mapId: string;
  readonly nodeId: string;
  readonly activityId: string | null;
  readonly round: number;
}

export interface MapUnitRef {
  readonly scope: MapRelationScope;
  readonly kind: 'partyCharacter' | 'enemy';
  readonly id: string;
}

export type MapRelationTeamSide = 'party' | 'enemy';

/** Selectable domain objects; a card is never a unit performer. */
export type MapTargetRef = MapUnitRef | MapRunCardRef;

/** A prepared behavior / player source, not a newly minted combat card instance. */
export interface MapRelationSource {
  readonly kind: 'preparedAction' | 'ability' | 'item' | 'enemy';
  readonly id: string;
  readonly actionId: string | null;
  readonly performer: MapUnitRef | null;
}

/** One path in a declaration-only effect summary; it does not assert execution. */
export interface MapDeclaredEffectBranch {
  readonly whenPath: string;
  readonly conditionPath: string;
  readonly branch: 'then' | 'else';
  readonly condition: GameplayMapEffectConditionDef;
}

interface MapDeclaredEffectSummaryBase {
  readonly declaration: 'declared';
  readonly certainty: 'unconditional' | 'conditional';
  readonly path: string;
  /** Outer-to-inner branch choices needed to reach this leaf. */
  readonly branches: readonly MapDeclaredEffectBranch[];
}

export type MapDeclaredEffectSummary = MapDeclaredEffectSummaryBase & (
  | {
    readonly kind: 'hp';
    readonly target: 'source' | 'primary';
    readonly delta: number;
    readonly recipient: MapUnitRef | null;
  }
  | {
    readonly kind: 'damage' | 'heal';
    readonly target: 'primary' | 'set';
    readonly set?: GameplayMapEffectTargetSetDef;
    readonly amount: number | GameplayMapEffectValueDef;
    readonly repeat?: number | GameplayMapEffectValueDef;
    readonly recipient: MapUnitRef | null;
  }
  | {
    readonly kind: 'statusApply';
    readonly target: 'source' | 'primary';
    readonly statusId: string;
    readonly stacks: number;
    readonly durationRounds: number;
    readonly recipient: MapUnitRef | null;
  }
  | {
    readonly kind: 'revive';
    readonly target: 'primary';
    /** Requested HP after revival, clamped to max HP at execution. */
    readonly amount: number;
    readonly recipient: MapUnitRef | null;
  }
  | {
    readonly kind: 'resource';
    readonly account: 'sourceActor' | 'primaryActor' | 'sourceTeam';
    readonly resourceId: string;
    readonly delta: number;
    readonly recipient: MapUnitRef | { readonly kind: 'team'; readonly side: MapRelationTeamSide; readonly scope: MapRelationScope } | null;
  }
  | { readonly kind: 'counter'; readonly counterId: string; readonly delta: number; readonly recipient: null }
  | { readonly kind: 'flag'; readonly flagId: string; readonly value: boolean; readonly recipient: null }
  | { readonly kind: 'cardCost'; readonly resourceId: 'sCost'; readonly amount: number; readonly recipient: MapRunCardRef | null }
);

export interface MapActionRelation {
  readonly key: string;
  readonly scope: MapRelationScope;
  readonly draft: MapRunEncounterDraftToken;
  readonly phase: 'preparation' | 'replacementPreview';
  readonly visibility: 'public';
  readonly source: MapRelationSource;
  readonly selectedTarget: MapTargetRef | null;
  readonly targetState: 'none' | 'determined' | 'pending' | 'unknown';
  readonly selectionMode: 'none' | 'self' | 'selectable' | 'rule';
  readonly candidates: readonly MapTargetRef[];
  readonly canSelectTarget: boolean;
  readonly canReplaceAction: boolean;
  /** Present for effectProgram Actions; these are declarations, not committed outcomes. */
  readonly declaredEffects?: readonly MapDeclaredEffectSummary[];
}
