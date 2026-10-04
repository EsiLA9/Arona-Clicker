import type { Datapack } from '../contracts/datapack';
import type { } from '../../engine/types';
import type { PackManifest } from './manifest';
import type { PackSource } from './source';
import type { PackSnapshotStore } from './pack-storage';

export interface StoredPack {
  readonly id: string;
  /** Catalog 内部记录身份；旧快照缺失时以 id 作为记录身份。 */
  readonly packRecordId?: string;
  readonly manifest: PackManifest;
  readonly datapack: Datapack;
  readonly images: readonly { path: string; url: string }[];
  readonly sourceKind: PackSource['kind'] | 'builtin' | 'bundle' | 'editing';
  /** 仓库开发包目录中的相对路径；仅用于自动来源对账，不表示可写文件路径。 */
  readonly sourcePath?: string;
  readonly importedAt: number;
  readonly editingMode?: EditingMode;
  readonly sourcePackRecordId?: string;
  readonly sourceDigest?: string;
  readonly contentDigest?: string;
}

export type EditingMode = 'normal' | 'editing';
export type PackSourceKind = PackSource['kind'] | 'builtin' | 'bundle' | 'editing';
export type DatapackSlotKind = 'fixed' | 'editing';
export type DatapackSelectionSlot = DatapackSlotKind | 'none';
export type PackConflictCode =
  | 'target-datapack-required'
  | 'target-must-be-editing'
  | 'datapack-record-conflict'
  | 'modid-runtime-conflict'
  | 'source-not-found'
  | 'stale-source'
  | 'runtime-plan-invalid'
  | 'runtime-apply-failed'
  | 'datapack-in-use'
  | 'editor-dirty'
  | 'configuration-invalid';

export interface DatapackIdentity {
  readonly modId: string;
  readonly versionId: string;
}

export interface DatapackRecord extends StoredPack {
  readonly modId: string;
  readonly versionId: string;
  readonly kind: DatapackSlotKind;
  readonly content: Datapack;
}

export interface DatapackPane {
  readonly paneKey: string;
  readonly identity: DatapackIdentity;
  readonly fixedSlot?: DatapackRecord;
  readonly editingSlot?: DatapackRecord;
}

export interface DatapackSelection {
  readonly paneKey: string;
  readonly selectedSlot: DatapackSelectionSlot;
}

export interface RuntimeApplyPlanEntry {
  readonly paneKey: string;
  readonly selectedSlot: DatapackSlotKind;
  readonly packRecordId: string;
  readonly modId: string;
  readonly versionId: string;
}

export interface RuntimeApplyPlan {
  readonly entries: readonly RuntimeApplyPlanEntry[];
}

export type PackImportDecision =
  | { readonly kind: 'added'; readonly packRecordId: string; readonly packId: string; readonly editingMode: EditingMode }
  | { readonly kind: 'idempotent'; readonly packRecordId: string; readonly packId: string; readonly editingMode: EditingMode }
  | { readonly kind: 'identity-conflict'; readonly packRecordId: string; readonly packId: string; readonly editingMode: EditingMode; readonly existingDigest: string; readonly incomingDigest: string };

export interface PackManagerSnapshot {
  readonly packs: readonly StoredPack[];
  readonly enabledIds: readonly string[];
  readonly order: readonly string[];
  /** 管理页下一次 Apply 的选择；不包含 Runtime 上一次成功应用的状态。 */
  readonly selectedSlots?: Readonly<Record<string, DatapackSelectionSlot>>;
}

export interface PackApplyTarget {
  validate?(datapacks: readonly Datapack[]): void;
  capture?(): unknown;
  restore?(snapshot: unknown): void;
  reload(datapacks: readonly Datapack[]): void;
  clearImages(): void;
  registerImages(modName: string, images: readonly { path: string; url: string }[]): void;
}

export interface PackConfigurationDraft {
  readonly enabledIds: readonly string[];
  readonly order: readonly string[];
}

export type PackDependencyStatus = 'enabled' | 'available' | 'missing';

export interface PackDependencyHint {
  readonly packId: string;
  readonly dependency: string;
  readonly status: PackDependencyStatus;
}

export function packEditingMode(pack: Pick<StoredPack, 'editingMode' | 'sourceKind'>): EditingMode {
  return pack.editingMode ?? (pack.sourceKind === 'editing' ? 'editing' : 'normal');
}

export function packLogicalId(pack: Pick<StoredPack, 'manifest'>): string {
  return `${pack.manifest.modName}@${pack.manifest.version}`;
}

export function datapackPaneKey(identity: DatapackIdentity): string {
  return `${identity.modId}@${identity.versionId}`;
}

export function packSlotKind(pack: Pick<StoredPack, 'editingMode' | 'sourceKind'>): DatapackSlotKind {
  return packEditingMode(pack) === 'editing' ? 'editing' : 'fixed';
}

