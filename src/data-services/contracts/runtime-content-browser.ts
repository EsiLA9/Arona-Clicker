/**
 * Runtime 已加载内容浏览器的只读契约。
 *
 * Registry 将 Datapack 的数组表编译成按 id 索引的 Map；本契约不复制
 * Datapack 表枚举，而是让查询实现从 Registry 的公开只读 getter 发现种类。
 * 详情字段树仍保留 array / map / unknown 形状，供通用 Inspector 兜底。
 */

export type RuntimeContentShape = 'array' | 'map' | 'singleton' | 'unknown';

export type RuntimeContentFieldValueType =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'map'
  | 'object'
  | 'unknown';

export type RuntimeContentKindGroup =
  | 'world'
  | 'story'
  | 'economy'
  | 'character'
  | 'presentation'
  | 'rules'
  | 'config'
  | 'other';

export interface RuntimeDefinitionRef {
  /** Registry getter 对应的内容种类；不依赖 PackCatalogRecord。 */
  readonly definitionKind: string;
  /** Map 条目的有效 ID；array / singleton / unknown 记录使用 null。 */
  readonly fullId: string | null;
}

export interface RuntimeContentKindDescriptor {
  readonly kind: string;
  readonly label: string;
  readonly group: RuntimeContentKindGroup;
  /** Registry 当前暴露的有效容器形状。 */
  readonly shape: RuntimeContentShape;
  /** 是否为 Registry 为消费方构造的派生只读视图。 */
  readonly derived: boolean;
  readonly present: boolean;
  readonly entryCount: number;
}

export interface RuntimeContentLoadedMod {
  readonly modName: string;
  readonly loaded: true;
  /** 只统计能从有效 ID 或可靠来源归属确定的条目。 */
  readonly definitionCount: number;
}

export interface RuntimeContentUnknownValue {
  readonly $type: 'unknown';
  readonly value: string;
}

export interface RuntimeContentMapValue {
  readonly $type: 'map';
  readonly entries: readonly {
    readonly key: RuntimeContentRawValue;
    readonly value: RuntimeContentRawValue;
  }[];
}

export interface RuntimeContentSetValue {
  readonly $type: 'set';
  readonly values: readonly RuntimeContentRawValue[];
}

export type RuntimeContentRawValue =
  | null
  | boolean
  | number
  | string
  | readonly RuntimeContentRawValue[]
  | { readonly [key: string]: RuntimeContentRawValue }
  | RuntimeContentMapValue
  | RuntimeContentSetValue
  | RuntimeContentUnknownValue;

export interface RuntimeContentFieldNode {
  readonly path: string;
  readonly key: string;
  readonly valueType: RuntimeContentFieldValueType;
  readonly value: RuntimeContentRawValue;
  readonly children: readonly RuntimeContentFieldNode[];
}

export type RuntimeContentReferenceStatus = 'resolved' | 'missing' | 'ambiguous';

export interface RuntimeContentReferenceDiagnostic {
  readonly source: RuntimeDefinitionRef;
  readonly path: string;
  readonly value: string;
  readonly relation?: string;
  readonly targetKind?: string;
  readonly confidence?: 'declared' | 'inferred';
  readonly status: RuntimeContentReferenceStatus;
  readonly target: RuntimeDefinitionRef | null;
  readonly candidates: readonly RuntimeDefinitionRef[];
}

export interface RuntimeContentDefinitionSummary {
  readonly ref: RuntimeDefinitionRef;
  readonly kind: RuntimeContentKindDescriptor;
  /** ID 的命名空间；不是未经 Registry 证明的来源包归属。 */
  readonly namespace?: string;
  /** 仅在 Registry 提供可靠 owner 查询时填写。 */
  readonly sourceMod?: string;
  readonly label: string;
  readonly description?: string;
  readonly diagnosticCount: number;
  /** 供纯函数搜索使用；不代表额外的数据源。 */
  readonly searchableText: string;
}

export interface RuntimeContentDefinitionDetail {
  readonly summary: RuntimeContentDefinitionSummary;
  readonly raw: RuntimeContentRawValue;
  readonly fields: readonly RuntimeContentFieldNode[];
  readonly outgoingReferences: readonly RuntimeContentReferenceDiagnostic[];
  readonly incomingReferences: readonly RuntimeContentReferenceDiagnostic[];
}

export interface RuntimeContentBrowserView {
  readonly loadedMods: readonly RuntimeContentLoadedMod[];
  readonly kinds: readonly RuntimeContentKindDescriptor[];
  readonly entries: readonly RuntimeContentDefinitionSummary[];
}

/**
 * 当前 Runtime 的非 Registry 规则源。
 * getEntries 只能返回当前有效定义；getRevision 变化时查询层会丢弃快照。
 */
export interface RuntimeContentSupplementalSource {
  readonly getEntries: () => readonly unknown[];
  readonly getRevision?: () => number;
}

export interface RuntimeContentBrowserSources {
  readonly affectorPacks?: RuntimeContentSupplementalSource;
  readonly triggerDefs?: RuntimeContentSupplementalSource;
}

export interface RuntimeContentListQuery {
  readonly text?: string;
  readonly kind?: string;
  readonly modName?: string;
  readonly hasDiagnostics?: boolean;
}

export interface RuntimeContentBrowserQueryPort {
  /** 从当前 Registry 有效视图生成只读快照；不读取包库或 PlayerState。 */
  getView(): RuntimeContentBrowserView;
  listDefinitions(query?: RuntimeContentListQuery): readonly RuntimeContentDefinitionSummary[];
  getDefinition(ref: RuntimeDefinitionRef): RuntimeContentDefinitionDetail | null;
  getReferences(ref: RuntimeDefinitionRef): {
    readonly outgoing: readonly RuntimeContentReferenceDiagnostic[];
    readonly incoming: readonly RuntimeContentReferenceDiagnostic[];
  };
  /** 统一查询实体的静态出向 / 入向关系；不读取 PlayerState。 */
  getEntityRelations(ref: RuntimeDefinitionRef): {
    readonly outgoing: readonly RuntimeContentReferenceDiagnostic[];
    readonly incoming: readonly RuntimeContentReferenceDiagnostic[];
  };
  /** 按 resourceDisplays 的有效资源 ID 查询资源静态关系。 */
  getResourceRelations(resourceId: string): {
    readonly outgoing: readonly RuntimeContentReferenceDiagnostic[];
    readonly incoming: readonly RuntimeContentReferenceDiagnostic[];
  };
}
