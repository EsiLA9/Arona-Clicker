import { GameInstance } from './runtime-game-instance';
import { buildSaveData } from './runtime-save-codec';
import type { GameInstanceOptions } from './runtime-options';
import { PackManager, PackManagerError, type PackConfigurationDraft, type StoredPack } from '../data-services/datapack/pack-manager';
import type { ParsedPack } from '../data-services/datapack/pack-parser';
import type { AsyncPackSnapshotStore, PackSnapshotStore } from '../data-services/datapack/pack-storage';
import { Registry } from '../data-services/registry/registry';
import { buildAuthoringDef, requireContentPolicy, validateAuthoringInput } from '../data-services/authoring/content-policy';
import type { AuthoringValidationContext, ContentAuthoringPolicy } from '../data-services/authoring/content-policy';
import { defaultDatapack } from './content/default-datapack';
import type { PackCatalogCommands, PackCatalogDependencyHint, PackCatalogEntry, PackCatalogReadModel, RuntimeAreaDraft, RuntimeEnhancementDraft, RuntimeInitDraft, RuntimeModDraft, RuntimeModApplyResult } from './contracts';
import type { Datapack } from '../data-services/contracts/datapack';
import type { AreaDef, InitDef, SpotDef } from '../data-services/contracts/world';
import type { EnhancementDef } from '../data-services/contracts/enhancement';
import { RuntimeContentCoordinator } from './services/runtime-content-coordinator';
import { RuntimeWorldContentCoordinator } from './services/runtime-world-content-coordinator';
import { RuntimeDefinitionEditor, SpotContentService } from './services/spot-content-service';
import type { RuntimeModStateSnapshot, RuntimeSpotMutation, RuntimeSpotMutationResult, RuntimeWorldApplyResult, RuntimeWorldDraft, RuntimeWorldStateSnapshot } from './contracts/runtime-content';
import { decodeSpotContent } from '../data-services/authoring/content-policy-dsl';

export interface AronaClickerRuntimeOptions extends GameInstanceOptions {
  packStore?: PackSnapshotStore;
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
  private runtimeMod: RuntimeModDraft | null = null;
  private readonly runtimeContent: RuntimeContentCoordinator;
  private readonly runtimeWorldContent: RuntimeWorldContentCoordinator;
  readonly runtimeDefinitionEditor: RuntimeDefinitionEditor;

