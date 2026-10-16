import { describe, expect, it } from 'vitest';
import type { RuntimeDefinitionRef } from '../../src/data-services/contracts/runtime-content-browser';
import { collectOperationReferences } from '../../src/data-services/registry/runtime-content-operation-references';
import type { ReferenceEntry, ReferenceRequest } from '../../src/data-services/registry/runtime-content-reference-types';

const ref = (definitionKind: string, fullId: string): RuntimeDefinitionRef => ({ definitionKind, fullId });
const entry = (definitionKind: string, fullId: string, value: unknown): ReferenceEntry => ({ ref: ref(definitionKind, fullId), value });
const requestAt = (requests: readonly ReferenceRequest[], path: string): ReferenceRequest => {
  const request = requests.find(candidate => candidate.path === path);
  if (!request) throw new Error(`Missing reference request at ${path}`);
  return request;
};

describe('collectOperationReferences', () => {
  it('keeps declared global links typed and reports local fact keys only in their Event', () => {
    const eventRef = ref('operationEvents', 'event-a');
    const event = {
      initId: 'init-a',
      locationIds: ['location-a'],
      initialLocationId: 'location-a',
      rewards: { success: { kind: 'resource', resourceId: 'credit', amount: 2 } },
      factIds: ['briefed'],
      knownFactIds: ['briefed', 'missing-fact'],
      itemIds: ['pass'],
      heldItemIds: ['pass', 'missing-item'],
      teams: [{ id: 'team-a' }],
      actors: [
        { id: 'actor-a', type: 'opponent', avatarRef: 'pic-a', teamId: 'team-a', hp: { initial: 1, min: 0, max: 1 } },
        { id: 'actor-b', type: 'opponent', teamId: 'missing-team', hp: { initial: 1, min: 0, max: 1 } },
      ],
      participants: [{ actorId: 'actor-a', kind: 'opponent', candidateActionIds: ['action-a'] }],
    };
    const requests = collectOperationReferences(eventRef, event, [
      { ref: eventRef, value: event },
      entry('operationActions', 'action-a', {}),
    ]);

    expect(requestAt(requests, '$.initId').targetKinds).toEqual(['inits']);
    expect(requestAt(requests, '$.rewards.success.resourceId').targetKinds).toEqual(['resourceDisplays']);
    expect(requestAt(requests, '$.actors[0].avatarRef').targetKinds).toEqual(['pics']);
    expect(requestAt(requests, '$.participants[0].candidateActionIds[0]').targetKinds).toEqual(['operationActions']);

    const valid = requestAt(requests, '$.knownFactIds[0]');
    expect(valid).toMatchObject({ scope: 'local', confidence: 'declared', context: eventRef });
    expect(valid.locations).toEqual([{ ref: eventRef, path: '$.factIds[0]' }]);
    const missing = requestAt(requests, '$.knownFactIds[1]');
    expect(missing).toMatchObject({ scope: 'local', confidence: 'declared', context: eventRef, locations: [] });

    expect(requestAt(requests, '$.actors[0].teamId')).toMatchObject({
      scope: 'local', confidence: 'declared', context: eventRef, locations: [{ ref: eventRef, path: '$.teams[0].id' }],
    });
    expect(requestAt(requests, '$.actors[1].teamId')).toMatchObject({
      scope: 'local', confidence: 'declared', context: eventRef, locations: [],
    });
    expect(requestAt(requests, '$.heldItemIds[0]')).toMatchObject({
      scope: 'local', confidence: 'declared', context: eventRef, locations: [{ ref: eventRef, path: '$.itemIds[0]' }],
    });
    expect(requestAt(requests, '$.heldItemIds[1]')).toMatchObject({
      scope: 'local', confidence: 'declared', context: eventRef, locations: [],
    });
  });

  it('collects typed global links from Location, Profile and Card Pool definitions', () => {
    const source = ref('operationLocations', 'location-a');
    const requests = collectOperationReferences(source, {
      enabledActionIds: ['action-a'],
      routeEdges: [{ id: 'next', targetLocationId: 'location-b' }],
    }, [
      { ref: source, value: {} },
      entry('operationActions', 'action-a', {}),
      entry('operationLocations', 'location-b', {}),
    ]);

    expect(requestAt(requests, '$.enabledActionIds[0]')).toMatchObject({ scope: 'global', targetKinds: ['operationActions'] });
    expect(requestAt(requests, '$.routeEdges[0].targetLocationId')).toMatchObject({ scope: 'global', targetKinds: ['operationLocations'] });

    const profileRef = ref('studentOperationProfiles', 'profile-a');
    const profileRequests = collectOperationReferences(profileRef, {
      characterId: 'character-a',
      candidateActionIds: ['action-a'],
      strategyProfileId: 'strategy-a',
      cardPoolIds: ['pool-a'],
    }, [{ ref: profileRef, value: {} }]);
    expect(requestAt(profileRequests, '$.characterId').targetKinds).toEqual(['characters']);
    expect(requestAt(profileRequests, '$.strategyProfileId').targetKinds).toEqual(['operationStrategyProfiles']);
    expect(requestAt(profileRequests, '$.cardPoolIds[0]').targetKinds).toEqual(['operationCardPools']);

    const poolRef = ref('operationCardPools', 'pool-a');
    const poolRequests = collectOperationReferences(poolRef, { entries: [{ actionId: 'action-a', weight: 1 }] }, [{ ref: poolRef, value: {} }]);
    expect(requestAt(poolRequests, '$.entries[0].actionId').targetKinds).toEqual(['operationActions']);
  });

  it('keeps declared actor-type selectors as candidates with every matching Event actor location', () => {
    const actionRef = ref('operationActions', 'action-a');
    const eventRef = ref('operationEvents', 'event-a');
    const action = {
      target: { kind: 'actor', relation: 'any', allowedActorTypes: ['opponent', 'missing-type'] },
    };
    const event = {
      actors: [{ id: 'opponent-a', type: 'opponent' }, { id: 'opponent-b', type: 'opponent' }],
      participants: [{ actorId: 'opponent-a', kind: 'opponent', candidateActionIds: ['action-a'] }],
    };
    const requests = collectOperationReferences(actionRef, action, [
      { ref: actionRef, value: action },
      { ref: eventRef, value: event },
    ]);

    expect(requestAt(requests, '$.target.allowedActorTypes[0]')).toMatchObject({
      scope: 'candidate', confidence: 'inferred', context: eventRef,
      locations: [
        { ref: eventRef, path: '$.actors[0].type' },
        { ref: eventRef, path: '$.actors[1].type' },
      ],
    });
    expect(requestAt(requests, '$.target.allowedActorTypes[1]')).toMatchObject({
      scope: 'candidate', confidence: 'inferred', context: eventRef, locations: [],
    });
  });

  it('keeps every Event context for local Action effects, including missing owner-local keys', () => {
    const actionRef = ref('operationActions', 'action-shared');
    const eventARef = ref('operationEvents', 'event-a');
    const eventBRef = ref('operationEvents', 'event-b');
    const eventA = {
      tracks: [{ id: 'risk', initial: 0, min: 0, max: 5 }],
      factIds: ['briefed'],
      itemIds: ['pass'],
      actors: [
        { id: 'actor-a', resources: { focus: { initial: 2, min: 0, max: 3 } } },
        { id: 'actor-b', resources: { focus: { initial: 2, min: 0, max: 3 } } },
      ],
      participants: [{ actorId: 'actor-a', kind: 'opponent', candidateActionIds: ['action-shared'] }],
    };
    const eventB = {
      tracks: [],
      factIds: [],
      itemIds: [],
      participants: [{ actorId: 'actor-b', kind: 'opponent', candidateActionIds: ['action-shared'] }],
    };
    const action = {
      effects: [
        { kind: 'eventTrackDelta', trackId: 'risk', amount: 1 },
        { kind: 'heldItem', itemId: 'pass', op: 'grant' },
        { kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'focus', amount: -1 },
      ],
    };
    const requests = collectOperationReferences(actionRef, action, [
      { ref: actionRef, value: action },
      { ref: eventARef, value: eventA },
      { ref: eventBRef, value: eventB },
    ]);

    for (const path of ['$.effects[0].trackId', '$.effects[1].itemId']) {
      const contexts = requests.filter(request => request.path === path);
      expect(contexts.map(request => request.context?.fullId)).toEqual(['event-a', 'event-b']);
      expect(contexts.every(request => request.scope === 'local' && request.targetKinds === undefined)).toBe(true);
    }
    expect(requestAt(requests, '$.effects[0].trackId').locations).toEqual([{ ref: eventARef, path: '$.tracks[0].id' }]);
    expect(requests.find(request => request.path === '$.effects[0].trackId' && request.context?.fullId === 'event-b')?.locations).toEqual([]);
    expect(requestAt(requests, '$.effects[1].itemId').locations).toEqual([{ ref: eventARef, path: '$.itemIds[0]' }]);

    const dynamicResource = requests.find(request => request.path === '$.effects[2].resourceId' && request.context?.fullId === 'event-a');
    expect(dynamicResource).toMatchObject({ scope: 'candidate', confidence: 'inferred', context: eventARef });
    expect(dynamicResource?.locations).toEqual([
      { ref: eventARef, path: '$.actors[0].resources["focus"]' },
      { ref: eventARef, path: '$.actors[1].resources["focus"]' },
    ]);
  });

  it('keeps unclosed selectors as candidates and scopes SceneAction choices to their Scene', () => {
    const actionRef = ref('operationActions', 'action-unused');
    const actionRequests = collectOperationReferences(actionRef, { cardCondition: { positionIds: ['back'] } }, [
      { ref: actionRef, value: { cardCondition: { positionIds: ['back'] } } },
    ]);
    expect(requestAt(actionRequests, '$.cardCondition.positionIds[0]')).toMatchObject({ scope: 'candidate', confidence: 'inferred', locations: [] });

    const locationRef = ref('operationLocations', 'location-a');
    const locationRequests = collectOperationReferences(locationRef, {
      scenes: [
        { id: 'scene-a', sceneActions: [{ id: 'shared', actionId: 'action-a' }], sceneActionChoice: { candidateSceneActionIds: ['shared'], chooseExactly: 1 } },
        { id: 'scene-b', sceneActions: [{ id: 'shared', actionId: 'action-b' }] },
      ],
    }, [{ ref: locationRef, value: {} }]);
    expect(requestAt(locationRequests, '$.scenes[0].sceneActionChoice.candidateSceneActionIds[0]').locations)
      .toEqual([{ ref: locationRef, path: '$.scenes[0].sceneActions[0].id' }]);
  });

  it('ignores accessor fields, stops ancestor cycles, and keeps repeated predicate branches', () => {
    let getterCalls = 0;
    const objective = Object.defineProperty({}, 'predicate', {
      enumerable: true,
      get: () => { getterCalls += 1; return { kind: 'track', trackId: 'risk' }; },
    });
    const tracks = Object.defineProperty([], '0', {
      enumerable: true,
      get: () => { getterCalls += 1; return { id: 'risk' }; },
    });
    const getterEvent = Object.defineProperty({ tracks, objectives: [objective] }, 'initId', {
      enumerable: true,
      get: () => { getterCalls += 1; return 'init-a'; },
    });
    const eventRef = ref('operationEvents', 'event-getter');
    expect(collectOperationReferences(eventRef, getterEvent, [{ ref: eventRef, value: getterEvent }])).toEqual([]);
    expect(getterCalls).toBe(0);

    const repeatedLeaf = { kind: 'track', trackId: 'risk', operator: 'gte', value: 1 };
    const repeatedEvent = {
      tracks: [{ id: 'risk' }],
      objectives: [{ id: 'objective', predicate: { kind: 'all', terms: [repeatedLeaf, repeatedLeaf] } }],
    };
    const repeated = collectOperationReferences(eventRef, repeatedEvent, [{ ref: eventRef, value: repeatedEvent }]);
    expect(repeated.filter(request => request.value === 'risk').map(request => request.path)).toEqual([
      '$.objectives[0].predicate.terms[0].trackId',
      '$.objectives[0].predicate.terms[1].trackId',
    ]);

    const cyclicPredicate: { kind: string; terms: unknown[] } = { kind: 'all', terms: [] };
    cyclicPredicate.terms.push(cyclicPredicate);
    const cyclicEvent = { tracks: [{ id: 'risk' }], objectives: [{ id: 'cycle', predicate: cyclicPredicate }] };
    expect(collectOperationReferences(eventRef, cyclicEvent, [{ ref: eventRef, value: cyclicEvent }])).toEqual([]);

    const locationRef = ref('operationLocations', 'location-cycle');
    const ownerEvent = { locationIds: ['location-cycle'], tracks: [] };
    const cyclicLocation = { objectives: [{ id: 'cycle', predicate: cyclicPredicate }] };
    expect(collectOperationReferences(locationRef, cyclicLocation, [
      { ref: locationRef, value: cyclicLocation },
      { ref: ref('operationEvents', 'event-cycle'), value: ownerEvent },
    ])).toEqual([]);
  });
});
