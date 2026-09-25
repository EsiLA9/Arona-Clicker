export type InspectorTab = 'overview' | 'relations' | 'raw';

export type InspectorReferenceStatus = 'resolved' | 'missing' | 'ambiguous';

export interface InspectorDefinitionTarget {
  readonly definitionKind: string;
  readonly fullId: string;
  readonly label?: string;
  /** Codex shell 中可定位的条目键；缺失时仅作为只读诊断显示。 */
  readonly entryKey?: string;
}

export interface InspectorReference {
  readonly path?: string;
  readonly relation?: string;
  readonly confidence?: 'declared' | 'inferred';
  readonly target: InspectorDefinitionTarget;
  readonly status: InspectorReferenceStatus;
  readonly candidates?: readonly InspectorDefinitionTarget[];
}

export interface InspectorSource {
  readonly modId?: string;
  readonly version?: string;
  readonly label?: string;
}

export interface InspectorSummaryField {
  readonly label: string;
  readonly value: unknown;
}

/**
 * Source-independent, read-only detail input for the Codex inspector.
 * Runtime/Registry adapters should create this snapshot without exposing their
 * mutable objects or write services to the UI.
 */
export interface DefinitionInspectorViewModel {
  readonly definitionKind: string;
  /** 面向内容阅读的类型名称；definitionKind 保留为稳定的内部种类键。 */
  readonly definitionLabel?: string;
  readonly fullId: string;
  readonly title?: string;
  readonly description?: string;
  readonly source?: InspectorSource;
  readonly status?: string;
  readonly summaryFields?: readonly InspectorSummaryField[];
  readonly definition: unknown;
  readonly references?: readonly InspectorReference[];
  readonly reverseReferences?: readonly InspectorReference[];
}

export interface InspectorNameResolver {
  (type: string, id: string): string;
}

export interface InspectorRenderOptions {
  readonly nameOf?: InspectorNameResolver;
  readonly formatNumber?: (value: number) => string;
  readonly maxDepth?: number;
  readonly maxNodes?: number;
}
