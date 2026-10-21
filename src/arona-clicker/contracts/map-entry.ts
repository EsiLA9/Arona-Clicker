import type { GameplayMapDef } from '../../data-services/contracts/gameplay-map';
import type { MapRun } from './map-run';

export type MapEntryInfo = NonNullable<GameplayMapDef['entryInfo']>;

export type MapEntryMode = 'fresh' | 'resume' | 'blocked' | 'unavailable';

export type MapEntryReason =
  | 'party-ineligible'
  | 'other-map-active'
  | 'map-not-found'
  | 'run-content-unavailable';

export interface MapEntryPartyMemberView {
  readonly characterId: string;
  readonly variantId: string | null;
  readonly displayName: string;
  readonly avatarRef: string | null;
  readonly admission: 'admitted' | 'character-locked' | 'variant-unavailable';
  readonly initialHp?: number;
  readonly currentHp?: number;
  readonly maxHp?: number;
}

export interface MapEntryResourceView {
  readonly resourceId: string;
  readonly value: number;
}

export interface MapEntryActorResourceView extends MapEntryResourceView {
  readonly characterId: string;
}

export interface MapEntryProgressView {
  readonly runId: string;
  readonly currentNodeId: string;
  readonly currentNodeTitle: string;
  readonly activity?: {
    readonly kind: 'battle' | 'rest' | 'encounter' | 'shop';
    readonly position: number;
    readonly total: number;
  };
  readonly round?: number;
}

/** Owner-bound, detached summary needed to render an active Run's entry page. */
export interface MapRunEntrySnapshot {
  readonly run: MapRun;
  readonly mapName: string;
  readonly entryInfo?: MapEntryInfo;
  readonly currentNodeTitle: string;
  readonly partyHp: readonly {
    readonly characterId: string;
    readonly currentHp: number;
    readonly maxHp: number;
  }[];
  readonly activity?: MapEntryProgressView['activity'];
  readonly round?: number;
}

/** Detached presentation-ready query result; it never carries a write handle. */
export interface MapEntryView {
  readonly mapId: string;
  readonly name: string | null;
  readonly entryInfo?: MapEntryInfo;
  readonly mode: MapEntryMode;
  readonly reason?: MapEntryReason;
  readonly blockedByMapName?: string;
  readonly partyMode: 'fixed';
  readonly party: readonly MapEntryPartyMemberView[];
  readonly playerCost: number | null;
  readonly actorResources: readonly MapEntryActorResourceView[];
  readonly teamResources: readonly MapEntryResourceView[];
  readonly progress?: MapEntryProgressView;
}
