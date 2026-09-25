import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Datapack, MilestoneDef } from '../../src/data-services/contracts/datapack';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { RevealTrigger } from '../../src/engine/types/reveal';

const OFFICE = 'base:init:schale_office';
const CREDIT = 'test:resource:milestone-runtime-credit';
const MILESTONE = 'test:milestone:runtime-credit';
const condition = { target: 'resource' as const, key: CREDIT, comparator: '>=' as const, value: 10 };

function pack(milestones: MilestoneDef[]): Datapack {
  return {
    name: 'Milestone runtime test', version: '1.0.0', modName: 'test',
    inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [],
    stories: [], items: [], funcletDefs: [], characters: [], milestones,
  };
}

describe('Milestone runtime projection', () => {
  let game: GameInstance | undefined;

  afterEach(() => { game?.stop(); game = undefined; });

  function setup(defs: MilestoneDef[] = [{ id: MILESTONE, condition }]): GameInstance {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.registry.load(pack(defs));
    expect(game.inits.startNewGame(OFFICE)).toBe(true);
    return game;
  }

  function milestoneRegistrations(g: GameInstance) {
    return g.triggerSystem.getDefinitions().filter(def => def.id?.startsWith('milestone-runtime:'));
  }

  test('routes a matching event to both Reveal and Milestone handlers', () => {
    const g = setup();
    const office = g.registry.inits.get(OFFICE)!;
    const reveal: RevealTrigger = { reveal: 'name', condition };
    (g.registry.inits as unknown as Map<string, typeof office>).set(OFFICE, { ...office, revealTriggers: [reveal] });
    g.inits.reconcileInformationRevealWatches();

    expect(g.triggerSystem.getDefinitions().some(def => def.id?.startsWith('information-reveal-runtime:'))).toBe(true);
    expect(milestoneRegistrations(g)).toHaveLength(1);
    g.mutations.setResource(CREDIT, 10);

    expect(g.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(g.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'init', entityId: OFFICE, target: 'name' });
    expect(milestoneRegistrations(g)).toHaveLength(0);
  });

  test('rebuilds unfinished watches after Save restore and keeps completed orphan facts', () => {
    const g = setup();
    expect(milestoneRegistrations(g)).toHaveLength(1);
    g.load(g.save());
    expect(milestoneRegistrations(g)).toHaveLength(1);

    g.mutations.setResource(CREDIT, 10);
    expect(g.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(milestoneRegistrations(g)).toHaveLength(0);
    const save = g.save();
    (g.registry.milestones as unknown as Map<string, MilestoneDef>).delete(MILESTONE);
    g.load(save);

    expect(g.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(milestoneRegistrations(g)).toHaveLength(0);
  });

  test('register-time event reentry and admission produce one effective completion and withdraw all sources', () => {
    const g = setup([{ id: MILESTONE, condition: {
      type: 'AND', conditions: [condition, { target: 'alwaysTrue', key: '', comparator: '==', value: 1 }],
    } }]);
    g.inits.withdrawInformationRevealWatches();
    const originalRegister = g.triggerSystem.register.bind(g.triggerSystem);
    let emitted = false;
    vi.spyOn(g.triggerSystem, 'register').mockImplementation(request => {
      const token = originalRegister(request);
      if (request.key.startsWith('milestone-runtime:') && !emitted) {
        emitted = true;
        g.mutations.setResource(CREDIT, 10);
      }
      return token;
    });
    const originalComplete = g.mutations.completeMilestone.bind(g.mutations);
    let successfulWrites = 0;
    const completeSpy = vi.spyOn(g.mutations, 'completeMilestone').mockImplementation(id => {
      const result = originalComplete(id);
      if (result) successfulWrites += 1;
      return result;
    });

    g.inits.reconcileInformationRevealWatches();

    expect(successfulWrites).toBe(1);
    expect(g.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(milestoneRegistrations(g)).toHaveLength(0);
    completeSpy.mockRestore();
  });
});
