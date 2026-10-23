import { afterEach, describe, expect, test, vi } from 'vitest';
import type { OperationEventDef } from '../../src/arona-clicker/contracts/operation/operation';
import type { OperationContentResolver, OperationResolvedContent } from '../../src/arona-clicker/contracts/operation/operation-content-resolver';
import type { StudentOperationProfileDef } from '../../src/arona-clicker/contracts/operation/student-operation-profile';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation/operation-action';
import type { OperationStudentSkillRuleDef } from '../../src/arona-clicker/contracts/operation/operation-skill';
import type { OperationCardPoolDef, OperationStrategyProfileDef, OperationEventContentDef, OperationLocationDef } from '../../src/data-services/contracts/operation';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import type { CharacterVariantDef } from '../../src/arona-clicker/types/character';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { OperationRuntimeService } from '../../src/arona-clicker/services/operation/operation-runtime-service';
import { createOperationEntry } from '../../src/arona-clicker/services/operation/operation-entry-service';
import { OperationAdmissionError, OperationParticipantAdmission } from '../../src/arona-clicker/services/operation/operation-participant-admission';
import { createRegistryOperationContentResolver } from '../../src/arona-clicker/services/operation/registry-operation-content-resolver';
import { baseDatapack } from '../../src/data/test-datapack';

const EVENT_ID = 'test:operation:admission';
const STRATEGY_ID = 'test:strategy:hoshino';
const POOL_ID = 'test:pool:hoshino';
const HOSHINO_PROFILE: StudentOperationProfileDef = {
  id: 'test:operation-profile:hoshino',
  characterId: Character.Hoshino,
  candidateActionIds: ['observe', 'protect'],
  actionPriorityIds: ['protect', 'observe'],
  capabilityIds: ['frontline-protection'],
  reasonIds: ['hoshino-veteran'],
  randomSkillRuleId: 'test:skill-rule:hoshino',
  strategyProfileId: STRATEGY_ID,
  cardPoolIds: [POOL_ID],
};
const SERIKA_PROFILE: StudentOperationProfileDef = {
  id: 'test:operation-profile:serika',
  characterId: Character.Serika,
  candidateActionIds: ['observe'],
  actionPriorityIds: ['observe'],
  capabilityIds: [],
  reasonIds: ['serika-practical'],
};

