import { emptyStoryAuthoring, patchStoryDatapack, STORY_AUTHORING_TABLES, validateStoryAuthoringShape, type StoryAuthoringPatch, type StoryAuthoringResult } from '../../data-services/authoring/story-authoring';
import type { StoryDef } from '../../data-services/contracts/story';
import type { StoryDefinitionRestoreResult, StoryDefinitionSaveResult, StoryPackSource } from '../contracts/runtime/runtime';
import type { StoryAuthoringPreviewTarget } from '../contracts/runtime/story-authoring';
import { packStoryIdentityReferences, planStoryIdentityChange, type StoryIdentityChange } from '../../data-services/authoring/story-identity';
import { storyDirectoryReferences } from '../../data-services/authoring/story-directory-references';
import type { StoryDirectoryDef } from '../../data-services/contracts/story-directory';
import { GameInstance } from './runtime-game-instance';
import { buildSaveData } from './runtime-save-codec';
import type { GameInstanceOptions } from './runtime-options';
import { PackManager, PackManagerError, packEditingMode, packLogicalId, storedPackContentDigest, type DatapackSelectionSlot, type PackConfigurationDraft, type StoredPack } from '../../data-services/datapack/pack-manager';
import type { ParsedPack } from '../../data-services/datapack/pack-parser';
import type { AsyncPackSnapshotStore, PackSnapshotStore } from '../../data-services/datapack/pack-storage';
import { Registry } from '../../data-services/registry/registry';
import { buildAuthoringDef, requireContentPolicy, validateAuthoringInput } from '../../data-services/authoring/content-policy';
import type { AuthoringValidationContext, ContentAuthoringPolicy } from '../../data-services/authoring/content-policy';
import { defaultDatapack } from '../content/default-datapack';
import bundledBaseManifest from '../content/base-pack/datapack.json';
import type { PackCatalogCommands, PackCatalogDependencyHint, PackCatalogEntry, PackCatalogPane, PackCatalogReadModel, PackCatalogRecord, RuntimeAreaDraft, RuntimeAreaMapDraft, RuntimeEnhancementDraft, RuntimeInitDraft, RuntimeModDraft, RuntimeModApplyResult } from '../contracts/index';
import type { Datapack } from '../../data-services/contracts/datapack';
import type { AreaDef, InitDef, SpotDef } from '../../data-services/contracts/world';
import type { AreaMapDef } from '../../data-services/contracts/area-map';
import type { EnhancementDef } from '../../data-services/contracts/enhancement';
import { RuntimeContentCoordinator } from '../services/runtime/runtime-content-coordinator';
import { RuntimeWorldContentCoordinator } from '../services/world/runtime-world-content-coordinator';
import { ThemeContentEditorService } from '../services/presentation/theme-content-editor-service';
import { RuntimeDefinitionEditor, SpotContentService } from '../services/world/spot-content-service';
import type { RuntimeModStateSnapshot, RuntimeSpotMutation, RuntimeSpotMutationResult, RuntimeSpotRevealTriggerDraft, RuntimeWorldApplyResult, RuntimeWorldDraft, RuntimeWorldStateSnapshot } from '../contracts/runtime/runtime-content';
import { decodeSpotContent } from '../../data-services/authoring/content-policy-dsl';
import { gameplayBMapDatapack } from '../content/gameplay-b/gameplay-b-map-datapack';
import { retainStoryDirectoryProgress } from '../read-model/story-directory-view';

export interface AronaClickerRuntimeOptions extends GameInstanceOptions {
  packStore?: PackSnapshotStore;
}

function replaceRuntimeDatapack(active: readonly Datapack[], replacement: Datapack, previousModNames: readonly string[] = []): Datapack[] {
  const replacedModNames = new Set([...previousModNames, replacement.modName]);
  const currentIndex = active.findIndex(datapack => replacedModNames.has(datapack.modName));
  const retained = active.filter(datapack => !replacedModNames.has(datapack.modName));
  const insertIndex = currentIndex < 0
    ? retained.length
    : active.slice(0, currentIndex).filter(datapack => !replacedModNames.has(datapack.modName)).length;
  return [...retained.slice(0, insertIndex), replacement, ...retained.slice(insertIndex)];
}

/**
 * AronaClicker 的应用运行时组合根。
 *
 * 引擎只提供机制与通用服务；这个入口负责把 AronaClicker 领域服务
 * 组合成当前产品可以启动、存档和驱动 UI 的运行时。
 */
export class AronaClickerRuntime extends GameInstance implements PackCatalogReadModel, PackCatalogCommands {
  packManager: PackManager;
  private packAsyncStore: AsyncPackSnapshotStore | undefined;
  private activeDatapacks: readonly Datapack[] = [];
  private readonly storyOverlaySources = new WeakMap<Datapack, string | undefined>();
  private runtimeMod: RuntimeModDraft | null = null;
  private runtimeEditorPackRecordId: string | null = null;
  private readonly runtimeContent: RuntimeContentCoordinator;
  private readonly runtimeWorldContent: RuntimeWorldContentCoordinator;
  readonly runtimeDefinitionEditor: RuntimeDefinitionEditor;
  readonly themeContentEditor: ThemeContentEditorService;

  constructor(options: AronaClickerRuntimeOptions = {}) {
    super({ ...options, saveCodec: options.saveCodec ?? buildSaveData });
    this.packManager = new PackManager(
      undefined,
      options.packStore,
      [createBundledBasePack(), createBundledGameplayBMapPack()],
      ['gameplay-b@1.0.0'],
      ['gameplay-b-strategy-park@1.0.0'],
    );
    this.themeContentEditor = new ThemeContentEditorService({
      getPackManager: () => this.packManager,
      colorSystem: this.colorSystem,
      persistPackManagerSnapshot: () => this.persistPackManagerSnapshot(),
    });
    this.runtimeContent = new RuntimeContentCoordinator({
      registry: this.registry,
      sourceId: 'runtime-editor',
      onCommitted: commit => {
        this.eventBus.emit({
          type: 'spotDefinitionChanged',
          spotId: commit.spotId,
          operation: commit.operation,
          ...(commit.previousSpot ? { previousAreaId: commit.previousSpot.areaId } : {}),
          ...(commit.currentSpot ? { nextAreaId: commit.currentSpot.areaId } : {}),
        });
      },
    });
    this.runtimeWorldContent = new RuntimeWorldContentCoordinator({
      registry: this.registry,
      sourceId: 'runtime-editor-world',
      onCommitted: commit => {
        this.setRuntimeAreaTopology(commit.topology);
        this.initService.reconcileAfterWorldDefinitionChange(true);
        for (const initId of commit.changedInitIds) {
          this.eventBus.emit({ type: 'initDefinitionChanged', initId });
        }
        for (const areaId of commit.changedAreaIds) {
          this.eventBus.emit({ type: 'areaDefinitionChanged', areaId });
        }
        for (const areaMapId of commit.changedAreaMapIds) this.eventBus.emit({ type: 'areaMapDefinitionChanged', areaMapId });
        if (commit.topologyAreaIds.length > 0) {
          this.eventBus.emit({ type: 'areaTopologyChanged', areaIds: [...commit.topologyAreaIds] });
        }
      },
    });
    this.spotService.setContentService(new SpotContentService({
      getState: () => this.getRuntimeContentState(),
      setModMetadata: metadata => this.setRuntimeModMetadata(metadata),
      applyMutation: mutation => this.applyRuntimeSpotMutation(mutation),
    }));
    this.runtimeDefinitionEditor = new RuntimeDefinitionEditor({
      getState: () => this.getRuntimeContentState(),
      getEditingModName: () => this.runtimeMod?.modName ?? this.getRuntimeContentState().modName,
      getEditingPackRecordId: () => this.runtimeEditorPackRecordId,
      applyMutation: mutation => this.applyRuntimeSpotMutation(mutation),
    });
  }

  override init(datapacks: Datapack[], options = {}): void {
    const retained = new Map(this.activeDatapacks.filter(pack => datapacks.includes(pack)).map(pack =>
      [pack, this.getRunningStoryPackId(pack.modName ?? 'base')] as const));
    this.activeDatapacks = [...datapacks];
    super.init(datapacks, options);
    this.packManager.adoptRuntimeDatapacks(datapacks, retained);
    this.runtimeWorldContent.reset();
    this.clearRuntimeAreaTopology();
  }

  registerParsedPack(parsed: ParsedPack, id = parsed.manifest.modName + '@' + parsed.manifest.version): void {
    const stored: StoredPack = {
      id,
      packRecordId: id,
      manifest: parsed.manifest,
      datapack: parsed.datapack,
      images: parsed.images,
      sourceKind: 'zip',
      importedAt: Date.now(),
      editingMode: 'normal',
    };
    this.packManager.importFixed(stored);
    this.persistPackManagerSnapshot();
  }

