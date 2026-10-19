import type { MapRunEncounterDraftToken } from './map-run';
import type { MapRunCardRef } from './map-cards';

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

/** Selectable domain objects; a card is never a unit performer. */
export type MapTargetRef = MapUnitRef | MapRunCardRef;

/** A prepared behavior / player source, not a newly minted combat card instance. */
export interface MapRelationSource {
  readonly kind: 'preparedAction' | 'ability' | 'item' | 'enemy';
  readonly id: string;
  readonly actionId: string | null;
  readonly performer: MapUnitRef | null;
}

/** Recipients describe individual effects, not the action's selection interface. */
export interface MapEffectRecipient {
  readonly kind: 'hp' | 'resource' | 'cardCost';
  readonly resourceId: string | null;
  readonly amount: number;
  /** null means an unresolved selected target, never an invented unit. */
  readonly recipient: MapTargetRef | { readonly kind: 'team'; readonly scope: MapRelationScope } | null;
}

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
  /** Declared pre-Commit effects; actual applied deltas remain in receipts. */
  readonly effectRecipients: readonly MapEffectRecipient[];
}
