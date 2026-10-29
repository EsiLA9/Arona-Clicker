import type { UISurfaceToken } from './ui-surface';
import type { ColumnToken } from '../workspace/workspace-columns';

export type UIBehaviorId = 'resource.value' | 'resource.gain' | 'spot.yield';

export interface UIBehaviorUpdateRequest {
  type: 'behavior';
  behavior: UIBehaviorId;
  key: string;
  hostId?: string;
  token?: UISurfaceToken;
  reason?: string;
}

export interface UIRegionUpdateRequest {
  instanceId?: string;
  columnToken?: ColumnToken;
  type: 'region';
  hostId: string;
  token?: UISurfaceToken;
  reason?: string;
}

export type UIElementTarget = 'spot.card' | 'enhancement.card' | 'area.nav';

export interface UIElementUpdateRequest {
  type: 'element';
  target: UIElementTarget;
  key: string;
  /** Display instance targeted by this element patch; defaults to legacy host matching when omitted. */
  instanceId?: string;
  /** Rejects work queued for an unmounted or rebound column when the sink can validate it. */
  columnToken?: ColumnToken;
  hostId?: string;
  token?: UISurfaceToken;
  reason?: string;
}

export interface UIStructureUpdateRequest {
  type: 'structure';
  scope: 'workspace' | 'app';
  token?: UISurfaceToken;
  reason?: string;
}

export type UIUpdateRequest =
  | UIBehaviorUpdateRequest
  | UIElementUpdateRequest
  | UIRegionUpdateRequest
  | UIStructureUpdateRequest;

export type UIUpdate =
  | (UIBehaviorUpdateRequest & { token: UISurfaceToken; reason: string })
  | (UIElementUpdateRequest & { token: UISurfaceToken; reason: string })
  | (UIRegionUpdateRequest & { token: UISurfaceToken; reason: string })
  | (UIStructureUpdateRequest & { token: UISurfaceToken; reason: string });

export type UIUpdateApplyResult = 'applied' | 'not-found' | 'unsupported';
