import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { finishStory, makePack } from './story-test-fixtures';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { validateStoryContinuations } from '../../src/data-services/validation/story-continuations';

const parent = 'test:passivestory:continuation';
const child = 'test:activestory:child';
const area = 'base:area:schale_rooftop';
const talk = (id: string, requiresFlag?: string): StoryDef['nodes'][number] => ({ id, type: 'talklet', stageId: 's', content: { kind: 'narration', text: id }, ...(requiresFlag ? { requiresFlag } : {}) });
let game: GameInstance;
function finishChannel(g: GameInstance, channel: string) {
  for (let guard = 0; guard < 150; guard++) {
    const view = g.story.getReplayPlaybackView(channel);
    if (!view || view.phase === 'idle') return;
    if (view.phase === 'continue') expect(g.story.continueReplayStory(channel, view.token!).success).toBe(true);
    else if (view.phase === 'input') {
      const story = g.story.getReplayStoryView(channel)!;
      expect(g.story.submitReplayStoryInput(channel, view.token!, story.page.choices?.[story.availableChoiceIndexes[0]]?.id).success).toBe(true);
    } else if (view.phase === 'failed') throw new Error(view.error);
    else vi.advanceTimersByTime(10000);
  }
  throw new Error('Channel did not finish');
}
function setup(atArea = false, nodes?: StoryDef['nodes'], entryCard = false) {
  game = new GameInstance();
  game.init([baseDatapack, makePack([
    { id: parent, storyId: 'test:story:parent', replayable: true, owner: 'Hoshino', availableInits: [], triggerCondition: { type: 'AND', conditions: [] }, ...(!entryCard && !nodes ? { kizuna: { entryId: child, returnFlags: ['chosen'], ...(atArea ? { areaId: area } : {}) } } : {}), activation: { kind: 'random' as const, weight: 1, repeatable: false } },
    { id: child, storyId: 'test:story:child', availableInits: [], triggerCondition: { type: 'AND', conditions: [] }, activation: { kind: 'active' as const } },
  ], [
    { id: 'test:story:parent', name: 'parent', startContext: { type: 'chara', characterId: 'Hoshino' }, stages: { s: { advance: 'input' } }, nodes: nodes ?? [entryCard ? { id: 'card', type: 'click', stageId: 's', interaction: { kind: 'entryCard', card: { request: { entryId: child, entryType: 'active', owner: null, intent: 'card' }, continuation: { returnFlags: ['chosen'], ...(atArea ? { areaId: area } : {}) } } } } : { id: 'card', type: 'click', stageId: 's', interaction: { kind: 'kizunaCard' } }, talk('tail', 'chosen')] },
    { id: 'test:story:child', name: 'child', startContext: { type: 'area', areaId: area }, stages: { s: { advance: 'input' } }, nodes: [
      { id: 'flag', type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'chosen', value: false } }, talk('body'),
    ] },
  ])]);
  game.story.clearAllCurrentStories();
  return game;
}

