import { GameInstance } from './runtime-game-instance';
import { buildSaveData } from './runtime-save-codec';
import type { GameInstanceOptions } from './runtime-options';
import { PackManager, PackManagerError, type PackConfigurationDraft, type StoredPack } from '../data-services/datapack/pack-manager';
import type { ParsedPack } from '../data-services/datapack/pack-parser';
import type { AsyncPackSnapshotStore, PackSnapshotStore } from '../data-services/datapack/pack-storage';
import { Registry } from '../data-services/registry/registry';
import { defaultDatapack } from './content/default-datapack';
import type { PackCatalogCommands, PackCatalogDependencyHint, PackCatalogEntry, PackCatalogReadModel, RuntimeModDraft, RuntimeModApplyResult } from './contracts';
import type { Datapack } from '../data-services/contracts/datapack';
import type { SpotDef } from '../data-services/contracts/world';
import { RuntimeContentCoordinator } from './services/runtime-content-coordinator';
import { RuntimeDefinitionEditor, SpotContentService } from './services/spot-content-service';
import type { RuntimeModStateSnapshot, RuntimeSpotMutation, RuntimeSpotMutationResult } from './contracts/runtime-content';

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
          ...(commit.previousSpot ? { previousAreaId: commit.previousSpot.areaId, previousYieldResource: commit.previousSpot.baseYieldResource } : {}),
          ...(commit.currentSpot ? { nextAreaId: commit.currentSpot.areaId, nextYieldResource: commit.currentSpot.baseYieldResource } : {}),
        });
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
    const shouldEnterDefaultInit = Boolean(this.state.activeInit);
    this.packManager.applyEnabled({
      validate: datapacks => {
        const registry = new Registry();
        for (const datapack of datapacks) registry.load(datapack);
      },
      reload: datapacks => this.reload([...datapacks], { enterDefaultInit: shouldEnterDefaultInit }),
      clearImages: () => this.imageStore.clear(),
      registerImages: (modName, images) => this.pics.register(modName, images),
    });
    this.runtimeMod = null;
    this.runtimeContent.reset();
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
      const shouldEnterDefaultInit = Boolean(this.state.activeInit);
      this.packManager.applyConfiguration(draft, {
        validate: datapacks => {
          const registry = new Registry();
          for (const datapack of datapacks) registry.load(datapack);
        },
        reload: datapacks => this.reload([...datapacks], { enterDefaultInit: shouldEnterDefaultInit }),
        clearImages: () => this.imageStore.clear(),
        registerImages: (modName, images) => this.pics.register(modName, images),
      });
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
    if (contentState.modName && contentState.modName !== modName) {
      return { ok: false, message: `当前已有临时 Mod：${contentState.modName}，请先删除后再创建其他 Mod。` };
    }
    if (!contentState.modName && !this.runtimeMod && this.registry.loadedModNames.has(modName)) {
      return { ok: false, message: `modName 已被当前运行时占用：${modName}` };
    }
    const current = this.runtimeMod;
    this.runtimeMod = {
      modName,
      displayName,
      version: metadata.version.trim(),
      author: metadata.author.trim(),
      description: metadata.description.trim(),
      spots: current?.spots ?? [],
      suspendedSpotIds: current?.suspendedSpotIds ?? [],
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

  applyRuntimeMod(draft: RuntimeModDraft): RuntimeModApplyResult {
    try {
      if (this.runtimeMod && this.runtimeMod.modName !== draft.modName) {
        throw new Error(`当前已有临时 Mod：${this.runtimeMod.modName}，请先删除后再创建其他 Mod。`);
      }
      if (!this.runtimeMod && this.registry.loadedModNames.has(draft.modName)) {
        throw new Error(`modName 已被当前运行时占用：${draft.modName}`);
      }
      const suspendedSpotIds = new Set(draft.suspendedSpotIds ?? []);
      const seenSpotIds = new Set<string>();
      const spots: SpotDef[] = [];
      for (const draftSpot of draft.spots) {
        if (seenSpotIds.has(draftSpot.idName)) {
          throw new Error(`临时 Mod 中存在重复 Spot ID：${draftSpot.idName}`);
        }
        seenSpotIds.add(draftSpot.idName);
        if (suspendedSpotIds.has(draftSpot.idName)) continue;
        spots.push({
          id: `${draft.modName}:spot:${draftSpot.idName}`,
          areaId: draftSpot.areaId,
          name: draftSpot.name,
          description: draftSpot.description,
          baseCost: { type: 'const', value: draftSpot.baseCost },
          baseCostResource: draftSpot.baseCostResource,
          baseYield: { type: 'const', value: draftSpot.baseYield },
          baseYieldResource: draftSpot.baseYieldResource,
          baseCapacity: draftSpot.baseCapacity,
          tags: [],
        });
      }
      const runtimePack: Datapack = {
        modName: draft.modName,
        name: draft.displayName,
        version: draft.version,
        inits: [], areas: [], spots, enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], funcletDefs: [], characters: [],
      };
      const previousSpotIds = new Set((this.runtimeMod?.spots ?? []).map(spot => `${this.runtimeMod!.modName}:spot:${spot.idName}`));
      for (const spot of spots) {
        if (this.registry.spots.has(spot.id) && !previousSpotIds.has(spot.id)) {
          throw new Error(`Spot ID 已被当前运行时占用：${spot.id}`);
        }
      }
      this.registry.validate(runtimePack);
      const background = (this.activeDatapacks.length ? this.activeDatapacks : this.packManager.enabledPacks())
        .filter(datapack => !this.runtimeMod || datapack.modName !== this.runtimeMod.modName);
      this.reloadPreservingState([...background, runtimePack]);
      this.runtimeMod = {
        ...draft,
        spots: draft.spots.map(spot => ({ ...spot })),
        suspendedSpotIds: [...suspendedSpotIds].filter(id => seenSpotIds.has(id)),
      };
      this.runtimeContent.adoptRuntimeMod(
        draft.modName,
        draft.spots.map(spot => `${draft.modName}:spot:${spot.idName}`),
        draft.suspendedSpotIds ?? [],
      );
      const activeCount = spots.length;
      return { ok: true, message: `运行时 Mod 已载入：${draft.displayName}；已应用 ${activeCount} 个 Spot。` };
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
        baseCost: constantOf(spot.baseCost),
        baseCostResource: spot.baseCostResource,
        baseYield: constantOf(spot.baseYield),
        baseYieldResource: spot.baseYieldResource,
        baseCapacity: spot.baseCapacity,
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
}

function constantOf(expression: SpotDef['baseCost']): number {
  return expression.type === 'const' && typeof expression.value === 'number' ? expression.value : 0;
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
