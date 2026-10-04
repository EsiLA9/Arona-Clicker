import type { PackCatalogEntry } from '../../arona-clicker/contracts';
import { isReorderable } from '../../arona-clicker/services/datapack-workspace-view';
import type { DatapackWorkspaceSection } from '../../arona-clicker/services/datapack-workspace-view';
import type { PackConfigurationDraft } from '../../data-services/datapack/pack-manager';

export type { DatapackWorkspaceSection } from '../../arona-clicker/services/datapack-workspace-view';
export type DatapackWorkspaceMode = 'classic' | 'development';

export interface DatapackWorkspaceState {
  section: DatapackWorkspaceSection;
  mode?: DatapackWorkspaceMode;
  selectedPackId: string | null;
  draftEnabledIds: string[];
  draftOrder: string[];
  validation: { ok: boolean; errors: string[]; warnings: string[] } | null;
  lastResult: { ok: boolean; message: string } | null;
}

function defaultPackSelection(entries: readonly PackCatalogEntry[]): string | null {
  const preferred = entries.find(entry => !(entry.capabilities?.required ?? entry.modName === 'base'));
  return (preferred ?? entries[0])?.id ?? null;
}

function currentConfiguration(entries: readonly PackCatalogEntry[], configuration?: PackConfigurationDraft): PackConfigurationDraft {
  return configuration ?? {
    enabledIds: entries.filter(entry => entry.enabled).map(entry => entry.id),
    order: entries.map(entry => entry.id),
  };
}

export function createDatapackWorkspaceState(
  entries: readonly PackCatalogEntry[],
  configuration?: PackConfigurationDraft,
  options: { section?: DatapackWorkspaceSection; mode?: DatapackWorkspaceMode; selectedPackId?: string | null } = {},
): DatapackWorkspaceState {
  const current = currentConfiguration(entries, configuration);
  return {
    section: options.section ?? 'all',
    mode: options.mode ?? 'classic',
    selectedPackId: options.selectedPackId === undefined ? defaultPackSelection(entries) : options.selectedPackId,
    draftEnabledIds: [...current.enabledIds],
    draftOrder: [...current.order],
    validation: null,
    lastResult: null,
  };
}

export function synchronizeDatapackWorkspaceState(workspace: DatapackWorkspaceState, entries: readonly PackCatalogEntry[]): void {
  const known = new Set(entries.map(entry => entry.id));
  const order = workspace.draftOrder.filter(id => known.has(id));
  for (const entry of entries) if (!order.includes(entry.id)) order.push(entry.id);
  workspace.draftOrder = order;
  workspace.draftEnabledIds = workspace.draftEnabledIds.filter(id => known.has(id));
  if (workspace.selectedPackId && !known.has(workspace.selectedPackId)) workspace.selectedPackId = defaultPackSelection(entries);
}

export function resetDatapackWorkspaceState(
  entries: readonly PackCatalogEntry[],
  configuration?: PackConfigurationDraft,
  current?: Pick<DatapackWorkspaceState, 'section' | 'mode' | 'selectedPackId'>,
): DatapackWorkspaceState {
  return createDatapackWorkspaceState(entries, configuration, {
    section: current?.section ?? 'all',
    mode: current?.mode ?? 'classic',
    selectedPackId: current?.selectedPackId ?? entries[0]?.id ?? null,
  });
}

export function selectDatapackPack(workspace: DatapackWorkspaceState, packId: string): void {
  workspace.section = 'all';
  workspace.selectedPackId = packId;
}

export function setDatapackSection(workspace: DatapackWorkspaceState, section: DatapackWorkspaceSection): void {
  workspace.section = section;
}

export function setDatapackWorkspaceMode(workspace: DatapackWorkspaceState, mode: DatapackWorkspaceMode): void {
  workspace.mode = mode;
}

export function setDatapackSelection(workspace: DatapackWorkspaceState, packId: string | null): void {
  workspace.selectedPackId = packId;
}

export function clearDatapackFeedback(workspace: DatapackWorkspaceState): void {
  workspace.validation = null;
  workspace.lastResult = null;
}

export function setDatapackValidation(
  workspace: DatapackWorkspaceState,
  validation: { ok: boolean; errors: readonly string[]; warnings: readonly string[] } | null,
): void {
  workspace.validation = validation
    ? { ok: validation.ok, errors: [...validation.errors], warnings: [...validation.warnings] }
    : null;
}

