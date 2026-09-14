// ============================================================
// engine/visibility-index.ts — 可见性反向依赖索引
// 「事件 → 受影响实体」反向索引 + 事件到达时收集受标脏实体集合。
// 依赖登记/命中语义委托给共享的 ConditionDepIndex（ADR-002 rev2）。
// ============================================================

import { GameEvent } from '../types';
import type { RevealRegistryContext } from '../contracts/reveal';
import { ConditionDepIndex } from '../expression/condition-deps';
import { EntityKind, EntityKey, DefWithTriggers } from './visibility-eval';

/** 反向依赖索引；输入 registry，输出按事件收集受影响实体的集合。 */
export class VisibilityIndex {
  private readonly deps = new ConditionDepIndex<EntityKey>();

  constructor(private readonly registry: RevealRegistryContext) {}

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

  /**
   * 重新登记一个 Spot 的 existence 依赖。
   *
   * Registry 已在事件派发前完成提交，因此这里始终从当前 registry 读取，
   * 不保留旧 Definition 的副本。
   */
  replaceSpot(spotId: string): boolean {
    const key = `spots:${spotId}`;
    this.deps.unregister(key);
    const spot = this.registry.spots.get(spotId);
    if (!spot) return false;
    this.indexEntry(key, spot);
    return true;
  }

  /** 移除一个 Spot 的全部 existence 依赖。 */
  removeSpot(spotId: string): void {
    this.deps.unregister(`spots:${spotId}`);
  }

  /** 给定事件，返回需标脏的全部实体 key。 */
  collectAffected(e: GameEvent): Set<EntityKey> {
    return this.deps.affected(e);
  }

  private indexEntries(entries: ReadonlyMap<string, DefWithTriggers>, kind: EntityKind): void {
    for (const [id, def] of entries) {
      if (!def) continue;
      this.indexEntry(`${kind}:${id}`, def);
    }
  }

  private indexEntry(key: EntityKey, def: DefWithTriggers): void {
    for (const gate of (def.revealTriggers ?? []).filter(t => t.reveal === 'existence')) {
      if (gate.condition) this.deps.register(key, gate.condition);
    }
  }
}
