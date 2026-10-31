import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SaveSystem } from '../../src/data-services/persistence/storage';
import { GAME_SAVE_VERSION } from '../../src/engine/contracts/save-version';

describe('game save format gate', () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  test('accepts the current format and rejects an old save without rewriting it', () => {
    const current = { version: GAME_SAVE_VERSION, marker: 'new' };
    expect(SaveSystem.save(current)).toBe(true);
    expect(SaveSystem.load()).toEqual(current);
    const old = JSON.stringify({ version: '2.0.0', marker: 'old' });
    data.set('acprogram_save', old);
    expect(SaveSystem.load()).toBeNull();
    expect(SaveSystem.export()).toBe(old);
    expect(SaveSystem.import(old)).toBe(false);
    expect(SaveSystem.export()).toBe(old);
    expect(SaveSystem.import(JSON.stringify(current))).toBe(true);
    expect(SaveSystem.load()).toEqual(current);
  });
});
