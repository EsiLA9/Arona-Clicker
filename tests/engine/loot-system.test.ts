// ============================================================
// engine/loot-system.test.ts
// ============================================================
import { describe, test, expect } from 'vitest';
import { Registry } from '../../src/data-services/registry/registry';
import { EventBus } from '../../src/engine/core/event-bus';
import { ConditionSystem } from '../../src/engine/expression/condition-system';
import { LootSystem } from '../../src/arona-clicker/services/loot-system';
import type { DropTableEntry } from '../../src/data-services/contracts/drop-table';
import type { PlayerState } from '../../src/arona-clicker/types/state';

function emptyState(): PlayerState {
  return {
    resources: {},
    spotLevels: {},
    spotManagers: {},
    unlockedEnhancements: [],
    activeInit: '',
    totalFrames: 0,
    storyLog: [],
    inventory: {},
    flags: {},
    unlockedInits: [],
  };
}

describe('LootSystem', () => {
  test('should roll a single item from table', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const cs = new ConditionSystem();
    const loot = new LootSystem(reg, cs, bus);

    const table: DropTableEntry[] = [
      { itemId: 'test:item:item_a', min: 1, max: 1, weight: 100 },
    ];

    const result = loot.roll(table, emptyState());
    expect(result.size).toBe(1);
    expect(result.get('test:item:item_a')).toBe(1);
  });

  test('should filter by condition', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const cs = new ConditionSystem();
    const loot = new LootSystem(reg, cs, bus);

    const state = emptyState();
    state.resources.credit = 100;

    const table: DropTableEntry[] = [
      { itemId: 'test:item:item_b', min: 1, max: 1, weight: 1, condition: { type: 'AND', conditions: [{ target: 'resource', key: 'credit', comparator: '>=', value: 1000 }] } },
      { itemId: 'test:item:item_a', min: 1, max: 1, weight: 100 },
    ];

    // item_b 不满足条件，只能抽到 item_a
    for (let i = 0; i < 20; i++) {
      const result = loot.roll(table, state);
      expect(result.has('test:item:item_b')).toBe(false);
    }
  });

  test('should return empty when all conditions fail', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const cs = new ConditionSystem();
    const loot = new LootSystem(reg, cs, bus);

    const table: DropTableEntry[] = [
      { itemId: 'test:item:item_x', min: 1, max: 1, weight: 100, condition: { type: 'AND', conditions: [{ target: 'resource', key: 'credit', comparator: '>=', value: 10000 }] } },
    ];

    const result = loot.roll(table, emptyState());
    expect(result.size).toBe(0);
  });

  test('should return empty for empty table', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const cs = new ConditionSystem();
    const loot = new LootSystem(reg, cs, bus);

    expect(loot.roll([], emptyState()).size).toBe(0);
  });

  test('should roll within min-max range', () => {
    const reg = new Registry();
    const bus = new EventBus();
    const cs = new ConditionSystem();
    const loot = new LootSystem(reg, cs, bus);

    const table: DropTableEntry[] = [
      { itemId: 'test:item:item_r', min: 3, max: 7, weight: 100 },
    ];

    for (let i = 0; i < 30; i++) {
      const result = loot.roll(table, emptyState());
      const count = result.get('test:item:item_r')!;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(7);
    }
  });
});