  applyEnabledPacks(): void {
    const target = this.createPackApplyTarget();
    try {
      this.packManager.applyEnabled(target);
    } catch (error) {
      const invalidIds = this.packManager.findInvalidOptionalPackIds(datapacks => this.validatePackDatapacks(datapacks));
      if (invalidIds.length === 0) throw error;
      const disabledIds = this.packManager.disableOptionalPacks(invalidIds);
      this.persistPackManagerSnapshot();
      try {
        this.packManager.applyEnabled(target);
      } catch (recoveryError) {
        throw new Error(`自动卸载失效数据包后仍无法加载运行时：${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
      }
      const names = disabledIds
        .map(id => this.packManager.getPack(id)?.manifest.name ?? id)
        .join('、');
      this.devLog.record(`检测到失效数据包，已自动停用：${names}`, {
        source: 'datapack',
        level: 'warning',
        details: error instanceof Error ? error.message : String(error),
      });
    }
    // PackManager 在异步恢复模式下不直接持有存储器；启动时的补正结果
    // （包括 base 补入与失效可选包停用）也必须落回同一份策略快照。
    this.persistPackManagerSnapshot();
    this.runtimeMod = null;
    this.runtimeEditorPackRecordId = null;
    this.runtimeContent.reset();
    this.runtimeWorldContent.reset();
  }

  getPackCatalog(): { entries: readonly PackCatalogEntry[]; dependencies: readonly PackCatalogDependencyHint[]; panes: readonly PackCatalogPane[] } {
    const enabled = new Set(this.packManager.snapshot().enabledIds);
    const entries = this.packManager.listPacks().map(pack => ({
      id: pack.id,
      packRecordId: pack.packRecordId ?? pack.id,
      modName: pack.manifest.modName,
      name: pack.manifest.name,
      version: pack.manifest.version,
      editingMode: packEditingMode(pack),
      ...(pack.sourcePackRecordId ? { sourcePackRecordId: pack.sourcePackRecordId } : {}),
      ...(pack.sourceDigest ? { sourceDigest: pack.sourceDigest } : {}),
      contentDigest: pack.contentDigest ?? storedPackContentDigest(pack),
      author: pack.manifest.author,
      ...(pack.manifest.color ? { color: pack.manifest.color } : {}),
      dependencies: [...pack.manifest.dependencies],
      sourceKind: pack.sourceKind,
      ...(pack.sourcePath ? { sourcePath: pack.sourcePath } : {}),
      importedAt: pack.importedAt,
      enabled: enabled.has(pack.id),
      capabilities: {
        required: pack.manifest.modName === 'base',
        removable: pack.manifest.modName !== 'base' && pack.sourceKind !== 'bundle' && pack.sourceKind !== 'builtin',
        reorderable: pack.manifest.modName === 'base'
          ? !enabled.has(pack.id)
          : pack.sourceKind !== 'bundle' && pack.sourceKind !== 'builtin',
        enableable: pack.manifest.modName !== 'base' || !enabled.has(pack.id),
      },
    } satisfies PackCatalogEntry));
    const entryByRecordId = new Map(entries.map(entry => [entry.packRecordId ?? entry.id, entry] as const));
    const selections = new Map(this.packManager.selections().map(selection => [selection.paneKey, selection.selectedSlot] as const));
    const runtimeState = this.packManager.runtimeState();
    const panes: PackCatalogPane[] = this.packManager.panes().map(pane => ({
      paneKey: pane.paneKey,
      modName: pane.identity.modId,
      version: pane.identity.versionId,
      ...(pane.fixedSlot ? { fixed: entryByRecordId.get(pane.fixedSlot.packRecordId ?? pane.fixedSlot.id) } : {}),
      ...(pane.editingSlot ? { editing: entryByRecordId.get(pane.editingSlot.packRecordId ?? pane.editingSlot.id) } : {}),
      selectedSlot: selections.get(pane.paneKey) ?? 'none',
      ...(runtimeState.get(pane.paneKey) ? { runtimePackRecordId: runtimeState.get(pane.paneKey) } : {}),
    }));
    return {
      entries,
      dependencies: this.packManager.dependencyHints(),
      panes,
    };
  }

  createEditingPack(sourcePackRecordId: string, versionId?: string): { ok: boolean; packRecordId?: string; message: string } {
    try {
      const result = versionId
        ? this.packManager.createEditingPack(sourcePackRecordId, undefined, versionId)
        : this.packManager.createEditingPack(sourcePackRecordId);
      this.persistPackManagerSnapshot();
      return {
        ok: true,
        packRecordId: result.pack.id,
        message: result.kind === 'existing' ? '已打开现有编辑态数据包。' : '已从普通态数据包创建编辑态副本。',
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  convertEditingPackToNormal(sourcePackRecordId: string): { ok: boolean; packRecordId?: string; message: string } {
    try {
      const converted = this.packManager.convertEditingPackToNormal(sourcePackRecordId);
      this.persistPackManagerSnapshot();
      return { ok: true, packRecordId: converted.id, message: '已复制为独立普通态记录。' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  createEmptyEditingPack(identity: { readonly modId: string; readonly versionId: string }): { ok: boolean; packRecordId?: string; message: string } {
    try {
      const result = this.packManager.createEmptyEditing(identity);
      this.persistPackManagerSnapshot();
      return { ok: true, packRecordId: result.pack.id, message: '已创建空编辑态数据包；当前选择与 Runtime 未改变。' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  clonePackAsEditing(sourcePackRecordId: string, targetIdentity?: { readonly modId: string; readonly versionId: string }): { ok: boolean; packRecordId?: string; message: string } {
    try {
      const result = this.packManager.cloneAsEditing(sourcePackRecordId, targetIdentity);
      this.persistPackManagerSnapshot();
      return { ok: true, packRecordId: result.pack.id, message: result.kind === 'existing' ? '目标编辑态数据包已存在；当前选择与 Runtime 未改变。' : '已复制为编辑态数据包；当前选择与 Runtime 未改变。' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  exportPackRecord(packRecordId: string, options: { readonly versionId?: string } = {}): { ok: boolean; pack?: StoredPack; message: string } {
    try {
      return { ok: true, pack: this.packManager.exportPack(packRecordId, options), message: '已生成普通态数据包导出快照。' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  getPackRecord(packRecordId: string): PackCatalogRecord | null {
    const pack = this.packManager.getPack(packRecordId);
    if (!pack) return null;
    return {
      packRecordId: pack.packRecordId ?? pack.id,
      editingMode: packEditingMode(pack),
      ...(pack.sourcePackRecordId ? { sourcePackRecordId: pack.sourcePackRecordId } : {}),
      manifest: {
        modName: pack.manifest.modName,
        name: pack.manifest.name,
        version: pack.manifest.version,
        ...(pack.manifest.author ? { author: pack.manifest.author } : {}),
        ...(pack.manifest.color ? { color: pack.manifest.color } : {}),
        dependencies: [...pack.manifest.dependencies],
      },
      datapack: cloneJson(pack.datapack),
    };
  }

  getRunningStoryPackId(modName: string): string | undefined {
    const datapack = this.activeDatapacks.find(pack => (pack.modName ?? 'base') === modName);
    if (!datapack) return undefined;
    if (this.storyOverlaySources.has(datapack)) return this.storyOverlaySources.get(datapack);
    return this.packManager.runtimeState().get(`${modName}@${datapack.version}`);
  }

  getStoryPackSources(source: StoryPackSource) {
    return structuredClone(this.resolveStoryPackSources(source));
  }

  private resolveStoryPackSources(source: StoryPackSource) {
    const root = this.packManager.getPack(source.packRecordId);
    const modName = root?.manifest.modName ?? source.modName;
    const issues: string[] = [];
    const datapacks: Datapack[] = [];
    const images: Pick<StoredPack, 'manifest' | 'images'>[] = [];
    const visited = new Set([modName]);
    const visit = (name: string): void => {
      if (visited.has(name)) return;
      visited.add(name);
      const active = this.activeDatapacks.find(pack => (pack.modName ?? 'base') === name);
      const candidates = this.packManager.listPacks().filter(pack => pack.manifest.modName === name);
      const selected = active
        ? candidates.find(pack => pack.id === this.getRunningStoryPackId(name))
        : candidates.length === 1 ? candidates[0] : undefined;
      if (!active && !selected) {
        issues.push(candidates.length ? `依赖 Mod「${name}」有多个本地来源，请先应用所需版本。` : `缺少依赖 Mod「${name}」。`);
        return;
      }
      for (const dependency of selected?.manifest.dependencies ?? []) visit(dependency);
      datapacks.push(active ?? selected!.datapack);
      if (selected) images.push({ manifest: selected.manifest, images: selected.images });
    };
    visit('base');
    for (const dependency of root?.manifest.dependencies ?? source.dependencies) visit(dependency);
    if (root) {
      datapacks.push(root.datapack);
      images.push({ manifest: root.manifest, images: root.images });
    }
    return { datapacks, issues, images };
  }

  getEditingPackDraft(packRecordId: string): RuntimeModDraft | null {
    const pack = this.packManager.getPack(packRecordId);
    if (!pack || packEditingMode(pack) !== 'editing') return null;
    return datapackToRuntimeModDraft(pack);
  }

  openEditingPack(packRecordId: string): RuntimeModApplyResult {
    const pack = this.packManager.getPack(packRecordId);
    if (!pack || packEditingMode(pack) !== 'editing') return { ok: false, message: '目标记录不存在，或不是编辑态数据包。' };
    const draft = datapackToRuntimeModDraft(pack);
    const previousTarget = this.runtimeEditorPackRecordId;
    const previousRuntimeMod = this.runtimeMod;
    try {
      const active = this.activeDatapacks.length ? this.activeDatapacks : this.packManager.enabledPacks();
      const overlay = cloneJson(pack.datapack);
      this.storyOverlaySources.set(overlay, packRecordId);
      const datapacks = replaceRuntimeDatapack(active, overlay, this.runtimeMod ? [this.runtimeMod.modName] : []);
      this.validatePackDatapacks(datapacks);
      this.reloadPreservingState(datapacks);
      this.runtimeMod = draft;
      this.runtimeEditorPackRecordId = packRecordId;
      this.runtimeContent.adoptRuntimeMod(
        draft.modName,
        draft.spots.map(spot => `${draft.modName}:spot:${spot.idName}`),
        draft.suspendedSpotIds ?? [],
      );
      this.runtimeWorldContent.adoptRuntimeMod(
        draft.modName,
        pack.datapack.inits.map(init => init.id),
        pack.datapack.areas.map(area => area.id),
        pack.datapack.areaMaps?.map(areaMap => areaMap.id) ?? [],
      );
      return { ok: true, message: `已打开编辑态数据包：${draft.displayName}。` };
    } catch (error) {
      this.runtimeMod = previousRuntimeMod;
      this.runtimeEditorPackRecordId = previousTarget;
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  getPackConfiguration(): PackConfigurationDraft {
    return this.packManager.configuration();
  }

  validatePackConfiguration(draft: PackConfigurationDraft): { ok: boolean; errors: readonly string[]; warnings: readonly string[] } {
    try {
      const registry = new Registry();
      for (const datapack of this.packManager.datapacksForConfiguration(draft)) registry.load(datapack);
      registry.validateAreaMapRefs();
      return { ok: true, errors: [], warnings: [] };
    } catch (error) {
      return { ok: false, errors: [error instanceof Error ? error.message : String(error)], warnings: [] };
    }
  }

  applyPackConfiguration(draft: PackConfigurationDraft): { ok: boolean; message: string; validation: { ok: boolean; errors: readonly string[]; warnings: readonly string[] } } {
    const validation = this.validatePackConfiguration(draft);
    if (!validation.ok) return { ok: false, message: validation.errors[0] ?? '数据包配置校验失败。', validation };
    try {
      this.packManager.applyConfiguration(draft, this.createPackApplyTarget());
      this.persistPackManagerSnapshot();
      return { ok: true, message: '数据包启用集已应用。', validation };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error), validation };
    }
  }

  setPackSelection(paneKey: string, selectedSlot: DatapackSelectionSlot): void {
    this.packManager.setSelectedSlot(paneKey, selectedSlot);
    this.persistPackManagerSnapshot();
  }

  applyPackSelection(): { ok: boolean; message: string; validation: { ok: boolean; errors: readonly string[]; warnings: readonly string[] }; plan?: import('../../data-services/datapack/pack-manager').RuntimeApplyPlan } {
    let plan: import('../../data-services/datapack/pack-manager').RuntimeApplyPlan;
    try {
      plan = this.packManager.buildRuntimeApplyPlan();
      const registry = new Registry();
      for (const entry of plan.entries) registry.load(this.packManager.getPack(entry.packRecordId)!.datapack);
      registry.validateAreaMapRefs();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message, validation: { ok: false, errors: [message], warnings: [] } };
    }
    const validation = { ok: true, errors: [], warnings: [] } as const;
    try {
      plan = this.packManager.applySelection(this.createPackApplyTarget());
      this.persistPackManagerSnapshot();
      this.runtimeMod = null;
      this.runtimeEditorPackRecordId = null;
      this.runtimeContent.reset();
      this.runtimeWorldContent.reset();
      return { ok: true, message: '已按 Pane 选择原子应用数据包。', validation, plan };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error), validation };
    }
  }

  /** 设置热 Spot 编辑会话使用的临时 Mod 元信息；不触发 Registry 或 Runtime 重载。 */
  setRuntimeModMetadata(metadata: Pick<RuntimeModDraft, 'modName' | 'displayName' | 'version' | 'author' | 'description'> & { readonly targetPackRecordId?: string }): RuntimeModApplyResult {
    const modName = metadata.modName.trim();
    const displayName = metadata.displayName.trim();
    if (!/^[a-z0-9-]+$/.test(modName)) return { ok: false, message: 'modName 只能包含小写字母、数字和连字符。' };
    if (!displayName) return { ok: false, message: '请填写 Mod 显示名称。' };
    const contentState = this.runtimeContent.getRuntimeModState();
    const worldState = this.runtimeWorldContent.getState();
    const currentModName = contentState.modName ?? worldState.modName;
    if (currentModName && currentModName !== modName) {
      return { ok: false, message: `当前已有临时 Mod：${currentModName}，请先删除后再创建其他 Mod。` };
    }
    const targetPackRecordId = metadata.targetPackRecordId ?? this.runtimeEditorPackRecordId;
    const targetPack = targetPackRecordId ? this.requireEditingPack(targetPackRecordId) : undefined;
    if (targetPack && (targetPack.manifest.modName !== modName || targetPack.manifest.version !== metadata.version.trim())) {
      return { ok: false, message: '编辑态数据包的 ModId 与版本不可在编辑器内修改；请复制为新的数据包记录。' };
    }
    if (!contentState.modName && !this.runtimeMod && !targetPack && this.registry.loadedModNames.has(modName)) {
      return { ok: false, message: `modName 已被当前运行时占用：${modName}` };
    }
    try {
      this.runtimeWorldContent.setModName(modName);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
    const current = this.runtimeMod;
    this.runtimeMod = {
      ...(current ?? {}),
      modName,
      displayName,
      version: metadata.version.trim(),
      author: metadata.author.trim(),
      description: metadata.description.trim(),
      spots: current?.spots ?? [],
      ...(targetPackRecordId ? { targetPackRecordId } : {}),
      ...(current?.suspendedSpotIds !== undefined ? { suspendedSpotIds: current.suspendedSpotIds } : {}),
    };
    if (targetPackRecordId) this.runtimeEditorPackRecordId = targetPackRecordId;
    const persisted = this.persistRuntimeEditingPack();
    if (!persisted.ok) return persisted;
    return { ok: true, message: `临时 Mod 元信息已保存：${displayName}。` };
  }

  /** 提交一个 Spot 内容 mutation；热路径只触及该 Spot 及其派生节点。 */
  applyRuntimeSpotMutation(mutation: RuntimeSpotMutation): RuntimeSpotMutationResult {
    const target = this.resolveRuntimeEditorTarget(mutation.targetPackRecordId);
    if (target.error) {
      return {
        ok: false,
        revision: this.runtimeContent.getRevision(),
        spotId: 'idName' in mutation ? mutation.idName : mutation.spot.idName,
        operation: mutation.operation,
        diagnostics: [{ code: target.error.code, message: target.error.message }],
        message: target.error.message,
      };
    }
    if (!this.runtimeMod && mutation.operation !== 'create') {
      return {
        ok: false,
        revision: this.runtimeContent.getRevision(),
        spotId: '',
        operation: mutation.operation,
        diagnostics: [{ code: 'spot-not-found', message: '当前没有可操作的临时 Mod Spot' }],
        message: '当前没有可操作的临时 Mod Spot',
      };
    }
    const result = this.runtimeContent.submit(mutation);
    if (!result.ok) return result;
    this.initService.reconcileInformationRevealWatches();
    this.syncRuntimeModFromContent();
    const persisted = this.persistRuntimeEditingPack();
    if (!persisted.ok) return { ...result, ok: false, message: persisted.message };
    if (result.operation === 'delete' && mutation.operation === 'delete' && mutation.playerData === 'purge') {
      this.mutations.purgeSpotData(result.spotId);
    }
    return result;
  }

  getRuntimeContentState(): RuntimeModStateSnapshot {
    return this.runtimeContent.getRuntimeModState();
  }

  getRuntimeWorldState(): RuntimeWorldStateSnapshot {
    return this.runtimeWorldContent.getState();
  }

  /** Init / Area 的局部热 Apply；不会调用 reloadPreservingState。 */
  applyRuntimeWorldDraft(draft: RuntimeWorldDraft): RuntimeWorldApplyResult {
    const target = this.resolveRuntimeEditorTarget(draft.targetPackRecordId);
    if (target.error) {
      return {
        ok: false,
        revision: this.runtimeWorldContent.getState().revision,
        diagnostics: [{ code: target.error.code, message: target.error.message }],
        message: target.error.message,
      };
    }
    const result = this.runtimeWorldContent.applyWorldDraft(draft);
    if (!result.ok) return result;
    this.initService.reconcileInformationRevealWatches();
    const current = this.runtimeMod;
    this.runtimeMod = {
      ...(current ?? {
        modName: draft.modName,
        displayName: draft.modName,
        version: '1.0.0',
        author: '',
        description: '',
        spots: [],
      }),
      modName: draft.modName,
      inits: draft.inits.map(init => ({ ...init, defaultAreas: [...init.defaultAreas] })),
      areas: draft.areas.map(area => ({
        ...area,
        defaultSpots: [...area.defaultSpots],
        ...(area.adjacentAreaIds ? { adjacentAreaIds: [...area.adjacentAreaIds] } : {}),
        ...(area.topology ? { topology: area.topology.map(item => ({ ...item })) } : {}),
      })),
      ...(draft.areaMaps !== undefined ? { areaMaps: draft.areaMaps.map(areaMap => structuredClone(areaMap)) } : current?.areaMaps ? { areaMaps: current.areaMaps.map(areaMap => structuredClone(areaMap)) } : {}),
      ...(this.runtimeEditorPackRecordId ? { targetPackRecordId: this.runtimeEditorPackRecordId } : {}),
    };
    const persisted = this.persistRuntimeEditingPack();
    if (!persisted.ok) return { ...result, ok: false, message: persisted.message };
    return result;
  }

  applyRuntimeMod(draft: RuntimeModDraft): RuntimeModApplyResult {
    try {
      const targetPackRecordId = draft.targetPackRecordId ?? this.runtimeEditorPackRecordId;
      const targetPack = targetPackRecordId ? this.requireEditingPack(targetPackRecordId) : undefined;
      if (targetPack && (targetPack.manifest.modName !== draft.modName || targetPack.manifest.version !== draft.version)) {
        throw new Error('编辑态数据包的 ModId 与版本不可在编辑器内修改；请复制为新的数据包记录。');
      }
      if (this.runtimeMod && this.runtimeMod.modName !== draft.modName) {
        throw new Error(`当前已有临时 Mod：${this.runtimeMod.modName}，请先删除后再创建其他 Mod。`);
      }
      if (!this.runtimeMod && !targetPack && this.registry.loadedModNames.has(draft.modName)) {
        throw new Error(`modName 已被当前运行时占用：${draft.modName}`);
      }
      const context = addDatapackValidationRefs(
        runtimeAuthoringValidationContext(this.registry),
        targetPack?.datapack,
      );
      const suspendedSpotIds = new Set(draft.suspendedSpotIds ?? []);
      const suspendedInitIds = new Set(draft.suspendedInitIds ?? []);
      const suspendedAreaIds = new Set(draft.suspendedAreaIds ?? []);
      const suspendedAreaMapIds = new Set(draft.suspendedAreaMapIds ?? []);
      const suspendedEnhancementIds = new Set(draft.suspendedEnhancementIds ?? []);
      const seenSpotIds = new Set<string>();
      const seenInitIds = new Set<string>();
      const seenAreaIds = new Set<string>();
      const seenAreaMapIds = new Set<string>();
      const seenEnhancementIds = new Set<string>();
      const spots: SpotDef[] = [];
      const inits: InitDef[] = [];
      const areas: AreaDef[] = [];
      const areaMaps: AreaMapDef[] = [];
      const enhancements: EnhancementDef[] = [];

      for (const draftSpot of draft.spots) {
        const {
          metadata: _metadata,
          unsupportedFunctionalityIds: _unsupportedFunctionalityIds,
          unsupportedPaymentOptionPaths: _unsupportedPaymentOptionPaths,
          ...authoringSpot
        } = draftSpot;
        const input = {
          ...authoringSpot,
          functionalities: authoringSpot.functionalities ?? [],
          levelUpgrades: authoringSpot.levelUpgrades ?? [],
          revealTriggers: authoringSpot.revealTriggers ?? [],
          tags: authoringSpot.tags ?? [],
          gachaPools: authoringSpot.gachaPools ?? [],
        };
        validateRuntimeDraftRecord(requireContentPolicy('spots'), input, context, seenSpotIds);
        if (!suspendedSpotIds.has(draftSpot.idName)) spots.push(buildAuthoringDef(requireContentPolicy('spots'), draft.modName, input) as SpotDef);
      }
      for (const draftInit of draft.inits ?? []) {
        const input = { ...draftInit, defaultAreas: draftInit.defaultAreas ?? [] };
        validateRuntimeDraftRecord(requireContentPolicy('inits'), input, context, seenInitIds);
        if (!suspendedInitIds.has(draftInit.idName)) inits.push(buildAuthoringDef(requireContentPolicy('inits'), draft.modName, input) as InitDef);
      }
      for (const draftArea of draft.areas ?? []) {
        const input = { ...draftArea, defaultSpots: draftArea.defaultSpots ?? [] };
        validateRuntimeDraftRecord(requireContentPolicy('areas'), input, context, seenAreaIds);
        if (!suspendedAreaIds.has(draftArea.idName)) areas.push(buildAuthoringDef(requireContentPolicy('areas'), draft.modName, input) as AreaDef);
      }
      for (const draftAreaMap of draft.areaMaps ?? []) {
        const input = { ...draftAreaMap };
        validateRuntimeDraftRecord(requireContentPolicy('areaMaps'), input, context, seenAreaMapIds);
        if (!suspendedAreaMapIds.has(draftAreaMap.idName)) areaMaps.push(buildAuthoringDef(requireContentPolicy('areaMaps'), draft.modName, input) as AreaMapDef);
      }
      for (const draftEnhancement of draft.enhancements ?? []) {
        const input = { ...draftEnhancement };
        validateRuntimeDraftRecord(requireContentPolicy('enhancements'), input, context, seenEnhancementIds);
        if (!suspendedEnhancementIds.has(draftEnhancement.idName)) enhancements.push(buildAuthoringDef(requireContentPolicy('enhancements'), draft.modName, input) as EnhancementDef);
      }
      const previousDatapack = targetPack?.datapack;
      const runtimePack: Datapack = {
        ...(previousDatapack ? cloneJson(previousDatapack) : {
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
        }),
        modName: draft.modName,
        name: draft.displayName,
        version: draft.version,
        inits: previousDatapack ? mergeAuthoringRecords(previousDatapack.inits, inits) : inits,
        areas: previousDatapack ? mergeAuthoringRecords(previousDatapack.areas, areas) : areas,
        areaMaps: draft.areaMaps === undefined ? previousDatapack?.areaMaps ?? []
          : previousDatapack ? mergeOwnedAuthoringRecords(previousDatapack.areaMaps ?? [], areaMaps, draft.modName, 'area-map') : areaMaps,
        spots: previousDatapack ? mergeAuthoringRecords(previousDatapack.spots, spots) : spots,
        enhancements: previousDatapack ? mergeAuthoringRecords(previousDatapack.enhancements, enhancements) : enhancements,
      };
      const active = this.activeDatapacks.length ? this.activeDatapacks : this.packManager.enabledPacks();
      const replacedModNames = this.runtimeMod ? [this.runtimeMod.modName] : [];
      const background = active.filter(datapack => datapack.modName !== draft.modName
        && (!datapack.modName || !replacedModNames.includes(datapack.modName)));
      this.storyOverlaySources.set(runtimePack, targetPackRecordId ?? undefined);
      const datapacks = replaceRuntimeDatapack(active, runtimePack, replacedModNames);
      const backgroundRegistry = new Registry();
      for (const datapack of background) backgroundRegistry.load(datapack);
      assertRuntimeDefinitionConflicts(backgroundRegistry, draft, this.runtimeMod);
      this.validatePackDatapacks(datapacks);
      this.reloadPreservingState(datapacks);
      this.runtimeMod = {
        ...draft,
        ...(targetPackRecordId ? { targetPackRecordId } : {}),
        spots: draft.spots.map(spot => ({ ...spot })),
        suspendedSpotIds: [...suspendedSpotIds].filter(id => seenSpotIds.has(id)),
        ...(draft.inits !== undefined ? { inits: draft.inits.map(init => ({ ...init, defaultAreas: [...init.defaultAreas] })) } : {}),
        ...(draft.areas !== undefined ? { areas: draft.areas.map(area => ({ ...area, defaultSpots: [...area.defaultSpots] })) } : {}),
        ...(draft.areaMaps !== undefined ? { areaMaps: draft.areaMaps.map(areaMap => structuredClone(areaMap)) } : {}),
        ...(draft.enhancements !== undefined ? { enhancements: draft.enhancements.map(enhancement => ({ ...enhancement })) } : {}),
        ...(draft.suspendedInitIds !== undefined || suspendedInitIds.size > 0 ? { suspendedInitIds: [...suspendedInitIds].filter(id => seenInitIds.has(id)) } : {}),
        ...(draft.suspendedAreaIds !== undefined || suspendedAreaIds.size > 0 ? { suspendedAreaIds: [...suspendedAreaIds].filter(id => seenAreaIds.has(id)) } : {}),
        ...(draft.suspendedAreaMapIds !== undefined || suspendedAreaMapIds.size > 0 ? { suspendedAreaMapIds: [...suspendedAreaMapIds].filter(id => seenAreaMapIds.has(id)) } : {}),
        ...(draft.suspendedEnhancementIds !== undefined || suspendedEnhancementIds.size > 0 ? { suspendedEnhancementIds: [...suspendedEnhancementIds].filter(id => seenEnhancementIds.has(id)) } : {}),
      };
      this.runtimeContent.adoptRuntimeMod(
        draft.modName,
        draft.spots.map(spot => `${draft.modName}:spot:${spot.idName}`),
        draft.suspendedSpotIds ?? [],
      );
      this.runtimeWorldContent.adoptRuntimeMod(
        draft.modName,
        inits.map(init => init.id),
        areas.map(area => area.id),
        areaMaps.map(areaMap => areaMap.id),
      );
      this.runtimeEditorPackRecordId = targetPackRecordId ?? null;
      const persisted = this.persistRuntimeEditingPack();
      if (!persisted.ok) return persisted;
      const activeCount = inits.length + areas.length + areaMaps.length + spots.length + enhancements.length;
      return { ok: true, message: `运行时 Mod 已载入：${draft.displayName}；已应用 ${activeCount} 条内容。` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  getRuntimeMod(): RuntimeModDraft | null {
    return this.runtimeMod;
  }

  override validateStoryAuthoring(patch: StoryAuthoringPatch, packRecordId?: string): StoryAuthoringResult {
    return packRecordId ? this.saveStoryAuthoringToPack(packRecordId, patch, true) : super.validateStoryAuthoring(patch);
  }

  override createStoryAuthoringPreview(patch: StoryAuthoringPatch, target: StoryAuthoringPreviewTarget, source?: StoryPackSource) {
    if (!source) return super.createStoryAuthoringPreview(patch, target);
    const content = this.resolveStoryPackSources(source);
    if (content.issues.length) return { ok: false as const, message: content.issues.join(' ') };
    return this.previewStoryWithContent(patch, target, content);
  }

  override applyStoryAuthoring(patch: StoryAuthoringPatch, packRecordId?: string): StoryAuthoringResult {
    try {
      this.requireRunningStoryPack(packRecordId, patch);
      return super.applyStoryAuthoring(patch);
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
  }

  override saveStoryDefinition(story: StoryDef, packRecordId?: string): StoryDefinitionSaveResult {
    try {
      this.requireRunningStoryPack(packRecordId, { ...emptyStoryAuthoring(), stories: [story] });
      return super.saveStoryDefinition(story);
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
  }

  override restoreStoryDefinition(storyId: string, packRecordId?: string): StoryDefinitionRestoreResult {
    try {
      const story = this.registry.stories.get(storyId);
      if (!story) throw new Error('当前游戏中找不到该 Story。');
      this.requireRunningStoryPack(packRecordId, { ...emptyStoryAuthoring(), stories: [story] });
      return super.restoreStoryDefinition(storyId);
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
  }

  private requireRunningStoryPack(packRecordId: string | undefined, patch: StoryAuthoringPatch): void {
    const pack = this.requireEditingPack(packRecordId ?? '');
    const mod = pack.manifest.modName;
    if (this.getRunningStoryPackId(mod) !== packRecordId) throw new Error('目标编辑态数据包当前未运行。可保存到包库，或应用该包后再更新当前游戏。');
    this.assertStoryPackOwnership(pack, patch);
    for (const table of STORY_AUTHORING_TABLES) {
      const active = this.activeDatapacks.find(item => (item.modName ?? 'base') === mod);
      for (const id of [...patch[table].map(row => row.id), ...(patch.removed?.[table] ?? [])]) {
        const exists = this.registry[table].has(id);
        const owner = table !== 'passivePools'
          ? this.registry.storyDirectoryContentOwner(id, table === 'stories' ? 'story' : 'entry') : undefined;
        const foreign = this.activeDatapacks.some(item => item !== active && (item[table] ?? []).some(row => row.id === id));
        if (exists && (foreign || owner && owner !== mod)) throw new Error(`当前运行内容 ${id} 属于其他 Mod。`);
      }
    }
  }

  private assertStoryPackOwnership(pack: StoredPack, patch: StoryAuthoringPatch): void {
    for (const table of STORY_AUTHORING_TABLES) {
      const rows = pack.datapack[table] ?? [];
      for (const row of patch[table]) {
        if (!row.id.startsWith(`${pack.manifest.modName}:`) && !rows.some(item => item.id === row.id)) {
          throw new Error(`目标包不拥有 ${row.id}；请先另存为目标命名空间的身份。`);
        }
      }
      for (const id of patch.removed?.[table] ?? []) {
        if (!rows.some(item => item.id === id)) throw new Error(`目标包不拥有待删除内容 ${id}`);
      }
    }
  }

  private validateStoryPackCandidate(pack: StoredPack, datapack: Datapack, patch?: StoryAuthoringPatch): void {
    const { datapacks, issues } = this.resolveStoryPackSources({
      packRecordId: pack.id, modName: pack.manifest.modName, dependencies: pack.manifest.dependencies,
    });
    if (issues.length) throw new Error(issues.join(' '));
    const registry = this.validatePackDatapacks(replaceRuntimeDatapack(datapacks, datapack));
    if (patch) {
      for (const foreign of datapacks) {
        if (foreign.modName === datapack.modName) continue;
        for (const table of STORY_AUTHORING_TABLES) for (const row of patch[table]) {
          if ((foreign[table] ?? []).some(existing => existing.id === row.id) && !(pack.datapack[table] ?? []).some(existing => existing.id === row.id)) {
            throw new Error(`目标包不能覆盖其他 Mod 的内容：${row.id}`);
          }
        }
      }
      registry.saveStoryAuthoring(patch, true);
    }
  }

  saveStoryAuthoringToPack(packRecordId: string, patch: StoryAuthoringPatch, checkOnly = false): StoryAuthoringResult {
    try {
      const pack = this.requireEditingPack(packRecordId);
      validateStoryAuthoringShape(patch);
      this.assertStoryPackOwnership(pack, patch);
      const datapack = patchStoryDatapack(pack.datapack, patch);
      this.validateStoryPackCandidate(pack, datapack, patch);
      if (checkOnly) return { ok: true, message: '作者内容和目标 Mod 的目录位置校验通过。' };
      this.packManager.savePack({ ...pack, datapack, contentDigest: undefined });
      this.persistPackManagerSnapshot();
      return { ok: true, message: '已保存到编辑态数据包；重新载入该包后生效。可从包管理导出。' };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
  }

  saveStoryDirectoryToPack(packRecordId: string, directory: StoryDirectoryDef | readonly StoryDirectoryDef[], remove = false): StoryAuthoringResult {
    try {
      const pack = this.requireEditingPack(packRecordId);
      const updates = 'id' in directory ? [directory] : directory;
      const current = new Map((pack.datapack.storyDirectories ?? []).map(row => [row.id, row]));
      if (!updates.length || new Set(updates.map(row => row.id)).size !== updates.length) throw new Error('目录提交不能为空或包含重复目录。');
      for (const update of updates) {
        const existing = current.get(update.id);
        if (existing && (existing.initId !== update.initId || existing.characterId !== update.characterId)) throw new Error('目录身份和 Init 在建立后固定。');
        if (remove) {
          if (!existing) throw new Error('所选编辑态 Mod 没有这条目录配置。');
        }
        if (remove || existing?.acceptExternalEntries && !update.acceptExternalEntries) {
          for (const source of this.packManager.listPacks()) {
            const own = source.id === pack.id;
            if (own ? !remove || existing?.characterId : source.manifest.modName === pack.manifest.modName) continue;
            const reference = storyDirectoryReferences(update.id, source.datapack)[0];
            if (reference) throw new Error(`目录仍被引用：${source.manifest.name} · ${reference.title}（${reference.id}）。`);
          }
          const runtimeReference = storyDirectoryReferences(update.id, {
            stories: [...this.registry.stories.values()].filter(row => this.registry.storyDirectoryContentOwner(row.id, 'story') !== pack.manifest.modName),
            activeStories: [...this.registry.activeStories.values()].filter(row => this.registry.storyDirectoryContentOwner(row.id) !== pack.manifest.modName),
            passiveStories: [...this.registry.passiveStories.values()].filter(row => this.registry.storyDirectoryContentOwner(row.id) !== pack.manifest.modName),
          })[0];
          if (runtimeReference) throw new Error(`当前运行内容仍引用此目录：${runtimeReference.title}（${runtimeReference.id}）。`);
        }
        if (remove) current.delete(update.id);
        else current.set(update.id, structuredClone(update));
      }
      const datapack = { ...pack.datapack, storyDirectories: [...current.values()] };
      this.validateStoryPackCandidate(pack, datapack);
      this.packManager.savePack({ ...pack, datapack, contentDigest: undefined });
      this.persistPackManagerSnapshot();
      return { ok: true, message: '目录配置已保存到编辑态 Mod，重新载入该包后对玩家生效。' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  renameStoryInPack(packRecordId: string, change: StoryIdentityChange): StoryAuthoringResult {
    try {
      const pack = this.requireEditingPack(packRecordId);
      if (!change.expectedDigest || change.expectedDigest !== (pack.contentDigest ?? storedPackContentDigest(pack))) throw new Error('目标 Mod 已变化，请重新打开更改 ID 对话框。');
      if (!pack.datapack.stories?.some(story=>story.id===change.fromId)) throw new Error('目标 Mod 不拥有原 Story。');
      if (this.registry.stories.has(change.toId)) throw new Error(`Story ID 已存在：${change.toId}`);
      for (const table of STORY_AUTHORING_TABLES) {
        for (const row of change.patch[table]) if (!(pack.datapack[table] ?? []).some(item=>item.id===row.id)) throw new Error(`改名不能顺带创建内容：${row.id}`);
        if (change.patch.removed?.[table]?.length) throw new Error('改名不能顺带删除其他内容。');
      }
      for (const other of this.packManager.listPacks()) {
        if (other.id!==pack.id && other.datapack.stories?.some(story=>story.id===change.toId)) throw new Error(`Story ID 已存在于其他包：${change.toId}`);
        if ((other.datapack.modName ?? other.manifest.modName) === pack.datapack.modName) continue;
        const reference = packStoryIdentityReferences(other.datapack,change.fromId)[0];
        if (reference) throw new Error(`其他 Mod 仍引用此 Story：${other.manifest.modName} / ${reference.id} ${reference.path}`);
      }
      const {datapack} = planStoryIdentityChange(pack.datapack,change.patch,change.fromId,change.toId);
      this.validateStoryPackCandidate(pack, datapack);
      this.packManager.savePack({...pack,datapack,contentDigest:undefined});
      this.persistPackManagerSnapshot();
      return {ok:true,message:'Story ID 与引用已保存到编辑态 Mod；重新载入该包后生效。'};
    } catch (error) { return {ok:false,message:error instanceof Error ? error.message : String(error)}; }
  }

  private requireEditingPack(packRecordId: string): StoredPack {
    const pack = this.packManager.getPack(packRecordId);
    if (!pack) throw new Error(`目标数据包记录不存在：${packRecordId}`);
    if (packEditingMode(pack) !== 'editing') throw new Error('新建或修改内容必须指定编辑态数据包。');
    return pack;
  }

  private resolveRuntimeEditorTarget(packRecordId?: string): { pack?: StoredPack; error?: { code: 'target-datapack-required' | 'target-must-be-editing'; message: string } } {
    const targetId = packRecordId ?? this.runtimeEditorPackRecordId;
    if (!targetId) return {};
    const pack = this.packManager.getPack(targetId);
    if (!pack) return { error: { code: 'target-datapack-required', message: `指定的编辑态数据包不存在：${targetId}` } };
    if (packEditingMode(pack) !== 'editing') return { error: { code: 'target-must-be-editing', message: '新建或修改内容必须指定编辑态数据包。' } };
    this.runtimeEditorPackRecordId = targetId;
    return { pack };
  }

  private persistRuntimeEditingPack(): RuntimeModApplyResult {
    const targetId = this.runtimeEditorPackRecordId;
    const draft = this.runtimeMod;
    if (!targetId || !draft) return { ok: true, message: '' };
    try {
      const existing = this.requireEditingPack(targetId);
      const datapack = runtimeModToDatapack(draft, existing.datapack, this.registry);
      this.packManager.savePack({
        ...existing,
        manifest: {
          ...existing.manifest,
          name: draft.displayName,
          author: draft.author || existing.manifest.author,
        },
        datapack,
        contentDigest: undefined,
      });
      this.persistPackManagerSnapshot();
      return { ok: true, message: '' };
    } catch (error) {
      return { ok: false, message: `编辑态数据包保存失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private syncRuntimeModFromContent(): void {
    const state = this.runtimeContent.getRuntimeModState();
    if (!state.modName) {
      this.runtimeMod = null;
      this.runtimeEditorPackRecordId = null;
      return;
    }
    const current = this.runtimeMod;
    this.runtimeMod = {
      ...(current ?? {}),
      modName: state.modName,
      displayName: current?.displayName ?? state.modName,
      version: current?.version ?? '1.0.0',
      author: current?.author ?? '',
      description: current?.description ?? '',
      spots: [...state.spots.values()].map(spot => ({
        idName: spot.id.split(':').slice(2).join(':'),
        areaId: spot.areaId,
        name: spot.name,
        description: spot.description,
        ...(spot.maxLevel !== undefined ? { maxLevel: spot.maxLevel } : {}),
        ...(spot.conditionText ? { conditionText: spot.conditionText } : {}),
        ...(spot.global ? { global: spot.global } : {}),
        ...decodeSpotContent(spot),
      })),
      suspendedSpotIds: [...state.suspendedSpotIds].map(id => id.split(':').slice(2).join(':')),
    };
  }

  removeRuntimeSpotData(spotId: string): RuntimeModApplyResult {
    if (!this.runtimeMod) return { ok: false, message: '当前没有可清理的临时 Mod。' };
    try {
      const saved = this.save();
      delete saved.playerState.spotLevels[spotId];
      delete saved.playerState.spotManagers[spotId];
      for (const snapshot of Object.values(saved.playerState.initSnapshots ?? {})) {
        delete snapshot.spotLevels[spotId];
        delete snapshot.spotManagers[spotId];
      }
      if (saved.playerState.spotTagOverrides) delete saved.playerState.spotTagOverrides[spotId];
      this.load(saved);
      return { ok: true, message: `已清理 Spot 对应 PlayerData：${spotId}。` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  removeRuntimeMod(preservePlayerData = true): RuntimeModApplyResult {
    if (!this.runtimeMod) return { ok: false, message: '当前没有可删除的临时 Mod。' };
    try {
      const modName = this.runtimeMod.modName;
      const background = (this.activeDatapacks.length ? this.activeDatapacks : this.packManager.enabledPacks())
        .filter(datapack => datapack.modName !== modName);
      const saved = this.save();
      if (!preservePlayerData) {
        for (const draftSpot of this.runtimeMod.spots) {
          const spotId = `${modName}:spot:${draftSpot.idName}`;
          delete saved.playerState.spotLevels[spotId];
          delete saved.playerState.spotManagers[spotId];
          for (const snapshot of Object.values(saved.playerState.initSnapshots ?? {})) {
            delete snapshot.spotLevels[spotId];
            delete snapshot.spotManagers[spotId];
          }
          if (saved.playerState.spotTagOverrides) delete saved.playerState.spotTagOverrides[spotId];
        }
      }
      this.reload([...background], { enterDefaultInit: false });
      this.load(saved);
      this.runtimeMod = null;
      this.runtimeEditorPackRecordId = null;
      this.runtimeContent.reset();
      this.runtimeWorldContent.reset();
      return { ok: true, message: preservePlayerData ? `临时 Mod 已删除，PlayerData 已保留：${modName}。` : `临时 Mod 与对应 PlayerData 已删除：${modName}。` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  setPackEnabled(id: string, enabled: boolean): void {
    this.packManager.setEnabled(id, enabled);
    this.applyEnabledPacks();
    this.persistPackManagerSnapshot();
  }

  reorderPacks(ids: readonly string[]): void {
    this.packManager.reorder(ids);
    this.applyEnabledPacks();
    this.persistPackManagerSnapshot();
  }

  removePack(id: string, options: { readonly editorDirty?: boolean } = {}): void {
    const pack = this.packManager.getPack(id);
    if (!pack) throw new PackManagerError('不存在的数据包：' + id);
    if (pack.sourceKind === 'builtin' || pack.sourceKind === 'bundle') throw new PackManagerError('发布基础包不可从包库移除：' + id);
    if (options.editorDirty) {
      throw new PackManagerError('该编辑态存在未保存修改；请先放弃编辑或保存后再删除。', 'editor-dirty');
    }
    if ([...this.packManager.runtimeState().values()].includes(pack.packRecordId ?? pack.id)) {
      throw new PackManagerError('请先将该数据包移出启用集并应用；当前 Runtime 正在使用该数据包，请先切换选择并 Apply 后再删除。', 'datapack-in-use');
    }
    if (this.packManager.snapshot().enabledIds.includes(id)) {
      throw new PackManagerError('请先将该数据包移出启用集并应用，再移除。');
    }
    this.packManager.removePack(id);
    this.persistPackManagerSnapshot();
  }

  async restorePackManager(store: AsyncPackSnapshotStore): Promise<void> {
    this.packAsyncStore = store;
    const snapshot = await store.load();
    if (snapshot) {
      this.packManager = new PackManager(
        snapshot,
        undefined,
        [createBundledBasePack(), createBundledGameplayBMapPack()],
        ['gameplay-b@1.0.0'],
        ['gameplay-b-strategy-park@1.0.0'],
      );
      await store.save(this.packManager.snapshot());
    }
  }

  reconcileDevelopmentPacks(packs: readonly StoredPack[]): void {
    this.packManager.reconcileDevelopmentPacks(packs);
    this.persistPackManagerSnapshot();
  }

  async savePackManager(store: AsyncPackSnapshotStore): Promise<void> {
    this.packAsyncStore = store;
    await store.save(this.packManager.snapshot());
  }

  private persistPackManagerSnapshot(): void {
    void this.packAsyncStore?.save(this.packManager.snapshot()).catch(error => {
      this.devLog.record(`包库快照保存失败：${error instanceof Error ? error.message : String(error)}`, { source: 'datapack', level: 'error' });
    });
  }

  private validatePackDatapacks(datapacks: readonly Datapack[]): Registry {
    const registry = new Registry();
    for (const datapack of datapacks) registry.load(datapack);
    registry.validateAreaMapRefs();
    return registry;
  }

  private createPackApplyTarget(): {
    validate: (datapacks: readonly Datapack[]) => void;
    capture: () => unknown;
    restore: (snapshot: unknown) => void;
    reload: (datapacks: readonly Datapack[]) => void;
    clearImages: () => void;
    registerImages: (modName: string, images: readonly { path: string; url: string }[]) => void;
  } {
    const shouldEnterDefaultInit = Boolean(this.state.activeInit);
    return {
      validate: datapacks => this.validatePackDatapacks(datapacks),
      capture: () => ({
        datapacks: [...this.activeDatapacks],
        saveData: this.state ? this.save() : null,
      }),
      restore: snapshot => {
        const checkpoint = snapshot as { readonly datapacks?: readonly Datapack[]; readonly saveData?: ReturnType<GameInstance['save']> | null };
        const datapacks = checkpoint.datapacks ?? [];
        if (datapacks.length > 0) this.reload([...datapacks], { enterDefaultInit: false });
        else this.imageStore.clear();
        if (checkpoint.saveData) this.load(checkpoint.saveData);
      },
      reload: datapacks => {
        const progress = retainStoryDirectoryProgress(this.registry, this.state);
        this.reload([...datapacks], { enterDefaultInit: shouldEnterDefaultInit });
        if (progress) this.mutations.retainStoryDirectoryProgress(progress);
      },
      clearImages: () => this.imageStore.clear(),
      registerImages: (modName, images) => this.pics.register(modName, images),
    };
  }
}

function runtimeAuthoringValidationContext(registry: Registry): AuthoringValidationContext {
  return {
    resourceIds: new Set(registry.resourceDisplays.keys()),
    itemIds: new Set(registry.items.keys()),
    gachaPoolIds: new Set(registry.gachaPools.keys()),
    shopIds: new Set(registry.shops.keys()),
  };
}

/**
 * 已存在数据包中的引用即使暂未被 Registry 注册，也必须允许原样回流；
 * 编辑器只对新增或实际替换的字段做能力校验，不能因未开放表阻断整包编辑。
 */
function addDatapackValidationRefs(context: AuthoringValidationContext, datapack?: Datapack): AuthoringValidationContext {
  if (!datapack) return context;
  const resourceIds = new Set(context.resourceIds ?? []);
  const itemIds = new Set(context.itemIds ?? []);
  const gachaPoolIds = new Set(context.gachaPoolIds ?? []);
  const shopIds = new Set(context.shopIds ?? []);
  for (const resource of datapack.resourceDisplays ?? []) resourceIds.add(resource.resourceId);
  for (const item of datapack.items ?? []) itemIds.add(item.id);
  for (const pool of datapack.gachaPools ?? []) gachaPoolIds.add(pool.id);
  for (const shop of datapack.shops ?? []) shopIds.add(shop.id);
  for (const spot of datapack.spots) {
    for (const poolId of spot.gachaPools ?? []) gachaPoolIds.add(poolId);
  }
  return { ...context, resourceIds, itemIds, gachaPoolIds, shopIds };
}

function validateRuntimeDraftRecord(
  policy: ContentAuthoringPolicy,
  input: object,
  context: AuthoringValidationContext,
  seenIds: Set<string>,
): void {
  const raw = input as Record<string, unknown>;
  const idName = typeof raw.idName === 'string' ? raw.idName : '';
  if (seenIds.has(idName)) throw new Error(`临时 Mod 中存在重复 ${policy.label} ID：${idName}`);
  seenIds.add(idName);
  const issue = validateAuthoringInput(policy, input, context);
  if (issue) throw new Error(`${policy.label}「${idName || '未命名'}」：${issue.message}`);
}

function assertRuntimeDefinitionConflicts(
  registry: Registry,
  draft: RuntimeModDraft,
  previous: RuntimeModDraft | null,
): void {
  const check = (
    label: string,
    type: string,
    table: ReadonlyMap<string, unknown>,
    records: readonly { idName: string }[],
    previousRecords: readonly { idName: string }[],
  ): void => {
    const previousIds = new Set(previousRecords.map(record => `${draft.modName}:${type}:${record.idName}`));
    for (const record of records) {
      const fullId = `${draft.modName}:${type}:${record.idName}`;
      if (table.has(fullId) && !previousIds.has(fullId)) {
        throw new Error(`${label} ID 已被当前运行时占用：${fullId}`);
      }
    }
  };
  check('Init', 'init', registry.inits, draft.inits ?? [], previous?.inits ?? []);
  check('Area', 'area', registry.areas, draft.areas ?? [], previous?.areas ?? []);
  check('Spot', 'spot', registry.spots, draft.spots, previous?.spots ?? []);
  check('Enhancement', 'enhancement', registry.enhancements, draft.enhancements ?? [], previous?.enhancements ?? []);
}

function createBundledBasePack(): StoredPack {
  const id = `${bundledBaseManifest.modName}@${bundledBaseManifest.version}`;
  return {
    id,
    manifest: {
      ...bundledBaseManifest,
    },
    datapack: defaultDatapack,
    images: [],
    sourceKind: 'bundle',
    importedAt: 0,
  };
}

function createBundledGameplayBMapPack(): StoredPack {
  return {
    id: 'gameplay-b@1.0.0',
    packRecordId: 'gameplay-b@1.0.0',
    manifest: {
      modName: gameplayBMapDatapack.modName!,
      name: gameplayBMapDatapack.name,
      version: gameplayBMapDatapack.version,
      author: 'AronaClicker',
      dependencies: ['base'],
    },
    datapack: gameplayBMapDatapack,
    images: [],
    sourceKind: 'bundle',
    importedAt: 0,
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localDefinitionId(id: string, modName: string, type: string): string {
  const prefix = `${modName}:${type}:`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id.split(':').slice(2).join(':');
}

function tagDraft(tags: readonly string[][] | undefined): string[] | undefined {
  return tags?.map(tag => tag.join('/'));
}

function revealDraft(reveals: readonly { readonly reveal: RuntimeSpotRevealTriggerDraft['reveal']; readonly condition?: unknown }[] | undefined): RuntimeSpotRevealTriggerDraft[] | undefined {
  if (!reveals) return undefined;
  return reveals.map(item => ({
    reveal: item.reveal,
    ...(item.condition && typeof item.condition === 'object' && 'conditions' in item.condition ? { condition: item.condition as RuntimeSpotRevealTriggerDraft['condition'] } : {}),
  }));
}

function numericResourceDraft(costs: readonly { readonly resourceId: string; readonly amount: unknown }[] | undefined): RuntimeInitDraft['purchaseCost'] | undefined {
  if (!costs) return undefined;
  const result = costs.flatMap(cost => typeof cost.amount === 'number' && Number.isFinite(cost.amount)
    ? [{ resourceId: cost.resourceId, amount: cost.amount }]
    : []);
  return result.length === costs.length ? result : undefined;
}

function datapackToRuntimeModDraft(pack: StoredPack): RuntimeModDraft {
  const datapack = pack.datapack;
  const modName = datapack.modName ?? pack.manifest.modName;
  return {
    targetPackRecordId: pack.packRecordId ?? pack.id,
    modName,
    displayName: datapack.name || pack.manifest.name,
    version: datapack.version || pack.manifest.version,
    author: pack.manifest.author ?? '',
    description: '',
    spots: datapack.spots.map(spot => ({
      idName: localDefinitionId(spot.id, modName, 'spot'),
      metadata: spot.metadata,
      areaId: spot.areaId,
      name: spot.name,
      description: spot.description,
      ...(spot.maxLevel !== undefined ? { maxLevel: spot.maxLevel } : {}),
      ...(spot.conditionText !== undefined ? { conditionText: spot.conditionText } : {}),
      ...(spot.global !== undefined ? { global: spot.global } : {}),
      ...decodeSpotContent(spot),
    })),
    inits: datapack.inits.map(init => ({
      idName: localDefinitionId(init.id, modName, 'init'),
      name: init.name,
      description: init.description,
      defaultAreas: [...init.defaultAreas],
      ...(init.startStoryId ? { startStoryId: init.startStoryId } : {}),
      ...(numericResourceDraft(init.purchaseCost) ? { purchaseCost: numericResourceDraft(init.purchaseCost) } : {}),
      ...(init.worldTilt !== undefined ? { worldTilt: init.worldTilt } : {}),
      ...(init.worldTiltAlias !== undefined ? { worldTiltAlias: init.worldTiltAlias } : {}),
      ...(tagDraft(init.tags) ? { tags: tagDraft(init.tags) } : {}),
      ...(revealDraft(init.revealTriggers) ? { revealTriggers: revealDraft(init.revealTriggers) } : {}),
    })),
    areas: datapack.areas.map(area => ({
      idName: localDefinitionId(area.id, modName, 'area'),
      initId: area.initId,
      name: area.name,
      description: area.description,
      defaultSpots: [...area.defaultSpots],
      ...(area.navigationMapId ? { navigationMapId: area.navigationMapId } : {}),
      ...(area.quickPassage !== undefined ? { quickPassage: area.quickPassage } : {}),
      ...(area.adjacentAreaIds ? { adjacentAreaIds: [...area.adjacentAreaIds] } : {}),
      ...(area.adjacentAreaIds ? { topology: area.adjacentAreaIds.map(areaId => ({ areaId, type: 'oneWay' as const })) } : {}),
      ...(tagDraft(area.tags) ? { tags: tagDraft(area.tags) } : {}),
      ...(area.reveal ? { reveal: cloneJson(area.reveal) } : {}),
      ...(area.enterCondition ? { enterCondition: cloneJson(area.enterCondition) } : {}),
      ...(area.onVisitReveal ? { onVisitReveal: [...area.onVisitReveal] } : {}),
    })),
    areaMaps: (datapack.areaMaps ?? []).map(areaMap => ({
      idName: localDefinitionId(areaMap.id, modName, 'area-map'),
      name: areaMap.name,
      ...(areaMap.description !== undefined ? { description: areaMap.description } : {}),
      ...(areaMap.reveal ? { reveal: cloneJson(areaMap.reveal) } : {}),
      ...(areaMap.openCondition ? { openCondition: cloneJson(areaMap.openCondition) } : {}),
      ...(areaMap.collection ? { collection: areaMap.collection } : {}),
      nodes: cloneJson(areaMap.nodes), edges: cloneJson(areaMap.edges),
    })),
    enhancements: datapack.enhancements.map(enhancement => ({
      idName: localDefinitionId(enhancement.id, modName, 'enhancement'),
      name: enhancement.name,
      description: enhancement.description,
      autoApply: enhancement.autoApply,
      ...(enhancement.maxStacks !== undefined ? { maxStacks: enhancement.maxStacks } : {}),
      ...(enhancement.irreversible !== undefined ? { irreversible: enhancement.irreversible } : {}),
      ...(enhancement.attachment ? { attachment: cloneJson(enhancement.attachment) } : {}),
      ...(numericResourceDraft(enhancement.price) ? { price: numericResourceDraft(enhancement.price) } : {}),
      ...(tagDraft(enhancement.tags) ? { tags: tagDraft(enhancement.tags) } : {}),
      ...(revealDraft(enhancement.revealTriggers) ? { revealTriggers: revealDraft(enhancement.revealTriggers) } : {}),
    })),
  };
}

function mergeAuthoringRecords<T extends { id: string }>(
  previous: readonly T[],
  next: readonly T[],
): T[] {
  const byId = new Map(previous.map(record => [record.id, record]));
  return next.map(record => ({ ...(byId.get(record.id) ?? {}), ...record } as T));
}

function mergeOwnedAuthoringRecords<T extends { id: string }>(previous: readonly T[], next: readonly T[], modName: string, type: string): T[] {
  const owned = `${modName}:${type}:`;
  const kept = previous.filter(record => !record.id.startsWith(owned));
  const replacements = mergeAuthoringRecords(previous.filter(record => record.id.startsWith(owned)), next);
  return [...kept, ...replacements];
}

function runtimeModToDatapack(draft: RuntimeModDraft, previous: Datapack, registry: Registry): Datapack {
  const context = addDatapackValidationRefs(runtimeAuthoringValidationContext(registry), previous);
  const active = <T extends { idName: string }>(records: readonly T[], suspended: readonly string[] | undefined): T[] => {
    const ignored = new Set(suspended ?? []);
    return records.filter(record => !ignored.has(record.idName));
  };
  const spots = active(draft.spots, draft.suspendedSpotIds).map(spot => {
    const { metadata: _metadata, unsupportedFunctionalityIds: _unsupportedFunctionalityIds, unsupportedPaymentOptionPaths: _unsupportedPaymentOptionPaths, ...input } = spot;
    const built = buildAuthoringDef(requireContentPolicy('spots'), draft.modName, {
      ...input,
      functionalities: input.functionalities ?? [],
      levelUpgrades: input.levelUpgrades ?? [],
      revealTriggers: input.revealTriggers ?? [],
      tags: input.tags ?? [],
      gachaPools: input.gachaPools ?? [],
    }) as SpotDef;
    validateAuthoringInput(requireContentPolicy('spots'), { ...input, functionalities: input.functionalities ?? [], levelUpgrades: input.levelUpgrades ?? [], revealTriggers: input.revealTriggers ?? [], tags: input.tags ?? [], gachaPools: input.gachaPools ?? [] }, context);
    return built;
  });
  const inits = draft.inits === undefined ? previous.inits : active(draft.inits, draft.suspendedInitIds).map(init => buildAuthoringDef(requireContentPolicy('inits'), draft.modName, init) as InitDef);
  const areas = draft.areas === undefined ? previous.areas : active(draft.areas, draft.suspendedAreaIds).map(area => buildAuthoringDef(requireContentPolicy('areas'), draft.modName, area) as AreaDef);
  const areaMaps = draft.areaMaps === undefined ? previous.areaMaps ?? [] : active(draft.areaMaps, draft.suspendedAreaMapIds).map(areaMap => {
    const policy = requireContentPolicy('areaMaps');
    validateAuthoringInput(policy, areaMap, context);
    return buildAuthoringDef(policy, draft.modName, areaMap) as AreaMapDef;
  });
  const enhancements = draft.enhancements === undefined ? previous.enhancements : active(draft.enhancements, draft.suspendedEnhancementIds).map(enhancement => buildAuthoringDef(requireContentPolicy('enhancements'), draft.modName, enhancement) as EnhancementDef);
  return {
    ...cloneJson(previous),
    modName: draft.modName,
    name: draft.displayName,
    version: draft.version,
    spots: mergeAuthoringRecords(previous.spots, spots),
    inits: mergeAuthoringRecords(previous.inits, inits),
    areas: mergeAuthoringRecords(previous.areas, areas),
    areaMaps: draft.areaMaps === undefined ? previous.areaMaps ?? [] : mergeOwnedAuthoringRecords(previous.areaMaps ?? [], areaMaps, draft.modName, 'area-map'),
    enhancements: mergeAuthoringRecords(previous.enhancements, enhancements),
  };
}

export type { SaveData } from '../contracts/runtime/save-data';
