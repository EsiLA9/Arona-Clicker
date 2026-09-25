import type { DatapackIdentity, PackConflictCode, PackManager, StoredPack } from './pack-manager';

/**
 * 数据包文件层的稳定边界。这里不暴露 Pane、Selection 或 Runtime，
 * 以后可以替换为文件夹、ZIP、File System Access API、IndexedDB 或远程仓库。
 */
export interface DatapackRepository {
  create(record: StoredPack): StoredPack;
  read(packRecordId: string): StoredPack | undefined;
  update(record: StoredPack): StoredPack;
  delete(packRecordId: string): void;
  exists(identity: DatapackIdentity, kind: 'fixed' | 'editing'): boolean;
  enumerate(): readonly StoredPack[];
}

export interface DatapackCopyService {
  copy(sourcePackRecordId: string, destination: DatapackIdentity): StoredPack;
}

export interface PackageInspection {
  readonly modId: string;
  readonly versionId: string;
  readonly contentDigest?: string;
  readonly diagnostics: readonly PackageDiagnostic[];
}

export interface PackageDiagnostic {
  readonly code: PackConflictCode | 'invalid-package' | 'unsupported-package';
  readonly path?: string;
  readonly message: string;
}

export interface DatapackImportService {
  inspect(source: unknown): PackageInspection;
  validate(source: unknown): readonly PackageDiagnostic[];
  importFixed(source: unknown): StoredPack;
}

export interface DatapackExportService {
  export(sourcePackRecordId: string, options?: { readonly versionId?: string }): StoredPack;
}

/** 当前 Catalog 的复用适配器；文件格式编解码仍由未来 PackageSource 实现负责。 */
export class PackManagerRepository implements DatapackRepository {
  constructor(private readonly manager: PackManager) {}

  create(record: StoredPack): StoredPack {
    this.manager.importPack(record);
    return this.manager.getPack(record.packRecordId ?? record.id)!;
  }

  read(packRecordId: string): StoredPack | undefined {
    return this.manager.getPack(packRecordId);
  }

  update(record: StoredPack): StoredPack {
    this.manager.savePack(record);
    return this.manager.getPack(record.packRecordId ?? record.id)!;
  }

  delete(packRecordId: string): void {
    this.manager.removePack(packRecordId);
  }

  exists(identity: DatapackIdentity, kind: 'fixed' | 'editing'): boolean {
    return this.manager.panes().some(pane => pane.identity.modId === identity.modId
      && pane.identity.versionId === identity.versionId
      && (kind === 'fixed' ? Boolean(pane.fixedSlot) : Boolean(pane.editingSlot)));
  }

  enumerate(): readonly StoredPack[] {
    return this.manager.listPacks();
  }
}

export class PackManagerCopyService implements DatapackCopyService {
  constructor(private readonly manager: PackManager) {}

  copy(sourcePackRecordId: string, destination: DatapackIdentity): StoredPack {
    return this.manager.cloneAsEditing(sourcePackRecordId, destination).pack;
  }
}

export class PackManagerExportService implements DatapackExportService {
  constructor(private readonly manager: PackManager) {}

  export(sourcePackRecordId: string, options: { readonly versionId?: string } = {}): StoredPack {
    return this.manager.exportPack(sourcePackRecordId, options);
  }
}
