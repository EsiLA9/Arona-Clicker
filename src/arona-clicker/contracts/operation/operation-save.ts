import type { EventResult, EventRun } from './operation';

/** Bounded Operation Run state. Content definitions and view projections are resolved from Registry. */
export interface OperationRunSaveSnapshot {
  readonly eventId: string;
  readonly resumeVersion: number;
  readonly run: EventRun;
  readonly result: EventResult | null;
}

export type OperationRunRestoreFailureReason =
  | 'invalid-snapshot'
  | 'unknown-event'
  | 'content-version-mismatch'
  | 'init-mismatch'
  | 'character-missing'
  | 'invalid-content'
  | 'invalid-run';

/** Transient load result; it is surfaced for UI/restart flow and is not itself saved. */
export type OperationRunRestoreResult =
  | { readonly status: 'none' }
  | { readonly status: 'restored'; readonly eventId: string; readonly runId: string }
  | { readonly status: 'rejected'; readonly eventId: string; readonly reason: OperationRunRestoreFailureReason; readonly diagnostics: readonly string[] };
