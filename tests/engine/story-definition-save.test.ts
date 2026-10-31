import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime/runtime';
import { createGameCommands } from '../../src/arona-clicker/runtime/runtime-commands';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { baseDatapack } from '../../src/data/test-datapack';

const document = (id = 'local:story:author_test') => ({ id, name: '作者保存测试',
  stages: { text: { advance: 'auto' as const } },
  nodes: [{ id: 'line', type: 'talklet' as const, stageId: 'text', content: { kind: 'narration' as const, text: '新第一行' } }],
});

describe('StoryDef current Registry save command', () => {
  let game: GameInstance;
  beforeEach(() => { game = new GameInstance(); game.init([baseDatapack]); });
  afterEach(() => game.stop());

  it('creates and replaces the actual definition, detaches inputs, and leaves player state unchanged', () => {
    const commands = createGameCommands(game);
    const story = document();
    const state = structuredClone(game.state);
    const count = game.registry.stories.size;
    expect(commands.saveStoryDefinition(story)).toEqual({ ok: true, storyId: story.id, operation: 'create' });
    expect(game.registry.stories.get(story.id)).toEqual(story);
    expect(game.registry.stories.size).toBe(count + 1);
    story.nodes[0].content.text = '还没再次保存';
    expect(game.registry.stories.get(story.id)?.nodes[0]).toMatchObject({ content: { text: '新第一行' } });
    expect(commands.saveStoryDefinition(story)).toEqual({ ok: true, storyId: story.id, operation: 'replace' });
    expect(game.registry.stories.get(story.id)?.nodes[0]).toMatchObject({ content: { text: '还没再次保存' } });
    expect(game.registry.stories.size).toBe(count + 1);
    expect(game.state).toEqual(state);
  });

  it('saves state actions while dropping completely empty effect placeholders', () => {
    const story = {
      ...document('local:story:empty_effect_placeholder'),
      stages: {},
      nodes: [
        { id: 'blank-operation', type: 'operation' },
        { id: 'empty-state-operation', type: 'operation', action: { kind: 'state', effects: [{}] } },
        { id: 'blank-transfer', type: 'transfer', transfer: {} },
        { id: 'op', type: 'operation', action: { kind: 'state', effects: [
          { op: 'addResource', resourceId: 'base:resource:credit', amount: 10 }, {},
        ] } },
      ],
    } as unknown as StoryDef;

    expect(game.saveStoryDefinition(story)).toEqual({ ok: true, storyId: story.id, operation: 'create' });
    expect(game.registry.stories.get(story.id)?.nodes).toEqual([{ id: 'op', type: 'operation', action: { kind: 'state', effects: [
      { op: 'addResource', resourceId: 'base:resource:credit', amount: 10 },
    ] } }]);
    expect(story.nodes).toHaveLength(4);
  });

  it.each([
    { ...document(), id: 'not-a-story' },
    { ...document(), stages: {} },
    { ...document(), nodes: [{ id: 'transfer', type: 'transfer', transfer: { mode: 'goto', storyId: 'missing:story:target' } }], stages: {} },
    { ...document(), nodes: [{ id: 'click', type: 'click', stageId: 'click', interaction: { kind: 'button', text: '' } }], stages: { click: { advance: 'input' } } },
  ])('rejects invalid author content before changing Registry: %#', candidate => {
    const original = document();
    game.saveStoryDefinition(original);
    const stored = game.registry.stories.get(original.id);
    const count = game.registry.stories.size;
    // Deliberately malformed external data verifies the Runtime boundary too.
    const result = game.saveStoryDefinition(candidate as unknown as StoryDef);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBeTruthy();
    expect(game.registry.stories.get(original.id)).toBe(stored);
    expect(game.registry.stories.size).toBe(count);
  });

  it('round-trips all registered stories without dropping complex author fields', () => {
    const stories = [...game.registry.stories.values()].map(story => structuredClone(story));
    for (const story of stories) {
      expect(game.saveStoryDefinition(story), story.id).toMatchObject({ ok: true, operation: 'replace' });
      expect(game.registry.stories.get(story.id)).toEqual(story);
    }
  });

  it('retains the active session copy and uses saved content when the next session starts', () => {
    game.inits.startNewGame('base:init:schale_office');
    const before = game.story.getCurrentStoryView();
    expect(before).not.toBeNull();
    const id = game.story.getCurrentStoryDefId()!;
    const replacement = document(id);
    expect(game.saveStoryDefinition(replacement).ok).toBe(true);
    expect(game.story.getCurrentStoryView()?.page).toEqual(before!.page);
    expect(game.story.getCurrentStoryView()?.token).toBe(before!.token);
    game.story.clearCurrentStory();
    game.story.startActiveStory(before!.storyId);
    expect(game.story.getCurrentStoryView()?.page.text).toBe('新第一行');
  });

  it('needs no editing Mod and does not change a pack; reloading uses packaged content', () => {
    const runtime = new AronaClickerRuntime();
    try {
      runtime.init([baseDatapack]);
      const packs = runtime.getPackCatalog();
      const original = [...runtime.registry.stories.values()][0];
      const replacement = { ...original, name: '临时覆盖' };
      expect(createGameCommands(runtime).saveStoryDefinition(replacement).ok).toBe(true);
      expect(runtime.registry.stories.get(original.id)?.name).toBe('临时覆盖');
      expect(runtime.getPackCatalog()).toEqual(packs);
      runtime.init([baseDatapack]);
      expect(runtime.registry.stories.get(original.id)?.name).toBe(original.name);
    } finally { runtime.stop(); }
  });
});
