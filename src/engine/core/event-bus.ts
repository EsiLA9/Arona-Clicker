// ============================================================
// engine/event-bus.ts — 事件总线
// ============================================================

import type { GameEvent } from '../types';
import type { EngineEventShape, EventOf } from '../contracts/event';

export type EventBusHandler<TEvent extends EngineEventShape = GameEvent> = (event: TEvent) => void;

export class EventBus<TEvent extends EngineEventShape = GameEvent> {
  private handlers: Map<string, EventBusHandler<TEvent>[]> = new Map();
  private wildcardHandlers: EventBusHandler<TEvent>[] = [];
  private queue: TEvent[] = [];
  private flushing = false;

  /** 注册特定类型事件的处理器 */
  on<T extends TEvent['type']>(
    eventType: T,
    handler: (event: EventOf<TEvent, T>) => void,
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventBusHandler<TEvent>);
    // 返回取消注册函数
    return () => this.off(eventType, handler as EventBusHandler<TEvent>);
  }

  /** 注册所有事件的通配处理器 */
  onAny(handler: EventBusHandler<TEvent>): () => void {
    this.wildcardHandlers.push(handler);
    return () => {
      const idx = this.wildcardHandlers.indexOf(handler);
      if (idx >= 0) this.wildcardHandlers.splice(idx, 1);
    };
  }

  /** 取消注册 */
  off(eventType: TEvent['type'], handler: EventBusHandler<TEvent>): void {
    const list = this.handlers.get(eventType);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  /** 发送事件 (可能排队) */
  emit(event: TEvent): void {
    if (this.flushing) {
      this.queue.push(event);
    } else {
      this.dispatch(event);
    }
  }

  /** 批量 flush 队列 */
  flush(): void {
    if (this.flushing) return;
    this.flushing = true;
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0);
      for (const event of batch) {
        this.dispatch(event);
      }
    }
    this.flushing = false;
  }

  /** 只清除尚未派发的事件，不影响长寿命订阅者。 */
  clearQueue(): void {
    this.queue = [];
  }

  /** 立即派发单个事件 */
  private dispatch(event: TEvent): void {
    const list = this.handlers.get(event.type);
    if (list) {
      for (const h of list) h(event);
    }
    for (const h of this.wildcardHandlers) h(event);
  }

  /** 清除所有处理器 */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers = [];
    this.clearQueue();
  }
}