export function storedPackIdentity(pack: Pick<StoredPack, 'manifest'>): DatapackIdentity {
  return { modId: pack.manifest.modName, versionId: pack.manifest.version };
}

export function toDatapackRecord(pack: StoredPack): DatapackRecord {
  const identity = storedPackIdentity(pack);
  return {
    ...pack,
    packRecordId: pack.packRecordId ?? pack.id,
    modId: identity.modId,
    versionId: identity.versionId,
    kind: packSlotKind(pack),
    content: pack.datapack,
  };
}

export function projectDatapackPanes(packs: readonly StoredPack[]): readonly DatapackPane[] {
  const grouped = new Map<string, { identity: DatapackIdentity; fixedSlot?: DatapackRecord; editingSlot?: DatapackRecord }>();
  for (const pack of packs) {
    const identity = storedPackIdentity(pack);
    const paneKey = datapackPaneKey(identity);
    const pane = grouped.get(paneKey) ?? { identity };
    const record = toDatapackRecord(pack);
    if (record.kind === 'fixed') pane.fixedSlot = record;
    else pane.editingSlot = record;
    grouped.set(paneKey, pane);
  }
  return [...grouped.entries()].map(([paneKey, pane]) => ({ paneKey, ...pane }));
}

export function packRecordKey(pack: Pick<StoredPack, 'manifest' | 'editingMode' | 'sourceKind'>): string {
  return `${packLogicalId(pack)}#${packEditingMode(pack)}`;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => canonicalValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalValue(item)]));
  }
  return value;
}