  constructor(options: AronaClickerRuntimeOptions = {}) {
    super({ ...options, saveCodec: options.saveCodec ?? buildSaveData });
    this.packManager = new PackManager(undefined, options.packStore, [createBuiltinBasePack()]);
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
        this.initService.reconcileAfterWorldDefinitionChange();
        for (const initId of commit.changedInitIds) {
          this.eventBus.emit({ type: 'initDefinitionChanged', initId });
        }
        for (const areaId of commit.changedAreaIds) {
          this.eventBus.emit({ type: 'areaDefinitionChanged', areaId });
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
      applyMutation: mutation => this.applyRuntimeSpotMutation(mutation),
    });
  }

  override init(datapacks: Datapack[], options = {}): void {
    this.activeDatapacks = [...datapacks];
    super.init(datapacks, options);
    this.runtimeWorldContent.reset();
  }

  registerParsedPack(parsed: ParsedPack, id = parsed.manifest.modName + '@' + parsed.manifest.version): void {
    const stored: StoredPack = {
      id,
      manifest: parsed.manifest,
      datapack: parsed.datapack,
      images: parsed.images,
      sourceKind: 'zip',
      importedAt: Date.now(),
    };
    this.packManager.importPack(stored);
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
    this.runtimeContent.reset();
    this.runtimeWorldContent.reset();
  }

  getPackCatalog(): { entries: readonly PackCatalogEntry[]; dependencies: readonly PackCatalogDependencyHint[] } {
    const enabled = new Set(this.packManager.snapshot().enabledIds);
    return {
      entries: this.packManager.listPacks().map(pack => ({
        id: pack.id,
        modName: pack.manifest.modName,
        name: pack.manifest.name,
        version: pack.manifest.version,
        author: pack.manifest.author,
        dependencies: [...pack.manifest.dependencies],
        sourceKind: pack.sourceKind,
        importedAt: pack.importedAt,
        enabled: enabled.has(pack.id),
        capabilities: {
          required: pack.sourceKind === 'builtin',
          removable: pack.sourceKind !== 'builtin',
          reorderable: pack.sourceKind !== 'builtin',
          enableable: pack.sourceKind !== 'builtin',
        },
      })),
      dependencies: this.packManager.dependencyHints(),
    };
  }

  getPackConfiguration(): PackConfigurationDraft {
    return this.packManager.configuration();
  }

  validatePackConfiguration(draft: PackConfigurationDraft): { ok: boolean; errors: readonly string[]; warnings: readonly string[] } {
    try {
      this.packManager.validateConfiguration(draft);
      const registry = new Registry();
      for (const id of draft.order) {
        if (draft.enabledIds.includes(id)) registry.load(this.packManager.getPack(id)!.datapack);
      }
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

  /** 设置热 Spot 编辑会话使用的临时 Mod 元信息；不触发 Registry 或 Runtime 重载。 */
  setRuntimeModMetadata(metadata: Pick<RuntimeModDraft, 'modName' | 'displayName' | 'version' | 'author' | 'description'>): RuntimeModApplyResult {
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
    try {
      this.runtimeWorldContent.setModName(modName);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
    if (!contentState.modName && !this.runtimeMod && this.registry.loadedModNames.has(modName)) {
      return { ok: false, message: `modName 已被当前运行时占用：${modName}` };
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
      ...(current?.suspendedSpotIds !== undefined ? { suspendedSpotIds: current.suspendedSpotIds } : {}),
    };
    return { ok: true, message: `临时 Mod 元信息已保存：${displayName}。` };
  }

  /** 提交一个 Spot 内容 mutation；热路径只触及该 Spot 及其派生节点。 */
  applyRuntimeSpotMutation(mutation: RuntimeSpotMutation): RuntimeSpotMutationResult {
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
    this.syncRuntimeModFromContent();
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
    const result = this.runtimeWorldContent.applyWorldDraft(draft);
    if (!result.ok) return result;
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
      areas: draft.areas.map(area => ({ ...area, defaultSpots: [...area.defaultSpots], ...(area.adjacentAreaIds ? { adjacentAreaIds: [...area.adjacentAreaIds] } : {}) })),
    };
    return result;
  }

  applyRuntimeMod(draft: RuntimeModDraft): RuntimeModApplyResult {
    try {
      if (this.runtimeMod && this.runtimeMod.modName !== draft.modName) {
        throw new Error(`当前已有临时 Mod：${this.runtimeMod.modName}，请先删除后再创建其他 Mod。`);
      }
      if (!this.runtimeMod && this.registry.loadedModNames.has(draft.modName)) {
        throw new Error(`modName 已被当前运行时占用：${draft.modName}`);
      }
      const context = runtimeAuthoringValidationContext(this.registry);
      const suspendedSpotIds = new Set(draft.suspendedSpotIds ?? []);
      const suspendedInitIds = new Set(draft.suspendedInitIds ?? []);
      const suspendedAreaIds = new Set(draft.suspendedAreaIds ?? []);
      const suspendedEnhancementIds = new Set(draft.suspendedEnhancementIds ?? []);
      const seenSpotIds = new Set<string>();
      const seenInitIds = new Set<string>();
      const seenAreaIds = new Set<string>();
      const seenEnhancementIds = new Set<string>();
      const spots: SpotDef[] = [];
      const inits: InitDef[] = [];
      const areas: AreaDef[] = [];
      const enhancements: EnhancementDef[] = [];

      for (const draftSpot of draft.spots) {
        const { unsupportedFunctionalityIds: _unsupportedFunctionalityIds, unsupportedPaymentOptionPaths: _unsupportedPaymentOptionPaths, ...authoringSpot } = draftSpot;
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
      for (const draftEnhancement of draft.enhancements ?? []) {
        const input = { ...draftEnhancement };
        validateRuntimeDraftRecord(requireContentPolicy('enhancements'), input, context, seenEnhancementIds);
        if (!suspendedEnhancementIds.has(draftEnhancement.idName)) enhancements.push(buildAuthoringDef(requireContentPolicy('enhancements'), draft.modName, input) as EnhancementDef);
      }
      const runtimePack: Datapack = {
        modName: draft.modName,
        name: draft.displayName,
        version: draft.version,
        inits, areas, spots, enhancements, activeStories: [], passiveStories: [], stories: [], items: [], funcletDefs: [], characters: [],
      };
      const background = (this.activeDatapacks.length ? this.activeDatapacks : this.packManager.enabledPacks())
        .filter(datapack => !this.runtimeMod || datapack.modName !== this.runtimeMod.modName);
      assertRuntimeDefinitionConflicts(this.registry, draft, this.runtimeMod);
      this.validatePackDatapacks([...background, runtimePack]);
      this.reloadPreservingState([...background, runtimePack]);
      this.runtimeMod = {
        ...draft,
        spots: draft.spots.map(spot => ({ ...spot })),
        suspendedSpotIds: [...suspendedSpotIds].filter(id => seenSpotIds.has(id)),
        ...(draft.inits !== undefined ? { inits: draft.inits.map(init => ({ ...init, defaultAreas: [...init.defaultAreas] })) } : {}),
        ...(draft.areas !== undefined ? { areas: draft.areas.map(area => ({ ...area, defaultSpots: [...area.defaultSpots] })) } : {}),
        ...(draft.enhancements !== undefined ? { enhancements: draft.enhancements.map(enhancement => ({ ...enhancement })) } : {}),
        ...(draft.suspendedInitIds !== undefined || suspendedInitIds.size > 0 ? { suspendedInitIds: [...suspendedInitIds].filter(id => seenInitIds.has(id)) } : {}),
        ...(draft.suspendedAreaIds !== undefined || suspendedAreaIds.size > 0 ? { suspendedAreaIds: [...suspendedAreaIds].filter(id => seenAreaIds.has(id)) } : {}),
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
      );
      const activeCount = inits.length + areas.length + spots.length + enhancements.length;
      return { ok: true, message: `运行时 Mod 已载入：${draft.displayName}；已应用 ${activeCount} 条内容。` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  getRuntimeMod(): RuntimeModDraft | null {
    return this.runtimeMod;
  }

  private syncRuntimeModFromContent(): void {
    const state = this.runtimeContent.getRuntimeModState();
    if (!state.modName) {
      this.runtimeMod = null;
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

  removePack(id: string): void {
    const pack = this.packManager.getPack(id);
    if (!pack) throw new PackManagerError('不存在的数据包：' + id);
    if (pack.sourceKind === 'builtin') throw new PackManagerError('内置数据包不可删除：' + id);
    if (this.packManager.snapshot().enabledIds.includes(id)) {
      throw new PackManagerError('请先将该数据包移出启用集并应用，再移除。');
    }
    this.packManager.removePack(id);
    this.persistPackManagerSnapshot();
  }

  async restorePackManager(store: AsyncPackSnapshotStore): Promise<void> {
    this.packAsyncStore = store;
    const snapshot = await store.load();
    if (snapshot) this.packManager = new PackManager(snapshot, undefined, [createBuiltinBasePack()]);
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

  private validatePackDatapacks(datapacks: readonly Datapack[]): void {
    const registry = new Registry();
    for (const datapack of datapacks) registry.load(datapack);
  }

  private createPackApplyTarget(): {
    validate: (datapacks: readonly Datapack[]) => void;
    reload: (datapacks: readonly Datapack[]) => void;
    clearImages: () => void;
    registerImages: (modName: string, images: readonly { path: string; url: string }[]) => void;
  } {
    const shouldEnterDefaultInit = Boolean(this.state.activeInit);
    return {
      validate: datapacks => this.validatePackDatapacks(datapacks),
      reload: datapacks => this.reload([...datapacks], { enterDefaultInit: shouldEnterDefaultInit }),
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

function createBuiltinBasePack(): StoredPack {
  return {
    id: 'base@1.0.0',
    manifest: {
      modName: 'base',
      name: 'AronaClicker 基础内容',
      version: '1.0.0',
      author: 'AronaClicker',
      dependencies: [],
    },
    datapack: defaultDatapack,
    images: [],
    sourceKind: 'builtin',
    importedAt: 0,
  };
}

export type { SaveData } from './contracts/save-data';
