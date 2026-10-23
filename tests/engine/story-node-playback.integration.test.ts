import { afterEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { createStoryNodePlayback } from '../../src/arona-clicker/runtime/story-node-playback';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';
import type { StoryNodeDocument } from '../../src/data-services/contracts/story-node';
import type { StoryNodePlaybackView } from '../../src/arona-clicker/contracts/runtime/story-node-playback';

let game: GameInstance;
afterEach(() => game?.dispose());
function setup(): GameInstance {
  game = new GameInstance();
  game.init([{ ...mergeFragments([]),
    inits: [{ id: 'demo:init:main', name: 'Main', description: '', defaultAreas: ['demo:area:a'] }],
    areas: ['a', 'b', 'c'].map(id => ({ id: `demo:area:${id}`, initId: 'demo:init:main', name: id,
      description: '', defaultSpots: [], ...(id === 'a' ? { adjacentAreaIds: ['demo:area:b'] } : {}),
    })),
    stories: [{ id: 'demo:story:entry', name: '宿主入口内容', stages: { 'p1': { advance: 'auto' } }, nodes: [
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '目标入口首句' } },
] }],
    activeStories: [{ id: 'demo:activestory:target', type: 'active', storyId: 'demo:story:entry', availableInits: [], triggerCondition: { type: 'AND', conditions: [] } }],
    passiveStories: [{ id: 'demo:passivestory:blocked', type: 'passive', storyId: 'demo:story:entry', availableInits: [], repeatable: true, weight: 0,
      triggerCondition: { type: 'AND', conditions: [{ target: 'flag', key: 'locked', comparator: '==', value: 1 }] } }],
  }]);
  return game;
}
const docs = (...documents: StoryNodeDocument[]) => new Map(documents.map(document => [document.id, document]));
function token(view: StoryNodePlaybackView): string {
  if (view.status !== 'delivery' && view.status !== 'input') throw new Error(`No token in ${view.status}`);
  return view.token;
}
const source = { entryId: 'demo:activestory:source', owner: null };

