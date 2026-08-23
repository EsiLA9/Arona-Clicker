// ============================================================
// engine/stats.test.ts — 三层统计数据 + 函数式统计 DSL
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { and } from '../../src/engine/types';
import { parseStatCall } from '../../src/engine/stat-dsl';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const ITEM = 'base:item:energy_drink';

describe('Stat DSL (受限函数库)', () => {
  test('parses keyed, non-keyed, and init-scoped calls', () => {
    expect(parseStatCall('$GlobalProducedAmount base:resource:credit')).toMatchObject({
      fn: '$GlobalProducedAmount',
      def: { scope: 'global', metric: 'produced' },
      key: 'base:resource:credit',
    });
    expect(parseStatCall('$CurrentRunCompletedStories')).toMatchObject({
      def: { scope: 'currentRun', metric: 'storiesCompleted' },
    });
    expect(parseStatCall('$InitProducedAmount base:init:schale_office base:resource:credit')).toMatchObject({
      def: { scope: 'init', metric: 'produced' },
      initId: 'base:init:schale_office',
      key: 'base:resource:credit',
    });
  });

  test('rejects unknown functions or missing args', () => {
    expect(parseStatCall('$Nope base:resource:credit')).toBeNull();
    expect(parseStatCall('$GlobalProducedAmount')).toBeNull();
    expect(parseStatCall('$InitProducedAmount base:resource:credit')).toBeNull(); // 缺 initId
  });
});

