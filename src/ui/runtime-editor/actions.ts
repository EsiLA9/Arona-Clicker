// ============================================================
// ui/runtime-editor/actions.ts — 运行时编辑器交互接线
// 自 controller-actions-topbar.ts 拆出：编辑器开关、Spot 表单、
//   Draft 保存 / Apply、删除确认与 Affector 列表事件绑定。
// 只编排 UI 与命令层，不持有业务规则与渲染细节。
// ============================================================

import { AREA_CONTENT_POLICY, getContentPolicy, SPOT_CONTENT_POLICY, validateAuthoringInput, type ContentAuthoringPolicy, type SpotFunctionalityKind } from '../../data-services/authoring/content-policy';
import { renderRuntimeDefinitionForm, renderRuntimeEditorLauncher, renderRuntimeEditorPanel, renderRuntimeSpotForm, runtimeEditorInitProblems } from './view';
import {
  createRuntimeDatapackEditorState,
  findRuntimeEditorAppliedSpot,
  getSelectedRuntimeEditorDefinition,
  getSelectedRuntimeEditorSpot,
  hydrateRuntimeEditor,
  markRuntimeEditorApplied,
  markRuntimeEditorWorldApplied,
  prepareRuntimeEditorForNewDefinition,
  prepareRuntimeEditorForNewSpot,
  removeRuntimeEditorDefinition,
  removeRuntimeEditorSpot,
  restoreRuntimeEditorDefinition,
  runtimeEditorAppliedDefinitions,
  runtimeEditorDefinitionEntryState,
  runtimeEditorDefinitionSuspensions,
  runtimeEditorDefinitions,
  runtimeEditorPendingDefinitions,
  runtimeEditorPendingSpots,
  selectRuntimeEditorDefinition,
  selectRuntimeEditorSpot,
  setRuntimeEditorDefinition,
  setRuntimeEditorError,
  setRuntimeEditorFilter,
  setRuntimeEditorNotice,
  setRuntimeEditorProblems,
  setRuntimeEditorSpot,
  suggestedRuntimeDefaultAreaIdName,
  updateRuntimeEditorFields,
  type RuntimeEditorFilter,
  type RuntimeEditorContentKind,
  type RuntimeEditorAreaDraft,
  type RuntimeEditorDefinitionDraft,
  type RuntimeEditorProblem,
  type RuntimeEditorSpotDraft,
} from './state';
import { type RuntimeEditorLauncherAction, runtimeEditorLauncherEntries } from './launcher';
import { normalizeEntityNameValues, readRuntimeEditorFields, runtimeEditorInitialValues } from './form';
import {
  conditionAtPath,
  conditionPathForElement,
  readConditionEditor,
  readAtomicConditionEditor,
  readEffectEditor,
  renderAdditionalConditionHtml,
  renderAtomicConditionEditor,
  renderConditionItemHtml,
  renderEffectEditor,
  renderEffectRowHtml,
  renderNestedConditionHtml,
  replaceConditionAtPath,
} from './dsl-editors';
import { clearSubDialogs, closeSubDialog, openSubDialog } from './subdialog';
import { MAX_CONDITION_ITEMS, validateConditionGroup, validateEffectList } from '../../data-services/authoring/content-policy-dsl';
import type { Condition, ConditionGroup, Effect } from '../../engine/types/expression';
import {
  readFunctionalityRows,
  readGachaPoolRows,
  readLevelUpgradeRows,
  readRevealTriggerRows,
  readTagRows,
} from './collections';
import {
  collectionPrototype,
  collectionPrototypes,
  collectionRowItem,
  readCollection,
  renderCollection,
  writeCollectionRow,
  type CollectionPrototype,
} from './collection-prototypes';
import type { UIController } from '../controller';
import { createUIContext } from '../context';
import type { PackCatalogCommands, PackCatalogReadModel } from '../../arona-clicker/contracts';
import type { RuntimeSpotMutationResult, RuntimeWorldDraft } from '../../arona-clicker/contracts/runtime-content';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

export function syncRuntimeSpotCreateAction(ctrl: UIController): void {
  syncRuntimeEditorPanel(ctrl);
}

