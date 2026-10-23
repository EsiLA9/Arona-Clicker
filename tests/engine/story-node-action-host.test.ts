import { describe, expect, test, vi } from 'vitest';
import { createStoryNodeActionHost, type StoryNodeActionHostOptions, type StoryNodeActionRegistry } from '../../src/arona-clicker/services/story/story-node-action-host';
import type { StoryNodeSource } from '../../src/arona-clicker/contracts/runtime/story-node-playback';
import type { StoryAction, StoryEntryRequest } from '../../src/data-services/contracts/story-node-actions';
import type { ActiveStoryEntry, PassiveStoryEntry } from '../../src/data-services/contracts/story-entry';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { InitDef, AreaDef, SpotDef } from '../../src/data-services/contracts/world';
import type { EnhancementDef } from '../../src/data-services/contracts/enhancement';
import type { ItemDef } from '../../src/data-services/contracts/item';
import type { CharacterData } from '../../src/data-services/contracts/character-data';
import type { CharacterVariantDef } from '../../src/data-services/contracts/character-variant';
import type { ColorGroupDef } from '../../src/data-services/contracts/color';
import type { ConditionGroup, Effect, GameEvent } from '../../src/engine/types';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import type { StoryStartResult } from '../../src/arona-clicker/contracts/runtime/results';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import { extra } from '../../src/engine/extra';

const source: StoryNodeSource = { entryId: 'entry:source', rootStoryId: 'story:source', owner: 'variant:owner', runId: 'run:source' };
const globalSource: StoryNodeSource = { ...source, owner: null };
const emptyCondition: ConditionGroup = { type: 'AND', conditions: [] };

function activeEntry(id: string, overrides: Partial<ActiveStoryEntry> = {}): ActiveStoryEntry {
  return {
    id, storyId: `${id}:story`, type: 'active', availableInits: [], triggerCondition: emptyCondition,
    ...overrides,
  };
}

function passiveEntry(id: string, overrides: Partial<PassiveStoryEntry> = {}): PassiveStoryEntry {
  return {
    id, storyId: `${id}:story`, type: 'passive', availableInits: [], triggerCondition: emptyCondition,
    repeatable: true, weight: 1, ...overrides,
  };
}

function makeRegistry(entries = [activeEntry('entry:target'), passiveEntry('entry:blocked', { blocksInteraction: true })]) {
  const storyEntries = new Map(entries.map(entry => [entry.id, entry]));
  const stories = new Map<string, StoryDef>(entries.map(entry => [entry.storyId, {
    id: entry.storyId, name: entry.id, stages: { body: { advance: 'auto' } },
    nodes: [{ id: 'body', type: 'talklet', stageId: 'body', content: { kind: 'narration', text: 'body' } }],
  }]));
  const registry: StoryNodeActionRegistry = {
    storyEntries, stories,
    inits: new Map([['init:test', { id: 'init:test' } as InitDef]]),
    areas: new Map([['area:test', { id: 'area:test', initId: 'init:test' } as AreaDef]]),
    spots: new Map([['spot:test', { id: 'spot:test' } as SpotDef]]),
    spotsOfInit: () => ['spot:test'],
    enhancements: new Map([['enh:test', { id: 'enh:test' } as EnhancementDef]]),
    items: new Map([['item:test', { id: 'item:test' } as ItemDef]]),
    characters: new Map([['character:test', { id: 'character:test' } as CharacterData]]),
    characterVariants: new Map([['variant:test', { id: 'variant:test' } as CharacterVariantDef]]),
    colorGroups: new Map<string, ColorGroupDef>(),
  };
  return { registry, entries };
}

function successfulStart(entryId: string, type: 'active' | 'passive'): StoryStartResult {
  const entry = entryId === 'entry:blocked' ? passiveEntry(entryId) : activeEntry(entryId);
  return {
    success: true as const,
    finished: false as const,
    story: {
      storyId: entryId, type, storyDefId: entry.storyId, pageIndex: 0, totalPages: 1,
      page: { text: 'body', kind: 'narration' }, availableChoiceIndexes: [],
      nodeId: 'node:body', token: `token:${entryId}`, phase: 'input', runId: 'run:start',
    },
  };
}

function harness(entries?: Array<ActiveStoryEntry | PassiveStoryEntry>) {
  const { registry } = makeRegistry(entries);
  const batches: Effect[][] = [];
  const events: GameEvent[] = [];
    const state = createDefaultState();
    state.activeInit = 'init:test';
  let cursor: string | null = null;
  const storyService = {
    getCurrentStoryId: vi.fn(() => cursor),
    hasCompletedStory: vi.fn(() => false),
    startStory: vi.fn((id: string, type: 'active' | 'passive') => successfulStart(id, type)),
    startCardStory: vi.fn((id: string) => successfulStart(id, 'active')),
  };
  const options: StoryNodeActionHostOptions = {
    registry,
    effectEngine: { applyEffects: effects => batches.push(effects) },
    conditionSystem: { evaluateGroup: vi.fn(() => true) },
    getState: () => state as PlayerState,
    storyService,
    travelToArea: vi.fn(areaId => ({ success: true as const, areaId, fromAreaId: null })),
    eventBus: { emit: event => events.push(event) },
  };
  return { host: createStoryNodeActionHost(options), options, batches, events, state, storyService, setCursor: (id: string | null) => { cursor = id; } };
}

