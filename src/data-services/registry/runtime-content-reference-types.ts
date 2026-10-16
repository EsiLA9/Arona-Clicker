import type { RuntimeDefinitionRef } from '../contracts/runtime-content-browser';

export interface ReferenceEntry {
  readonly ref: RuntimeDefinitionRef;
  readonly value: unknown;
  readonly derived?: boolean;
}

export interface ReferenceLocation {
  readonly ref: RuntimeDefinitionRef;
  readonly path: string;
}

export interface ReferenceRequest {
  readonly path: string;
  readonly value: string;
  readonly relation: string;
  readonly confidence: 'declared' | 'inferred';
  readonly scope: 'global' | 'local' | 'candidate';
  readonly targetKinds?: readonly string[];
  readonly locations?: readonly ReferenceLocation[];
  readonly context?: RuntimeDefinitionRef;
}
