import type { ConditionGroup, Effect, ValueExpression } from '../../engine/types/expression';
import type { ExtraCompound } from '../../engine/types/extra';
import type { ThemeDef } from '../../engine/types/theme';
import type { ItemId } from '../../engine/types/ids';
import type { RevealTrigger } from '../../engine/types/reveal';

export type ShopId = string;

export interface ShopDef {
  /** @label ID */
  id: ShopId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /** @label 商店条件 */
  condition?: ConditionGroup;
  /** @label 商店主题 */
  theme?: ThemeDef;
  /** @label 分区 */
  sections?: ShopSectionDef[];
  /** @label 商品 */
  entries: ShopEntryDef[];
  extra?: ExtraCompound;
}

export interface ShopSectionDef {
  id: string;
  name: string;
  description?: string;
  condition?: ConditionGroup;
}

export interface ShopEntryDef {
  /** 在所属 Shop 内稳定且唯一；一旦产生购买记录不可改作其他商品。 */
  id: string;
  name: string;
  description?: string;
  sectionId?: string;
  offer: ShopOffer;
  price: ShopPrice;
  condition?: ConditionGroup;
  revealTriggers?: RevealTrigger[];
  /** 未满足发现/展示条件时隐藏；否则保留卡片并显示锁定原因。 */
  visibility?: 'hidden-until-available' | 'show-locked';
  stock?: ShopStock;
  purchase?: ShopPurchasePolicy;
  /** 仅允许在 transaction-safe 子集内的 Effect；P2 负责编译与拒绝。 */
  onPurchase?: Effect[];
  extra?: ExtraCompound;
}

export type ShopOffer =
  | { type: 'item'; itemId: ItemId; amount: number }
  | { type: 'resource'; resourceId: string; amount: ValueExpression };

export interface ShopPrice {
  /** 每件商品的支付物；checkout 按 quantity 乘算并聚合。 */
  unitCosts: ShopCost[];
}

export type ShopCost =
  | { type: 'item'; itemId: ItemId; amount: ValueExpression }
  | { type: 'resource'; resourceId: string; amount: ValueExpression };

export type ShopStock =
  | { type: 'unlimited' }
  /** 单次库存是 limited: 1 的便捷写法。 */
  | { type: 'once' }
  | { type: 'limited'; max: number };

export interface ShopPurchasePolicy {
  min?: number;
  maxPerCheckout?: number;
  quantity?: 'single' | 'multiple';
  scope?: ShopPurchaseScope;
}

export interface ShopPurchaseScope {
  lifetime: 'global' | 'init';
  owner: 'shop' | 'spot';
}

/** 已落实的购买事实；库存余量一律由 ShopStock 与此字段派生。 */
export interface ShopPurchaseRecord {
  purchasedQuantity: number;
}
