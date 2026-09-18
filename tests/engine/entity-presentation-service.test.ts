import { describe, expect, test } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { EntityPresentationService } from '../../src/arona-clicker/services/entity-presentation-service';

const datapack = (withPresentation = true): Datapack => ({
  name: 'presentation-runtime-test',
  version: '1.0.0',
  inits: [{ id: 'test:init:main', name: 'Main', description: 'Main description', defaultAreas: ['test:area:main'] }],
  areas: [{
    id: 'test:area:main',
    initId: 'test:init:main',
    name: 'Legacy area name',
    description: 'Legacy area description',
    defaultSpots: [],
    ...(withPresentation ? {
      presentation: {
        default: {
          name: 'Default area name',
          description: 'Default area description',
          theme: { tokens: { primary: '#112233' } },
        },
        additions: [
          {
            id: 'alternate',
            label: 'Alternate',
            override: { description: 'Alternate area description', theme: { tokens: { primary: '#445566' } } },
            availableWhen: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 },
          },
          {
            id: 'locked',
            label: 'Locked',
            override: { name: 'Locked area name' },
            availableWhen: { target: 'flag', key: 'unlock_locked', comparator: '==', value: 1 },
          },
        ],
      },
    } : {}),
  }],
  spots: [],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
});

describe('EntityPresentationService', () => {
  test('default and addition resolve to complete values and ColorSystem theme', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const key = 'area:test:area:main' as const;

    expect(game.entityPresentation.resolve(game.state, key)).toMatchObject({
      name: 'Default area name',
      description: 'Default area description',
      source: 'default',
      theme: { tokens: { primary: '#112233' } },
      swatch: '#112233',
    });
    expect(game.entityPresentation.resolve(game.state, key, { selectedOptionId: 'alternate' })).toMatchObject({
      name: 'Default area name',
      description: 'Alternate area description',
      source: 'addition',
      optionId: 'alternate',
      theme: { tokens: { primary: '#445566' } },
      swatch: '#445566',
    });
  });

  test('unknown or unavailable option falls back to default with a reason', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const key = 'area:test:area:main' as const;

    expect(game.entityPresentation.resolve(game.state, key, { selectedOptionId: 'missing' })).toMatchObject({
      source: 'default',
      fallbackReason: 'unknown-option',
      name: 'Default area name',
    });
    expect(game.entityPresentation.resolve(game.state, key, { selectedOptionId: 'locked' })).toMatchObject({
      source: 'default',
      fallbackReason: 'unavailable-option',
      name: 'Default area name',
    });
  });

  test('options expose availability and hide unavailable resolved content', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const options = game.entityPresentation.options(game.state, 'area:test:area:main');

    expect(options).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'alternate', available: true, value: expect.objectContaining({ description: 'Alternate area description' }) }),
      expect.objectContaining({ id: 'locked', available: false }),
    ]));
    expect(options.find(option => option.id === 'locked')).not.toHaveProperty('value');
  });

  test('entities without presentation keep legacy fields', () => {
    const game = new GameInstance();
    game.init([datapack(false)], { enterDefaultInit: false });

    expect(game.entityPresentation.resolve(game.state, 'area:test:area:main')).toMatchObject({
      name: 'Legacy area name',
      description: 'Legacy area description',
      source: 'legacy',
    });
    expect(game.entityPresentation.options(game.state, 'area:test:area:main')).toEqual([]);
  });

  test('player selection stores only option ID, emits event, and resolves globally', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const key = 'area:test:area:main' as const;
    const events: string[] = [];
    game.eventBus.on('entityPresentationChanged', event => events.push(`${event.entityKey}:${event.optionId ?? 'default'}`));

    expect(game.mutations.setEntityPresentationSelection(key, 'alternate')).toBe(true);
    expect(game.state.entityPresentationSelections).toEqual({ [key]: 'alternate' });
    expect(JSON.stringify(game.state.entityPresentationSelections)).not.toContain('Alternate area description');
    expect(game.entityPresentation.resolve(game.state, key)).toMatchObject({ source: 'addition', optionId: 'alternate', description: 'Alternate area description' });
    expect(game.entityPresentation.options(game.state, key).find(option => option.id === 'alternate')?.active).toBe(true);
    expect(events).toEqual([`${key}:alternate`]);

    expect(game.mutations.setEntityPresentationSelection(key, 'locked')).toBe(false);
    expect(game.mutations.setEntityPresentationSelection(key, 'missing')).toBe(false);
    expect(game.mutations.clearEntityPresentationSelection(key)).toBe(true);
    expect(game.state.entityPresentationSelections).toEqual({});
    expect(events).toEqual([`${key}:alternate`, `${key}:default`]);
  });

  test('runtime override takes priority and can restore the persistent selection', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const key = 'area:test:area:main' as const;
    const presentation = game.entityPresentation as EntityPresentationService;

    expect(game.mutations.setEntityPresentationSelection(key, 'alternate')).toBe(true);
    expect(game.entityPresentation.resolve(game.state, key)).toMatchObject({ optionId: 'alternate', source: 'addition' });

    expect(presentation.setRuntimeOverride(key, 'alternate', 'story:preview', 'story')).toBe(true);
    expect(game.entityPresentation.resolve(game.state, key)).toMatchObject({
      optionId: 'alternate',
      source: 'runtime',
      description: 'Alternate area description',
    });

    expect(presentation.clearRuntimeOverride(key, 'story:preview')).toBe(true);
    expect(game.entityPresentation.resolve(game.state, key)).toMatchObject({ optionId: 'alternate', source: 'addition' });
  });

  test('runtime effect applies an owner/lifetime override and lifecycle cleanup removes it', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const key = 'area:test:area:main' as const;
    const presentation = game.entityPresentation as EntityPresentationService;

    game.effectEngine.applyEffects([{
      op: 'setEntityPresentation',
      target: key,
      value: { optionId: 'alternate', owner: 'story:preview', lifetime: 'story' },
    }]);
    expect(game.entityPresentation.resolve(game.state, key)).toMatchObject({ source: 'runtime', optionId: 'alternate' });

    game.eventBus.emit({ type: 'storyCompleted', storyId: 'story:preview' });
    expect(game.entityPresentation.resolve(game.state, key)).toMatchObject({ source: 'default' });
  });

  test('runtime cleanup only emits changes for keys that actually lost an override', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const key = 'area:test:area:main' as const;
    const presentation = game.entityPresentation as EntityPresentationService;
    const events: string[] = [];
    game.eventBus.on('entityPresentationChanged', event => events.push(`${event.entityKey}:${event.optionId ?? 'default'}`));

    expect(presentation.setRuntimeOverride(key, 'alternate', 'story:preview', 'story')).toBe(true);
    expect(presentation.clearRuntimeOverrides({ lifetime: 'area' })).toBe(0);
    expect(events).toEqual([`${key}:alternate`]);
    expect(presentation.clearRuntimeOverrides({ lifetime: 'story' })).toBe(1);
    expect(events).toEqual([`${key}:alternate`, `${key}:default`]);
  });

  test('entering another Init clears interrupted story overrides', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    const key = 'area:test:area:main' as const;
    const presentation = game.entityPresentation as EntityPresentationService;

    expect(presentation.setRuntimeOverride(key, 'alternate', 'story:interrupted', 'story')).toBe(true);
    game.eventBus.emit({ type: 'initEntered', initId: 'test:init:main' });
    expect(game.entityPresentation.resolve(game.state, key)).toMatchObject({ source: 'default' });
  });
});