/** 读取 Mod 元信息字段；modName 读入大写时自动转小写，返回是否发生归一化。 */
function readRuntimeEditorModFields(ctrl: UIController, scope: ParentNode): boolean {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return false;
  const value = (key: string): string | undefined => scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-editor-mod-field="${key}"]`)?.value;
  const rawModName = value('modName') ?? '';
  const modName = rawModName.toLowerCase();
  const displayName = value('displayName');
  const version = value('version');
  const author = value('author');
  const description = value('description');
  const selectedAreaId = value('selectedAreaId');
  updateRuntimeEditorFields(editor, {
    modName,
    displayName,
    version,
    author,
    description,
    selectedAreaId: selectedAreaId ?? undefined,
  });
  return modName !== rawModName;
}

function readRuntimeDefinitionExtensions(policy: ContentAuthoringPolicy, scope: ParentNode): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const extension of policy.extensions ?? []) {
    if (extension.editor === 'reference-list') {
      if (extension.inputKey === 'defaultAreas') {
        const rows = [...scope.querySelectorAll<HTMLElement>('[data-runtime-init-area-row]')];
        values[extension.inputKey] = rows.map(row => row.dataset.areaId ?? '').filter(Boolean);
        continue;
      }
      const text = scope.querySelector<HTMLTextAreaElement>(`[data-runtime-editor-extension="${extension.inputKey}"]`)?.value ?? '';
      values[extension.inputKey] = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      continue;
    }
    if (extension.editor === 'area-topology') {
      values[extension.inputKey] = [...scope.querySelectorAll<HTMLElement>('[data-runtime-area-topology-row]')].map(row => ({
        areaId: row.dataset.areaId ?? '',
        type: row.dataset.topologyType === 'twoWay' ? 'twoWay' : 'oneWay',
      }));
      continue;
    }
    if (extension.editor === 'resource-amount-list') {
      const text = scope.querySelector<HTMLTextAreaElement>(`[data-runtime-editor-extension="${extension.inputKey}"]`)?.value ?? '';
      values[extension.inputKey] = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
        const [resourceId, amount] = line.includes('=') ? line.split(/=(.*)/s, 2) : [line, ''];
        return { resourceId: resourceId.trim(), amount: Number(amount?.trim()) };
      });
      continue;
    }
    if (extension.editor === 'attachment') {
      const kind = scope.querySelector<HTMLSelectElement>('[data-runtime-editor-attachment-kind]')?.value ?? 'global';
      const id = scope.querySelector<HTMLInputElement>('[data-runtime-editor-attachment-id]')?.value.trim() ?? '';
      values[extension.inputKey] = kind === 'init' ? { kind, initId: id } : kind === 'area' ? { kind, areaId: id } : { kind: 'global' };
      continue;
    }
    const prototype = collectionPrototype(extension.editor ?? '');
    if (prototype) values[extension.inputKey] = readCollection(scope, prototype);
  }
  return values;
}

function runtimeAuthoringContext(ctrl: UIController) {
  return {
    resourceIds: new Set(ctrl.game.registry.resourceDisplays.keys()),
    itemIds: new Set(ctrl.game.registry.items.keys()),
    gachaPoolIds: new Set(ctrl.game.registry.gachaPools.keys()),
    shopIds: new Set(ctrl.game.registry.shops.keys()),
  };
}

export function openRuntimeEditorPanel(ctrl: UIController, surface: UIController['runtimeEditorSurface'] = 'mod'): void {
  ctrl.ensureDebugEditingState();
  ctrl.runtimeEditorSurface = surface;
  ctrl.runtimeEditorPanelOpen = true;
  syncRuntimeEditorPanel(ctrl);
}

export function openRuntimeEditorLauncher(ctrl: UIController): void {
  ctrl.runtimeEditorLauncherOpen = true;
  syncRuntimeEditorLauncher(ctrl);
}

function syncRuntimeEditorLauncherButton(ctrl: UIController): void {
  document.querySelectorAll<HTMLElement>('#runtime-editor-launch').forEach(button => {
    button.setAttribute('aria-expanded', String(ctrl.runtimeEditorLauncherOpen));
    button.classList.toggle('is-active', ctrl.runtimeEditorLauncherOpen);
  });
}

export function syncRuntimeEditorLauncher(ctrl: UIController): void {
  const existing = document.querySelector<HTMLElement>('[data-runtime-editor-launcher-host]');
  if (!ctrl.runtimeEditorLauncherOpen) {
    existing?.remove();
    syncRuntimeEditorLauncherButton(ctrl);
    return;
  }
  const host = existing ?? document.body.appendChild(Object.assign(document.createElement('div'), { className: 'runtime-editor-launcher-host' }));
  host.dataset.runtimeEditorLauncherHost = 'true';
  const entries = runtimeEditorLauncherEntries();
  const unavailableActions = new Set(entries.filter(entry => entry.isAvailable && !entry.isAvailable(ctrl)).map(entry => entry.action));
  host.innerHTML = renderRuntimeEditorLauncher(createUIContext(ctrl.game), ctrl.runtimeEditorLauncherPos, entries, unavailableActions);
  bindRuntimeEditorLauncherActions(ctrl, host);
  syncRuntimeEditorLauncherButton(ctrl);
}

export function syncRuntimeEditorPanel(ctrl: UIController): void {
  const existing = document.querySelector<HTMLElement>('[data-runtime-editor-panel-host]');
  if (!ctrl.runtimeEditorPanelOpen) {
    existing?.remove();
    return;
  }
  const host = existing ?? document.body.appendChild(Object.assign(document.createElement('div'), { className: 'runtime-editor-panel-host' }));
  host.dataset.runtimeEditorPanelHost = 'true';
  host.innerHTML = renderRuntimeEditorPanel(createUIContext(ctrl.game), ctrl.panelState, ctrl.runtimeEditorSurface);
  const panel = host.querySelector<HTMLElement>('.runtime-editor-panel');
  if (panel) bindRuntimeDatapackEditorActions(ctrl, panel);
}

function launcherPosition(ctrl: UIController, launcher: HTMLElement, x: number, y: number): { x: number; y: number } {
  const rect = launcher.getBoundingClientRect();
  const width = rect.width || 240;
  const height = rect.height || 220;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 720;
  const next = {
    x: Math.min(Math.max(8, x), Math.max(8, viewportWidth - width - 8)),
    y: Math.min(Math.max(8, y), Math.max(8, viewportHeight - height - 8)),
  };
  ctrl.runtimeEditorLauncherPos = next;
  launcher.style.left = `${next.x}px`;
  launcher.style.top = `${next.y}px`;
  launcher.style.right = 'auto';
  launcher.style.bottom = 'auto';
  return next;
}

function activateRuntimeEditorLauncherEntry(ctrl: UIController, action: RuntimeEditorLauncherAction): void {
  ctrl.runtimeEditorLauncherOpen = false;
  syncRuntimeEditorLauncher(ctrl);
  const registered = runtimeEditorLauncherEntries().find(entry => entry.action === action);
  if (registered?.isAvailable && !registered.isAvailable(ctrl)) return;
  if (registered?.onSelect) {
    registered.onSelect(ctrl);
    return;
  }
  if (action === 'mod-info') {
    openRuntimeEditorPanel(ctrl, 'mod');
    return;
  }
  if (action === 'content-browser') {
    openRuntimeDatapackEditor(ctrl);
    return;
  }
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor?.enabled) {
    openRuntimeEditorPanel(ctrl);
    return;
  }
  if (!editor.modName || !editor.displayName) {
    setRuntimeEditorError(editor, '请先完成 Mod 信息，再创建内容。');
    openRuntimeEditorPanel(ctrl);
    return;
  }
  ctrl.modal.close();
  openRuntimeEditorPanel(ctrl);
  if (action === 'create-init') {
    prepareRuntimeEditorForNewDefinition(editor, 'inits');
    openRuntimeDefinitionEditor(ctrl, 'inits');
  } else if (action === 'create-area') {
    prepareRuntimeEditorForNewDefinition(editor, 'areas');
    openRuntimeDefinitionEditor(ctrl, 'areas');
  } else {
    const areaId = editor.selectedAreaId ?? ctrl.game.getView().currentAreaId ?? [...ctrl.game.registry.areas.keys()][0];
    if (!areaId) {
      setRuntimeEditorError(editor, '请先创建或选择一个 Area，再创建 Spot。');
      openRuntimeEditorPanel(ctrl);
      return;
    }
    prepareRuntimeEditorForNewSpot(editor, areaId);
    openRuntimeSpotEditor(ctrl);
  }
}

function bindRuntimeEditorLauncherActions(ctrl: UIController, scope: ParentNode): void {
  scope.querySelector('[data-runtime-editor-launcher-close]')?.addEventListener('click', () => {
    ctrl.runtimeEditorLauncherOpen = false;
    syncRuntimeEditorLauncher(ctrl);
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-launcher-entry]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.runtimeEditorLauncherEntry as RuntimeEditorLauncherAction | undefined;
      if (action && runtimeEditorLauncherEntries().some(entry => entry.action === action)) activateRuntimeEditorLauncherEntry(ctrl, action);
    });
  });
  const launcher = scope.querySelector<HTMLElement>('[data-runtime-editor-launcher]');
  const handle = scope.querySelector<HTMLElement>('[data-runtime-editor-launcher-drag-handle]');
  if (!launcher || !handle) return;
  handle.addEventListener('pointerdown', event => {
    if ((event.target as Element).closest('button')) return;
    const pointer = event as PointerEvent;
    const rect = launcher.getBoundingClientRect();
    const offsetX = pointer.clientX - rect.left;
    const offsetY = pointer.clientY - rect.top;
    const move = (nextEvent: PointerEvent): void => {
      launcherPosition(ctrl, launcher, nextEvent.clientX - offsetX, nextEvent.clientY - offsetY);
    };
    const stop = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  });
}

function openRuntimeDatapackEditor(ctrl: UIController): void {
  openRuntimeEditorPanel(ctrl, 'browser');
}

function openRuntimeSpotEditor(ctrl: UIController): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  const spot = editor ? getSelectedRuntimeEditorSpot(editor) : null;
  const areaId = spot?.areaId ?? editor?.selectedAreaId;
  const area = areaId ? ctrl.game.registry.areas.get(areaId) : undefined;
  if (!editor?.enabled || !area) return;
  clearSubDialogs();
  ctrl.runtimeEditorSurface = 'spot';
  ctrl.runtimeEditorPanelOpen = true;
  syncRuntimeEditorPanel(ctrl);
}

function openLoadedRuntimeSpotEditor(ctrl: UIController, runtimeSpotId?: string): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands & PackCatalogReadModel>;
  const runtimeMod = host.getRuntimeMod?.();
  if (!runtimeMod || !ctrl.panelState.runtimeDatapackEditor?.enabled) return;
  const editor = ctrl.panelState.runtimeDatapackEditor;
  hydrateRuntimeEditor(editor, runtimeMod);
  const idName = runtimeSpotId?.split(':').pop();
  if (idName) selectRuntimeEditorSpot(editor, idName);
  openRuntimeSpotEditor(ctrl);
}

function openRuntimeSpotDeleteConfirm(ctrl: UIController, runtimeSpotId?: string): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands & PackCatalogReadModel>;
  const runtimeMod = host.getRuntimeMod?.();
  const editor = ctrl.panelState.runtimeDatapackEditor;
  const idName = runtimeSpotId?.split(':').pop() ?? editor?.selectedSpotId ?? undefined;
  if (idName && editor && !editor.spots.some(spot => spot.idName === idName) && runtimeMod) hydrateRuntimeEditor(editor, runtimeMod);
  if (idName && editor) selectRuntimeEditorSpot(editor, idName);
  const spot = idName ? editor?.spots.find(item => item.idName === idName) : undefined;
  if (!spot) return;
  const runtimeLoaded = Boolean(runtimeMod?.spots.some(item => item.idName === spot.idName));
  ctrl.modal.open({
    title: '删除临时 Spot',
    body: `<div class="runtime-editor-form"><p>即将删除「${escapeHtml(spot.name || spot.idName)}」。${runtimeLoaded ? '该 Spot 已经应用到 Runtime。' : '该 Spot 尚未应用到 Runtime。'}</p><p class="service-summary">保留：以后重新创建同 ID Spot 时恢复原状态。清理：同时移除当前状态与各 Init 快照中的对应记录。</p></div>`,
    footer: '<button type="button" class="modal-close toolbar-button">取消</button><button type="button" class="toolbar-button" data-runtime-delete-clean>删除并清理 PlayerData</button><button type="button" class="primary-button" data-runtime-delete-preserve>删除但保留 PlayerData</button>',
    width: 560,
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
    onClose: clearSubDialogs,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
}

function removeRuntimeSpot(ctrl: UIController, preservePlayerData: boolean): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands & PackCatalogReadModel>;
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor || !editor.selectedSpotId) return;
  const spot = getSelectedRuntimeEditorSpot(editor);
  if (!spot) return;
  const spotId = `${editor.modName}:spot:${spot.idName}`;
  const runtimeState = host.getRuntimeContentState?.();
  const editorCommands = ctrl.commands.runtimeDefinitionEditor;
  const wasApplied = runtimeState?.spots.has(spotId) ?? Boolean(editor.applied);
  let result: { ok: boolean; message: string } = { ok: true, message: `Spot 草稿已删除：${spot.idName}。` };
  if (wasApplied) {
    if (editorCommands && runtimeState) {
      const hotResult = editorCommands.deleteSpot(spot.idName, preservePlayerData ? 'retain' : 'purge');
      if (!hotResult.ok) {
        ctrl.modal.close();
        ctrl.toast.show(hotResult.message, 'error');
        openRuntimeSpotEditor(ctrl);
        return;
      }
      removeRuntimeEditorSpot(editor, spot.idName);
      markRuntimeEditorApplied(editor, true);
      result = { ok: true, message: preservePlayerData ? `临时 Spot 已删除，PlayerData 已保留：${spot.idName}。` : `临时 Spot 与对应 PlayerData 已删除：${spot.idName}。` };
    } else {
      ctrl.modal.close();
      ctrl.toast.show('当前运行时不支持 Runtime Editor Command Facade。', 'error');
      return;
    }
  } else {
    if (!removeRuntimeEditorSpot(editor, spot.idName)) return;
  }
  ctrl.modal.close();
  ctrl.toast.show(result.message, 'success');
  if (wasApplied) {
    ctrl.navigateToService('game');
    ctrl.render();
  } else {
    ctrl.render();
  }
}

function stashRuntimeDefinitionForm(ctrl: UIController, scope: ParentNode): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor || editor.selectedContentKind === 'spots') return;
  const policy = getContentPolicy(editor.selectedContentKind);
  if (!policy) return;
  const definition = getSelectedRuntimeEditorDefinition(editor);
  const values: Record<string, unknown> = {
    ...runtimeEditorInitialValues(createUIContext(ctrl.game), policy),
    ...(definition ?? {}),
    ...(editor.formDraft ?? {}),
  };
  Object.assign(values, readRuntimeEditorFields(policy, scope), readRuntimeDefinitionExtensions(policy, scope));
  const defaultAreaField = scope.querySelector<HTMLInputElement>('[data-runtime-editor-default-area-id-name]');
  if (defaultAreaField) {
    values.__defaultAreaIdName = defaultAreaField.value.trim();
    values.__defaultAreaTouched = editor.formDraft?.__defaultAreaTouched === true;
  }
  editor.formDraft = values;
}

function saveRuntimeDefinitionDraft(ctrl: UIController, scope: ParentNode, reopenEditor = true): boolean {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor || editor.selectedContentKind === 'spots') return false;
  const kind = editor.selectedContentKind;
  const policy = getContentPolicy(kind);
  if (!policy) return false;
  const previousId = editor.selectedDefinitionId;
  stashRuntimeDefinitionForm(ctrl, scope);
  const rawValues: Record<string, unknown> = { ...(editor.formDraft ?? {}) };
  const values: Record<string, unknown> = { ...rawValues };
  delete values.__defaultAreaIdName;
  delete values.__defaultAreaTouched;
  const normalizedIds = normalizeEntityNameValues(policy, values);
  setRuntimeEditorNotice(editor, normalizedIds.length > 0 ? `ID 含大写字母，已自动转为小写：${normalizedIds.join('、')}` : null);
  let bootstrapArea: RuntimeEditorAreaDraft | null = null;
  if (kind === 'inits' && !previousId) {
    if (!editor.modName || !editor.displayName) {
      setRuntimeEditorError(editor, '请先完成 Mod 信息，再创建 Init。');
      if (reopenEditor) openRuntimeDefinitionEditor(ctrl, kind);
      return false;
    }
    const defaultAreaIdName = String(rawValues.__defaultAreaIdName ?? suggestedRuntimeDefaultAreaIdName(String(values.idName ?? ''))).trim().toLowerCase();
    if (!defaultAreaIdName) {
      setRuntimeEditorError(editor, '请填写 defaultArea ID 名。');
      if (reopenEditor) openRuntimeDefinitionEditor(ctrl, kind);
      return false;
    }
    const initId = `${editor.modName}:init:${String(values.idName ?? '')}`;
    const areaInput: RuntimeEditorAreaDraft = {
      idName: defaultAreaIdName,
      initId,
      name: '默认区域',
      description: '',
      defaultSpots: [],
      topology: [],
    };
    normalizeEntityNameValues(AREA_CONTENT_POLICY, areaInput as unknown as Record<string, unknown>);
    const areaId = `${editor.modName}:area:${areaInput.idName}`;
    const duplicateArea = runtimeEditorDefinitions(editor, 'areas').some(area => area.idName === areaInput.idName)
      || runtimeEditorAppliedDefinitions(editor, 'areas').some(area => area.idName === areaInput.idName);
    if (duplicateArea) {
      setRuntimeEditorError(editor, `当前 Draft 已存在 Area ID：${areaInput.idName}`);
      if (reopenEditor) openRuntimeDefinitionEditor(ctrl, kind);
      return false;
    }
    const areaProblem = validateAuthoringInput(AREA_CONTENT_POLICY, areaInput, runtimeAuthoringContext(ctrl));
    if (areaProblem) {
      setRuntimeEditorProblems(editor, [{ code: areaProblem.code, path: areaProblem.path, message: areaProblem.message }]);
      setRuntimeEditorError(editor, areaProblem.message);
      if (reopenEditor) openRuntimeDefinitionEditor(ctrl, kind);
      return false;
    }
    values.defaultAreas = [areaId];
    bootstrapArea = areaInput;
  }
  const policyProblem = validateAuthoringInput(policy, values, runtimeAuthoringContext(ctrl));
  const initValidationValues = bootstrapArea ? { ...values, defaultAreas: [] } : values;
  const initProblems = kind === 'inits' ? runtimeEditorInitProblems(createUIContext(ctrl.game), editor, initValidationValues) : [];
  const problem = policyProblem ?? initProblems[0];
  if (problem) {
    setRuntimeEditorProblems(editor, policyProblem ? [policyProblem, ...initProblems] : initProblems);
    setRuntimeEditorError(editor, problem.message);
    if (reopenEditor) openRuntimeDefinitionEditor(ctrl, kind);
    return false;
  }
  const idName = String(values.idName ?? '');
  if (previousId && previousId !== idName) {
    setRuntimeEditorError(editor, '已打开的内容不能直接修改 ID；如需更换 ID，请删除后新建。');
    setRuntimeEditorProblems(editor, []);
    if (reopenEditor) openRuntimeDefinitionEditor(ctrl, kind);
    return false;
  }
  const duplicate = runtimeEditorDefinitions(editor, kind).some(definition => definition.idName === idName && definition.idName !== previousId);
  if (duplicate) {
    setRuntimeEditorError(editor, `当前 Draft 已存在 ${policy.label} ID：${idName}`);
    setRuntimeEditorProblems(editor, []);
    if (reopenEditor) openRuntimeDefinitionEditor(ctrl, kind);
    return false;
  }
  if (bootstrapArea) {
    setRuntimeEditorDefinition(editor, 'areas', bootstrapArea);
    setRuntimeEditorDefinition(editor, kind, values as unknown as RuntimeEditorDefinitionDraft);
  } else {
    setRuntimeEditorDefinition(editor, kind, values as unknown as RuntimeEditorDefinitionDraft);
  }
  setRuntimeEditorProblems(editor, []);
  setRuntimeEditorError(editor, null);
  if (reopenEditor) openRuntimeDefinitionEditor(ctrl, kind);
  return true;
}

function hasRuntimeWorldContent(editor: ReturnType<typeof createRuntimeDatapackEditorState>): boolean {
  return runtimeEditorPendingDefinitions(editor, 'inits').length > 0
    || runtimeEditorPendingDefinitions(editor, 'areas').length > 0;
}

function applyRuntimeWorldEditorDraft(ctrl: UIController): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return;
  if (!editor.modName || !editor.displayName) {
    setRuntimeEditorError(editor, '请先完成 Mod 元信息。');
    syncRuntimeEditorPanel(ctrl);
    return;
  }
  if (!ctrl.commands.applyRuntimeWorldDraft) {
    setRuntimeEditorError(editor, '当前运行时不支持 Init / Area 热 CRUD。');
    syncRuntimeEditorPanel(ctrl);
    return;
  }
  const initProblems = editor.inits.flatMap(init => runtimeEditorInitProblems(createUIContext(ctrl.game), editor, init));
  if (initProblems.length > 0) {
    setRuntimeEditorProblems(editor, initProblems);
    setRuntimeEditorError(editor, initProblems[0].message);
    syncRuntimeEditorPanel(ctrl);
    return;
  }
  const setMetadata = ctrl.commands.setRuntimeModMetadata;
  if (!setMetadata) {
    setRuntimeEditorError(editor, '当前运行时不支持临时 Mod 命名空间。');
    syncRuntimeEditorPanel(ctrl);
    return;
  }
  const metadata = setMetadata({
    modName: editor.modName,
    displayName: editor.displayName,
    version: editor.version,
    author: editor.author,
    description: editor.description,
  });
  if (!metadata.ok) {
    setRuntimeEditorError(editor, metadata.message);
    syncRuntimeEditorPanel(ctrl);
    return;
  }
  const draft: RuntimeWorldDraft = {
    modName: editor.modName,
    inits: editor.inits,
    areas: editor.areas,
  };
  const result = ctrl.commands.applyRuntimeWorldDraft(draft);
  if (!result.ok) {
    setRuntimeEditorError(editor, result.message);
    setRuntimeEditorProblems(editor, result.diagnostics.map(item => ({ code: item.code, path: item.path, message: item.message })));
    syncRuntimeEditorPanel(ctrl);
    return;
  }
  markRuntimeEditorWorldApplied(editor);
  setRuntimeEditorError(editor, null);
  setRuntimeEditorProblems(editor, []);
  syncRuntimeEditorPanel(ctrl);
  ctrl.toast.show(result.message, 'success');
  ctrl.render();
  syncRuntimeEditorCreateActions(ctrl);
}

type RuntimeApplyFailureView = 'datapack' | 'spot';

function applyRuntimeEditorDraft(
  ctrl: UIController,
  idNames?: readonly string[],
  failureView: RuntimeApplyFailureView = 'datapack',
): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return;
  if (editor.selectedContentKind === 'inits' || editor.selectedContentKind === 'areas' || hasRuntimeWorldContent(editor)) {
    applyRuntimeWorldEditorDraft(ctrl);
    return;
  }
  const reopenAfterFailure = (): void => {
    if (failureView === 'spot') {
      openRuntimeSpotEditor(ctrl);
      return;
    }
    openRuntimeDatapackEditor(ctrl);
  };
  const targets = idNames
    ? editor.spots.filter(spot => idNames.includes(spot.idName))
    : runtimeEditorPendingSpots(editor);
  if (!editor.modName || !editor.displayName) {
    setRuntimeEditorError(editor, '请先完成 Mod 元信息。');
    reopenAfterFailure();
    return;
  }
  if (targets.length === 0) {
    setRuntimeEditorError(editor, '没有需要应用的草稿改动。');
    reopenAfterFailure();
    return;
  }

  const editorCommands = ctrl.commands.runtimeDefinitionEditor;
  const setMetadata = ctrl.commands.setRuntimeModMetadata;
  if (!editorCommands || !setMetadata) {
    setRuntimeEditorError(editor, '当前运行时不支持 Runtime Editor Command Facade。');
    reopenAfterFailure();
    return;
  }
  const metadata = setMetadata({
    modName: editor.modName,
    displayName: editor.displayName,
    version: editor.version,
    author: editor.author,
    description: editor.description,
  });
  if (!metadata.ok) {
    setRuntimeEditorError(editor, metadata.message);
    reopenAfterFailure();
    return;
  }

  const fail = (message: string, diagnostics: readonly RuntimeEditorProblem[]): void => {
    setRuntimeEditorError(editor, message);
    setRuntimeEditorProblems(editor, diagnostics);
    // 批次中途失败时，前面已成功提交的内容仍需一次明确 render；
    // 批次事件本身被抑制，避免逐项刷新覆盖当前编辑器状态。
    if (appliedCount > 0) ctrl.render();
    reopenAfterFailure();
  };
  let appliedCount = 0;
  ctrl.beginContentRefreshBatch();
  try {
    for (const spot of targets) {
      const applied = findRuntimeEditorAppliedSpot(editor, spot.idName);
      const suspended = editor.suspendedSpotIds.includes(spot.idName);
      if (suspended) {
        if (!applied) continue;
        const suspendedResult = editorCommands.suspendSpot(spot.idName);
        if (!suspendedResult.ok) {
          fail(suspendedResult.message, suspendedResult.diagnostics);
          return;
        }
        appliedCount += 1;
        continue;
      }
      if (spot.unsupportedFunctionalityIds?.length) {
        fail(`Spot 含 Demo 编辑器无法 round-trip 的资源功能：${spot.unsupportedFunctionalityIds.join('、')}`, [{
          code: 'invalid-field',
          path: 'spot.affectors',
          message: '请先在 Datapack 中处理该资源功能，Runtime Editor 不会静默覆盖它。',
        }]);
        return;
      }
      if (spot.unsupportedPaymentOptionPaths?.length) {
        fail(`Spot 含 Runtime Editor 无法无损回写的支付方案：${spot.unsupportedPaymentOptionPaths.join('、')}`, [{
          code: 'invalid-field',
          path: 'spot.purchaseOptions',
          message: '当前支付金额不是常量或结构不受支持；请先在 Datapack 中处理，Runtime Editor 不会静默覆盖它。',
        }]);
        return;
      }
      // 字段集由策略表保证；此处只是 DOM 值到命令输入的静态类型边界。
      const { unsupportedFunctionalityIds: _unsupported, unsupportedPaymentOptionPaths: _unsupportedPayments, ...input } = spot;
      const result: RuntimeSpotMutationResult = applied
        ? editorCommands.replaceSpot(spot.idName, input)
        : editorCommands.createSpot(input);
      if (!result.ok) {
        fail(result.message, result.diagnostics);
        return;
      }
      appliedCount += 1;
    }
  } finally {
    ctrl.endContentRefreshBatch();
  }

  markRuntimeEditorApplied(editor, true);
  setRuntimeEditorError(editor, null);
  setRuntimeEditorProblems(editor, []);
  openRuntimeSpotEditor(ctrl);
  ctrl.toast.show(`${appliedCount} 项已应用到运行时`, 'success');
  ctrl.render();
  syncRuntimeEditorCreateActions(ctrl);
}

/** 保存当前表单到草稿：只产生 Draft revision，不触碰运行时。 */
function saveRuntimeSpotDraft(ctrl: UIController, scope: ParentNode, reopenEditor = true): boolean {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return false;
  const previousId = editor.selectedSpotId;
  const previous = previousId ? editor.spots.find(spot => spot.idName === previousId) : undefined;
  // 页隔离渲染：先并入当前页，再与暂存汇总成一次提交。
  stashSpotForm(ctrl, scope);
  const values: Record<string, unknown> = { ...(editor.formDraft ?? {}) };
  const normalizedIds = normalizeEntityNameValues(SPOT_CONTENT_POLICY, values);
  setRuntimeEditorNotice(editor, normalizedIds.length > 0 ? `ID 含大写字母，已自动转为小写：${normalizedIds.join('、')}` : null);
  // unsupported* 是编辑器内部的来源诊断，不属于 Spot 输入字段；
  // 直接 Apply 也要先保存当前表单，但不能因此把诊断字段误判为未授权字段。
  const { unsupportedFunctionalityIds: _unsupported, unsupportedPaymentOptionPaths: _unsupportedPayments, ...authoringValues } = values;
  const problem = validateAuthoringInput(SPOT_CONTENT_POLICY, authoringValues, {
    resourceIds: new Set(ctrl.game.registry.resourceDisplays.keys()),
    itemIds: new Set(ctrl.game.registry.items.keys()),
    gachaPoolIds: new Set(ctrl.game.registry.gachaPools.keys()),
    shopIds: new Set(ctrl.game.registry.shops.keys()),
  });
  if (problem) {
    setRuntimeEditorProblems(editor, [problem]);
    setRuntimeEditorError(editor, problem.message);
    openRuntimeSpotEditor(ctrl);
    return false;
  }
  const idName = String(values.idName);
  const applied = findRuntimeEditorAppliedSpot(editor, idName);
  const duplicate = editor.spots.some(spot => spot.idName === idName && spot.idName !== previousId);
  if (applied && idName !== previousId) {
    setRuntimeEditorProblems(editor, []);
    setRuntimeEditorError(editor, '已应用 Spot 的 ID 不能修改；如需更换 ID，请删除后新建。');
    openRuntimeSpotEditor(ctrl);
    return false;
  }
  if (duplicate) {
    setRuntimeEditorProblems(editor, []);
    setRuntimeEditorError(editor, `当前 Draft 已存在 Spot ID：${idName}`);
    openRuntimeSpotEditor(ctrl);
    return false;
  }
  setRuntimeEditorSpot(editor, {
    ...values,
    ...(previous?.unsupportedFunctionalityIds ? { unsupportedFunctionalityIds: previous.unsupportedFunctionalityIds } : {}),
    ...(previous?.unsupportedPaymentOptionPaths ? { unsupportedPaymentOptionPaths: previous.unsupportedPaymentOptionPaths } : {}),
  } as unknown as RuntimeEditorSpotDraft);
  setRuntimeEditorProblems(editor, []);
  setRuntimeEditorError(editor, null);
  if (reopenEditor) openRuntimeSpotEditor(ctrl);
  syncRuntimeEditorCreateActions(ctrl);
  return true;
}

function openRuntimeDefinitionEditor(ctrl: UIController, kind: RuntimeEditorContentKind): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor?.enabled) return;
  editor.selectedContentKind = kind;
  clearSubDialogs();
  ctrl.runtimeEditorSurface = 'definition';
  ctrl.runtimeEditorPanelOpen = true;
  syncRuntimeEditorPanel(ctrl);
}

function openRuntimeDefinitionDeleteConfirm(ctrl: UIController, kind: RuntimeEditorContentKind, idName: string): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return;
  const definition = runtimeEditorDefinitions(editor, kind).find(item => item.idName === idName);
  if (!definition) return;
  const policy = getContentPolicy(kind);
  const label = kind === 'inits' ? 'Init' : kind === 'areas' ? 'Area' : 'Enhancement';
  const name = definition && 'name' in definition ? definition.name : idName;
  const applied = runtimeEditorAppliedDefinitions(editor, kind).some(item => item.idName === idName);
  const impact = kind === 'inits' ? renderRuntimeInitDeletionImpact(ctrl, idName) : '';
  ctrl.modal.open({
    title: `删除临时 ${label}`,
    body: `<div class="runtime-editor-form"><p>即将删除「${escapeHtml(name || idName)}」。</p><p class="service-summary">${applied ? `该 ${label} 已应用到 Runtime；确认后会从 Draft 移除，点击“应用到运行时”才会真正移除。` : `该 ${label} 尚未应用到 Runtime，只会从当前 Draft 移除。`}</p>${impact}${policy?.unsupportedFieldHint ? `<p class="runtime-editor-hint">${escapeHtml(policy.unsupportedFieldHint)}</p>` : ''}</div>`,
    footer: '<button type="button" class="modal-close toolbar-button">取消</button><button type="button" class="primary-button danger" data-runtime-definition-delete-confirm>确认删除</button>',
    width: 560,
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
    onClose: clearSubDialogs,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) {
    modal.querySelector('[data-runtime-definition-delete-confirm]')?.addEventListener('click', () => {
      if (!removeRuntimeEditorDefinition(editor, kind, idName)) return;
      ctrl.modal.close();
      ctrl.toast.show(`已从 Draft 删除 ${label}：${idName}；请应用到运行时完成删除。`, 'success');
      openRuntimeDatapackEditor(ctrl);
    });
  }
}

function renderRuntimeInitDeletionImpact(ctrl: UIController, idName: string): string {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor?.modName) return '';
  const initId = `${editor.modName}:init:${idName}`;
  const areas = [...ctrl.game.registry.areas.values()].filter(area => area.initId === initId);
  const spotIds = areas.flatMap(area => ctrl.game.registry.spotsOfArea(area.id));
  const view = ctrl.game.getView();
  const active = view.activeInit === initId;
  const areaText = areas.length > 0
    ? areas.map(area => `${area.name || area.id} (${area.id})`).join('、')
    : '无已注册 Area';
  const spotText = spotIds.length > 0 ? `${spotIds.length} 个 Spot` : '无已注册 Spot';
  const activeText = active
    ? `当前 activeInit：${initId}；currentAreaId：${view.currentAreaId ?? '未设置'}。Apply 后会回到 Init 选择界面。`
    : '当前不是 activeInit；不会改变当前玩家位置。';
  return `<section class="runtime-editor-delete-impact" aria-label="删除影响"><h5>删除影响预览</h5><ul><li><span>所属 Area</span><strong>${escapeHtml(areaText)}</strong></li><li><span>关联 Spot</span><strong>${escapeHtml(spotText)}（不会级联删除）</strong></li><li><span>当前定位</span><strong>${escapeHtml(activeText)}</strong></li><li><span>per-Init 快照</span><strong>保留，不自动清理</strong></li></ul><p class="runtime-editor-warning">若仍有 Area 引用该 Init，Apply 会被阻断；请先在同一批次处理引用，系统不会留下半删除状态。</p></section>`;
}

export function bindRuntimeDatapackEditorActions(ctrl: UIController, scope: ParentNode): void {
  const defaultAreaInput = scope.querySelector<HTMLInputElement>('[data-runtime-editor-default-area-id-name]');
  const initIdInput = scope.querySelector<HTMLInputElement>('[data-runtime-editor-field="idName"]');
  defaultAreaInput?.addEventListener('input', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    editor.formDraft = { ...(editor.formDraft ?? {}), __defaultAreaIdName: defaultAreaInput.value, __defaultAreaTouched: true };
  });
  initIdInput?.addEventListener('input', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor || editor.formDraft?.__defaultAreaTouched === true || !defaultAreaInput) return;
    defaultAreaInput.value = suggestedRuntimeDefaultAreaIdName(initIdInput.value);
  });
  scope.querySelector('[data-runtime-editor-panel-close]')?.addEventListener('click', () => {
    ctrl.runtimeEditorPanelOpen = false;
    clearSubDialogs();
    syncRuntimeEditorPanel(ctrl);
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-surface]').forEach(button => {
    button.addEventListener('click', () => {
      const surface = button.dataset.runtimeEditorSurface as UIController['runtimeEditorSurface'] | undefined;
      if (!surface) return;
      if (surface === 'browser' && !ctrl.panelState.runtimeDatapackEditor?.enabled) return;
      ctrl.runtimeEditorSurface = surface;
      syncRuntimeEditorPanel(ctrl);
    });
  });
  scope.querySelector('#runtime-editor-launch')?.addEventListener('click', () => {
    if (ctrl.runtimeEditorLauncherOpen) {
      ctrl.runtimeEditorLauncherOpen = false;
      syncRuntimeEditorLauncher(ctrl);
    } else openRuntimeEditorLauncher(ctrl);
  });
  scope.querySelector('[data-runtime-editor-toggle]')?.addEventListener('click', () => {
    ctrl.ensureDebugEditingState();
    if (!ctrl.panelState.runtimeDatapackEditor) {
      ctrl.panelState.runtimeDatapackEditor = createRuntimeDatapackEditorState([...ctrl.game.registry.areas.keys()][0] ?? null);
    }
    openRuntimeEditorPanel(ctrl);
    ctrl.render();
  });
  scope.querySelector('[data-runtime-editor-open]')?.addEventListener('click', () => openRuntimeEditorPanel(ctrl, 'mod'));
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-kind-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const kind = tab.dataset.runtimeEditorKindTab as RuntimeEditorContentKind | undefined;
      const editor = ctrl.panelState.runtimeDatapackEditor;
      if (!kind || !editor) return;
      const currentKind = editor.selectedContentKind;
      if (currentKind === 'spots') stashSpotForm(ctrl, scope);
      else stashRuntimeDefinitionForm(ctrl, scope);
      editor.selectedContentKind = kind;
      editor.selectedDefinitionId = null;
      editor.selectedSpotId = null;
      editor.activeSection = null;
      editor.formDraft = null;
      openRuntimeDatapackEditor(ctrl);
    });
  });
  // 左侧 Switch：页互相隔离（只渲染当前页）；切页前先把本页值并入表单暂存。
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-section-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.runtimeEditorSectionTab;
      const editor = ctrl.panelState.runtimeDatapackEditor;
      if (!id || !editor) return;
      if (editor.selectedContentKind === 'spots') stashSpotForm(ctrl, scope);
      else stashRuntimeDefinitionForm(ctrl, scope);
      editor.activeSection = id;
      if (editor.selectedContentKind === 'spots') openRuntimeSpotEditor(ctrl);
      else openRuntimeDefinitionEditor(ctrl, editor.selectedContentKind);
    });
  });
  scope.querySelector('[data-runtime-editor-close]')?.addEventListener('click', () => {
    ctrl.runtimeEditorPanelOpen = false;
    clearSubDialogs();
    syncRuntimeEditorPanel(ctrl);
  });
  scope.querySelector('[data-runtime-editor-create]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    const normalizedModName = readRuntimeEditorModFields(ctrl, scope);
    setRuntimeEditorNotice(editor, normalizedModName ? `modName 含大写字母，已自动转为小写：${editor.modName}` : null);
    const loaded = ctrl.game.registry.loadedModNames;
    const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogReadModel>;
    const currentRuntimeMod = host.getRuntimeMod?.();
    if (!/^[a-z0-9-]+$/.test(editor.modName)) setRuntimeEditorError(editor, 'modName 只能包含小写字母、数字和连字符。');
    else if (loaded.has(editor.modName) && currentRuntimeMod?.modName !== editor.modName) setRuntimeEditorError(editor, `modName 已被已加载数据包占用：${editor.modName}`);
    else if (!editor.displayName) setRuntimeEditorError(editor, '请填写 Mod 显示名称。');
    else if (ctrl.commands.setRuntimeModMetadata) {
      const result = ctrl.commands.setRuntimeModMetadata({
        modName: editor.modName,
        displayName: editor.displayName,
        version: editor.version,
        author: editor.author,
        description: editor.description,
      });
      setRuntimeEditorError(editor, result.ok ? null : result.message);
      if (!result.ok) {
        openRuntimeEditorPanel(ctrl, 'mod');
        syncRuntimeEditorCreateActions(ctrl);
        return;
      }
    } else setRuntimeEditorError(editor, null);
    ctrl.toast.show('Mod 信息已保存。', 'success');
    // 重新渲染同一页面即可，不能把 Mod 设定保存自动转成 Spot 创建页。
    openRuntimeEditorPanel(ctrl, 'mod');
    syncRuntimeEditorCreateActions(ctrl);
  });
  scope.querySelector('[data-runtime-editor-create-spot]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    if (!editor.modName || !editor.displayName) {
      setRuntimeEditorError(editor, '请先完成 Mod 元信息。');
      openRuntimeDatapackEditor(ctrl);
      syncRuntimeEditorCreateActions(ctrl);
      return;
    }
    saveRuntimeSpotDraft(ctrl, scope);
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-save-definition]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      if (!editor) return;
      saveRuntimeDefinitionDraft(ctrl, scope);
    });
  });
  bindRuntimeCollectionActions(ctrl, scope);
  bindRuntimeInitAreaActions(ctrl, scope);
  bindRuntimeAreaTopologyActions(ctrl, scope);
  scope.querySelector('[data-runtime-editor-apply]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    const applyingFromSpot = Boolean(scope.querySelector('[data-runtime-editor-spot-form]'));
    // Spot 页按当前 Switch 分页渲染，idName 不一定存在于当前 DOM；
    // 只要来源是 Spot 表单，就必须先汇总 formDraft，再直接应用。
    if (applyingFromSpot) {
      if (!saveRuntimeSpotDraft(ctrl, scope, false)) return;
    } else if (scope.querySelector('[data-runtime-editor-definition-form]')) {
      if (!saveRuntimeDefinitionDraft(ctrl, scope, false)) return;
    }
    applyRuntimeEditorDraft(ctrl, editor.selectedSpotId ? [editor.selectedSpotId] : undefined, applyingFromSpot ? 'spot' : 'datapack');
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-definition-edit]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      const kind = button.dataset.runtimeEditorKind as RuntimeEditorContentKind | undefined;
      const idName = button.dataset.runtimeEditorDefinitionId;
      if (!editor || !kind || !idName || !selectRuntimeEditorDefinition(editor, kind, idName)) return;
      openRuntimeDefinitionEditor(ctrl, kind);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-definition-remove]').forEach(button => {
    button.addEventListener('click', () => {
      const kind = button.dataset.runtimeEditorKind as RuntimeEditorContentKind | undefined;
      const idName = button.dataset.runtimeEditorDefinitionId;
      if (!kind || kind === 'spots' || !idName) return;
      openRuntimeDefinitionDeleteConfirm(ctrl, kind, idName);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-definition-restore]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      const kind = button.dataset.runtimeEditorKind as RuntimeEditorContentKind | undefined;
      const idName = button.dataset.runtimeEditorDefinitionId;
      if (!editor || !kind || kind === 'spots' || !idName) return;
      if (!restoreRuntimeEditorDefinition(editor, kind, idName)) return;
      ctrl.toast.show(`已撤销删除 ${kind === 'inits' ? 'Init' : 'Area'}：${idName}`, 'info');
      openRuntimeDatapackEditor(ctrl);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-filter]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      if (!editor) return;
      setRuntimeEditorFilter(editor, (button.dataset.runtimeEditorFilter ?? 'all') as RuntimeEditorFilter);
      openRuntimeDatapackEditor(ctrl);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-entry-edit]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      if (!editor) return;
      const idName = button.dataset.runtimeEditorEntryEdit;
      if (!idName || !selectRuntimeEditorSpot(editor, idName)) return;
      openRuntimeSpotEditor(ctrl);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-entry-remove]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      const idName = button.dataset.runtimeEditorEntryRemove;
      if (!editor || !idName) return;
      selectRuntimeEditorSpot(editor, idName);
      openRuntimeSpotDeleteConfirm(ctrl, `${editor.modName}:spot:${idName}`);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-diagnostic]').forEach(item => {
    const focusDiagnostic = (): void => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      if (!editor) return;
      const key = item.dataset.runtimeEditorDiagnostic;
      const sectionId = item.dataset.runtimeEditorDiagnosticSection;
      const kind = (scope.querySelector<HTMLElement>('[data-runtime-editor-definition-form]')?.dataset.runtimeEditorContentKind ?? editor.selectedContentKind) as RuntimeEditorContentKind;
      if (sectionId && editor.activeSection !== sectionId) {
        if (kind === 'spots') stashSpotForm(ctrl, scope);
        else stashRuntimeDefinitionForm(ctrl, scope);
        editor.activeSection = sectionId;
        if (kind === 'spots') openRuntimeSpotEditor(ctrl);
        else openRuntimeDefinitionEditor(ctrl, kind);
        return;
      }
      if (key) scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-editor-field="${key}"]`)?.focus();
      const index = item.dataset.runtimeEditorDiagnosticPath?.match(/defaultAreas\[(\d+)\]/)?.[1];
      if (index) scope.querySelector<HTMLElement>(`[data-runtime-init-area-row][data-runtime-init-area-index="${index}"] button`)?.focus();
    };
    item.addEventListener('click', focusDiagnostic);
    item.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        focusDiagnostic();
      }
    });
  });
  scope.querySelector('[data-runtime-editor-delete-spot]')?.addEventListener('click', () => {
    openRuntimeSpotDeleteConfirm(ctrl);
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-delete-definition]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      const kind = button.dataset.runtimeEditorDeleteDefinition as RuntimeEditorContentKind | undefined;
      const idName = button.dataset.runtimeEditorDefinitionId ?? editor?.selectedDefinitionId;
      if (!editor || !kind || kind === 'spots' || !idName) return;
      openRuntimeDefinitionDeleteConfirm(ctrl, kind, idName);
    });
  });
  scope.querySelector('[data-runtime-editor-new-spot]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    const areaId = editor.selectedAreaId ?? ctrl.game.getView().currentAreaId ?? [...ctrl.game.registry.areas.keys()][0];
    if (!areaId) return;
    prepareRuntimeEditorForNewSpot(editor, areaId);
    openRuntimeSpotEditor(ctrl);
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-new-definition]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      const kind = button.dataset.runtimeEditorNewDefinition as RuntimeEditorContentKind | undefined;
      if (!editor || !kind || kind === 'spots') return;
      prepareRuntimeEditorForNewDefinition(editor, kind);
      openRuntimeDefinitionEditor(ctrl, kind);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-spot-edit]').forEach(button => {
    button.addEventListener('click', () => openLoadedRuntimeSpotEditor(ctrl, button.dataset.runtimeSpotEdit));
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-spot-delete]').forEach(button => {
    button.addEventListener('click', () => openRuntimeSpotDeleteConfirm(ctrl, button.dataset.runtimeSpotDelete));
  });
  scope.querySelector('[data-runtime-delete-preserve]')?.addEventListener('click', () => removeRuntimeSpot(ctrl, true));
  scope.querySelector('[data-runtime-delete-clean]')?.addEventListener('click', () => removeRuntimeSpot(ctrl, false));
}

