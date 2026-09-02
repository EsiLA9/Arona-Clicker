import { describe, expect, test } from 'vitest';
import { IndexedDbPackSnapshotStore, JsonPackSnapshotStore } from '../../src/data-services/datapack/pack-storage';
import type { PackManagerSnapshot } from '../../src/data-services/datapack/pack-manager';

class MemoryStorage {
  private values = new Map<string, string>();
  get(key: string): string | null { return this.values.get(key) ?? null; }
  set(key: string, value: string): void { this.values.set(key, value); }
  remove(key: string): void { this.values.delete(key); }
}

const snapshot: PackManagerSnapshot = { packs: [], enabledIds: ['a'], order: ['a'] };

describe('JsonPackSnapshotStore', () => {
  test('保存与读取包库快照', () => {
    const store = new JsonPackSnapshotStore(new MemoryStorage());
    store.save(snapshot);
    expect(store.load()).toEqual(snapshot);
  });

  test('损坏或形状不符的数据安全降级为空', () => {
    const storage = new MemoryStorage();
    const store = new JsonPackSnapshotStore(storage);
    storage.set('arona-clicker.pack-manager', '{broken');
    expect(store.load()).toBeNull();
    storage.set('arona-clicker.pack-manager', JSON.stringify({ packs: [] }));
    expect(store.load()).toBeNull();
  });

  test('clear 删除快照', () => {
    const store = new JsonPackSnapshotStore(new MemoryStorage());
    store.save(snapshot);
    store.clear();
    expect(store.load()).toBeNull();
  });
});

describe('IndexedDbPackSnapshotStore', () => {
  test('不支持 IndexedDB 的环境明确拒绝操作', async () => {
    const store = new IndexedDbPackSnapshotStore('test-db', 'packs', 'current', undefined);
    await expect(store.load()).rejects.toThrow('不支持 IndexedDB');
  });
});
