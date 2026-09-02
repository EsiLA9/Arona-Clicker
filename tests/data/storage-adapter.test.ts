import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter, type StorageAdapter } from '../../src/data-services/persistence/storage-adapter';

describe('StorageAdapter', () => {
  it('定义最小的 get/set/remove 介面', () => {
    const data = new Map<string, string>();
    const adapter: StorageAdapter = {
      get: key => data.get(key) ?? null,
      set: (key, value) => { data.set(key, value); },
      remove: key => { data.delete(key); },
    };
    adapter.set('x', '1');
    expect(adapter.get('x')).toBe('1');
    adapter.remove('x');
    expect(adapter.get('x')).toBeNull();
  });

  it('提供浏览器 LocalStorage 实现', () => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); },
        removeItem: (key: string) => { data.delete(key); },
      },
    });
    const adapter = new LocalStorageAdapter();
    adapter.set('storage-adapter-test', 'ok');
    expect(adapter.get('storage-adapter-test')).toBe('ok');
    adapter.remove('storage-adapter-test');
    expect(adapter.get('storage-adapter-test')).toBeNull();
  });
});
