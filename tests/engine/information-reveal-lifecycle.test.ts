import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { Registry } from '../../src/data-services/registry/registry';
import type { InitDef, AreaDef } from '../../src/data-services/contracts/world';
import type { RevealTrigger } from '../../src/engine/types/reveal';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const CREDIT = 'base:resource:credit';
const gate = (target: 'name' | 'condition', resource: string, value = 999): RevealTrigger => ({
  reveal: target, condition: { target: 'resource', key: resource, comparator: '>=', value },
});

describe('Information Reveal Init lifecycle integration', () => {
  let game: GameInstance | undefined;
  afterEach(() => { game?.stop(); game = undefined; });

  function setup(): GameInstance {
    game = new GameInstance();
    game.init([baseDatapack]);
    return game;
  }

  function replaceInit(id: string, revealTriggers: RevealTrigger[]): void {
    const registry = game!.registry as unknown as { inits: Map<string, InitDef> };
    const current = registry.inits.get(id)!;
    registry.inits.set(id, { ...current, revealTriggers });
  }

  function replaceArea(id: string, revealTriggers: RevealTrigger[]): void {
    const registry = game!.registry as unknown as { areas: Map<string, AreaDef> };
    const current = registry.areas.get(id)!;
    registry.areas.set(id, { ...current, revealTriggers });
  }

  function revealRegistrations() {
    return game!.triggerSystem.getDefinitions().filter(def => def.id?.startsWith('information-reveal-runtime:'));
  }

  function testRevealRegistrations() {
    return revealRegistrations().filter(def => def.on.kind === 'resource' && def.on.resource?.startsWith('test:'));
  }

  test('post-admission reconcile observes state changes emitted after initEntered', () => {
    const g = setup();
    replaceInit(OFFICE, [gate('name', 'test:post-init', 5)]);
    let changed = false;
    g.eventBus.onAny(event => {
      if (!changed && event.type === 'initEntered') {
        changed = true;
        g.mutations.setResource('test:post-init', 5);
      }
    });
    expect(g.inits.startNewGame(OFFICE)).toBe(true);
    expect(g.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'init', entityId: OFFICE, target: 'name' });
    expect(testRevealRegistrations()).toHaveLength(0);
  });

  test('Init transition withdraws old scope, preserves Save facts, and rebuilds the new scope', () => {
    const g = setup();
    replaceInit(OFFICE, [gate('name', 'test:office-known', 1), gate('condition', 'test:office-wait', 99)]);
    replaceInit(MILLENNIUM, [gate('name', 'test:millennium-wait', 99)]);
    expect(g.inits.startNewGame(OFFICE)).toBe(true);
    expect(testRevealRegistrations()).toHaveLength(2);
    g.mutations.setResource('test:office-known', 1);
    expect(g.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'init', entityId: OFFICE, target: 'name' });
    expect(testRevealRegistrations()).toHaveLength(1);

    g.inits.unlockInit(MILLENNIUM);
    expect(g.inits.resumeInit(MILLENNIUM)).toBe(true);
    expect(testRevealRegistrations().map(def => def.on)).toEqual([{ kind: 'resource', resource: 'test:millennium-wait' }]);
    expect(g.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'init', entityId: OFFICE, target: 'name' });

    expect(g.inits.resumeInit(OFFICE)).toBe(true);
    expect(testRevealRegistrations().map(def => def.on)).toEqual([{ kind: 'resource', resource: 'test:office-wait' }]);
  });

  test('hot Init and Area definition reconciliation replaces old Watches and retains Save facts', () => {
    const g = setup();
    const registry = g.registry as unknown as { inits: Map<string, InitDef>; areas: Map<string, AreaDef> };
    const areaId = registry.inits.get(OFFICE)!.defaultAreas[0];
    replaceInit(OFFICE, [gate('name', 'test:init-known', 1), gate('condition', 'test:init-old', 999)]);
    replaceArea(areaId, [gate('name', 'test:area-known', 1), gate('condition', 'test:area-old', 999)]);
    expect(g.inits.startNewGame(OFFICE)).toBe(true);
    g.mutations.setResource('test:init-known', 1);
    g.mutations.setResource('test:area-known', 1);
    expect(g.state.informationRevealProgress?.revealed).toEqual(expect.arrayContaining([
      { entityKind: 'init', entityId: OFFICE, target: 'name' },
      { entityKind: 'area', entityId: areaId, target: 'name' },
    ]));

    replaceInit(OFFICE, [gate('name', 'test:init-known', 1), gate('condition', 'test:init-new', 999)]);
    replaceArea(areaId, [gate('name', 'test:area-known', 1), gate('condition', 'test:area-new', 999)]);
    g.initService.reconcileAfterWorldDefinitionChange();
    const resources = testRevealRegistrations().flatMap(def => def.on.kind === 'resource' ? [def.on.resource] : []);
    expect(resources).toContain('test:init-new');
    expect(resources).toContain('test:area-new');
    expect(resources).not.toContain('test:init-old');
    expect(resources).not.toContain('test:area-old');
    expect(g.state.informationRevealProgress?.revealed).toEqual(expect.arrayContaining([
      { entityKind: 'init', entityId: OFFICE, target: 'name' },
      { entityKind: 'area', entityId: areaId, target: 'name' },
    ]));
  });

  test('leaving an Init withdraws its Watches before reaching Lobby', () => {
    const g = setup();
    replaceInit(OFFICE, [gate('name', 'test:lobby-exit', 99)]);
    expect(g.inits.startNewGame(OFFICE)).toBe(true);
    expect(testRevealRegistrations()).toHaveLength(1);
    g.inits.restartInit();
    expect(testRevealRegistrations()).toHaveLength(0);
  });
});
