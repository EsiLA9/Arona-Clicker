import type { StorageAdapter } from '../persistence/storage-adapter';
import type { PackManagerSnapshot } from './pack-manager';

export interface PackSnapshotStore {
  load(): PackManagerSnapshot | null;
  save(snapshot: PackManagerSnapshot): void;
  clear(): void;
}

export interface AsyncPackSnapshotStore {
  load(): Promise<PackManagerSnapshot | null>;
  save(snapshot: PackManagerSnapshot): Promise<void>;
  clear(): Promise<void>;
}

/** 将包库快照序列化到任意 StorageAdapter；介质可替换为 IndexedDB。 */
export class JsonPackSnapshotStore implements PackSnapshotStore {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly key = 'arona-clicker.pack-manager',
  ) {}

  load(): PackManagerSnapshot | null {
    const raw = this.storage.get(this.key);
    if (!raw) return null;
    try {
      const value: unknown = JSON.parse(raw);
      if (!isSnapshot(value)) return null;
      return value;
    } catch {
      return null;
    }
  }

  save(snapshot: PackManagerSnapshot): void {
    this.storage.set(this.key, JSON.stringify(snapshot));
  }

  clear(): void {
    this.storage.remove(this.key);
  }
}

function isSnapshot(value: unknown): value is PackManagerSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Record<string, unknown>;
  return Array.isArray(snapshot.packs)
    && Array.isArray(snapshot.enabledIds)
    && Array.isArray(snapshot.order);
}

/** IndexedDB 后端；异步生命周期由应用启动层负责，PackManager 本身保持同步纯逻辑。 */
export class IndexedDbPackSnapshotStore implements AsyncPackSnapshotStore {
  private readonly dbPromise: Promise<IDBDatabase>;

  constructor(
    private readonly dbName = 'arona-clicker',
    private readonly storeName = 'pack-snapshots',
    private readonly key = 'current',
    factory: IDBFactory | undefined = globalThis.indexedDB,
  ) {
    if (!factory) {
      this.dbPromise = Promise.reject(new Error('当前环境不支持 IndexedDB。'));
    } else {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = factory.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败。'));
      });
    }
  }

  async load(): Promise<PackManagerSnapshot | null> {
    const raw = await this.request('readonly', objectStore => objectStore.get(this.key));
    if (typeof raw !== 'string') return null;
    try {
      const value: unknown = JSON.parse(raw);
      return isSnapshot(value) ? value : null;
    } catch {
      return null;
    }
  }

  async save(snapshot: PackManagerSnapshot): Promise<void> {
    await this.request('readwrite', objectStore => objectStore.put(JSON.stringify(snapshot), this.key));
  }

  async clear(): Promise<void> {
    await this.request('readwrite', objectStore => objectStore.delete(this.key));
  }

  private async request<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, mode);
      const request = operation(transaction.objectStore(this.storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败。'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务中止。'));
    });
  }
}
