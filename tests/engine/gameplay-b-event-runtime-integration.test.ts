import { afterEach, describe, expect, test } from 'vitest';
import { OPERATION_WAIT_ACTION_ID, type OperationEventDef } from '../../src/arona-clicker/contracts/operation';
import type { OperationContentResolver, OperationResolvedContent } from '../../src/arona-clicker/contracts/operation-content-resolver';
import type { StudentOperationProfileDef } from '../../src/arona-clicker/contracts/student-operation-profile';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation-action';
import type { OperationStudentSkillRuleDef } from '../../src/arona-clicker/contracts/operation-skill';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { OperationRuntimeError } from '../../src/arona-clicker/services/operation-runtime-service';
import { baseDatapack } from '../../src/data/test-datapack';

const EVENT_ID = 'test:operation:integration';
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
  candidateActionIds: ['observe', 'organize'],
  actionPriorityIds: ['organize', 'observe'],
  capabilityIds: ['resourcefulness'],
  reasonIds: ['serika-practical'],
};

function eventDef(): OperationEventDef {
  return {
    id: EVENT_ID,
    locationIds: ['test:location:office'],
    initialLocationId: 'test:location:office',
    tracks: [{ id: 'danger', initial: 1, min: 0, max: 5 }],
    factIds: ['door_open'],
    knownFactIds: [],
    itemIds: ['archive_key'],
    heldItemIds: [],
    actors: [
      { id: 'test:actor:student-slot', type: 'student', hp: { initial: 4, min: 0, max: 4 } },
      { id: 'test:actor:opponent', type: 'opponent', hp: { initial: 5, min: 0, max: 5 } },
    ],
    locationTactics: [{
      locationId: 'test:location:office',
      enabledActionIds: ['observe', 'protect', 'organize'],
      combinationRules: [],
    }],
    playerRouteState: {
      playerCost: 2,
      cards: { drawPile: ['test:card:inspect'], hand: [], discard: [], played: [] },
    },
    randomSeed: 17,
  };
}

