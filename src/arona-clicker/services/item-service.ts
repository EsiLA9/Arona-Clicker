// ============================================================
// arona-clicker/services/item-service.ts — 物品领域服务（发放/使用/掉落表）
// 从 GameInstance 门面拆出。稳定 API 保留在 GameInstance 上作门面委托。
// ============================================================

import { ItemId } from '../../engine/types';
import type { PlayerState } from '../types/state';
import type { UseItemResult } from '../contracts/results';
import { Registry } from '../../data-services/registry/registry';
import { ConditionSystem } from '../../engine/expression/condition-system';
import { EffectEngine } from '../../engine/effect/effect-engine';
import { LootSystem } from './loot-system';
import type { InventoryMutationPort } from '../contracts/mutation';
import { DevLog } from '../../engine/core/dev-log';

export interface ItemServiceOptions {
  registry: Registry;
  mutations: InventoryMutationPort;
  conditionSystem: ConditionSystem;
  effectEngine: EffectEngine;
  lootSystem: LootSystem;
  devLog: DevLog;
  getState: () => PlayerState;
}

export class ItemService {
  constructor(private readonly opts: ItemServiceOptions) {}

  /** 发放物品并执行其获得时效果。 */
  giveItem(itemId: ItemId, count: number): boolean {
    const item = this.opts.registry.items.get(itemId);
    if (!item || count <= 0) {
      this.opts.devLog.record(`发放物品失败：${itemId}`, { source: 'inventory', level: 'error' });
      return false;
    }
    this.opts.mutations.addItem(itemId, count, item.maxStack);
    if (item.pickupEffects) this.opts.effectEngine.applyEffects(item.pickupEffects);
    return true;
  }

  /** 使用一个可使用物品。 */
  useItem(itemId: ItemId): UseItemResult {
    const state = this.opts.getState();
    const item = this.opts.registry.items.get(itemId);
    if (!item) {
      this.opts.devLog.record(`使用物品失败：${itemId}`, { source: 'inventory', level: 'error', details: 'NotFound' });
      return { success: false, itemId, error: 'NotFound' };
    }
    if (item.type !== 'consumable') {
      this.opts.devLog.record(`使用物品失败：${item.name}`, { source: 'inventory', level: 'warning', details: 'NotUsable' });
      return { success: false, itemId, error: 'NotUsable' };
    }
    if ((state.inventory[itemId] ?? 0) < 1) {
      this.opts.devLog.record(`使用物品失败：${item.name}`, { source: 'inventory', level: 'warning', details: 'NotOwned' });
      return { success: false, itemId, error: 'NotOwned' };
    }
    if (item.useCondition && !this.opts.conditionSystem.evaluateGroup(item.useCondition, state)) {
      this.opts.devLog.record(`使用物品失败：${item.name}`, { source: 'inventory', level: 'warning', details: 'ConditionNotMet' });
      return { success: false, itemId, error: 'ConditionNotMet' };
    }
    if (!this.opts.mutations.removeItem(itemId, 1)) {
      this.opts.devLog.record(`使用物品失败：${item.name}`, { source: 'inventory', level: 'warning', details: 'NotOwned' });
      return { success: false, itemId, error: 'NotOwned' };
    }
    if (item.useEffects) this.opts.effectEngine.applyEffects(item.useEffects);
    return { success: true, itemId };
  }

  /** 执行注册掉落表并将结果发放到背包。 */
  rollDropTable(tableId: string): Map<string, number> {
    const results = this.opts.lootSystem.rollTable(tableId, this.opts.getState());
    for (const [itemId, count] of results) this.giveItem(itemId, count);
    return results;
  }
}
