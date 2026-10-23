import { describe, expect, test } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { EntityPresentationService } from '../../src/arona-clicker/services/presentation/entity-presentation-service';

const AREA = 'test:area:main';
const areaKey = `area:${AREA}` as const;

function pack(): Datapack {
  return {
    name: 'story-node-presentation-lifecycle-test',
    version: '1.0.0',
    inits: [{ id: 'test:init:main', name: 'Main', description: 'Main', defaultAreas: [AREA] }],
    areas: [{
      id: AREA,
      initId: 'test:init:main',
      name: 'Main area',
      description: '',
      defaultSpots: [],
      theme: { tokens: { primary: '#445566' } },
      presentation: {
        default: { name: 'Default', description: 'Default' },
        additions: [
          { id: 'alternate', label: 'Alternate', override: { name: 'Alternate' } },
          { id: 'other', label: 'Other', override: { name: 'Other' } },
        ],
      },
    }],
    spots: [],
    enhancements: [],
    activeStories: [],
    passiveStories: [],
    stories: [],
    items: [],
    funcletDefs: [],
    characters: [],
    characterVariants: [],
  };
}

function game(): GameInstance {
  const instance = new GameInstance();
  instance.init([pack()], { enterDefaultInit: false });
  instance.colorSystem.syncSelectedThemeFromState(instance.state);
  return instance;
}

describe('StoryNode presentation lifecycle', () => {
  test('ephemeral theme layers are isolated by run and activated owner', () => {
    const instance = game();
    const colors = instance.colorSystem;
    const basePrimary = colors.runtimeTheme().tokens['primary'];
    expect(basePrimary).toBeTruthy();

    colors.activateStoryNodeThemeOwner('variant-a');
    expect(colors.setStoryNodeTheme('run-a', 'variant-a', {
      tokens: { primary: '#111111' },
      background: [{ id: 'run-a-bg', kind: 'solid', value: '#121212' }],
    })).toBe(true);
    expect(colors.runtimeTheme().tokens['primary']).toBe('#111111');

    expect(colors.setStoryNodeTheme('run-b', 'variant-b', { tokens: { primary: '#222222' } })).toBe(true);
    expect(colors.runtimeTheme().tokens['primary']).toBe('#111111');
    colors.activateStoryNodeThemeOwner('variant-b');
    expect(colors.runtimeTheme().tokens['primary']).toBe('#222222');

    expect(colors.clearStoryNodeTheme('run-a')).toBe(true);
    expect(colors.runtimeTheme().tokens['primary']).toBe('#222222');
    expect(colors.clearStoryNodeTheme('run-b')).toBe(true);
    expect(colors.runtimeTheme().tokens['primary']).toBe(basePrimary);
  });

  test('legacy story-theme cleanup cannot remove an active node-run theme', () => {
    const instance = game();
    const colors = instance.colorSystem;
    const basePrimary = colors.runtimeTheme().tokens['primary'];
    colors.handleThemeEffect({ op: 'setTheme', target: '', value: { tokens: { primary: '#999999' } } });
    colors.activateStoryNodeThemeOwner(null);
    colors.setStoryNodeTheme('run-global', null, { tokens: { primary: '#333333' } });

    colors.clearStoryTheme();

    expect(colors.runtimeTheme().tokens['primary']).toBe('#333333');
    expect(colors.clearStoryNodeTheme('run-global')).toBe(true);
    expect(colors.runtimeTheme().tokens['primary']).toBe(basePrimary);
  });

  test('area theme scope preserves its complete background payload', () => {
    const instance = game();
    const background = [{ id: 'node-area-bg', kind: 'gradient' as const, value: 'linear-gradient(#123456, #654321)' }];

    expect(instance.colorSystem.setStoryNodeTheme('run-area', null, {
      scope: 'area',
      entityKey: areaKey,
      colorGroupId: 'test:group:blue',
      palette: ['#123456', '#654321'],
      tokens: { primary: '#123456', panel: '#654321' },
      nodes: { accent: '#abcdef' },
      background,
    })).toBe(true);

    expect(instance.colorSystem.entityThemeOverride(instance.state, areaKey)).toMatchObject({
      colorGroupId: 'test:group:blue',
      palette: ['#123456', '#654321'],
      tokens: { primary: '#123456', panel: '#654321' },
      nodes: { accent: '#abcdef' },
      background,
    });
  });

  test('story entity overrides clear by run without touching another run or manual scope', () => {
    const instance = game();
    const service = instance.entityPresentation as EntityPresentationService;

    expect(service.setRuntimeOverride(areaKey, 'alternate', 'declared-owner', 'story', 'run-a')).toBe(true);
    expect(service.setRuntimeOverride(areaKey, 'other', 'declared-owner', 'story', 'run-b')).toBe(true);
    expect(service.setRuntimeOverride(areaKey, 'alternate', 'manual-owner', 'manual')).toBe(true);
    expect(instance.entityPresentation.resolve(instance.state, areaKey)?.optionId).toBe('alternate');

    expect(service.clearRuntimeOverrides({ runId: 'run-a', lifetime: 'story' })).toBe(1);
    expect(instance.entityPresentation.resolve(instance.state, areaKey)?.optionId).toBe('alternate');
    expect(service.clearRuntimeOverrides({ runId: 'run-b', lifetime: 'story' })).toBe(1);
    expect(instance.entityPresentation.resolve(instance.state, areaKey)?.optionId).toBe('alternate');
    expect(service.clearRuntimeOverride(areaKey, 'manual-owner')).toBe(true);
    expect(instance.entityPresentation.resolve(instance.state, areaKey)?.optionId).toBeUndefined();
  });
});
