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
    .filter(name => !NON_DEFINITION_GETTERS.has(name))
    .map(name => {
      const value = (registry as Record<string, unknown>)[name];
      return {
        kind: name,
        value,
        shape: shapeOf(value),
        derived: false,
      };
    });
}

function definitionIdOf(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  const id = value.id;
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
  const source = registry as Partial<Record<'initOwnerOf' | 'areaOwnerOf' | 'spotOwnerOf', (id: string) => string | undefined>>;
  if (kind === 'inits' && typeof source.initOwnerOf === 'function') return source.initOwnerOf.call(registry, fullId);
  if (kind === 'areas' && typeof source.areaOwnerOf === 'function') return source.areaOwnerOf.call(registry, fullId);
  if (kind === 'spots' && typeof source.spotOwnerOf === 'function') return source.spotOwnerOf.call(registry, fullId);
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
    else if (entry.summary.namespace) derivedNames.add(entry.summary.namespace);
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
    result = value.map(item => cloneRawValue(item, seen));
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
    const object: Record<string, RuntimeContentRawValue> = {};
    for (const [key, entryValue] of Object.entries(value)) object[key] = cloneRawValue(entryValue, seen);
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

function fieldChildren(value: unknown, path: string): readonly RuntimeContentFieldNode[] {
  if (Array.isArray(value)) {
    return value.map((entry, index) => createFieldNode(`${path}[${index}]`, String(index), entry));
  }
  if (isMap(value)) {
    return [...value.entries()].map(([key, entry]) => createFieldNode(
      `${path}[${String(key)}]`,
      String(key),
      entry,
    ));
  }
  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, entry]) => createFieldNode(
      path === '$' ? `$.${key}` : `${path}.${key}`,
      key,
      entry,
    ));
  }
  return [];
}

function createFieldNode(path: string, key: string, value: unknown): RuntimeContentFieldNode {
  return Object.freeze({
    path,
    key,
    valueType: fieldValueType(value),
    value: cloneRawValue(value),
    children: Object.freeze([...fieldChildren(value, path)]),
  });
}

function buildFieldTree(value: unknown): readonly RuntimeContentFieldNode[] {
  if (Array.isArray(value) || isMap(value) || isPlainObject(value)) return fieldChildren(value, '$');
  return Object.freeze([createFieldNode('$', '$', value)]);
}

function isReferenceKey(key: string): boolean {
  const normalized = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return normalized === 'proto'
    || normalized === 'curve'
    || normalized === 'gear'
    || normalized === 'members'
    || normalized === 'featured'
    || normalized === 'children'
    || normalized === 'story'
    || normalized === 'favoriteitem'
    || normalized === 'uniqueweapon'
    || normalized.endsWith('id')
    || normalized.endsWith('ids')
    || normalized.endsWith('ref')
    || normalized.endsWith('refs');
}

function looksLikeReferenceValue(value: string, key: string): boolean {
  if (!value || key === 'id') return false;
  const hasQualifiedIdShape = value.split(':').length >= 3;
  return hasQualifiedIdShape || (isReferenceKey(key) && /^[A-Za-z0-9_.:-]+$/.test(value));
}

function collectReferenceStrings(
  value: unknown,
  path: string,
  key: string,
  output: Array<{ readonly path: string; readonly value: string }>,
): void {
  if (typeof value === 'string') {
    if (looksLikeReferenceValue(value, key)) output.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectReferenceStrings(entry, `${path}[${index}]`, key, output));
    return;
  }
  if (isMap(value)) {
    for (const [entryKey, entry] of value.entries()) {
      collectReferenceStrings(entry, `${path}[${String(entryKey)}]`, key, output);
    }
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [entryKey, entry] of Object.entries(value)) {
    collectReferenceStrings(entry, path === '$' ? `$.${entryKey}` : `${path}.${entryKey}`, entryKey, output);
  }
}

