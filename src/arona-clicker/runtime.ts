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

  constructor(options: AronaClickerRuntimeOptions = {}) {
    super({ ...options, saveCodec: options.saveCodec ?? buildSaveData });
    this.packManager = new PackManager(undefined, options.packStore, [createBuiltinBasePack()]);
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

  applyRuntimeMod(draft: RuntimeModDraft): RuntimeModApplyResult {
    try {
      if (this.runtimeMod && this.runtimeMod.modName !== draft.modName) {
        throw new Error(`当前已有临时 Mod：${this.runtimeMod.modName}，请先删除后再创建其他 Mod。`);
      }
      if (!this.runtimeMod && this.registry.loadedModNames.has(draft.modName)) {
        throw new Error(`modName 已被当前运行时占用：${draft.modName}`);
      }
      const spot: SpotDef = {
        id: `${draft.modName}:spot:${draft.spot.idName}`,
        areaId: draft.spot.areaId,
        name: draft.spot.name,
        description: draft.spot.description,
        baseCost: { type: 'const', value: draft.spot.baseCost },
        baseCostResource: draft.spot.baseCostResource,
        baseYield: { type: 'const', value: draft.spot.baseYield },
        baseYieldResource: draft.spot.baseYieldResource,
        baseCapacity: draft.spot.baseCapacity,
        tags: [],
      };
      const runtimePack: Datapack = {
        modName: draft.modName,
        name: draft.displayName,
        version: draft.version,
        inits: [], areas: [], spots: [spot], enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], funcletDefs: [], characters: [],
      };
      const spotId = spot.id;
      const previousSpotId = this.runtimeMod ? `${this.runtimeMod.modName}:spot:${this.runtimeMod.spot.idName}` : null;
      if (this.registry.spots.has(spotId) && spotId !== previousSpotId) {
        throw new Error(`Spot ID 已被当前运行时占用：${spotId}`);
      }
      this.registry.validate(runtimePack);
      const background = (this.activeDatapacks.length ? this.activeDatapacks : this.packManager.enabledPacks())
        .filter(datapack => !this.runtimeMod || datapack.modName !== this.runtimeMod.modName);
      this.reloadPreservingState([...background, runtimePack]);
      this.runtimeMod = draft;
      return { ok: true, message: `运行时 Mod 已载入：${draft.displayName}；Spot 已加入当前 Area。` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  getRuntimeMod(): RuntimeModDraft | null {
    return this.runtimeMod;
  }

  removeRuntimeMod(preservePlayerData = true): RuntimeModApplyResult {
    if (!this.runtimeMod) return { ok: false, message: '当前没有可删除的临时 Mod。' };
    try {
      const modName = this.runtimeMod.modName;
      const background = (this.activeDatapacks.length ? this.activeDatapacks : this.packManager.enabledPacks())
        .filter(datapack => datapack.modName !== modName);
      const saved = this.save();
      if (!preservePlayerData) {
        const spotId = `${modName}:spot:${this.runtimeMod.spot.idName}`;
        delete saved.playerState.spotLevels[spotId];
        delete saved.playerState.spotManagers[spotId];
        for (const snapshot of Object.values(saved.playerState.initSnapshots ?? {})) {
          delete snapshot.spotLevels[spotId];
          delete snapshot.spotManagers[spotId];
        }
        if (saved.playerState.spotTagOverrides) delete saved.playerState.spotTagOverrides[spotId];
      }
      this.reload([...background], { enterDefaultInit: false });
      this.load(saved);
      this.runtimeMod = null;
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
