// ============================================================
// ui/runtime-editor/debug.ts — 调试编辑态播种
// ============================================================

import type { UIController } from '../controller';
import { DEBUG_EDITING_DEFAULTS, IS_DEBUG_EDITING } from './config';
import { createRuntimeDatapackEditorState, updateRuntimeEditorFields } from './state';

/**
 * IS_DEBUG_EDITING = 1 时创建带默认数据的编辑态；
 * 已有编辑态（含用户主动关闭后的引用被清空）时不再动作。
 */
export function seedDebugEditing(ctrl: UIController): void {
  if (IS_DEBUG_EDITING !== 1 || ctrl.panelState.runtimeDatapackEditor) return;
  const view = ctrl.game.getView();
  const areaId = view.currentAreaId ?? [...ctrl.game.registry.areas.keys()][0] ?? null;
  const editor = createRuntimeDatapackEditorState(areaId);
  updateRuntimeEditorFields(editor, { ...DEBUG_EDITING_DEFAULTS });
  ctrl.panelState.runtimeDatapackEditor = editor;
}
