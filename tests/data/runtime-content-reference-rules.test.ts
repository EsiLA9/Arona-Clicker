import { describe, expect, it } from 'vitest';
import { collectDefinitionReferences } from '../../src/data-services/registry/runtime-content-reference-rules';
import type { ReferenceEntry } from '../../src/data-services/registry/runtime-content-reference-types';
import type { RuntimeDefinitionRef } from '../../src/data-services/contracts/runtime-content-browser';

const source = (definitionKind: string): RuntimeDefinitionRef => ({ definitionKind, fullId: 'test:source:one' });

const collect = (definitionKind: string, value: unknown, entries: readonly ReferenceEntry[] = []) =>
  collectDefinitionReferences(source(definitionKind), value, entries);

const atPath = (requests: ReturnType<typeof collect>, path: string) => requests.find(request => request.path === path);

describe('collectDefinitionReferences', () => {
  it('uses exact world and payment fields, preserves array paths, and ignores copy', () => {
    const requests = collect('spots', {
      areaId: 'world:area:office',
      purchaseOptions: [{ costs: [
        { type: 'resource', resourceId: 'world:resource:credit', amount: 10 },
        { type: 'item', itemId: 'world:item:ticket', amount: 1 },
      ] }],
      functionalities: [
        { kind: 'linearYield', resource: 'world:resource:credit', amount: {
          type: 'value', value: { type: 'value', source: 'res', params: { resource: 'world:resource:credit' } },
        } },
        { kind: 'operationEntry', operationEventId: 'world:operationEvent:campaign' },
      ],
      gachaPools: ['world:gacha:weekly'],
      name: 'world:area:fake',
      description: 'world:resource:fake',
      conditionText: 'world:story:fake',
    });

    expect(atPath(requests, '$.areaId')).toMatchObject({ value: 'world:area:office', confidence: 'declared', scope: 'global', targetKinds: ['areas'] });
    expect(atPath(requests, '$.purchaseOptions[0].costs[0].resourceId')).toMatchObject({ value: 'world:resource:credit', targetKinds: ['resourceDisplays'] });
    expect(atPath(requests, '$.purchaseOptions[0].costs[1].itemId')).toMatchObject({ value: 'world:item:ticket', targetKinds: ['items'] });
    expect(atPath(requests, '$.functionalities[0].resource')).toMatchObject({ targetKinds: ['resourceDisplays'] });
    expect(atPath(requests, '$.functionalities[0].amount.value.params.resource')).toMatchObject({ targetKinds: ['resourceDisplays'] });
    expect(atPath(requests, '$.functionalities[1].operationEventId')).toMatchObject({ targetKinds: ['operationEvents'], scope: 'global' });
    expect(atPath(requests, '$.gachaPools[0]')).toMatchObject({ value: 'world:gacha:weekly', targetKinds: ['gachaPools'] });
    expect(requests.some(request => request.path.includes('name') || request.path.includes('description') || request.path.includes('conditionText'))).toBe(false);
    expect(atPath(collect('inits', { startStoryId: 'base:activestory:schale_welcome' }), '$.startStoryId')).toMatchObject({ targetKinds: ['stories', 'activeStories'] });
  });

  it('dispatches condition keys and Effect targets by their union discriminator', () => {
    const requests = collect('storyEntries', {
      triggerCondition: { type: 'AND', conditions: [
        { target: 'hasReadStory', key: 'world:story:prologue', comparator: '==', value: 1 },
        { target: 'flag', key: 'world:flag:state', comparator: '==', value: 1 },
        { target: 'extra', key: 'quest/step', comparator: '==', value: 1 },
      ] },
      completionReward: { first: [
        { op: 'addResource', target: 'world:resource:credit', value: 10 },
        { op: 'grantCharacter', target: 'world:variant:alice', value: 1 },
        { op: 'travelToArea', target: 'world:area:office', value: 1 },
        { op: 'setFlag', target: 'world:flag:state', value: 1 },
      ] },
    });

    expect(atPath(requests, '$.triggerCondition.conditions[0].key')).toMatchObject({ targetKinds: ['stories'], confidence: 'declared' });
    expect(atPath(requests, '$.completionReward.first[0].target')).toMatchObject({ targetKinds: ['resourceDisplays'] });
    expect(atPath(requests, '$.completionReward.first[1].target')).toMatchObject({ targetKinds: ['characterVariants'] });
    expect(atPath(requests, '$.completionReward.first[2].target')).toMatchObject({ targetKinds: ['areas'] });
    expect(requests.some(request => request.value === 'world:flag:state')).toBe(false);
    expect(requests.some(request => request.value === 'quest/step')).toBe(false);
    expect(atPath(collect('storyEntries', { followUps: [{ outcome: { kind: 'start-story-entry', storyEntryId: 'base:passivestory:coffee' } }] }), '$.followUps[0].outcome.storyEntryId')).toMatchObject({ targetKinds: ['activeStories', 'passiveStories'] });
  });

  it('covers character and pool member references plus declared presentation assets', () => {
    const characterRequests = collect('characterVariants', {
      proto: 'world:character:alice',
      curve: 'world:curve:standard',
      colorGroupId: 'world:color:alice',
      progression: {
        favoriteItem: 'world:favorite:gift',
        uniqueWeapon: 'world:weapon:rifle',
        initialTraits: ['world:trait:calm'],
        gearSlots: [{ slot: 'attack', gear: 'world:gear:hat' }],
      },
      theme: {
        colorGroupId: 'world:color:theme',
        background: [{ kind: 'image', value: 'world:pic:background' }],
        presentation: { components: [{ id: 'logo', parent: 'header', asset: 'world:pic:logo', anchor: 'center' }] },
      },
    });
    const poolRequests = collect('gachaPools', {
      currency: 'world:resource:credit',
      members: ['world:variant:alice'],
      featured: ['world:variant:alice'],
    });

    expect(atPath(characterRequests, '$.proto')).toMatchObject({ targetKinds: ['characters'] });
    expect(atPath(characterRequests, '$.progression.favoriteItem')).toMatchObject({ targetKinds: ['favoriteItems'] });
    expect(atPath(characterRequests, '$.progression.initialTraits[0]')).toMatchObject({ targetKinds: ['traits'] });
    expect(atPath(characterRequests, '$.theme.background[0].value')).toMatchObject({ targetKinds: ['pics'] });
    expect(atPath(characterRequests, '$.theme.presentation.components[0].asset')).toMatchObject({ targetKinds: ['pics'] });
    const cardStory = collect('stories', { nodes: [{
      id: 'card', type: 'click', stageId: 'p1',
      interaction: { kind: 'entryCard', card: { request: { entryId: 'base:activestory:bond', entryType: 'active', owner: 'base:variant:hoshino', intent: 'card' } } },
    }] });
    expect(atPath(cardStory, '$.nodes[0].interaction.card.request.entryId')).toMatchObject({ targetKinds: ['activeStories'] });
    expect(atPath(cardStory, '$.nodes[0].interaction.card.request.owner')).toMatchObject({ targetKinds: ['characterVariants'] });
    expect(atPath(collect('activeStories', { storyId: 'world:story:active', pushAfterStory: 'world:story:prologue' }), '$.storyId')).toMatchObject({ targetKinds: ['stories'] });
    expect(atPath(collect('passiveStories', { pushAfterStory: 'world:story:prologue' }), '$.pushAfterStory')).toMatchObject({ targetKinds: ['stories'] });
    expect(atPath(poolRequests, '$.members[0]')).toMatchObject({ targetKinds: ['characterVariants'] });
    expect(atPath(poolRequests, '$.featured[0]')).toMatchObject({ targetKinds: ['characterVariants'] });
    expect(atPath(poolRequests, '$.currency')).toMatchObject({ targetKinds: ['resourceDisplays'] });
  });

  it('keeps unknown ID-like extension values as candidates without treating them as global references', () => {
    const requests = collect('items', {
      id: 'world:item:source',
      name: 'world:item:copy',
      description: 'world:item:copy',
      futureReferenceId: 'missing:area:target',
      extra: { t: 'dict', v: { missingRef: { t: 'str', v: 'missing:area:extra' } } },
    });

    expect(atPath(requests, '$.futureReferenceId')).toMatchObject({ value: 'missing:area:target', confidence: 'inferred', scope: 'candidate' });
    expect(atPath(requests, '$.extra.v.missingRef.v')).toMatchObject({ value: 'missing:area:extra', confidence: 'inferred', scope: 'candidate' });
    expect(requests.filter(request => request.scope === 'candidate').every(request => request.targetKinds === undefined)).toBe(true);
    expect(requests.some(request => request.path === '$.id' || request.path === '$.name' || request.path === '$.description')).toBe(false);

    const wrongKind = collect('items', { areaId: 'missing:area:target' });
    expect(atPath(wrongKind, '$.areaId')).toMatchObject({ scope: 'candidate', confidence: 'inferred' });
    expect(atPath(wrongKind, '$.areaId')?.targetKinds).toBeUndefined();
    expect(collect('operationEvents', { areaId: 'world:area:office' })).toEqual([]);
  });

  it('resolves presentation option references inside the target definition context', () => {
    const targetRef = { definitionKind: 'characterVariants', fullId: 'world:variant:alice' } as const;
    const requests = collect('stories', {
      nodes: [{ id: 'presentation', type: 'operation', action: {
        kind: 'presentation', command: {
          command: 'setEntityPresentation', target: `variant:${targetRef.fullId}`, optionId: 'world:option:winter', owner: 'world:variant:alice',
        },
      } }],
    }, [{ ref: targetRef, value: { presentation: { additions: [{ id: 'world:option:winter' }] } } }]);

    expect(atPath(requests, '$.nodes[0].action.command.target')).toMatchObject({ value: targetRef.fullId, targetKinds: ['characterVariants'], scope: 'global' });
    expect(atPath(requests, '$.nodes[0].action.command.optionId')).toMatchObject({
      value: 'world:option:winter', scope: 'local', confidence: 'declared', context: targetRef,
      locations: [{ ref: targetRef, path: '$.presentation.additions[0]' }],
    });
    expect(requests.filter(request => request.path === '$.nodes[0].action.command.optionId')).toHaveLength(1);
  });

  it('covers supplemental trigger and affector paths and passive pool members', () => {
    const triggers = collect('triggerDefs', { on: { kind: 'resource', resource: 'world:resource:credit' }, condition: { target: 'area', key: 'world:area:office' }, effects: [{ op: 'addItem', target: 'world:item:ticket', value: 1 }] });
    const affectors = collect('affectorPacks', { entries: [{ flows: [{ resource: 'world:resource:credit' }], areaConnections: [{ fromAreaId: 'world:area:a', toAreaId: 'world:area:b' }], perTickEffects: [{ op: 'addResource', target: 'world:resource:credit', value: 1 }] }] });
    const item = collect('items', { useCondition: { type: 'AND', conditions: [{ target: 'area', key: 'world:area:office' }] }, useEffects: [{ op: 'addResource', target: 'world:resource:credit', value: 1 }], pickupEffects: [{ op: 'grantCharacter', target: 'world:variant:alice', value: 1 }] });
    const init = collect('inits', { revealTriggers: [{ reveal: 'condition', condition: { target: 'resource', key: 'world:resource:credit' } }] });
    const pool = collect('passivePools', { children: [{ id: 'world:passivestory:idle' }] });

    expect(triggers.map(({ path, targetKinds }) => [path, targetKinds])).toEqual(expect.arrayContaining([
      ['$.on.resource', ['resourceDisplays']], ['$.condition.key', ['areas']], ['$.effects[0].target', ['items']],
    ]));
    expect(affectors.some(request => request.path === '$.entries[0].perTickEffects[0].target' && request.targetKinds?.[0] === 'resourceDisplays')).toBe(true);
    expect(item.filter(request => request.confidence === 'declared')).toHaveLength(3);
    expect(atPath(init, '$.revealTriggers[0].condition.key')).toMatchObject({ targetKinds: ['resourceDisplays'] });
    expect(atPath(pool, '$.children[0].id')).toMatchObject({ targetKinds: ['passiveStories', 'passivePools'] });
  });

  it('uses exact enhancement and Init trigger paths', () => {
    const enhancement = collect('enhancements', {
      price: [{ resourceId: 'world:resource:credit', amount: 50 }],
      effects: [{ op: 'unlockInit', target: '', value: 'world:init:anniversary' }],
    });
    const init = collect('inits', { triggers: [{
      on: { kind: 'story', storyId: 'world:story:prologue' },
      condition: { target: 'hasReadStory', key: 'world:story:prologue' },
      effects: [{ op: 'triggerStory', target: 'world:activestory:welcome', value: 1 }],
    }] });

    expect(atPath(enhancement, '$.effects[0].value')).toMatchObject({ targetKinds: ['inits'] });
    expect(atPath(init, '$.triggers[0].on.storyId')).toMatchObject({ targetKinds: ['stories'] });
    expect(atPath(init, '$.triggers[0].condition.key')).toMatchObject({ targetKinds: ['stories'] });
    expect(atPath(init, '$.triggers[0].effects[0].target')).toMatchObject({ targetKinds: ['activeStories', 'passiveStories'] });
  });

  it('resolves setTheme entity keys only for persistent entity scopes', () => {
    const requests = collect('stories', { nodes: [
      { id: 'area-theme', type: 'operation', action: { kind: 'presentation', command: { command: 'theme', value: { scope: 'area', entityKey: 'area:world:area:office' } } } },
      { id: 'student-theme', type: 'operation', action: { kind: 'presentation', command: { command: 'theme', value: { scope: 'student', entityKey: 'variant:world:variant:alice' } } } },
      { id: 'ephemeral-theme', type: 'operation', action: { kind: 'presentation', command: { command: 'theme', value: { scope: 'ephemeral', entityKey: 'area:world:area:temporary' } } } },
      { id: 'implicit-theme', type: 'operation', action: { kind: 'presentation', command: { command: 'theme', value: { entityKey: 'area:world:area:defaulted' } } } },
    ] });

    expect(atPath(requests, '$.nodes[0].action.command.value.entityKey')).toMatchObject({ value: 'world:area:office', targetKinds: ['areas'] });
    expect(atPath(requests, '$.nodes[1].action.command.value.entityKey')).toMatchObject({ value: 'world:variant:alice', targetKinds: ['characterVariants'] });
    expect(requests.some(request => request.value === 'world:area:temporary' || request.value === 'world:area:defaulted')).toBe(false);
  });

  it('scans Story transfer, condition, named state, travel, and entry request paths under nodes', () => {
    const requests = collect('stories', { nodes: [
      { id: 'direct', type: 'transfer', transfer: { mode: 'goto', storyId: 'world:story:direct' } },
      { id: 'button', type: 'click', stageId: 'button', interaction: { kind: 'button', text: 'Continue', result: {
        actions: [
          { kind: 'state', effects: [
            { op: 'setResource', resourceId: 'world:resource:credit', amount: 1 },
            { op: 'setManager', spotId: 'world:spot:desk', managerId: 'world:character:arona' },
          ] },
          { kind: 'travel', areaId: 'world:area:office' },
          { kind: 'entryRequest', request: { entryId: 'world:activestory:system', entryType: 'active', owner: 'world:variant:arona', intent: 'system' } },
        ],
        transfer: { mode: 'insert', storyId: 'world:story:insert' },
      } } },
      { id: 'choice', type: 'click', stageId: 'choice', interaction: { kind: 'choice', options: [{
        id: 'route', text: 'Route',
        condition: { type: 'AND', conditions: [{ target: 'hasReadStory', key: 'world:story:condition', comparator: '==', value: 1 }] },
        result: { transfer: { mode: 'goto', storyId: 'world:story:choice' } },
      }] } },
      { id: 'overlay-card', type: 'operation', action: { kind: 'overlay', command: {
        command: 'show', id: 'card', content: { kind: 'entryCard', card: { request: { entryId: 'world:activestory:card', entryType: 'active', owner: null, intent: 'card' } } },
      } } },
    ] });

    expect(atPath(requests, '$.nodes[0].transfer.storyId')).toMatchObject({ targetKinds: ['stories'] });
    expect(atPath(requests, '$.nodes[1].interaction.result.transfer.storyId')).toMatchObject({ targetKinds: ['stories'] });
    expect(atPath(requests, '$.nodes[1].interaction.result.actions[0].effects[0].resourceId')).toMatchObject({ targetKinds: ['resourceDisplays'] });
    expect(atPath(requests, '$.nodes[1].interaction.result.actions[0].effects[1].managerId')).toMatchObject({ targetKinds: ['characters'] });
    expect(atPath(requests, '$.nodes[1].interaction.result.actions[1].areaId')).toMatchObject({ targetKinds: ['areas'] });
    expect(atPath(requests, '$.nodes[1].interaction.result.actions[2].request.entryId')).toMatchObject({ targetKinds: ['activeStories'] });
    expect(atPath(requests, '$.nodes[1].interaction.result.actions[2].request.owner')).toMatchObject({ targetKinds: ['characterVariants'] });
    expect(atPath(requests, '$.nodes[2].interaction.options[0].condition.conditions[0].key')).toMatchObject({ targetKinds: ['stories'] });
    expect(atPath(requests, '$.nodes[2].interaction.options[0].result.transfer.storyId')).toMatchObject({ targetKinds: ['stories'] });
    expect(atPath(requests, '$.nodes[3].action.command.content.card.request.entryId')).toMatchObject({ targetKinds: ['activeStories'] });
  });

  it('skips accessors and terminates safely on cyclic input', () => {
    const value: Record<string, unknown> = { extra: { t: 'dict', v: { ref: { t: 'str', v: 'missing:area:target' } } } };
    value.self = value;
    Object.defineProperty(value, 'description', { enumerable: true, get: () => { throw new Error('getter must not run'); } });

    expect(collect('items', value)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '$.extra.v.ref.v', scope: 'candidate', confidence: 'inferred' }),
    ]));
  });
});
