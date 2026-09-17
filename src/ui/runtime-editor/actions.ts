// ============================================================
// ui/runtime-editor/actions.ts — 运行时编辑器交互接线
// 自 controller-actions-topbar.ts 拆出：编辑器开关、Spot 表单、
//   Draft 保存 / Apply、删除确认与 Affector 列表事件绑定。
// 只编排 UI 与命令层，不持有业务规则与渲染细节。
// ============================================================

import { getContentPolicy, SPOT_CONTENT_POLICY, validateAuthoringInput, type ContentAuthoringPolicy, type SpotFunctionalityKind } from '../../data-services/authoring/content-policy';
import { renderRuntimeDefinitionForm, renderRuntimeEditorForm, renderRuntimeEditorWorkspace, renderRuntimeSpotForm, runtimeEditorPreferredAreaInitId } from './view';
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
  updateRuntimeEditorFields,
  type RuntimeEditorFilter,
  type RuntimeEditorContentKind,
  type RuntimeEditorDefinitionDraft,
  type RuntimeEditorProblem,
  type RuntimeEditorSpotDraft,
} from './state';
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
  const editor = ctrl.panelState.runtimeDatapackEditor;
  const areaId = ctrl.game.getView().currentAreaId;
  const area = areaId ? ctrl.game.registry.areas.get(areaId) : undefined;
  const key = 'runtime-spot-create';
  if (!editor?.enabled || !editor.modName || !editor.displayName || !areaId || !area) {
    ctrl.toast.removeAction(key);
    return;
  }
  ctrl.toast.showAction(key, `当前 Area：${escapeHtml(area.name)}`, '创建 Spot', () => {
    prepareRuntimeEditorForNewSpot(editor, areaId);
    ctrl.modal.open({
      title: `创建 Spot · ${area.name}`,
      body: renderRuntimeSpotForm(createUIContext(ctrl.game), ctrl.panelState),
      footer: '<button type="button" class="modal-close toolbar-button">取消</button>',
      panelClass: 'runtime-datapack-modal',
      dismissable: false,
      onClose: clearSubDialogs,
    });
    const modal = document.querySelector<HTMLElement>('.app-modal');
    if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
    syncRuntimeEditorCreateActions(ctrl);
  });
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