/**
 * 切页 / 保存前的表单暂存：把当前页的字段与集合并入 `editor.formDraft`。
 * 页互相隔离渲染，汇总只发生在提交口径上。
 */
function stashSpotForm(ctrl: UIController, scope: ParentNode): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return;
  const spot = getSelectedRuntimeEditorSpot(editor);
  // 基准值（初值 + Draft + 既有暂存）必须始终在场：当前页 DOM 只提供本页覆盖项。
  const values: Record<string, unknown> = {
    ...runtimeEditorInitialValues(createUIContext(ctrl.game), SPOT_CONTENT_POLICY, { preferredRefValue: editor.selectedAreaId }),
    ...(spot ?? {}),
    ...(editor.formDraft ?? {}),
  };
  Object.assign(values, readRuntimeEditorFields(SPOT_CONTENT_POLICY, scope));
  for (const prototype of collectionPrototypes()) {
    if (scope.querySelector(`[data-runtime-collection="${prototype.id}"]`)) {
      values[prototype.field] = readCollection(scope, prototype);
    }
  }
  editor.formDraft = values;
}

function bindRuntimeInitAreaActions(ctrl: UIController, scope: ParentNode): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor || editor.selectedContentKind !== 'inits') return;
  const picker = scope.querySelector<HTMLElement>('[data-runtime-init-area-picker]');
  const input = picker?.querySelector<HTMLInputElement>('[data-runtime-init-area-query]');
  const menu = picker?.querySelector<HTMLElement>('[data-runtime-init-area-options]');
  const options = menu ? [...menu.querySelectorAll<HTMLButtonElement>('[data-runtime-init-area-option]')] : [];
  let activeIndex = -1;
  const closePicker = (): void => {
    if (!menu || !input) return;
    menu.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    options.forEach(option => option.removeAttribute('aria-selected'));
    activeIndex = -1;
  };
  const openPicker = (): void => {
    if (!menu || !input) return;
    const query = input.value.trim().toLocaleLowerCase();
    let firstVisible = -1;
    options.forEach((option, index) => {
      const haystack = `${option.dataset.areaLabel ?? ''} ${option.dataset.areaId ?? ''}`.toLocaleLowerCase();
      const visible = !query || haystack.includes(query);
      option.hidden = !visible;
      option.style.display = visible ? '' : 'none';
      option.removeAttribute('aria-selected');
      if (visible && firstVisible < 0) firstVisible = index;
    });
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    activeIndex = firstVisible;
    if (activeIndex >= 0) options[activeIndex].setAttribute('aria-selected', 'true');
  };
  const chooseOption = (option: HTMLButtonElement | undefined): void => {
    if (!option || !input || option.getAttribute('aria-disabled') === 'true') return;
    input.value = option.dataset.areaLabel ?? option.dataset.areaId ?? '';
    input.dataset.selectedAreaId = option.dataset.areaId ?? '';
    closePicker();
  };
  input?.addEventListener('focus', openPicker);
  input?.addEventListener('input', () => {
    delete input.dataset.selectedAreaId;
    openPicker();
  });
  input?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closePicker();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openPicker();
      const visible = options.filter(option => !option.hidden);
      if (visible.length === 0) return;
      const current = activeIndex >= 0 ? options[activeIndex] : undefined;
      const currentVisible = current && !current.hidden ? visible.indexOf(current) : -1;
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      const next = Math.max(0, Math.min(visible.length - 1, currentVisible + offset));
      activeIndex = options.indexOf(visible[next]);
      options.forEach(option => option.removeAttribute('aria-selected'));
      visible[next].setAttribute('aria-selected', 'true');
      visible[next].scrollIntoView?.({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter' && menu && !menu.hidden) {
      event.preventDefault();
      chooseOption(activeIndex >= 0 ? options[activeIndex] : options.find(option => !option.hidden));
    }
  });
  options.forEach(option => {
    option.addEventListener('mousedown', event => event.preventDefault());
    option.addEventListener('click', () => chooseOption(option));
  });
  input?.addEventListener('blur', () => setTimeout(() => {
    if (!picker?.contains(document.activeElement)) closePicker();
  }, 0));

  scope.querySelector('[data-runtime-init-area-add]')?.addEventListener('click', () => {
    stashRuntimeDefinitionForm(ctrl, scope);
    const values = editor.formDraft ?? {};
    const selectedId = input?.dataset.selectedAreaId ?? '';
    const option = options.find(item => item.dataset.areaId === selectedId);
    const areas = Array.isArray(values.defaultAreas) ? values.defaultAreas.map(item => String(item)) : [];
    const initId = `${editor.modName}:init:${String(values.idName ?? '')}`;
    if (!option || option.getAttribute('aria-disabled') === 'true') {
      setRuntimeEditorError(editor, '请从候选列表中选择一个尚未加入的 Area。');
    } else if (areas.includes(selectedId)) {
      setRuntimeEditorError(editor, `默认区域不能重复：${selectedId}`);
    } else if (option.dataset.areaInitId && option.dataset.areaInitId !== initId) {
      setRuntimeEditorError(editor, `默认区域归属不一致：${selectedId} 属于 ${option.dataset.areaInitId}。`);
      setRuntimeEditorProblems(editor, [{ code: 'wrong-owner', path: 'init.defaultAreas', sectionId: 'areas', message: `默认区域归属不一致：${selectedId} 属于 ${option.dataset.areaInitId}。` }]);
    } else {
      editor.formDraft = { ...values, defaultAreas: [...areas, selectedId] };
      setRuntimeEditorError(editor, null);
      setRuntimeEditorProblems(editor, runtimeEditorInitProblems(createUIContext(ctrl.game), editor, editor.formDraft));
    }
    openRuntimeDefinitionEditor(ctrl, 'inits');
  });

  const reorder = (index: number, delta: number): void => {
    stashRuntimeDefinitionForm(ctrl, scope);
    const values = editor.formDraft ?? {};
    const areas = Array.isArray(values.defaultAreas) ? values.defaultAreas.map(item => String(item)) : [];
    const target = index + delta;
    if (index < 0 || target < 0 || target >= areas.length) return;
    [areas[index], areas[target]] = [areas[target], areas[index]];
    editor.formDraft = { ...values, defaultAreas: areas };
    setRuntimeEditorError(editor, null);
    setRuntimeEditorProblems(editor, runtimeEditorInitProblems(createUIContext(ctrl.game), editor, editor.formDraft));
    openRuntimeDefinitionEditor(ctrl, 'inits');
  };
  scope.querySelectorAll<HTMLElement>('[data-runtime-init-area-up]').forEach(button => button.addEventListener('click', () => reorder(Number(button.dataset.runtimeInitAreaUp), -1)));
  scope.querySelectorAll<HTMLElement>('[data-runtime-init-area-down]').forEach(button => button.addEventListener('click', () => reorder(Number(button.dataset.runtimeInitAreaDown), 1)));
  scope.querySelectorAll<HTMLElement>('[data-runtime-init-area-remove]').forEach(button => button.addEventListener('click', () => {
    stashRuntimeDefinitionForm(ctrl, scope);
    const values = editor.formDraft ?? {};
    const areas = Array.isArray(values.defaultAreas) ? values.defaultAreas.map(item => String(item)) : [];
    const index = Number(button.dataset.runtimeInitAreaRemove);
    if (!Number.isInteger(index) || index < 0 || index >= areas.length) return;
    areas.splice(index, 1);
    editor.formDraft = { ...values, defaultAreas: areas };
    setRuntimeEditorError(editor, null);
    setRuntimeEditorProblems(editor, runtimeEditorInitProblems(createUIContext(ctrl.game), editor, editor.formDraft));
    openRuntimeDefinitionEditor(ctrl, 'inits');
  }));
}

