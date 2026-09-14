export type DefinitionTable = string;

export interface DefinitionKey {
  table: DefinitionTable;
  id: string;
}

export interface DefinitionSourceRef {
  kind: 'base' | 'pack' | 'draft';
  sourceId: string;
}

export interface DefinitionRef {
  key: DefinitionKey;
  source: DefinitionSourceRef;
}

export interface DefinitionRecord<T> {
  key: DefinitionKey;
  source: DefinitionSourceRef;
  kind: 'owned' | 'override';
  value: T;
}

export interface DefinitionTombstone {
  table: DefinitionTable;
  id: string;
  kind: 'suspend';
  owner: DefinitionSourceRef;
}

export interface DefinitionSourceLayer<T> {
  source: DefinitionSourceRef;
  records: readonly DefinitionRecord<T>[];
  tombstones: readonly DefinitionTombstone[];
}

export type DefinitionResolutionStatus =
  | 'resolved'
  | 'suspended'
  | 'missing';

export type DefinitionResolution<T> =
  | {
      status: 'resolved';
      record: DefinitionRecord<T>;
    }
  | {
      status: 'suspended';
      key: DefinitionKey;
      suspendedBy: DefinitionSourceRef;
      shadowedRecord?: DefinitionRecord<T>;
    }
  | {
      status: 'missing';
      key: DefinitionKey;
    };

export interface DefinitionChange {
  key: DefinitionKey;
  before: DefinitionResolutionStatus;
  after: DefinitionResolutionStatus;
}

export interface DefinitionDelta {
  added: readonly DefinitionKey[];
  changed: readonly DefinitionKey[];
  removed: readonly DefinitionKey[];
  transitions: readonly DefinitionChange[];
}
