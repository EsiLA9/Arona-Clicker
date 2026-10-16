import type {
  RuntimeContentBrowserQueryPort,
  RuntimeContentBrowserSources,
  RuntimeContentBrowserView,
  RuntimeContentDefinitionDetail,
  RuntimeContentDefinitionSummary,
  RuntimeContentFieldNode,
  RuntimeContentKindDescriptor,
  RuntimeContentKindGroup,
  RuntimeContentListQuery,
  RuntimeContentMapValue,
  RuntimeContentRawValue,
  RuntimeContentReferenceDiagnostic,
  RuntimeContentSetValue,
  RuntimeContentShape,
  RuntimeContentUnknownValue,
  RuntimeDefinitionRef,
} from '../contracts/runtime-content-browser';
import { collectDefinitionReferences } from './runtime-content-reference-rules';
import { collectOperationReferences } from './runtime-content-operation-references';
import type { ReferenceRequest } from './runtime-content-reference-types';
interface GetterSnapshot {
  readonly kind: string;
  readonly value: unknown;
  readonly shape: RuntimeContentShape;
  readonly derived: boolean;
}

interface SupplementalSnapshot {
  readonly kind: 'affectorPacks' | 'triggerDefs';
  readonly entries: readonly unknown[];
  readonly revision?: number;
}

interface CachedSnapshot {
  readonly fingerprint: string;
  readonly snapshot: InternalSnapshot;
  readonly supplemental: readonly SupplementalSnapshot[];
}

interface InternalEntry {
  readonly summary: RuntimeContentDefinitionSummary;
  readonly value: unknown;
  readonly rawValue: unknown;
  readonly descriptor: RuntimeContentKindDescriptor;
  readonly outgoing: readonly RuntimeContentReferenceDiagnostic[];
  readonly incoming: readonly RuntimeContentReferenceDiagnostic[];
}

interface InternalSnapshot {
  readonly view: RuntimeContentBrowserView;
  readonly entries: readonly InternalEntry[];
}

const DERIVED_REGISTRY_VIEWS = new Set(['storyEntries']);
const NON_DEFINITION_GETTERS = new Set(['loadedModNames']);

function isMap(value: unknown): value is ReadonlyMap<unknown, unknown> {
  return value instanceof Map;
}

function isSet(value: unknown): value is ReadonlySet<unknown> {
  return value instanceof Set;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value) || isMap(value) || isSet(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function shapeOf(value: unknown): RuntimeContentShape {
  if (Array.isArray(value)) return 'array';
  if (isMap(value)) return 'map';
  if (value === undefined || isPlainObject(value)) return 'singleton';
  return 'unknown';
}

function discoverRegistryGetters(registry: object): readonly GetterSnapshot[] {
  const prototype = Object.getPrototypeOf(registry) as object | null;
  const prototypeSnapshots = prototype && prototype !== Object.prototype
    ? Object.getOwnPropertyNames(prototype)
      .filter(name => name !== 'constructor' && !NON_DEFINITION_GETTERS.has(name))
      .flatMap(name => {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
        if (!descriptor?.get) return [];
        const value = descriptor.get.call(registry);
        return [{
          kind: name,
          value,
          shape: shapeOf(value),
          derived: DERIVED_REGISTRY_VIEWS.has(name),
        }];
      })
    : [];
  if (prototypeSnapshots.length > 0) return prototypeSnapshots;

  return Object.keys(registry)
    .filter(name => !NON_DEFINITION_GETTERS.has(name) && typeof dataValue(registry, name) !== 'function')
    .map(name => {
      const value = dataValue(registry, name);
      return {
        kind: name,
        value,
        shape: shapeOf(value),
        derived: false,
      };
    });
}

function dataValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function dataEntries(value: object): readonly [string, unknown][] {
  return Object.keys(value).map(key => [key, dataValue(value, key)]);
}

function definitionIdOf(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  const id = dataValue(value, 'id');
  return typeof id === 'string' && id.trim() ? id : undefined;
}

function supplementalMapOf(entries: readonly unknown[]): ReadonlyMap<string, unknown> {
  const values = new Map<string, unknown>();
  for (const entry of entries) {
    const id = definitionIdOf(entry);
    if (id) values.set(id, entry);
  }
  return values;
}

function discoverSupplementalSources(
  sources: RuntimeContentBrowserSources | undefined,
  previous: readonly SupplementalSnapshot[] | undefined,
): readonly (SupplementalSnapshot & { readonly value: ReadonlyMap<string, unknown> })[] {
  const result: Array<SupplementalSnapshot & { readonly value: ReadonlyMap<string, unknown> }> = [];
  const sourceEntries: readonly [SupplementalSnapshot['kind'], RuntimeContentBrowserSources[keyof RuntimeContentBrowserSources] | undefined][] = [
    ['affectorPacks', sources?.affectorPacks],
    ['triggerDefs', sources?.triggerDefs],
  ];
  for (const [kind, source] of sourceEntries) {
    if (!source) continue;
    const revision = source.getRevision?.();
    const prior = previous?.find(snapshot => snapshot.kind === kind);
    if (revision !== undefined && prior?.revision === revision) {
      result.push({ ...prior, value: supplementalMapOf(prior.entries) });
      continue;
    }
    const entries = source.getEntries();
    result.push({ kind, entries, revision, value: supplementalMapOf(entries) });
  }
  return result;
}

function humanizeKind(kind: string): string {
  return kind
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, char => char.toUpperCase());
}

