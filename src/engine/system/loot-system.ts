// ============================================================
// engine/loot-system.ts — 掉落表抽选系统
// ============================================================

import {
  DropTableEntry,
  DropTableDef,
  PlayerState,
} from '../types';
import { Registry } from '../registry/registry';
import { ConditionSystem } from '../expression/condition-system';
import { EventBus } from '../core/event-bus';

export class LootSystem {
  private registry: Registry;
  private conditionSystem: ConditionSystem;
  constructor(registry: Registry, conditionSystem: ConditionSystem, _legacyEventBus?: EventBus) {
    this.registry = registry;
    this.conditionSystem = conditionSystem;
  }

  /**
   * 从掉落表中随机抽选物品
   * @param table 掉落表条目数组
   * @param state 当前玩家状态
   * @returns 抽选结果 Map<itemId, count>
   */
  roll(table: DropTableEntry[], state: PlayerState): Map<string, number> {
    const results = new Map<string, number>();

    // 筛选满足条件的条目
    const eligible = table.filter(entry => {
      if (!entry.condition) return true;
      return this.conditionSystem.evaluateGroup(entry.condition, state);
    });

    if (eligible.length === 0) return results;

    // 计算总权重
    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight <= 0) return results;

    // 加权随机抽选
    let roll = Math.random() * totalWeight;
    for (const entry of eligible) {
      roll -= entry.weight;
      if (roll <= 0) {
        // 随机数量
        const count = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
        results.set(entry.itemId, count);

        break;
      }
    }

    return results;
  }

  /** 按注册的 DropTable 定义执行保底与多次抽选。 */
  rollTable(tableId: string, state: PlayerState): Map<string, number> {
    const table = this.registry.dropTables.get(tableId);
    if (!table) return new Map();
    if (table.condition && !this.conditionSystem.evaluateGroup(table.condition, state)) {
      return new Map();
    }

    const results = new Map<string, number>();
    const add = (itemId: string, count: number) => {
      results.set(itemId, (results.get(itemId) ?? 0) + count);
    };
    for (const item of table.guaranteed ?? []) add(item.itemId, item.count);

    for (let i = 0; i < table.maxRolls; i++) {
      const rolled = this.roll(table.entries, state);
      for (const [itemId, count] of rolled) add(itemId, count);
    }
    return results;
  }
}
