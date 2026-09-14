import type { RuntimeModDraft } from '../../arona-clicker/contracts';
import {
  createDraftLayer,
  resolveDefinition,
  resumeDefinition,
  setDefinitionRecord,
  suspendDefinition,
} from '../../data-services';
import type { DefinitionResolution, DefinitionSourceLayer } from '../../data-services';

export interface RuntimeEditorSpotDraft {
  idName: string;
  areaId: string;
  name: string;
  description: string;
  baseCost: number;
  baseCostResource: string;
  baseYield: number;
  baseYieldResource: string;
  baseCapacity: number;
}

export interface RuntimeDatapackEditorState {
  enabled: boolean;
  draftSourceId: string;
  modName: string;
  displayName: string;
  version: string;
  author: string;
  description: string;
  selectedAreaId: string | null;
  spots: RuntimeEditorSpotDraft[];
  selectedSpotId: string | null;
  suspendedSpotIds: string[];
  applied?: boolean;
  error: string | null;
}

export function createRuntimeDatapackEditorState(defaultAreaId: string | null, draftSourceId = 'runtime-editor'): RuntimeDatapackEditorState {
  return {
    enabled: true,
    draftSourceId,
    modName: '',
    displayName: '',
    version: '1.0.0',
    author: '',
    description: '',
    selectedAreaId: defaultAreaId,
    spots: [],
    selectedSpotId: null,
    suspendedSpotIds: [],
    error: null,
  };
}

export function runtimeEditorDraftLayer(editor: RuntimeDatapackEditorState): DefinitionSourceLayer<RuntimeEditorSpotDraft> {
  let layer = createDraftLayer<RuntimeEditorSpotDraft>(editor.draftSourceId);
  for (const spot of editor.spots) {
    layer = setDefinitionRecord(layer, { table: 'spots', id: spot.idName }, { ...spot });
  }
  for (const idName of editor.suspendedSpotIds) {
    layer = suspendDefinition(layer, { table: 'spots', id: idName });
  }
  return layer;
}

export function resolveRuntimeEditorSpot(editor: RuntimeDatapackEditorState, idName: string): DefinitionResolution<RuntimeEditorSpotDraft> {
  return resolveDefinition([runtimeEditorDraftLayer(editor)], { table: 'spots', id: idName });
}

export function updateRuntimeEditorFields(
  editor: RuntimeDatapackEditorState,
  fields: Partial<Pick<RuntimeDatapackEditorState, 'modName' | 'displayName' | 'version' | 'author' | 'description' | 'selectedAreaId'>>,
): void {
  if (fields.modName !== undefined) editor.modName = fields.modName.trim();
  if (fields.displayName !== undefined) editor.displayName = fields.displayName.trim();
  if (fields.version !== undefined) editor.version = fields.version.trim();
  if (fields.author !== undefined) editor.author = fields.author.trim();
  if (fields.description !== undefined) editor.description = fields.description.trim();
  if (fields.selectedAreaId !== undefined) editor.selectedAreaId = fields.selectedAreaId || null;
}

export function setRuntimeEditorSpot(editor: RuntimeDatapackEditorState, spot: RuntimeEditorSpotDraft | null): void {
  if (!spot) {
    clearRuntimeEditorSpot(editor);
    return;
  }
  const selectedIndex = editor.selectedSpotId
    ? editor.spots.findIndex(item => item.idName === editor.selectedSpotId)
    : -1;
  const existingIndex = selectedIndex >= 0
    ? selectedIndex
    : editor.spots.findIndex(item => item.idName === spot.idName);
  const previousId = existingIndex >= 0 ? editor.spots[existingIndex].idName : null;
  if (existingIndex >= 0) editor.spots[existingIndex] = { ...spot };
  else editor.spots.push({ ...spot });
  if (previousId && previousId !== spot.idName) {
    editor.suspendedSpotIds = editor.suspendedSpotIds.filter(id => id !== previousId);
  }
  editor.suspendedSpotIds = editor.suspendedSpotIds.filter(id => id !== spot.idName);
  editor.selectedSpotId = spot.idName;
  editor.selectedAreaId = spot.areaId;
  editor.applied = false;
}

