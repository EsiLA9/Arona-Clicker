import { describe, expect, test } from 'vitest';
import { IndexedDbPackSnapshotStore, JsonPackSnapshotStore } from '../../../src/data-services/datapack/pack-storage';
import type { PackManagerSnapshot } from '../../../src/data-services/datapack/pack-manager';

class MemoryStorage {
  private values = new Map<string, string>();
  get(key: string): string | null { return this.values.get(key) ?? null; }
  set(key: string, value: string): void { this.values.set(key, value); }
  remove(key: string): void { this.values.delete(key); }
}

const snapshot: PackManagerSnapshot = { packs: [], enabledIds: ['a'], order: ['a'] };

describe('JsonPackSnapshotStore', () => {
  test('恢复旧 Entry 时先备份完整快照，原键直到正常保存才更新', () => {
    const storage = new MemoryStorage(), store = new JsonPackSnapshotStore(storage);
    const legacy = { ...snapshot, packs: [{ datapack: { activeStories: [{ id: 'base:activestory:old', type: 'active' }] } }] };
    const raw = JSON.stringify(legacy);
    storage.set('arona-clicker.pack-manager', raw);
    const restored = store.load()!;
    expect(restored.packs[0].datapack.activeStories[0]).toEqual({ id: 'base:activestory:old', activation: { kind: 'active' } });
    expect(storage.get('arona-clicker.pack-manager_before_entry_activation')).toBe(raw);
    expect(storage.get('arona-clicker.pack-manager')).toBe(raw);
    store.save(restored);
    expect(store.load()).toEqual(restored);
    expect(storage.get('arona-clicker.pack-manager_before_entry_activation')).toBe(raw);
  });

  test('有冲突的旧 Entry 明确报错而非降级成空包库', () => {
    const storage = new MemoryStorage(), store = new JsonPackSnapshotStore(storage);
    const raw = JSON.stringify({ ...snapshot, packs: [{ datapack: { activeStories: [{ id: 'old', type: 'passive' }] } }] });
    storage.set('arona-clicker.pack-manager', raw);
    expect(() => store.load()).toThrow('旧 Entry.type 与所属列表不一致');
    expect(storage.get('arona-clicker.pack-manager')).toBe(raw);
  });

  test('备份失败时不返回可能随后覆盖原文的迁移快照', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ ...snapshot, packs: [{ datapack: { activeStories: [{ id: 'old', type: 'active' }] } }] });
    storage.set('arona-clicker.pack-manager', raw);
    const store = new JsonPackSnapshotStore({ get: key => storage.get(key), remove: key => storage.remove(key), set: () => { throw new Error('quota'); } });
    expect(() => store.load()).toThrow('quota');
    expect(storage.get('arona-clicker.pack-manager')).toBe(raw);
  });

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
  test('请求成功后事务中止时仍拒绝恢复或保存', async () => {
    const factory = { open: () => {
      const open = { result: { transaction: () => {
        const tx = { error: new Error('aborted'), onabort: null as null | (() => void), objectStore: () => ({ get: () => {
          const req = { result: null, onsuccess: null as null | (() => void) };
          queueMicrotask(() => { req.onsuccess?.(); tx.onabort?.(); });
          return req;
        } }) };
        return tx;
      } }, onsuccess: null as null | (() => void) };
      queueMicrotask(() => open.onsuccess?.());
      return open;
    } } as unknown as IDBFactory;
    await expect(new IndexedDbPackSnapshotStore('test', 'packs', 'current', factory).load()).rejects.toThrow('aborted');
  });

  test('IndexedDB 恢复路径也保留原始字符串备份', async () => {
    const raw = JSON.stringify({ ...snapshot, packs: [{ datapack: { activeStories: [{ id: 'old', type: 'active' }] } }] });
    const values = new Map<string, string>([['current', raw]]);
    const request = (result: unknown) => {
      const req = { result } as IDBRequest;
      queueMicrotask(() => req.onsuccess?.({} as Event));
      return req;
    };
    const factory = { open: () => request({ transaction: () => {
      const tx = { oncomplete: null as null | (() => void), objectStore: () => ({
        get: (key: string) => finish(values.get(key)),
        put: (value: string, key: string) => { values.set(key, value); return finish(key); },
      }) };
      const finish = (value: unknown) => { const req = request(value); queueMicrotask(() => tx.oncomplete?.()); return req; };
      return tx;
    } }) } as unknown as IDBFactory;
    const store = new IndexedDbPackSnapshotStore('test', 'packs', 'current', factory);
    const restored = await store.load();
    expect(restored?.packs[0].datapack.activeStories[0]).toMatchObject({ activation: { kind: 'active' } });
    expect(values.get('current_before_entry_activation')).toBe(raw);
    expect(values.get('current')).toBe(raw);
  });

  test('不支持 IndexedDB 的环境明确拒绝操作', async () => {
    const store = new IndexedDbPackSnapshotStore('test-db', 'packs', 'current', undefined);
    await expect(store.load()).rejects.toThrow('不支持 IndexedDB');
  });
});