function groupOfKind(kind: string): RuntimeContentKindGroup {
  const value = kind.toLowerCase();
  if (/^(init|area|spot|enhancement)/.test(value)) return 'world';
  if (/^(story|active|passive)/.test(value)) return 'story';
  if (/^(gacha|shop|item|drop|resource)/.test(value)) return 'economy';
  if (/^(character|chara|cultivate|favorite|unique|trait|gear|affection)/.test(value)) return 'character';
  if (/^(color|theme|pic|tag)/.test(value)) return 'presentation';
  if (/^(affector|trigger|funclet)/.test(value)) return 'rules';
  if (/^(extra|config|persist)/.test(value)) return 'config';
  return 'other';
}

function refKey(ref: RuntimeDefinitionRef): string {
  return `${ref.definitionKind}\u0000${ref.fullId ?? '<singleton>'}`;
}

function namespaceOf(fullId: string | null): string | undefined {
  if (!fullId) return undefined;
  const separator = fullId.indexOf(':');
  return separator > 0 ? fullId.slice(0, separator) : undefined;
}

function ownerOf(registry: object, kind: string, fullId: string): string | undefined {
  const methods: Readonly<Record<string, string>> = {
    inits: 'initOwnerOf', areas: 'areaOwnerOf', spots: 'spotOwnerOf',
    characterVariants: 'characterVariantOwnerOf', resourceDisplays: 'resourceDisplayOwnerOf',
  };
  const method = methods[kind];
  const query = method ? (registry as Record<string, unknown>)[method] : undefined;
  if (typeof query === 'function') return query.call(registry, fullId) as string | undefined;
  return undefined;
}

function loadedModNamesOf(registry: object, entries: readonly InternalEntry[]): readonly string[] {
  const loadedModNames = (registry as { readonly loadedModNames?: unknown }).loadedModNames;
  if (isSet(loadedModNames)) {
    return [...loadedModNames].filter((name): name is string => typeof name === 'string');
  }

  const derivedNames = new Set<string>();
  for (const entry of entries) {
    if (entry.summary.sourceMod) derivedNames.add(entry.summary.sourceMod);

  }
  return [...derivedNames];
}