export function setDatapackResult(workspace: DatapackWorkspaceState, result: { ok: boolean; message: string } | null): void {
  workspace.lastResult = result;
}

export function hasDatapackWorkspaceChanges(
  workspace: DatapackWorkspaceState,
  configuration: PackConfigurationDraft | undefined,
): boolean {
  if (!configuration) return false;
  return JSON.stringify(workspace.draftEnabledIds) !== JSON.stringify(configuration.enabledIds)
    || JSON.stringify(workspace.draftOrder) !== JSON.stringify(configuration.order);
}

export function toggleDatapackDraftEnabled(workspace: DatapackWorkspaceState, packId: string): void {
  workspace.draftEnabledIds = workspace.draftEnabledIds.includes(packId)
    ? workspace.draftEnabledIds.filter(id => id !== packId)
    : [...workspace.draftEnabledIds, packId];
  clearDatapackFeedback(workspace);
}

export type DatapackDropResult = 'moved' | 'blocked' | 'ignored';
export type DatapackSwapResult = 'swapped' | 'blocked' | 'ignored';

/** 将未启用记录与同 ModName 的启用记录交换，并保留两侧原有位置。 */
export function swapDatapackDraftIntoEnabledSequence(
  workspace: DatapackWorkspaceState,
  entries: readonly PackCatalogEntry[],
  movingPackId: string,
  activeConflictId: string,
): DatapackSwapResult {
  const byId = new Map(entries.map(item => [item.id, item] as const));
  const moving = byId.get(movingPackId);
  const conflict = byId.get(activeConflictId);
  const baseConflictCanSwap = conflict?.modName === 'base' && moving?.modName === 'base';
  if (!moving || !conflict || movingPackId === activeConflictId
    || ((!isReorderable(moving) || !isReorderable(conflict)) && !baseConflictCanSwap)) return 'ignored';
  if (workspace.draftEnabledIds.includes(movingPackId)
    || !workspace.draftEnabledIds.includes(activeConflictId)
    || moving.modName !== conflict.modName) return 'blocked';

  const knownOrder = workspace.draftOrder.filter(id => byId.has(id));
  for (const entry of entries) if (!knownOrder.includes(entry.id)) knownOrder.push(entry.id);
  const enabledOrder = knownOrder.filter(id => workspace.draftEnabledIds.includes(id));
  const disabledOrder = knownOrder.filter(id => !workspace.draftEnabledIds.includes(id));
  const enabledIndex = enabledOrder.indexOf(activeConflictId);
  const disabledIndex = disabledOrder.indexOf(movingPackId);
  if (enabledIndex < 0 || disabledIndex < 0) return 'blocked';

  const nextEnabledOrder = [...enabledOrder];
  const nextDisabledOrder = [...disabledOrder];
  nextEnabledOrder[enabledIndex] = movingPackId;
  nextDisabledOrder[disabledIndex] = activeConflictId;
  const nextEnabledIds = nextEnabledOrder;
  const nextOrder = [...nextEnabledOrder, ...nextDisabledOrder];
  if (JSON.stringify(nextOrder) === JSON.stringify(knownOrder)) return 'ignored';
  workspace.draftEnabledIds = nextEnabledIds;
  workspace.draftOrder = nextOrder;
  clearDatapackFeedback(workspace);
  return 'swapped';
}

