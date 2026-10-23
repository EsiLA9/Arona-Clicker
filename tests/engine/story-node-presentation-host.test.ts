import { describe, expect, test } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { CharacterData } from '../../src/data-services/contracts/character-data';
import type { CharacterVariantDef } from '../../src/data-services/contracts/character-variant';
import type { GameEvent } from '../../src/engine/types/events';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { createStoryNodeActionHost } from '../../src/arona-clicker/services/story/story-node-action-host';
import { createStoryNodePresentationHost } from '../../src/arona-clicker/services/story/story-node-presentation-host';
import type { EntityPresentationService } from '../../src/arona-clicker/services/presentation/entity-presentation-service';
import type { StoryAction } from '../../src/data-services/contracts/story-node-actions';
import type { StoryNodeSource } from '../../src/arona-clicker/contracts/runtime/story-node-playback';
import type { StoryPresentationSnapshot } from '../../src/engine/contracts/story-presentation-snapshot';

const areaKey = 'area:test:area:main' as const;
const variantKey = 'variant:test:variant:a' as const;
const emptyCondition = { type: 'AND' as const, conditions: [] };

function pack(): Datapack {
  return {
    name: 'story-node-presentation-host-test',
    version: '1.0.0',
    inits: [{ id: 'test:init:main', name: 'Main', description: 'Main', defaultAreas: ['test:area:main'] }],
    areas: [{
      id: 'test:area:main', initId: 'test:init:main', name: 'Main', description: '', defaultSpots: [],
      presentation: { default: { name: 'Main', description: '' }, additions: [
        { id: 'alternate', label: 'Alternate', override: { name: 'Alternate' } },
        { id: 'other', label: 'Other', override: { name: 'Other' } },
      ] },
    }],
    spots: [], enhancements: [],
    activeStories: [{ id: 'test:activestory:target', storyId: 'test:story:target', type: 'active', availableInits: [], triggerCondition: emptyCondition }],
    passiveStories: [],
    stories: [{
      id: 'test:story:target', name: 'Target Story', stages: { main: { advance: 'auto' } },
      nodes: [{ id: 'line', type: 'talklet', stageId: 'main', content: { kind: 'narration', text: 'Target body' } }],
    }],
    items: [], funcletDefs: [],
    characters: [{ id: 'test:character:a' } as CharacterData],
    characterVariants: [{
      id: 'test:variant:a', proto: 'test:character:a', name: 'A', displayName: 'A', school: 'test', rarity: 'common', description: '',
    } as CharacterVariantDef],
  };
}

function setup() {
  const game = new GameInstance();
  game.init([pack()], { enterDefaultInit: false });
  game.colorSystem.syncSelectedThemeFromState(game.state);
  const events: GameEvent[] = [];
  game.eventBus.onAny(event => events.push(event));
  const presentation = createStoryNodePresentationHost({
    registry: game.registry,
    eventBus: game.eventBus,
    colorSystem: game.colorSystem,
    entityPresentation: game.entityPresentation as EntityPresentationService,
    getTitle: () => 'Entry opening title',
  });
  return { game, events, presentation };
}

const source = (runId: string, owner: string | null = 'test:variant:a'): StoryNodeSource => ({
  entryId: 'test:activestory:source', rootStoryId: 'test:story:source', owner, runId,
});

