import { afterEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { createGameCommands } from '../../src/arona-clicker/runtime/runtime-commands';
import { baseDatapack } from '../../src/data/test-datapack';
import { finishStory, finishWelcome, makePack } from './story-test-fixtures';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { StoryRunFlags } from '../../src/engine/contracts/story-run-flags';

const storyId = 'test:story:local_flags';
const entryId = 'test:activestory:local_flags';
const definition: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: storyId, name: 'Local Flags', stages: { first: { advance: 'auto' }, click: { advance: 'input' }, end: { advance: 'auto' } }, nodes: [
  { id: 'set', type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'internal', value: null } },
  { id: 'first', type: 'talklet', stageId: 'first', requiresFlag: 'provided', content: { kind: 'talk', text: 'provided' } },
  { id: 'click', type: 'click', stageId: 'click', requiresFlag: 'provided', interaction: { kind: 'button', text: 'continue', result: { actions: [{ kind: 'localFlag', op: 'remove', name: 'internal' }] } } },
  { id: 'end', type: 'talklet', stageId: 'end', requiresFlag: 'internal', content: { kind: 'talk', text: 'internal' } },
] };
let game: GameInstance;
function setup() {
  game = new GameInstance();
  game.init([baseDatapack, makePack([{ id: entryId, storyId, type: 'active', availableInits: [], triggerCondition: { type: 'AND', conditions: [] } }], [definition])]);
  finishWelcome(game);
  return game;
}
afterEach(() => game?.dispose());

describe('formal Entry local flags lifecycle', () => {
  it('accepts initial values through GameCommands and isolates owners, saves and later Entries', () => {
    const g = setup();
    const commands = createGameCommands(g);
    const persistent = structuredClone(g.state.flags);
    expect(commands.startActiveStory(entryId, null, { provided: false }).success).toBe(true);
    expect(commands.startActiveStory(entryId, 'guest').success).toBe(true);
    expect(g.story.getCurrentStoryView()?.nodeId).toBe('first');
    expect(g.story.getCurrentStoryView('guest')?.nodeId).toBe('end');
    expect(g.story.saveCursor().playback.run!.localFlags).toEqual({ provided: false, internal: null });
    const save = JSON.parse(JSON.stringify(g.save()));
    g.load(save);
    expect(g.story.saveCursor().playback.run!.localFlags).toEqual({ provided: false, internal: null });
    expect(g.story.getCurrentStoryView('guest')?.nodeId).toBe('end');
    finishStory(g);
    expect(g.story.getCurrentStoryView()).toBeNull();
    expect(commands.startCardStory(entryId).success).toBe(true);
    expect(g.story.getCurrentStoryView()?.nodeId).toBe('end');
    expect(g.state.flags).toEqual(persistent);
    expect(g.story.saveCursor().flags).toEqual([]);
  });

  it('rejects invalid initial values before replacing an existing Entry', () => {
    const g = setup();
    const commands = createGameCommands(g);
    commands.startActiveStory(entryId, null, { provided: 0 });
    const before = g.story.getCurrentStoryView();
    for (const bad of [null, [], { bad: undefined }, { bad: Infinity }, { '': true }]) {
      expect(commands.startCardStory(entryId, null, bad as unknown as StoryRunFlags)).toMatchObject({ success: false, detail: 'InvalidLocalFlags' });
      expect(g.story.getCurrentStoryView()).toEqual(before);
    }
  });

  it('rejects a corrupt later-owner local map before changing game state or any wait', () => {
    const g = setup();
    g.story.startActiveStory(entryId, null, { provided: true });
    g.story.startActiveStory(entryId, 'guest', { provided: '' });
    const save = JSON.parse(JSON.stringify(g.save()));
    save.storyPlayback.chats['variant:guest'].playback.run.localFlags = [];
    const before = JSON.stringify(g.state);
    const global = g.story.getCurrentStoryView();
    const guest = g.story.getCurrentStoryView('guest');
    expect(() => g.load(save)).toThrow();
    expect(JSON.stringify(g.state)).toBe(before);
    expect(g.story.getCurrentStoryView()).toEqual(global);
    expect(g.story.getCurrentStoryView('guest')).toEqual(guest);
  });

  it('validates author gates and local action values before Registry replacement', () => {
    const g = setup();
    const before = g.registry.stories.get(storyId);
    const invalidNodes = [
      { ...definition.nodes[1], requiresFlag: '' },
      { ...definition.nodes[1], requiresFlag: ['one', 'two'] },
      { id: 'invalid', type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'ok' } },
      { id: 'invalid', type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'ok', value: NaN } },
      { id: 'invalid', type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'ok', value: new (class { hiddenPrototype = true; })() } },
      { id: 'invalid', type: 'operation', action: { kind: 'localFlag', op: 'remove', name: 'ok', value: false } },
    ];
    for (const node of invalidNodes) {
      const candidate = { ...definition, nodes: [node], stages: node.type === 'talklet' ? { first: { advance: 'auto' } } : {} } as unknown as StoryDef;
      expect(g.saveStoryDefinition(candidate).ok).toBe(false);
      expect(g.registry.stories.get(storyId)).toBe(before);
    }
    expect(g.saveStoryDefinition(structuredClone(definition)).ok).toBe(true);
    expect(g.registry.stories.get(storyId)).toEqual(definition);
  });
});
