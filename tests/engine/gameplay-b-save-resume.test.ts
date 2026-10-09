import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { Character } from '../../src/arona-clicker/types/ids';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';

const STUDENTS = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const VARIANTS: Record<typeof STUDENTS[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};
const DATAPACKS = [defaultDatapack, gameplayBCarouselDatapack];

function enterConcourse(game: GameInstance, runId: string) {
  let run = game.operationEntry.getSnapshot()!;
  game.operationEntry.reviseIntervention({
    runId,
    planVersion: run.planVersion,
    draft: { actorId: IDS.actors.hoshino, actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop },
  });
  run = game.operationEntry.getSnapshot()!;
  game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });
  const atConcourse = game.operationEntry.getSnapshot()!;
  expect(atConcourse.currentLocationId).toBe(IDS.locations.concourse);
  return atConcourse;
}

describe('Gameplay B Save/Resume', () => {
  const games: GameInstance[] = [];
  const createGame = (): GameInstance => {
    const game = createAppRuntime();
    game.init(DATAPACKS, { enterDefaultInit: true });
    games.push(game);
    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    for (const student of STUDENTS) game.mutations.acquireCharacter(VARIANTS[student], 'story');
    return game;
  };

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('round-trips a staged Individual batch without spending Cost or losing its fee snapshot', () => {
    const source = createGame();
    const runId = source.operationEntry.start(IDS.event, STUDENTS).runId;
    const beforeStage = enterConcourse(source, runId);
    const staged = source.operationEntry.stageSceneActionBatch({
      runId,
      planVersion: beforeStage.planVersion,
      selections: [
        { sceneActionId: IDS.sceneActions.inspect, actorId: IDS.actors.hoshino, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.serika, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.shiroko, targetActorIds: [] },
      ],
    });
    expect(staged.pendingSceneActionBatch?.preview.cost).toEqual({ balanceBefore: 5, totalCost: 3, balanceAfter: 2 });
    expect(staged.playerRouteState).toEqual(beforeStage.playerRouteState);
    expect(staged.random).toEqual(beforeStage.random);

    const save = source.save();
    expect(save.operationRun).toMatchObject({ eventId: IDS.event, resumeVersion: 3, run: staged });

    const resumed = createGame();
    resumed.load(save);
    expect(resumed.operationEntry.getLastRestoreResult()).toEqual({ status: 'restored', eventId: IDS.event, runId });
    expect(resumed.operationEntry.getSnapshot()).toEqual(staged);

    const command = { runId, planVersion: staged.planVersion };
    expect(resumed.operationEntry.commitStagedSceneActionBatch(command))
      .toEqual(source.operationEntry.commitStagedSceneActionBatch(command));
    expect(resumed.operationEntry.getSnapshot()).toEqual(source.operationEntry.getSnapshot());
  });

  test('rejects a pre-Scene-identity checkpoint version without migrating its Resolution history', () => {
    const game = createGame();
    const runId = game.operationEntry.start(IDS.event, STUDENTS).runId;
    const run = game.operationEntry.getSnapshot()!;
    game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });
    const currentSave = game.save();
    const operationRun = currentSave.operationRun!;
    const legacyRun = {
      ...operationRun.run,
      resolutions: operationRun.run.resolutions.map(({ sceneId: _sceneId, ...resolution }) => resolution),
    };

    game.load({
      ...currentSave,
      operationRun: { ...operationRun, resumeVersion: 2, run: legacyRun },
    });

    expect(game.operationEntry.getLastRestoreResult()).toMatchObject({
      status: 'rejected',
      eventId: IDS.event,
      reason: 'content-version-mismatch',
    });
    expect(game.operationEntry.getSnapshot()).toBeNull();
  });

  test('restores Location Cost history, physical deck order, independent Hand draws and the terminal EventResult', () => {
    const source = createGame();
    const runId = source.operationEntry.start(IDS.event, STUDENTS).runId;
    let run = enterConcourse(source, runId);
    source.operationEntry.stageSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [
        { sceneActionId: IDS.sceneActions.inspect, actorId: IDS.actors.hoshino, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.serika, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.shiroko, targetActorIds: [] },
      ],
    });
    const staged = source.operationEntry.getSnapshot()!;
    source.operationEntry.commitStagedSceneActionBatch({ runId, planVersion: staged.planVersion });
    run = source.operationEntry.getSnapshot()!;
    expect(source.operationEntry.getView(runId)?.currentRoutes.map(route => route.routeId)).toContain(IDS.routes.staffGate);
    source.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: IDS.routes.staffGate });
    const atExit = source.operationEntry.getSnapshot()!;
    expect(atExit).toMatchObject({
      currentLocationId: IDS.locations.exit,
      playerRouteState: { playerCost: 3 },
      locationEntryCostHistory: [
        { visitSequence: 1, locationId: IDS.locations.platform, costGain: 2, balanceBefore: 3, balanceAfter: 5 },
        { visitSequence: 2, locationId: IDS.locations.concourse, costGain: 2, balanceBefore: 3, balanceAfter: 5 },
        { visitSequence: 3, locationId: IDS.locations.exit, costGain: 1, balanceBefore: 2, balanceAfter: 3 },
      ],
      random: { tacticalCursor: 1 },
    });
    const afterRouteSave = source.save();

    const resumed = createGame();
    resumed.load(afterRouteSave);
    expect(resumed.operationEntry.getLastRestoreResult()?.status).toBe('restored');
    expect(resumed.operationEntry.getSnapshot()).toEqual(atExit);
    expect(resumed.operationEntry.getView(runId)).toEqual(source.operationEntry.getView(runId));

    const cardId = atExit.playerRouteState.cards.hand[0];
    const commit = (game: GameInstance) => game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: game.operationEntry.getSnapshot()!.planVersion,
      selections: [{
        sceneActionId: IDS.sceneActions.firstAid,
        actorId: IDS.actors.hoshino,
        targetActorIds: [IDS.actors.hoshino, IDS.actors.serika, IDS.actors.shiroko],
      }],
      cards: [{
        cardInstanceId: cardId,
        actorId: IDS.actors.serika,
        targetActorIds: [IDS.actors.hoshino, IDS.actors.serika, IDS.actors.shiroko],
      }],
    });
    expect(commit(resumed)).toEqual(commit(source));
    expect(resumed.operationEntry.getSnapshot()).toEqual(source.operationEntry.getSnapshot());

    run = source.operationEntry.getSnapshot()!;
    expect(run.status).toBe('success');
    const terminalSave = source.save();
    expect(terminalSave.operationRun?.result?.kind).toBe('success');

    const terminal = createGame();
    terminal.load(terminalSave);
    expect(terminal.operationEntry.getLastRestoreResult()?.status).toBe('restored');
    expect(terminal.operationEntry.getSnapshot()).toEqual(source.operationEntry.getSnapshot());
    expect(terminal.operationEntry.getResult()).toEqual(source.operationEntry.getResult());
  });

  test('rejects changed Event versions and corrupted state without leaving a previous Run installed', () => {
    const source = createGame();
    source.operationEntry.start(IDS.event, STUDENTS);
    const save = source.save();
    const savedRun = save.operationRun!;

    const resumed = createGame();
    resumed.operationEntry.start(IDS.event, STUDENTS);
    resumed.load({ ...save, operationRun: { ...savedRun, resumeVersion: savedRun.resumeVersion + 1 } });
    expect(resumed.operationEntry.getLastRestoreResult()).toMatchObject({
      status: 'rejected',
      eventId: IDS.event,
      reason: 'content-version-mismatch',
    });
    expect(resumed.operationEntry.getSnapshot()).toBeNull();

    const unknownEventId = 'demo:operation-event:missing';
    const unknownEvent = createGame();
    unknownEvent.load({
      ...save,
      operationRun: { ...savedRun, eventId: unknownEventId, run: { ...savedRun.run, eventId: unknownEventId } },
    });
    expect(unknownEvent.operationEntry.getLastRestoreResult()).toMatchObject({ status: 'rejected', eventId: unknownEventId, reason: 'unknown-event' });
    expect(unknownEvent.operationEntry.getSnapshot()).toBeNull();

    const missingCharacterId = 'base:character:not-in-current-content';
    const missingCharacter = createGame();
    missingCharacter.load({
      ...save,
      operationRun: {
        ...savedRun,
        run: {
          ...savedRun.run,
          actorStates: savedRun.run.actorStates.map(actor => actor.participantKind === 'student'
            ? { ...actor, characterId: missingCharacterId }
            : actor),
        },
      },
    });
    expect(missingCharacter.operationEntry.getLastRestoreResult()).toMatchObject({ status: 'rejected', reason: 'character-missing' });
    expect(missingCharacter.operationEntry.getSnapshot()).toBeNull();

    const corrupted = createGame();
    corrupted.load({
      ...save,
      operationRun: {
        ...savedRun,
        run: { ...savedRun.run, playerRouteState: { ...savedRun.run.playerRouteState, playerCost: -1 } },
      },
    });
    expect(corrupted.operationEntry.getLastRestoreResult()).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(corrupted.operationEntry.getSnapshot()).toBeNull();
  });
});
