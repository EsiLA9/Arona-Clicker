import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import {
  SCENE_OFFER_PURCHASE_DEMO_IDS as IDS,
  sceneOfferPurchaseDemoActions,
  sceneOfferPurchaseDemoEvent,
  sceneOfferPurchaseDemoLocation,
} from '../../src/arona-clicker/content/operation-samples/scene-offer-purchase-demo';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import type { OperationSceneActionBatchCommand } from '../../src/arona-clicker/contracts/operation-scene-action';
import type { OperationEventDef } from '../../src/arona-clicker/contracts/operation';
import type { OperationActionProfileReference } from '../../src/arona-clicker/services/operation-action-content-validation';
import { validateOperationActionContent } from '../../src/arona-clicker/services/operation-action-content-validation';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { Character } from '../../src/arona-clicker/types/ids';

const CANDIDATE_IDS = [IDS.choiceA, IDS.choiceB, IDS.choiceC, IDS.choiceD] as const;

describe('Gameplay B PB-24 Planner and Runtime contracts', () => {
  const games: GameInstance[] = [];

  function createGame(): GameInstance {
    const game = createAppRuntime();
    games.push(game);
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    game.mutations.acquireCharacter('Hoshino', 'story');
    return game;
  }

  function batch(
    runId: string,
    planVersion: number,
    choiceIds: readonly string[],
    purchaseIds: readonly string[] = [],
  ): OperationSceneActionBatchCommand {
    return {
      runId,
      planVersion,
      selections: choiceIds.map(sceneActionId => ({ sceneActionId, targetActorIds: [] })),
      purchases: purchaseIds.map(offerId => ({ offerId })),
    };
  }

  function advanceToPurchaseScene(game: GameInstance, runId: string): void {
    const view = game.operationEntry.getView(runId)!;
    expect(view.currentSceneId).toBe(IDS.choiceScene);
    game.operationEntry.commitSceneActionBatch(batch(runId, view.planVersion, [IDS.choiceA, IDS.choiceB]));
    expect(game.operationEntry.getView(runId)?.currentSceneId).toBe(IDS.purchaseScene);
  }

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('Planner enforces exact N, rejects over-selection and duplicates, and includes fixed offers outside N', () => {
    const game = createGame();
    const runId = game.operationEntry.start(IDS.event, [Character.Hoshino]).runId;
    const initial = game.operationEntry.getView(runId)!;
    expect(initial.currentSceneId).toBe(IDS.choiceScene);
    const beforeInvalidRequests = game.operationEntry.getSnapshot()!;

    expect(() => game.operationEntry.previewSceneActionBatch(batch(runId, initial.planVersion, [IDS.choiceA])))
      .toThrow(/exactly 2 of 4/);
    const overSelected = batch(runId, initial.planVersion, CANDIDATE_IDS);
    expect(() => game.operationEntry.previewSceneActionBatch(overSelected)).toThrow(/exactly 2 of 4/);
    expect(() => game.operationEntry.commitSceneActionBatch(overSelected)).toThrow(/exactly 2 of 4/);
    const repeatedCandidate = batch(runId, initial.planVersion, [IDS.choiceA, IDS.choiceA]);
    expect(() => game.operationEntry.previewSceneActionBatch(repeatedCandidate)).toThrow(/only once per batch/);
    expect(() => game.operationEntry.commitSceneActionBatch(repeatedCandidate)).toThrow(/only once per batch/);
    expect(game.operationEntry.getSnapshot()).toEqual(beforeInvalidRequests);

    const valid = batch(runId, initial.planVersion, [IDS.choiceA, IDS.choiceB]);
    const preview = game.operationEntry.previewSceneActionBatch(valid);
    expect(preview.selections.filter(selection => CANDIDATE_IDS.includes(selection.sceneActionId as typeof CANDIDATE_IDS[number])))
      .toHaveLength(2);
    expect(preview.selections.map(selection => selection.sceneActionId)).toContain(IDS.fixedBriefing);
    expect(preview.cost).toEqual({ balanceBefore: initial.playerCost, totalCost: 2, balanceAfter: initial.playerCost - 2 });
    expect(game.operationEntry.getSnapshot()).toEqual(beforeInvalidRequests);

    const resolution = game.operationEntry.commitSceneActionBatch(valid);
    expect(resolution.sceneBatch?.selections.map(selection => selection.sceneActionId)).toEqual([
      IDS.choiceA,
      IDS.choiceB,
      IDS.fixedBriefing,
    ]);
    expect(resolution.sceneBatch).toMatchObject({
      playerCostBefore: initial.playerCost,
      playerCostPaid: 2,
      playerCostAfter: initial.playerCost - 2,
    });
    expect(game.operationEntry.getView(runId)).toMatchObject({
      currentSceneId: IDS.purchaseScene,
      playerCost: initial.playerCost - 2,
      tracks: { [IDS.track]: 4 },
      locationProgress: { [IDS.location]: { completed: false, completedSceneIds: [IDS.choiceScene] } },
    });
  });

  test('Runtime rejects stale versions without mutation and makes a same-command retry idempotent', () => {
    const game = createGame();
    const runId = game.operationEntry.start(IDS.event, [Character.Hoshino]).runId;
    const initial = game.operationEntry.getView(runId)!;
    const beforeStaleRequest = game.operationEntry.getSnapshot()!;
    const stale = batch(runId, initial.planVersion + 1, [IDS.choiceA, IDS.choiceB]);

    expect(() => game.operationEntry.previewSceneActionBatch(stale)).toThrow();
    expect(() => game.operationEntry.commitSceneActionBatch(stale)).toThrow();
    expect(game.operationEntry.getSnapshot()).toEqual(beforeStaleRequest);

    advanceToPurchaseScene(game, runId);
    const purchaseView = game.operationEntry.getView(runId)!;
    const purchase = batch(runId, purchaseView.planVersion, [], [IDS.waterOffer]);
    const firstResolution = game.operationEntry.commitSceneActionBatch(purchase);
    const afterFirstCommit = game.operationEntry.getSnapshot()!;
    const retriedResolution = game.operationEntry.commitSceneActionBatch(purchase);

    expect(retriedResolution).toEqual(firstResolution);
    expect(game.operationEntry.getSnapshot()).toEqual(afterFirstCommit);
    expect(game.operationEntry.getView(runId)).toMatchObject({
      currentSceneId: IDS.purchaseScene,
      playerCost: initial.playerCost - 4,
      knownFactIds: [IDS.waterFact],
      heldItemIds: [IDS.waterItem],
    });
  });

  test('Planner rejects a repeated purchase selection before charging or granting anything', () => {
    const game = createGame();
    const runId = game.operationEntry.start(IDS.event, [Character.Hoshino]).runId;
    advanceToPurchaseScene(game, runId);
    const purchaseView = game.operationEntry.getView(runId)!;
    const before = game.operationEntry.getSnapshot()!;
    const duplicatePurchase = batch(runId, purchaseView.planVersion, [], [IDS.waterOffer, IDS.waterOffer]);

    expect(() => game.operationEntry.previewSceneActionBatch(duplicatePurchase)).toThrow(/unavailable or repeated/);
    expect(() => game.operationEntry.commitSceneActionBatch(duplicatePurchase)).toThrow(/unavailable or repeated/);
    expect(game.operationEntry.getSnapshot()).toEqual(before);
  });

  test.each([
    ['Action', 'action', 'reveal'],
    ['Action', 'action', 'forget'],
    ['StudentSkillRule', 'skill', 'reveal'],
    ['StudentSkillRule', 'skill', 'forget'],
    ['Combination', 'combination', 'reveal'],
    ['Combination', 'combination', 'forget'],
  ] as const)('%s source (%s) cannot write a reserved purchase marker with op=%s', (_label, source, op) => {
    const event: OperationEventDef = {
      ...sceneOfferPurchaseDemoEvent,
      locations: [sceneOfferPurchaseDemoLocation],
    };
    const profiles: OperationActionProfileReference[] = [{
      id: 'test-profile',
      candidateActionIds: sceneOfferPurchaseDemoActions.map(action => action.id),
      capabilityIds: [],
    }];
    const markerEffect = { kind: 'eventFact' as const, factId: IDS.waterFact, op };

    const actions = source === 'action'
      ? sceneOfferPurchaseDemoActions.map(action => action.id === IDS.choiceActionA
        ? { ...action, effects: [markerEffect] }
        : action)
      : sceneOfferPurchaseDemoActions;
    const skillRules = source === 'skill'
      ? [{ id: 'marker-skill', triggerActionIds: [IDS.choiceActionA], chanceBps: 5000, effects: [markerEffect] }]
      : [];
    const validationEvent: OperationEventDef = source === 'combination'
      ? {
        ...event,
        locations: event.locations.map((location, index) => index === 0
          ? {
            ...location,
            combinationRules: [{
              id: 'marker-combination',
              priority: 1,
              inputTagIds: ['first', 'second'],
              targetMatch: 'no-target',
              effects: [markerEffect],
            }],
          }
          : location),
      }
      : event;

    const result = validateOperationActionContent(validationEvent, actions, skillRules, profiles);
    expect(result.issues.join('\n')).toContain(source === 'action'
      ? 'actionDefinitions[0].effects[0] must not modify a reserved PurchaseOffer marker fact'
      : source === 'skill'
        ? 'studentSkillRules[0].effects[0] must not modify a reserved PurchaseOffer marker fact'
        : 'locations[0].combinationRules[0].effects[0] must not modify a reserved PurchaseOffer marker fact');
  });
});
