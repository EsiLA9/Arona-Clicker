import type { UISurfaceToken } from './ui-surface';

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
  type: 'region';
  hostId: string;
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
  | UIRegionUpdateRequest
  | UIStructureUpdateRequest;

export type UIUpdate =
  | (UIBehaviorUpdateRequest & { token: UISurfaceToken; reason: string })
  | (UIRegionUpdateRequest & { token: UISurfaceToken; reason: string })
  | (UIStructureUpdateRequest & { token: UISurfaceToken; reason: string });

export type UIUpdateApplyResult = 'applied' | 'not-found' | 'unsupported';