function diagnosticFor(
  source: RuntimeDefinitionRef,
  path: string,
  value: string,
  definitionsById: ReadonlyMap<string, readonly RuntimeDefinitionRef[]>,
): RuntimeContentReferenceDiagnostic {
  const candidates = definitionsById.get(value) ?? [];
  const status = candidates.length === 0 ? 'missing' : candidates.length === 1 ? 'resolved' : 'ambiguous';
  return Object.freeze({
    source,
    path,
    value,
    ...relationMetadata(source, path),
    status,
    target: status === 'resolved' ? candidates[0] : null,
    candidates: Object.freeze([...candidates]),
  });
}

function relationMetadata(source: RuntimeDefinitionRef, path: string): Pick<RuntimeContentReferenceDiagnostic, 'relation' | 'targetKind' | 'confidence'> {
  const key = path.split(/[.[\]]/).filter(Boolean).pop()?.replace(/[^A-Za-z0-9]/g, '').toLowerCase() ?? '';
  const declared: Readonly<Record<string, readonly [string, string | undefined]>> = {
    areaid: ['所属 Area', 'areas'],
    initid: ['所属 Init', 'inits'],
    defaultareas: ['默认 Area', 'areas'],
    defaultspots: ['默认 Spot', 'spots'],
    adjacentareaids: ['相邻 Area', 'areas'],
    startstoryid: ['起始剧情', 'stories'],
    storyid: ['目标 Story', 'stories'],
    availableinits: ['可用 Init', 'inits'],
    spotid: ['目标 Spot', 'spots'],
    variantid: ['角色差分', 'characterVariants'],
    proto: ['原型角色', 'characters'],
    curve: ['培养曲线', 'cultivateCurves'],
    favoriteitem: ['爱用品', 'favoriteItems'],
    uniqueweapon: ['专武', 'uniqueWeapons'],
    colorgroupid: ['色彩组', 'colorGroups'],
    poolid: ['所属卡池', 'gachaPools'],
    children: ['闲聊成员', 'passiveStories'],
    pushafterstory: ['前置剧情', 'stories'],
    owner: ['所属来源', undefined],
    members: ['成员', 'characterVariants'],
    featured: ['Featured 成员', 'characterVariants'],
    itemid: ['物品', 'items'],
    resourceid: ['资源', 'resourceDisplays'],
    resource: ['资源', 'resourceDisplays'],
    currency: ['抽卡资源', 'resourceDisplays'],
    shopid: ['商店', 'shops'],
    entryid: ['商店商品', undefined],
    gear: ['装备', 'gears'],
    gearslots: ['装备槽', 'gears'],
    fromareaid: ['连接起点 Area', 'areas'],
    toareaid: ['连接终点 Area', 'areas'],
    affectorpackids: ['Affector Pack', 'affectorPacks'],
    tags: ['标签', 'tagDefs'],
  };
  const declaredRelation = declared[key];
  if (declaredRelation) return { relation: declaredRelation[0], targetKind: declaredRelation[1], confidence: 'declared' };
  return {
    relation: source.definitionKind === 'affectorPacks' || source.definitionKind === 'triggerDefs' ? '规则引用' : '引用',
    confidence: 'inferred',
  };
}

function displayValue(value: unknown, fallback: string): string {
  if (!isPlainObject(value)) return fallback;
  for (const key of ['displayName', 'name', 'label', 'title', 'id']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return fallback;
}

function descriptionValue(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  for (const key of ['description', 'desc', 'summary']) {
    const candidate = value[key];
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
        parts.push(`${getter.kind}.key:${String(key)}:${valueFingerprint(value, identities, nextIdentity)}`);
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

  const outgoingByEntry = new Map<string, readonly RuntimeContentReferenceDiagnostic[]>();
  for (const entry of internalEntries) {
    const references: Array<{ readonly path: string; readonly value: string }> = [];
    collectReferenceStrings(entry.rawValue, '$', '', references);
    const outgoing = references.map(reference => diagnosticFor(
      entry.summary.ref,
      reference.path,
      reference.value,
      definitionsById,
    ));
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
      diagnosticCount: outgoing.filter(diagnostic => diagnostic.status !== 'resolved').length,
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
      entry.summary.sourceMod === modName || entry.summary.namespace === modName,
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
  if (query.modName && entry.sourceMod !== query.modName && entry.namespace !== query.modName) return false;
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
    const fingerprint = snapshotFingerprint(getters, supplemental, identities, nextIdentity);
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
