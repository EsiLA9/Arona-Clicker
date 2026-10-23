import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Datapack, MilestoneDef } from '../../src/data-services/contracts/datapack';
import { Registry } from '../../src/data-services/registry/registry';
import type { InitStatCounters, StatsSnapshot } from '../../src/engine/contracts/stats';
import type { Condition } from '../../src/engine/types/expression';
import { baseDatapack } from '../../src/data/test-datapack';
import type { InitSnapshot, PlayerState } from '../../src/arona-clicker/types/state';
import { buildAchievementView } from '../../src/arona-clicker/read-model/achievement-view';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { GameReadModel } from '../../src/arona-clicker/contracts/runtime/runtime';

const OFFICE = 'base:init:schale_office';
const CREDIT = 'test:resource:credit';
const ITEM = 'test:item:sample';

function pack(
  milestones: MilestoneDef[],
  milestoneListeners: Datapack['milestoneListeners'],
  achievements: Datapack['achievements'],
): Datapack {
  return {
    name: 'Achievement view test', version: '1.0.0', modName: 'test',
    inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [],
    stories: [], items: [], funcletDefs: [], characters: [], milestones, milestoneListeners, achievements,
  };
}

function statCondition(key: string, value: number, comparator: '>=' | '>' = '>='): Condition {
  return { target: 'stat', key, value, comparator };
}

function counters(overrides: Partial<InitStatCounters> = {}): InitStatCounters {
  return {
    produced: {}, consumed: {}, itemsCollected: {}, itemsUsed: {},
    spotsUnlocked: 0, spotsUpgraded: 0, storiesCompleted: 0,
    enhancementsUnlocked: 0, initsUnlocked: 0, framesActive: 0, framesInInit: 0,
    ...overrides,
  };
}

function snapshot(visitedAreas: InitSnapshot['visitedAreas']): InitSnapshot {
  return {
    resources: {}, spotLevels: {}, spotManagers: {}, visitedAreas, totalFrames: 0,
    inventory: {}, unlockedEnhancements: [], storyLog: [], flags: {}, triggersCompleted: [],
  };
}

function statsSnapshot(initId: string, initCounters: InitStatCounters): StatsSnapshot {
  return {
    global: counters(),
    init: { [initId]: initCounters },
    session: {
      startFrame: 0, counters: counters(), currentInit: initId, currentArea: null,
      resources: {}, completedStoryIdsThisRun: [],
    },
  };
}

