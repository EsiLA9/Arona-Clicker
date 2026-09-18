import type { RuntimeAreaDraft, RuntimeAreaTopologyDraft, RuntimeEnhancementDraft, RuntimeInitDraft, RuntimeModDraft } from '../../arona-clicker/contracts';
import type { RuntimeSpotDraftSnapshot } from '../../arona-clicker/contracts/runtime';
import type { RuntimePaymentOptionDraft, RuntimeSpotFunctionalityDraft, RuntimeSpotLevelUpgradeDraft, RuntimeSpotRevealTriggerDraft } from '../../arona-clicker/contracts/runtime-content';
import {
  createDraftLayer,
  resolveDefinition,
  resumeDefinition,
  setDefinitionRecord,
  suspendDefinition,
} from '../../data-services';
import type { DefinitionResolution, DefinitionSourceLayer } from '../../data-services';

/** 编辑器诊断：结构上兼容策略表校验问题与运行时提交诊断。 */
export interface RuntimeEditorProblemLocation {
  readonly sectionId?: string;
  readonly collectionId?: string;
  readonly itemIndex?: number;
  readonly childCollectionId?: string;
  readonly childIndex?: number;
}

export interface RuntimeEditorProblem extends RuntimeEditorProblemLocation {
  readonly code: string;
  readonly path?: string;
  readonly message: string;
}

export interface RuntimeEditorSpotDraft {
  idName: string;
  areaId: string;
  name: string;
  description: string;
  purchaseOptions: readonly RuntimePaymentOptionDraft[];
  maxLevel?: number;
  conditionText?: string;
  global?: boolean;
  functionalities?: readonly RuntimeSpotFunctionalityDraft[];
  levelUpgrades?: readonly RuntimeSpotLevelUpgradeDraft[];
  revealTriggers?: readonly RuntimeSpotRevealTriggerDraft[];
  tags?: readonly string[];
  gachaPools?: readonly string[];
  unsupportedFunctionalityIds?: readonly string[];
  unsupportedPaymentOptionPaths?: readonly string[];
}

export type RuntimeEditorInitDraft = RuntimeInitDraft;
export type RuntimeEditorAreaDraft = RuntimeAreaDraft;
export type RuntimeEditorEnhancementDraft = RuntimeEnhancementDraft;
export type RuntimeEditorContentKind = 'inits' | 'areas' | 'spots' | 'enhancements';
export type RuntimeEditorDefinitionDraft = RuntimeEditorInitDraft | RuntimeEditorAreaDraft | RuntimeEditorSpotDraft | RuntimeEditorEnhancementDraft;

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
  inits: RuntimeEditorInitDraft[];
  areas: RuntimeEditorAreaDraft[];
  enhancements: RuntimeEditorEnhancementDraft[];
  selectedSpotId: string | null;
  selectedContentKind: RuntimeEditorContentKind;
  selectedDefinitionId: string | null;
  suspendedSpotIds: string[];
  suspendedInitIds: string[];
  suspendedAreaIds: string[];
  suspendedEnhancementIds: string[];
  applied?: boolean;
  /** 最近一次成功 Apply 的版本：Draft 与 Runtime Effective 的差异以此为准。 */
  appliedSpots: RuntimeEditorSpotDraft[];
  appliedInits: RuntimeEditorInitDraft[];
  appliedAreas: RuntimeEditorAreaDraft[];
  appliedEnhancements: RuntimeEditorEnhancementDraft[];
  /** 内容浏览器筛选：按编辑状态过滤 Draft 条目。 */
  browserFilter: RuntimeEditorFilter;
  /** 当前编辑页（左侧 Switch）；页内容互相隔离，只渲染当前页。 */
  activeSection: string | null;
  /**
   * 表单暂存：页隔离渲染下，切页前把当前页的值并入这里，
   * 保存时再由暂存汇总成一次提交（页与提交口径解耦）。
   */
  formDraft: Record<string, unknown> | null;
  /** 最近一次校验 / 提交产生的结构诊断，供表单与诊断列表定位。 */
  problems: RuntimeEditorProblem[];
  /** 温和处理提示（如 ID 读入大写后自动转小写）：只在表单内展示，不阻断流程。 */
  notice: string | null;
  error: string | null;
}

