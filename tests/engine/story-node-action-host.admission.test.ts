import { describe, expect, test, vi } from 'vitest';
import { createStoryNodeActionHost, type StoryNodeActionHostOptions, type StoryNodeActionRegistry } from '../../src/arona-clicker/services/story/story-node-action-host';
import type { StoryNodeSource } from '../../src/arona-clicker/contracts/runtime/story-node-playback';
import type { StoryAction } from '../../src/data-services/contracts/story-node-actions';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { StoryEntryDef } from '../../src/data-services/contracts/story-entry';
import type { InitDef, AreaDef, SpotDef } from '../../src/data-services/contracts/world';
import type { EnhancementDef } from '../../src/data-services/contracts/enhancement';
import type { ItemDef } from '../../src/data-services/contracts/item';
import type { CharacterData } from '../../src/data-services/contracts/character-data';
import type { CharacterVariantDef } from '../../src/data-services/contracts/character-variant';
import type { ColorGroupDef } from '../../src/data-services/contracts/color';
import type { EntityPresentationDef } from '../../src/data-services/contracts/entity-presentation';
import type { Effect, GameEvent } from '../../src/engine/types';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import { StoryNodePlayer } from '../../src/arona-clicker/services/story/story-node-player';
import type { StoryNodeDocument } from '../../src/data-services/contracts/story-node';

const ownerSource: StoryNodeSource = { entryId: 'entry:source', rootStoryId: 'story:source', owner: 'variant:owner' };
const globalSource: StoryNodeSource = { ...ownerSource, owner: null };
const areaPresentation: EntityPresentationDef = {
  default: { name: 'Area', description: 'Test' },
  additions: [{ id: 'option:test', label: 'Test', override: { name: 'Alt' } }],
};

function harness() {
  const state = createDefaultState();
  state.activeInit = 'init:one';
  const registry: StoryNodeActionRegistry = {
    storyEntries: new Map<string, StoryEntryDef>(), stories: new Map<string, StoryDef>(),
    inits: new Map([['init:one', { id: 'init:one' } as InitDef], ['init:two', { id: 'init:two' } as InitDef]]),
    areas: new Map([['area:test', { id: 'area:test', initId: 'init:one', presentation: areaPresentation } as AreaDef]]),
    spots: new Map([
      ['spot:one', { id: 'spot:one', global: false } as SpotDef],
      ['spot:two', { id: 'spot:two', global: false } as SpotDef],
      ['spot:global', { id: 'spot:global', global: true } as SpotDef],
    ]),
    spotsOfInit: initId => initId === 'init:two' ? ['spot:two'] : ['spot:one'],
    enhancements: new Map<string, EnhancementDef>(), items: new Map<string, ItemDef>(),
    characters: new Map<string, CharacterData>(),
    characterVariants: new Map([['variant:test', { id: 'variant:test' } as CharacterVariantDef]]),
    colorGroups: new Map<string, ColorGroupDef>(),
  };
  const batches: Effect[][] = [];
  const events: GameEvent[] = [];
  const effectEngine = { applyEffects: vi.fn((effects: Effect[]) => batches.push(effects)) };
  const options: StoryNodeActionHostOptions = {
    registry, effectEngine, conditionSystem: { evaluateGroup: () => true },
    getState: () => state as PlayerState,
    storyService: {
      getCurrentStoryId: () => null, hasCompletedStory: () => false,
      startStory: () => ({ success: false, error: 'NotFound' }),
      startCardStory: () => ({ success: false, error: 'NotFound' }),
    },
    travelToArea: (areaId) => ({ success: true, areaId, fromAreaId: null }),
    eventBus: { emit: event => events.push(event) },
  };
  return { host: createStoryNodeActionHost(options), state, batches, events, effectEngine };
}

