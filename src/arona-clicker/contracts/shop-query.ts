import type { ResourceDisplayDef } from '../../data-services/contracts/common';
import type { ShopDef } from '../../data-services/contracts/shop';

export interface ShopCartLine { entryId: string; quantity: number; }

export interface ShopEntryAvailability {
  entryId: string;
  revealed: boolean;
  conditionSatisfied: boolean;
  stockRemaining: number | null;
  status: 'hidden' | 'locked' | 'available' | 'sold-out';
}

export interface ShopPreview {
  resourceCosts: Record<string, number>;
  itemCosts: Record<string, number>;
  resourceGrants: Record<string, number>;
  itemGrants: Record<string, number>;
}

/** Shop Workspace 只读端口：目录、余额展示配置与动态可用性/价格查询。 */
export interface ShopQueryPort {
  getShop(shopId: string): Readonly<ShopDef> | null;
  listResourceDisplays(): readonly ResourceDisplayDef[];
  availability(shopId: string, spotId: string, entryId: string): ShopEntryAvailability | null;
  preview(shopId: string, cart: readonly ShopCartLine[]): ShopPreview | null;
}
