/** 持久化介质的最小读写能力；SaveSystem 不依赖浏览器存储 API。 */
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** 浏览器 LocalStorage 适配器。 */
export class LocalStorageAdapter implements StorageAdapter {
  get(key: string): string | null { return localStorage.getItem(key); }
  set(key: string, value: string): void { localStorage.setItem(key, value); }
  remove(key: string): void { localStorage.removeItem(key); }
}