describe('Achievement view', () => {
  test('hides unvisited Areas, then shows current and historical discoveries with completion and progress', () => {
    const registry = new Registry();
    registry.load(baseDatapack);
    const localAreas = [...registry.areas.values()].filter(area => area.initId === OFFICE);
    const foreignArea = [...registry.areas.values()].find(area => area.initId !== OFFICE);
    expect(localAreas.length).toBeGreaterThan(1);
    expect(foreignArea).toBeDefined();
    if (localAreas.length < 2 || !foreignArea) return;

    const [currentArea, otherLocalArea] = localAreas;
    const ids = {
      produced: 'test:achievement:produced',
      collected: 'test:achievement:collected',
      grouped: 'test:achievement:grouped',
      historical: 'test:achievement:historical',
    };
    const definitions: MilestoneDef[] = [
      { id: 'test:milestone:produced', condition: statCondition(`$InitProducedAmount ${OFFICE} ${CREDIT}`, 10) },
      { id: 'test:milestone:collected', condition: statCondition(`$InitCollectedAmount ${OFFICE} ${ITEM}`, 2, '>') },
      { id: 'test:milestone:grouped', condition: {
        type: 'AND', conditions: [statCondition(`$InitProducedAmount ${OFFICE} ${CREDIT}`, 10)],
      } },
      { id: 'test:milestone:historical', condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } },
    ];
    const listenerData = [
      { id: 'test:milestone-listener:produced', milestoneId: definitions[0].id, areaId: currentArea.id, then: [] },
      { id: 'test:milestone-listener:collected', milestoneId: definitions[1].id, areaId: otherLocalArea.id, then: [] },
      { id: 'test:milestone-listener:grouped', milestoneId: definitions[2].id, areaId: otherLocalArea.id, then: [] },
      { id: 'test:milestone-listener:historical', milestoneId: definitions[3].id, areaId: foreignArea.id, then: [] },
    ];
    const achievementData = [
      { id: ids.produced, listenerId: listenerData[0].id, title: 'Produce', clue: 'Gather credit', rewardDescription: 'A badge' },
      { id: ids.collected, listenerId: listenerData[1].id, title: 'Collect', clue: 'Find items', rewardDescription: 'A note' },
      { id: ids.grouped, listenerId: listenerData[2].id, title: 'Combined', clue: 'Several steps', rewardDescription: 'A token' },
      { id: ids.historical, listenerId: listenerData[3].id, title: 'Remembered', clue: 'Return later', rewardDescription: 'A memory' },
    ];
    registry.load(pack(definitions, listenerData, achievementData));

    const historicalAreaId = foreignArea.id;
    const state: Pick<PlayerState, 'activeInit' | 'currentAreaId' | 'visitedAreas' | 'initSnapshots' | 'milestoneProgress'> = {
      activeInit: OFFICE,
      currentAreaId: currentArea.id,
      visitedAreas: [currentArea.id, otherLocalArea.id],
      initSnapshots: { [foreignArea.initId]: snapshot([]) },
      milestoneProgress: { completed: ['test:milestone:historical', 'test:milestone:produced'] },
    };
    const stats: Pick<StatsSnapshot, 'init'> = {
      init: {
        [OFFICE]: counters({ produced: { [CREDIT]: 8 }, consumed: { [CREDIT]: 5 }, itemsCollected: { [ITEM]: 3 }, itemsUsed: { [ITEM]: 2 } }),
        [foreignArea.initId]: counters(),
      },
    };

    expect(buildAchievementView(registry, state, stats).map(item => item.id)).toEqual([
      ids.produced, ids.collected, ids.grouped,
    ]);

    state.initSnapshots = { [foreignArea.initId]: snapshot([historicalAreaId]) };
    const view = buildAchievementView(registry, state, stats);
    expect(view.map(item => item.id)).toEqual([ids.produced, ids.collected, ids.grouped, ids.historical]);
    expect(view[0]).toMatchObject({
      title: 'Produce', clue: 'Gather credit', rewardDescription: 'A badge', completed: true,
      progress: { current: 8, target: 10, comparator: '>=' },
    });
    expect(view[1]).toMatchObject({
      progress: { current: 3, target: 2, comparator: '>' },
    });
    expect(view[2]).not.toHaveProperty('progress');
    expect(view[3]).toMatchObject({ initId: foreignArea.initId, areaId: historicalAreaId, completed: true });
    expect(view[3]).not.toHaveProperty('progress');

    const afterSpendAndUse = {
      init: {
        [OFFICE]: counters({ produced: { [CREDIT]: 8 }, consumed: { [CREDIT]: 7 }, itemsCollected: { [ITEM]: 3 }, itemsUsed: { [ITEM]: 4 } }),
        [foreignArea.initId]: counters(),
      },
    } satisfies Pick<StatsSnapshot, 'init'>;
    expect(buildAchievementView(registry, state, afterSpendAndUse).slice(0, 2).map(item => item.progress?.current)).toEqual([8, 3]);
  });

  test('orders current Area before other current Init Areas and historical Inits without sharing writable definitions', () => {
    const registry = new Registry();
    registry.load(baseDatapack);
    const localAreas = [...registry.areas.values()].filter(area => area.initId === OFFICE);
    const foreignArea = [...registry.areas.values()].find(area => area.initId !== OFFICE);
    expect(localAreas.length).toBeGreaterThan(1);
    expect(foreignArea).toBeDefined();
    if (localAreas.length < 2 || !foreignArea) return;

    const [currentArea, otherLocalArea] = localAreas;
    const milestoneIds = ['test:milestone:current', 'test:milestone:local', 'test:milestone:foreign'];
    const listeners = [
      { id: 'test:milestone-listener:current', milestoneId: milestoneIds[0], areaId: currentArea.id, then: [] },
      { id: 'test:milestone-listener:local', milestoneId: milestoneIds[1], areaId: otherLocalArea.id, then: [] },
      { id: 'test:milestone-listener:foreign', milestoneId: milestoneIds[2], areaId: foreignArea.id, then: [] },
    ];
    const achievements = listeners.map((listener, index) => ({
      id: `test:achievement:order-${index}`,
      listenerId: listener.id,
      title: `Title ${index}`,
      clue: `Clue ${index}`,
      rewardDescription: `Reward ${index}`,
    }));
    registry.load(pack(
      milestoneIds.map(id => ({ id, condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } })),
      listeners,
      achievements,
    ));
    const state: Pick<PlayerState, 'activeInit' | 'currentAreaId' | 'visitedAreas' | 'initSnapshots' | 'milestoneProgress'> = {
      activeInit: OFFICE,
      currentAreaId: otherLocalArea.id,
      visitedAreas: [currentArea.id, otherLocalArea.id],
      initSnapshots: { [foreignArea.initId]: snapshot([foreignArea.id]) },
    };
    const view = buildAchievementView(registry, state, { init: {} });

    expect(view.map(item => item.areaId)).toEqual([otherLocalArea.id, currentArea.id, foreignArea.id]);
    const original = registry.achievements.get('test:achievement:order-1');
    const linkedMilestone = registry.milestones.get(milestoneIds[1]);
    expect(original).toBeDefined();
    expect(view[0]).not.toBe(original);
    expect(view[0]).not.toBe(linkedMilestone);
    expect(view[0].progress).not.toBe(linkedMilestone?.condition);
    expect(view[0]).not.toBe(state);
  });

  test('GameReadModel derives current visit, statistic, and completion values on each call', () => {
    const game = new GameInstance();
    try {
      game.init([baseDatapack]);
      const areaId = game.registry.inits.get(OFFICE)?.defaultAreas[0];
      expect(areaId).toBeDefined();
      if (!areaId) return;

      const milestoneIds = ['test:milestone:runtime-complete', 'test:milestone:runtime-progress'];
      const listeners = [
        { id: 'test:milestone-listener:runtime-complete', milestoneId: milestoneIds[0], areaId, then: [] },
        { id: 'test:milestone-listener:runtime-progress', milestoneId: milestoneIds[1], areaId, then: [] },
      ];
      game.registry.load(pack(
        [
          { id: milestoneIds[0], condition: { target: 'resource', key: CREDIT, comparator: '>=', value: 1 } },
          { id: milestoneIds[1], condition: statCondition(`$InitProducedAmount ${OFFICE} ${CREDIT}`, 5) },
        ],
        listeners,
        [
          { id: 'test:achievement:runtime-complete', listenerId: listeners[0].id, title: 'Complete', clue: 'Reach one', rewardDescription: 'A mark' },
          { id: 'test:achievement:runtime-progress', listenerId: listeners[1].id, title: 'Progress', clue: 'Produce credit', rewardDescription: 'A note' },
        ],
      ));

      let currentStats = statsSnapshot(OFFICE, counters({ produced: { [CREDIT]: 3 } }));
      vi.spyOn(game.statsService, 'getSnapshot').mockImplementation(() => currentStats);
      game.inits.startNewGame(OFFICE);
      const readModel: Pick<GameReadModel, 'getAchievementView'> = game;
      const firstView = readModel.getAchievementView();
      expect(firstView.map(item => item.id)).toEqual([
        'test:achievement:runtime-complete', 'test:achievement:runtime-progress',
      ]);
      expect(firstView[0].completed).toBe(false);
      expect(firstView[1].progress).toEqual({ current: 3, target: 5, comparator: '>=' });

      game.mutations.changeResource(CREDIT, 1);
      const afterCompletion = readModel.getAchievementView();
      expect(afterCompletion[0].completed).toBe(true);

      currentStats = statsSnapshot(OFFICE, counters({ produced: { [CREDIT]: 7 } }));
      const afterStatsChange = readModel.getAchievementView();
      expect(afterStatsChange[1].progress).toEqual({ current: 7, target: 5, comparator: '>=' });
      expect(afterStatsChange).not.toBe(firstView);
      expect(afterStatsChange[1]).not.toBe(firstView[1]);
      expect(afterStatsChange[1].progress).not.toBe(firstView[1].progress);
      expect(afterStatsChange[0]).not.toBe(game.state);
    } finally {
      game.stop();
      vi.restoreAllMocks();
    }
  });
});
