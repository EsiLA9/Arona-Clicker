import type {
  NormalizedGameplayMapActionEffects,
  NormalizedGameplayMapEffectInstruction,
} from '../../data-services/normalization/gameplay-map-effect-program';
import type { GameplayMapEffectAccount } from '../../data-services/contracts/gameplay-map-effects';

export type MapEffectActorIdentity = {
  readonly kind: 'partyCharacter' | 'enemy';
  readonly id: string;
};

/** Concrete source kind for E1 traces; Ability and Item cannot share a source key. */
export type MapEffectProgramSourceIdentity = { readonly kind: 'partyCharacter'; readonly id: string }
  | { readonly kind: 'enemy'; readonly id: string }
  | { readonly kind: 'ability'; readonly actionId: string }
  | { readonly kind: 'item'; readonly actionId: string; readonly itemId: string };

export type MapEffectTeamIdentity = { readonly kind: 'team'; readonly side: 'party' | 'enemy' };
export type MapEffectAccountIdentity = MapEffectActorIdentity | MapEffectTeamIdentity;
export type MapEffectTraceIdentity = MapEffectAccountIdentity | { readonly kind: 'encounterLocal' };

export interface MapEffectHpState {
  readonly current: number;
  readonly cap: number;
}

export interface MapEffectCounterState {
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

/** Detached values and declaration bounds supplied by the authoritative planner. */
export interface MapEffectLocalsState {
  readonly counters: Readonly<Record<string, MapEffectCounterState>>;
  readonly flags: Readonly<Record<string, boolean>>;
}

export type MapEffectVisitKind = 'statement' | 'condition' | 'prepare';

/** The outer round planner owns the only dynamic budget counter. */
export interface MapEffectVisit {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly path: string;
  readonly kind: MapEffectVisitKind;
}

export interface MapEffectSourceInput {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly source: MapEffectActorIdentity | null;
  readonly primary: MapEffectActorIdentity | null;
  readonly sourceTeam: MapEffectTeamIdentity;
  readonly hp: Readonly<Record<string, MapEffectHpState>>;
  readonly locals: MapEffectLocalsState;
}

export interface MapEffectTraceBase {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly path: string;
  readonly op: string;
  /** Present on the authoritative E1 Preview trace; absent on raw U06 plans. */
  readonly source?: MapEffectProgramSourceIdentity;
  readonly mode?: 'program';
  readonly identity?: MapEffectTraceIdentity;
}

export type MapEffectTraceEntry =
  | (MapEffectTraceBase & {
    readonly op: 'hpChange';
    readonly before: number;
    readonly after: number;
    readonly delta: number;
  })
  | (MapEffectTraceBase & {
    readonly op: 'counterAdd';
    readonly identity: { readonly kind: 'encounterLocal' };
    readonly counterId: string;
    readonly before: number;
    readonly after: number;
    readonly delta: number;
  })
  | (MapEffectTraceBase & {
    readonly op: 'flagSet';
    readonly identity: { readonly kind: 'encounterLocal' };
    readonly flagId: string;
    readonly before: boolean;
    readonly after: boolean;
  })
  | (MapEffectTraceBase & {
    readonly op: 'resourceChange';
    readonly resourceId: string;
    readonly delta: number;
  })
  | (MapEffectTraceBase & {
    /** An actual resource effect applied after C3 cost preflight. */
    readonly op: 'resourceSettlement';
    readonly identity: MapEffectAccountIdentity;
    readonly account: GameplayMapEffectAccount;
    readonly resourceId: string;
    readonly intentDelta: number;
    readonly before: number;
    readonly after: number;
    readonly delta: number;
  })
  | (MapEffectTraceBase & {
    readonly op: 'discountSCost';
    readonly mode: 'program';
    readonly targetCard: import('./map-cards').MapRunCardRef;
    readonly receiver: MapEffectActorIdentity | null;
    readonly amount: number;
  })
  | (MapEffectTraceBase & {
    readonly op: 'when';
    readonly result: boolean;
    readonly reads: readonly MapEffectGuardRead[];
  });

export type MapEffectGuardRead =
  | { readonly path: string; readonly op: 'hpAtLeast' | 'hpAtMost'; readonly identity: MapEffectActorIdentity; readonly current: number; readonly value: number; readonly result: boolean }
  | { readonly path: string; readonly op: 'hpRatioAtLeast' | 'hpRatioAtMost'; readonly identity: MapEffectActorIdentity; readonly current: number; readonly cap: number; readonly numerator: number; readonly denominator: number; readonly result: boolean }
  | { readonly path: string; readonly op: 'counter'; readonly identity: { readonly kind: 'encounterLocal' }; readonly counterId: string; readonly current: number; readonly comparison: string; readonly value: number; readonly result: boolean }
  | { readonly path: string; readonly op: 'flag'; readonly identity: { readonly kind: 'encounterLocal' }; readonly flagId: string; readonly current: boolean; readonly value: boolean; readonly result: boolean }
  | { readonly path: string; readonly op: 'all' | 'any' | 'not'; readonly result: boolean };

/** Resource entries describe intent only; the outer settlement fills actual balances/deltas. */
export interface MapEffectResourceLedgerEntry {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly path: string;
  readonly account: GameplayMapEffectAccount;
  readonly identity: MapEffectAccountIdentity;
  readonly resourceId: string;
  readonly delta: number;
}

export interface MapEffectSourcePlan {
  readonly hp: Readonly<Record<string, MapEffectHpState>>;
  readonly locals: MapEffectLocalsState;
  readonly resourceLedger: readonly MapEffectResourceLedgerEntry[];
  readonly trace: readonly MapEffectTraceEntry[];
  readonly prepareDiscounts: NormalizedGameplayMapActionEffects['prepare'];
}

export interface MapEffectPlannerOptions {
  readonly input: MapEffectSourceInput;
  readonly effects: NormalizedGameplayMapActionEffects;
  /** Provide a phase-sliced legacy list when preserving an existing source phase. */
  readonly instructions?: readonly NormalizedGameplayMapEffectInstruction[];
  /** Throws when the outer planner's shared visit budget cannot admit this access. */
  readonly visit?: (visit: MapEffectVisit) => void;
}