/** 集合的增删与条目子编辑：原型驱动；新增一类可变列表无需修改这里。 */
function bindRuntimeAreaTopologyActions(ctrl: UIController, scope: ParentNode): void {
  const picker = scope.querySelector<HTMLElement>('[data-runtime-area-topology-picker]');
  const input = picker?.querySelector<HTMLInputElement>('[data-runtime-area-topology-area]');
  const menu = picker?.querySelector<HTMLElement>('[data-runtime-area-topology-options]');
  const options = menu ? [...menu.querySelectorAll<HTMLButtonElement>('[data-runtime-area-topology-option]')] : [];
  const empty = menu?.querySelector<HTMLElement>('[data-runtime-area-topology-empty]');
  let activeIndex = -1;
  const closePicker = () => {
    if (!menu || !input) return;
    menu.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    options.forEach(option => option.removeAttribute('aria-selected'));
    activeIndex = -1;
  };
  const openPicker = () => {
    if (!menu || !input) return;
    const query = input.value.trim().toLocaleLowerCase();
    let firstVisible = -1;
    options.forEach((option, index) => {
      const haystack = `${option.dataset.areaLabel ?? ''} ${option.dataset.areaId ?? ''}`.toLocaleLowerCase();
      const visible = !query || haystack.includes(query);
      option.hidden = !visible;
      option.style.display = visible ? '' : 'none';
      if (visible && firstVisible < 0) firstVisible = index;
      option.removeAttribute('aria-selected');
    });
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (empty) empty.hidden = firstVisible < 0;
    activeIndex = firstVisible;
    if (activeIndex >= 0) options[activeIndex].setAttribute('aria-selected', 'true');
  };
  const chooseOption = (option: HTMLButtonElement | undefined) => {
    if (!option || !input) return;
    input.value = option.dataset.areaId ?? '';
    input.dataset.selectedAreaId = option.dataset.areaId ?? '';
    closePicker();
  };
  input?.addEventListener('focus', openPicker);
  input?.addEventListener('input', () => {
    if (input.dataset.selectedAreaId && input.value !== input.dataset.selectedAreaId) delete input.dataset.selectedAreaId;
    openPicker();
  });
  input?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closePicker();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openPicker();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const visible = options.filter(option => !option.hidden);
      if (visible.length === 0) return;
      const current = activeIndex >= 0 ? options[activeIndex] : undefined;
      const next = Math.max(0, Math.min(visible.length - 1, Math.max(0, visible.indexOf(current!) + direction)));
      activeIndex = options.indexOf(visible[next]);
      options.forEach(option => option.removeAttribute('aria-selected'));
      visible[next].setAttribute('aria-selected', 'true');
      visible[next].scrollIntoView?.({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter' && menu && !menu.hidden) {
      event.preventDefault();
      chooseOption(activeIndex >= 0 ? options[activeIndex] : options.find(option => !option.hidden));
    }
  });
  options.forEach(option => {
    option.addEventListener('mousedown', event => event.preventDefault());
    option.addEventListener('click', () => chooseOption(option));
  });
  input?.addEventListener('blur', () => setTimeout(() => {
    if (!picker?.contains(document.activeElement)) closePicker();
  }, 0));
  scope.querySelector('[data-runtime-area-topology-add]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor || editor.selectedContentKind !== 'areas') return;
    stashRuntimeDefinitionForm(ctrl, scope);
    const areaId = scope.querySelector<HTMLInputElement>('[data-runtime-area-topology-area]')?.value.trim() ?? '';
    const type = scope.querySelector<HTMLSelectElement>('[data-runtime-area-topology-type]')?.value === 'twoWay' ? 'twoWay' : 'oneWay';
    const topology = Array.isArray(editor.formDraft?.topology) ? [...editor.formDraft.topology as Array<{ areaId: string; type: 'oneWay' | 'twoWay' }>] : [];
    if (!areaId) setRuntimeEditorError(editor, '请先搜索并选择一个 Area。');
    else if (areaId === `${editor.modName}:area:${String(editor.formDraft?.idName ?? '')}`) setRuntimeEditorError(editor, '不能把当前 Area 连接到自身。');
    else if (topology.some(item => item.areaId === areaId)) setRuntimeEditorError(editor, `拓扑中已经存在 Area：${areaId}`);
    else {
      const currentInitId = typeof editor.formDraft?.initId === 'string' ? editor.formDraft.initId : '';
      const registryArea = ctrl.game.registry.areas.get(areaId);
      const draftArea = editor.areas.find(area => `${editor.modName}:area:${area.idName}` === areaId);
      const targetInitId = registryArea?.initId ?? draftArea?.initId ?? '';
      if (currentInitId && targetInitId && currentInitId !== targetInitId) {
        setRuntimeEditorError(editor, `拓扑连接必须属于同一 Init：当前为 ${currentInitId}，目标属于 ${targetInitId}。`);
      } else {
        topology.push({ areaId, type });
        editor.formDraft = { ...editor.formDraft, topology };
        setRuntimeEditorError(editor, null);
      }
    }
    openRuntimeDefinitionEditor(ctrl, 'areas');
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-area-topology-remove]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      if (!editor || editor.selectedContentKind !== 'areas') return;
      stashRuntimeDefinitionForm(ctrl, scope);
      const index = Number(button.dataset.runtimeAreaTopologyRemove);
      const topology = Array.isArray(editor.formDraft?.topology) ? [...editor.formDraft.topology as Array<{ areaId: string; type: 'oneWay' | 'twoWay' }>] : [];
      if (!Number.isInteger(index) || index < 0 || index >= topology.length) return;
      topology.splice(index, 1);
      editor.formDraft = { ...editor.formDraft, topology };
      setRuntimeEditorError(editor, null);
      openRuntimeDefinitionEditor(ctrl, 'areas');
    });
  });
}

