// ============================================================
// engine/event-bus.ts — 事件总线
// ============================================================

import { GameEvent, EventHandler } from './types';

type EventFor<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private wildcardHandlers: EventHandler[] = [];
  private queue: GameEvent[] = [];
  private flushing = false;

  /** 注册特定类型事件的处理器 */
  on<T extends GameEvent['type']>(
    eventType: T,
    handler: (event: EventFor<T>) => void,
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler);
    // 返回取消注册函数
    return () => this.off(eventType, handler as EventHandler);
  }

  /** 注册所有事件的通配处理器 */
  onAny(handler: EventHandler): () => void {
    this.wildcardHandlers.push(handler);
    return () => {
      const idx = this.wildcardHandlers.indexOf(handler);
      if (idx >= 0) this.wildcardHandlers.splice(idx, 1);
    };
  }

  /** 取消注册 */
  off(eventType: GameEvent['type'], handler: EventHandler): void {
    const list = this.handlers.get(eventType);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  /** 发送事件 (可能排队) */
  emit(event: GameEvent): void {
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

  /** 立即派发单个事件 */
  private dispatch(event: GameEvent): void {
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
    this.queue = [];
  }
}
