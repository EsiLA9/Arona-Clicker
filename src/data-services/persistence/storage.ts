import { LocalStorageAdapter, type StorageAdapter } from './storage-adapter';

const SAVE_KEY = 'acprogram_save';
const SAVE_VERSION = '1.0.0';

/** LocalStorage 持久化适配器；不参与 Runtime 生命周期和状态编排。 */
export class SaveSystem {
  private static readonly storage: StorageAdapter = new LocalStorageAdapter();

  static save(data: unknown): boolean {
    try {
      SaveSystem.storage.set(SAVE_KEY, JSON.stringify(data));
      console.log('[SaveSystem] Saved successfully');
      return true;
    } catch (e) {
      console.error('[SaveSystem] Save failed:', e);
      return false;
    }
  }

  static load<T = unknown>(): T | null {
    try {
      const json = SaveSystem.storage.get(SAVE_KEY);
      if (!json) return null;
      const data = JSON.parse(json) as { version?: string };
      if (data.version !== SAVE_VERSION) {
        console.warn('[SaveSystem] Save version mismatch, ignoring');
        return null;
      }
      console.log('[SaveSystem] Loaded successfully');
      return data as T;
    } catch (e) {
      console.error('[SaveSystem] Load failed:', e);
      return null;
    }
  }

  static delete(): void {
    SaveSystem.storage.remove(SAVE_KEY);
    console.log('[SaveSystem] Save deleted');
  }

  static exists(): boolean {
    try { return SaveSystem.storage.get(SAVE_KEY) !== null; }
    catch { return false; }
  }

  static export(): string | null { return SaveSystem.storage.get(SAVE_KEY); }

  static import(json: string): boolean {
    try {
      const data = JSON.parse(json) as { version?: string };
      if (data.version !== SAVE_VERSION) return false;
      SaveSystem.storage.set(SAVE_KEY, json);
      return true;
    } catch { return false; }
  }
}
