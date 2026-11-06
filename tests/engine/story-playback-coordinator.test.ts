import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { makePack } from './story-test-fixtures';

const entryId = 'test:activestory:runtime_queue';
const storyId = 'test:story:runtime_queue';
let game: GameInstance;
function setup(nodes: StoryDef['nodes']) {
  game = new GameInstance();
  game.init([baseDatapack, makePack([{ id: entryId, storyId, type: 'active', availableInits: [], triggerCondition: { type: 'AND', conditions: [] } }],
    [{ id: storyId, name: 'Runtime queue', startContext: { type: 'area', areaId: 'base:area:schale_main' }, stages: { body: { advance: 'auto' } }, nodes }])]);
  game.story.clearAllCurrentStories();
  game.story.clearOutput(null);
  return game;
}

describe('Runtime Story presentation has one advancement authority', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { game?.dispose(); vi.useRealTimers(); });

  it('retains character identity and the temporary name through typing, output and save/load', () => {
    const identity = { characterId: baseDatapack.characters![0].id, displayName: '暂用名称' };
    const g = setup([{ id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'talk', text: 'one', ...identity }, pacing: { typing: 1 } }]);
    g.story.startActiveStory(entryId);
    expect(g.story.getPlaybackView().typing).toMatchObject(identity);
    g.load(JSON.parse(JSON.stringify(g.save())));
    expect(g.story.getPlaybackView().typing).toMatchObject(identity);
    vi.advanceTimersByTime(1200);
    expect(g.story.getPlaybackView().entries.at(-1)).toMatchObject({ text: 'one', ...identity });
    g.load(JSON.parse(JSON.stringify(g.save())));
    expect(g.story.getPlaybackView().entries.at(-1)).toMatchObject(identity);
    expect(g.storyService.getCurrentStoryView()?.page).toMatchObject(identity);
    g.registry.storyEntries.get(entryId)!.replayable = true;
    const replay = g.story.replayStory(entryId);
    expect(replay.success).toBe(true);
    if (!replay.success) throw new Error('Replay failed');
    expect(g.story.getReplayPlaybackView(replay.replayId!)?.typing).toMatchObject(identity);
    vi.advanceTimersByTime(1200);
    expect(g.story.getReplayPlaybackView(replay.replayId!)?.entries.at(-1)).toMatchObject(identity);
  });

  it('delivers without a UI, waits for explicit continue, and queries never advance', () => {
    const g = setup([{ id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'talk', text: 'one' } }]);
    g.story.startActiveStory(entryId);
    const token = g.story.getPlaybackView().token!;
    expect(g.story.getPlaybackView().phase).toBe('typing');
    expect(g.story.continueStory(null, token)).toMatchObject({ success: false, error: 'PresentationPending' });
    vi.advanceTimersByTime(900);
    expect(g.story.getPlaybackView()).toMatchObject({ phase: 'continue', entries: [{ text: 'one' }] });
    const snapshot = g.story.saveCursors();
    for (let i = 0; i < 20; i++) g.story.getPlaybackView();
    expect(g.story.saveCursors()).toEqual(snapshot);
    expect(g.state.storyReadLogs?.[storyId]?.readTalkletIndexes).toEqual([0]);
    expect(g.story.continueStory(null, g.story.getPlaybackView().token!).success).toBe(true);
    expect(g.story.getPlaybackView().phase).toBe('idle');
  });

  it('finishes empty operations immediately and restores an explicit effect cursor without replaying writes', () => {
    const g = setup([
      { id: 'flag', type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'ready', value: true } },
      { id: 'award', type: 'operation', action: { kind: 'state', effects: [
        { op: 'addResource', resourceId: 'base:resource:credit', amount: 2 },
        { op: 'addResource', resourceId: 'base:resource:credit', amount: 3 },
      ] } },
      { id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: 'done' } },
    ]);
    const before = g.state.resources['base:resource:credit'] ?? 0;
    g.story.startActiveStory(entryId);
    expect(g.state.resources['base:resource:credit']).toBe(before + 5);
    expect(g.story.getPlaybackView()).toMatchObject({ phase: 'operation', entries: [{ kind: 'reward' }] });
    const save = g.save();
    const oldToken = g.story.getPlaybackView().token!;
    const invalid = JSON.parse(JSON.stringify(save));
    invalid.storyPlayback.global.queue.automatic = false;
    expect(() => g.load(invalid)).toThrow('AutomaticBarrier');
    g.load(JSON.parse(JSON.stringify(save)));
    expect(g.state.resources['base:resource:credit']).toBe(before + 5);
    expect(g.story.getPlaybackView().entries).toHaveLength(1);
    expect(g.story.getPlaybackView().token).not.toBe(oldToken);
    vi.advanceTimersByTime(360);
    expect(g.story.getPlaybackView().entries.map(entry => entry.kind)).toEqual(['reward', 'reward', 'narration']);
    expect(g.story.getPlaybackView().phase).toBe('continue');
    expect(g.state.resources['base:resource:credit']).toBe(before + 5);
  });

  it('clearFlow during typing suppresses that body across save/load without blocking the next input', () => {
    const g = setup([
      { id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'talk', text: 'cleared' } },
      { id: 'input', type: 'click', stageId: 'body', interaction: { kind: 'button', text: 'accept' } },
    ]);
    g.story.startActiveStory(entryId);
    g.story.clearOutput(null);
    const save = g.save();
    g.load(JSON.parse(JSON.stringify(save)));
    vi.advanceTimersByTime(900);
    vi.advanceTimersByTime(900);
    expect(g.story.getPlaybackView()).toMatchObject({ phase: 'input', entries: [] });
    expect(g.story.submitStoryInput(null, g.story.getPlaybackView().token!).success).toBe(true);
  });

  it('saves finishing notices and a deferred successor together without repeating settlement', () => {
    const g = setup([{ id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: 'end' } }]);
    const tail = 'test:activestory:queue_tail';
    g.registry.load(makePack([
      { ...g.registry.storyEntries.get(entryId)!, completionReward: { first: [
        { op: 'addResource', target: 'base:resource:credit', value: 2 },
        { op: 'addResource', target: 'base:resource:credit', value: 3 },
      ] } },
      { id: tail, storyId: 'test:story:queue_tail', type: 'active', availableInits: [], triggerCondition: { type: 'AND', conditions: [] } },
    ], [g.registry.stories.get(storyId)!, { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'test:story:queue_tail', name: 'Tail', stages: { body: { advance: 'auto' } }, nodes: [
      { id: 'tail', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: 'tail' } },
    ] }]));
    g.eventBus.on('storyCompleted', event => { if (event.storyId === storyId) g.story.startActiveStory(tail); });
    const before = g.state.resources['base:resource:credit'] ?? 0;
    g.story.startActiveStory(entryId);
    g.story.continueStory(null, g.story.getPlaybackView().token!);
    expect(g.story.getPlaybackView().phase).toBe('operation');
    const saved = g.save();
    expect(saved.storyPlayback.pendingStarts).toHaveLength(1);
    expect(saved.storyPlayback.global.finishing?.settled).toBe(true);
    g.load(JSON.parse(JSON.stringify(saved)));
    vi.advanceTimersByTime(360);
    expect(g.story.getCurrentStoryId()).toBe(tail);
    expect(g.story.getPlaybackView().entries.map(entry => entry.text)).toEqual(['end', '信用点 +2', '信用点 +3', 'tail']);
    expect(g.state.resources['base:resource:credit']).toBe(before + 5);
  });

  it('rejects malformed queue progress and restarts changed source content from the current definition', () => {
    const g = setup([{ id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'talk', text: 'original' } }]);
    g.story.startActiveStory(entryId);
    const save = g.save();
    const current = g.story.getPlaybackView();
    const corrupt = JSON.parse(JSON.stringify(save));
    corrupt.storyPlayback.global.queue.index = 10000;
    expect(() => g.load(corrupt)).toThrow('QueueProgress');
    expect(g.story.getPlaybackView()).toEqual(current);
    const changed = g.registry.stories.get(storyId)!;
    g.registry.saveStoryDefinition({
      ...changed,
      nodes: changed.nodes.map(node => node.type === 'talklet' ? { ...node, content: { ...node.content, text: 'edited' } } : node),
    });
    expect(() => g.load(save)).not.toThrow();
    expect(g.story.getCurrentStoryView()?.page.text).toBe('edited');
    expect(g.story.getPlaybackView().runId).not.toBe(current.runId);
  });

  it('stops a failed visual step and never advances to later state operations', () => {
    const g = setup([
      { id: 'title', type: 'operation', action: { kind: 'presentation', command: { command: 'openingTitle', title: 'failure' } } },
      { id: 'late', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'base:resource:credit', amount: 100 }] } },
    ]);
    const before = g.state.resources['base:resource:credit'] ?? 0;
    g.eventBus.on('openingTitleShown', () => { throw new Error('visual observer failed'); });
    expect(g.story.startActiveStory(entryId)).toMatchObject({ success: false, error: 'PlaybackFailed' });
    vi.advanceTimersByTime(10000);
    expect(g.state.resources['base:resource:credit'] ?? 0).toBe(before);
    expect(g.story.getPlaybackView().phase).toBe('failed');
    expect(() => g.save()).not.toThrow();
  });

  it('returns the committed input result failure without continuing later operations', () => {
    const g = setup([
      { id: 'input', type: 'click', stageId: 'body', interaction: { kind: 'button', text: 'open', result: { actions: [
        { kind: 'presentation', command: { command: 'openingTitle', title: 'failure' } },
      ] } } },
      { id: 'late', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'base:resource:credit', amount: 100 }] } },
    ]);
    g.story.startActiveStory(entryId);
    const before = g.state.resources['base:resource:credit'] ?? 0;
    g.eventBus.on('openingTitleShown', () => { throw new Error('visual observer failed'); });
    expect(g.story.submitStoryInput(null, g.story.getPlaybackView().token!)).toMatchObject({ success: false, error: 'PlaybackFailed', detail: expect.stringContaining('visual observer failed') });
    vi.advanceTimersByTime(10000);
    expect(g.state.resources['base:resource:credit'] ?? 0).toBe(before);
    expect(g.story.getPlaybackView().phase).toBe('failed');
  });

  it('rejects an invalid reentrant successor before it can contaminate a finishing save', () => {
    const g = setup([{ id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: 'end' } }]);
    g.registry.load(makePack([{ ...g.registry.storyEntries.get(entryId)!, completionReward: { first: [
      { op: 'addResource', target: 'base:resource:credit', value: 2 },
      { op: 'addResource', target: 'base:resource:credit', value: 3 },
    ] } }], [g.registry.stories.get(storyId)!]));
    g.eventBus.on('storyCompleted', () => {
      expect(g.story.startActiveStory('missing:entry')).toMatchObject({ success: false, error: 'NotFound' });
    });
    g.story.startActiveStory(entryId);
    g.story.continueStory(null, g.story.getPlaybackView().token!);
    const save = g.save();
    expect(save.storyPlayback.global.finishing?.settled).toBe(true);
    expect(save.storyPlayback.pendingStarts).toEqual([]);
    expect(() => g.load(JSON.parse(JSON.stringify(save)))).not.toThrow();
    vi.advanceTimersByTime(360);
    expect(g.story.getPlaybackView().phase).toBe('idle');
  });

  it('reports completion write failure as failure and does not retry settled rewards', () => {
    const g = setup([{ id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: 'end' } }]);
    g.story.startActiveStory(entryId);
    g.eventBus.on('storyCompleted', () => { throw new Error('completion observer failed'); });
    expect(g.story.continueStory(null, g.story.getPlaybackView().token!)).toMatchObject({ success: false, error: 'PlaybackFailed' });
    expect(g.story.getPlaybackView().phase).toBe('failed');
    const save = g.save();
    expect(save.storyPlayback.global.finishing?.completionRecorded).toBe(true);
    expect(save.playerState.storyLog.filter(record => record.storyId === storyId)).toHaveLength(1);
    expect(() => g.load(save)).not.toThrow();
    expect(g.story.getPlaybackView().phase).toBe('failed');
    expect(g.state.storyLog.filter(record => record.storyId === storyId)).toHaveLength(1);
  });

  it('preserves the automatic handoff budget through timer events and repeated save/load', () => {
    const g = setup([
      { id: 'hold', type: 'operation', action: { kind: 'presentation', command: { command: 'openingTitle', title: 'hold' } } },
      { id: 'chain', type: 'operation', action: { kind: 'presentation', command: { command: 'openingTitle', title: 'chain' } } },
    ]);
    const requests: string[] = [];
    g.eventBus.on('openingTitleShown', event => {
      if (event.title !== 'chain') return;
      const result = g.story.startCardStory(entryId);
      if (!result.success && result.error === 'StartDeferred') requests.push(result.detail!);
    });
    g.story.startActiveStory(entryId);
    const saved = JSON.parse(JSON.stringify(g.save()));
    saved.storyPlayback.global.playback.run.source.handoffCount = 63;
    g.load(saved);
    vi.advanceTimersByTime(3000);
    expect(g.save().storyPlayback.global.playback.run?.source.handoffCount).toBe(64);
    g.load(JSON.parse(JSON.stringify(g.save())));
    vi.advanceTimersByTime(3000);
    expect(requests).toHaveLength(2);
    expect(g.story.getStartRequestResult(requests[1]!)).toMatchObject({ success: false, error: 'PlaybackFailed', detail: 'StoryHandoffLimitExceeded' });
    vi.advanceTimersByTime(3000);
    expect(g.story.getPlaybackView().phase).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
  });
});
