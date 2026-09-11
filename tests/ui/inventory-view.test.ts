import { describe, expect, it } from 'vitest';
import type { ItemDef } from '../../src/data-services/contracts/item';
import {
  createInventoryWorkspaceState,
  deriveInventoryRows,
} from '../../src/ui/inventory-view';

const item = (id: string, name: string, type: ItemDef['type'], rarity: ItemDef['rarity'], maxStack = 10): ItemDef => ({
  id,
  name,
  description: `${name} description`,
  type,
  rarity,
  maxStack,
});

const items = new Map<string, ItemDef>([
  ['base:item:drink', item('base:item:drink', '战术饮料', 'consumable', 'common', 5)],
  ['base:item:chip', item('base:item:chip', '数据芯片', 'material', 'rare', 20)],
  ['base:item:pass', item('base:item:pass', '夏莱通行证', 'key', 'epic', 1)],
]);

describe('inventory view query', () => {
  it('按种类、稀有度、关键词组合筛选并统计结果', () => {
    const state = {
      ...createInventoryWorkspaceState(),
      typeFilter: 'material' as const,
      rarityFilter: 'rare' as const,
      query: '芯片',
    };
    const result = deriveInventoryRows(items, { 'base:item:drink': 2, 'base:item:chip': 3, 'base:item:pass': 1 }, state);

    expect(result.rows.map(row => row.id)).toEqual(['base:item:chip']);
    expect(result.counts.byType).toEqual({ consumable: 1, material: 1, key: 1 });
    expect(result.counts.resultCount).toBe(3);
  });

  it('预设排序使用稳定的名称与 ID tie-breaker', () => {
    const state = { ...createInventoryWorkspaceState(), sortMode: 'rarity' as const, sortDirection: 'desc' as const };
    const result = deriveInventoryRows(items, { 'base:item:drink': 2, 'base:item:chip': 3, 'base:item:pass': 1 }, state);
    expect(result.rows.map(row => row.id)).toEqual(['base:item:pass', 'base:item:chip', 'base:item:drink']);
  });

  it('自定义顺序优先，新增物品按稳定顺序追加', () => {
    const state = {
      ...createInventoryWorkspaceState(),
      sortMode: 'custom' as const,
      customOrder: ['base:item:pass', 'base:item:drink'],
    };
    const result = deriveInventoryRows(items, { 'base:item:drink': 2, 'base:item:chip': 3, 'base:item:pass': 1 }, state);
    expect(result.rows.map(row => row.id)).toEqual(['base:item:pass', 'base:item:drink', 'base:item:chip']);
  });

  it('仅显示已持有时隐藏零数量，关闭后只纳入可见定义', () => {
    const state = { ...createInventoryWorkspaceState(), ownedOnly: false };
    const result = deriveInventoryRows(items, { 'base:item:drink': 0 }, state, itemId => itemId !== 'base:item:pass');
    expect(result.rows.map(row => [row.id, row.count])).toEqual([
      ['base:item:chip', 0],
      ['base:item:drink', 0],
    ]);
  });
});
