import { Expr, cond, value } from '../../engine/types';
import type { ShopDef } from '../../data-services/contracts/shop';
import { Resource } from '../types/ids';

/** 默认内容的 Shop 样例：资源购买、物品交换、条件/Reveal、限购和动态单价。 */
export const baseShops: ShopDef[] = [{
  id: 'base:shop:abydos-cafe',
  name: '阿比多斯咖啡角',
  description: '用信用点或探索物资换取补给。',
  theme: { tokens: { primary: '#d97706', accent: '#facc15', panel: '#fff8e7' } },
  sections: [{ id: 'daily', name: '日常补给' }, { id: 'exchange', name: '物资交换' }],
  entries: [
    {
      id: 'energy-drink', name: '战术能量饮料', sectionId: 'daily',
      offer: { type: 'item', itemId: 'base:item:energy_drink', amount: 1 },
      price: { unitCosts: [{ type: 'resource', resourceId: Resource.Credit, amount: Expr.const(25) }] },
      stock: { type: 'limited', max: 3 },
      purchase: { quantity: 'multiple', maxPerCheckout: 3, scope: { lifetime: 'init', owner: 'shop' } },
    },
    {
      id: 'field-note-exchange', name: '调查记录兑换', sectionId: 'exchange',
      offer: { type: 'item', itemId: 'base:item:field_note', amount: 1 },
      price: { unitCosts: [{ type: 'item', itemId: 'base:item:energy_drink', amount: Expr.const(1) }] },
    },
    {
      id: 'premium-drink', name: '高级能量饮料', sectionId: 'daily', visibility: 'show-locked',
      condition: { type: 'AND', conditions: [cond('resource', Resource.Credit, '>=', 100)] },
      offer: { type: 'item', itemId: 'base:item:premium_drink', amount: 1 },
      price: { unitCosts: [{ type: 'resource', resourceId: Resource.Credit, amount: Expr.const(80) }] },
      stock: { type: 'limited', max: 1 },
      purchase: { scope: { lifetime: 'global', owner: 'shop' } },
    },
    {
      id: 'mystery-fragment', name: '神秘碎片', sectionId: 'exchange', visibility: 'hidden-until-available',
      revealTriggers: [{ reveal: 'existence', condition: cond('resource', Resource.Credit, '>=', 500) }],
      offer: { type: 'item', itemId: 'base:item:mystery_fragment', amount: 1 },
      price: { unitCosts: [{ type: 'resource', resourceId: Resource.Credit, amount: Expr.add(Expr.const(40), Expr.val(value('res', { resource: Resource.Credit }))) }] },
      stock: { type: 'limited', max: 1 },
      purchase: { scope: { lifetime: 'init', owner: 'spot' } },
    },
  ],
}];
