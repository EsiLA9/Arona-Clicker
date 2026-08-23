// ============================================================
// engine/event-driven-reactor.ts — 事件驱动反应器共享基底（ADR-002 rev2）
//
// 「声明式依赖 × 分桶事件订阅 × 命中动作」的引擎级骨架。
// 订阅一律按事件类型分桶（禁止 onAny 全量扫描，见 docs-818/09 P0-1）：
// 每个 reactor 只为自己声明依赖的事件类型付匹配成本。
//
// 实例：TriggerSystem（命中=执行 effects）、VisibilityEngine（命中=标脏）、
// AffectorEngine 条件索引（命中=定向 recheck）。
// ============================================================

import { GameEvent } from './types';
import { EventBus } from './event-bus';

export abstract class EventDrivenReactor {
  private readonly subscribed = new Set<GameEvent['type']>();

  constructor(protected readonly eventBus: EventBus) {}

  /** 分桶订阅本 reactor 依赖的事件类型；幂等，可在索引重建后补充调用。 */
  protected subscribeTo(types: Iterable<GameEvent['type']>): void {
    for (const type of types) {
      if (this.subscribed.has(type)) continue;
      this.subscribed.add(type);
      this.eventBus.on(type, event => {
        if (event.type !== type) return;
        this.onEvent(type, event);
      });
    }
  }

  /** 事件到达（仅已订阅类型）：由子类实现依赖匹配与命中动作。 */
  protected abstract onEvent(type: GameEvent['type'], event: GameEvent): void;
}