describe('StatsService (三层统计)', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('recordResourceChange updates global, current init, run, and session resources', () => {
    game.mutations.changeResource(CREDIT, 50);
    game.mutations.changeResource(CREDIT, -20);

    const stats = game.getView().stats;
    expect(stats.global.produced[CREDIT]).toBe(50);
    expect(stats.global.consumed[CREDIT]).toBe(20);
    expect(stats.init[OFFICE]!.produced[CREDIT]).toBe(50);
    expect(stats.init[OFFICE]!.consumed[CREDIT]).toBe(20);
    expect(stats.session.counters.produced[CREDIT]).toBe(50);
    expect(stats.session.resources[CREDIT]).toBe(30);
    expect(stats.session.currentInit).toBe(OFFICE);
  });

  test('item collection and usage are counted separately', () => {
    game.giveItem(ITEM, 3);
    game.useItem(ITEM);

    const stats = game.getView().stats;
    expect(stats.global.itemsCollected[ITEM]).toBe(3);
    expect(stats.global.itemsUsed[ITEM]).toBe(1);
    expect(stats.session.counters.itemsCollected[ITEM]).toBe(3);
  });

  test('spot first unlock vs later upgrade are distinguished', () => {
    const before = game.getView().stats.global.spotsUnlocked;
    expect(before).toBeGreaterThan(0);
    game.mutations.setSpotLevel('base:spot:credit_printer', 2); // 升级

    const stats = game.getView().stats;
    expect(stats.global.spotsUnlocked).toBe(before);
    expect(stats.global.spotsUpgraded).toBe(1);
    expect(stats.session.counters.spotsUpgraded).toBe(1);
  });

  test('per-init stats stay isolated across init switches; run resets on enter', () => {
    game.mutations.changeResource(CREDIT, 100);
    const runProducedAfterFirst = game.getView().stats.session.counters.produced[CREDIT];

    game.unlockInit(MILLENNIUM);
    game.enterInit(MILLENNIUM);
    game.mutations.changeResource(CREDIT, 10);

    const stats = game.getView().stats;
    // global 贯穿所有 init
    expect(stats.global.produced[CREDIT]).toBe(110);
    // 各 init 内数据相互隔离
    expect(stats.init[OFFICE]!.produced[CREDIT]).toBe(100);
    expect(stats.init[MILLENNIUM]!.produced[CREDIT]).toBe(10);
    // 切换 init → 本次游玩重置
    expect(stats.session.counters.produced[CREDIT]).toBe(10);
    expect(runProducedAfterFirst).toBe(100);
    expect(stats.session.currentInit).toBe(MILLENNIUM);
  });

  test('events emitted by mutations carry a stats context', () => {
    let captured: unknown = null;
    const unsub = game.eventBus.on('resourceChanged', event => {
      captured = (event as { stats?: unknown }).stats ?? null;
    });
    game.mutations.changeResource(CREDIT, 5);
    unsub();

    const ctx = captured as { global: { produced: Record<string, number> }; currentInit: string | null };
    expect(ctx.global.produced[CREDIT]).toBe(5);
    expect(ctx.currentInit).toBe(OFFICE);
  });

  test('tick increments framesActive (global/run) and framesInInit', () => {
    game.tick();
    game.tick();

    const stats = game.getView().stats;
    expect(stats.global.framesActive).toBe(2);
    expect(stats.session.counters.framesActive).toBe(2);
    expect(stats.init[OFFICE]!.framesInInit).toBe(2);
  });

  test('tick production is recorded into stats via the shared mutations', () => {
    // 修复回归：tick-system / effect-engine 必须走带统计的同一写入口
    const before = game.getView().stats.global.produced[CREDIT] ?? 0;
    game.tick();
    const after = game.getView().stats.global.produced[CREDIT] ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  test('evaluate resolves function DSL against global / run / init', () => {
    game.mutations.changeResource(CREDIT, 40);
    const s = game.statsService;
    expect(s.evaluate(`$GlobalProducedAmount ${CREDIT}`)).toBe(40);
    expect(s.evaluate(`$CurrentRunProducedAmount ${CREDIT}`)).toBe(40);
    expect(s.evaluate(`$InitProducedAmount ${OFFICE} ${CREDIT}`)).toBe(40);
    expect(s.evaluate(`$InitProducedAmount ${MILLENNIUM} ${CREDIT}`)).toBe(0);
    expect(s.evaluate('$GlobalUnlockedInits')).toBe(1);
    expect(s.evaluate('$Bogus x')).toBeNull();
  });

  test('stat condition evaluates via injected reader', () => {
    game.mutations.changeResource(CREDIT, 100);
    const cond = { target: 'stat' as const, key: `$GlobalProducedAmount ${CREDIT}`, comparator: '>' as const, value: 50 };
    expect(game.conditionSystem.evaluate(cond, game.state)).toBe(true);
    const miss = { ...cond, value: 500 };
    expect(game.conditionSystem.evaluate(miss, game.state)).toBe(false);
  });

  test('save/load persists global, init, and current run stats', () => {
    game.mutations.changeResource(CREDIT, 40);
    game.tick();
    const save = game.save();

    const loaded = new GameInstance();
    loaded.init([baseDatapack]);
    loaded.load(save);

    const stats = loaded.getView().stats;
    expect(stats.global.produced[CREDIT]).toBeGreaterThanOrEqual(40);
    expect(stats.init[OFFICE]!.framesInInit).toBeGreaterThanOrEqual(1);
    // 本次游玩（session）从头到尾的统计被持久化并恢复
    expect(stats.session.currentInit).toBe(OFFICE);
    expect(stats.session.counters.produced[CREDIT]).toBeGreaterThanOrEqual(40);
    expect(stats.session.resources[CREDIT]).toBe(loaded.state.resources[CREDIT]);
    loaded.stop();
  });

  test('stat condition group via and() helper', () => {
    game.mutations.changeResource(CREDIT, 100);
    const group = and(
      { target: 'stat', key: `$GlobalProducedAmount ${CREDIT}`, comparator: '>=', value: 100 },
      { target: 'stat', key: '$GlobalUnlockedInits', comparator: '>=', value: 1 },
    );
    expect(game.conditionSystem.evaluateGroup(group, game.state)).toBe(true);
  });
});
