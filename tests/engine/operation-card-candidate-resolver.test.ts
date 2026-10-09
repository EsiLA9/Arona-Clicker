import { describe, expect, test } from 'vitest';
import type { OperationEventDef } from '../../src/arona-clicker/contracts/operation';
import type { OperationStudentProfileSnapshot } from '../../src/arona-clicker/contracts/operation';
import type { OperationActionDef, OperationCardPoolDef, OperationStrategyProfileDef } from '../../src/data-services/contracts/operation';
import { operationCharacterHandWordAt } from '../../src/arona-clicker/services/operation-tactical-rng';
import { resolveOperationCharacterHand } from '../../src/arona-clicker/services/operation-card-candidate-resolver';

const eventDefinition: OperationEventDef = {
  id: 'test:operation-event:hand',
  locations: [{
    id: 'test:operation-location:front',
    stage: 'combat',
    enabledActionIds: ['test:operation-action:cover', 'test:operation-action:attack', 'test:operation-action:observe'],
    combinationRules: [],
    routeEdges: [],
    interactionSceneId: 'combat',
    activityId: 'battle',
    cardPoolIds: ['test:operation-card-pool:front'],
  }],
  initialLocationId: 'test:operation-location:front',
  maxLocationVisits: 1,
  tracks: [],
  factIds: ['alarm-active'],
  knownFactIds: ['alarm-active'],
  itemIds: [],
  heldItemIds: [],
  cardPoolIds: ['test:operation-card-pool:common'],
  actors: [{ id: 'test:actor:hoshino', type: 'student', hp: { initial: 4, min: 0, max: 4 }, positionId: 'front', weaponId: 'sg' }],
  playerRouteState: { playerCost: 0 },
};

const profile = (id = 'test:student-operation-profile:protect', strategyProfileId = 'test:operation-strategy-profile:protect'): OperationStudentProfileSnapshot => ({
  id,
  characterId: 'Hoshino',
  candidateActionIds: ['test:operation-action:cover', 'test:operation-action:attack'],
  actionPriorityIds: [],
  capabilityIds: ['cover-capability'],
  reasonIds: [],
  actionCandidates: [],
  eligibleActionIds: ['test:operation-action:cover', 'test:operation-action:attack'],
  cardPoolIds: ['test:operation-card-pool:personal'],
  strategyProfileId,
  strategyBiases: [],
});

const actions: OperationActionDef[] = [
  {
    id: 'test:operation-action:cover', title: 'cover', allowedParticipantKinds: ['student'], requiredCapabilityIds: ['cover-capability'],
    reasonIds: [], tagIds: [], strategyTagIds: ['protect', 'cover', 'protect'], target: { kind: 'none' }, effects: [],
  },
  {
    id: 'test:operation-action:attack', title: 'attack', allowedParticipantKinds: ['student'], requiredCapabilityIds: [],
    reasonIds: [], tagIds: [], strategyTagIds: ['attack'], target: { kind: 'none' }, effects: [],
  },
  {
    id: 'test:operation-action:observe', title: 'observe', allowedParticipantKinds: ['student'], requiredCapabilityIds: [],
    reasonIds: [], tagIds: [], target: { kind: 'none' }, effects: [],
  },
];

const pools: OperationCardPoolDef[] = [
  { id: 'test:operation-card-pool:common', entries: [
    { actionId: 'test:operation-action:cover', weight: 1 },
    { actionId: 'test:operation-action:attack', weight: 1 },
  ] },
  { id: 'test:operation-card-pool:front', selector: { sceneIds: ['combat'], activityIds: ['battle'], positionIds: ['front'], weaponIds: ['sg'], requiredFactIds: ['alarm-active'] }, entries: [
    { actionId: 'test:operation-action:cover', weight: 2 },
    { actionId: 'test:operation-action:observe', weight: 1 },
  ] },
  { id: 'test:operation-card-pool:personal', entries: [{ actionId: 'test:operation-action:cover', weight: 1 }] },
];

const protectStrategy: OperationStrategyProfileDef = {
  id: 'test:operation-strategy-profile:protect',
  biases: [{ tagId: 'protect', biasBps: 30000 }, { tagId: 'cover', biasBps: 30000 }],
};
const attackStrategy: OperationStrategyProfileDef = {
  id: 'test:operation-strategy-profile:attack',
  biases: [{ tagId: 'attack', biasBps: 30000 }, { tagId: 'protect', biasBps: 1000 }, { tagId: 'cover', biasBps: 1000 }],
};

function resolve(overrides: Partial<Parameters<typeof resolveOperationCharacterHand>[0]> = {}) {
  return resolveOperationCharacterHand({
    eventDefinition,
    locationId: 'test:operation-location:front',
    actorId: 'test:actor:hoshino',
    profile: profile(),
    positionId: 'front',
    weaponId: 'sg',
    knownFactIds: ['alarm-active'],
    actionDefinitions: actions,
    cardPools: pools,
    strategyProfile: protectStrategy,
    seed: 25,
    beatIndex: 0,
    handSize: 2,
    ...overrides,
  });
}

