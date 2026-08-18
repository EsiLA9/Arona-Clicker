// ============================================================
// save/storage.ts — 存档持久化层 (LocalStorage)
// ============================================================

import { SaveData } from '../engine/game-instance';

const SAVE_KEY = 'acprogram_save';
const SAVE_VERSION = '1.0.0';

export class SaveSystem {
  /** 保存到 LocalStorage */
  static save(data: SaveData): boolean {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(SAVE_KEY, json);
      console.log('[SaveSystem] Saved successfully');
      return true;
    } catch (e) {
      console.error('[SaveSystem] Save failed:', e);
      return false;
    }
  }

  /** 从 LocalStorage 读取 */
  static load(): SaveData | null {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return null;
      const data = JSON.parse(json) as SaveData;
      if (data.version !== SAVE_VERSION) {
        console.warn('[SaveSystem] Save version mismatch, ignoring');
        return null;
      }
      console.log('[SaveSystem] Loaded successfully');
      return data;
    } catch (e) {
      console.error('[SaveSystem] Load failed:', e);
      return null;
    }
  }

  /** 删除存档 */
  static delete(): void {
    localStorage.removeItem(SAVE_KEY);
    console.log('[SaveSystem] Save deleted');
  }

  /** 检查存档是否存在 */
  static exists(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  /** 导出为字符串 (用于备份) */
  static export(): string | null {
    return localStorage.getItem(SAVE_KEY);
  }

  /** 从字符串导入 */
  static import(json: string): boolean {
    try {
      const data = JSON.parse(json) as SaveData;
      if (data.version !== SAVE_VERSION) return false;
      localStorage.setItem(SAVE_KEY, json);
      return true;
    } catch {
      return false;
    }
  }
}