function cloneRawValue(value: unknown, seen = new WeakSet<object>()): RuntimeContentRawValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (value === undefined) return { $type: 'unknown', value: 'undefined' } satisfies RuntimeContentUnknownValue;
  if (typeof value === 'bigint') return { $type: 'unknown', value: `${value}n` } satisfies RuntimeContentUnknownValue;
  if (typeof value === 'symbol' || typeof value === 'function') {
    return { $type: 'unknown', value: String(value) } satisfies RuntimeContentUnknownValue;
  }
  if (seen.has(value)) return { $type: 'unknown', value: '<cycle>' } satisfies RuntimeContentUnknownValue;
  seen.add(value);

  let result: RuntimeContentRawValue;
  if (Array.isArray(value)) {
    result = Array.from({ length: value.length }, (_, index) => cloneRawValue(dataValue(value, String(index)), seen));
  } else if (isMap(value)) {
    const entries: RuntimeContentMapValue['entries'] = [...value.entries()].map(([key, entryValue]) => ({
      key: cloneRawValue(key, seen),
      value: cloneRawValue(entryValue, seen),
    }));
    result = { $type: 'map', entries } satisfies RuntimeContentMapValue;
  } else if (isSet(value)) {
    const values = [...value.values()].map(item => cloneRawValue(item, seen));
    result = { $type: 'set', values } satisfies RuntimeContentSetValue;
  } else if (isPlainObject(value)) {
    const object: Record<string, RuntimeContentRawValue> = Object.create(null);
    for (const [key, entryValue] of dataEntries(value)) object[key] = cloneRawValue(entryValue, seen);
    result = object;
  } else {
    result = { $type: 'unknown', value: Object.prototype.toString.call(value) } satisfies RuntimeContentUnknownValue;
  }

  seen.delete(value);
  return result;
}

function fieldValueType(value: unknown): RuntimeContentFieldNode['valueType'] {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  if (isMap(value)) return 'map';
  if (isPlainObject(value)) return 'object';
  return 'unknown';
}

function fieldChildren(value: unknown, path: string, ancestors = new WeakSet<object>()): readonly RuntimeContentFieldNode[] {
  if (value === null || typeof value !== 'object' || ancestors.has(value)) return [];
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Array.from({ length: value.length }, (_, index) => createFieldNode(`${path}[${index}]`, String(index), dataValue(value, String(index)), ancestors));
    }
    if (isMap(value)) {
      return [...value.entries()].map(([key, entry]) => createFieldNode(
        `${path}[${String(key)}]`,
        String(key),
        entry,
        ancestors,
      ));
    }
    if (isPlainObject(value)) {
      return dataEntries(value).map(([key, entry]) => createFieldNode(
        path === '$' ? `$.${key}` : `${path}.${key}`,
        key,
        entry,
        ancestors,
      ));
    }
    return [];
  } finally { ancestors.delete(value); }
}

function createFieldNode(path: string, key: string, value: unknown, ancestors = new WeakSet<object>()): RuntimeContentFieldNode {
  return Object.freeze({
    path,
    key,
    valueType: fieldValueType(value),
    value: cloneRawValue(value),
    children: Object.freeze([...fieldChildren(value, path, ancestors)]),
  });
}

function buildFieldTree(value: unknown): readonly RuntimeContentFieldNode[] {
  if (Array.isArray(value) || isMap(value) || isPlainObject(value)) return fieldChildren(value, '$');
  return Object.freeze([createFieldNode('$', '$', value)]);
}

function diagnosticFor(
  source: RuntimeDefinitionRef,
  request: ReferenceRequest,
  definitionsById: ReadonlyMap<string, readonly RuntimeDefinitionRef[]>,
  sourceCategory: RuntimeContentReferenceDiagnostic['sourceCategory'],
): RuntimeContentReferenceDiagnostic {
  const locations = request.locations ?? (request.scope === 'local' ? [] : undefined);
  const matching = locations
    ? locations.map(location => location.ref)
    : (definitionsById.get(request.value) ?? []).filter(ref =>
      !request.targetKinds || request.targetKinds.includes(ref.definitionKind));
  const candidates = [...new Map(matching.map(ref => [refKey(ref), ref])).values()];
  const count = locations ? locations.length : candidates.length;
  const status = count === 0 ? 'missing' : count === 1 ? 'resolved' : 'ambiguous';
  return deepFreeze({
    source, path: request.path, value: request.value, relation: request.relation,
    targetKind: request.targetKinds?.[0], confidence: request.confidence,
    scope: request.scope, sourceCategory, status,
    target: status === 'resolved' ? candidates[0] ?? null : null,
    candidates,
    ...(locations ? { targetLocations: locations.map(location => ({ ref: { ...location.ref }, path: location.path })) } : {}),
    ...(request.context ? { context: { ...request.context } } : {}),
  });
}

