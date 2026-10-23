import { afterEach, describe, expect, test } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime/runtime';
import { defaultDatapack } from '../../src/arona-clicker/content';
import type { RuntimeWorldDraft, RuntimeSpotInput } from '../../src/arona-clicker/contracts/runtime/runtime-content';

const MOD = 'reveal-hot';
const INIT = `${MOD}:init:demo`;
const AREA = `${MOD}:area:home`;
const gate = (resource: string, value = 99) => ({
  reveal: 'name' as const,
  condition: { type: 'AND' as const, conditions: [{ target: 'resource' as const, key: resource, comparator: '>=' as const, value }] },
});

function worldDraft(resource: string): RuntimeWorldDraft {
  return {
    modName: MOD,
    inits: [{ idName: 'demo', name: 'Demo', description: '', defaultAreas: [AREA], revealTriggers: [gate(resource)] }],
    areas: [{ idName: 'home', initId: INIT, name: 'Home', description: '', defaultSpots: [] }],
  };
}

function spotInput(resource: string): RuntimeSpotInput {
  return {
    idName: 'desk', areaId: 'base:area:schale_main', name: 'Desk', description: '', global: true,
    purchaseOptions: [{ id: 'free', costs: [] }], revealTriggers: [gate(resource)],
  };
}

describe('Information Reveal hot content commits', () => {
  let game: AronaClickerRuntime | undefined;
  afterEach(() => { game?.stop(); game = undefined; });

  test('World draft rederives Reveal only after successful apply; rollback does not commit new Progress', () => {
    game = new AronaClickerRuntime();
    game.init([defaultDatapack]);
    expect(game.applyRuntimeWorldDraft(worldDraft('test:old-world'))).toMatchObject({ ok: true });
    expect(game.inits.startNewGame(INIT)).toBe(true);
    game.mutations.setResource('test:new-world', 100);

    const removeListener = game.eventBus.on('initDefinitionChanged', () => { throw new Error('test rollback'); });
    const failed = game.applyRuntimeWorldDraft(worldDraft('test:new-world'));
    removeListener();

    expect(failed.ok).toBe(false);
    expect(game.registry.inits.get(INIT)?.revealTriggers?.[0]?.condition).toMatchObject({
      type: 'AND', conditions: [{ key: 'test:old-world' }],
    });
    expect(game.state.informationRevealProgress?.revealed).not.toContainEqual({ entityKind: 'init', entityId: INIT, target: 'name' });

    expect(game.applyRuntimeWorldDraft(worldDraft('test:new-world')).ok).toBe(true);
    expect(game.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'init', entityId: INIT, target: 'name' });
  });

  test('Spot submit refreshes Watch after success and stale submit preserves Watch and Progress', () => {
    game = new AronaClickerRuntime();
    game.init([defaultDatapack]);
    expect(game.inits.startNewGame('base:init:schale_office')).toBe(true);
    const content = game.spot.content!;
    expect(content.setModMetadata({ modName: MOD, displayName: 'Reveal Hot', version: '1.0.0', author: '', description: '' }).ok).toBe(true);
    const created = content.create(MOD, spotInput('test:old-spot'), content.getState().revision);
    expect(created.ok).toBe(true);
    const spotId = `${MOD}:spot:desk`;
    const registrations = () => game!.triggerSystem.getDefinitions().filter(def => def.id?.startsWith('information-reveal-runtime:'));
    expect(registrations().some(def => def.on.kind === 'resource' && def.on.resource === 'test:old-spot')).toBe(true);

    const revision = content.getState().revision;
    const replaced = content.replace(MOD, 'desk', spotInput('test:new-spot'), revision);
    expect(replaced.ok).toBe(true);
    expect(registrations().some(def => def.on.kind === 'resource' && def.on.resource === 'test:new-spot')).toBe(true);
    expect(registrations().some(def => def.on.kind === 'resource' && def.on.resource === 'test:old-spot')).toBe(false);

    const stale = content.replace(MOD, 'desk', spotInput('test:stale-spot'), revision);
    expect(stale.ok).toBe(false);
    expect(game!.registry.spots.get(spotId)?.revealTriggers?.[0]?.condition).toMatchObject({
      type: 'AND', conditions: [{ key: 'test:new-spot' }],
    });
    expect(registrations().some(def => def.on.kind === 'resource' && def.on.resource === 'test:new-spot')).toBe(true);
    expect(registrations().some(def => def.on.kind === 'resource' && def.on.resource === 'test:stale-spot')).toBe(false);
  });
});