describe('StoryNodeActionHost execute admission', () => {
  test('在execute核对当前Init Spot写权限，静态预检仍可通过', () => {
    const h = harness();
    const otherInitSpot: StoryAction = { kind: 'state', effects: [{ op: 'setSpotLevel', spotId: 'spot:two', amount: 3 }] };
    expect(h.host.preflight(otherInitSpot, ownerSource)).toBeUndefined();
    expect(h.host.execute(otherInitSpot, ownerSource)).toEqual({ status: 'rejected', error: 'SpotOutsideActiveInit' });
    expect(h.effectEngine.applyEffects).not.toHaveBeenCalled();

    h.state.activeInit = 'init:two';
    expect(h.host.execute(otherInitSpot, ownerSource)).toEqual({ status: 'applied' });
    const globalSpot: StoryAction = { kind: 'state', effects: [{ op: 'setManager', spotId: 'spot:global', managerId: 'none' }] };
    expect(h.host.execute(globalSpot, ownerSource)).toEqual({ status: 'applied' });
  });

  test('拒绝未拥有好感写入，同时允许同批grant后按序增加好感', () => {
    const h = harness();
    const affection: StoryAction = { kind: 'state', effects: [{ op: 'addAffectionExp', variantId: 'variant:test', amount: 2 }] };
    expect(h.host.preflight(affection, ownerSource)).toBeUndefined();
    expect(h.host.execute(affection, ownerSource)).toEqual({ status: 'rejected', error: 'CharacterNotOwned' });
    expect(h.effectEngine.applyEffects).not.toHaveBeenCalled();
    const grantThenAffection: StoryAction = { kind: 'state', effects: [
      { op: 'grantCharacter', variantId: 'variant:test' },
      { op: 'addAffectionExp', variantId: 'variant:test', amount: 2 },
    ] };
    expect(h.host.execute(grantThenAffection, ownerSource)).toEqual({ status: 'applied' });
    expect(h.effectEngine.applyEffects).toHaveBeenCalledTimes(1);
    expect(h.batches[0]?.map(effect => effect.op)).toEqual(['grantCharacter', 'addAffectionExp']);
    expect(h.host.execute({ kind: 'state', effects: [
      { op: 'addAffectionExp', variantId: 'variant:test', amount: 1 },
      { op: 'grantCharacter', variantId: 'variant:test' },
    ] }, ownerSource)).toEqual({ status: 'rejected', error: 'CharacterNotOwned' });
    expect(h.host.execute({ kind: 'state', effects: [
      { op: 'grantCharacter', variantId: 'variant:test' },
      { op: 'addAffectionExp', variantId: 'variant:test', amount: 0 },
    ] }, ownerSource)).toEqual({ status: 'applied' }); // 零增量与表达式、到达上限均沿用领域数值政策。
  });

  test('跨Action按最新状态检查资格，不用初始状态拒绝可被前序动作解锁的分支', () => {
    const h = harness();
    h.effectEngine.applyEffects.mockImplementation(effects => {
      h.batches.push(effects);
      if (effects.some(effect => effect.op === 'grantCharacter')) {
        h.state.roster ??= {};
        h.state.roster['variant:test'] = {} as NonNullable<PlayerState['roster']>[string];
      }
      return h.batches.length;
    });
    const document: StoryNodeDocument = { id: 'story:sequence', name: 'Sequence', stages: { ask: { advance: 'input' } }, nodes: [
      { id: 'ask', type: 'click', stageId: 'ask', interaction: { kind: 'button', text: '获得并加好感', result: { actions: [
        { kind: 'state', effects: [{ op: 'grantCharacter', variantId: 'variant:test' }] },
        { kind: 'state', effects: [{ op: 'addAffectionExp', variantId: 'variant:test', amount: 2 }] },
      ] } } },
    ] };
    const player = new StoryNodePlayer(new Map([[document.id, document]]), { ...h.host, evaluate: () => true, random: () => 0 });
    const started = player.start(document.id, { entryId: ownerSource.entryId, owner: ownerSource.owner });
    if (started.view.status !== 'input') throw new Error('Expected input');
    expect(player.submit(started.view.token)).toMatchObject({ ok: true, view: { status: 'completed' } });
    expect(h.batches.map(batch => batch.map(effect => effect.op))).toEqual([['grantCharacter'], ['addAffectionExp']]);
  });

  test('明确拒绝本片无法清理或定向的演出组合', () => {
    const h = harness();
    const theme = (value: Extract<StoryAction, { kind: 'presentation' }>['command']): StoryAction => ({ kind: 'presentation', command: value });
    expect(h.host.preflight(theme({ command: 'theme', value: { tokens: { primary: '#fff' } } }), globalSource)).toBe('EphemeralThemeLifecycleUnsupported');
    expect(h.host.preflight(theme({ command: 'theme', value: { scope: 'area', entityKey: 'area:area:test', background: [] } }), globalSource)).toBe('ThemeBackgroundScopeUnsupported');
    expect(h.host.preflight(theme({ command: 'theme', value: { scope: 'area', entityKey: 'area:area:test', tokens: { primary: '#fff' } } }), globalSource)).toBeUndefined();
    expect(h.host.preflight(theme({ command: 'setEntityPresentation', target: 'area:area:test', optionId: 'option:test', owner: 'owner', lifetime: 'story' }), globalSource)).toBe('StoryPresentationLifetimeUnsupported');
    expect(h.host.preflight(theme({ command: 'setEntityPresentation', target: 'area:area:test', optionId: 'option:test', owner: 'owner', lifetime: 'manual' }), globalSource)).toBeUndefined();
    expect(h.host.preflight({ kind: 'overlay', command: { command: 'clearFlow' } }, ownerSource)).toBe('OverlaySourceOwnerUnsupported');
    expect(h.host.preflight(theme({ command: 'openingTitle', title: 'Act 1' }), ownerSource)).toBe('OpeningTitleSourceOwnerUnsupported');
    expect(h.host.preflight(theme({ command: 'openingTitle' }), globalSource)).toBe('OpeningTitleDefaultSourceUnsupported');
    expect(h.host.preflight(theme({ command: 'openingTitle', title: ' ' }), globalSource)).toBe('OpeningTitleDefaultSourceUnsupported');
    expect(h.host.preflight(theme({ command: 'openingTitle', title: 'Act 1' }), globalSource)).toBeUndefined();
    const card: StoryAction = { kind: 'overlay', command: { command: 'show', id: 'card', content: { kind: 'entryCard', card: { request: { entryId: 'entry:target', entryType: 'active', owner: null, intent: 'card' } } } } };
    expect(h.host.preflight(card, globalSource)).toBe('OverlayCardRoutingUnsupported');
    expect(h.host.preflight({ kind: 'overlay', command: { command: 'clearFlow' } }, globalSource)).toBeUndefined();
  });
});
