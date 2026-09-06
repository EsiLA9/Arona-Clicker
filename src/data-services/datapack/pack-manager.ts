import type { Datapack } from '../contracts/datapack';
import type { } from '../../engine/types';
import type { PackManifest } from './manifest';
import type { PackSource } from './source';
import type { PackSnapshotStore } from './pack-storage';

export interface StoredPack {
  readonly id: string;
  readonly manifest: PackManifest;
  readonly datapack: Datapack;
  readonly images: readonly { path: string; url: string }[];
  readonly sourceKind: PackSource['kind'] | 'builtin';
  readonly importedAt: number;
}

export type PackSourceKind = PackSource['kind'] | 'builtin';

export interface PackManagerSnapshot {
  readonly packs: readonly StoredPack[];
  readonly enabledIds: readonly string[];
  readonly order: readonly string[];
}

export interface PackApplyTarget {
  validate?(datapacks: readonly Datapack[]): void;
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

export class PackManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackManagerError';
  }
}

/** 包库与启用集的纯内存编排；持久化由后续 StorageAdapter 接入。 */
export class PackManager {
  private packs = new Map<string, StoredPack>();
  private enabledIds = new Set<string>();
  private order: string[] = [];

  constructor(initial?: PackManagerSnapshot, private readonly store?: PackSnapshotStore, builtinPacks: readonly StoredPack[] = []) {
    initial ??= store?.load() ?? { packs: [], enabledIds: [], order: [] };
    for (const pack of initial.packs) this.packs.set(pack.id, pack);
    for (const pack of builtinPacks) this.packs.set(pack.id, pack);
    this.order = this.normalizeOrder(initial.order);
    for (const pack of builtinPacks) {
      if (!this.order.includes(pack.id)) this.order.unshift(pack.id);
    }
    for (const id of initial.enabledIds) {
      if (this.packs.has(id)) this.enabledIds.add(id);
    }
    for (const pack of builtinPacks) this.enabledIds.add(pack.id);
    this.validateEnabledSet();
  }

  snapshot(): PackManagerSnapshot {
    return {
      packs: this.orderedPacks(),
      enabledIds: this.order.filter(id => this.enabledIds.has(id)),
      order: [...this.order],
    };
  }

  configuration(): PackConfigurationDraft {
    return {
      enabledIds: this.order.filter(id => this.enabledIds.has(id)),
      order: [...this.order],
    };
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
    for (const pack of this.packs.values()) {
      if (pack.sourceKind === 'builtin' && !enabled.has(pack.id)) {
        throw new PackManagerError(`核心数据包必须保留在启用集内：${pack.manifest.name}。`);
      }
    }
    const byModName = new Map<string, string>();
    for (const id of draft.order) {
      if (!enabled.has(id)) continue;
      const pack = this.packs.get(id)!;
      const previous = byModName.get(pack.manifest.modName);
      if (previous) throw new PackManagerError(`启用集存在 modName 冲突：${pack.manifest.modName}（${previous} 与 ${id}）。`);
      byModName.set(pack.manifest.modName, id);
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
    target.reload(datapacks);
    target.clearImages();
    for (const id of draft.order) {
      if (!enabled.has(id)) continue;
      const pack = this.packs.get(id)!;
      target.registerImages(pack.manifest.modName, pack.images);
    }
    this.order = [...draft.order];
    this.enabledIds = enabled;
    this.persist();
  }

  importPack(pack: StoredPack): void {
    this.packs.set(pack.id, pack);
    if (!this.order.includes(pack.id)) this.order.push(pack.id);
    this.persist();
  }

  removePack(id: string): void {
    if (this.packs.get(id)?.sourceKind === 'builtin') throw new PackManagerError('内置数据包不可删除：' + id);
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
    if (!enabled && this.packs.get(id)?.sourceKind === 'builtin') throw new PackManagerError('内置数据包不可停用：' + id);
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

  private orderedPacks(): StoredPack[] {
    return this.order.map(id => this.packs.get(id)!).filter(Boolean);
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
      if (previous) throw new PackManagerError('启用集存在 modName 冲突：' + pack.manifest.modName + '（' + previous + ' 与 ' + id + '）。');
      byModName.set(pack.manifest.modName, id);
    }
  }

  private persist(): void {
    this.store?.save(this.snapshot());
  }
}