function bindRuntimeCollectionActions(ctrl: UIController, scope: ParentNode): void {
  const context = (): ReturnType<typeof createUIContext> => createUIContext(ctrl.game);
  const dialogMode = scope instanceof HTMLElement && scope.classList.contains('runtime-subdialog') ? 'push' : 'replace';
  scope.querySelectorAll<HTMLElement>('[data-runtime-collection]').forEach(section => {
    const prototype = collectionPrototype(section.dataset.runtimeCollection ?? '');
    if (!prototype) return;
    if (section.dataset.runtimeCollectionBound === '1') return;
    section.dataset.runtimeCollectionBound = '1';

    section.querySelectorAll<HTMLElement>('[data-runtime-collection-add]').forEach(button => {
      button.addEventListener('click', () => {
        const items = readCollection(section, prototype);
        items.push(prototype.createEmpty(context()) as never);
        replaceCollectionBlock(ctrl, scope, section, renderCollection(context(), prototype, items));
      });
    });

    section.querySelectorAll<HTMLElement>('[data-runtime-collection-remove]').forEach(button => {
      button.addEventListener('click', () => {
        const row = button.closest<HTMLElement>('[data-runtime-collection-row]');
        const index = Number(row?.dataset.runtimeCollectionIndex ?? -1);
        const items = readCollection(section, prototype).filter((_item, i) => i !== index);
        replaceCollectionBlock(ctrl, scope, section, renderCollection(context(), prototype, items));
      });
    });

    section.querySelectorAll<HTMLElement>('[data-runtime-collection-edit]').forEach(button => {
      button.addEventListener('click', () => {
        const row = button.closest<HTMLElement>('[data-runtime-collection-row]');
        const item = row ? collectionRowItem(row) : undefined;
        if (!row || item === undefined) return;
        openCollectionItemDialog(ctrl, row, prototype, item, dialogMode);
      });
    });
  });
}