describe('bounded story continuations', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { game?.dispose(); vi.useRealTimers(); });
  it('keeps its parent, returns flags once, and waits for an explicit return', () => {
    const g = setup();
    expect(g.story.startStory(parent, 'passive', 'Hoshino').success).toBe(true);
    const id = g.story.getCurrentStoryView('Hoshino')!.runId;
    expect(g.story.clickSend('Hoshino').type).toBe('completed');
    const saved = g.story.saveCursors();
    const channel = saved.child!.playback.run!.source.replayId!;
    expect(g.story.getCurrentStoryView('Hoshino')!.runId).toBe(id);
    expect(g.story.startActiveStory(child).success).toBe(false);
    expect(g.story.continueReplayStory(channel, g.story.getReplayPlaybackView(channel)!.token!).success).toBe(true);
    expect(g.story.saveCursors().child).toBeUndefined();
    expect(g.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('card');
    g.story.activateOwner('Hoshino');
    expect(g.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('tail');
    expect(g.story.saveCursors().chats['variant:Hoshino'].playback.run!.localFlags).toEqual({ chosen: false });
    expect(g.story.getPlaybackView('Hoshino').entries.some(e => e.text === 'body')).toBe(false);
  });
  it('runs an entryCard continuation as a child, restores it after save, and returns only allowed flags', () => {
    const g = setup(false, undefined, true);
    expect(g.story.startStory(parent, 'passive', 'Hoshino').success).toBe(true);
    const startChild = g.story.clickSend('Hoshino');
    expect(startChild.type).toBe('completed');
    if (startChild.type === 'completed') expect(startChild.advance.success).toBe(true);
    const snapshot = g.save(); g.load(snapshot);
    const channel = g.story.saveCursors().child!.playback.run!.source.replayId!;
    finishChannel(g, channel);
    g.story.activateOwner('Hoshino');
    expect(g.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('tail');
    expect(g.story.saveCursors().chats['variant:Hoshino'].playback.run!.localFlags).toEqual({ chosen: false });
  });
  it('delivers an entryCard continuation at its authored Area and accepts it manually', () => {
    const g = setup(true, undefined, true);
    g.story.startStory(parent, 'passive', 'Hoshino');
    expect(g.travelToArea(area).success).toBe(true);
    expect(g.story.getAreaStoryDeliveries(area).some(x => x.entryId === child)).toBe(true);
    const offer = g.story.getAreaStoryDeliveries(area).find(x => x.entryId === child)!;
    expect(g.story.acceptAreaStoryDelivery(offer.id!, area).success).toBe(true);
    expect(g.story.saveCursors().child).toBeTruthy();
  });
  it('moves the active Story scene context with a travel action while the run continues', () => {
    const destination = 'base:area:schale_main';
    const g = setup(false, [
      { id: 'wait', type: 'click', stageId: 's', interaction: { kind: 'areaContinue', areaId: area } },
      { id: 'travel', type: 'click', stageId: 's', interaction: { kind: 'button', text: '返回夏莱主厅' } },
  { id: "travel-effect-1", type: 'operation', action: { kind: 'travel', areaId: destination } },
      talk('tail'),
    ]);
    expect(g.story.startStory(parent, 'passive', 'Hoshino').success).toBe(true);
    finishStory(g, 0, 'Hoshino');
    expect(g.travelToArea(area).success).toBe(true);
    const delivery = g.story.getAreaStoryDeliveries(area).find(x => x.entryId === parent)!;
    expect(g.story.acceptAreaStoryDelivery(delivery.id!, area).success).toBe(true);
    const channel = g.story.getActiveStoryChannel()!;
    const moved: unknown[] = [];
    g.eventBus.on('storyContextMoved', event => { if (event.type === 'storyContextMoved' && event.replayId === channel.replayId) moved.push(event); });
    expect(g.story.getReplayStoryView(channel.replayId)!.nodeId).toBe('travel');
    const playback = g.story.getReplayPlaybackView(channel.replayId)!;
    expect(g.story.submitReplayStoryInput(channel.replayId, playback.token!).success).toBe(true);
    expect(g.state.currentAreaId).toBe(destination);
    expect(g.story.getActiveStoryChannel()!.context).toEqual({ type: 'area', areaId: destination });
    expect(moved).toContainEqual(expect.objectContaining({ type: 'storyContextMoved', context: { type: 'area', areaId: destination }, replayId: channel.replayId }));
  });
  it('uses authored continuation button copy when present', () => {
    const g = setup();
    const story = g.registry.stories.get('test:story:parent')!;
    g.registry.saveStoryDefinition({ ...story, nodes: [
      { id: 'card', type: 'click', stageId: 's', interaction: { kind: 'kizunaCard', buttonText: '约定的称呼' } }, talk('tail', 'chosen'),
    ] });
    g.story.startStory(parent, 'passive', 'Hoshino');
    expect(g.story.getCurrentStoryView('Hoshino')!.page.kizuna?.buttonText).toBe('约定的称呼');
  });
  it('offers an Area-bound child without occupying the child slot before acceptance', () => {
    const g = setup(true);
    g.story.startStory(parent, 'passive', 'Hoshino');
    expect(g.story.getSendState('Hoshino')).toMatchObject({ mode: 'kizuna', buttonText: expect.stringContaining(g.registry.areas.get(area)!.name) });
    expect(g.story.isBlockingMovement()).toBe(false);
    expect(g.story.saveCursors().child).toBeUndefined();
    expect(g.travelToArea(area).success).toBe(true);
    const offer = g.story.getAreaStoryDeliveries(area).find(x => x.entryId === child)!;
    expect(offer.id).toBeTruthy();
    expect(g.story.acceptAreaStoryDelivery(offer.id!, area).success).toBe(true);
    expect(g.story.acceptAreaStoryDelivery(offer.id!, area).success).toBe(false);
    expect(g.story.saveCursors().child).toBeTruthy();
  });
  it('restores the parent and its running child without prematurely returning', () => {
    const g = setup();
    g.story.startStory(parent, 'passive', 'Hoshino'); g.story.clickSend('Hoshino');
    const saved = g.save();
    g.load(saved);
    const cursor = g.story.saveCursors();
    expect(cursor.child).toBeTruthy();
    const channel = cursor.child!.playback.run!.source.replayId!;
    g.story.continueReplayStory(channel, g.story.getReplayPlaybackView(channel)!.token!);
    const returned = g.save(); g.load(returned);
    g.story.activateOwner('Hoshino');
    expect(g.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('tail');
  });
  it('rejects old formal channel histories before replacing live state instead of silently discarding them', () => {
    const g = setup(); g.story.startStory(parent, 'passive', 'Hoshino'); g.story.clickSend('Hoshino');
    const saved = g.save();
    const old = { ...saved, storyPlayback: { ...saved.storyPlayback, child: { ...saved.storyPlayback.child!, channelOutput: saved.storyPlayback.global.output } } };
    const before = JSON.stringify(g.save());
    expect(() => g.load(old)).toThrow('StoryOutputFormatChanged');
    expect(JSON.stringify(g.save())).toBe(before);
  });
  it('waits at the current Area gate and continues the same run on acceptance', () => {
    const g = setup(false, [{ id: 'area', type: 'click', stageId: 's', interaction: { kind: 'areaContinue', areaId: area } }, talk('onsite')]);
    g.story.startStory(parent, 'passive', 'Hoshino');
    expect(g.story.clickSend('Hoshino')).toMatchObject({ type: 'completed', advance: { success: false } });
    expect(g.travelToArea(area).success).toBe(true);
    const offer = g.story.getAreaStoryDeliveries(area).find(x => x.entryId === parent)!;
    expect(g.story.acceptAreaStoryDelivery(offer.id!, area).success).toBe(true);
    expect(g.story.saveCursors().child).toBeUndefined();
    expect(g.story.getActiveStoryChannel()).toBeTruthy();
    expect(g.story.getPlaybackView('Hoshino').entries.some(x => x.text === 'onsite')).toBe(false);
    const snapshot = g.save(); g.load(snapshot);
    expect(g.story.getActiveStoryChannel()).toBeTruthy();
  });
  it('retains an Area invitation across a child cancellation and a save', () => {
    const g = setup(true);
    g.story.startStory(parent, 'passive', 'Hoshino');
    g.travelToArea(area);
    const saved = g.save(); g.load(saved);
    const invitation = g.story.getAreaStoryDeliveries(area).find(x => x.entryId === child)!;
    g.story.acceptAreaStoryDelivery(invitation.id!, area);
    const channel = g.story.getActiveStoryChannel()!.replayId;
    g.story.cancelReplayStory(channel);
    expect(g.story.saveCursors().child).toBeUndefined();
    expect(g.story.getAreaStoryDeliveries(area).some(x => x.id === invitation.id)).toBe(true);
    expect(g.story.clickSend('Hoshino')).toMatchObject({ type: 'completed', advance: { success: false } });
    expect(g.story.acceptAreaStoryDelivery(invitation.id!, area).success).toBe(true);
  });
  it('keeps the source owner when an onsite root changes its rendered Chara scene', () => {
    const g = setup(false, [
      { id: 'theme', type: 'operation', action: { kind: 'presentation', command: { command: 'theme', value: { tokens: { primary: '#123456' } } } } },
      { id: 'area', type: 'click', stageId: 's', interaction: { kind: 'areaContinue', areaId: area } },
      { id: 'move', type: 'moveToCharaspace', characterId: 'Serika' }, talk('scene'),
    ]);
    g.story.startStory(parent, 'passive', 'Hoshino'); g.travelToArea(area);
    g.story.acceptAreaStoryDelivery(g.story.getAreaStoryDeliveries(area).find(x => x.entryId === parent)!.id!, area);
    expect(g.story.getActiveStoryChannel()!.context).toEqual({ type: 'chara', characterId: 'Serika' });
    g.story.activateOwner('Hoshino', g.story.getActiveStoryChannel()!.replayId);
    expect(g.colorSystem.runtimeTheme().tokens.primary).toBe('#123456');
    g.story.activateOwner('Hoshino');
    expect(g.colorSystem.runtimeTheme().tokens.primary).not.toBe('#123456');
    const saved = g.save();
    expect(saved.storyPlayback.chats['variant:Hoshino'].playback.run!.source.owner).toBe('Hoshino');
    expect(() => g.load(saved)).not.toThrow();
    expect(g.story.getReplayStoryView(g.story.getActiveStoryChannel()!.replayId)!.nodeId).toBe('scene');
    expect(g.story.saveCursors().chats['variant:Hoshino'].playback.run!.source.owner).toBe('Hoshino');
    expect(g.story.getCurrentStoryView('Serika')).toBeNull();
  });
  it('rejects corrupt child relationships before replacing a live parent', () => {
    const g = setup();
    g.story.startStory(parent, 'passive', 'Hoshino'); g.story.clickSend('Hoshino');
    const cursor = g.story.saveCursors();
    const runId = g.story.getCurrentStoryView('Hoshino')!.runId;
    const childSnapshot = cursor.child!;
    const run = childSnapshot.playback.run!;
    const corrupted = { ...cursor, child: { ...childSnapshot, playback: { ...childSnapshot.playback, run: { ...run, source: { ...run.source, parentHistoryId: 'unrelated' } } } } };
    expect(() => g.story.restoreCursors(corrupted)).toThrow();
    expect(g.story.getCurrentStoryView('Hoshino')!.runId).toBe(runId);
  });
  it('replays the entire parent/child branch in a private context', () => {
    const g = setup();
    let childChannel = '';
    g.eventBus.on('storyTriggered', event => { if (event.storyId === child) childChannel = event.replayId!; });
    const started = g.story.replayStory(parent, 'Hoshino');
    expect(started.success).toBe(true);
    if (!started.success) return;
    const rootChannel = started.replayId!;
    g.story.submitReplayStoryInput(rootChannel, g.story.getReplayPlaybackView(rootChannel)!.token!);
    expect(childChannel).toBeTruthy();
    g.story.continueReplayStory(childChannel, g.story.getReplayPlaybackView(childChannel)!.token!);
    expect(g.story.getReplayStoryView(rootChannel)!.nodeId).toBe('tail');
    expect(g.state.storyLog.some(x => x.storyId.startsWith('test:'))).toBe(false);
    expect(g.story.getCurrentStoryView('Hoshino')).toBeNull();
  });
  it('cannot bypass the child role through an Entry request', () => {
    const g = setup();
    g.story.startStory(parent, 'passive', 'Hoshino'); g.story.clickSend('Hoshino');
    const channel = g.story.getActiveStoryChannel()!.replayId;
    expect(g.story.startReplayEntry(channel, parent).success).toBe(false);
    expect(g.story.startActiveStory('base:activestory:schale_welcome').success).toBe(false);
    expect(g.story.getActiveStoryChannel()!.replayId).toBe(channel);
  });
  it('keeps another parent invitation available while the single child slot is occupied', () => {
    const g = setup();
    const second = 'test:passivestory:second', secondChild = 'test:activestory:second_child';
    g.registry.load(makePack([
      { ...g.registry.storyEntries.get(parent)!, id: second, kizuna: { entryId: secondChild } },
      { ...g.registry.activeStories.get(child)!, id: secondChild },
    ], [g.registry.stories.get('test:story:parent')!, g.registry.stories.get('test:story:child')!]));
    g.story.startStory(parent, 'passive', 'Hoshino');
    g.story.startStory(second, 'passive', 'Serika');
    g.story.clickSend('Hoshino');
    expect(g.story.clickSend('Serika')).toMatchObject({ type: 'completed', advance: { success: false, error: 'AlreadyActive' } });
    expect(g.story.getCurrentStoryView('Serika')!.nodeId).toBe('card');
    finishChannel(g, g.story.getActiveStoryChannel()!.replayId);
    expect(g.story.clickSend('Serika')).toMatchObject({ type: 'completed', advance: { success: true } });
    expect(g.story.saveCursors().child!.playback.run!.source.entryId).toBe(secondChild);
  });
  it('records the called Entry as complete when its final scene is another StoryDef', () => {
    const g = setup();
    const root = g.registry.stories.get('test:story:child')!;
    g.registry.load(makePack([g.registry.activeStories.get(child)!], [
      { ...root, nodes: [...root.nodes.slice(0, 1), { id: 'ending', type: 'transfer', transfer: { mode: 'goto', storyId: 'test:story:ending' } }] },
      { ...root, id: 'test:story:ending', nodes: [talk('ending')] },
    ]));
    g.story.startStory(parent, 'passive', 'Hoshino'); g.story.clickSend('Hoshino');
    finishChannel(g, g.story.getActiveStoryChannel()!.replayId);
    expect(g.story.hasCompletedStory(root.id)).toBe(true);
    expect(g.story.hasCompletedStory('test:story:ending')).toBe(false);
    g.story.activateOwner('Hoshino');
    expect(g.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('tail');
  });
  it('keeps the rooftop invitation and encounter in one Entry across the Area continuation', () => {
    const g = setup();
    const entry = 'base:passivestory:hoshino_conv_2';
    expect(g.story.startStory(entry, 'passive', 'Hoshino', { skipConditions: true }).success).toBe(true);
    finishStory(g, 0, 'Hoshino');
    expect(g.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('rooftop-continue');
    const runId = g.story.getCurrentStoryView('Hoshino')!.runId;
    g.travelToArea(area);
    const invitation = g.story.getAreaStoryDeliveries(area).find(x => x.entryId === entry)!;
    expect(g.story.acceptAreaStoryDelivery(invitation.id!, area).success).toBe(true);
    const channel = g.story.getActiveStoryChannel()!;
    expect(channel.entryId).toBe(entry);
    expect(channel.runId).toBe(runId);
    expect(g.story.getReplayStoryView(channel.replayId)!.nodeId).toBe('rooftop-arrival');
    finishChannel(g, channel.replayId);
    expect(g.state.storyLog.some(x => x.storyId === 'base:story:hoshino_rooftop_hint')).toBe(true);
    expect(g.state.storyLog.some(x => x.storyId === 'base:story:hoshino_rooftop_meet')).toBe(false);
  });
  it('recovers a committed child result after a notification failure without granting twice', () => {
    const g = setup();
    g.registry.load(makePack([{ ...g.registry.storyEntries.get(child)!, completionReward: { first: [{ op: 'addResource', target: 'base:resource:credit', value: 7 }] } }], [g.registry.stories.get('test:story:child')!]));
    g.story.startStory(parent, 'passive', 'Hoshino'); g.story.clickSend('Hoshino');
    const channel = g.story.getActiveStoryChannel()!.replayId;
    const before = g.state.resources['base:resource:credit'] ?? 0;
    const off = g.eventBus.on('storyRewarded', event => { if (event.storyId === 'test:story:child') throw new Error('notice failed'); });
    expect(g.story.continueReplayStory(channel, g.story.getReplayPlaybackView(channel)!.token!).success).toBe(false);
    expect(g.state.resources['base:resource:credit']).toBe(before + 7);
    expect(g.story.saveCursors().child!.finishing).toMatchObject({ settled: true, localFlags: { chosen: false } });
    off();
    g.load(g.save());
    expect(g.story.getReplayPlaybackView(channel)!.phase).toBe('continue');
    expect(g.story.continueReplayStory(channel, g.story.getReplayPlaybackView(channel)!.token!).success).toBe(true);
    g.story.activateOwner('Hoshino');
    expect(g.story.getCurrentStoryView('Hoshino')!.nodeId).toBe('tail');
    expect(g.state.resources['base:resource:credit']).toBe(before + 7);
    expect(g.state.storyLog.filter(x => x.storyId === 'test:story:child')).toHaveLength(1);
  });
  it('replay evaluates local branches while suppressing child world effects', () => {
    const g = setup();
    const doc = g.registry.stories.get('test:story:child')!;
    g.registry.load(makePack([], [{ ...doc, nodes: [{ id: 'reward', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'base:resource:credit', amount: 100 }] } }, ...doc.nodes] }]));
    const before = g.state.resources['base:resource:credit'] ?? 0;
    const start = g.story.replayStory(parent, 'Hoshino');
    if (!start.success) throw new Error('Replay failed');
    let channel = '';
    g.eventBus.on('storyTriggered', event => { if (event.storyId === child) channel = event.replayId!; });
    g.story.submitReplayStoryInput(start.replayId!, g.story.getReplayPlaybackView(start.replayId!)!.token!);
    g.story.continueReplayStory(channel, g.story.getReplayPlaybackView(channel)!.token!);
    expect(g.story.getReplayStoryView(start.replayId!)!.nodeId).toBe('tail');
    expect(g.state.resources['base:resource:credit'] ?? 0).toBe(before);
  });
  it('rejects a returned child flag that is also owned by a parent Choice', () => {
    const g = setup();
    const entries = [...g.registry.storyEntries.values()];
    const documents = [...g.registry.stories.values()].map(document => document.id === 'test:story:parent'
      ? { ...document, nodes: [
        { id: 'choose', type: 'click' as const, stageId: 's', interaction: { kind: 'choice' as const, options: [{ id: 'parent', text: 'Parent', marks: ['chosen'] }] } },
        { id: 'card', type: 'click' as const, stageId: 's', interaction: { kind: 'kizunaCard' as const } },
        talk('tail'),
      ] }
      : document.id === 'test:story:child' ? { ...document, nodes: [
        { id: 'choose-child', type: 'click' as const, stageId: 's', interaction: { kind: 'choice' as const, options: [{ id: 'child', text: 'Child', marks: ['chosen'] }] } },
      ] } : document);
    expect(() => validateStoryContinuations(entries, documents, new Set(g.registry.areas.keys()))).toThrow('ChoiceMarkReturned:chosen');
  });
  it('finds a continuation card and returned Choice mark reached through a parent Transfer', () => {
    const cardStoryId = 'test:story:card_after_transfer';
    const g = setup();
    const entries = [...g.registry.storyEntries.values()].map(entry => entry.id === parent ? { ...entry, kizuna: undefined } : entry);
    const documents = [...g.registry.stories.values()].map(document => document.id === 'test:story:parent' ? {
      ...document,
      nodes: [
        { id: 'choose', type: 'click' as const, stageId: 's', interaction: { kind: 'choice' as const, options: [{ id: 'parent', text: 'Parent', marks: ['chosen'] }] } },
        { id: 'to-card', type: 'transfer' as const, transfer: { mode: 'goto' as const, storyId: cardStoryId } },
      ],
    } : document.id === 'test:story:child' ? {
      ...document,
      nodes: [{ id: 'choose-child', type: 'click' as const, stageId: 's', interaction: { kind: 'choice' as const, options: [{ id: 'child', text: 'Child', marks: ['chosen'] }] } }],
    } : document);
    documents.push({
      id: cardStoryId, name: 'Continuation card', startContext: { type: 'area', areaId: area }, stages: { s: { advance: 'input' } },
      nodes: [{ id: 'card', type: 'click', stageId: 's', interaction: { kind: 'entryCard', card: {
        request: { entryId: child, entryType: 'active', owner: null, intent: 'card' }, continuation: { returnFlags: ['chosen'] },
      } } }],
    });
    expect(() => validateStoryContinuations(entries, documents, new Set(g.registry.areas.keys()))).toThrow('ChoiceMarkReturned:chosen');
  });
  it('rejects a nested card hidden behind an insert before starting playback', () => {
    const g = setup();
    const entries = [...g.registry.storyEntries.values()];
    const documents = [...g.registry.stories.values()].map(x => x.id === 'test:story:child'
      ? { ...x, nodes: [{ id: 'insert', type: 'transfer' as const, transfer: { mode: 'insert' as const, storyId: 'test:story:nested' } }] } : x);
    documents.push({ id: 'test:story:nested', name: 'nested', startContext: { type: 'area', areaId: area }, stages: { s: { advance: 'input' } }, nodes: [{ id: 'nested', type: 'click', stageId: 's', interaction: { kind: 'kizunaCard' } }] });
    expect(() => validateStoryContinuations(entries, documents, new Set(g.registry.areas.keys()))).toThrow('NestedKizuna');
  });
});
