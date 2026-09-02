import { describe, expect, test } from 'vitest';
import {
  ConditionEvaluationContext,
  GameNumAffectorContext,
  GameNumRegistryContext,
  RevealRegistryContext,
  StatsQueryContext,
  ValueEvaluationContext,
} from '../../src/engine/contracts';
import { ConditionSystem } from '../../src/engine/expression/condition-system';
import { GameNumSystem } from '../../src/engine/expression/game-num';
import { ValueSystem } from '../../src/engine/expression/value-system';
import { StatsService } from '../../src/engine/stats/stats';
import { EventBus } from '../../src/engine/core/event-bus';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';

const state = {
  resources: {},
  spotLevels: {},
  spotManagers: {},
  unlockedEnhancements: [],
  activeInit: '',
  totalFrames: 0,
  storyLog: [],
  inventory: {},
  flags: {},
  unlockedInits: [],
} as unknown as PlayerState;

describe('基础引擎契约可脱离 base Datapack 组合', () => {
  test('Value / Condition / Stats 实现满足只读查询端口', () => {
    const value: ValueEvaluationContext = new ValueSystem();
    const condition: ConditionEvaluationContext<PlayerState> = new ConditionSystem();
    const stats: StatsQueryContext = new StatsService();

    expect(value.extraReader('missing')).toBeUndefined();
    expect(condition.tagIndex([])).toEqual([]);
    expect(stats.evaluate('$Unknown')).toBeNull();
  });

  test('GameNum 可由最小 Registry / Affector 端口构造', () => {
    const registry: GameNumRegistryContext = {
      spots: new Map(),
      areas: new Map(),
      inits: new Map(),
      enhancements: new Map(),
      effectiveSpotTags: () => [],
    };
    const affectors: GameNumAffectorContext = {
      getActiveInstances: () => [],
      getPack: () => undefined,
    };
    const system = new GameNumSystem({
      valueSystem: new ValueSystem(),
      registry,
      affectorEngine: affectors,
      eventBus: new EventBus(),
    });

    system.buildAll(state);
    expect(system.getResources()).toEqual([]);
  });

  test('Reveal 端口只要求带揭示声明的只读索引', () => {
    const reveal: RevealRegistryContext = {
      inits: new Map(),
      areas: new Map(),
      spots: new Map(),
      enhancements: new Map(),
      items: new Map(),
      storyEntries: new Map(),
      activeStories: new Map(),
      passiveStories: new Map(),
    };

    expect(reveal.spots.size).toBe(0);
  });

  test('GameInstance 支持由产品运行时注入装配入口', () => {
    let wired = false;
    new GameInstance({
      wiring: () => {
        wired = true;
      },
    });

    expect(wired).toBe(true);
  });
});
