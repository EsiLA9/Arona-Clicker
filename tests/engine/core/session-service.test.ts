import { afterEach, describe, expect, test, vi } from 'vitest';
import { EventBus } from '../../../src/engine/core/event-bus';
import { DevLog } from '../../../src/engine/core/dev-log';
import { EffectEngine } from '../../../src/engine/effect/effect-engine';
import { SessionService } from '../../../src/engine/runtime/session-service';
import { StateMutationService } from '../../../src/arona-clicker/state/state-mutation-service';

describe('SessionService offline base', () => {
  const now = vi.spyOn(Date, 'now');

  afterEach(() => {
    now.mockReset();
  });

  test('读档时间戳在 start 的离线补算前保持有效', () => {
    now.mockReturnValue(10_000);
    const eventBus = new EventBus();
    const mutations = new StateMutationService(eventBus);
    const effectEngine = new EffectEngine(mutations);
    const doTick = vi.fn(() => ({ frame: 1, productions: [] }));
    const doOfflineTicks = vi.fn();
    const session = new SessionService({
      doTick,
      doOfflineTicks,
      devLog: new DevLog({ clock: () => 10_000 }),
      eventBus,
      effectEngine,
      getState: () => ({ resources: {}, spotLevels: {}, spotManagers: {}, flags: {} }),
    });

    session.setLastTick(0);
    session.start();
    expect(doOfflineTicks.mock.calls).toEqual([[10]]);
    expect(doTick).not.toHaveBeenCalled();
    session.stop();
  });

  test('离线提交后的通知抛错，重试启动不会重复补算', () => {
    now.mockReturnValue(10_000);
    const eventBus = new EventBus();
    const mutations = new StateMutationService(eventBus);
    const doOfflineTicks = vi.fn(() => { throw new Error('notification failed'); });
    const session = new SessionService({
      doTick: () => ({ frame: 1, productions: [] }),
      doOfflineTicks,
      devLog: new DevLog(),
      eventBus,
      effectEngine: new EffectEngine(mutations),
      getState: () => ({ resources: {}, spotLevels: {}, spotManagers: {}, flags: {} }),
    });

    session.setLastTick(0);
    expect(() => session.start()).toThrow('notification failed');
    expect(session.running).toBe(false);
    session.start();
    expect(doOfflineTicks.mock.calls).toHaveLength(1);
    session.stop();
  });

  test('普通 stop/start 不把上一次停止前的时间当作离线补算', () => {
    now.mockReturnValue(10_000);
    const eventBus = new EventBus();
    const mutations = new StateMutationService(eventBus);
    const effectEngine = new EffectEngine(mutations);
    const doOfflineTicks = vi.fn();
    const session = new SessionService({
      doTick: () => ({ frame: 1, productions: [] }),
      doOfflineTicks,
      devLog: new DevLog({ clock: () => 10_000 }),
      eventBus,
      effectEngine,
      getState: () => ({ resources: {}, spotLevels: {}, spotManagers: {}, flags: {} }),
    });

    session.start();
    session.stop();
    now.mockReturnValue(20_000);
    session.start();
    expect(doOfflineTicks).not.toHaveBeenCalled();
    session.stop();
  });
});