function eventDef(id = EVENT_ID): OperationEventDef {
  return {
    id,
    locations: [{ id: 'test:location:office', stage: 'combat', enabledActionIds: [], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    initialLocationId: 'test:location:office',
    tracks: [],
    factIds: ['door-open'],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors: [
      { id: 'test:actor:student-slot', type: 'student', hp: { initial: 4, min: 0, max: 4 } },
      { id: 'test:actor:opponent', type: 'opponent', hp: { initial: 5, min: 0, max: 5 } },
    ],
    playerRouteState: { playerCost: 0 },
  };
}

function actionDefinitions(): OperationActionDef[] {
  return [
    { id: 'observe', title: 'observe', allowedParticipantKinds: ['student'], requiredCapabilityIds: [], reasonIds: ['observe-reason'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'protect', title: 'protect', allowedParticipantKinds: ['student'], requiredCapabilityIds: ['frontline-protection'], reasonIds: ['protect-reason'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'opponent-observe', title: 'opponent observe', allowedParticipantKinds: ['opponent'], requiredCapabilityIds: [], reasonIds: [], tagIds: [], target: { kind: 'none' }, effects: [] },
  ];
}

function studentSkillRules(): OperationStudentSkillRuleDef[] {
  return [{ id: 'test:skill-rule:hoshino', triggerActionIds: ['protect'], chanceBps: 2500, effects: [] }];
}

function operationCardPools(): OperationCardPoolDef[] {
  return [{ id: POOL_ID, selector: { positionIds: ['front'], requiredFactIds: ['door-open'] }, entries: [{ actionId: 'observe', weight: 4 }] }];
}

function operationStrategyProfiles(): OperationStrategyProfileDef[] {
  return [{ id: STRATEGY_ID, biases: [{ tagId: 'protect', biasBps: 15000 }] }];
}

function content(changes: Partial<OperationResolvedContent> = {}): OperationResolvedContent {
  return {
    eventDefinition: eventDef(),
    participants: [
      { actorId: 'test:actor:student-slot', kind: 'student' },
      { actorId: 'test:actor:opponent', kind: 'opponent', factionId: 'test:faction:enemy', candidateActionIds: ['opponent-observe'] },
    ],
    studentProfiles: [HOSHINO_PROFILE],
    actionDefinitions: actionDefinitions(),
    studentSkillRules: studentSkillRules(),
    operationCardPools: operationCardPools(),
    operationStrategyProfiles: operationStrategyProfiles(),
    ...changes,
  };
}

function resolverOf(value: OperationResolvedContent | null = content()): OperationContentResolver {
  return { resolve: () => value };
}

describe('Operation participant admission', () => {
  const games: GameInstance[] = [];

  function createGame(): GameInstance {
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack], { enterDefaultInit: false });
    return game;
  }

  function makeEntry(
    game: GameInstance,
    owner = new OperationRuntimeService(),
    resolver: OperationContentResolver = resolverOf(),
  ) {
    return createOperationEntry({
      owner,
      resolver,
      characterSystem: game.characterSystem,
      rosterSystem: game.rosterSystem,
      getState: () => game.state as PlayerState,
    });
  }

  function ownHoshino(game: GameInstance): void {
    game.mutations.acquireCharacter('Hoshino', 'story');
  }

  afterEach(() => {
    for (const game of games.splice(0)) {
      if (game.running) game.stop();
    }
  });

  test('requires a real owned Variant and CharacterSystem unlock before owner start', () => {
    const game = createGame();
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');
    const entry = makeEntry(game, owner);
    const lifecycle: string[] = [];
    owner.subscribe(event => lifecycle.push(event.type));

    expect(() => entry.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(/no owned Registry Variant/);
    const malformedState = game.state as unknown as PlayerState;
    malformedState.roster = { ...(malformedState.roster ?? {}), Nowhere: { variantId: 'Nowhere' } as never };
    expect(game.rosterSystem.isOwned(game.state, 'Nowhere')).toBe(true);
    expect(() => entry.facade.start(EVENT_ID, ['nowhere'])).toThrow(/unknown or invalid Character/);
    expect(start).not.toHaveBeenCalled();
    expect(owner.getSnapshot()).toBeNull();
    expect(lifecycle).toEqual([]);

    ownHoshino(game);
    const run = entry.facade.start(EVENT_ID, [Character.Hoshino]);
    expect(run.eventId).toBe(EVENT_ID);
    expect(start).toHaveBeenCalledTimes(1);
    expect(lifecycle).toEqual(['runStarted', 'locationEntered']);
  });

  test('passes only referenced Strategy/CardPool definitions through detached Admission', () => {
    const game = createGame();
    ownHoshino(game);
    const admission = new OperationParticipantAdmission({
      resolver: resolverOf(content({
        operationCardPools: [...operationCardPools(), { id: 'unused-pool', entries: [{ actionId: 'observe', weight: 2 }] }],
        operationStrategyProfiles: [...operationStrategyProfiles(), { id: 'unused-strategy', biases: [] }],
      })),
      characterSystem: game.characterSystem,
      rosterSystem: game.rosterSystem,
      getState: () => game.state as PlayerState,
    }).admit(EVENT_ID, [Character.Hoshino]);

    expect(admission.operationCardPools).toEqual(operationCardPools());
    expect(admission.operationStrategyProfiles).toEqual(operationStrategyProfiles());
    expect(Object.isFrozen(admission.operationCardPools?.[0].entries[0])).toBe(true);
    expect(admission.studentProfiles[0].strategyProfileId).toBe(STRATEGY_ID);
  });

  test('Registry resolver closes definitions over Event, Location, and selected Profile references', () => {
    const nestedSceneAction: OperationActionDef = {
      id: 'scene-only-action', title: 'scene only', allowedParticipantKinds: ['student'],
      requiredCapabilityIds: [], reasonIds: [], tagIds: [], target: { kind: 'none' }, effects: [],
    };
    const location: OperationLocationDef = {
      id: 'test:location:office', stage: 'combat', enabledActionIds: [], combinationRules: [], routeEdges: [],
      cardPoolIds: ['test:pool:location'],
      scenes: [{
        id: 'nested-scene', title: 'Nested Scene', actionMode: 'global', sceneActionBatches: 1,
        sceneActions: [{ id: 'nested-choice', actionId: nestedSceneAction.id, scope: 'global', playerCost: 0 }],
      }],
    };
    const registryEvent = {
      ...eventDef(),
      initId: 'test:init:admission',
      resumeVersion: 1,
      locationIds: [location.id],
      participants: content().participants,
      studentSkillRules: studentSkillRules(),
      cardPoolIds: ['test:pool:event'],
    } as unknown as OperationEventContentDef;
    const poolRows = [
      ...operationCardPools(),
      { id: 'test:pool:event', entries: [{ actionId: 'observe', weight: 1 }] },
      { id: 'test:pool:location', entries: [{ actionId: 'protect', weight: 1 }] },
      { id: 'unused-pool', entries: [{ actionId: 'observe', weight: 1 }] },
    ] as OperationCardPoolDef[];
    const strategyRows = [...operationStrategyProfiles(), { id: 'unused-strategy', biases: [] }] as OperationStrategyProfileDef[];
    const resolver = createRegistryOperationContentResolver({
      operationEvents: new Map([[registryEvent.id, registryEvent]]),
      operationLocations: new Map([[location.id, location]]),
      operationActions: new Map([...actionDefinitions(), nestedSceneAction].map(action => [action.id, action])),
      studentOperationProfiles: new Map([[HOSHINO_PROFILE.id, HOSHINO_PROFILE]]),
      operationCardPools: new Map(poolRows.map(pool => [pool.id, pool])),
      operationStrategyProfiles: new Map(strategyRows.map(profile => [profile.id, profile])),
    });
    const resolved = resolver.resolve(EVENT_ID);
    expect(resolved?.operationCardPools?.map(pool => pool.id).sort()).toEqual([POOL_ID, 'test:pool:event', 'test:pool:location'].sort());
    expect(resolved?.operationStrategyProfiles?.map(profile => profile.id)).toEqual([STRATEGY_ID]);
    expect(resolved?.actionDefinitions.map(action => action.id).sort()).toEqual(['observe', 'opponent-observe', 'protect', 'scene-only-action']);
  });

  test.each([
    ['malformed selector array', { sceneIds: 'park:exploration' }],
    ['undeclared Event fact', { requiredFactIds: ['test:fact:not-declared'] }],
    ['unsupported selector field', { sceneIds: ['park:exploration'], rangeIds: ['near'] }],
  ])('rejects an Action.cardCondition with %s during Admission', (_label, cardCondition) => {
    const game = createGame();
    ownHoshino(game);
    const invalidActions = actionDefinitions().map(action => action.id === 'observe'
      ? { ...action, cardCondition } as unknown as OperationActionDef
      : action);
    const admission = new OperationParticipantAdmission({
      resolver: resolverOf(content({ actionDefinitions: invalidActions })),
      characterSystem: game.characterSystem,
      rosterSystem: game.rosterSystem,
      getState: () => game.state as PlayerState,
    });

    expect(() => admission.admit(EVENT_ID, [Character.Hoshino])).toThrow(OperationAdmissionError);
  });

  test('rejects blank Location context IDs and duplicate Location Pool IDs', () => {
    const game = createGame();
    ownHoshino(game);
    const baseEvent = eventDef();
    const invalidLocations = [
      { ...baseEvent.locations[0], interactionSceneId: ' ' },
      { ...baseEvent.locations[0], activityId: ' ' },
      { ...baseEvent.locations[0], cardPoolIds: ['test:pool:duplicate', 'test:pool:duplicate'] },
    ] as unknown as OperationEventDef['locations'];

    for (const location of invalidLocations) {
      const admission = new OperationParticipantAdmission({
        resolver: resolverOf(content({
          eventDefinition: { ...baseEvent, locations: [location] },
        })),
        characterSystem: game.characterSystem,
        rosterSystem: game.rosterSystem,
        getState: () => game.state as PlayerState,
      });
      expect(() => admission.admit(EVENT_ID, [Character.Hoshino])).toThrow(OperationAdmissionError);
    }
  });

  test('rejects a missing or proto-mismatched Registry Variant despite existing roster progress', () => {
    const game = createGame();
    ownHoshino(game);
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');
    const entry = makeEntry(game, owner);

    const variants = game.registry.characterVariants as Map<string, CharacterVariantDef>;
    variants.delete('Hoshino');
    expect(() => entry.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(/no owned Registry Variant/);
    expect(start).not.toHaveBeenCalled();

    game.init([baseDatapack], { enterDefaultInit: false });
    ownHoshino(game);
    const variant = variants.get('Hoshino')!;
    variants.set('Hoshino', { ...variant, proto: Character.Serika });
    expect(() => entry.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(/no owned Registry Variant/);
    expect(start).not.toHaveBeenCalled();
    expect(owner.getSnapshot()).toBeNull();
  });

  test('rejects resolver errors, absent content, mismatched event IDs, and malformed content before owner start', () => {
    const game = createGame();
    ownHoshino(game);
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');

    const resolvers: OperationContentResolver[] = [
      { resolve: () => { throw new Error('fixture failure'); } },
      { resolve: () => null },
      { resolve: () => ({ ...content(), eventDefinition: eventDef('test:operation:other') }) },
      { resolve: () => ({ eventDefinition: null } as unknown as OperationResolvedContent) },
      { resolve: () => ({
        ...content(),
        eventDefinition: { ...eventDef(), actors: [null] as unknown as OperationEventDef['actors'] },
      }) },
    ];
    for (const resolver of resolvers) {
      const entry = makeEntry(game, owner, resolver);
      expect(() => entry.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(OperationAdmissionError);
      expect(owner.getSnapshot()).toBeNull();
    }
    expect(start).not.toHaveBeenCalled();
  });

  test('rejects missing, duplicate, mismatched, or invalid Profile content before creating a Run', () => {
    const game = createGame();
    ownHoshino(game);
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');
    const cases: Array<{ source: OperationResolvedContent; message: RegExp }> = [
      { source: content({ studentProfiles: [] }), message: /no StudentOperationProfile/ },
      {
        source: content({ participants: [
          { actorId: 'test:actor:student-slot', kind: 'student', profileId: 'test:operation-profile:missing' },
          { actorId: 'test:actor:opponent', kind: 'opponent', candidateActionIds: ['opponent-observe'] },
        ] }),
        message: /references missing Profile/,
      },
      {
        source: content({
          participants: [
            { actorId: 'test:actor:student-slot', kind: 'student', profileId: SERIKA_PROFILE.id },
            { actorId: 'test:actor:opponent', kind: 'opponent', candidateActionIds: ['opponent-observe'] },
          ],
          studentProfiles: [SERIKA_PROFILE],
        }),
        message: /Character mismatch/,
      },
      { source: content({ studentProfiles: [HOSHINO_PROFILE, HOSHINO_PROFILE] }), message: /duplicate profile ID/ },
      {
        source: content({ participants: [
          { actorId: 'test:actor:student-slot', kind: 'student' },
          { actorId: 'test:actor:opponent', kind: 'opponent', candidateActionIds: ['opponent-observe', 'opponent-observe'] },
        ] }),
        message: /duplicate Action ID/,
      },
      {
        source: content({ participants: [
          { actorId: 'test:actor:student-slot', kind: 'student' },
          { actorId: 'test:actor:student-slot', kind: 'opponent', candidateActionIds: [] },
        ] }),
        message: /duplicate actorId/,
      },
      {
        source: content({ studentProfiles: [{ ...HOSHINO_PROFILE, playerCost: 2 } as StudentOperationProfileDef] }),
        message: /unsupported runtime\/payment field playerCost/,
      },
    ];

    for (const { source, message } of cases) {
      const entry = makeEntry(game, owner, resolverOf(source));
      expect(() => entry.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(message);
      expect(owner.getSnapshot()).toBeNull();
    }
    expect(start).not.toHaveBeenCalled();
  });

  test('closes Action, Skill, Location, and Actor resource references before owner start', () => {
    const game = createGame();
    ownHoshino(game);
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');
    const baseActions = actionDefinitions();
    const baseSkillRules = studentSkillRules();
    const cases: Array<{ source: OperationResolvedContent; message: RegExp }> = [
      {
        source: content({ actionDefinitions: [...baseActions, { ...baseActions[0] }] }),
        message: /duplicate Action ID/,
      },
      {
        source: content({ studentProfiles: [{ ...HOSHINO_PROFILE, candidateActionIds: ['missing', 'observe'], actionPriorityIds: ['observe'] }] }),
        message: /candidateActionIds references a missing Action/,
      },
      {
        source: content({ studentProfiles: [{ ...HOSHINO_PROFILE, randomSkillRuleId: 'test:skill-rule:missing' }] }),
        message: /references a missing Student Skill Rule/,
      },
      {
        source: content({ studentProfiles: [{ ...HOSHINO_PROFILE, capabilityIds: [] }] }),
        message: /no eligible trigger Action/,
      },
      {
        source: content({ studentSkillRules: [{ ...baseSkillRules[0], triggerActionIds: ['missing'] }] }),
        message: /triggerActionIds references a missing Action/,
      },
      {
        source: content({ studentSkillRules: [...baseSkillRules, { ...baseSkillRules[0] }] }),
        message: /duplicate Rule ID/,
      },
      {
        source: content({ studentSkillRules: [{ ...baseSkillRules[0], chanceBps: 10001 }] }),
        message: /chanceBps must be a safe integer/,
      },
      {
        source: content({
          studentSkillRules: [{ ...baseSkillRules[0], effects: [{ kind: 'eventTrackDelta', trackId: 'missing', amount: 1 }] }],
        }),
        message: /references an undeclared track/,
      },
      {
        source: content({
          actionDefinitions: baseActions.map((action, index) => index === 0
            ? { ...action, effects: [{ kind: 'heldItem', itemId: 'missing-key', op: 'grant' }] }
            : action),
        }),
        message: /references an undeclared held item/,
      },
      {
        source: content({
          eventDefinition: {
            ...eventDef(),
            locations: [{ id: 'test:location:office', stage: 'combat', enabledActionIds: ['missing'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
          },
        }),
        message: /enabledActionIds references a missing Action/,
      },
      {
        source: content({
          eventDefinition: {
            ...eventDef(),
            locations: [{ id: 'test:location:office', stage: 'combat', enabledActionIds: ['observe'], combinationRules: [{ id: 'combo', priority: 1, inputTagIds: ['missing:a', 'missing:b'], targetMatch: 'no-target', effects: [] }], routeEdges: [] } ], maxLocationVisits: 20,
          },
        }),
        message: /does not match an enabled student Action tag/,
      },
      {
        source: content({
          actionDefinitions: baseActions.map((action, index) => ({ ...action, tagIds: [index === 0 ? 'slot:a' : 'slot:b'] })),
          eventDefinition: {
            ...eventDef(),
            locations: [{ id: 'test:location:office', stage: 'combat', enabledActionIds: ['observe', 'protect'], combinationRules: [{ id: 'same-target', priority: 1, inputTagIds: ['slot:a', 'slot:b'], targetMatch: 'same-target', effects: [] }], routeEdges: [] } ], maxLocationVisits: 20,
          },
        }),
        message: /not have enabled student Actions compatible with targetMatch same-target/,
      },
      {
        source: content({
          actionDefinitions: baseActions.map((action, index) => ({
            ...action,
            tagIds: [index === 0 ? 'slot:a' : 'slot:b'],
            target: { kind: 'actor', relation: 'any' },
          })),
          eventDefinition: {
            ...eventDef(),
            locations: [{ id: 'test:location:office', stage: 'combat', enabledActionIds: ['observe', 'protect'], combinationRules: [{ id: 'no-target', priority: 1, inputTagIds: ['slot:a', 'slot:b'], targetMatch: 'no-target', effects: [] }], routeEdges: [] } ], maxLocationVisits: 20,
          },
        }),
        message: /not have enabled student Actions compatible with targetMatch no-target/,
      },
      {
        source: content({ actionDefinitions: baseActions.map((action, index) => index === 0 ? { ...action, id: 'observe ' } : action) }),
        message: /id must be a non-empty Action ID/,
      },
      {
        source: content({
          actionDefinitions: baseActions.map(action => action.id === 'protect'
            ? { ...action, cost: { scope: 'actor', resourceId: 'energy', amount: 1 } }
            : action),
        }),
        message: /undeclared actor resource: energy/,
      },
      {
        source: content({ participants: [
          { actorId: 'test:actor:student-slot', kind: 'student' },
          { actorId: 'test:actor:opponent', kind: 'opponent', candidateActionIds: ['missing-opponent-action'] },
        ] }),
        message: /candidateActionIds references a missing Action/,
      },
      {
        source: content({ participants: [
          { actorId: 'test:actor:student-slot', kind: 'student' },
          { actorId: 'test:actor:opponent', kind: 'opponent', candidateActionIds: ['observe'] },
        ] }),
        message: /candidate Action does not allow opponent participants/,
      },
      {
        source: content({
          actionDefinitions: [...baseActions, {
            id: 'opponent-needs-capability',
            title: 'opponent needs capability',
            allowedParticipantKinds: ['opponent'],
            requiredCapabilityIds: ['capability:unmodeled'],
            reasonIds: [], tagIds: [], target: { kind: 'none' }, effects: [],
          }],
          participants: [
            { actorId: 'test:actor:student-slot', kind: 'student' },
            { actorId: 'test:actor:opponent', kind: 'opponent', candidateActionIds: ['opponent-needs-capability'] },
          ],
        }),
        message: /capabilities unavailable to opponent participants/,
      },
      {
        source: content({ participants: [
          { actorId: 'test:actor:student-slot', kind: 'student' },
          { actorId: 'test:actor:opponent', kind: 'opponent' } as never,
        ] }),
        message: /candidateActionIds must be an array/,
      },
    ];

    for (const { source, message } of cases) {
      const entry = makeEntry(game, owner, resolverOf(source));
      expect(() => entry.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(message);
      expect(owner.getSnapshot()).toBeNull();
    }
    expect(start).not.toHaveBeenCalled();
  });

  test('invalid re-entry preserves a previously admitted Run and does not call owner again', () => {
    const game = createGame();
    ownHoshino(game);
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');
    const entry = makeEntry(game, owner);
    const first = entry.facade.start(EVENT_ID, [Character.Hoshino]);

    expect(() => entry.facade.start(EVENT_ID, [Character.Serika])).toThrow(/no owned Registry Variant/);

    expect(start).toHaveBeenCalledTimes(1);
    expect(entry.facade.getSnapshot()?.runId).toBe(first.runId);
  });

  test('NPC-only admission bypasses Character and Roster services', () => {
    const npcEvent = eventDef('test:operation:npc-only');
    const npcContent = content({
      eventDefinition: { ...npcEvent, actors: [npcEvent.actors[1]] },
      participants: [{ actorId: 'test:actor:opponent', kind: 'environment', factionId: 'test:faction:park', candidateActionIds: [] }],
      studentProfiles: [],
    });
    const entry = createOperationEntry({
      owner: new OperationRuntimeService(),
      resolver: { resolve: eventId => eventId === npcEvent.id ? npcContent : null },
    });

    expect(entry.facade.start(npcEvent.id, []).eventId).toBe(npcEvent.id);
  });

  test('student admission still requires wired Character and Roster services', () => {
    const entry = createOperationEntry({ owner: new OperationRuntimeService(), resolver: resolverOf() });
    expect(() => entry.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(/Character\/Roster services are not wired/);
  });

  test('detaches ordered non-student candidates and closes their Actor resource references before owner start', () => {
    const game = createGame();
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');
    ownHoshino(game);
    const source = content({
      eventDefinition: {
        ...eventDef(),
        actors: eventDef().actors.map(actor => actor.id === 'test:actor:opponent'
          ? { ...actor, resources: { ammo: { initial: 2, min: 0, max: 2 } } }
          : actor),
      },
      participants: [
        { actorId: 'test:actor:student-slot', kind: 'student' },
        { actorId: 'test:actor:opponent', kind: 'opponent', candidateActionIds: ['opponent-fire', 'opponent-observe'] },
      ],
      actionDefinitions: [
        ...actionDefinitions(),
        {
          id: 'opponent-fire',
          title: 'opponent fire',
          allowedParticipantKinds: ['opponent'],
          requiredCapabilityIds: [],
          reasonIds: [],
          tagIds: [],
          cost: { scope: 'actor', resourceId: 'ammo', amount: 1 },
          target: { kind: 'none' },
          effects: [{ kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'ammo', amount: -1 }],
        },
      ],
    });
    const entry = makeEntry(game, owner, resolverOf(source));
    entry.facade.start(EVENT_ID, [Character.Hoshino]);
    const runStart = start.mock.calls[0][0];
    expect('eventDefinition' in runStart).toBe(true);
    if ('eventDefinition' in runStart) {
      const opponent = runStart.actors.find(actor => actor.actorId === 'test:actor:opponent');
      if (!opponent || opponent.participantKind === 'student') throw new Error('expected non-student opponent initialization');
      expect(opponent).toMatchObject({
        participantKind: 'opponent',
        candidateActionIds: ['opponent-fire', 'opponent-observe'],
      });
      expect(Object.isFrozen(opponent.candidateActionIds)).toBe(true);
    }

    owner.completeCurrentLocation();
    owner.finish();
    const invalid: OperationResolvedContent = {
      ...source,
      actionDefinitions: source.actionDefinitions.map(action => action.id === 'opponent-fire'
        ? { ...action, cost: { scope: 'actor' as const, resourceId: 'missing-ammo', amount: 1 } }
        : action),
    };
    const invalidEntry = makeEntry(game, owner, resolverOf(invalid));
    expect(() => invalidEntry.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(/undeclared actor resource: missing-ammo/);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('joins multiple non-student candidate lists by actorId without roster admission', () => {
    const baseEvent = eventDef('test:operation:npc-candidate-join');
    const opponent = baseEvent.actors[1];
    const environment = { id: 'test:actor:environment', type: 'environment', hp: { initial: 2, min: 0, max: 2 } };
    const resolved: OperationResolvedContent = {
      eventDefinition: { ...baseEvent, actors: [opponent, environment] },
      participants: [
        { actorId: environment.id, kind: 'environment', candidateActionIds: ['environment-observe'] },
        { actorId: opponent.id, kind: 'opponent', factionId: 'test:faction:only-an-identity', candidateActionIds: ['opponent-observe'] },
      ],
      studentProfiles: [],
      actionDefinitions: [
        { id: 'opponent-observe', title: 'opponent observe', allowedParticipantKinds: ['opponent'], requiredCapabilityIds: [], reasonIds: [], tagIds: [], target: { kind: 'none' }, effects: [] },
        { id: 'environment-observe', title: 'environment observe', allowedParticipantKinds: ['environment'], requiredCapabilityIds: [], reasonIds: [], tagIds: [], target: { kind: 'none' }, effects: [] },
      ],
      studentSkillRules: [],
    };
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');
    const entry = createOperationEntry({ owner, resolver: { resolve: () => resolved } });

    entry.facade.start(resolved.eventDefinition.id, []);

    const input = start.mock.calls[0][0];
    expect('eventDefinition' in input).toBe(true);
    if ('eventDefinition' in input) {
      expect(input.actors.map(actor => actor.actorId)).toEqual([opponent.id, environment.id]);
      expect(input.actors.map(actor => actor.participantKind === 'student' ? undefined : actor.candidateActionIds)).toEqual([
        ['opponent-observe'],
        ['environment-observe'],
      ]);
    }
  });

  test('resolves non-student Actor and Team resource references by teamId and legal targets', () => {
    const game = createGame();
    ownHoshino(game);
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');
    const action: OperationActionDef = {
      id: 'opponent-barrage',
      title: 'opponent barrage',
      allowedParticipantKinds: ['opponent'],
      requiredCapabilityIds: [],
      reasonIds: [],
      tagIds: [],
      cost: { scope: 'team', resourceId: 'pressure', amount: 1 },
      target: { kind: 'actor', relation: 'otherTeam' },
      effects: [
        { kind: 'actorResourceDelta', recipient: 'target', resourceId: 'shield', amount: 1 },
        { kind: 'teamResourceDelta', recipient: 'actorTeam', resourceId: 'pressure', amount: -1 },
        { kind: 'teamResourceDelta', recipient: 'targetTeam', resourceId: 'support', amount: 1 },
      ],
    };
    const validEvent: OperationEventDef = {
      ...eventDef('test:operation:nonstudent-team-resources'),
      teams: [
        { id: 'team:students', resources: { support: { initial: 0, min: 0, max: 3 } } },
        { id: 'team:enemy', resources: { pressure: { initial: 2, min: 0, max: 3 } } },
      ],
      actors: [
        { id: 'test:actor:student-slot', type: 'student', hp: { initial: 4, min: 0, max: 4 }, teamId: 'team:students', resources: { shield: { initial: 0, min: 0, max: 3 } } },
        { id: 'test:actor:opponent', type: 'opponent', hp: { initial: 5, min: 0, max: 5 }, teamId: 'team:enemy' },
      ],
    };
    const buildContent = (eventDefinition: OperationEventDef, factionId = 'test:faction:enemy'): OperationResolvedContent => content({
      eventDefinition,
      participants: [
        { actorId: 'test:actor:student-slot', kind: 'student' },
        { actorId: 'test:actor:opponent', kind: 'opponent', factionId, candidateActionIds: ['opponent-barrage'] },
      ],
      actionDefinitions: [...actionDefinitions(), action],
    });
    const validEntry = makeEntry(game, owner, resolverOf(buildContent(validEvent)));

    validEntry.facade.start(validEvent.id, [Character.Hoshino]);
    expect(start).toHaveBeenCalledTimes(1);
    owner.completeCurrentLocation();
    owner.finish();

    const noTeamMembership: OperationEventDef = {
      ...validEvent,
      actors: validEvent.actors.map(actor => actor.id === 'test:actor:opponent'
        ? { ...actor, teamId: undefined }
        : actor),
    };
    const factionDoesNotSupplyTeam = makeEntry(game, owner, resolverOf(buildContent(noTeamMembership, 'team:enemy')));
    expect(() => factionDoesNotSupplyTeam.facade.start(validEvent.id, [Character.Hoshino]))
      .toThrow(/cost references an undeclared team resource: pressure/);

    const missingTargetActorResource: OperationEventDef = {
      ...validEvent,
      actors: validEvent.actors.map(actor => actor.id === 'test:actor:student-slot'
        ? { ...actor, resources: undefined }
        : actor),
    };
    const missingActorResource = makeEntry(game, owner, resolverOf(buildContent(missingTargetActorResource)));
    expect(() => missingActorResource.facade.start(validEvent.id, [Character.Hoshino]))
      .toThrow(/undeclared target actor resource: shield/);

    const missingTargetTeamResource: OperationEventDef = {
      ...validEvent,
      teams: validEvent.teams?.map(team => team.id === 'team:students' ? { ...team, resources: {} } : team),
    };
    const missingTeamResource = makeEntry(game, owner, resolverOf(buildContent(missingTargetTeamResource)));
    expect(() => missingTeamResource.facade.start(validEvent.id, [Character.Hoshino]))
      .toThrow(/undeclared target Team resource: support/);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('validates actorPosition recipients against the action target contract', () => {
    const game = createGame();
    ownHoshino(game);
    const owner = new OperationRuntimeService();
    const source = content();
    const actorPositionAction = (recipient: 'actor' | 'target', positionId = 'front'): OperationActionDef => ({
      ...source.actionDefinitions[0],
      strategyTagIds: ['protect'],
      effects: [{ kind: 'actorPosition', recipient, positionId }],
    });
    const accepted = makeEntry(game, owner, resolverOf({
      ...source,
      actionDefinitions: [actorPositionAction('actor'), ...source.actionDefinitions.slice(1)],
    }));
    expect(() => accepted.facade.start(EVENT_ID, [Character.Hoshino])).not.toThrow();

    const targetless = makeEntry(game, new OperationRuntimeService(), resolverOf({
      ...source,
      actionDefinitions: [actorPositionAction('target'), ...source.actionDefinitions.slice(1)],
    }));
    expect(() => targetless.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(/targets an Actor but this result has no Actor target/);

    const malformed = makeEntry(game, new OperationRuntimeService(), resolverOf({
      ...source,
      actionDefinitions: [actorPositionAction('actor', ' '), ...source.actionDefinitions.slice(1)],
    }));
    expect(() => malformed.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(/positionId must be a non-empty ID/);

    const duplicateStrategyTag = makeEntry(game, new OperationRuntimeService(), resolverOf({
      ...source,
      actionDefinitions: [
        { ...actorPositionAction('actor'), strategyTagIds: ['protect', 'protect'] },
        ...source.actionDefinitions.slice(1),
      ],
    }));
    expect(() => duplicateStrategyTag.facade.start(EVENT_ID, [Character.Hoshino])).toThrow(/strategyTagIds contains duplicate ID/);
  });

  test('rejects invalid caller IDs before resolver lookup', () => {
    const game = createGame();
    const resolve = vi.fn(() => content());
    const owner = new OperationRuntimeService();
    const start = vi.spyOn(owner, 'start');
    const entry = makeEntry(game, owner, { resolve });
    const unsafeStart = entry.facade.start as unknown as (eventId: unknown, characterIds: readonly string[]) => unknown;

    expect(() => entry.facade.start(' ', [])).toThrow(/eventId must be a non-empty/);
    expect(() => unsafeStart({ id: EVENT_ID }, [])).toThrow(/eventId must be a non-empty/);
    expect(resolve).toHaveBeenCalledTimes(0);

    const missing = makeEntry(game, owner, { resolve: eventId => eventId === EVENT_ID ? content() : null });
    expect(() => missing.facade.start('test:operation:untrusted', [])).toThrow(/resolver returned no content/);
    expect(start).not.toHaveBeenCalled();
    expect(owner.getSnapshot()).toBeNull();
  });
});
