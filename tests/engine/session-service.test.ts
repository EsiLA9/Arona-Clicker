import { afterEach, describe, expect, test, vi } from 'vitest';
import { EventBus } from '../../src/engine/core/event-bus';
import { DevLog } from '../../src/engine/core/dev-log';
import { EffectEngine } from '../../src/engine/effect/effect-engine';
import { SessionService } from '../../src/engine/runtime/session-service';
import { StateMutationService } from '../../src/arona-clicker/state/state-mutation-service';

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
    let frames = 0;
    const session = new SessionService({
      doTick: () => ({ frame: ++frames, productions: [{ spotId: 'spot', resource: 'credit', amount: 1 }] }),
      devLog: new DevLog({ clock: () => 10_000 }),
      eventBus,
      effectEngine,
      getState: () => ({ resources: {}, spotLevels: {}, spotManagers: {}, flags: {} }),
    });

    session.setLastTick(0);
    session.start();
    expect(frames).toBe(10);
    session.stop();
  });

  test('普通 stop/start 不把上一次停止前的时间当作离线补算', () => {
    now.mockReturnValue(10_000);
    const eventBus = new EventBus();
    const mutations = new StateMutationService(eventBus);
    const effectEngine = new EffectEngine(mutations);
    let frames = 0;
    const session = new SessionService({
      doTick: () => ({ frame: ++frames, productions: [{ spotId: 'spot', resource: 'credit', amount: 1 }] }),
      devLog: new DevLog({ clock: () => 10_000 }),
      eventBus,
      effectEngine,
      getState: () => ({ resources: {}, spotLevels: {}, spotManagers: {}, flags: {} }),
    });

    session.start();
    session.stop();
    now.mockReturnValue(20_000);
    session.start();
    expect(frames).toBe(0);
    session.stop();
  });
});