describe('Operation CardPool candidate and Character Hand resolver', () => {
  test('merges orthogonal pools, aggregates duplicate Action entries, and draws deterministically without replacement', () => {
    const first = resolve();
    const repeated = resolve();
    expect(first).toEqual(repeated);
    expect(first.matchedPoolIds).toEqual(['test:operation-card-pool:common', 'test:operation-card-pool:front', 'test:operation-card-pool:personal']);
    expect(first.actionIds).toHaveLength(2);
    expect(new Set(first.actionIds).size).toBe(first.actionIds.length);
    const cover = first.candidates.find(row => row.actionId.endsWith(':cover'))!;
    expect(cover.sourcePoolIds).toEqual(['test:operation-card-pool:common', 'test:operation-card-pool:front', 'test:operation-card-pool:personal']);
    expect(cover.baseWeight).toBe(4);
    expect(cover.strategyFactorBps).toBe(50000);
    expect(cover.finalWeight).toBe(200000);
  });

  test('uses candidateActionIds as a neutral implicit Pool only when no explicit Entry matches', () => {
    const legacy = resolve({
      profile: { ...profile(), strategyProfileId: undefined, cardPoolIds: [] },
      cardPools: [{ id: 'test:operation-card-pool:no-match', selector: { positionIds: ['back'] }, entries: [{ actionId: 'test:operation-action:observe', weight: 1 }] }],
      eventDefinition: { ...eventDefinition, cardPoolIds: [], locations: [{ ...eventDefinition.locations[0], cardPoolIds: [] }] },
      positionId: 'front',
      strategyProfile: undefined,
      handSize: 1,
    });
    expect(legacy.actionIds).toHaveLength(1);
    expect(legacy.candidates.every(row => row.legacyFallback)).toBe(true);
    expect(legacy.candidates.every(row => row.baseWeight === 10000 && row.strategyFactorBps === 10000)).toBe(true);
  });

  test('does not fall back after an explicit Pool matches but its Action is illegal', () => {
    const selectedProfile = { ...profile(), strategyProfileId: undefined, cardPoolIds: [] };
    const result = resolve({
      profile: selectedProfile,
      cardPools: [{ id: 'test:operation-card-pool:matched', entries: [{ actionId: 'test:operation-action:cover', weight: 1 }] }],
      eventDefinition: { ...eventDefinition, cardPoolIds: ['test:operation-card-pool:matched'], locations: [{ ...eventDefinition.locations[0], cardPoolIds: [] }] },
      positionId: 'front',
      strategyProfile: undefined,
      getActionBlockReasons: action => action.id.endsWith(':cover') ? ['operation:action:insufficient-resource'] : [],
    });
    expect(result.actionIds).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].legacyFallback).toBe(false);
    expect(result.candidates[0].reasonIds).toContain('operation:action:insufficient-resource');
  });

  test('filters capability and Context before Strategy and keeps unqualified Actions out of the Hand', () => {
    const result = resolve({
      profile: { ...profile(), capabilityIds: [] },
      positionId: 'back',
      weaponId: 'sg',
      knownFactIds: [],
      handSize: 3,
    });
    const cover = result.candidates.find(row => row.actionId.endsWith(':cover'))!;
    expect(cover.eligible).toBe(false);
    expect(cover.reasonIds).toContain('operation:hand:missing-capability:cover-capability');
    expect(result.matchedPoolIds).not.toContain('test:operation-card-pool:front');
    expect(result.actionIds).not.toContain(cover.actionId);
  });

  test('CardCondition is an independent legality filter and repeated action Strategy tags count once', () => {
    const conditionAction = { ...actions[2], cardCondition: { activityIds: ['negotiation'] } };
    const result = resolve({
      eventDefinition: { ...eventDefinition, cardPoolIds: [], locations: [{ ...eventDefinition.locations[0], cardPoolIds: [] }] },
      cardPools: [{ id: 'test:operation-card-pool:only-observe', entries: [{ actionId: conditionAction.id, weight: 2 }] }],
      actionDefinitions: [actions[0], actions[1], conditionAction],
      strategyProfile: undefined,
      profile: { ...profile(), strategyProfileId: undefined, cardPoolIds: ['test:operation-card-pool:only-observe'] },
      handSize: 1,
    });
    expect(result.actionIds).toEqual([]);
    expect(result.candidates[0].reasonIds).toContain('operation:hand:action-condition-not-met');
    const cover = resolve().candidates.find(row => row.actionId.endsWith(':cover'))!;
    expect(cover.strategyFactorBps).toBe(50000);
  });

  test('different Strategy profiles produce distinct repeatable distributions in the same Context', () => {
    const collect = (strategyProfile: OperationStrategyProfileDef) => {
      let cover = 0;
      let attack = 0;
      for (let seed = 1; seed <= 160; seed++) {
        const hand = resolve({
          seed,
          handSize: 1,
          strategyProfile,
          profile: { ...profile(), strategyProfileId: strategyProfile.id, cardPoolIds: [] },
          eventDefinition: { ...eventDefinition, locations: [{ ...eventDefinition.locations[0], cardPoolIds: [] }] },
          cardPools: [pools[0]],
        });
        if (hand.actionIds[0]?.endsWith(':cover')) cover += 1;
        if (hand.actionIds[0]?.endsWith(':attack')) attack += 1;
      }
      return { cover, attack };
    };
    const protective = collect(protectStrategy);
    const aggressive = collect(attackStrategy);
    expect(protective.cover).toBeGreaterThan(120);
    expect(aggressive.attack).toBeGreaterThan(120);
    expect(protective).not.toEqual(aggressive);
  });

  test('hand random words are stable and independent of tactical cursor progression', () => {
    const original = operationCharacterHandWordAt(91, 'test:actor:hoshino', 4, 0);
    const next = operationCharacterHandWordAt(91, 'test:actor:hoshino', 4, 1);
    const otherActor = operationCharacterHandWordAt(91, 'test:actor:serika', 4, 0);
    expect(operationCharacterHandWordAt(91, 'test:actor:hoshino', 4, 0)).toBe(original);
    expect(next).not.toBe(original);
    expect(otherActor).not.toBe(original);
  });
});
