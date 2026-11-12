import { afterEach, describe, expect, it } from 'vitest';
import { validateStoryDeferredStarts, validateStoryPlaybackSteps } from '../../../src/arona-clicker/services/story/story-playback-snapshot';
import type { StoryCursorCollection, StoryCursorSnapshot } from '../../../src/engine/contracts/story-cursor';
import type { StoryDeferredStart } from '../../../src/engine/contracts/story-playback-state';
import type { Registry } from '../../../src/data-services/registry/registry';
import type { StoryDef } from '../../../src/data-services/contracts/story';
import type { StoryEntryDef } from '../../../src/data-services/contracts/story-entry';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';

describe('submitted Choice output admission', () => {
  it.each([
    null,
    { options: [], selectedOptionId: 'a' },
    { options: [{ id: 'a', text: 'A' }], selectedOptionId: 'missing' },
    { options: [{ id: 'a', text: 'A' }, { id: 'a', text: 'B' }], selectedOptionId: 'a' },
    { options: [{ id: 'a', text: 1 }], selectedOptionId: 'a' },
    { options: [{ id: 'a', text: 'A', action: 'submit' }], selectedOptionId: 'a' },
  ])('rejects malformed completed Choice %j', choice => {
    const steps = [{ kind: 'output', content: { kind: 'narration', text: '', choice } }] as unknown as Parameters<typeof validateStoryPlaybackSteps>[0];
    expect(() => validateStoryPlaybackSteps(steps)).toThrow('OutputChoice');
  });
});

const root: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'story:root', name: 'Root', stages: {}, nodes: [{ id: 'end', type: 'talklet', stageId: 'unused', content: { kind: 'narration', text: 'end' } }] };
const target: StoryDef = { ...root, id: 'story:target', name: 'Target' };
const entry = (id: string, storyId: string): StoryEntryDef => ({ id, storyId, availableInits: [], triggerCondition: { type: 'AND', conditions: [] }, activation: { kind: 'active' as const } });
const registry: Pick<Registry, 'storyEntries' | 'stories'> = {
  storyEntries: new Map([['entry:root', entry('entry:root', root.id)], ['entry:target', entry('entry:target', target.id)]]),
  stories: new Map([[root.id, root], [target.id, target]]),
};
const finishing = (owner: string | null): StoryCursorSnapshot => ({
  playback: { format: 'story-nodes-v2', run: null }, isReplay: false, lastChoiceIndex: -1, lastChoiceStoryId: null, flags: [],
  output: { epoch: 0, sequence: 0, entries: [] },
  finishing: { source: { entryId: 'entry:root', rootStoryId: root.id, owner, runId: 'run:root', historyId: 'history:root', causalChainId: 'chain:root', handoffCount: 2 }, terminalStoryId: root.id, settled: true },
});
const request = (): StoryDeferredStart => ({ requestId: 'request:one', entryId: 'entry:target', expectedType: 'active', owner: null, causalChainId: 'chain:root', handoffCount: 2 });
const collection = (): StoryCursorCollection => ({ format: 'story-playback-v2', global: finishing(null), chats: {}, pendingStarts: [request()] });