describe('StoryNodeActionHost', () => {
  test('把14种状态op原样映射为一个EffectEngine批次', () => {
    const h = harness();
    const composite = extra.dict({ nested: extra.int(7) });
    const expression = { type: 'const', value: 5 } as const;
    const action: StoryAction = {
      kind: 'state', effects: [
        { op: 'setResource', resourceId: 'credit', amount: expression },
        { op: 'addResource', resourceId: 'credit', amount: 1 },
        { op: 'setSpotLevel', spotId: 'spot:test', amount: 2 },
        { op: 'addSpotLevel', spotId: 'spot:test', amount: 3 },
        { op: 'setManager', spotId: 'spot:test', managerId: 'character:test' },
        { op: 'addEnhancement', enhancementId: 'enh:test' },
        { op: 'addItem', itemId: 'item:test', amount: 4 },
        { op: 'unlockInit', initId: 'init:test' },
        { op: 'setFlag', flagId: 'route', value: true },
        { op: 'setExtra', path: 'story.payload', value: composite },
        { op: 'addExtra', path: 'story.count', amount: expression },
        { op: 'removeExtra', path: 'story.old' },
        { op: 'grantCharacter', variantId: 'variant:test' },
        { op: 'addAffectionExp', variantId: 'variant:test', amount: 6 },
      ],
    };
    expect(h.host.execute(action, source)).toEqual({ status: 'applied' });
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0][0]?.value).toBe(expression);
    expect(h.batches[0][9]?.value).toBe(composite);
    expect(h.batches[0]).toEqual([
      { op: 'setResource', target: 'credit', value: expression }, { op: 'addResource', target: 'credit', value: 1 },
      { op: 'setSpotLevel', target: 'spot:test', value: 2 }, { op: 'addSpotLevel', target: 'spot:test', value: 3 },
      { op: 'setManager', target: 'spot:test', value: 'character:test' }, { op: 'addEnhancement', target: '', value: 'enh:test' },
      { op: 'addItem', target: 'item:test', value: 4 }, { op: 'unlockInit', target: '', value: 'init:test' },
      { op: 'setFlag', target: 'route', value: true }, { op: 'setExtra', target: 'story.payload', value: composite },
      { op: 'addExtra', target: 'story.count', value: expression }, { op: 'removeExtra', target: 'story.old', value: 0 },
      { op: 'grantCharacter', target: 'variant:test', value: 0 }, { op: 'addAffectionExp', target: 'variant:test', value: 6 },
    ]);
  });

  test('旅行仅在成功且请求notice时发布带owner/run的事件；overlay与presentation经EffectEngine', () => {
    const h = harness();
    vi.mocked(h.options.travelToArea).mockReturnValueOnce({ success: true, areaId: 'area:test', fromAreaId: null });
    expect(h.host.execute({ kind: 'travel', areaId: 'area:test', notice: true }, source)).toEqual({ status: 'applied' });
    expect(h.options.travelToArea).toHaveBeenLastCalledWith('area:test', true, false);
    expect(h.events).toEqual([{ type: 'storyAreaTraveled', areaId: 'area:test', owner: source.owner, runId: source.runId }]);
    vi.mocked(h.options.travelToArea).mockReturnValueOnce({ success: true, areaId: 'area:test', fromAreaId: null });
    expect(h.host.execute({ kind: 'travel', areaId: 'area:test', notice: false }, source)).toEqual({ status: 'applied' });
    expect(h.events).toHaveLength(1);
    const globalSource = { ...source, owner: null };
    h.host.execute({ kind: 'overlay', command: {
      command: 'show', id: 'overlay:talk', x: 0.2, y: 0.7, align: 'right',
      content: { kind: 'message', content: { kind: 'talk', text: 'hello', speaker: 'NPC' }, presentation: { side: 'left', align: 'center', avatar: 'pic:npc', avatarMode: 'show' }, style: { font: 'serif' } },
    } }, globalSource);
    h.host.execute({ kind: 'overlay', command: { command: 'clearFlow' } }, globalSource);
    h.host.execute({ kind: 'presentation', command: { command: 'openingTitle', title: 'Chapter' } }, globalSource);
    expect(h.batches).toEqual([
      [{ op: 'showChatText', target: 'overlay:talk', value: { talklet: { kind: 'talk', text: 'hello', speaker: 'NPC', side: 'left', align: 'center', avatar: 'pic:npc', showAvatar: true }, x: 0.2, y: 0.7, align: 'right', style: { font: 'serif' } } }],
      [{ op: 'clearAllChatFlow', target: '', value: 0 }],
      [{ op: 'showOpeningTitle', target: '', value: 'Chapter' }],
    ]);
  });

  test.each(['AlreadyThere', 'NotInThisInit'] as const)(
    '领域旅行返回%s仍算已处理，后续Story动作可以继续且不发notice', error => {
      const h = harness();
      vi.mocked(h.options.travelToArea).mockReturnValueOnce({ success: false, areaId: 'area:test', error });
      expect(h.host.execute({ kind: 'travel', areaId: 'area:test', notice: true }, source)).toEqual({ status: 'applied' });
      expect(h.events).toEqual([]);
      expect(h.host.execute({ kind: 'state', effects: [{ op: 'setFlag', flagId: 'continues', value: true }] }, source))
        .toEqual({ status: 'applied' });
      expect(h.batches).toEqual([[{ op: 'setFlag', target: 'continues', value: true }]]);
    },
  );

  test('旅行端口抛异常仍映射为ActionExecutionFailed', () => {
    const h = harness();
    vi.mocked(h.options.travelToArea).mockImplementationOnce(() => { throw new Error('travel-observer-fault'); });
    expect(h.host.execute({ kind: 'travel', areaId: 'area:test', notice: true }, source))
      .toEqual({ status: 'rejected', error: 'ActionExecutionFailed:travel-observer-fault' });
    expect(h.events).toEqual([]);
  });

  test('ordinary与system保留旧准入差异；card走startCardStory并按owner回报替换', () => {
    const h = harness();
    const ordinary: StoryAction = { kind: 'entryRequest', request: { entryId: 'entry:target', entryType: 'active', owner: 'variant:owner', intent: 'ordinary' } };
    const system: StoryAction = { kind: 'entryRequest', request: { entryId: 'entry:target', entryType: 'active', owner: 'variant:other', intent: 'system' } };
    expect(h.host.execute(ordinary, source)).toEqual({ status: 'replaced' });
    expect(h.storyService.startStory).toHaveBeenLastCalledWith('entry:target', 'active', 'variant:owner', undefined);
    expect(h.host.execute(system, source)).toEqual({ status: 'applied' });
    expect(h.storyService.startStory).toHaveBeenLastCalledWith('entry:target', 'active', 'variant:other', { force: true });
    const card: StoryAction = { kind: 'entryRequest', request: { entryId: 'entry:target', entryType: 'active', owner: source.owner, intent: 'card' } };
    expect(h.host.execute(card, source)).toEqual({ status: 'replaced' });
    expect(h.storyService.startCardStory).toHaveBeenCalledWith('entry:target', source.owner);
  });

  test('预检与动态Entry拒绝不先清游标；visited链条件不读取旧全局', () => {
    const h = harness();
    const request: StoryEntryRequest = { entryId: 'entry:target', entryType: 'active', owner: source.owner, intent: 'ordinary' };
    h.options.conditionSystem.evaluateGroup = vi.fn(() => false);
    expect(h.host.execute({ kind: 'entryRequest', request }, source)).toEqual({ status: 'rejected', error: 'EntryConditionNotMet' });
    expect(h.storyService.startStory).not.toHaveBeenCalled();
    const blocked: StoryEntryRequest = { entryId: 'entry:target', entryType: 'active', owner: source.owner, intent: 'card' };
    h.setCursor('entry:blocked');
    expect(h.host.execute({ kind: 'entryRequest', request: blocked }, source)).toEqual({ status: 'rejected', error: 'EntryBlockedByPassive' });
    expect(h.storyService.startCardStory).not.toHaveBeenCalled();
    const chainEntry = activeEntry('entry:chain', { triggerCondition: { type: 'AND', conditions: [{ target: 'visitedStoryInChain', key: 'story:old', comparator: '==', value: 1 }] } });
    const chainHarness = harness([chainEntry]);
    expect(chainHarness.host.preflight({ kind: 'entryRequest', request: { entryId: chainEntry.id, entryType: 'active', owner: null, intent: 'ordinary' } }, source)).toBe('EntryChainConditionUnsupported');
    const cardAction: StoryAction = { kind: 'overlay', command: { command: 'show', id: 'overlay:card', content: { kind: 'entryCard', card: { request: { entryId: 'entry:target', entryType: 'active', owner: null, intent: 'card' } } } } };
    expect(h.host.preflight(cardAction, globalSource)).toBe('OverlayCardRoutingUnsupported');
  });

  test('拒绝无效经理与差分引用，且将Entry服务的晚拒绝原样带回', () => {
    const h = harness();
    expect(h.host.preflight({ kind: 'state', effects: [{ op: 'setManager', spotId: 'spot:test', managerId: '' }] }, source)).toBe('CharacterNotFound');
    expect(h.host.preflight({ kind: 'state', effects: [{ op: 'setManager', spotId: 'spot:test', managerId: 'character:missing' }] }, source)).toBe('CharacterNotFound');
    expect(h.host.preflight({ kind: 'state', effects: [{ op: 'grantCharacter', variantId: 'variant:missing' }] }, source)).toBe('CharacterVariantNotFound');
    h.storyService.startStory.mockReturnValueOnce({ success: false, storyId: 'entry:target', error: 'AlreadyActive' });
    expect(h.host.execute({ kind: 'entryRequest', request: { entryId: 'entry:target', entryType: 'active', owner: 'variant:other', intent: 'ordinary' } }, source))
      .toEqual({ status: 'rejected', error: 'EntryStartFailed:AlreadyActive' });
  });
});
