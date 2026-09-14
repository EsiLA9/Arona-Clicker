import type { PackCatalogEntry } from '../../arona-clicker/contracts';
import { isReorderable } from '../../arona-clicker/services/datapack-workspace-view';
import type { DatapackWorkspaceSection } from '../../arona-clicker/services/datapack-workspace-view';
import type { PackConfigurationDraft } from '../../data-services/datapack/pack-manager';

export type { DatapackWorkspaceSection } from '../../arona-clicker/services/datapack-workspace-view';

export interface DatapackWorkspaceState {
  section: DatapackWorkspaceSection;
  selectedPackId: string | null;
  draftEnabledIds: string[];
  draftOrder: string[];
  validation: { ok: boolean; errors: string[]; warnings: string[] } | null;
  lastResult: { ok: boolean; message: string } | null;
}

function defaultPackSelection(entries: readonly PackCatalogEntry[]): string | null {
  const preferred = entries.find(entry => !(entry.capabilities?.required ?? entry.sourceKind === 'builtin'));
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
  options: { section?: DatapackWorkspaceSection; selectedPackId?: string | null } = {},
): DatapackWorkspaceState {
  const current = currentConfiguration(entries, configuration);
  return {
    section: options.section ?? 'all',
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
  current?: Pick<DatapackWorkspaceState, 'section' | 'selectedPackId'>,
): DatapackWorkspaceState {
  return createDatapackWorkspaceState(entries, configuration, {
    section: current?.section ?? 'all',
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

export type DatapackMoveResult = 'moved' | 'ignored' | 'blocked';

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