describe('new Story node vertical playback with actual GameInstance services', () => {
  it('routes positioned overlays, explicit clears and titles through actual runtime reactors', () => {
    const g = setup();
    const events: unknown[] = [];
    g.eventBus.on('chatTextShown', event => events.push(event));
    g.eventBus.on('chatTextCleared', event => events.push(event));
    g.eventBus.on('openingTitleShown', event => events.push(event));
    const document: StoryNodeDocument = { id: 'demo:story:overlay', name: 'Overlay', stages: {}, nodes: [
      { id: 'show', type: 'operation', action: { kind: 'overlay', command: { command: 'show', id: 'hint', x: 0.2, y: 0.7, content: { kind: 'text', text: '提示' } } } },
      { id: 'erase', type: 'operation', action: { kind: 'overlay', command: { command: 'clearId', id: 'hint' } } },
      { id: 'title', type: 'operation', action: { kind: 'presentation', command: { command: 'openingTitle', title: '第一章' } } },
    ] };
    const player = createStoryNodePlayback(g, docs(document));
    expect(player.start(document.id, source)).toMatchObject({ ok: true, view: { status: 'completed' } });
    expect(events).toEqual([
      { type: 'chatTextShown', id: 'hint', x: 0.2, y: 0.7, text: '提示', owner: null, runId: undefined },
      { type: 'chatTextCleared', id: 'hint', owner: null, runId: undefined },
      { type: 'openingTitleShown', title: '第一章', owner: null, runId: undefined },
    ]);
  });

  it('delivers, chooses, writes a real batch, inserts and returns without old completion/rewards', () => {
    const g = setup();
    const events: string[] = [];
    g.eventBus.onAny(event => events.push(event.type));
    const readCredit = { type: 'value', value: { type: 'value', source: 'res', params: { resource: 'demo:resource:credit' } } } as const;
    const root: StoryNodeDocument = { id: 'demo:story:root', name: 'Root', stages: { choose: { advance: 'input' }, end: { advance: 'auto' } }, nodes: [
      { id: 'prompt', type: 'talklet', stageId: 'choose', content: { kind: 'talk', text: '去哪里？' } },
      { id: 'route', type: 'click', stageId: 'choose', interaction: { kind: 'choice',
        sharedActions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: 'demo:resource:credit', amount: 2 }] }],
        options: [{ id: 'insert', text: '插播', reply: { kind: 'talk', text: '先听说明。' }, result: { actions: [{ kind: 'state', effects: [
          { op: 'addResource', resourceId: 'demo:resource:credit', amount: 1 },
          { op: 'setFlag', flagId: 'batch-read', value: readCredit },
        ] }], transfer: { mode: 'insert', storyId: 'demo:story:child' } } }],
      } },
      { id: 'travel', type: 'operation', action: { kind: 'travel', areaId: 'demo:area:c', notice: true } },
      { id: 'end', type: 'talklet', stageId: 'end', content: { kind: 'narration', text: '已到达。' } },
    ] };
    const child: StoryNodeDocument = { id: 'demo:story:child', name: 'Child', stages: { line: { advance: 'auto' } }, nodes: [
      { id: 'line', type: 'talklet', stageId: 'line', content: { kind: 'talk', text: '一段插播。' } },
    ] };
    g.mutations.setResource('demo:resource:credit', 10);
    const player = createStoryNodePlayback(g, docs(root, child));
    const started = player.start(root.id, source);
    expect(started.view.status).toBe('delivery');
    expect(g.state.resources['demo:resource:credit']).toBe(10);
    const input = player.ackDelivery(token(started.view));
    const selected = player.submit(token(input.view), 'insert');
    expect(g.state.resources['demo:resource:credit']).toBe(13);
    expect(g.state.flags['batch-read']).toBe('12'); // 分支批次统一在自身写入前求值。
    expect(selected.events.map(event => event.type)).toEqual(['reply', 'view']);
    expect(selected.view).toMatchObject({ status: 'delivery', storyId: child.id });
    const returned = player.ackDelivery(token(selected.view));
    expect(g.state.currentAreaId).toBe('demo:area:c'); // c不与a相邻，剧情旅行明确跳拓扑。
    expect(events).toContain('storyAreaTraveled');
    const ended = player.ackDelivery(token(returned.view));
    expect(ended.view).toMatchObject({ status: 'completed', completion: { ...source, rootStoryId: root.id, terminalStoryId: root.id } });
    expect(g.state.storyLog).toEqual([]);
    expect(events).not.toContain('storyCompleted');
    expect(events).not.toContain('storyRewarded');
    expect(player.ackDelivery(token(returned.view)).ok).toBe(false);
    expect(g.state.resources['demo:resource:credit']).toBe(13);
  });

  it('uses this node chain for visited conditions and rejects a missing target before state/events', () => {
    const g = setup();
    const doc: StoryNodeDocument = { id: 'demo:story:scoped', name: 'Scoped', stages: { ask: { advance: 'input' } }, nodes: [
      { id: 'choose', type: 'click', stageId: 'ask', interaction: { kind: 'choice', options: [
        { id: 'root', text: '本链', condition: { type: 'AND', conditions: [{ target: 'visitedStoryInChain', key: 'demo:story:scoped', comparator: '==', value: 1 }] },
          result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'must-not-write', value: 1 }] }], transfer: { mode: 'goto', storyId: 'demo:story:missing' } } },
      ] } },
    ] };
    expect(g.story.isVisitedInChain(doc.id)).toBe(false);
    const player = createStoryNodePlayback(g, docs(doc));
    const started = player.start(doc.id, source);
    expect(started.view).toMatchObject({ availableOptionIds: ['root'] });
    const before = structuredClone(g.state);
    const events: string[] = [];
    g.eventBus.onAny(event => events.push(event.type));
    expect(player.submit(token(started.view), 'root')).toMatchObject({ ok: false, error: 'DocumentNotFound' });
    expect(g.state).toEqual(before);
    expect(events).toEqual([]);
    expect(player.getView()).toEqual(started.view);
  });

  it('launches another owner through the actual Entry service, but same-owner success replaces this source', () => {
    const g = setup();
    const document = (owner: string | null): StoryNodeDocument => ({ id: 'demo:story:request', name: 'Request', stages: { after: { advance: 'auto' } }, nodes: [
      { id: 'launch', type: 'operation', action: { kind: 'entryRequest', request: { entryId: 'demo:activestory:target', entryType: 'active', owner, intent: 'ordinary' } } },
      { id: 'after', type: 'talklet', stageId: 'after', content: { kind: 'talk', text: '源链继续。' } },
    ] });
    const other = document('guest');
    const player = createStoryNodePlayback(g, docs(other));
    expect(player.start(other.id, source).view.status).toBe('delivery');
    expect(g.story.getCurrentStoryId('guest')).toBe('demo:activestory:target');
    expect(g.story.getCurrentStoryId()).toBe(null);
    const same = document(null);
    const replaced = createStoryNodePlayback(g, docs(same));
    expect(replaced.start(same.id, source).view.status).toBe('replaced');
    expect(g.story.getCurrentStoryId()).toBe('demo:activestory:target');
    expect(g.state.storyLog).toEqual([]);
  });

  it('checks Entry admission after preceding writes and keeps an existing cursor when admission fails', () => {
    const g = setup();
    const document = (unlock: boolean): StoryNodeDocument => ({ id: 'demo:story:admission', name: 'Admission', stages: {}, nodes: [
      ...(unlock ? [{ id: 'unlock', type: 'operation' as const, action: { kind: 'state' as const, effects: [{ op: 'setFlag' as const, flagId: 'locked', value: 1 }] } }] : []),
      { id: 'request', type: 'operation', action: { kind: 'entryRequest', request: {
        entryId: 'demo:passivestory:blocked', entryType: 'passive', owner: 'guest', intent: 'system',
      } } },
    ] });
    expect(g.storyService.startStory('demo:activestory:target', 'active', 'guest').success).toBe(true);
    const locked = document(false);
    const refused = createStoryNodePlayback(g, docs(locked)).start(locked.id, source);
    expect(refused).toMatchObject({ ok: false, error: 'EntryConditionNotMet', view: { status: 'failed' } });
    expect(g.story.getCurrentStoryId('guest')).toBe('demo:activestory:target');
    g.storyService.clearCurrentStory('guest');
    const unlocked = document(true);
    expect(createStoryNodePlayback(g, docs(unlocked)).start(unlocked.id, source).view.status).toBe('completed');
    expect(g.story.getCurrentStoryId('guest')).toBe('demo:passivestory:blocked');
    expect(g.state.flags.locked).toBe('1');
  });

  it('faults once after a real state event throws and never retries partially installed effects', () => {
    const g = setup();
    const document: StoryNodeDocument = { id: 'demo:story:fault', name: 'Fault', stages: { press: { advance: 'input' } }, nodes: [
      { id: 'press', type: 'click', stageId: 'press', interaction: { kind: 'button', text: '领取', result: { actions: [
        { kind: 'state', effects: [{ op: 'addResource', resourceId: 'demo:resource:credit', amount: 1 }] },
        { kind: 'state', effects: [{ op: 'setFlag', flagId: 'late', value: 1 }] },
      ] } } },
    ] };
    const player = createStoryNodePlayback(g, docs(document));
    const started = player.start(document.id, source);
    // 使用真实StateMutationService事件链注入同步故障，不替换状态写入口。
    const unsubscribe = g.eventBus.onAny(event => { if (event.type === 'resourceChanged') throw new Error('observer-fault'); });
    const result = player.submit(token(started.view));
    unsubscribe();
    expect(result.ok).toBe(false);
    expect(result.view.status).toBe('failed');
    expect(g.state.resources['demo:resource:credit']).toBe(1);
    expect(g.state.flags.late).toBeUndefined();
    expect(player.submit(token(started.view)).ok).toBe(false);
    expect(g.state.resources['demo:resource:credit']).toBe(1);
  });
});
