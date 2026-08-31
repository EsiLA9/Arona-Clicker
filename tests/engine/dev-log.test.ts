import { describe, expect, test } from 'vitest';
import { DevLog } from '../../src/engine/core/dev-log';

describe('DevLog', () => {
  test('keeps newest entries first and returns snapshots', () => {
    const log = new DevLog({ maxEntries: 2, clock: () => 123 });
    log.record('old', { source: 'test' });
    log.record('new', { level: 'success', source: 'test', frame: 2 });
    log.record('latest', { level: 'warning', source: 'test' });

    expect(log.getEntries().map(entry => entry.message)).toEqual(['latest', 'new']);
    expect(log.getEntries()[0]).toMatchObject({ timestamp: 123, level: 'warning' });
  });

  test('maps production and spending events to useful messages', () => {
    const log = new DevLog({ clock: () => 123 });
    log.recordEvent({ type: 'resourceChanged', resource: 'credit', delta: -50, newValue: 10 }, 4);
    // spotProduced 不再逐条记录，避免刷屏；由 recordTick 汇总（每 30 帧一条）
    log.recordEvent({ type: 'spotProduced', spotId: 'test:spot:printer', resource: 'credit', amount: 5 }, 5);
    log.recordEvent({ type: 'tick', frame: 5 }, 5);
    // 非整 30 帧不产生汇总日志
    log.recordTick({ frame: 5, productions: [{ spotId: 'test:spot:printer', resource: 'credit', amount: 5 }] });

    expect(log.getEntries()).toMatchObject([
      { source: 'resource', message: '消耗 50 credit', frame: 4 },
    ]);
  });

  test('summarizes production only on cadence frames', () => {
    const log = new DevLog({ clock: () => 123 });
    // 整 30 帧记录汇总
    log.recordTick({ frame: 30, productions: [{ spotId: 'test:spot:printer', resource: 'credit', amount: 5 }] });
    expect(log.getEntries()).toMatchObject([
      { source: 'tick', message: '第 30 帧完成 1 个生产结算', details: '5 total output', frame: 30 },
    ]);

    // 非整 30 帧且零产出时不记录
    log.recordTick({ frame: 31, productions: [] });
    expect(log.getEntries()).toHaveLength(1);
  });

  test('verbose records every frame, positive income, and per-spot production', () => {
    const log = new DevLog({ verbose: true, clock: () => 123 });

    // 正入账也记录
    log.recordEvent({ type: 'resourceChanged', resource: 'credit', delta: 50, newValue: 100 }, 6);
    // 每条 spot 生产都记录
    log.recordEvent({ type: 'spotProduced', spotId: 'test:spot:printer', resource: 'credit', amount: 5 }, 7);
    // 非整 30 帧也记录 tick 汇总
    log.recordTick({ frame: 7, productions: [{ spotId: 'test:spot:printer', resource: 'credit', amount: 5 }] });

    const messages = log.getEntries().map(entry => entry.message);
    expect(messages).toEqual([
      '第 7 帧完成 1 个生产结算',
      'test:spot:printer 产出 5 credit',
      '入账 50 credit',
    ]);
  });

  test('verbose defaults to a large capacity', () => {
    const log = new DevLog({ verbose: true, clock: () => 123 });
    for (let i = 0; i < 500; i++) log.record(`m${i}`);
    expect(log.getEntries()).toHaveLength(500);
  });

  test('export produces a full JSON snapshot in chronological order', () => {
    const log = new DevLog({ verbose: true, clock: () => 123 });
    log.recordEvent({ type: 'resourceChanged', resource: 'credit', delta: 50, newValue: 100 }, 1);
    log.recordEvent({ type: 'spotProduced', spotId: 'test:spot:printer', resource: 'credit', amount: 5 }, 2);

    const json = log.export({ frame: 2, resources: { credit: 100 } });
    const parsed = JSON.parse(json) as {
      exportedAt: string;
      verbose: boolean;
      count: number;
      frame: number;
      resources: { credit: number };
      entries: Array<{ message: string; frame?: number }>;
    };
    expect(parsed.verbose).toBe(true);
    expect(parsed.count).toBe(2);
    expect(parsed.frame).toBe(2);
    expect(parsed.resources.credit).toBe(100);
    // 按时间正序：先入账，后产出
    expect(parsed.entries.map(entry => entry.message)).toEqual([
      '入账 50 credit',
      'test:spot:printer 产出 5 credit',
    ]);
    expect(parsed.exportedAt).toBe('1970-01-01T00:00:00.123Z');
  });
});