/** 稳定的语义内容摘要；不包含导入时间、来源类型或 ZIP 压缩细节。 */
export function storedPackContentDigest(pack: Pick<StoredPack, 'manifest' | 'datapack' | 'images'>): string {
  const payload = JSON.stringify(canonicalValue({
    manifest: pack.manifest,
    datapack: pack.datapack,
    images: [...pack.images].sort((left, right) => left.path.localeCompare(right.path)),
  }));
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeStoredPack(pack: StoredPack): StoredPack {
  const editingMode = packEditingMode(pack);
  const packRecordId = pack.packRecordId ?? pack.id;
  const sourceKind = pack.sourceKind === 'builtin' && pack.manifest.modName === 'base' ? 'bundle' : pack.sourceKind;
  return {
    ...pack,
    id: pack.id,
    packRecordId,
    sourceKind,
    editingMode,
    contentDigest: pack.contentDigest ?? storedPackContentDigest(pack),
  };
}

export class PackManagerError extends Error {
  readonly code: PackConflictCode;

  constructor(message: string, code: PackConflictCode = 'configuration-invalid') {
    super(message);
    this.name = 'PackManagerError';
    this.code = code;
  }
}

/** 包库与启用集的纯内存编排；持久化由后续 StorageAdapter 接入。 */
export class PackManager {
  private packs = new Map<string, StoredPack>();
  private enabledIds = new Set<string>();
  private order: string[] = [];
  private selectedSlots = new Map<string, DatapackSelectionSlot>();
  private runtimePackRecordIds = new Map<string, string>();

  constructor(initial?: PackManagerSnapshot, private readonly store?: PackSnapshotStore, bundledPacks: readonly StoredPack[] = []) {
    initial ??= store?.load() ?? { packs: [], enabledIds: [], order: [] };
    for (const pack of initial.packs) this.packs.set(pack.id, normalizeStoredPack(pack));
    for (const pack of bundledPacks) {
      if (!this.packs.has(pack.id)) this.packs.set(pack.id, normalizeStoredPack(pack));
    }
    this.order = this.normalizeOrder(initial.order);
    for (const pack of [...bundledPacks].reverse()) {
      if (!this.order.includes(pack.id)) this.order.unshift(pack.id);
    }
    // Catalog record identity is pack.id; ModName / Version / state remain runtime validation dimensions.
    for (const id of initial.enabledIds) {
      if (this.packs.has(id)) this.enabledIds.add(id);
    }
    if (![...this.enabledIds].some(id => this.packs.get(id)?.manifest.modName === 'base')) {
      const firstBase = this.order.find(id => this.packs.get(id)?.manifest.modName === 'base');
      if (firstBase) this.enabledIds.add(firstBase);
    }
    for (const [paneKey, selectedSlot] of Object.entries(initial.selectedSlots ?? {})) {
      this.selectedSlots.set(paneKey, selectedSlot);
    }
    this.validateEnabledSet();
  }

  snapshot(): PackManagerSnapshot {
    return {
      packs: this.orderedPacks(),
      enabledIds: this.order.filter(id => this.enabledIds.has(id)),
      order: [...this.order],
      ...(this.selectedSlots.size > 0 ? { selectedSlots: Object.fromEntries(this.selectedSlots) } : {}),
    };
  }

  configuration(): PackConfigurationDraft {
    return {
      enabledIds: this.order.filter(id => this.enabledIds.has(id)),
      order: [...this.order],
    };
  }

  /** 返回按 ModId + VersionId 聚合的只读 Pane 投影；Pane 不拥有内容副本。 */
  panes(): readonly DatapackPane[] {
    return projectDatapackPanes(this.orderedPacks());
  }

  /** 返回每个 Pane 的待 Apply 选择。没有显式选择时，兼容旧启用集的 fixed 选择。 */
  selections(): readonly DatapackSelection[] {
    return this.panes().map(pane => ({
      paneKey: pane.paneKey,
      selectedSlot: this.selectionForPane(pane),
    }));
  }

  selectionState(): readonly DatapackSelection[] {
    return this.selections();
  }

  runtimeState(): ReadonlyMap<string, string> {
    return new Map(this.runtimePackRecordIds);
  }

  /** 启动时把已知包库记录映射到实际载入的数据包；不写入 Selection 或 Storage。 */
  adoptRuntimeDatapacks(datapacks: readonly Datapack[]): void {
    const next = new Map<string, string>();
    for (const datapack of datapacks) {
      const match = [...this.packs.values()].find(pack => pack.manifest.modName === datapack.modName
        && pack.manifest.version === datapack.version
        && packSlotKind(pack) === 'fixed');
      if (match) next.set(packLogicalId(match), match.packRecordId ?? match.id);
    }
    this.runtimePackRecordIds = next;
  }

  setSelectedSlot(paneKey: string, selectedSlot: DatapackSelectionSlot): void {
    const pane = this.panes().find(item => item.paneKey === paneKey);
    if (!pane) throw new PackManagerError(`不存在的数据包 Pane：${paneKey}。`, 'runtime-plan-invalid');
    if (selectedSlot === 'fixed' && !pane.fixedSlot) {
      throw new PackManagerError(`Pane ${paneKey} 尚未创建普通态槽位，不能选择。`, 'runtime-plan-invalid');
    }
    if (selectedSlot === 'editing' && !pane.editingSlot) {
      throw new PackManagerError(`Pane ${paneKey} 尚未创建编辑态槽位，不能选择。`, 'runtime-plan-invalid');
    }
    this.selectedSlots.set(paneKey, selectedSlot);
    this.persist();
  }

  buildRuntimeApplyPlan(): RuntimeApplyPlan {
    const entries: RuntimeApplyPlanEntry[] = [];
    const selectedModIds = new Map<string, RuntimeApplyPlanEntry>();
    const panes = this.panes();
    const paneKeys = new Set(panes.map(pane => pane.paneKey));
    for (const paneKey of this.selectedSlots.keys()) {
      if (!paneKeys.has(paneKey)) throw new PackManagerError(`Runtime Apply 选择指向已不存在的 Pane：${paneKey}。`, 'runtime-plan-invalid');
    }
    for (const pane of panes) {
      const selectedSlot = this.selectionForPane(pane);
      if (selectedSlot === 'none') {
        continue;
      }
      const record = selectedSlot === 'fixed' ? pane.fixedSlot : pane.editingSlot;
      if (!record) {
        throw new PackManagerError(`Pane ${pane.paneKey} 的选择已失效：${selectedSlot} 槽位不存在。`, 'runtime-plan-invalid');
      }
      const entry: RuntimeApplyPlanEntry = {
        paneKey: pane.paneKey,
        selectedSlot,
        packRecordId: record.packRecordId ?? record.id,
        modId: pane.identity.modId,
        versionId: pane.identity.versionId,
      };
      const previous = selectedModIds.get(entry.modId);
      if (previous) {
        throw new PackManagerError(`Runtime Apply 存在 ModId 冲突：${entry.modId}（${previous.paneKey} 与 ${entry.paneKey}）。`, 'modid-runtime-conflict');
      }
      selectedModIds.set(entry.modId, entry);
      entries.push(entry);
    }
    const selectedByMod = selectedModIds;
    for (const entry of entries) {
      const pack = this.packs.get(entry.packRecordId);
      if (!pack) throw new PackManagerError(`Runtime Apply 目标记录不存在：${entry.packRecordId}。`, 'runtime-plan-invalid');
      for (const dependency of pack.manifest.dependencies) {
        if (!selectedByMod.has(dependency)) {
          throw new PackManagerError(`${pack.manifest.name} 缺少 Runtime Apply 依赖：${dependency}。`, 'runtime-plan-invalid');
        }
      }
    }
    if (this.hasBasePack() && entries.filter(entry => entry.modId === 'base').length !== 1) {
      throw new PackManagerError('Runtime Apply 必须且只能包含一个启用的 base 数据包。', 'runtime-plan-invalid');
    }
    const orderIndex = new Map(this.order.map((id, index) => [id, index] as const));
    entries.sort((left, right) => (orderIndex.get(left.packRecordId) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(right.packRecordId) ?? Number.MAX_SAFE_INTEGER));
    return { entries };
  }

  /** 以全部 Pane 的选择构建并提交一次全局 Runtime Apply。 */
  applySelection(target: PackApplyTarget): RuntimeApplyPlan {
    const plan = this.buildRuntimeApplyPlan();
    this.applyRuntimePlan(plan, target);
    this.enabledIds = new Set(plan.entries.map(entry => entry.packRecordId));
    const selectedByPane = new Map(plan.entries.map(entry => [entry.paneKey, entry.selectedSlot] as const));
    for (const pane of this.panes()) this.selectedSlots.set(pane.paneKey, selectedByPane.get(pane.paneKey) ?? 'none');
    this.persist();
    return plan;
  }

  validateConfiguration(draft: PackConfigurationDraft): void {
    const known = new Set(this.packs.keys());
    if (draft.order.length !== known.size || new Set(draft.order).size !== draft.order.length || draft.order.some(id => !known.has(id))) {
      throw new PackManagerError('排序列表必须包含包库中的每个数据包且不能重复。');
    }
    const enabled = new Set(draft.enabledIds);
    if (enabled.size !== draft.enabledIds.length || draft.enabledIds.some(id => !known.has(id))) {
      throw new PackManagerError('启用集包含未知或重复的数据包。');
    }
    const byModName = new Map<string, string>();
    for (const id of draft.order) {
      if (!enabled.has(id)) continue;
      const pack = this.packs.get(id)!;
      const previous = byModName.get(pack.manifest.modName);
      if (previous) throw new PackManagerError(`启用集存在 modName 冲突：${pack.manifest.modName}（${previous} 与 ${id}）。`, 'modid-runtime-conflict');
      byModName.set(pack.manifest.modName, id);
    }
    if (this.hasBasePack() && byModName.has('base') === false) {
      throw new PackManagerError('启用集必须保留一个 base 数据包；请先选择替代基础包。');
    }
    for (const id of draft.order) {
      if (!enabled.has(id)) continue;
      const pack = this.packs.get(id)!;
      for (const dependency of pack.manifest.dependencies) {
        if (!Array.from(byModName.keys()).includes(dependency)) {
          throw new PackManagerError(`${pack.manifest.name} 缺少启用依赖：${dependency}。`);
        }
      }
    }
  }

  applyConfiguration(draft: PackConfigurationDraft, target: PackApplyTarget): void {
    this.validateConfiguration(draft);
    const enabled = new Set(draft.enabledIds);
    const datapacks = draft.order.filter(id => enabled.has(id)).map(id => this.packs.get(id)!.datapack);
    target.validate?.(datapacks);
    const previousRuntimeState = this.runtimePackRecordIds;
    try {
      this.applyDatapacks(datapacks, draft.order.filter(id => enabled.has(id)).map(id => this.packs.get(id)!), target);
    } catch (error) {
      this.runtimePackRecordIds = previousRuntimeState;
      throw error;
    }
    this.order = [...draft.order];
    this.enabledIds = enabled;
    this.runtimePackRecordIds = new Map(draft.order
      .filter(id => enabled.has(id))
      .map(id => {
        const pack = this.packs.get(id)!;
        return [packLogicalId(pack), pack.packRecordId ?? pack.id] as const;
      }));
    this.persist();
  }

  importPack(pack: StoredPack): PackImportDecision {
    const normalized = normalizeStoredPack(pack);
    const incomingKey = packRecordKey(normalized);
    const existingById = this.packs.get(normalized.id);
    if (existingById) {
      if (packRecordKey(existingById) !== incomingKey) throw new PackManagerError(`数据包保存冲突：记录 ${normalized.id} 的 ModName、Version 或 Editing 状态不同。`, 'datapack-record-conflict');
      const existingDigest = existingById.contentDigest ?? storedPackContentDigest(existingById);
      const incomingDigest = normalized.contentDigest ?? storedPackContentDigest(normalized);
      if (existingDigest !== incomingDigest) {
        throw new PackManagerError(`数据包保存冲突：${incomingKey} 已存在但内容不同。`, 'datapack-record-conflict');
      }
      return { kind: 'idempotent', packRecordId: existingById.id, packId: incomingKey.slice(0, incomingKey.lastIndexOf('#')), editingMode: packEditingMode(existingById) };
    }
    const existingByRecordId = [...this.packs.values()].find(item => (item.packRecordId ?? item.id) === (normalized.packRecordId ?? normalized.id));
    if (existingByRecordId) throw new PackManagerError(`数据包 packRecordId 已存在：${normalized.packRecordId ?? normalized.id}。`, 'datapack-record-conflict');
    this.packs.set(normalized.id, normalized);
    if (!this.order.includes(normalized.id)) this.order.push(normalized.id);
    this.persist();
    return { kind: 'added', packRecordId: normalized.id, packId: packLogicalId(normalized), editingMode: packEditingMode(normalized) };
  }

  /** 更新同一条 Catalog 记录；若目标三元组已被另一条记录占用则拒绝覆盖。 */
  savePack(pack: StoredPack): PackImportDecision {
    const normalized = normalizeStoredPack(pack);
    const existing = this.packs.get(normalized.id);
    if (!existing) return this.importPack(normalized);
    const sameDevelopmentSource = existing.sourcePath !== undefined && existing.sourcePath === normalized.sourcePath;
    if (packRecordKey(existing) !== packRecordKey(normalized) && !sameDevelopmentSource) {
      throw new PackManagerError(`数据包保存冲突：${normalized.id} 的 ModId、Version 或 EditingMode 不可变更。`, 'datapack-record-conflict');
    }
    this.packs.set(normalized.id, normalized);
    this.persist();
    return { kind: 'added', packRecordId: normalized.id, packId: packLogicalId(normalized), editingMode: packEditingMode(normalized) };
  }

  /** 外部文件一律以 fixed 记录进入包库，不携带本地 editing 标记。 */
  importFixed(pack: StoredPack): PackImportDecision {
    const fixedSourceKind = pack.sourceKind === 'builtin' ? 'zip' : pack.sourceKind === 'editing' ? 'zip' : pack.sourceKind;
    return this.importPack({
      ...pack,
      sourceKind: fixedSourceKind,
      editingMode: 'normal',
      sourcePackRecordId: undefined,
      sourceDigest: undefined,
    });
  }

  reconcileDevelopmentPacks(discovered: readonly StoredPack[]): void {
    const sourcePaths = new Set<string>();
    for (const pack of discovered) {
      if (!pack.sourcePath) throw new PackManagerError(`自动发现的数据包缺少 sourcePath：${pack.id}。`);
      if (sourcePaths.has(pack.sourcePath)) throw new PackManagerError(`开发目录来源路径重复：${pack.sourcePath}。`);
      sourcePaths.add(pack.sourcePath);
    }

    for (const pack of this.orderedPacks()) {
      if (pack.sourcePath && !sourcePaths.has(pack.sourcePath)) this.removePack(pack.id);
    }

    const previousIds = new Set(this.packs.keys());
    for (const pack of discovered) {
      const existing = this.packs.get(pack.id);
      if (!existing) {
        this.importPack(pack);
        continue;
      }
      const sameContent = (existing.contentDigest ?? storedPackContentDigest(existing))
        === (pack.contentDigest ?? storedPackContentDigest(pack));
      if (!sameContent || existing.sourceKind !== pack.sourceKind || existing.editingMode !== pack.editingMode) {
        this.savePack({ ...pack, importedAt: existing.importedAt });
      }
    }

    const newNormalByModName = new Map<string, StoredPack[]>();
    for (const pack of discovered) {
      if (previousIds.has(pack.id) || packEditingMode(pack) === 'editing') continue;
      const group = newNormalByModName.get(pack.manifest.modName) ?? [];
      group.push(pack);
      newNormalByModName.set(pack.manifest.modName, group);
    }
    for (const [modName, packs] of newNormalByModName) {
      if (packs.length !== 1) continue;
      const pack = packs[0];
      const alreadyEnabled = this.order.some(id => this.enabledIds.has(id) && this.packs.get(id)?.manifest.modName === modName);
      if (!alreadyEnabled) this.setEnabled(pack.id, true);
    }
  }

  /** 创建指定身份的空 editing；已有 fixed 时必须改用 cloneAsEditing。 */
  createEmptyEditing(identity: DatapackIdentity, editingId = `editing:${datapackPaneKey(identity)}`): { kind: 'created'; pack: StoredPack } {
    const pane = this.panes().find(item => item.paneKey === datapackPaneKey(identity));
    if (pane?.fixedSlot) throw new PackManagerError(`Pane ${datapackPaneKey(identity)} 已有普通态，必须从已有内容复制为编辑态。`, 'datapack-record-conflict');
    if (pane?.editingSlot) throw new PackManagerError(`编辑态数据包已存在：${datapackPaneKey(identity)}。`, 'datapack-record-conflict');
    const empty: Datapack = {
      modName: identity.modId,
      name: identity.modId,
      version: identity.versionId,
      inits: [],
      areas: [],
      spots: [],
      enhancements: [],
      activeStories: [],
      passiveStories: [],
      stories: [],
      items: [],
      funcletDefs: [],
      characters: [],
    };
    const pack = normalizeStoredPack({
      id: editingId,
      packRecordId: editingId,
      manifest: { modName: identity.modId, name: identity.modId, version: identity.versionId, dependencies: [] },
      datapack: empty,
      images: [],
      sourceKind: 'editing',
      importedAt: Date.now(),
      editingMode: 'editing',
    });
    this.importPack(pack);
    return { kind: 'created', pack };
  }

  /**
   * 从明确 source 完整复制一份 editing。source 可以是 fixed 或 editing，
   * 但 ModId 不得改变；目标 VersionId 始终通过新记录表达。
   */
  cloneAsEditing(sourceId: string, targetIdentity?: DatapackIdentity | string): { kind: 'created' | 'existing'; pack: StoredPack } {
    const source = this.packs.get(sourceId);
    if (!source) throw new PackManagerError(`不存在的数据包：${sourceId}`, 'source-not-found');
    const sourceIdentity = storedPackIdentity(source);
    const identity: DatapackIdentity = typeof targetIdentity === 'string'
      ? sourceIdentity
      : targetIdentity ?? sourceIdentity;
    if (identity.modId !== sourceIdentity.modId) {
      throw new PackManagerError('ModId 创建后不可修改；Fork 只能改变 VersionId。', 'datapack-record-conflict');
    }
    const existing = [...this.packs.values()].find(item => packSlotKind(item) === 'editing' && packLogicalId(item) === datapackPaneKey(identity));
    if (existing) return { kind: 'existing', pack: existing };
    const editingId = typeof targetIdentity === 'string'
      ? targetIdentity
      : `editing:${datapackPaneKey(identity)}`;
    const clonedDatapack = cloneJson(source.datapack);
    clonedDatapack.modName = identity.modId;
    clonedDatapack.version = identity.versionId;
    const copied: StoredPack = normalizeStoredPack({
      id: editingId,
      packRecordId: editingId,
      manifest: cloneJson(source.manifest),
      datapack: clonedDatapack,
      images: cloneJson(source.images),
      sourceKind: 'editing',
      importedAt: Date.now(),
      editingMode: 'editing',
      sourcePackRecordId: source.id,
      sourceDigest: source.contentDigest ?? storedPackContentDigest(source),
    });
    copied.manifest.modName = identity.modId;
    copied.manifest.version = identity.versionId;
    this.importPack(copied);
    return { kind: 'created', pack: copied };
  }

  /** 按 Pane 约定选择 source：已有 editing 优先，否则使用 fixed。 */
  clonePaneAsEditing(paneKey: string, targetIdentity?: DatapackIdentity): { kind: 'created' | 'existing'; pack: StoredPack } {
    const pane = this.panes().find(item => item.paneKey === paneKey);
    if (!pane) throw new PackManagerError(`不存在的数据包 Pane：${paneKey}。`, 'source-not-found');
    const source = pane.editingSlot ?? pane.fixedSlot;
    if (!source) throw new PackManagerError(`Pane ${paneKey} 没有可复制的数据包内容。`, 'source-not-found');
    return this.cloneAsEditing(source.packRecordId ?? source.id, targetIdentity ?? pane.identity);
  }

  /** 保留 task0110 的入口语义：从 fixed 创建同身份 editing。 */
  createEditingPack(sourceId: string, editingId = `editing:${sourceId}`, versionId?: string): { kind: 'created' | 'existing'; pack: StoredPack } {
    const source = this.packs.get(sourceId);
    if (!source) throw new PackManagerError(`不存在的数据包：${sourceId}`, 'source-not-found');
    if (packSlotKind(source) !== 'fixed') throw new PackManagerError('只有普通态数据包可以作为同身份编辑态的创建入口。');
    if (versionId !== undefined) {
      const nextVersion = versionId.trim();
      if (!nextVersion || /\s/.test(nextVersion)) throw new PackManagerError('新 Version 不能为空且不能包含空白字符。');
      if (nextVersion === source.manifest.version) throw new PackManagerError('创建编辑态时必须使用不同于来源的新 Version。');
      return this.cloneAsEditing(sourceId, { modId: source.manifest.modName, versionId: nextVersion });
    }
    return this.cloneAsEditing(sourceId, editingId);
  }

  convertEditingPackToNormal(sourceId: string): StoredPack {
    const source = this.packs.get(sourceId);
    if (!source) throw new PackManagerError(`不存在的数据包：${sourceId}`, 'source-not-found');
    if (packSlotKind(source) !== 'editing') throw new PackManagerError('只有编辑态数据包可以转换为普通态。');
    const id = `normal-copy:${source.id}`;
    const converted = normalizeStoredPack({
      ...source,
      id,
      packRecordId: id,
      sourceKind: 'editing',
      sourcePath: undefined,
      sourcePackRecordId: undefined,
      sourceDigest: undefined,
      importedAt: Date.now(),
      editingMode: 'normal',
    });
    this.importPack(converted);
    return converted;
  }

  /** 导出快照始终抹平本地 editing 标记，重新导入时会进入 fixed 槽位。 */
  exportPack(packRecordId: string, options: { readonly versionId?: string } = {}): StoredPack {
    const source = this.packs.get(packRecordId);
    if (!source) throw new PackManagerError(`不存在的数据包：${packRecordId}`, 'source-not-found');
    const versionId = options.versionId?.trim() || source.manifest.version;
    const datapack = cloneJson(source.datapack);
    datapack.version = versionId;
    return normalizeStoredPack({
      ...source,
      id: `${source.manifest.modName}@${versionId}`,
      packRecordId: `${source.manifest.modName}@${versionId}`,
      manifest: { ...cloneJson(source.manifest), version: versionId },
      datapack,
      sourceKind: 'zip',
      editingMode: 'normal',
      sourcePackRecordId: undefined,
      sourceDigest: undefined,
      contentDigest: undefined,
    });
  }

  removePack(id: string): void {
    const pack = this.packs.get(id);
    if (pack?.sourceKind === 'bundle' || pack?.sourceKind === 'builtin') throw new PackManagerError('发布基础包不可从包库移除：' + id);
    if (pack?.manifest.modName === 'base' && this.enabledIds.has(id)) throw new PackManagerError('当前启用的 base 数据包不能删除；请先交换到另一个 base。');
    this.packs.delete(id);
    this.enabledIds.delete(id);
    this.order = this.order.filter(packId => packId !== id);
    this.persist();
  }

  getPack(id: string): StoredPack | undefined {
    return this.packs.get(id);
  }

  listPacks(): readonly StoredPack[] {
    return this.orderedPacks();
  }

  setEnabled(id: string, enabled: boolean): void {
    if (!this.packs.has(id)) throw new PackManagerError('不存在的数据包：' + id);
    if (enabled) {
      this.enabledIds.add(id);
      try { this.validateEnabledSet(); }
      catch (error) {
        this.enabledIds.delete(id);
        throw error;
      }
      this.persist();
    } else {
      this.enabledIds.delete(id);
      try { this.validateEnabledSet(); }
      catch (error) {
        this.enabledIds.add(id);
        throw error;
      }
      this.persist();
    }
  }

  reorder(ids: readonly string[]): void {
    const known = new Set(this.packs.keys());
    if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some(id => !known.has(id))) {
      throw new PackManagerError('排序列表必须完整且每个数据包只出现一次。');
    }
    this.order = [...ids];
    this.validateEnabledSet();
    this.persist();
  }

  enabledPacks(): readonly Datapack[] {
    this.validateEnabledSet();
    return this.order.filter(id => this.enabledIds.has(id)).map(id => this.packs.get(id)!.datapack);
  }

  dependencyHints(): readonly PackDependencyHint[] {
    const enabledMods = new Set<string>();
    const availableMods = new Set<string>();
    for (const [id, pack] of this.packs) {
      availableMods.add(pack.manifest.modName);
      if (this.enabledIds.has(id)) enabledMods.add(pack.manifest.modName);
    }
    return this.order
      .filter(id => this.enabledIds.has(id))
      .flatMap(id => this.packs.get(id)!.manifest.dependencies.map(dependency => ({
        packId: id,
        dependency,
        status: enabledMods.has(dependency) ? 'enabled' : availableMods.has(dependency) ? 'available' : 'missing',
      })));
  }

  applyEnabled(target: PackApplyTarget): void {
    this.applyConfiguration(this.configuration(), target);
  }

  /**
   * 在完整启用集校验失败后，按单个可选包及其依赖闭包复核内容，找出可安全停用的失效包。
   * 校验只读，不改变当前启用集；调用方确认恢复后再执行 disableOptionalPacks。
   */
  findInvalidOptionalPackIds(validate: (datapacks: readonly Datapack[]) => void): readonly string[] {
    const enabledIds = new Set(this.enabledIds);
    const optionalIds = this.order.filter(id => enabledIds.has(id)
      && this.packs.get(id)?.sourceKind !== 'builtin'
      && this.packs.get(id)?.sourceKind !== 'bundle'
      && this.packs.get(id)?.manifest.modName !== 'base');
    const invalid = new Set<string>();

    for (const id of optionalIds) {
      const closure = this.dependencyClosure(id, enabledIds);
      const candidateEnabled = new Set<string>();
      const activeBaseId = [...enabledIds].find(candidateId => this.packs.get(candidateId)?.manifest.modName === 'base');
      for (const candidateId of this.order) {
        if (candidateId === activeBaseId || closure.has(candidateId)) {
          candidateEnabled.add(candidateId);
        }
      }
      const draft: PackConfigurationDraft = {
        enabledIds: this.order.filter(candidateId => candidateEnabled.has(candidateId)),
        order: [...this.order],
      };

      try {
        this.validateConfiguration(draft);
        validate(this.datapacksFor(draft));
      } catch {
        for (const candidateId of closure) {
          if (this.packs.get(candidateId)?.manifest.modName !== 'base'
            && this.packs.get(candidateId)?.sourceKind !== 'builtin'
            && this.packs.get(candidateId)?.sourceKind !== 'bundle') invalid.add(candidateId);
        }
      }
    }

    return this.order.filter(id => invalid.has(id));
  }

  /** 停用可选包但保留包库记录，方便用户更新或重新启用。 */
  disableOptionalPacks(ids: readonly string[]): readonly string[] {
    const requested = new Set(ids);
    const disabled = this.order.filter(id => requested.has(id)
      && this.enabledIds.has(id)
      && this.packs.get(id)?.sourceKind !== 'builtin'
      && this.packs.get(id)?.sourceKind !== 'bundle'
      && this.packs.get(id)?.manifest.modName !== 'base');
    if (disabled.length === 0) return [];
    for (const id of disabled) this.enabledIds.delete(id);
    this.persist();
    return disabled;
  }

  private orderedPacks(): StoredPack[] {
    return this.order.map(id => this.packs.get(id)!).filter(Boolean);
  }

  private datapacksFor(draft: PackConfigurationDraft): readonly Datapack[] {
    const enabled = new Set(draft.enabledIds);
    return draft.order.filter(id => enabled.has(id)).map(id => this.packs.get(id)!.datapack);
  }

  private dependencyClosure(rootId: string, enabledIds: ReadonlySet<string>): Set<string> {
    const byModName = new Map<string, string>();
    for (const id of this.order) {
      if (enabledIds.has(id)) byModName.set(this.packs.get(id)!.manifest.modName, id);
    }
    const closure = new Set<string>();
    const visit = (id: string): void => {
      if (closure.has(id)) return;
      closure.add(id);
      const pack = this.packs.get(id);
      if (!pack) return;
      for (const dependency of pack.manifest.dependencies) {
        const dependencyId = byModName.get(dependency);
        if (dependencyId) visit(dependencyId);
      }
    };
    visit(rootId);
    return closure;
  }

  private selectionForPane(pane: DatapackPane): DatapackSelectionSlot {
    const explicit = this.selectedSlots.get(pane.paneKey);
    if (explicit !== undefined) return explicit;
    if (pane.fixedSlot && this.enabledIds.has(pane.fixedSlot.id)) return 'fixed';
    return 'none';
  }

  private applyRuntimePlan(plan: RuntimeApplyPlan, target: PackApplyTarget): void {
    const packs = plan.entries.map(entry => this.packs.get(entry.packRecordId));
    if (packs.some(pack => !pack)) throw new PackManagerError('Runtime Apply 计划引用了不存在的数据包记录。', 'runtime-plan-invalid');
    const resolved = packs as StoredPack[];
    const datapacks = resolved.map(pack => pack.datapack);
    target.validate?.(datapacks);
    const previousRuntimeState = this.runtimePackRecordIds;
    try {
      this.applyDatapacks(datapacks, resolved, target);
    } catch (error) {
      this.runtimePackRecordIds = previousRuntimeState;
      throw error;
    }
    this.runtimePackRecordIds = new Map(plan.entries.map(entry => [entry.paneKey, entry.packRecordId] as const));
  }

  private applyDatapacks(datapacks: readonly Datapack[], packs: readonly StoredPack[], target: PackApplyTarget): void {
    const checkpoint = target.capture?.();
    try {
      target.reload(datapacks);
      target.clearImages();
      for (const pack of packs) target.registerImages(pack.manifest.modName, pack.images);
    } catch (error) {
      if (checkpoint !== undefined && target.restore) {
        try { target.restore(checkpoint); } catch { /* 保留原始 Apply 错误，避免吞掉失败原因。 */ }
      }
      throw error;
    }
  }

  private normalizeOrder(order: readonly string[]): string[] {
    const known = new Set(this.packs.keys());
    const result: string[] = [];
    for (const id of order) if (known.has(id) && !result.includes(id)) result.push(id);
    for (const id of known) if (!result.includes(id)) result.push(id);
    return result;
  }

  private validateEnabledSet(): void {
    const byModName = new Map<string, string>();
    for (const id of this.order) {
      if (!this.enabledIds.has(id)) continue;
      const pack = this.packs.get(id)!;
      const previous = byModName.get(pack.manifest.modName);
      if (previous) throw new PackManagerError('启用集存在 modName 冲突：' + pack.manifest.modName + '（' + previous + ' 与 ' + id + '）。', 'modid-runtime-conflict');
      byModName.set(pack.manifest.modName, id);
    }
    if (this.hasBasePack() && !byModName.has('base')) {
      throw new PackManagerError('启用集必须保留一个 base 数据包；请先选择替代基础包。');
    }
  }

  private hasBasePack(): boolean {
    return [...this.packs.values()].some(pack => pack.manifest.modName === 'base');
  }

  private persist(): void {
    this.store?.save(this.snapshot());
  }
}