function displayValue(value: unknown, fallback: string): string {
  if (!isPlainObject(value)) return fallback;
  for (const key of ['displayName', 'name', 'label', 'title', 'id']) {
    const candidate = dataValue(value, key);
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return fallback;
}

function descriptionValue(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  for (const key of ['description', 'desc', 'summary']) {
    const candidate = dataValue(value, key);
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return undefined;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function descriptorOf(snapshot: GetterSnapshot, value: unknown): RuntimeContentKindDescriptor {
  const present = value !== undefined;
  const entryCount = snapshot.shape === 'map'
    ? [...(value as ReadonlyMap<unknown, unknown>).keys()].length
    : snapshot.shape === 'array'
      ? (value as readonly unknown[]).length
    : present ? 1 : 0;
  return Object.freeze({
    kind: snapshot.kind,
    label: humanizeKind(snapshot.kind),
    group: groupOfKind(snapshot.kind),
    shape: snapshot.shape,
    derived: snapshot.derived,
    present,
    entryCount,
  });
}

function valueFingerprint(value: unknown, identities: WeakMap<object, number>, nextIdentity: { value: number }): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return `${typeof value}:${String(value)}`;
  const objectValue = value as object;
  let identity = identities.get(objectValue);
  if (identity === undefined) {
    identity = nextIdentity.value++;
    identities.set(objectValue, identity);
  }
  return `object:${identity}`;
}

function snapshotFingerprint(
  registry: object,
  getters: readonly GetterSnapshot[],
  supplemental: readonly (SupplementalSnapshot & { readonly value: ReadonlyMap<string, unknown> })[],
  identities: WeakMap<object, number>,
  nextIdentity: { value: number },
): string {
  const parts: string[] = [];
  for (const getter of getters) {
    const containerFingerprint = getter.shape === 'map' || getter.shape === 'array'
      ? ''
      : valueFingerprint(getter.value, identities, nextIdentity);
    parts.push(`${getter.kind}:${getter.shape}:${getter.derived}:${containerFingerprint}`);
    if (getter.shape === 'map') {
      for (const [key, value] of getter.value as ReadonlyMap<unknown, unknown>) {
        parts.push(`${getter.kind}.key:${String(key)}:${valueFingerprint(value, identities, nextIdentity)}:owner:${ownerOf(registry, getter.kind, String(key)) ?? ''}`);
      }
    } else if (getter.shape === 'array') {
      for (const value of getter.value as readonly unknown[]) {
        parts.push(`${getter.kind}.entry:${valueFingerprint(value, identities, nextIdentity)}`);
      }
    }
  }
  for (const source of supplemental) {
    parts.push(`${source.kind}:revision:${source.revision ?? 'content'}`);
    for (const [key, value] of source.value) {
      parts.push(`${source.kind}.key:${key}:${valueFingerprint(value, identities, nextIdentity)}`);
    }
  }
  const loaded = (registry as { readonly loadedModNames?: unknown }).loadedModNames;
  if (isSet(loaded)) parts.push(`loaded:${[...loaded].join(',')}`);
  return parts.join('|');
}

function buildSnapshot(
  registry: object,
  getterSnapshots: readonly GetterSnapshot[],
  supplemental: readonly (SupplementalSnapshot & { readonly value: ReadonlyMap<string, unknown> })[],
): InternalSnapshot {
  const allGetterSnapshots: readonly GetterSnapshot[] = [
    ...getterSnapshots,
    ...supplemental.map(source => ({
      kind: source.kind,
      value: source.value,
      shape: 'map' as const,
      derived: false,
    })),
  ];
  const descriptors = allGetterSnapshots.map(snapshot => descriptorOf(snapshot, snapshot.value));
  const internalEntries: InternalEntry[] = [];

  for (const snapshot of allGetterSnapshots) {
    const descriptor = descriptors.find(item => item.kind === snapshot.kind)!;
    if (snapshot.shape === 'map') {
      for (const [key, value] of (snapshot.value as ReadonlyMap<unknown, unknown>).entries()) {
        const fullId = String(key);
        const ref = Object.freeze({ definitionKind: snapshot.kind, fullId });
        const namespace = namespaceOf(fullId);
        const sourceMod = ownerOf(registry, snapshot.kind, fullId);
        const raw = cloneRawValue(value);
        const summary = Object.freeze({
          ref,
          kind: descriptor,
          namespace,
          sourceMod,
          label: displayValue(value, fullId),
          description: descriptionValue(value),
          diagnosticCount: 0,
          searchableText: `${fullId} ${JSON.stringify(raw) ?? ''}`,
        });
        internalEntries.push({ summary, value, rawValue: value, descriptor, outgoing: [], incoming: [] });
      }
      continue;
    }

    if (snapshot.value !== undefined) {
      const ref = Object.freeze({ definitionKind: snapshot.kind, fullId: null });
      const raw = cloneRawValue(snapshot.value);
      const summary = Object.freeze({
        ref,
        kind: descriptor,
        label: displayValue(snapshot.value, descriptor.label),
        description: descriptionValue(snapshot.value),
        diagnosticCount: 0,
        searchableText: `${descriptor.kind} ${JSON.stringify(raw) ?? ''}`,
      });
      internalEntries.push({ summary, value: snapshot.value, rawValue: snapshot.value, descriptor, outgoing: [], incoming: [] });
    }
  }

  const definitionsById = new Map<string, RuntimeDefinitionRef[]>();
  for (const entry of internalEntries) {
    if (entry.descriptor.derived || entry.summary.ref.fullId === null) continue;
    const id = entry.summary.ref.fullId;
    const refs = definitionsById.get(id) ?? [];
    refs.push(entry.summary.ref);
    definitionsById.set(id, refs);
  }

  const referenceEntries = internalEntries.map(entry => ({ ref: entry.summary.ref, value: entry.rawValue, derived: entry.descriptor.derived }));
  const outgoingByEntry = new Map<string, readonly RuntimeContentReferenceDiagnostic[]>();
  for (const entry of internalEntries) {
    const requests = [
      ...collectDefinitionReferences(entry.summary.ref, entry.rawValue, referenceEntries),
      ...collectOperationReferences(entry.summary.ref, entry.rawValue, referenceEntries),
    ];
    const category = entry.descriptor.derived ? 'derived'
      : ['affectorPacks', 'triggerDefs'].includes(entry.summary.ref.definitionKind) ? 'runtime-rule' : 'definition';
    const unique = new Map(requests.map(request => [
      `${request.path}\u0000${request.value}\u0000${request.scope}\u0000${request.context ? refKey(request.context) : ''}`, request,
    ]));
    const outgoing = [...unique.values()].map(request => diagnosticFor(entry.summary.ref, request, definitionsById, category));
    outgoingByEntry.set(refKey(entry.summary.ref), Object.freeze(outgoing));
  }

  const incomingByEntry = new Map<string, RuntimeContentReferenceDiagnostic[]>();
  for (const entry of internalEntries) {
    for (const diagnostic of outgoingByEntry.get(refKey(entry.summary.ref)) ?? []) {
      for (const candidate of diagnostic.candidates) {
        const incoming = incomingByEntry.get(refKey(candidate)) ?? [];
        incoming.push(diagnostic);
        incomingByEntry.set(refKey(candidate), incoming);
      }
    }
  }

  const finalizedEntries: InternalEntry[] = internalEntries.map(entry => {
    const outgoing = outgoingByEntry.get(refKey(entry.summary.ref)) ?? [];
    const summary = Object.freeze({
      ...entry.summary,
      diagnosticCount: outgoing.filter(diagnostic => diagnostic.scope !== 'candidate' && diagnostic.confidence === 'declared' && diagnostic.status !== 'resolved').length,
      referenceCoverage: { status: 'partial' as const, declaredCount: outgoing.filter(edge => edge.scope !== 'candidate' && edge.confidence === 'declared').length, candidateCount: outgoing.filter(edge => edge.scope === 'candidate' || edge.confidence !== 'declared').length },
    });
    return {
      ...entry,
      summary,
      outgoing,
      incoming: Object.freeze([...(incomingByEntry.get(refKey(entry.summary.ref)) ?? [])]),
    };
  });

  const loadedMods = [...loadedModNamesOf(registry, finalizedEntries)].sort().map(modName => Object.freeze({
    modName,
    loaded: true as const,
    definitionCount: finalizedEntries.filter(entry =>
      entry.summary.sourceMod === modName,
    ).length,
  }));
  const view = deepFreeze({
    loadedMods: Object.freeze(loadedMods),
    kinds: Object.freeze([...descriptors]),
    entries: Object.freeze(finalizedEntries.map(entry => entry.summary)),
  });
  return { view, entries: Object.freeze(finalizedEntries) };
}

function matchesQuery(entry: RuntimeContentDefinitionSummary, query: RuntimeContentListQuery): boolean {
  if (query.kind && entry.ref.definitionKind !== query.kind) return false;
  if (query.modName && entry.sourceMod !== query.modName) return false;
  if (query.hasDiagnostics !== undefined && (entry.diagnosticCount > 0) !== query.hasDiagnostics) return false;
  if (query.text) {
    const needle = query.text.trim().toLocaleLowerCase();
    if (needle && !entry.searchableText.toLocaleLowerCase().includes(needle)) return false;
  }
  return true;
}

/** 纯函数筛选入口；不依赖 UI、PlayerState 或 Registry 写引用。 */
export function filterRuntimeContentDefinitions(
  entries: readonly RuntimeContentDefinitionSummary[],
  query: RuntimeContentListQuery = {},
): readonly RuntimeContentDefinitionSummary[] {
  return Object.freeze(entries.filter(entry => matchesQuery(entry, query)));
}

function detailOf(entry: InternalEntry): RuntimeContentDefinitionDetail {
  return deepFreeze({
    summary: entry.summary,
    raw: cloneRawValue(entry.rawValue),
    fields: Object.freeze([...buildFieldTree(entry.rawValue)]),
    outgoingReferences: entry.outgoing,
    incomingReferences: entry.incoming,
  });
}

export function createRuntimeContentBrowser(
  registry: object,
  sources?: RuntimeContentBrowserSources,
): RuntimeContentBrowserQueryPort {
  let cached: CachedSnapshot | null = null;
  const identities = new WeakMap<object, number>();
  const nextIdentity = { value: 1 };
  const current = (): InternalSnapshot => {
    const getters = discoverRegistryGetters(registry);
    const supplemental = discoverSupplementalSources(sources, cached?.supplemental);
    const fingerprint = snapshotFingerprint(registry, getters, supplemental, identities, nextIdentity);
    if (cached?.fingerprint === fingerprint) return cached.snapshot;
    const snapshot = buildSnapshot(registry, getters, supplemental);
    cached = { fingerprint, snapshot, supplemental };
    return snapshot;
  };
  const emptyReferences = Object.freeze({
    outgoing: Object.freeze([]) as readonly RuntimeContentReferenceDiagnostic[],
    incoming: Object.freeze([]) as readonly RuntimeContentReferenceDiagnostic[],
  });
  const referencesOf = (ref: RuntimeDefinitionRef): {
    readonly outgoing: readonly RuntimeContentReferenceDiagnostic[];
    readonly incoming: readonly RuntimeContentReferenceDiagnostic[];
  } => {
    const entry = current().entries.find(candidate => refKey(candidate.summary.ref) === refKey(ref));
    return entry
      ? { outgoing: entry.outgoing, incoming: entry.incoming }
      : emptyReferences;
  };
  return {
    getView: () => current().view,
    listDefinitions: (query = {}) => filterRuntimeContentDefinitions(current().view.entries, query),
    getDefinition: ref => {
      const entry = current().entries.find(candidate => refKey(candidate.summary.ref) === refKey(ref));
      return entry ? detailOf(entry) : null;
    },
    getReferences: referencesOf,
    getEntityRelations: referencesOf,
    getResourceRelations: resourceId => referencesOf({ definitionKind: 'resourceDisplays', fullId: resourceId }),
  };
}