describe('deferred Story start snapshot admission', () => {
  it('accepts a request waiting for its target finishing slot without mutating it', () => {
    const saved = collection();
    const before = structuredClone(saved);
    validateStoryDeferredStarts(saved, registry);
    expect(saved).toEqual(before);
  });

  it('accepts a departed cross-owner cause while the independently finishing target remains', () => {
    const saved: StoryCursorCollection = { ...collection(), pendingStarts: [{ ...request(), owner: 'guest', causalChainId: 'chain:departed', handoffCount: 8 }], chats: { 'variant:guest': finishing('guest') } };
    validateStoryDeferredStarts(saved, registry);
  });

  it('preserves finite JSON initial flags and accepts omitted optional booleans', () => {
    const saved: StoryCursorCollection = { ...collection(), pendingStarts: [{ ...request(), options: { force: false, replaceAny: undefined, initialFlags: { ready: false, route: [0, null, { value: 'a' }] } } }] };
    validateStoryDeferredStarts(saved, registry);
    expect(saved.pendingStarts[0]!.options?.initialFlags).toEqual({ ready: false, route: [0, null, { value: 'a' }] });
    validateStoryDeferredStarts(JSON.parse(JSON.stringify(saved)), registry);
  });

  it.each([
    null,
    { ...request(), requestId: '' },
    { ...request(), entryId: 'entry:missing' },
    { ...request(), expectedType: 'passive' },
    { ...request(), owner: '' },
    { ...request(), owner: undefined },
    { ...request(), causalChainId: '' },
    { ...request(), handoffCount: -1 },
    { ...request(), handoffCount: 65 },
    { ...request(), handoffCount: Number.NaN },
    { ...request(), handoffCount: 1.5 },
    { ...request(), unsupported: true },
  ])('rejects malformed or unresolvable request %j', malformed => {
    const saved = { ...collection(), pendingStarts: [malformed] } as unknown as StoryCursorCollection;
    expect(() => validateStoryDeferredStarts(saved, registry)).toThrow('DeferredStart');
  });

  it.each([
    [], new Map(), { force: 'yes' }, { skipConditions: 1 }, { replaceAny: null }, { unknown: false },
    { initialFlags: null }, { initialFlags: { bad: undefined } }, { initialFlags: { bad: Number.NaN } },
    { initialFlags: { bad: new Map() } }, { initialFlags: { bad: () => true } },
  ])('rejects malformed options %j', options => {
    const saved = { ...collection(), pendingStarts: [{ ...request(), options }] } as unknown as StoryCursorCollection;
    expect(() => validateStoryDeferredStarts(saved, registry)).toThrow();
  });

  it('rejects duplicate request identities and oversized backlogs', () => {
    expect(() => validateStoryDeferredStarts({ ...collection(), pendingStarts: [request(), request()] }, registry)).toThrow('DeferredStart');
    const requests = Array.from({ length: 65 }, (_, index) => ({ ...request(), requestId: `request:${index}` }));
    expect(() => validateStoryDeferredStarts({ ...collection(), pendingStarts: requests }, registry)).toThrow('DeferredStartLimit');
  });

  it('rejects a request with no live successful finishing target', () => {
    const original = collection();
    for (const global of [
      { ...original.global, finishing: undefined },
      { ...original.global, finishing: { ...original.global.finishing!, error: 'settlement failed' } },
      { ...original.global, finishing: { ...original.global.finishing!, settled: false } },
      { ...original.global, finishing: { ...original.global.finishing!, source: { ...original.global.finishing!.source, owner: 'other' } } },
    ]) expect(() => validateStoryDeferredStarts({ ...original, global }, registry)).toThrow('DeferredStartTarget');
  });

  it('rejects an invalid finishing source or static target document closure', () => {
    const original = collection();
    const global = { ...original.global, finishing: { ...original.global.finishing!, source: { ...original.global.finishing!.source, handoffCount: 65 } } };
    expect(() => validateStoryDeferredStarts({ ...original, global }, registry)).toThrow('DeferredStartTargetSource');
    const broken: StoryDef = { ...target, nodes: [{ id: 'missing', type: 'transfer', transfer: { mode: 'goto', storyId: 'story:missing' } }] };
    expect(() => validateStoryDeferredStarts(original, { ...registry, stories: new Map([[root.id, root], [target.id, broken]]) })).toThrow('DocumentMissing');
  });
});

describe('GameInstance rejects corrupt deferred starts before replacing state', () => {
  let game: GameInstance | undefined;
  afterEach(() => game?.dispose());

  it('keeps current player state and Story playback when a later deferred item is invalid', () => {
    game = new GameInstance();
    game.init([baseDatapack]);
    const saved = JSON.parse(JSON.stringify(game.save()));
    saved.storyPlayback.pendingStarts = [null];
    saved.playerState.resources['base:resource:credit'] = 987654;
    const beforeState = JSON.stringify(game.state);
    const beforeStory = game.story.getPlaybackView();
    expect(() => game!.load(saved)).toThrow('DeferredStart');
    expect(JSON.stringify(game.state)).toBe(beforeState);
    expect(game.story.getPlaybackView()).toEqual(beforeStory);
  });
});


describe('node performance snapshot admission',()=>{
  it.each([
    {performance:{layout:{mode:'positioned',x:0,y:0}}},
    {node:{storyId:'story',nodeId:'node'},performance:{style:{color:'red;display:none'}}},
    {node:{storyId:'story',nodeId:''},performance:{layout:{mode:'positioned',x:0,y:0}}},
    {node:{storyId:'story',nodeId:'node'},performance:{layout:{mode:'positioned',x:Infinity,y:0}}},
  ])('rejects malformed restored node displays (%j)', fields=>{
    const steps=[{kind:'output',content:{kind:'narration',text:'body',...fields}}] as Parameters<typeof validateStoryPlaybackSteps>[0];
    expect(()=>validateStoryPlaybackSteps(steps)).toThrow('StoryPlaybackSnapshotInvalid');
  });
});
