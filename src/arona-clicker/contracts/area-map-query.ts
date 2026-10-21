import type { AreaMapNodeAction } from '../../data-services/contracts/area-map';
import type { Condition, ConditionGroup } from '../../engine/types/expression';
import type { TravelError } from './results';

export type AreaMapBlockedReason = 'Unavailable' | 'Locked' | TravelError;
export interface AreaMapRevealView {
  readonly nameKnown: boolean;
  readonly utilityKnown: boolean;
  readonly conditionKnown: boolean;
  readonly unlocked: boolean;
}
export interface AreaMapNodeView extends AreaMapRevealView {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly position: Readonly<{ x: number; y: number }>;
  readonly appearance: Readonly<{ kind: 'point' | 'landmark' | 'portal'; iconPicId?: string }>;
  readonly actionKind: AreaMapNodeAction['kind'];
  /** Null when the target is hidden or missing. No hidden target IDs/content are exposed. */
  readonly action: AreaMapNodeAction | null;
  readonly ready: boolean;
  readonly reason?: AreaMapBlockedReason;
  readonly conditions?: readonly (Condition | ConditionGroup)[];
  readonly current?: boolean;
  readonly visited?: boolean;
  readonly travelMethod?: 'adjacent' | 'visited' | 'transit';
}
export interface AreaMapView extends AreaMapRevealView {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly nodes: readonly AreaMapNodeView[];
  readonly edges: readonly Readonly<{ fromNodeId: string; toNodeId: string; directed?: boolean }>[];
  /** Fingerprint of this public projection; never includes hidden source definitions. */
  readonly revision: string;
}
export type AreaMapEntryView =
  | { readonly ready: true; readonly mapId: string; readonly name: string }
  | { readonly ready: false; readonly reason: 'NoEntry' | 'Unavailable' | 'Locked' };
export interface AreaMapQueryPort {
  getEntryView(areaId: string): AreaMapEntryView;
  getView(mapId: string): AreaMapView | null;
  getNodeView(mapId: string, nodeId: string): AreaMapNodeView | null;
}
