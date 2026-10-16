export type InspectorTab = 'overview' | 'relations' | 'raw';

export type InspectorReferenceStatus = 'resolved' | 'missing' | 'ambiguous';

export interface InspectorDefinitionTarget {
  readonly definitionKind: string;
  readonly fullId: string;
  readonly label?: string;
  /** Codex shell 中可定位的条目键；缺失时仅作为只读诊断显示。 */
  readonly entryKey?: string;
}

export interface InspectorReferenceDefinitionRef {
  readonly definitionKind: string;
  readonly fullId: string | null;
}

export interface InspectorReferenceLocation {
  readonly ref: InspectorReferenceDefinitionRef;
  readonly path: string;
}

export interface InspectorReference {
  readonly path?: string;
  readonly relation?: string;
  readonly confidence?: 'declared' | 'inferred';
  /** 原始边端点；target 保留为当前方向下供 UI 展示和跳转的端点。 */
  readonly edgeSource?: InspectorReferenceDefinitionRef;
  readonly edgeTarget?: InspectorReferenceDefinitionRef | null;
  readonly scope?: 'global' | 'local' | 'candidate';
  readonly sourceCategory?: 'definition' | 'derived' | 'runtime-rule';
  readonly targetLocations?: readonly InspectorReferenceLocation[];
  readonly context?: InspectorReferenceDefinitionRef;
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
  /** Source property path, including nested fields, used to link references and align the profile with its definition. */
  readonly path?: string;
}

export interface InspectorReferenceCoverage {
  readonly status: 'partial';
  readonly declaredCount: number;
  readonly candidateCount: number;
}

/**
 * Source-independent, read-only detail input for the Codex inspector.
 * Runtime/Registry adapters should create this snapshot without exposing their
 * mutable objects or write services to the UI.
 */
export interface DefinitionInspectorViewModel {
  /** Stable internal kind key; use definitionLabel for user-facing type names. */
  readonly definitionKind: string;
  /** 面向内容阅读的类型名称；definitionKind 保留为稳定的内部种类键。 */
  readonly definitionLabel?: string;
  /** Stable identity used by navigation and the detail heading. */
  readonly fullId: string;
  /** Optional human-readable identity shown in the detail heading; do not repeat it as a summary field. */
  readonly title?: string;
  /** Introductory copy for the definition. */
  readonly description?: string;
  readonly source?: InspectorSource;
  readonly status?: string;
  readonly referenceCoverage?: InspectorReferenceCoverage;
  /** Domain fields for the overview; shared identity fields are shown separately. */
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