function actionDefinitions(): OperationActionDef[] {
  return [
    { id: 'observe', allowedParticipantKinds: ['student'], requiredCapabilityIds: [], reasonIds: ['test:reason:observe'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'protect', allowedParticipantKinds: ['student'], requiredCapabilityIds: ['frontline-protection'], reasonIds: ['test:reason:protection'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'organize', allowedParticipantKinds: ['student'], requiredCapabilityIds: ['resourcefulness'], reasonIds: ['test:reason:organize'], tagIds: [], target: { kind: 'none' }, effects: [] },
  ];
}

function studentSkillRules(): OperationStudentSkillRuleDef[] {
  return [{ id: 'test:skill-rule:hoshino', triggerActionIds: ['protect'], chanceBps: 2000, effects: [] }];
}

function resolvedContent(changes: Partial<OperationResolvedContent> = {}): OperationResolvedContent {
  return {
    eventDefinition: eventDef(),
    participants: [
      { actorId: 'test:actor:student-slot', kind: 'student' },
      { actorId: 'test:actor:opponent', kind: 'opponent', factionId: 'test:faction:enemy', candidateActionIds: [] },
    ],
    studentProfiles: [HOSHINO_PROFILE, SERIKA_PROFILE],
    actionDefinitions: actionDefinitions(),
    studentSkillRules: studentSkillRules(),
    ...changes,
  };
}

function resolverOf(content: OperationResolvedContent | null = resolvedContent()): OperationContentResolver {
  return { resolve: eventId => eventId === EVENT_ID ? content : null };
}

function stateSnapshot(game: GameInstance): string {
  return JSON.stringify(game.state);
}

describe('Gameplay B Operation entry integration', () => {
  const games: GameInstance[] = [];

  function createGame(resolver: OperationContentResolver = resolverOf()): GameInstance {
    const game = new GameInstance({ operationContentResolver: resolver });
    games.push(game);
    game.init([baseDatapack], { enterDefaultInit: false });
    return game;
  }

  function ownHoshino(game: GameInstance): void {
    game.mutations.acquireCharacter('Hoshino', 'story');
  }

  afterEach(() => {
    for (const game of games.splice(0)) {
      if (game.running) game.stop();
    }
  });

  test('keeps EventRuns isolated per GameInstance and exposes only ID entry plus detached snapshots', () => {
    const first = createGame();
    const second = createGame();
    ownHoshino(first);
    ownHoshino(second);
    const firstState = stateSnapshot(first);
    const secondState = stateSnapshot(second);

    expect('operationRuntime' in first).toBe(false);
    expect(Object.keys(first.operationEntry).sort()).toEqual([
      'clearIntervention', 'commitBeat', 'getSnapshot', 'previewIntervention', 'reviseIntervention', 'start',
    ]);
    expect('reset' in first.operationEntry).toBe(false);
    expect('dispose' in first.operationEntry).toBe(false);

    const firstRun = first.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    const secondRun = second.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    expect(firstRun.runId).not.toBe(secondRun.runId);
    expect(firstRun.actorStates[0]).toMatchObject({
      participantKind: 'student',
      characterId: Character.Hoshino,
      profile: {
        id: HOSHINO_PROFILE.id,
        eligibleActionIds: ['protect', 'observe'],
      },
    });
    expect(firstRun.actorStates[1]).toMatchObject({
      participantKind: 'opponent',
      factionId: 'test:faction:enemy',
    });
    expect(first.operationEntry.getSnapshot()).toEqual(firstRun);
    expect(second.operationEntry.getSnapshot()).toEqual(secondRun);
    expect(Object.isFrozen(first.operationEntry.getSnapshot())).toBe(true);
    expect(first.operationEntry.getSnapshot()).not.toBe(first.operationEntry.getSnapshot());
    expect(stateSnapshot(first)).toBe(firstState);
    expect(stateSnapshot(second)).toBe(secondState);
    expect(firstRun).toMatchObject({
      planVersion: 0,
      beatIndex: 0,
      preparedBeat: { planVersion: 0 },
      interventionDraft: null,
      resolutions: [],
      resolutionSequence: 0,
      random: { seed: 17, tacticalCursor: 0 },
    });
    expect(firstRun.preparedBeat?.actorPlans.find(plan => plan.actorId === 'test:actor:student-slot'))
      .toMatchObject({ kind: 'studentAction', actionId: 'protect' });
  });

  test('previews, revises, clears, commits, and retries one versioned Beat through the narrow facade', () => {
    const game = createGame();
    ownHoshino(game);
    const initial = game.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    const startState = game.operationEntry.getSnapshot()!;
    const command = { runId: initial.runId, planVersion: initial.planVersion };
    const preview = game.operationEntry.previewIntervention({
      ...command,
      draft: { actorId: 'test:actor:student-slot', actionId: 'observe', reasonId: 'test:reason:observe' },
    });

    expect(preview.preparedBeat.actorPlans[0]).toMatchObject({ actionId: 'observe', kind: 'studentAction' });
    expect(game.operationEntry.getSnapshot()).toEqual(startState);
    expect(Object.isFrozen(preview)).toBe(true);
    expect(() => game.operationEntry.reviseIntervention({
      ...command,
      draft: { actorId: 'test:actor:opponent', actionId: 'observe' },
    })).toThrow(OperationRuntimeError);
    expect(game.operationEntry.getSnapshot()).toEqual(startState);

    const revised = game.operationEntry.reviseIntervention({
      ...command,
      draft: { actorId: 'test:actor:student-slot', actionId: 'observe', reasonId: 'test:reason:observe' },
    });
    expect(revised).toMatchObject({
      planVersion: 1,
      preparedBeat: { planVersion: 1 },
      interventionDraft: { actorId: 'test:actor:student-slot', actionId: 'observe' },
    });
    expect(revised.preparedBeat?.actorPlans.find(plan => plan.actorId === 'test:actor:student-slot'))
      .toMatchObject({ actionId: 'protect' });
    expect(() => game.operationEntry.commitBeat(command)).toThrow(/stale/);
    const cleared = game.operationEntry.clearIntervention({ runId: initial.runId, planVersion: 1 });
    expect(cleared).toMatchObject({ planVersion: 2, interventionDraft: null, preparedBeat: { planVersion: 2 } });
    expect(game.operationEntry.clearIntervention({ runId: initial.runId, planVersion: 2 })).toEqual(cleared);
    expect(() => game.operationEntry.previewIntervention({
      runId: initial.runId,
      planVersion: 2,
      draft: { actorId: 'test:actor:opponent', actionId: 'observe' },
    })).toThrow(OperationRuntimeError);
    expect(game.operationEntry.getSnapshot()).toEqual(cleared);

    const beforeCommit = game.operationEntry.getSnapshot()!;
    const resolution = game.operationEntry.commitBeat({ runId: initial.runId, planVersion: 2 });
    expect(resolution).toMatchObject({
      runId: initial.runId,
      basePlanVersion: 2,
      locationId: 'test:location:office',
      resolutionSequence: 1,
      studentSkillChecks: [{ actorId: 'test:actor:student-slot', skillRuleId: 'test:skill-rule:hoshino', actionId: 'protect' }],
    });
    expect(resolution.actorPlans.find(plan => plan.actorId === 'test:actor:student-slot')).toMatchObject({ actionId: 'protect' });
    expect(game.operationEntry.getSnapshot()).toMatchObject({
      planVersion: 3,
      beatIndex: 1,
      interventionDraft: null,
      resolutionSequence: 1,
      random: { tacticalCursor: 1 },
      resolutions: [resolution],
    });
    expect(game.operationEntry.getSnapshot()!.playerRouteState).toEqual(beforeCommit.playerRouteState);
    const afterCommit = game.operationEntry.getSnapshot();
    expect(game.operationEntry.commitBeat({ runId: initial.runId, planVersion: 2 })).toEqual(resolution);
    expect(game.operationEntry.getSnapshot()).toEqual(afterCommit);
    expect(Object.isFrozen(resolution)).toBe(true);
  });

  test('public GameInstance entry rejects an unowned student without creating a Run', () => {
    const game = createGame();

    expect(() => game.operationEntry.start(EVENT_ID, [Character.Hoshino])).toThrow(/no owned Registry Variant/);
    expect(game.operationEntry.getSnapshot()).toBeNull();

    ownHoshino(game);
    expect(game.operationEntry.start(EVENT_ID, [Character.Hoshino]).eventId).toBe(EVENT_ID);
    expect(game.operationEntry.getSnapshot()).not.toBeNull();
  });

  test('rejects the reserved Wait action as a Profile candidate before the owner creates a Run', () => {
    const waitProfile: StudentOperationProfileDef = {
      ...HOSHINO_PROFILE,
      candidateActionIds: [OPERATION_WAIT_ACTION_ID],
      actionPriorityIds: [OPERATION_WAIT_ACTION_ID],
    };
    const game = createGame(resolverOf(resolvedContent({ studentProfiles: [waitProfile] })));
    ownHoshino(game);

    expect(() => game.operationEntry.start(EVENT_ID, [Character.Hoshino]))
      .toThrow(/reserved Wait fallback action ID/);
    expect(game.operationEntry.getSnapshot()).toBeNull();
  });

  test('clears volatile Runs at init, reset, load, and reload while stop preserves a Run', () => {
    const game = createGame();
    ownHoshino(game);
    const startRun = () => game.operationEntry.start(EVENT_ID, [Character.Hoshino]);

    startRun();
    game.stop();
    expect(game.operationEntry.getSnapshot()).not.toBeNull();

    game.reset();
    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => startRun()).toThrow(/no owned Registry Variant/);
    ownHoshino(game);
    expect(() => startRun()).not.toThrow();

    const save = game.save();
    game.load(save);
    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => startRun()).not.toThrow();

    game.reload([baseDatapack], { enterDefaultInit: false });
    expect(game.operationEntry.getSnapshot()).toBeNull();
    ownHoshino(game);
    expect(() => startRun()).not.toThrow();

    game.init([], { enterDefaultInit: false });
    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => startRun()).toThrow(/unknown or invalid Character/);
  });

  test('dispose clears the Run and prevents later admission from writing', () => {
    const game = createGame();
    ownHoshino(game);
    game.operationEntry.start(EVENT_ID, [Character.Hoshino]);

    game.dispose();

    expect(game.running).toBe(false);
    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => game.operationEntry.start(EVENT_ID, [Character.Hoshino])).toThrow(/disposed/);
    expect(game.operationEntry.getSnapshot()).toBeNull();
  });

  test('custom no-op Wiring receives a closed entry facade, never the owner', () => {
    const game = new GameInstance({ wiring: () => undefined, operationContentResolver: resolverOf() });

    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => game.operationEntry.start(EVENT_ID, [Character.Hoshino])).toThrow(/services are not wired/);
    expect('operationRuntime' in game).toBe(false);
  });
});
