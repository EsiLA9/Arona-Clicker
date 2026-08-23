// ============================================================
// engine/visibility-index.ts — 可见性反向依赖索引
// 「事件 → 受影响实体」反向索引 + 事件到达时收集受标脏实体集合。
// 依赖登记/命中语义委托给共享的 ConditionDepIndex（ADR-002 rev2）。
// ============================================================

import { GameEvent } from '../types';
import { Registry } from '../registry/registry';
import { ConditionDepIndex } from '../expression/condition-deps';
import { EntityKind, EntityKey, DefWithTriggers } from './visibility-eval';

/** 反向依赖索引；输入 registry，输出按事件收集受影响实体的集合。 */
export class VisibilityIndex {
  private readonly deps = new ConditionDepIndex<EntityKey>();

  constructor(private readonly registry: Registry) {}

  /** 重建反向索引（注册表加载/热替换后调用）。 */
  build(): void {
    this.deps.clear();
    this.indexEntries(this.registry.inits, 'inits');
    this.indexEntries(this.registry.areas, 'areas');
    this.indexEntries(this.registry.spots, 'spots');
    this.indexEntries(this.registry.enhancements, 'enhancements');
    this.indexEntries(this.registry.items, 'items');
    // stories 始终可见，不参与索引
  }

  /** 给定事件，返回需标脏的全部实体 key。 */
  collectAffected(e: GameEvent): Set<EntityKey> {
    return this.deps.affected(e);
  }

  private indexEntries(entries: ReadonlyMap<string, DefWithTriggers>, kind: EntityKind): void {
    for (const [id, def] of entries) {
      if (!def) continue;
      const gates = (def.revealTriggers ?? []).filter(t => t.reveal === 'existence');
      for (const g of gates) {
        if (!g.condition) continue;
        this.deps.register(`${kind}:${id}`, g.condition);
      }
    }
  }
}
