import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { SaveData } from '../../src/arona-clicker/contracts/runtime/save-data';
import type { ActiveStoryEntry } from '../../src/data-services/contracts/story-entry';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { baseDatapack } from '../../src/data/test-datapack';
import { and } from '../../src/engine/types';
import { finishWelcome, makePack } from './story-test-fixtures';

describe('Story cursor save preflight', () => {
  let game: GameInstance | undefined;

  afterEach(() => {
    game?.stop();
    game = undefined;
  });

  test('invalid owner or node checkpoint is rejected before state, current wait, or run lifecycle changes', () => {
    game = new GameInstance();
    game.init([baseDatapack]);
    const active = game.story.getCurrentStoryView();
    if (!active) throw new Error('expected the initial welcome delivery');
    const save = game.save();
    const ended: string[] = [];
    game.eventBus.on('storyRunEnded', event => ended.push(event.runId));
    const beforeState = JSON.stringify(game.state);
    const beforeView = game.story.getCurrentStoryView();

    const invalidOwner = structuredClone(save);
    invalidOwner.storyPlayback = {
      ...invalidOwner.storyPlayback,
      chats: { 'not-a-variant-key': invalidOwner.storyPlayback.global },
    };
    expect(() => game!.load(invalidOwner)).toThrow('InvalidStoryCursorOwnerKey');

    const run = save.storyPlayback.global.playback.run;
    if (!run) throw new Error('expected a saved node run');
    const invalidNode = structuredClone(save);
    invalidNode.storyPlayback = {
      ...invalidNode.storyPlayback,
      global: {
        ...invalidNode.storyPlayback.global,
        playback: { ...invalidNode.storyPlayback.global.playback, run: { ...run, nodeId: 'missing-node' } },
      },
    };
    expect(() => game!.load(invalidNode)).toThrow('InvalidSnapshot');

    const invalidChoiceMetadata = structuredClone(save);
    invalidChoiceMetadata.storyPlayback = {
      ...invalidChoiceMetadata.storyPlayback,
      global: { ...invalidChoiceMetadata.storyPlayback.global, lastChoiceIndex: 0, lastChoiceStoryId: 'test:story:missing' },
    };
    expect(() => game!.load(invalidChoiceMetadata)).toThrow('InvalidStoryCursorMetadata');

    expect(JSON.stringify(game.state)).toBe(beforeState);
    expect(game.story.getCurrentStoryView()).toEqual(beforeView);
    expect(ended).toEqual([]);
  });

  test('保存根 Story 的 Choice 归属，恢复 insert 子 Story 后返回根完成仍结算对应 choiceIndex', () => {
    const rootId = 'test:story:choice_insert_root';
    const childId = 'test:story:choice_insert_child';
    const entry: ActiveStoryEntry = {
      id: 'test:activestory:choice_insert_root', storyId: rootId, type: 'active', availableInits: [], triggerCondition: and(),
    };
    const root: StoryDef = {
      id: rootId, name: 'choice insert root',
      stages: { choose: { advance: 'input' }, after: { advance: 'auto' } },
      nodes: [
        { id: 'prompt', type: 'talklet', stageId: 'choose', content: { kind: 'narration', text: 'Choose.' } },
        { id: 'choose', type: 'click', stageId: 'choose', interaction: { kind: 'choice', options: [
          { id: 'insert-child', text: 'Continue', result: { transfer: { mode: 'insert', storyId: childId } } },
        ] } },
        { id: 'root-return', type: 'talklet', stageId: 'after', content: { kind: 'narration', text: 'Back in root.' } },
      ],
    };
    const child: StoryDef = {
      id: childId, name: 'choice insert child', stages: { child: { advance: 'auto' } },
      nodes: [{ id: 'child-body', type: 'talklet', stageId: 'child', content: { kind: 'narration', text: 'Child.' } }],
    };
    game = new GameInstance();
    game.init([baseDatapack, makePack([entry], [root, child])]);
    finishWelcome(game);

    const started = game.story.startStory(entry.id, 'active');
    if (!started.success || started.finished) throw new Error('expected the root Story delivery');
    const prompt = started.story;
    expect(game.story.advanceStory(undefined, null, prompt.token)).toMatchObject({ success: true, finished: false });
    const choice = game.story.getCurrentStoryView();
    if (!choice || choice.phase !== 'input') throw new Error('expected the root Choice input');
    expect(game.story.advanceStory('insert-child', null, choice.token)).toMatchObject({ success: true, finished: false });
    expect(game.story.getCurrentStoryView()).toMatchObject({ storyDefId: childId, phase: 'delivery' });

    const save = game.save();
    expect(save.storyPlayback.global).toMatchObject({ lastChoiceIndex: 0, lastChoiceStoryId: rootId });
    game.load(save);
    expect(game.story.getCurrentStoryView()).toMatchObject({ storyDefId: childId, phase: 'delivery' });

    const childDelivery = game.story.getCurrentStoryView()!;
    const childAck = game.story.advanceStory(undefined, null, childDelivery.token);
    expect(childAck).toMatchObject({ success: true, finished: false, story: { storyDefId: rootId, nodeId: 'root-return' } });
    const rootDelivery = game.story.getCurrentStoryView()!;
    const completion = game.story.advanceStory(undefined, null, rootDelivery.token);
    expect(completion).toMatchObject({
      success: true, finished: true, storyId: rootId,
      completed: { type: 'active', storyId: rootId, choiceIndex: 0 },
    });
  });
});
