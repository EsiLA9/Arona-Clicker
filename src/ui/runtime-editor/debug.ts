// ============================================================
// ui/runtime-editor/debug.ts — 调试编辑态播种
// ============================================================

import type { UIController } from '../controller';
import type { PackCatalogCommands, PackCatalogReadModel } from '../../arona-clicker/contracts';
import { IS_DEBUG_EDITING } from './config';
import { createRuntimeDatapackEditorState, hydrateRuntimeEditor, restoreRuntimeEditorSnapshot } from './state';

/** 恢复独立于 SaveData 的 Runtime Editor 草稿；只恢复编辑态，不触发 Apply。 */
export function restoreRuntimeEditorDraft(ctrl: UIController): boolean {
  if (ctrl.panelState.runtimeDatapackEditor) return false;
  const loaded = ctrl.runtimeEditorPersistence.load();
  if (loaded.status !== 'restored') return false;
  const view = ctrl.game.getView();
  const areaId = loaded.snapshot.selectedAreaId ?? view.currentAreaId ?? [...ctrl.game.registry.areas.keys()][0] ?? null;
  const editor = createRuntimeDatapackEditorState(areaId, loaded.snapshot.draftSourceId, loaded.snapshot.packRecordId ?? null);
  restoreRuntimeEditorSnapshot(editor, loaded.snapshot);
  ctrl.panelState.runtimeDatapackEditor = editor;
  ctrl.runtimeEditorDraftRestored = true;
  return true;
}

/**
 * IS_DEBUG_EDITING = 1 时只自动打开已有编辑态数据包；
 * 不再创建无包归属的全局编辑态。
 */
export function seedDebugEditing(ctrl: UIController): void {
  if (ctrl.runtimeEditorExplicitlyClosed) return;
  if (!ctrl.panelState.runtimeDatapackEditor) restoreRuntimeEditorDraft(ctrl);
  if (ctrl.runtimeEditorDraftRestored) return;
  if (IS_DEBUG_EDITING !== 1) return;
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands & PackCatalogReadModel>;
  const runtimeMod = host.getRuntimeMod?.();
  let editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) {
    const catalog = host.getPackCatalog?.();
    const target = catalog?.entries.find(entry => entry.editingMode === 'editing');
    if (!target || !host.openEditingPack || !host.getEditingPackDraft) return;
    const opened = host.openEditingPack(target.id);
    const draft = opened.ok ? host.getEditingPackDraft(target.id) : null;
    if (!draft) return;
    const view = ctrl.game.getView();
    const areaId = view.currentAreaId ?? [...ctrl.game.registry.areas.keys()][0] ?? null;
    editor = createRuntimeDatapackEditorState(areaId, 'runtime-editor', target.id);
    hydrateRuntimeEditor(editor, draft);
    ctrl.panelState.runtimeDatapackEditor = editor;
    ctrl.debugEditingSeeded = true;
  }
  if (runtimeMod && !ctrl.debugEditingHydrated) {
    hydrateRuntimeEditor(editor, runtimeMod);
    ctrl.debugEditingHydrated = true;
  }
}
