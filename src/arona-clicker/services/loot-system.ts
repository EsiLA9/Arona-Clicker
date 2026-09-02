import type { DropTableEntry } from '../../data-services/contracts/drop-table';
import type { PlayerState } from '../types/state';
import { Registry } from '../../data-services/registry/registry';
import { ConditionSystem } from '../../engine/expression/condition-system';
import type { EventBus } from '../../engine/core/event-bus';

export class LootSystem {
  constructor(private readonly registry: Registry, private readonly conditionSystem: ConditionSystem, _legacyEventBus?: EventBus) {}
  roll(table: DropTableEntry[], state: PlayerState): Map<string, number> {
    const results = new Map<string, number>();
    const eligible = table.filter(entry => !entry.condition || this.conditionSystem.evaluateGroup(entry.condition, state));
    if (eligible.length === 0) return results;
    const totalWeight = eligible.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return results;
    let roll = Math.random() * totalWeight;
    for (const entry of eligible) {
      roll -= entry.weight;
      if (roll <= 0) {
        results.set(entry.itemId, entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1)));
        break;
      }
    }
    return results;
  }
  rollTable(tableId: string, state: PlayerState): Map<string, number> {
    const table = this.registry.dropTables.get(tableId);
    if (!table || (table.condition && !this.conditionSystem.evaluateGroup(table.condition, state))) return new Map();
    const results = new Map<string, number>();
    const add = (itemId: string, count: number) => results.set(itemId, (results.get(itemId) ?? 0) + count);
    for (const item of table.guaranteed ?? []) add(item.itemId, item.count);
    for (let i = 0; i < table.maxRolls; i++) for (const [itemId, count] of this.roll(table.entries, state)) add(itemId, count);
    return results;
  }
}