export function clearRuntimeEditorSpot(editor: RuntimeDatapackEditorState): void {
  editor.selectedSpotId = null;
  editor.applied = false;
  editor.error = null;
}

export function getSelectedRuntimeEditorSpot(editor: RuntimeDatapackEditorState): RuntimeEditorSpotDraft | null {
  if (!editor.selectedSpotId) return null;
  return editor.spots.find(spot => spot.idName === editor.selectedSpotId) ?? null;
}

export function selectRuntimeEditorSpot(editor: RuntimeDatapackEditorState, idName: string): boolean {
  const spot = editor.spots.find(item => item.idName === idName);
  if (!spot) return false;
  editor.selectedSpotId = spot.idName;
  editor.selectedAreaId = spot.areaId;
  editor.error = null;
  return true;
}

export function removeRuntimeEditorSpot(editor: RuntimeDatapackEditorState, idName = editor.selectedSpotId): boolean {
  if (!idName) return false;
  const index = editor.spots.findIndex(spot => spot.idName === idName);
  if (index < 0) return false;
  editor.spots.splice(index, 1);
  editor.suspendedSpotIds = editor.suspendedSpotIds.filter(id => id !== idName);
  editor.selectedSpotId = null;
  editor.applied = false;
  editor.error = null;
  return true;
}

export function setRuntimeEditorSpotSuspended(editor: RuntimeDatapackEditorState, idName: string, suspended: boolean): boolean {
  if (!editor.spots.some(spot => spot.idName === idName)) return false;
  const key = { table: 'spots', id: idName } as const;
  const layer = runtimeEditorDraftLayer(editor);
  const nextLayer = suspended ? suspendDefinition(layer, key) : resumeDefinition(layer, key);
  editor.suspendedSpotIds = nextLayer.tombstones.map(tombstone => tombstone.id);
  editor.applied = false;
  editor.error = null;
  return true;
}

export function setRuntimeEditorError(editor: RuntimeDatapackEditorState, error: string | null): void {
  editor.error = error;
}

export function markRuntimeEditorApplied(editor: RuntimeDatapackEditorState, applied: boolean): void {
  editor.applied = applied;
}

export function toRuntimeModDraft(editor: RuntimeDatapackEditorState): RuntimeModDraft | null {
  if (!editor.modName || !editor.displayName) return null;
  const resolutions = editor.spots.map(spot => resolveRuntimeEditorSpot(editor, spot.idName));
  return {
    modName: editor.modName,
    displayName: editor.displayName,
    version: editor.version,
    author: editor.author,
    description: editor.description,
    spots: resolutions.flatMap(resolution => resolution.status === 'resolved' && resolution.record.value ? [{ ...resolution.record.value }] : []),
    suspendedSpotIds: resolutions.flatMap(resolution => resolution.status === 'suspended' ? [resolution.key.id] : []),
  };
}

export function hydrateRuntimeEditor(editor: RuntimeDatapackEditorState, runtimeMod: RuntimeModDraft): void {
  const spots = runtimeMod.spots.map(spot => ({ ...spot }));
  updateRuntimeEditorFields(editor, {
    modName: runtimeMod.modName,
    displayName: runtimeMod.displayName,
    version: runtimeMod.version,
    author: runtimeMod.author,
    description: runtimeMod.description,
    selectedAreaId: spots[0]?.areaId ?? null,
  });
  editor.spots = spots;
  editor.suspendedSpotIds = [...(runtimeMod.suspendedSpotIds ?? [])].filter(id => spots.some(spot => spot.idName === id));
  editor.selectedSpotId = spots.find(spot => !editor.suspendedSpotIds.includes(spot.idName))?.idName ?? spots[0]?.idName ?? null;
  const selected = getSelectedRuntimeEditorSpot(editor);
  if (selected) editor.selectedAreaId = selected.areaId;
  markRuntimeEditorApplied(editor, true);
  setRuntimeEditorError(editor, null);
}

export function prepareRuntimeEditorForNewSpot(editor: RuntimeDatapackEditorState, areaId: string): void {
  updateRuntimeEditorFields(editor, { selectedAreaId: areaId });
  clearRuntimeEditorSpot(editor);
}