function replaceCollectionBlock(ctrl: UIController, scope: ParentNode, section: HTMLElement, html: string): void {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const next = wrapper.firstElementChild;
  if (!next) return;
  section.replaceWith(next);
  bindRuntimeCollectionActions(ctrl, scope);
}

/** 条目子编辑弹窗：渲染原型条目表单；保存经 validate / readItem 后写回行内 hidden。 */
function openCollectionItemDialog(
  ctrl: UIController,
  row: HTMLElement,
  prototype: CollectionPrototype<never>,
  current: unknown,
  mode: 'replace' | 'push' = 'replace',
): void {
  const ctx = createUIContext(ctrl.game);
  const host = openSubDialog({
    title: `${prototype.label} · 编辑`,
    body: prototype.renderItem(ctx, current as never),
    footer: '<button type="button" class="toolbar-button" data-runtime-subdialog-close>取消</button><button type="button" class="primary-button" data-subdialog-save>保存</button>',
    mode,
  });
  host.dataset.runtimeItemPrototype = prototype.id;
  bindItemDialogActions(ctrl, host, row, current, mode);
  host.querySelector('[data-subdialog-save]')?.addEventListener('click', () => {
    const item = prototype.readItem(host, current as never);
    const problem = prototype.validate?.(ctx, item as never);
    if (problem) {
      ctrl.toast.show(problem, 'error');
      return;
    }
    writeCollectionRow(ctx, row, prototype, item);
    closeSubDialog();
  });
}

