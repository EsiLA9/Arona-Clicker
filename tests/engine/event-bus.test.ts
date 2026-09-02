// ============================================================
// engine/event-bus.test.ts
// ============================================================
import { describe, test, expect, vi } from 'vitest';
import { EventBus } from '../../src/engine/core/event-bus';
import { GameEvent } from '../../src/engine/types';

describe('EventBus', () => {
  test('should register and dispatch events', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('tick', handler);
    bus.emit({ type: 'tick', frame: 42 });
    expect(handler).toHaveBeenCalledWith({ type: 'tick', frame: 42 });
  });

  test('should support wildcard handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.onAny(handler);
    bus.emit({ type: 'tick', frame: 1 });
    bus.emit({ type: 'resourceChanged', resource: 'credit', delta: 10, newValue: 10 });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  test('should filter events by type', () => {
    const bus = new EventBus();
    const tickHandler = vi.fn();
    const resHandler = vi.fn();

    bus.on('tick', tickHandler);
    bus.on('resourceChanged', resHandler);

    bus.emit({ type: 'tick', frame: 1 });
    expect(tickHandler).toHaveBeenCalledTimes(1);
    expect(resHandler).toHaveBeenCalledTimes(0);
  });

  test('should support off (unsubscription)', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('tick', handler);
    bus.emit({ type: 'tick', frame: 1 });
    unsub();
    bus.emit({ type: 'tick', frame: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('should support off on unregistered handler gracefully', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    expect(() => bus.off('tick', handler)).not.toThrow();
  });

  test('should queue events during flush', () => {
    const bus = new EventBus();
    const received: number[] = [];

    bus.on('tick', (e) => {
      received.push((e as any).frame);
      if ((e as any).frame === 1) {
        bus.emit({ type: 'tick', frame: 2 });
      }
    });

    bus.emit({ type: 'tick', frame: 1 });
    bus.flush();
    expect(received).toEqual([1, 2]);
  });

  test('should clear all handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('tick', handler);
    bus.clear();
    bus.emit({ type: 'tick', frame: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  test('should dispatch to multiple handlers of same type', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('tick', h1);
    bus.on('tick', h2);
    bus.emit({ type: 'tick', frame: 1 });
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  test('支持不依赖 GameEvent 的自定义事件联合类型', () => {
    type CustomEvent =
      | { type: 'started'; source: string }
      | { type: 'progress'; value: number };
    const bus = new EventBus<CustomEvent>();
    const handler = vi.fn((event: { type: 'progress'; value: number }) => event.value);
    bus.on('progress', handler);
    bus.emit({ type: 'progress', value: 3 });
    expect(handler).toHaveBeenCalledWith({ type: 'progress', value: 3 });
  });
});
