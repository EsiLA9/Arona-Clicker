import type { ItemDef } from '../data-services/contracts/item';

export type InventoryTypeFilter = 'all' | ItemDef['type'];
export type InventoryRarityFilter = 'all' | ItemDef['rarity'];
export type InventoryUsabilityFilter = 'all' | 'usable' | 'unusable';
export type InventorySortMode = 'custom' | 'name' | 'type' | 'rarity' | 'count' | 'stack';

export interface InventoryWorkspaceState {
  typeFilter: InventoryTypeFilter;
  rarityFilter: InventoryRarityFilter;
  usabilityFilter: InventoryUsabilityFilter;
  ownedOnly: boolean;
  query: string;
  sortMode: InventorySortMode;
  sortDirection: 'asc' | 'desc';
  customOrder: string[];
  selectedItemId: string | null;
}

export interface InventoryRow {
  id: string;
  item: ItemDef | undefined;
  name: string;
  description: string;
  type: ItemDef['type'] | null;
  rarity: ItemDef['rarity'] | null;
  count: number;
  maxStack: number | null;
  stackRatio: number | null;
  usable: boolean;
}

export interface InventoryQueryResult {
  allRows: InventoryRow[];
  rows: InventoryRow[];
  counts: {
    totalKinds: number;
    totalCount: number;
    resultKinds: number;
    resultCount: number;
    byType: Record<ItemDef['type'], number>;
  };
}

const TYPE_ORDER: Record<ItemDef['type'], number> = { consumable: 0, material: 1, key: 2 };
const RARITY_ORDER: Record<ItemDef['rarity'], number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

export function createInventoryWorkspaceState(): InventoryWorkspaceState {
  return {
    typeFilter: 'all',
    rarityFilter: 'all',
    usabilityFilter: 'all',
    ownedOnly: true,
    query: '',
    sortMode: 'custom',
    sortDirection: 'asc',
    customOrder: [],
    selectedItemId: null,
  };
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'zh-Hans-CN') || a.localeCompare(b) || 0;
}

function rowSort(a: InventoryRow, b: InventoryRow, options: InventoryWorkspaceState, fallbackIndex: Map<string, number>): number {
  let result = 0;
  if (options.sortMode === 'custom') {
    const aIndex = fallbackIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = fallbackIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    result = aIndex - bIndex;
  } else if (options.sortMode === 'name') {
    result = compareText(a.name, b.name);
  } else if (options.sortMode === 'type') {
    result = (a.type ? TYPE_ORDER[a.type] : Number.MAX_SAFE_INTEGER) - (b.type ? TYPE_ORDER[b.type] : Number.MAX_SAFE_INTEGER);
  } else if (options.sortMode === 'rarity') {
    result = (a.rarity ? RARITY_ORDER[a.rarity] : -1) - (b.rarity ? RARITY_ORDER[b.rarity] : -1);
  } else if (options.sortMode === 'count') {
    result = a.count - b.count;
  } else if (options.sortMode === 'stack') {
    result = (a.stackRatio ?? -1) - (b.stackRatio ?? -1);
  }
  if (options.sortDirection === 'desc') result *= -1;
  return result || compareText(a.name, b.name) || a.id.localeCompare(b.id);
}

export function deriveInventoryRows(
  items: ReadonlyMap<string, ItemDef>,
  inventory: Readonly<Record<string, number>>,
  options: InventoryWorkspaceState,
  isVisible: (itemId: string) => boolean = () => true,
  isUsable: (item: ItemDef, count: number) => boolean = (item, count) => item.type === 'consumable' && count > 0,
): InventoryQueryResult {
  const ids = new Set(Object.keys(inventory));
  if (!options.ownedOnly) {
    for (const itemId of items.keys()) if (isVisible(itemId)) ids.add(itemId);
  }

  const allRows = [...ids]
    .map(id => {
      const item = items.get(id);
      const count = inventory[id] ?? 0;
      const maxStack = item?.maxStack ?? null;
      return {
        id,
        item,
        name: item?.name ?? `未知物品 · ${id}`,
        description: item?.description ?? '注册表中没有找到该物品定义。',
        type: item?.type ?? null,
        rarity: item?.rarity ?? null,
        count,
        maxStack,
        stackRatio: maxStack && maxStack > 0 ? count / maxStack : null,
        usable: item ? isUsable(item, count) : false,
      } satisfies InventoryRow;
    })
    .filter(row => !options.ownedOnly || row.count > 0);

  const query = options.query.trim().toLocaleLowerCase();
  const rows = allRows.filter(row => {
    if (options.typeFilter !== 'all' && row.type !== options.typeFilter) return false;
    if (options.rarityFilter !== 'all' && row.rarity !== options.rarityFilter) return false;
    if (options.usabilityFilter === 'usable' && !row.usable) return false;
    if (options.usabilityFilter === 'unusable' && row.usable) return false;
    if (query && !`${row.name} ${row.id}`.toLocaleLowerCase().includes(query)) return false;
    return true;
  });

  const fallbackIndex = new Map(options.customOrder.map((id, index) => [id, index] as const));
  const sortRows = (left: InventoryRow, right: InventoryRow): number => rowSort(left, right, options, fallbackIndex);
  allRows.sort(sortRows);
  rows.sort(sortRows);

  const byType: Record<ItemDef['type'], number> = { consumable: 0, material: 0, key: 0 };
  for (const row of allRows) if (row.type) byType[row.type] += 1;
  return {
    allRows,
    rows,
    counts: {
      totalKinds: allRows.length,
      totalCount: allRows.reduce((total, row) => total + row.count, 0),
      resultKinds: rows.length,
      resultCount: rows.reduce((total, row) => total + row.count, 0),
      byType,
    },
  };
}
