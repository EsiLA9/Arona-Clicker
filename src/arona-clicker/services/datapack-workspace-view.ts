import type { PackCatalogEntry } from '../contracts';

export type DatapackWorkspaceSection = 'all' | 'enabled' | 'disabled' | 'issues' | 'import';

export interface PackIssue {
  readonly kind: 'missing-dependency' | 'duplicate-mod-name' | 'dependency-order';
  readonly detail: string;
}

export type PackDependencyState = 'enabled-in-sequence' | 'available-not-enabled' | 'missing';

export interface DatapackWorkspaceSectionView {
  readonly id: DatapackWorkspaceSection;
  readonly count: number | null;
}

export interface DatapackWorkspaceView {
  readonly section: DatapackWorkspaceSection;
  readonly entries: readonly PackCatalogEntry[];
  readonly orderedEntries: readonly PackCatalogEntry[];
  readonly filteredEntries: readonly PackCatalogEntry[];
  readonly order: readonly string[];
  readonly draftEnabledIds: ReadonlySet<string>;
  readonly sections: readonly DatapackWorkspaceSectionView[];
  readonly selection: PackCatalogEntry | null;
  readonly issues: ReadonlyMap<string, readonly PackIssue[]>;
  readonly invalidIds: ReadonlySet<string>;
  readonly changed: boolean;
  readonly canApply: boolean;
}

export interface DatapackWorkspaceViewInput {
  readonly entries: readonly PackCatalogEntry[];
  readonly section: DatapackWorkspaceSection;
  readonly draftOrder?: readonly string[];
  readonly draftEnabledIds?: readonly string[];
  readonly selectedPackId?: string | null;
  readonly validation?: {
    readonly ok: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
  } | null;
}

/**
 * 草案启用集的结构化问题。
 * 只检查「会被本次应用实际加载」的草案启用包：未启用包不参与依赖/冲突判定，
 * 否则会与 PackManager 的启用集校验口径不一致。
 */
export function resolvePackIssues(entries: readonly PackCatalogEntry[], order: readonly string[], enabledIds: ReadonlySet<string>): Map<string, PackIssue[]> {
  const enabledEntries = entries.filter(entry => enabledIds.has(entry.id));
  const idsByModName = new Map<string, string[]>();
  for (const entry of enabledEntries) {
    const list = idsByModName.get(entry.modName) ?? [];
    list.push(entry.id);
    idsByModName.set(entry.modName, list);
  }
  const orderIndex = new Map(order.map((id, index) => [id, index] as const));
  const result = new Map<string, PackIssue[]>();
  const add = (id: string, issue: PackIssue): void => {
    const list = result.get(id) ?? [];
    list.push(issue);
    result.set(id, list);
  };
  for (const entry of enabledEntries) {
    if ((idsByModName.get(entry.modName) ?? []).length > 1) {
      add(entry.id, { kind: 'duplicate-mod-name', detail: `modName 冲突：${entry.modName} 在草案启用集中出现多次` });
    }
    for (const dependency of entry.dependencies) {
      const resolved = idsByModName.get(dependency) ?? [];
      if (resolved.length === 0) {
        add(entry.id, { kind: 'missing-dependency', detail: `缺少已启用依赖：${dependency}` });
        continue;
      }
      if ((orderIndex.get(entry.id) ?? 0) < (orderIndex.get(resolved[0]) ?? 0)) {
        add(entry.id, { kind: 'dependency-order', detail: `加载顺序异常：依赖 ${dependency} 排在其后` });
      }
    }
  }
  return result;
}

/** 按草案顺序排列包库；草案缺失或未覆盖的包按包库顺序补齐，保证列表永远完整。 */
export function orderPacks(entries: readonly PackCatalogEntry[], order: readonly string[]): PackCatalogEntry[] {
  const byId = new Map(entries.map(entry => [entry.id, entry] as const));
  const seen = new Set<string>();
  const ordered: PackCatalogEntry[] = [];
  for (const id of order) {
    const entry = byId.get(id);
    if (entry && !seen.has(id)) {
      ordered.push(entry);
      seen.add(id);
    }
  }
  for (const entry of entries) {
    if (!seen.has(entry.id)) {
      ordered.push(entry);
      seen.add(entry.id);
    }
  }
  return ordered;
}

