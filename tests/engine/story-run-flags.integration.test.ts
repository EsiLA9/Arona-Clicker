import { afterEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { createGameCommands } from '../../src/arona-clicker/runtime/runtime-commands';
import { baseDatapack } from '../../src/data/test-datapack';
import { finishStory, finishWelcome, makePack } from './story-test-fixtures';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { StoryRunFlags } from '../../src/engine/contracts/story-run-flags';

const storyId = 'test:story:local_flags';
const entryId = 'test:activestory:local_flags';
const zeroChoiceId = 'test:story:zero_choice';
const zeroChoiceEntryId = 'test:activestory:zero_choice';
const historyChoiceId = 'test:story:choice_history';
const historyChoiceEntryId = 'test:activestory:choice_history';
const definition: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: storyId, name: 'Local Flags', stages: { first: { advance: 'auto' }, click: { advance: 'input' }, end: { advance: 'auto' } }, nodes: [
  { id: 'set', type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'internal', value: null } },
  { id: 'first', type: 'talklet', stageId: 'first', requiresFlag: 'provided', content: { kind: 'talk', text: 'provided' } },
  { id: 'click', type: 'click', stageId: 'click', requiresFlag: 'provided', interaction: { kind: 'button', text: 'continue' } },
  { id: "click-effect-1", type: 'operation', requiresFlag: 'provided', action: { kind: 'localFlag', op: 'remove', name: 'internal' } },
  { id: 'end', type: 'talklet', stageId: 'end', requiresFlag: 'internal', content: { kind: 'talk', text: 'internal' } },
] };
const flagCondition = (key: string) => ({ type: 'AND' as const, conditions: [{ target: 'flag' as const, key, comparator: '==' as const, value: 1 }] });
const zeroChoice: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: zeroChoiceId, name: 'Zero Choice', stages: { choose: { advance: 'input' }, tail: { advance: 'auto' } }, nodes: [
  { id: 'choose', type: 'click', stageId: 'choose', interaction: { kind: 'choice', options: [
    { id: 'a', text: 'A', showWhen: flagCondition('choice_gate'), requiresFlag: 'local_gate', marks: ['route_a'] },
    { id: 'b', text: 'B', showWhen: flagCondition('choice_gate'), requiresFlag: 'local_gate', marks: ['route_b'] },
  ] } },
  { id: 'a-only', type: 'talklet', stageId: 'tail', requiresFlag: 'route_a', content: { kind: 'narration', text: 'hidden branch' } },
  { id: 'tail', type: 'talklet', stageId: 'tail', content: { kind: 'narration', text: 'continued' } },
] };
const historyChoice: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: historyChoiceId, name: 'Choice History', stages: { choose: { advance: 'input' }, tail: { advance: 'auto' } }, nodes: [
  { id: 'choose', type: 'click', stageId: 'choose', interaction: { kind: 'choice', options: [
    { id: 'a', text: 'Visible A', requiresFlag: 'shown', marks: ['route_a'] },
    { id: 'hidden', text: 'Hidden B', requiresFlag: 'hidden', marks: ['route_b'] },
    { id: 'c', text: 'Visible C', requiresFlag: 'shown', marks: ['route_c'] },
  ] } },
  { id: 'tail', type: 'talklet', stageId: 'tail', content: { kind: 'narration', text: 'continued' } },
] };
let game: GameInstance;
function setup() {
  game = new GameInstance();
  game.init([baseDatapack, makePack([{ id: entryId, storyId, availableInits: [], triggerCondition: { type: 'AND', conditions: [] }, activation: { kind: 'active' as const } }], [definition])]);
  finishWelcome(game);
  return game;
}
function setupChoiceStories() {
  game = new GameInstance();
  game.init([baseDatapack, makePack([
    { id: zeroChoiceEntryId, storyId: zeroChoiceId, availableInits: [], triggerCondition: { type: 'AND', conditions: [] }, activation: { kind: 'active' as const } },
    { id: historyChoiceEntryId, storyId: historyChoiceId, availableInits: [], triggerCondition: { type: 'AND', conditions: [] }, activation: { kind: 'active' as const } },
  ], [zeroChoice, historyChoice])]);
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

  it('waits for an explicit submit when every Choice candidate disappears, including after restore', () => {
    const g = setupChoiceStories();
    g.mutations.setFlag('choice_gate', '1');
    expect(g.story.startActiveStory(zeroChoiceEntryId, null, { route_a: false, route_b: 0, local_gate: null, unrelated: 'keep' }).success).toBe(true);
    const initial = g.story.getCurrentStoryView()!;
    expect(initial).toMatchObject({ nodeId: 'choose', availableChoiceIndexes: [0, 1] });
    g.mutations.setFlag('choice_gate', '');
    const save = g.save();
    g.load(save);

    const waiting = g.story.getCurrentStoryView()!;
    expect(waiting).toMatchObject({ nodeId: 'choose', availableChoiceIndexes: [] });
    const playback = g.story.getPlaybackView();
    const send = g.story.getSendState();
    expect(send).toMatchObject({ mode: 'advance', token: waiting.token, text: '继续故事' });
    expect(g.story.getCurrentStoryView()).toEqual(waiting);
    expect(g.story.getPlaybackView()).toEqual(playback);
    expect(g.story.saveCursors().global.playback.run?.localFlags).toEqual({ route_a: false, route_b: 0, local_gate: null, unrelated: 'keep' });

    expect(send.mode === 'advance' && g.story.submitStoryInput(null, send.token!).success).toBe(true);
    expect(g.story.getCurrentStoryView()?.nodeId).toBe('tail');
    expect(g.story.saveCursors().global.playback.run?.localFlags).toEqual({ local_gate: null, unrelated: 'keep' });
    expect(g.story.getPlaybackView().entries.filter(entry => entry.historyId === waiting.historyId).some(entry => entry.choice)).toBe(false);
    expect(g.state.flags).not.toHaveProperty('route_a');
    expect(g.state.flags).not.toHaveProperty('route_b');
  });

  it('records only visible Choice labels while retaining the original selected option index', () => {
    const g = setupChoiceStories();
    expect(g.story.startActiveStory(historyChoiceEntryId, null, { shown: false }).success).toBe(true);
    const waiting = g.story.getCurrentStoryView()!;
    expect(waiting.availableChoiceIndexes).toEqual([0, 2]);
    expect(g.story.submitStoryInput(null, waiting.token, 'c').success).toBe(true);
    const history = g.story.getPlaybackView().entries.find(entry => entry.historyId === waiting.historyId && entry.choice);
    expect(history?.choice).toEqual({ options: [{ id: 'a', text: 'Visible A' }, { id: 'c', text: 'Visible C' }], selectedOptionId: 'c' });
    expect(g.story.saveCursors().global).toMatchObject({ lastChoiceIndex: 2, lastChoiceStoryId: historyChoiceId });
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
