import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { InformationRevealAdapter } from '../../src/arona-clicker/services/world/information-reveal-adapter';
import { queryInformationReveal, type PrerequisiteMap, type RevealWatch } from '../../src/arona-clicker/services/world/information-reveal-domain';
import type { Registry } from '../../src/data-services/registry/registry';
import type { PlayerState, RevealedInformationTarget } from '../../src/arona-clicker/types/state';
import type { RevealTrigger } from '../../src/engine/types/reveal';

const INIT = 'base:init:schale_office';
const fakeRegistry = () => ({
  inits: new Map(), areas: new Map(), spots: new Map(), enhancements: new Map(),
  items: new Map<string, { id: string; revealTriggers?: RevealTrigger[] }>(),
  activeStories: new Map(), passiveStories: new Map(),
}) as unknown as Registry;

describe('InformationRevealAdapter', () => {
  let game: GameInstance | undefined;
  afterEach(() => { game?.stop(); game = undefined; });

  function setup(registry = fakeRegistry(), prerequisites: PrerequisiteMap = {}) {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(INIT);
    const adapter = new InformationRevealAdapter(game.triggerSystem, game.conditionSystem, game.mutations,
      () => game!.state as PlayerState, registry, prerequisites);
    return { game, adapter, registry };
  }

  function addItem(registry: Registry, id: string, triggers: RevealTrigger[]) {
  (registry.items as unknown as Map<string, { id: string; revealTriggers?: RevealTrigger[] }>).set(id, { id, revealTriggers: triggers });
  }

  function makeWatch(registry: Registry, id: string, target: string, sources: string[], threshold = 1): RevealWatch {
    addItem(registry, id, sources.map(resourceId => ({
      reveal: target as 'name', condition: { target: 'resource', key: resourceId, comparator: '>=', value: threshold },
    })));
    const query = queryInformationReveal(registry, game!.state as PlayerState,
      { entityKind: 'item', entityId: id, target }, INIT);
    if (query.status !== 'pending-gate' || !query.watch) throw new Error(`Expected a desired Watch, got ${query.status}`);
    return query.watch;
  }

  test('registers precise sources before admission, reevaluates the complete gate, commits, then withdraws', () => {
    const { game, adapter, registry } = setup();
    const a = 'test:resource:a';
    const b = 'test:resource:b';
    const current = makeWatch(registry, 'reveal-item', 'name', [a, b]);
    adapter.reconcile([current]);
    const registrations = game.triggerSystem.getDefinitions().filter(def => def.id?.startsWith('information-reveal:'));
    expect(registrations).toHaveLength(2);
    expect(registrations.map(def => def.on)).toEqual([{ kind: 'resource', resource: a }, { kind: 'resource', resource: b }]);
    game.mutations.changeResource(a, 1);
    expect(game.state.informationRevealProgress?.revealed).toContainEqual(current.key);
    expect(game.triggerSystem.getDefinitions().some(def => def.id?.startsWith('information-reveal:'))).toBe(false);
  });

  test('AdmissionOnly evaluates on explicit reconcile and creates no reactive registration', () => {
    const { game, adapter, registry } = setup();
    addItem(registry, 'always', [{ reveal: 'condition', condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } }]);
    const current = queryInformationReveal(registry, game.state as PlayerState,
      { entityKind: 'item', entityId: 'always', target: 'condition' }, INIT).watch!;
    expect(current.wakePlan.kind).toBe('admission-only');
    adapter.reconcile([current]);
    expect(game.state.informationRevealProgress?.revealed).toContainEqual(current.key);
    expect(game.triggerSystem.getDefinitions().some(def => def.id?.startsWith('information-reveal:'))).toBe(false);
  });

  test('only a declared unconditional gate can commit immediately', () => {
    const { game, adapter, registry } = setup();
    const key: RevealedInformationTarget = { entityKind: 'item', entityId: 'unconditional', target: 'name' };
    addItem(registry, key.entityId, [{ reveal: 'name' }]);
    adapter.reconcile([], [key]);
    expect(game.state.informationRevealProgress?.revealed).toContainEqual(key);
    adapter.reconcile([], [{ ...key, entityId: 'missing' }]);
    expect(game.state.informationRevealProgress?.revealed).not.toContainEqual({ ...key, entityId: 'missing' });
  });

  test('successful commit rederives domain Watches and activates newly eligible prerequisites', () => {
    const registry = fakeRegistry();
    const prerequisites: PrerequisiteMap = { ['item\u0000chain\u0000utility']: ['name'] };
    const { game, adapter } = setup(registry, prerequisites);
    addItem(registry, 'chain', [
      { reveal: 'name', condition: { target: 'resource', key: 'test:name', comparator: '>=', value: 1 } },
      { reveal: 'utility', condition: { target: 'resource', key: 'test:utility', comparator: '>=', value: 1 } },
    ]);
    const first = queryInformationReveal(registry, game.state as PlayerState,
      { entityKind: 'item', entityId: 'chain', target: 'name' }, INIT).watch!;
    adapter.reconcile([first]);
    game.mutations.changeResource('test:name', 1);
    expect(game.state.informationRevealProgress?.revealed).toContainEqual(first.key);
    expect(game.triggerSystem.getDefinitions().some(def => def.on.kind === 'resource' && def.on.resource === 'test:utility')).toBe(true);
    game.mutations.changeResource('test:utility', 1);
    expect(game.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'item', entityId: 'chain', target: 'utility' });
  });

  test('stale definitions, fake Watches, out-of-scope state, and missing targets cannot commit', () => {
    const { game, adapter, registry } = setup();
    const source = 'test:resource:scope';
    const current = makeWatch(registry, 'scoped', 'utility', [source], 5);
    adapter.reconcile([current]);
    (registry.items as unknown as Map<string, { id: string; revealTriggers?: RevealTrigger[] }>).set('scoped', {
      id: 'scoped', revealTriggers: [{ reveal: 'utility', condition: { target: 'resource', key: 'test:resource:changed', comparator: '>=', value: 1 } }],
    });
    game.mutations.changeResource(source, 5);
    expect(game.state.informationRevealProgress?.revealed).not.toContainEqual(current.key);
    adapter.reconcile([current]);
    expect(game.triggerSystem.getDefinitions().some(def => def.on.kind === 'resource' && def.on.resource === source)).toBe(false);
    adapter.reconcile([current], [{ entityKind: 'item', entityId: 'missing', target: 'name' }]);
    expect(game.state.informationRevealProgress?.revealed).not.toContainEqual({ entityKind: 'item', entityId: 'missing', target: 'name' });
    const currentAgain = makeWatch(registry, 'scoped', 'utility', ['test:resource:changed']);
    adapter.reconcile([currentAgain]);
    (game.state as unknown as { activeInit: string }).activeInit = 'other-init';
    game.mutations.changeResource('test:resource:changed', 1);
    expect(game.state.informationRevealProgress?.revealed).not.toContainEqual(currentAgain.key);
  });

  test('registration failure withdraws earlier sources from the same Watch', () => {
    const { game, adapter, registry } = setup();
    const current = makeWatch(registry, 'atomic', 'name', ['test:resource:first', 'test:resource:second']);
    const conflictingKey = 'information-reveal:reveal-action:1:1';
    game.triggerSystem.register({
      key: conflictingKey, triggerId: conflictingKey,
      def: { id: conflictingKey, on: { kind: 'tick' }, effects: [], once: false }, tags: new Set(),
    });
    expect(() => adapter.reconcile([current])).toThrow(/registration key conflict/i);
    expect(game.triggerSystem.getDefinitions().some(def => def.id === 'information-reveal:reveal-action:1:0')).toBe(false);
    expect(game.triggerSystem.getDefinitions().some(def => def.id === conflictingKey)).toBe(true);
  });

  test('withdraw/rebuild uses fresh handles and reentrant events do not double commit', () => {
    const { game, adapter, registry } = setup();
    const source = 'test:resource:reentrant';
    const current = makeWatch(registry, 'rebuild', 'utility', [source], 10);
    adapter.reconcile([current]);
    adapter.withdrawAll();
    expect(game.triggerSystem.getDefinitions().some(def => def.id?.startsWith('information-reveal:'))).toBe(false);
    adapter.reconcile([current]);
    let evaluations = 0;
    const original = game.conditionSystem.evaluateExpr.bind(game.conditionSystem);
    game.conditionSystem.evaluateExpr = ((...args: Parameters<typeof original>) => {
      evaluations += 1;
      if (evaluations === 1) game.mutations.changeResource(source, 1);
      return true;
    }) as typeof game.conditionSystem.evaluateExpr;
    game.mutations.changeResource(source, 1);
    expect(evaluations).toBe(3);
    expect(game.state.informationRevealProgress?.revealed).toContainEqual(current.key);
  });
});