export type RuntimeEditorEntryState = 'created' | 'modified' | 'unchanged';
export type RuntimeEditorFilter = 'all' | 'pending' | 'applied' | 'removed';

export function suggestedRuntimeDefaultAreaIdName(initIdName: string): string {
  const normalized = initIdName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${normalized || 'new-init'}-default-area`;
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
    inits: [],
    areas: [],
    enhancements: [],
    selectedSpotId: null,
    selectedContentKind: 'spots',
    selectedDefinitionId: null,
    suspendedSpotIds: [],
    suspendedInitIds: [],
    suspendedAreaIds: [],
    suspendedEnhancementIds: [],
    appliedSpots: [],
    appliedInits: [],
    appliedAreas: [],
    appliedEnhancements: [],
    browserFilter: 'all',
    activeSection: null,
    formDraft: null,
    problems: [],
    notice: null,
    error: null,
  };
}

export function setRuntimeEditorProblems(editor: RuntimeDatapackEditorState, problems: readonly RuntimeEditorProblem[]): void {
  editor.problems = [...problems];
}

export function setRuntimeEditorFilter(editor: RuntimeDatapackEditorState, filter: RuntimeEditorFilter): void {
  editor.browserFilter = filter;
}

export function runtimeEditorDefinitions(editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind): RuntimeEditorDefinitionDraft[] {
  switch (kind) {
    case 'inits': return editor.inits;
    case 'areas': return editor.areas;
    case 'spots': return editor.spots;
    case 'enhancements': return editor.enhancements;
  }
}

export function runtimeEditorAppliedDefinitions(editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind): RuntimeEditorDefinitionDraft[] {
  switch (kind) {
    case 'inits': return editor.appliedInits;
    case 'areas': return editor.appliedAreas;
    case 'spots': return editor.appliedSpots;
    case 'enhancements': return editor.appliedEnhancements;
  }
}

export function runtimeEditorDefinitionSuspensions(editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind): string[] {
  switch (kind) {
    case 'inits': return editor.suspendedInitIds;
    case 'areas': return editor.suspendedAreaIds;
    case 'spots': return editor.suspendedSpotIds;
    case 'enhancements': return editor.suspendedEnhancementIds;
  }
}

export function runtimeEditorDefinitionEntryState(
  editor: RuntimeDatapackEditorState,
  kind: RuntimeEditorContentKind,
  definition: RuntimeEditorDefinitionDraft,
): RuntimeEditorEntryState {
  const applied = runtimeEditorAppliedDefinitions(editor, kind).find(item => item.idName === definition.idName);
  if (!applied) return 'created';
  return JSON.stringify(applied) === JSON.stringify(definition) ? 'unchanged' : 'modified';
}

export function runtimeEditorPendingDefinitions(editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind): RuntimeEditorDefinitionDraft[] {
  const current = runtimeEditorDefinitions(editor, kind);
  const applied = runtimeEditorAppliedDefinitions(editor, kind);
  return [
    ...current.filter(definition => runtimeEditorDefinitionEntryState(editor, kind, definition) !== 'unchanged'),
    ...applied.filter(definition => !current.some(item => item.idName === definition.idName)),
  ];
}

export function getSelectedRuntimeEditorDefinition(editor: RuntimeDatapackEditorState): RuntimeEditorDefinitionDraft | null {
  if (!editor.selectedDefinitionId) return null;
  return runtimeEditorDefinitions(editor, editor.selectedContentKind).find(item => item.idName === editor.selectedDefinitionId) ?? null;
}

export function selectRuntimeEditorDefinition(editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind, idName: string): boolean {
  const definition = runtimeEditorDefinitions(editor, kind).find(item => item.idName === idName);
  if (!definition) return false;
  editor.selectedContentKind = kind;
  editor.selectedDefinitionId = idName;
  editor.formDraft = null;
  editor.error = null;
  if (kind === 'spots') {
    editor.selectedSpotId = idName;
    editor.selectedAreaId = (definition as RuntimeEditorSpotDraft).areaId;
  } else {
    editor.selectedSpotId = null;
  }
  return true;
}

export function setRuntimeEditorDefinition(
  editor: RuntimeDatapackEditorState,
  kind: RuntimeEditorContentKind,
  definition: RuntimeEditorDefinitionDraft,
): void {
  const definitions = runtimeEditorDefinitions(editor, kind);
  const index = definitions.findIndex(item => item.idName === definition.idName);
  const copy = cloneRuntimeEditorDefinition(definition);
  if (index >= 0) definitions[index] = copy as never;
  else definitions.push(copy as never);
  editor.selectedContentKind = kind;
  editor.selectedDefinitionId = definition.idName;
  editor.formDraft = null;
  editor.applied = false;
  if (kind === 'spots') {
    const spot = definition as RuntimeEditorSpotDraft;
    editor.selectedSpotId = spot.idName;
    editor.selectedAreaId = spot.areaId;
  }
}

export function removeRuntimeEditorDefinition(editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind, idName: string): boolean {
  const definitions = runtimeEditorDefinitions(editor, kind);
  const index = definitions.findIndex(item => item.idName === idName);
  if (index < 0) return false;
  definitions.splice(index, 1);
  const tombstones = runtimeEditorDefinitionSuspensions(editor, kind);
  const tombstoneIndex = tombstones.indexOf(idName);
  if (tombstoneIndex >= 0) tombstones.splice(tombstoneIndex, 1);
  editor.selectedDefinitionId = null;
  if (kind === 'spots') editor.selectedSpotId = null;
  editor.applied = false;
  editor.formDraft = null;
  editor.error = null;
  return true;
}

export function restoreRuntimeEditorDefinition(editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind, idName: string): boolean {
  if (runtimeEditorDefinitions(editor, kind).some(definition => definition.idName === idName)) return false;
  const applied = runtimeEditorAppliedDefinitions(editor, kind).find(definition => definition.idName === idName);
  if (!applied) return false;
  runtimeEditorDefinitions(editor, kind).push(cloneRuntimeEditorDefinition(applied) as never);
  const tombstones = runtimeEditorDefinitionSuspensions(editor, kind);
  const tombstoneIndex = tombstones.indexOf(idName);
  if (tombstoneIndex >= 0) tombstones.splice(tombstoneIndex, 1);
  editor.selectedContentKind = kind;
  editor.selectedDefinitionId = idName;
  editor.applied = false;
  editor.error = null;
  editor.formDraft = null;
  return true;
}

export function setRuntimeEditorDefinitionSuspended(editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind, idName: string, suspended: boolean): boolean {
  if (!runtimeEditorDefinitions(editor, kind).some(item => item.idName === idName)) return false;
  const tombstones = runtimeEditorDefinitionSuspensions(editor, kind);
  const index = tombstones.indexOf(idName);
  if (suspended && index < 0) tombstones.push(idName);
  if (!suspended && index >= 0) tombstones.splice(index, 1);
  editor.applied = false;
  editor.error = null;
  return true;
}

/** Draft 条目的编辑状态：与最近一次成功 Apply 的版本比较，不回写 Definition 生命周期。 */
export function runtimeEditorEntryState(editor: RuntimeDatapackEditorState, spot: RuntimeEditorSpotDraft): RuntimeEditorEntryState {
  const applied = editor.appliedSpots.find(item => item.idName === spot.idName);
  if (!applied) return 'created';
  return JSON.stringify(applied) === JSON.stringify(spot) ? 'unchanged' : 'modified';
}

export function runtimeEditorPendingSpots(editor: RuntimeDatapackEditorState): RuntimeEditorSpotDraft[] {
  return editor.spots.filter(spot => runtimeEditorEntryState(editor, spot) !== 'unchanged');
}

export function findRuntimeEditorAppliedSpot(editor: RuntimeDatapackEditorState, idName: string): RuntimeEditorSpotDraft | undefined {
  return editor.appliedSpots.find(spot => spot.idName === idName);
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
  const nextSpot = cloneRuntimeEditorSpot(spot);
  if (existingIndex >= 0) editor.spots[existingIndex] = nextSpot;
  else editor.spots.push(nextSpot);
  if (previousId && previousId !== spot.idName) {
    editor.suspendedSpotIds = editor.suspendedSpotIds.filter(id => id !== previousId);
  }
  editor.suspendedSpotIds = editor.suspendedSpotIds.filter(id => id !== spot.idName);
  editor.selectedSpotId = spot.idName;
  editor.selectedContentKind = 'spots';
  editor.selectedDefinitionId = spot.idName;
  editor.selectedAreaId = spot.areaId;
  editor.applied = false;
  // 保存成功即提交完成：暂存清空，后续渲染回到 Draft 事实源。
  editor.formDraft = null;
}

export function clearRuntimeEditorSpot(editor: RuntimeDatapackEditorState): void {
  editor.selectedSpotId = null;
  if (editor.selectedContentKind === 'spots') editor.selectedDefinitionId = null;
  editor.applied = false;
  editor.error = null;
  editor.formDraft = null;
}

export function getSelectedRuntimeEditorSpot(editor: RuntimeDatapackEditorState): RuntimeEditorSpotDraft | null {
  if (!editor.selectedSpotId) return null;
  return editor.spots.find(spot => spot.idName === editor.selectedSpotId) ?? null;
}

export function selectRuntimeEditorSpot(editor: RuntimeDatapackEditorState, idName: string): boolean {
  const spot = editor.spots.find(item => item.idName === idName);
  if (!spot) return false;
  editor.selectedSpotId = spot.idName;
  editor.selectedContentKind = 'spots';
  editor.selectedDefinitionId = spot.idName;
  editor.selectedAreaId = spot.areaId;
  editor.error = null;
  // 切换编辑目标时丢弃上一目标的表单暂存，避免串值。
  editor.formDraft = null;
  return true;
}

export function removeRuntimeEditorSpot(editor: RuntimeDatapackEditorState, idName = editor.selectedSpotId): boolean {
  if (!idName) return false;
  const index = editor.spots.findIndex(spot => spot.idName === idName);
  if (index < 0) return false;
  editor.spots.splice(index, 1);
  editor.appliedSpots = editor.appliedSpots.filter(spot => spot.idName !== idName);
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

export function setRuntimeEditorNotice(editor: RuntimeDatapackEditorState, notice: string | null): void {
  editor.notice = notice;
}

export function setRuntimeEditorSection(editor: RuntimeDatapackEditorState, sectionId: string | null): void {
  editor.activeSection = sectionId;
}

export function setRuntimeEditorFormDraft(editor: RuntimeDatapackEditorState, values: Record<string, unknown> | null): void {
  editor.formDraft = values;
}

export function markRuntimeEditorApplied(editor: RuntimeDatapackEditorState, applied: boolean): void {
  editor.applied = applied;
  if (applied) {
    editor.appliedSpots = editor.spots.map(spot => cloneRuntimeEditorSpot(spot));
    editor.appliedInits = editor.inits.map(init => cloneRuntimeEditorDefinition(init) as RuntimeEditorInitDraft);
    editor.appliedAreas = editor.areas.map(area => cloneRuntimeEditorDefinition(area) as RuntimeEditorAreaDraft);
    editor.appliedEnhancements = editor.enhancements.map(enhancement => cloneRuntimeEditorDefinition(enhancement) as RuntimeEditorEnhancementDraft);
  }
}

export function markRuntimeEditorWorldApplied(editor: RuntimeDatapackEditorState): void {
  editor.applied = true;
  editor.appliedInits = editor.inits.map(init => cloneRuntimeEditorDefinition(init) as RuntimeEditorInitDraft);
  editor.appliedAreas = editor.areas.map(area => cloneRuntimeEditorDefinition(area) as RuntimeEditorAreaDraft);
}

export function toRuntimeModDraft(editor: RuntimeDatapackEditorState): RuntimeModDraft | null {
  if (!editor.modName || !editor.displayName) return null;
  const resolutions = editor.spots.map(spot => resolveRuntimeEditorSpot(editor, spot.idName));
  const baseDraft = {
    modName: editor.modName,
    displayName: editor.displayName,
    version: editor.version,
    author: editor.author,
    description: editor.description,
    spots: resolutions.flatMap(resolution => resolution.status === 'resolved' && resolution.record.value ? [cloneRuntimeEditorSpot(resolution.record.value)] : []),
    suspendedSpotIds: resolutions.flatMap(resolution => resolution.status === 'suspended' ? [resolution.key.id] : []),
  };
  return {
    ...baseDraft,
    ...(editor.inits.length > 0 ? { inits: editor.inits.map(init => cloneRuntimeEditorDefinition(init) as RuntimeEditorInitDraft) } : {}),
    ...(editor.areas.length > 0 ? { areas: editor.areas.map(area => toRuntimeAreaDraft(area)) } : {}),
    ...(editor.enhancements.length > 0 ? { enhancements: editor.enhancements.map(enhancement => cloneRuntimeEditorDefinition(enhancement) as RuntimeEditorEnhancementDraft) } : {}),
    ...(editor.suspendedInitIds.length > 0 ? { suspendedInitIds: [...editor.suspendedInitIds] } : {}),
    ...(editor.suspendedAreaIds.length > 0 ? { suspendedAreaIds: [...editor.suspendedAreaIds] } : {}),
    ...(editor.suspendedEnhancementIds.length > 0 ? { suspendedEnhancementIds: [...editor.suspendedEnhancementIds] } : {}),
  };
}

export function hydrateRuntimeEditor(editor: RuntimeDatapackEditorState, runtimeMod: RuntimeModDraft): void {
  const spots = runtimeMod.spots.map(spot => cloneRuntimeEditorSpot(spot));
  const inits = (runtimeMod.inits ?? []).map(init => cloneRuntimeEditorDefinition(init) as RuntimeEditorInitDraft);
  const areas = (runtimeMod.areas ?? []).map(area => toRuntimeAreaEditorDraft(area));
  const enhancements = (runtimeMod.enhancements ?? []).map(enhancement => cloneRuntimeEditorDefinition(enhancement) as RuntimeEditorEnhancementDraft);
  updateRuntimeEditorFields(editor, {
    modName: runtimeMod.modName,
    displayName: runtimeMod.displayName,
    version: runtimeMod.version,
    author: runtimeMod.author,
    description: runtimeMod.description,
    selectedAreaId: spots[0]?.areaId ?? null,
  });
  editor.spots = spots;
  editor.inits = inits;
  editor.areas = areas;
  editor.enhancements = enhancements;
  editor.appliedSpots = spots.map(spot => cloneRuntimeEditorSpot(spot));
  editor.appliedInits = inits.map(init => cloneRuntimeEditorDefinition(init) as RuntimeEditorInitDraft);
  editor.appliedAreas = areas.map(area => cloneRuntimeEditorDefinition(area) as RuntimeEditorAreaDraft);
  editor.appliedEnhancements = enhancements.map(enhancement => cloneRuntimeEditorDefinition(enhancement) as RuntimeEditorEnhancementDraft);
  const unsupported = spots.flatMap(spot => spot.unsupportedFunctionalityIds ?? []);
  const unsupportedPayments = spots.flatMap(spot => spot.unsupportedPaymentOptionPaths ?? []);
  editor.problems = [
    ...(unsupported.length > 0
      ? [{ code: 'invalid-field', path: 'spot.affectors', message: `当前 Spot 含无法由 Demo 编辑器回写的资源功能：${unsupported.join('、')}` }]
      : []),
    ...(unsupportedPayments.length > 0
      ? [{ code: 'invalid-field', path: 'spot.purchaseOptions', message: `当前 Spot 含无法由 Runtime Editor 无损回写的支付方案：${unsupportedPayments.join('、')}` }]
      : []),
  ];
  editor.suspendedSpotIds = [...(runtimeMod.suspendedSpotIds ?? [])].filter(id => spots.some(spot => spot.idName === id));
  editor.suspendedInitIds = [...(runtimeMod.suspendedInitIds ?? [])].filter(id => inits.some(init => init.idName === id));
  editor.suspendedAreaIds = [...(runtimeMod.suspendedAreaIds ?? [])].filter(id => areas.some(area => area.idName === id));
  editor.suspendedEnhancementIds = [...(runtimeMod.suspendedEnhancementIds ?? [])].filter(id => enhancements.some(enhancement => enhancement.idName === id));
  editor.selectedSpotId = spots.find(spot => !editor.suspendedSpotIds.includes(spot.idName))?.idName ?? spots[0]?.idName ?? null;
  const firstKind: RuntimeEditorContentKind = inits.length > 0 ? 'inits' : areas.length > 0 ? 'areas' : 'spots';
  editor.selectedContentKind = firstKind;
  editor.selectedDefinitionId = runtimeEditorDefinitions(editor, firstKind)[0]?.idName ?? null;
  const selected = getSelectedRuntimeEditorSpot(editor);
  if (selected) editor.selectedAreaId = selected.areaId;
  markRuntimeEditorApplied(editor, true);
  setRuntimeEditorError(editor, null);
}

/** 深拷贝一条 Spot 草稿：集合一律复制，避免 Draft 快照与编辑器状态共享引用。 */
function cloneRuntimeEditorSpot(spot: RuntimeSpotDraftSnapshot | RuntimeEditorSpotDraft): RuntimeEditorSpotDraft {
  return {
    ...spot,
    ...(spot.functionalities ? { functionalities: spot.functionalities.map(item => ({ ...item })) } : {}),
    purchaseOptions: clonePaymentOptions(spot.purchaseOptions),
    ...(spot.levelUpgrades ? {
      levelUpgrades: spot.levelUpgrades.map(item => ({
        ...item,
        paymentOptions: clonePaymentOptions(item.paymentOptions),
        effects: [...item.effects],
      })),
    } : {}),
    ...(spot.revealTriggers ? { revealTriggers: spot.revealTriggers.map(item => ({ ...item })) } : {}),
    ...(spot.tags ? { tags: [...spot.tags] } : {}),
    ...(spot.gachaPools ? { gachaPools: [...spot.gachaPools] } : {}),
    ...(spot.unsupportedFunctionalityIds ? { unsupportedFunctionalityIds: [...spot.unsupportedFunctionalityIds] } : {}),
    ...(spot.unsupportedPaymentOptionPaths ? { unsupportedPaymentOptionPaths: [...spot.unsupportedPaymentOptionPaths] } : {}),
  };
}

function toRuntimeAreaTopology(area: RuntimeAreaDraft): RuntimeAreaTopologyDraft[] {
  if (area.topology) return area.topology.map(item => ({ ...item }));
  return (area.adjacentAreaIds ?? []).map(areaId => ({ areaId, type: 'oneWay' as const }));
}

function toRuntimeAreaEditorDraft(area: RuntimeAreaDraft): RuntimeEditorAreaDraft {
  const { adjacentAreaIds: _legacyAdjacentAreaIds, ...rest } = cloneRuntimeEditorDefinition(area);
  return { ...rest, topology: toRuntimeAreaTopology(area) } as RuntimeEditorAreaDraft;
}

function toRuntimeAreaDraft(area: RuntimeEditorAreaDraft): RuntimeAreaDraft {
  const { adjacentAreaIds: _legacyAdjacentAreaIds, ...rest } = cloneRuntimeEditorDefinition(area);
  return { ...rest, topology: toRuntimeAreaTopology(area) } as RuntimeAreaDraft;
}

function cloneRuntimeEditorDefinition<T extends RuntimeEditorDefinitionDraft>(definition: T): T {
  return structuredClone(definition);
}

function clonePaymentOptions(options: readonly RuntimePaymentOptionDraft[]): RuntimePaymentOptionDraft[] {
  return options.map(option => ({
    ...option,
    ...(option.condition ? { condition: structuredClone(option.condition) } : {}),
    costs: option.costs.map(cost => ({ ...cost })),
  }));
}

export function prepareRuntimeEditorForNewSpot(editor: RuntimeDatapackEditorState, areaId: string): void {
  updateRuntimeEditorFields(editor, { selectedAreaId: areaId });
  clearRuntimeEditorSpot(editor);
  editor.selectedContentKind = 'spots';
  editor.selectedDefinitionId = null;
}

export function prepareRuntimeEditorForNewDefinition(editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind): void {
  editor.selectedContentKind = kind;
  editor.selectedDefinitionId = null;
  editor.selectedSpotId = null;
  if (editor.selectedContentKind === 'spots') editor.selectedDefinitionId = null;
  editor.activeSection = null;
  editor.formDraft = null;
  editor.error = null;
  editor.problems = [];
}