function openConditionItemDialog(
  ctrl: UIController,
  row: HTMLElement,
  prototype: CollectionPrototype<never>,
  item: unknown,
  path: readonly number[],
  condition: Condition,
  parentMode: 'replace' | 'push' = 'replace',
): void {
  let committed = false;
  const ctx = createUIContext(ctrl.game);
  const host = openSubDialog({
    title: `${prototype.label} · 原子条件`,
    body: renderAtomicConditionEditor(ctx, condition),
    footer: '<button type="button" class="toolbar-button" data-runtime-subdialog-close>取消</button><button type="button" class="primary-button" data-subdialog-save>保存条件</button>',
    onClose: () => {
      if (!committed) openCollectionItemDialog(ctrl, row, prototype, item, parentMode);
    },
  });
  host.querySelector<HTMLSelectElement>('[data-runtime-condition-editor-field="target"]')?.addEventListener('change', () => {
    const next = readAtomicConditionEditor(host);
    const body = host.querySelector<HTMLElement>('.runtime-subdialog-body');
    if (body) body.innerHTML = renderAtomicConditionEditor(ctx, next);
    host.querySelector<HTMLSelectElement>('[data-runtime-condition-editor-field="target"]')?.focus();
  });
  host.querySelector('[data-subdialog-save]')?.addEventListener('click', () => {
    const next = readAtomicConditionEditor(host);
    const problem = validateConditionGroup({ type: 'AND', conditions: [next] }, 'condition');
    if (problem) {
      ctrl.toast.show(problem.message, 'error');
      return;
    }
    const current = item as { condition?: ConditionGroup };
    const group = current.condition ?? { type: 'AND', conditions: [] };
    const updated = replaceConditionAtPath(group, path, next);
    committed = true;
    closeSubDialog(false);
    openCollectionItemDialog(ctrl, row, prototype, { ...current, condition: updated }, parentMode);
  });
}

