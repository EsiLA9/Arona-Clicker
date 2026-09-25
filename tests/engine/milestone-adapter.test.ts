import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Datapack, MilestoneDef } from '../../src/data-services/contracts/datapack';
import { Registry } from '../../src/data-services/registry/registry';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { deriveDesiredMilestoneWatches } from '../../src/arona-clicker/services/milestone-domain';
import { MilestoneAdapter } from '../../src/arona-clicker/services/milestone-adapter';

const OFFICE = 'base:init:schale_office';
const CREDIT = 'test:resource:credit';
const MILESTONE = 'test:milestone:credit_10';

function pack(milestones: MilestoneDef[]): Datapack {
  return {
    name: 'Milestone test', version: '1.0.0', modName: 'test',
    inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [],
    stories: [], items: [], funcletDefs: [], characters: [], milestones,
  };
}

const condition = (target: 'resource', key: string, value = 10) => ({
  target, key, comparator: '>=' as const, value,
});

describe('Milestone domain and adapter', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => game.stop());

  test('admits only reviewed leaves, treats alwaysTrue as static, and rejects groups with unsupported leaves', () => {
    const registry = new Registry();
    registry.load(pack([
      { id: 'test:milestone:static', condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } },
      { id: MILESTONE, condition: condition('resource', CREDIT) },
      { id: 'test:milestone:global', condition: condition('resource', 'base:resource:pyroxene') },
      { id: 'test:milestone:group', condition: {
        type: 'AND', conditions: [condition('resource', CREDIT), { target: 'alwaysTrue', key: '', comparator: '==', value: 1 }],
      } },
      { id: 'test:milestone:unsupported', condition: { target: 'stat', key: 'any', comparator: '>=', value: 1 } },
      { id: 'test:milestone:unsafe-or', condition: {
        type: 'OR', conditions: [condition('resource', CREDIT), { target: 'stat', key: 'any', comparator: '>=', value: 1 }],
      } },
    ]));

    const desired = deriveDesiredMilestoneWatches(registry, createDefaultState());

    expect(desired.map(watch => watch.milestoneId)).toEqual([
      'test:milestone:static', MILESTONE, 'test:milestone:group',
    ]);
    expect(desired.find(watch => watch.milestoneId === 'test:milestone:static')?.sources).toEqual([]);
    expect(desired.find(watch => watch.milestoneId === 'test:milestone:group')?.sources).toEqual([
      { kind: 'resource', resourceId: CREDIT },
    ]);
  });

  test('registers exact wake sources before admission, rechecks current state, completes once, and withdraws', () => {
    game.registry.load(pack([{ id: MILESTONE, condition: condition('resource', CREDIT) }]));
    const adapter = new MilestoneAdapter(
      game.triggerSystem, game.conditionSystem, game.mutations, () => game.state, game.registry, 'milestone-test',
    );
    game.triggerSystem.setRuntimeActionHandler(action => adapter.handleRuntimeAction(action));
    const registrationKey = `milestone-test:${MILESTONE}:0`;

    adapter.reconcileCurrent();
    expect(game.triggerSystem.has(registrationKey)).toBe(true);
    expect(game.state.milestoneProgress?.completed).not.toContain(MILESTONE);

    game.mutations.changeResource('test:resource:other', 10);
    expect(game.state.milestoneProgress?.completed).not.toContain(MILESTONE);
    expect(game.triggerSystem.has(registrationKey)).toBe(true);

    game.mutations.changeResource(CREDIT, 10);
    expect(game.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(game.triggerSystem.has(registrationKey)).toBe(false);

    game.mutations.setResource(CREDIT, 0);
    adapter.reconcileCurrent();
    expect(game.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(game.triggerSystem.has(registrationKey)).toBe(false);
    adapter.withdrawAll();
  });

  test('admission-only true conditions complete without creating registrations', () => {
    const id = 'test:milestone:static';
    game.registry.load(pack([{ id, condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } }]));
    const adapter = new MilestoneAdapter(
      game.triggerSystem, game.conditionSystem, game.mutations, () => game.state, game.registry, 'milestone-static',
    );
    game.triggerSystem.setRuntimeActionHandler(action => adapter.handleRuntimeAction(action));

    adapter.reconcileCurrent();

    expect(game.state.milestoneProgress?.completed).toContain(id);
    expect(game.triggerSystem.getDefinitions().some(def => def.id?.startsWith('milestone-static:'))).toBe(false);
    adapter.withdrawAll();
  });
});