describe('StoryNodePresentationHost', () => {
  test('routes overlay text, message, entry card and title with the complete source identity', () => {
    const { events, presentation } = setup();
    const current = source('run-a');
    const actions: StoryAction[] = [
      { kind: 'overlay', command: { command: 'show', id: 'tip', x: 0.2, y: 0.7, content: { kind: 'text', text: 'Hint', template: 'note' } } },
      { kind: 'overlay', command: { command: 'show', id: 'message', content: { kind: 'message', content: { kind: 'talk', speaker: 'A', text: 'Hello', image: 'a.png' }, presentation: { side: 'left', avatarMode: 'hide' } } } },
      { kind: 'overlay', command: { command: 'show', id: 'invite', content: { kind: 'entryCard', card: {
        request: { entryId: 'test:activestory:target', entryType: 'active', owner: null, intent: 'card' },
        title: 'Invitation', buttonText: 'Enter', align: 'right',
      } } } },
      { kind: 'presentation', command: { command: 'openingTitle' } },
    ];

    for (const action of actions) expect(presentation.execute(action, current).status).toBe('applied');

    expect(events.filter(event => event.type === 'chatTextShown')).toEqual([
      expect.objectContaining({ type: 'chatTextShown', id: 'tip', owner: current.owner, runId: 'run-a', text: 'Hint', x: 0.2, y: 0.7, kind: 'note' }),
      expect.objectContaining({ type: 'chatTextShown', id: 'message', owner: current.owner, runId: 'run-a', talklet: expect.objectContaining({ text: 'Hello', speaker: 'A', image: 'a.png', side: 'left', noAvatar: true }) }),
      expect.objectContaining({
        type: 'chatTextShown', id: 'invite', owner: current.owner, runId: 'run-a', kind: 'kizuna',
        cardRequest: { entryId: 'test:activestory:target', entryType: 'active', owner: null, intent: 'card' },
        targetStoryId: 'test:story:target', title: 'Invitation', buttonText: 'Enter',
      }),
    ]);
    expect(events).toContainEqual(expect.objectContaining({ type: 'openingTitleShown', owner: current.owner, runId: 'run-a', title: 'Entry opening title' }));
  });

  test('scopes themes and story entity overrides to their run and emits one terminal event', () => {
    const { game, events, presentation } = setup();
    const base = game.colorSystem.runtimeTheme().tokens.primary;
    const runA = source('run-a');
    const runB = source('run-b', 'test:variant:b');
    presentation.activate(runA.owner);
    expect(presentation.execute({ kind: 'presentation', command: { command: 'theme', value: {
      tokens: { primary: '#111111' }, background: [{ id: 'run-a-background', kind: 'solid', value: '#121212' }],
    } } }, runA).status).toBe('applied');
    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe('#111111');
    expect(game.colorSystem.runtimeTheme().background).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'run-a-background' })]));

    expect(presentation.execute({ kind: 'presentation', command: { command: 'theme', value: { tokens: { primary: '#222222' } } } }, runB).status).toBe('applied');
    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe('#111111');
    presentation.activate(runB.owner);
    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe('#222222');

    expect(presentation.execute({ kind: 'presentation', command: { command: 'setEntityPresentation', target: areaKey, optionId: 'alternate', owner: 'authored-owner', lifetime: 'story' } }, runA).status).toBe('applied');
    expect(presentation.execute({ kind: 'presentation', command: { command: 'setEntityPresentation', target: areaKey, optionId: 'other', owner: 'authored-owner', lifetime: 'story' } }, runB).status).toBe('applied');
    expect(game.entityPresentation.resolve(game.state, areaKey)?.optionId).toBe('other');

    presentation.close(runA, 'replaced');
    presentation.close(runA, 'replaced');
    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe('#222222');
    expect(game.entityPresentation.resolve(game.state, areaKey)?.optionId).toBe('other');
    expect(events.filter(event => event.type === 'storyRunEnded')).toEqual([
      { type: 'storyRunEnded', owner: runA.owner, runId: 'run-a', reason: 'replaced' },
    ]);

    presentation.close(runB, 'completed');
    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe(base);
    expect(game.entityPresentation.resolve(game.state, areaKey)?.optionId).toBeUndefined();
  });

  test('area and student theme writes retain background data', () => {
    const { game, presentation } = setup();
    const areaBackground = [{ id: 'area-background', kind: 'solid' as const, value: '#334455' }];
    const studentBackground = [{ id: 'student-background', kind: 'gradient' as const, value: 'linear-gradient(#112233, #445566)' }];
    expect(presentation.execute({ kind: 'presentation', command: { command: 'theme', value: {
      scope: 'area', entityKey: 'area:test:area:main', background: areaBackground, tokens: { primary: '#334455' },
    } } }, source('run-area')).status).toBe('applied');
    expect(presentation.execute({ kind: 'presentation', command: { command: 'theme', value: {
      scope: 'student', entityKey: variantKey, background: studentBackground, nodes: { accent: '#abcdef' },
    } } }, source('run-student')).status).toBe('applied');

    expect(game.colorSystem.entityThemeOverride(game.state, areaKey)).toMatchObject({ background: areaBackground });
    expect(game.colorSystem.entityThemeOverride(game.state, variantKey)).toMatchObject({ background: studentBackground });
    expect(presentation.save(source('run-area')).ephemeralTheme).toBeUndefined();
  });

  test('overlay clear commands update only the source run snapshot', () => {
    const { presentation } = setup();
    const runA = source('run-a');
    const runB = source('run-b', null);
    const show = (id: string, text: string): StoryAction => ({ kind: 'overlay', command: { command: 'show', id, content: { kind: 'text', text } } });

    presentation.execute(show('a-hint', 'A'), runA);
    presentation.execute(show('b-hint', 'B'), runB);
    presentation.execute({ kind: 'overlay', command: { command: 'clearId', id: 'a-hint' } }, runA);
    expect(presentation.save(runA).overlays).toEqual([]);
    expect(presentation.save(runB).overlays).toMatchObject([{ id: 'b-hint', value: { text: 'B' } }]);

    presentation.execute(show('a-next', 'A2'), runA);
    presentation.execute({ kind: 'overlay', command: { command: 'clearAllTexts' } }, runA);
    expect(presentation.save(runA).overlays).toEqual([]);
    expect(presentation.save(runB).overlays).toMatchObject([{ id: 'b-hint', value: { text: 'B' } }]);

    presentation.execute(show('a-flow', 'A3'), runA);
    presentation.execute({ kind: 'overlay', command: { command: 'clearFlow' } }, runA);
    expect(presentation.save(runA).overlays).toEqual([]);
  });

  test('prevalidates every snapshot reference before applying any restored presentation', () => {
    const { game, events, presentation } = setup();
    const current = source('run-invalid');
    const beforeTheme = game.colorSystem.runtimeTheme().tokens.primary;
    const beforeEvents = events.length;
    const malformed: StoryPresentationSnapshot = {
      ephemeralTheme: { scope: 'ephemeral', tokens: { primary: '#123456' } },
      entities: [{ target: areaKey, optionId: 'alternate', owner: 'author-owner', lifetime: 'story' }],
      overlays: [{
        id: 'broken-invite',
        value: {
          kind: 'kizuna', targetStoryId: 'test:story:wrong',
          talklet: { kind: 'click', text: 'Enter', kizuna: { storyId: 'test:story:wrong' } },
        },
        cardRequest: { entryId: 'test:activestory:target', entryType: 'active', owner: null, intent: 'card' },
      }],
    };

    expect(() => presentation.validateSnapshot(current, malformed)).toThrow('StoryPresentationSnapshotInvalid:CardRequestTargetMismatch');
    expect(() => presentation.restore(current, malformed)).toThrow('StoryPresentationSnapshotInvalid:CardRequestTargetMismatch');

    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe(beforeTheme);
    expect(game.entityPresentation.resolve(game.state, areaKey)?.optionId).toBeUndefined();
    expect(events).toHaveLength(beforeEvents);
  });

  test('explicit story presentation clear matches the active source run and author owner', () => {
    const { game, presentation } = setup();
    const runA = source('run-a');
    const runB = source('run-b', null);
    const set = (optionId: string): StoryAction => ({ kind: 'presentation', command: {
      command: 'setEntityPresentation', target: areaKey, optionId, owner: 'shared-author-owner', lifetime: 'story',
    } });
    presentation.execute(set('alternate'), runA);
    presentation.execute(set('other'), runB);

    expect(presentation.execute({ kind: 'presentation', command: {
      command: 'clearEntityPresentation', target: areaKey, owner: 'shared-author-owner',
    } }, runA).status).toBe('applied');
    expect(presentation.save(runA).entities).toEqual([]);
    expect(presentation.save(runB).entities).toMatchObject([{ optionId: 'other', owner: 'shared-author-owner' }]);
    expect(game.entityPresentation.resolve(game.state, areaKey)?.optionId).toBe('other');
    presentation.close(runA, 'cancelled');
    expect(game.entityPresentation.resolve(game.state, areaKey)?.optionId).toBe('other');
  });

  test('saves only active-run presentation and restores it under a fresh runId without replaying the title', () => {
    const { game, events, presentation } = setup();
    const original = source('run-before-save');
    presentation.activate(original.owner);
    expect(presentation.execute({ kind: 'presentation', command: { command: 'theme', value: { tokens: { primary: '#778899' } } } }, original).status).toBe('applied');
    expect(presentation.execute({ kind: 'presentation', command: { command: 'setEntityPresentation', target: areaKey, optionId: 'alternate', owner: 'author-owner', lifetime: 'story' } }, original).status).toBe('applied');
    expect(presentation.execute({ kind: 'overlay', command: { command: 'show', id: 'saved-hint', content: { kind: 'text', text: 'Saved hint' } } }, original).status).toBe('applied');
    expect(presentation.execute({ kind: 'overlay', command: { command: 'show', id: 'saved-invite', content: { kind: 'entryCard', card: {
      request: { entryId: 'test:activestory:target', entryType: 'active', owner: null, intent: 'card' }, title: 'Invite', buttonText: 'Enter',
    } } } }, original).status).toBe('applied');
    expect(presentation.execute({ kind: 'presentation', command: { command: 'openingTitle' } }, original).status).toBe('applied');

    const eventCount = events.length;
    const snapshot = presentation.save(original);
    expect(events).toHaveLength(eventCount);
    expect(snapshot.ephemeralTheme).toMatchObject({ scope: 'ephemeral', tokens: { primary: '#778899' } });
    expect(snapshot.entities).toEqual([{ target: areaKey, optionId: 'alternate', owner: 'author-owner', lifetime: 'story' }]);
    expect(snapshot.overlays).toEqual(expect.arrayContaining([
      { id: 'saved-hint', value: { text: 'Saved hint' } },
      expect.objectContaining({
        id: 'saved-invite', cardRequest: { entryId: 'test:activestory:target', entryType: 'active', owner: null, intent: 'card' },
        value: expect.objectContaining({ kind: 'kizuna', targetStoryId: 'test:story:target' }),
      }),
    ]));

    presentation.close(original, 'cancelled');
    expect(game.entityPresentation.resolve(game.state, areaKey)?.optionId).toBeUndefined();
    const closedEventCount = events.length;
    const restored = source('run-after-restore');
    presentation.validateSnapshot(restored, snapshot);
    expect(events).toHaveLength(closedEventCount);
    presentation.restore(restored, snapshot);

    expect(game.colorSystem.runtimeTheme().tokens.primary).toBe('#778899');
    expect(game.entityPresentation.resolve(game.state, areaKey)?.optionId).toBe('alternate');
    expect(events.filter(event => event.type === 'openingTitleShown')).toHaveLength(1);
    expect([...events.filter(event => event.type === 'chatTextShown' && event.id === 'saved-hint')].reverse()[0])
      .toMatchObject({ type: 'chatTextShown', id: 'saved-hint', runId: 'run-after-restore', owner: restored.owner, text: 'Saved hint' });
    expect([...events.filter(event => event.type === 'chatTextShown' && event.id === 'saved-invite')].reverse()[0])
      .toMatchObject({ type: 'chatTextShown', id: 'saved-invite', runId: 'run-after-restore', owner: restored.owner, cardRequest: snapshot.overlays.find(overlay => overlay.id === 'saved-invite')?.cardRequest });
    expect(presentation.execute({ kind: 'overlay', command: { command: 'clearId', id: 'saved-hint' } }, original))
      .toEqual({ status: 'rejected', error: 'StoryRunAlreadyEnded' });

    presentation.close(restored, 'completed');
    expect(game.entityPresentation.resolve(game.state, areaKey)?.optionId).toBeUndefined();
  });

  test('ActionHost delegates lifecycle-aware overlays while the no-port diagnostic remains available', () => {
    const { game, events, presentation } = setup();
    const sourceForAction = source('run-action');
    const actionHost = createStoryNodeActionHost({
      registry: game.registry,
      effectEngine: game.effectEngine,
      conditionSystem: game.conditionSystem,
      getState: () => game.state,
      storyService: game.storyService,
      travelToArea: () => ({ success: true, areaId: 'test:area:main', fromAreaId: null }),
      eventBus: game.eventBus,
      presentation,
    });
    const overlay: StoryAction = { kind: 'overlay', command: { command: 'show', id: 'background', content: { kind: 'text', text: 'Visible' } } };
    expect(actionHost.preflight(overlay, sourceForAction)).toBeUndefined();
    expect(actionHost.execute(overlay, sourceForAction).status).toBe('applied');
    expect(events).toContainEqual(expect.objectContaining({ type: 'chatTextShown', id: 'background', runId: 'run-action' }));
  });
});
