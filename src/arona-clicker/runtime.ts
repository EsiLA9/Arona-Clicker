import { GameInstance } from './runtime-game-instance';
import { buildSaveData } from './runtime-save-codec';
import type { GameInstanceOptions } from './runtime-options';
import { PackManager, type PackConfigurationDraft, type StoredPack } from '../data-services/datapack/pack-manager';
import type { ParsedPack } from '../data-services/datapack/pack-parser';
import type { AsyncPackSnapshotStore, PackSnapshotStore } from '../data-services/datapack/pack-storage';
import { Registry } from '../data-services/registry/registry';
import { defaultDatapack } from './content/default-datapack';
import type { PackCatalogCommands, PackCatalogDependencyHint, PackCatalogEntry, PackCatalogReadModel } from './contracts';

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

  constructor(options: AronaClickerRuntimeOptions = {}) {
    super({ ...options, saveCodec: options.saveCodec ?? buildSaveData });
    this.packManager = new PackManager(undefined, options.packStore, [createBuiltinBasePack()]);
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
