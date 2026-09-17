import type { ConditionGroup, ValueExpression } from '../../engine/types/expression';
import type { ItemId } from '../../engine/types/ids';

/** 一项确定支付资产；同一 PaymentOption 内的 costs 为 AND。 */
export type CostItem =
  | { type: 'resource'; resourceId: string; amount: ValueExpression }
  | { type: 'item'; itemId: ItemId; amount: ValueExpression };

/** 可被条件解锁的支付方案；多个方案之间为 OR。 */
export interface PaymentOptionDef {
  /** 在同一操作内稳定且唯一，不能依赖数组位置。 */
  id: string;
  /** UI 展示名；缺省由调用方按方案序号生成。 */
  label?: string;
  /** 方案可用条件；余额/库存仍在 checkout 时独立检查。 */
  condition?: ConditionGroup;
  /** 同时支付的资源/物品列表。 */
  costs: CostItem[];
}
