import { afterEach, describe, expect, test } from 'vitest';
import type { ActiveStoryEntry } from '../../src/data-services/contracts/story-entry';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { Resource } from '../../src/arona-clicker/types/ids';
import { and } from '../../src/engine/types';
import { baseDatapack } from '../../src/data/test-datapack';
import { finishWelcome, finishStory, makePack } from './story-test-fixtures';

const OFFICE = 'base:init:schale_office';

function activeEntry(id: string, storyId: string, extra: Partial<ActiveStoryEntry> = {}): ActiveStoryEntry {
  return {
    id, storyId, type: 'active', availableInits: [], triggerCondition: and(), ...extra,
  };
}

function nodeDoc(id: string, nodes: StoryDef['nodes'], stages: StoryDef['stages'] = {}): StoryDef {
  return { id, name: id, stages, nodes };
}

function createGame(pack: ReturnType<typeof makePack>): GameInstance {
  const game = new GameInstance();
  game.init([baseDatapack, pack]);
  finishWelcome(game);
  return game;
}

describe('StoryService StoryNode 会话集成', () => {
  const games: GameInstance[] = [];
  const track = (pack: ReturnType<typeof makePack>): GameInstance => {
    const game = createGame(pack);
    games.push(game);
    return game;
  };

  afterEach(() => games.forEach(game => game.stop()));

  test('同 owner Operation 启动并完成卡片目标时，原 start 返回目标 completed 且两个 run 各清理一次', () => {
    const targetEntry = activeEntry('test:story:node_reentrant_target', 'test:story:node_reentrant_target_doc', {
      completionReward: { first: [{ op: 'addResource', target: Resource.Pyroxene, value: 3 }] },
    });
    const sourceEntry = activeEntry('test:story:node_reentrant_source', 'test:story:node_reentrant_source_doc');
    const target = nodeDoc(targetEntry.storyId, [{
      id: 'mark-target', type: 'operation',
      action: { kind: 'state', effects: [{ op: 'setFlag', flagId: 'node_reentrant_target_ran', value: true }] },
    }]);
    const source = nodeDoc(sourceEntry.storyId, [{
      id: 'start-target', type: 'operation',
      action: { kind: 'entryRequest', request: {
        entryId: targetEntry.id, entryType: 'active', owner: null, intent: 'card',
      } },
    }]);
    const game = track(makePack([targetEntry, sourceEntry], [target, source]));
    const ended: { owner: string | null; runId: string; reason: string }[] = [];
    game.eventBus.on('storyRunEnded', event => ended.push(event));
    const beforePyroxene = game.state.globalResources?.[Resource.Pyroxene] ?? 0;

    const result = game.story.startActiveStory(sourceEntry.id);

    expect(result).toMatchObject({ success: true, finished: true, storyId: target.id, completed: { type: 'active', storyId: target.id } });
    expect(game.story.getCurrentStoryId()).toBeNull();
    expect(game.state.flags.node_reentrant_target_ran).toBe('true');
    expect((game.state.globalResources?.[Resource.Pyroxene] ?? 0) - beforePyroxene).toBe(3);
    expect(game.state.storyLog.some(record => record.storyId === target.id)).toBe(true);
    expect(game.state.storyLog.some(record => record.storyId === source.id)).toBe(false);
    expect(ended.map(event => event.reason)).toEqual(['replaced', 'completed']);
    expect(new Set(ended.map(event => event.runId)).size).toBe(2);
  });

  test('chat owner 的节点、token 与输入各自隔离', () => {
    const storyA = nodeDoc('test:story:node_owner_a', [
      { id: 'a-body', type: 'talklet', stageId: 'a', content: { kind: 'talk', text: 'A', speaker: 'A' } },
      { id: 'a-click', type: 'click', stageId: 'a', interaction: { kind: 'button', text: 'continue' } },
    ], { a: { advance: 'input' } });
    const storyB = nodeDoc('test:story:node_owner_b', [
      { id: 'b-body', type: 'talklet', stageId: 'b', content: { kind: 'talk', text: 'B', speaker: 'B' } },
      { id: 'b-click', type: 'click', stageId: 'b', interaction: { kind: 'button', text: 'continue' } },
    ], { b: { advance: 'input' } });
    const entryA = activeEntry('test:story:node_owner_a_entry', storyA.id, { owner: 'A' });
    const entryB = activeEntry('test:story:node_owner_b_entry', storyB.id, { owner: 'B' });
    const game = track(makePack([entryA, entryB], [storyA, storyB]));

    const startedA = game.story.startStory(entryA.id, 'active', 'A');
    const startedB = game.story.startStory(entryB.id, 'active', 'B');
    expect(startedA.success && !startedA.finished).toBe(true);
    expect(startedB.success && !startedB.finished).toBe(true);
    const beforeA = game.story.getCurrentStoryView('A')!;
    const beforeB = game.story.getCurrentStoryView('B')!;
    expect(beforeA.token).not.toBe(beforeB.token);

    expect(game.story.advanceStory(undefined, 'A', beforeA.token).success).toBe(true);
    const inputA = game.story.getCurrentStoryView('A')!;
    expect(inputA).toMatchObject({ nodeId: 'a-click', phase: 'input', storyDefId: storyA.id });
    expect(game.story.getCurrentStoryView('B')).toMatchObject({ nodeId: 'b-body', phase: 'delivery', token: beforeB.token });
    expect(game.story.advanceStory(undefined, 'A', inputA.token)).toMatchObject({ success: false, error: 'ClickRequired' });

    const stale = game.story.clickSend('A', beforeB.token);
    expect(stale.type).toBe('completed');
    if (stale.type === 'completed') expect(stale.advance).toMatchObject({ success: false, error: 'StaleToken' });
    expect(game.story.getCurrentStoryView('A')?.token).toBe(inputA.token);

    const completedA = game.story.clickSend('A', inputA.token);
    expect(completedA.type).toBe('completed');
    if (completedA.type === 'completed') expect(completedA.advance).toMatchObject({ success: true, finished: true });
    expect(game.story.getCurrentStoryView('B')).toMatchObject({ nodeId: 'b-body', phase: 'delivery', token: beforeB.token });
  });

  test('首次和强制重开按 Entry 奖励结算；replay 完成不重复奖励或日志', () => {
    const story = nodeDoc('test:story:node_reward', [
      { id: 'reward-body', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: 'done' } },
    ], { body: { advance: 'auto' } });
    const entry = activeEntry('test:story:node_reward_entry', story.id, {
      replayable: true,
      completionReward: {
        first: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
        repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 2 }],
      },
    });
    const game = track(makePack([entry], [story]));
    const initial = game.state.globalResources?.[Resource.Pyroxene] ?? 0;

    const first = game.story.startStory(entry.id, 'active');
    expect(first.success && !first.finished).toBe(true);
    if (!first.success || first.finished) throw new Error('expected first delivery checkpoint');
    expect(game.story.advanceStory(undefined, null, first.story.token)).toMatchObject({ success: true, finished: true });
    expect((game.state.globalResources?.[Resource.Pyroxene] ?? 0) - initial).toBe(5);

    const repeated = game.story.startStory(entry.id, 'active', null, { force: true });
    expect(repeated.success && !repeated.finished).toBe(true);
    if (!repeated.success || repeated.finished) throw new Error('expected repeat delivery checkpoint');
    expect(game.story.advanceStory(undefined, null, repeated.story.token)).toMatchObject({ success: true, finished: true });
    expect((game.state.globalResources?.[Resource.Pyroxene] ?? 0) - initial).toBe(7);
    const logAfterNormalCompletion = structuredClone(game.state.storyLog);

    const replay = game.story.replayStory(entry.id);
    expect(replay.success && !replay.finished).toBe(true);
    finishStory(game);
    expect((game.state.globalResources?.[Resource.Pyroxene] ?? 0) - initial).toBe(7);
    expect(game.state.storyLog).toEqual(logAfterNormalCompletion);
  });

  test('GameInstance save/load 保留逻辑 checkpoint 与表现快照，同时换发 runId/token', () => {
    const story = nodeDoc('test:story:node_save', [
      {
        id: 'show-overlay', type: 'operation', action: { kind: 'overlay', command: {
          command: 'show', id: 'node-save-overlay', content: { kind: 'text', text: 'resume this overlay' },
        } },
      },
      { id: 'save-body', type: 'talklet', stageId: 'body', content: { kind: 'talk', text: 'checkpoint', speaker: 'Test' } },
    ], { body: { advance: 'auto' } });
    const entry = activeEntry('test:story:node_save_entry', story.id);
    const game = track(makePack([entry], [story]));

    const started = game.story.startStory(entry.id, 'active');
    expect(started.success && !started.finished).toBe(true);
    if (!started.success || started.finished) throw new Error('expected saved delivery checkpoint');
    const before = started.story;
    const save = game.save();
    expect(save.storyPlayback.global.presentation?.overlays.map(overlay => overlay.id)).toEqual(['node-save-overlay']);

    game.load(save);
    const restored = game.story.getCurrentStoryView();
    expect(restored).toMatchObject({
      storyDefId: story.id, nodeId: before.nodeId, phase: 'delivery',
      historyId: before.historyId, waitSequence: before.waitSequence,
    });
    expect(restored!.runId).not.toBe(before.runId);
    expect(restored!.token).not.toBe(before.token);
    expect(game.save().storyPlayback.global.presentation?.overlays.map(overlay => overlay.id)).toEqual(['node-save-overlay']);
    expect(game.story.advanceStory(undefined, null, before.token)).toMatchObject({ success: false, error: 'StaleToken' });
    expect(game.story.getCurrentStoryView()?.token).toBe(restored!.token);
  });
});