function openRuntimeDatapackEditor(ctrl: UIController): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor?.enabled) return;
  const ctx = createUIContext(ctrl.game);
  ctrl.modal.open({
    title: `运行时数据包编辑 · ${editor.displayName || '新建 Mod'}`,
    body: `${renderRuntimeEditorForm(ctx, ctrl.panelState)}${renderRuntimeEditorWorkspace(ctx, ctrl.panelState)}`,
    footer: '<button type="button" class="modal-close toolbar-button">关闭编辑器</button>',
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
    onClose: clearSubDialogs,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
}

function openRuntimeSpotEditor(ctrl: UIController): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  const spot = editor ? getSelectedRuntimeEditorSpot(editor) : null;
  const areaId = spot?.areaId ?? editor?.selectedAreaId;
  const area = areaId ? ctrl.game.registry.areas.get(areaId) : undefined;
  if (!editor?.enabled || !area) return;
  ctrl.modal.open({
    title: `${spot ? '编辑' : '创建'} Spot · ${area.name}`,
    body: renderRuntimeSpotForm(createUIContext(ctrl.game), ctrl.panelState),
    footer: '<button type="button" class="modal-close toolbar-button">关闭编辑器</button>',
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
    onClose: clearSubDialogs,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
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
  const values: Record<string, unknown> = { ...(editor.formDraft ?? {}) };
  const normalizedIds = normalizeEntityNameValues(policy, values);
  setRuntimeEditorNotice(editor, normalizedIds.length > 0 ? `ID 含大写字母，已自动转为小写：${normalizedIds.join('、')}` : null);
  const problem = validateAuthoringInput(policy, values, runtimeAuthoringContext(ctrl));
  if (problem) {
    setRuntimeEditorProblems(editor, [problem]);
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
  setRuntimeEditorDefinition(editor, kind, values as unknown as RuntimeEditorDefinitionDraft);
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
    openRuntimeDatapackEditor(ctrl);
    return;
  }
  if (!ctrl.commands.applyRuntimeWorldDraft) {
    setRuntimeEditorError(editor, '当前运行时不支持 Init / Area 热 CRUD。');
    openRuntimeDatapackEditor(ctrl);
    return;
  }
  const setMetadata = ctrl.commands.setRuntimeModMetadata;
  if (!setMetadata) {
    setRuntimeEditorError(editor, '当前运行时不支持临时 Mod 命名空间。');
    openRuntimeDatapackEditor(ctrl);
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
    openRuntimeDatapackEditor(ctrl);
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
    openRuntimeDatapackEditor(ctrl);
    return;
  }
  markRuntimeEditorWorldApplied(editor);
  setRuntimeEditorError(editor, null);
  setRuntimeEditorProblems(editor, []);
  openRuntimeDatapackEditor(ctrl);
  ctrl.toast.showAction('runtime-editor-applied', result.message, '查看游戏', () => {
    ctrl.modal.close();
    ctrl.navigateToService('game');
    ctrl.render();
  });
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
  if (hasRuntimeWorldContent(editor)) {
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
    reopenAfterFailure();
  };
  let appliedCount = 0;
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

  markRuntimeEditorApplied(editor, true);
  setRuntimeEditorError(editor, null);
  setRuntimeEditorProblems(editor, []);
  openRuntimeSpotEditor(ctrl);
  ctrl.toast.showAction('runtime-editor-applied', `${appliedCount} 项已应用到运行时`, '查看游戏', () => {
    ctrl.modal.close();
    ctrl.navigateToService('game');
    ctrl.render();
  });
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
  ctrl.modal.open({
    title: `${editor.selectedDefinitionId ? '编辑' : '新建'} ${kind === 'inits' ? 'Init' : kind === 'areas' ? 'Area' : 'Enhancement'}`,
    body: renderRuntimeDefinitionForm(createUIContext(ctrl.game), ctrl.panelState, kind),
    footer: '<button type="button" class="modal-close toolbar-button">关闭编辑器</button>',
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
    onClose: clearSubDialogs,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
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
  ctrl.modal.open({
    title: `删除临时 ${label}`,
    body: `<div class="runtime-editor-form"><p>即将删除「${escapeHtml(name || idName)}」。</p><p class="service-summary">${applied ? `该 ${label} 已应用到 Runtime；确认后会从 Draft 移除，点击“应用到运行时”才会真正移除。` : `该 ${label} 尚未应用到 Runtime，只会从当前 Draft 移除。`}</p>${policy?.unsupportedFieldHint ? `<p class="runtime-editor-hint">${escapeHtml(policy.unsupportedFieldHint)}</p>` : ''}</div>`,
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

export function bindRuntimeDatapackEditorActions(ctrl: UIController, scope: ParentNode): void {
  scope.querySelector('[data-runtime-editor-toggle]')?.addEventListener('click', () => {
    ctrl.panelState.runtimeDatapackEditor = createRuntimeDatapackEditorState([...ctrl.game.registry.areas.keys()][0] ?? null);
    ctrl.toast.show('已开启运行时编辑态', 'info');
    ctrl.render();
    openRuntimeDatapackEditor(ctrl);
  });
  scope.querySelector('[data-runtime-editor-open]')?.addEventListener('click', () => openRuntimeDatapackEditor(ctrl));
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
    ctrl.modal.close();
    ctrl.panelState.runtimeDatapackEditor = undefined;
    ctrl.toast.show('已关闭运行时编辑态，草稿已放弃', 'info');
    ctrl.render();
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
        openRuntimeDatapackEditor(ctrl);
        syncRuntimeEditorCreateActions(ctrl);
        return;
      }
    } else setRuntimeEditorError(editor, null);
    ctrl.toast.show('Mod 信息已保存。', 'success');
    // 重新渲染同一页面即可，不能把 Mod 设定保存自动转成 Spot 创建页。
    openRuntimeDatapackEditor(ctrl);
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
    item.addEventListener('click', () => {
      const key = item.dataset.runtimeEditorDiagnostic;
      if (!key) return;
      scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-editor-field="${key}"]`)?.focus();
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
  const editor = ctrl.panelState.runtimeDatapackEditor;
  const key = 'runtime-area-create';
  if (!editor?.enabled || !editor.modName || !editor.displayName) {
    ctrl.toast.removeAction(key);
    return;
  }
  const activeInitId = runtimeEditorPreferredAreaInitId(createUIContext(ctrl.game), ctrl.panelState);
  const activeInit = activeInitId ? ctrl.game.registry.inits.get(activeInitId) : undefined;
  const text = activeInit ? `当前 Init：${escapeHtml(activeInit.name)}` : '创建一个新的 Area';
  ctrl.toast.showAction(key, text, '创建 Area', () => {
    prepareRuntimeEditorForNewDefinition(editor, 'areas');
    ctrl.modal.open({
      title: activeInit ? `创建 Area · ${activeInit.name}` : '创建 Area',
      body: renderRuntimeDefinitionForm(createUIContext(ctrl.game), ctrl.panelState, 'areas'),
      footer: '<button type="button" class="modal-close toolbar-button">取消</button>',
      panelClass: 'runtime-datapack-modal',
      dismissable: false,
      onClose: clearSubDialogs,
    });
    const modal = document.querySelector<HTMLElement>('.app-modal');
    if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
    syncRuntimeAreaCreateAction(ctrl);
  });
}

export function syncRuntimeEditorCreateActions(ctrl: UIController): void {
  syncRuntimeSpotCreateAction(ctrl);
  syncRuntimeAreaCreateAction(ctrl);
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
