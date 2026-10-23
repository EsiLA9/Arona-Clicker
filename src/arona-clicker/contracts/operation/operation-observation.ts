import type { SpotUpgradeResult } from '../runtime/results';

export type ObservationResourceValues = Readonly<Record<string, number>>;

export interface OperationObservationState {
  readonly spotLevel: number | null;
  readonly resources: {
    readonly global: ObservationResourceValues;
    readonly currentInit: ObservationResourceValues;
  };
  readonly inventory: ObservationResourceValues;
}

export interface OperationObservationLog {
  readonly id: number;
  readonly timestamp: number;
  readonly level: 'info' | 'success' | 'warning' | 'error';
  readonly source: string;
  readonly message: string;
  readonly details?: string;
  readonly frame?: number;
}

export interface OperationObservation {
  readonly schemaVersion: 1;
  readonly captureId: string;
  readonly operation: {
    readonly kind: 'spot-upgrade';
    readonly spotId: string;
    readonly paymentOptionId?: string;
  };
  readonly result: SpotUpgradeResult;
  readonly identity: {
    readonly activeInit: string;
    readonly contentRevision: string;
    readonly reason?: string;
  };
  readonly frame: { readonly before: number | null; readonly after: number | null };
  readonly before: OperationObservationState;
  readonly after: OperationObservationState;
  readonly changes: {
    readonly spotLevel: { readonly from: number | null; readonly to: number | null };
    readonly resources: readonly {
      readonly scope: 'global' | 'currentInit';
      readonly resourceId: string;
      readonly from: number | null;
      readonly to: number | null;
    }[];
    readonly inventory: readonly {
      readonly itemId: string;
      readonly from: number | null;
      readonly to: number | null;
    }[];
  };
  readonly logs: {
    readonly association: 'captured-during-command';
    readonly entries: readonly OperationObservationLog[];
    readonly omitted: number;
  };
  readonly completeness: {
    readonly status: 'complete' | 'truncated';
    readonly truncated: boolean;
    readonly omitted: number;
  };
}

export type OperationObservationInput = Omit<OperationObservation, 'schemaVersion' | 'captureId' | 'changes' | 'completeness'>;
