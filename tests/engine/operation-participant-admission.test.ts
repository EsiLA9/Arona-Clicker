import { afterEach, describe, expect, test, vi } from 'vitest';
import type { OperationEventDef } from '../../src/arona-clicker/contracts/operation';
import type { OperationContentResolver, OperationResolvedContent } from '../../src/arona-clicker/contracts/operation-content-resolver';
import type { StudentOperationProfileDef } from '../../src/arona-clicker/contracts/student-operation-profile';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation-action';
import type { OperationStudentSkillRuleDef } from '../../src/arona-clicker/contracts/operation-skill';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import type { CharacterVariantDef } from '../../src/arona-clicker/types/character';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { OperationRuntimeService } from '../../src/arona-clicker/services/operation-runtime-service';
import { createOperationEntry } from '../../src/arona-clicker/services/operation-entry-service';
import { OperationAdmissionError } from '../../src/arona-clicker/services/operation-participant-admission';
import { baseDatapack } from '../../src/data/test-datapack';

const EVENT_ID = 'test:operation:admission';
const HOSHINO_PROFILE: StudentOperationProfileDef = {
  id: 'test:operation-profile:hoshino',
  characterId: Character.Hoshino,
  candidateActionIds: ['observe', 'protect'],
  actionPriorityIds: ['protect', 'observe'],
  capabilityIds: ['frontline-protection'],
  reasonIds: ['hoshino-veteran'],
  randomSkillRuleId: 'test:skill-rule:hoshino',
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
    locationIds: ['test:location:office'],
    initialLocationId: 'test:location:office',
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors: [
      { id: 'test:actor:student-slot', type: 'student', hp: { initial: 4, min: 0, max: 4 } },
      { id: 'test:actor:opponent', type: 'opponent', hp: { initial: 5, min: 0, max: 5 } },
    ],
    playerRouteState: { playerCost: 0, cards: { drawPile: [], hand: [], discard: [], played: [] } },
  };
}

function actionDefinitions(): OperationActionDef[] {
  return [
    { id: 'observe', allowedParticipantKinds: ['student'], requiredCapabilityIds: [], reasonIds: ['observe-reason'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'protect', allowedParticipantKinds: ['student'], requiredCapabilityIds: ['frontline-protection'], reasonIds: ['protect-reason'], tagIds: [], target: { kind: 'none' }, effects: [] },
  ];
}

function studentSkillRules(): OperationStudentSkillRuleDef[] {
  return [{ id: 'test:skill-rule:hoshino', triggerActionIds: ['protect'], chanceBps: 2500, effects: [] }];
}

function content(changes: Partial<OperationResolvedContent> = {}): OperationResolvedContent {
  return {
    eventDefinition: eventDef(),
    participants: [
      { actorId: 'test:actor:student-slot', kind: 'student' },
      { actorId: 'test:actor:opponent', kind: 'opponent', factionId: 'test:faction:enemy' },
    ],
    studentProfiles: [HOSHINO_PROFILE],
    actionDefinitions: actionDefinitions(),
    studentSkillRules: studentSkillRules(),
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
          { actorId: 'test:actor:opponent', kind: 'opponent' },
        ] }),
        message: /references missing Profile/,
      },
      {
        source: content({
          participants: [
            { actorId: 'test:actor:student-slot', kind: 'student', profileId: SERIKA_PROFILE.id },
            { actorId: 'test:actor:opponent', kind: 'opponent' },
          ],
          studentProfiles: [SERIKA_PROFILE],
        }),
        message: /Character mismatch/,
      },
      { source: content({ studentProfiles: [HOSHINO_PROFILE, HOSHINO_PROFILE] }), message: /duplicate profile ID/ },
      {
        source: content({ participants: [
          { actorId: 'test:actor:student-slot', kind: 'student' },
          { actorId: 'test:actor:student-slot', kind: 'opponent' },
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
          eventDefinition: {
            ...eventDef(),
            locationTactics: [{ locationId: 'test:location:office', enabledActionIds: ['missing'], combinationRules: [] }],
          },
        }),
        message: /enabledActionIds references a missing Action/,
      },
      {
        source: content({
          eventDefinition: {
            ...eventDef(),
            locationTactics: [{
              locationId: 'test:location:office',
              enabledActionIds: ['observe'],
              combinationRules: [{ id: 'combo', priority: 1, inputTagIds: ['missing:a', 'missing:b'], targetMatch: 'no-target', effects: [] }],
            }],
          },
        }),
        message: /does not match an enabled student Action tag/,
      },
      {
        source: content({
          actionDefinitions: baseActions.map((action, index) => ({ ...action, tagIds: [index === 0 ? 'slot:a' : 'slot:b'] })),
          eventDefinition: {
            ...eventDef(),
            locationTactics: [{
              locationId: 'test:location:office', enabledActionIds: ['observe', 'protect'],
              combinationRules: [{ id: 'same-target', priority: 1, inputTagIds: ['slot:a', 'slot:b'], targetMatch: 'same-target', effects: [] }],
            }],
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
            locationTactics: [{
              locationId: 'test:location:office', enabledActionIds: ['observe', 'protect'],
              combinationRules: [{ id: 'no-target', priority: 1, inputTagIds: ['slot:a', 'slot:b'], targetMatch: 'no-target', effects: [] }],
            }],
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

  test('non-student participants need no Character, Variant, or Profile', () => {
    const game = createGame();
    const npcEvent = eventDef('test:operation:npc-only');
    const npcContent = content({
      eventDefinition: { ...npcEvent, actors: [npcEvent.actors[1]] },
      participants: [{ actorId: 'test:actor:opponent', kind: 'environment', factionId: 'test:faction:park' }],
      studentProfiles: [],
    });
    const entry = makeEntry(game, new OperationRuntimeService(), {
      resolve: eventId => eventId === npcEvent.id ? npcContent : null,
    });

    expect(entry.facade.start(npcEvent.id, []).eventId).toBe(npcEvent.id);
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