/** 依据当前分类过滤规范化后的包顺序。 */
export function filterPacks(
  section: DatapackWorkspaceSection,
  ordered: readonly PackCatalogEntry[],
  entries: readonly PackCatalogEntry[],
  order: readonly string[],
  enabledIds: ReadonlySet<string>,
): PackCatalogEntry[] {
  if (section === 'enabled') return ordered.filter(entry => enabledIds.has(entry.id));
  if (section === 'disabled') return ordered.filter(entry => !enabledIds.has(entry.id));
  if (section === 'issues') {
    const issues = resolvePackIssues(entries, order, enabledIds);
    return ordered.filter(entry => issues.has(entry.id));
  }
  return [...ordered];
}

export function dependencyState(dependency: string, entries: readonly PackCatalogEntry[], enabledIds: ReadonlySet<string>): PackDependencyState {
  const matches = entries.filter(entry => entry.modName === dependency);
  if (matches.some(entry => enabledIds.has(entry.id))) return 'enabled-in-sequence';
  return matches.length ? 'available-not-enabled' : 'missing';
}

export function packCapabilities(pack: PackCatalogEntry): NonNullable<PackCatalogEntry['capabilities']> {
  return pack.capabilities ?? {
    required: pack.sourceKind === 'builtin',
    removable: pack.sourceKind !== 'builtin',
    reorderable: pack.sourceKind !== 'builtin',
    enableable: pack.sourceKind !== 'builtin',
  };
}

export function isReorderable(entry: PackCatalogEntry | undefined): boolean {
  return entry ? packCapabilities(entry).reorderable : false;
}

export interface PackMoveAvailability {
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
}

export function packMoveAvailability(
  packId: string,
  entries: readonly PackCatalogEntry[],
  order: readonly string[],
  allowReorder: boolean,
): PackMoveAvailability {
  const index = order.indexOf(packId);
  const entry = entries.find(item => item.id === packId);
  if (!allowReorder || index < 0 || !isReorderable(entry)) return { canMoveUp: false, canMoveDown: false };
  const neighbor = (offset: number): PackCatalogEntry | undefined => {
    const target = index + offset;
    if (target < 0 || target >= order.length) return undefined;
    return entries.find(item => item.id === order[target]);
  };
  return {
    canMoveUp: isReorderable(neighbor(-1)),
    canMoveDown: isReorderable(neighbor(1)),
  };
}

export function buildDatapackWorkspaceView(input: DatapackWorkspaceViewInput): DatapackWorkspaceView {
  const entries = [...input.entries];
  const order = [...(input.draftOrder ?? entries.map(entry => entry.id))];
  const draftEnabledIds = new Set(input.draftEnabledIds ?? entries.filter(entry => entry.enabled).map(entry => entry.id));
  const orderedEntries = orderPacks(entries, order);
  const filteredEntries = filterPacks(input.section, orderedEntries, entries, order, draftEnabledIds);
  const issues = resolvePackIssues(entries, order, draftEnabledIds);
  const invalidIds = new Set(entries
    .filter(entry => input.validation && !input.validation.ok && input.validation.errors.some(error => error.includes(entry.name) || error.includes(entry.modName)))
    .map(entry => entry.id));
  const changed = entries.some(entry => entry.enabled !== draftEnabledIds.has(entry.id))
    || orderedEntries.length !== entries.length
    || orderedEntries.some((entry, index) => entries[index]?.id !== entry.id);
  const sections: DatapackWorkspaceSectionView[] = [
    { id: 'all', count: entries.length },
    { id: 'enabled', count: entries.filter(entry => draftEnabledIds.has(entry.id)).length },
    { id: 'disabled', count: entries.filter(entry => !draftEnabledIds.has(entry.id)).length },
    { id: 'issues', count: issues.size },
    { id: 'import', count: null },
  ];
  return {
    section: input.section,
    entries,
    orderedEntries,
    filteredEntries,
    order,
    draftEnabledIds,
    sections,
    selection: entries.find(entry => entry.id === input.selectedPackId) ?? null,
    issues,
    invalidIds,
    changed,
    canApply: changed,
  };
}