/** 编辑态常驻快捷入口：在当前游戏位置直接创建 Area。 */
export function syncRuntimeAreaCreateAction(ctrl: UIController): void {
  syncRuntimeEditorPanel(ctrl);
}

export function syncRuntimeEditorCreateActions(ctrl: UIController): void {
  ctrl.toast.removeAction('runtime-init-create');
  ctrl.toast.removeAction('runtime-area-create');
  ctrl.toast.removeAction('runtime-spot-create');
  syncRuntimeEditorLauncher(ctrl);
  syncRuntimeEditorPanel(ctrl);
}

/** 兼容旧调用点：编辑器入口统一由 body 级浮动工作区承载。 */
export function syncRuntimeInitCreateAction(ctrl: UIController): void {
  syncRuntimeEditorPanel(ctrl);
}

/** 条目弹窗内交互（事件委托，只绑定一次）：类型切换、条件 / 效果的展开与增删。 */
function bindItemDialogActions(
  ctrl: UIController,
  host: HTMLElement,
  parentRow?: HTMLElement,
  fallbackItem?: unknown,
  dialogMode: 'replace' | 'push' = 'replace',
): void {
  if (host.dataset.runtimeItemBound === '1') return;
  host.dataset.runtimeItemBound = '1';
  const ctx = (): ReturnType<typeof createUIContext> => createUIContext(ctrl.game);
  const prototype = collectionPrototype(host.dataset.runtimeItemPrototype ?? '');
  const fallback = fallbackItem ?? prototype?.createEmpty(ctx()) ?? {};
  bindRuntimeCollectionActions(ctrl, host);

  const variantKey = prototype?.variantKey ?? 'kind';
  const kindSelect = host.querySelector<HTMLSelectElement>(`[data-runtime-item-field="${variantKey}"]`);
  if (kindSelect && prototype?.variantFields) {
    const sync = (): void => {
      const current = prototype.readItem(host, fallback as never) as Record<string, unknown>;
      const next = { ...current, [variantKey]: kindSelect.value };
      host.querySelector<HTMLElement>('.runtime-subdialog-body')!.innerHTML = prototype.renderItem(ctx(), next as never);
      host.dataset.runtimeItemBound = '';
      bindItemDialogActions(ctrl, host, parentRow, next, dialogMode);
    };
    kindSelect.addEventListener('change', sync);
  }

  host.addEventListener('click', event => {
    const target = event.target as HTMLElement;

    if (target.closest('[data-runtime-item-condition]')) {
      const conditionHost = host.querySelector<HTMLElement>('[data-runtime-item-condition-host]');
      if (!conditionHost) return;
      if (conditionHost.hidden) {
        conditionHost.hidden = false;
      } else {
        const list = conditionHost.querySelector<HTMLElement>('[data-runtime-condition-list]');
        list?.insertAdjacentHTML('beforeend', renderAdditionalConditionHtml(ctx()));
      }
      return;
    }
    if (target.closest('[data-runtime-item-effects]')) {
      const effectsHost = host.querySelector<HTMLElement>('[data-runtime-item-effects-host]');
      if (effectsHost) effectsHost.hidden = !effectsHost.hidden;
      return;
    }
    const conditionToggle = target.closest<HTMLButtonElement>('[data-runtime-condition-toggle]');
    if (conditionToggle) {
      const next = conditionToggle.dataset.runtimeConditionType === 'OR' ? 'AND' : 'OR';
      conditionToggle.dataset.runtimeConditionType = next;
      conditionToggle.setAttribute('aria-pressed', String(next === 'OR'));
      conditionToggle.textContent = next === 'OR' ? '任一满足（OR）' : '全部满足（AND）';
      return;
    }
    const editCondition = target.closest<HTMLElement>('[data-runtime-condition-edit]');
    if (editCondition && prototype && parentRow) {
      const itemNode = editCondition.closest<HTMLElement>('[data-runtime-condition-item="condition"]');
      const path = itemNode ? conditionPathForElement(itemNode) : [];
      const current = prototype.readItem(host, fallback as never) as { condition?: ConditionGroup };
      const condition = conditionAtPath(current.condition, path);
      if (isCondition(condition)) openConditionItemDialog(ctrl, parentRow, prototype, current, path, condition, dialogMode);
      return;
    }
    const addCondition = target.closest<HTMLElement>('[data-runtime-condition-add]');
    if (addCondition) {
      const group = addCondition.closest<HTMLElement>('.runtime-condition');
      const items = group ? [...group.children].find(child => child.classList.contains('runtime-condition-items')) : undefined;
      if (!(items instanceof HTMLElement) || !group) return;
      const currentItems = [...items.children].filter(child => child.matches('[data-runtime-condition-item]'));
      if (currentItems.length >= MAX_CONDITION_ITEMS) return;
      const depth = Number(group?.dataset.runtimeConditionDepth ?? '1');
      const addingGroup = addCondition.dataset.runtimeConditionAdd === 'group';
      items.querySelector(':scope > .runtime-editor-hint')?.remove();
      items.insertAdjacentHTML('beforeend', addingGroup
        ? renderNestedConditionHtml(ctx(), depth + 1)
        : renderConditionItemHtml(ctx(), depth));
      syncConditionGroupControls(group);
      if (!addingGroup && prototype && parentRow) {
        const itemNode = items.lastElementChild as HTMLElement | null;
        const path = itemNode ? conditionPathForElement(itemNode) : [];
        const current = prototype.readItem(host, fallback as never) as { condition?: ConditionGroup };
        const condition = conditionAtPath(current.condition, path);
        if (!isCondition(condition)) return;
      }
      return;
    }
    if (target.closest('[data-runtime-condition-item-remove]')) {
      const item = target.closest<HTMLElement>('[data-runtime-condition-item]');
      const items = item?.parentElement;
      item?.remove();
      if (items?.matches('[data-runtime-condition-items]')) {
        syncConditionGroupEmptyState(items);
        const group = items.parentElement;
        if (group?.matches('.runtime-condition')) syncConditionGroupControls(group);
      }
      return;
    }
    if (target.closest('[data-runtime-condition-outer-remove]')) {
      target.closest<HTMLElement>('[data-runtime-condition-outer]')?.remove();
      return;
    }
    if (target.closest('[data-runtime-effect-add]')) {
      const container = host.querySelector<HTMLElement>('[data-runtime-effects]');
      if (!container) return;
      const template = document.createElement('template');
      template.innerHTML = renderEffectRowHtml(ctx()).trim();
      const node = template.content.firstElementChild;
      if (node) container.insertBefore(node, container.querySelector('.runtime-condition-actions'));
      return;
    }
    if (target.closest('[data-runtime-effect-remove]')) {
      target.closest<HTMLElement>('[data-runtime-effect-row]')?.remove();
    }
  });
}

function syncConditionGroupEmptyState(items: HTMLElement): void {
  const hasItems = [...items.children].some(child => child.matches('[data-runtime-condition-item]'));
  const hint = items.querySelector(':scope > .runtime-editor-hint');
  if (hasItems) hint?.remove();
  else if (!hint) items.insertAdjacentHTML('afterbegin', '<p class="runtime-editor-hint">还没有条件项；留空表示无条件。</p>');
}

function syncConditionGroupControls(group: HTMLElement): void {
  const items = [...group.children].find(child => child.classList.contains('runtime-condition-items'));
  const actions = [...group.children].find(child => child.classList.contains('runtime-condition-actions'));
  const count = items ? [...items.children].filter(child => child.matches('[data-runtime-condition-item]')).length : 0;
  actions?.querySelectorAll<HTMLButtonElement>('[data-runtime-condition-add]').forEach(button => {
    button.disabled = count >= MAX_CONDITION_ITEMS;
  });
}

function isCondition(value: Condition | ConditionGroup | undefined): value is Condition {
  return Boolean(value && !('type' in value));
}
