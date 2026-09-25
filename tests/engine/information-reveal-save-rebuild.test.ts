import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { Registry } from '../../src/data-services/registry/registry';
import type { InitDef } from '../../src/data-services/contracts/world';
import type { RevealTrigger } from '../../src/engine/types/reveal';

const OFFICE = 'base:init:schale_office';
const gate = (target: 'name' | 'condition', resource: string): RevealTrigger => ({
  reveal: target, condition: { target: 'resource', key: resource, comparator: '>=', value: 1 },
});

describe('Information Reveal save and reset lifecycle integration', () => {
  let game: GameInstance | undefined;
  afterEach(() => { game?.stop(); game = undefined; });

  function setup(): GameInstance {
    game = new GameInstance();
    game.init([baseDatapack]);
    const registry = game.registry as unknown as { inits: Map<string, InitDef> };
    const office = registry.inits.get(OFFICE)!;
    registry.inits.set(OFFICE, { ...office, revealTriggers: [gate('name', 'test:save-name'), gate('condition', 'test:save-condition')] });
    expect(game.inits.startNewGame(OFFICE)).toBe(true);
    return game;
  }

  function registrations() {
    return game!.triggerSystem.getDefinitions().filter(def => def.id?.startsWith('information-reveal-runtime:')
      && def.on.kind === 'resource' && def.on.resource?.startsWith('test:save-'));
  }

  test('Save progress survives load and only current unsatisfied Watch is rebuilt', () => {
    const g = setup();
    const firstKeys = registrations().map(def => def.id).sort();
    expect(firstKeys).toHaveLength(2);
    const initialSave = g.save();
    g.load(initialSave);
    const rebuiltKeys = registrations().map(def => def.id).sort();
    expect(rebuiltKeys).toHaveLength(2);
    expect(rebuiltKeys).not.toEqual(firstKeys);

    g.mutations.setResource('test:save-name', 1);
    expect(g.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'init', entityId: OFFICE, target: 'name' });
    expect(registrations().map(def => def.on)).toEqual([{ kind: 'resource', resource: 'test:save-condition' }]);
    const savedKnownName = g.save();

    g.mutations.setResource('test:save-condition', 1);
    expect(g.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'init', entityId: OFFICE, target: 'condition' });
    expect(registrations()).toHaveLength(0);
    g.load(savedKnownName);
    expect(g.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'init', entityId: OFFICE, target: 'name' });
    expect(g.state.informationRevealProgress?.revealed).not.toContainEqual({ entityKind: 'init', entityId: OFFICE, target: 'condition' });
    expect(registrations().map(def => def.on)).toEqual([{ kind: 'resource', resource: 'test:save-condition' }]);
  });

  test('reset withdraws Watches before replacing state; reload leaves Lobby without old registrations', () => {
    const g = setup();
    expect(registrations()).toHaveLength(2);
    g.reset();
    expect(g.state.activeInit).toBe('');
    expect(registrations()).toHaveLength(0);

    expect(g.inits.startNewGame(OFFICE)).toBe(true);
    expect(registrations()).toHaveLength(2);
    g.reload([baseDatapack], { enterDefaultInit: false });
    expect(g.state.activeInit).toBe('');
    expect(registrations()).toHaveLength(0);
  });
});