/** 在未启用/启用中列表之间移动单条记录；启用集顺序固定排在包库顺序前段。 */
export function moveDatapackDraftToColumn(
  workspace: DatapackWorkspaceState,
  entries: readonly PackCatalogEntry[],
  packId: string,
  targetEnabled: boolean,
  targetIndex: number,
): DatapackDropResult {
  const entry = entries.find(item => item.id === packId);
  if (!entry || !isReorderable(entry)) return 'ignored';

  const byId = new Map(entries.map(item => [item.id, item] as const));
  const knownOrder = workspace.draftOrder.filter(id => byId.has(id));
  for (const item of entries) if (!knownOrder.includes(item.id)) knownOrder.push(item.id);
  const enabled = new Set(workspace.draftEnabledIds);
  const enabledOrder = knownOrder.filter(id => enabled.has(id) && id !== packId);
  const disabledOrder = knownOrder.filter(id => !enabled.has(id) && id !== packId);
  const currentlyEnabled = enabled.has(packId);
  const targetLength = targetEnabled ? enabledOrder.length : disabledOrder.length;
  const requiredIndex = targetEnabled ? enabledOrder.findIndex(id => byId.get(id)?.capabilities?.required) : -1;
  const minimumIndex = requiredIndex === 0 ? 1 : 0;
  const boundedIndex = Math.max(minimumIndex, Math.min(targetIndex, targetLength));

  if (targetEnabled && !currentlyEnabled) {
    if (enabledOrder.some(id => byId.get(id)?.modName === entry.modName)) return 'blocked';
    enabled.add(packId);
  } else if (!targetEnabled) {
    if (entry.capabilities?.required) return 'blocked';
    enabled.delete(packId);
  }

  const nextEnabledOrder = targetEnabled
    ? [...enabledOrder.slice(0, boundedIndex), packId, ...enabledOrder.slice(boundedIndex)]
    : enabledOrder;
  const nextDisabledOrder = targetEnabled
    ? disabledOrder
    : [...disabledOrder.slice(0, boundedIndex), packId, ...disabledOrder.slice(boundedIndex)];
  const nextOrder = [...nextEnabledOrder, ...nextDisabledOrder];
  if (JSON.stringify(nextOrder) === JSON.stringify(knownOrder)
    && currentlyEnabled === targetEnabled) return 'ignored';
  workspace.draftEnabledIds = knownOrder.filter(id => enabled.has(id));
  workspace.draftOrder = nextOrder;
  clearDatapackFeedback(workspace);
  return 'moved';
}

export type DatapackMoveResult = 'moved' | 'ignored' | 'blocked';

function paneKeyForEntry(entry: Pick<PackCatalogEntry, 'modName' | 'version'>): string {
  return `${entry.modName}@${entry.version}`;
}

export function moveDatapackDraft(
  workspace: DatapackWorkspaceState,
  entries: readonly PackCatalogEntry[],
  packId: string,
  delta: number,
): DatapackMoveResult {
  if (!isReorderable(entries.find(entry => entry.id === packId))) return 'ignored';
  const index = workspace.draftOrder.indexOf(packId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= workspace.draftOrder.length) return 'ignored';
  if (!isReorderable(entries.find(entry => entry.id === workspace.draftOrder[target]))) return 'blocked';
  const next = [...workspace.draftOrder];
  [next[index], next[target]] = [next[target], next[index]];
  workspace.draftOrder = next;
  clearDatapackFeedback(workspace);
  return 'moved';
}

/** 将同一 ModId + VersionId 的全部记录作为一个连续块移动。 */
export function moveDatapackPaneDraft(
  workspace: DatapackWorkspaceState,
  entries: readonly PackCatalogEntry[],
  paneKey: string,
  delta: number,
): DatapackMoveResult {
  const entryById = new Map(entries.map(entry => [entry.id, entry] as const));
  const order = workspace.draftOrder.filter(id => entryById.has(id));
  const knownIds = new Set(order);
  for (const entry of entries) if (!knownIds.has(entry.id)) order.push(entry.id);

  const idsByPane = new Map<string, string[]>();
  const paneOrder: string[] = [];
  for (const id of order) {
    const entry = entryById.get(id);
    if (!entry) continue;
    const key = paneKeyForEntry(entry);
    if (!idsByPane.has(key)) {
      idsByPane.set(key, []);
      paneOrder.push(key);
    }
    idsByPane.get(key)!.push(id);
  }

  const currentIndex = paneOrder.indexOf(paneKey);
  const currentIds = idsByPane.get(paneKey);
  if (currentIndex < 0 || !currentIds || !currentIds.every(id => isReorderable(entryById.get(id)))) return 'ignored';
  const targetIndex = currentIndex + delta;
  if (targetIndex < 0 || targetIndex >= paneOrder.length) return 'ignored';
  const targetIds = idsByPane.get(paneOrder[targetIndex]) ?? [];
  if (!targetIds.every(id => isReorderable(entryById.get(id)))) return 'blocked';

  const nextPaneOrder = [...paneOrder];
  [nextPaneOrder[currentIndex], nextPaneOrder[targetIndex]] = [nextPaneOrder[targetIndex], nextPaneOrder[currentIndex]];
  workspace.draftOrder = nextPaneOrder.flatMap(key => idsByPane.get(key) ?? []);
  clearDatapackFeedback(workspace);
  return 'moved';
}
