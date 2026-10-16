import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { SCENE_OFFER_PURCHASE_DEMO_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/scene-offer-purchase-demo';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import type { OperationSceneActionBatchCommand } from '../../src/arona-clicker/contracts/operation-scene-action';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { Character } from '../../src/arona-clicker/types/ids';

describe('Gameplay B Scene M-of-N and temporary purchase sample', () => {
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

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('requires exact N in Scene A unless the player explicitly skips; fixed actions stay outside N', () => {
    const game = createGame();
    const started = game.operationEntry.start(IDS.event, [Character.Hoshino]);
    const runId = started.runId;
    const initial = game.operationEntry.getView(runId)!;
    expect(initial).toMatchObject({
      currentSceneId: IDS.choiceScene,
      currentSceneActionChoice: { candidateSceneActionIds: [IDS.choiceA, IDS.choiceB, IDS.choiceC, IDS.choiceD], chooseExactly: 2 },
      currentScenePurchaseOffers: [],
      playerCost: 11,
    });

    const beforeInvalid = game.operationEntry.getSnapshot()!;
    const underSelected = batch(runId, initial.planVersion, [IDS.choiceA]);
    expect(() => game.operationEntry.previewSceneActionBatch(underSelected)).toThrow(/exactly 2 of 4/);
    expect(() => game.operationEntry.commitSceneActionBatch(underSelected)).toThrow(/exactly 2 of 4/);
    expect(game.operationEntry.getSnapshot()).toEqual(beforeInvalid);

    const skipped = game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: initial.planVersion,
      selections: [],
      cards: [],
      purchases: [],
      skip: true,
    });
    expect(skipped.sceneBatch).toMatchObject({ skip: true, playerCostPaid: 0 });
    expect(skipped.sceneBatch?.selections.map(selection => selection.sceneActionId)).toContain(IDS.fixedBriefing);
    expect(game.operationEntry.getView(runId)).toMatchObject({
      currentLocationId: IDS.location,
      currentSceneId: IDS.choiceScene,
      playerCost: 11,
      knownFactIds: [],
      heldItemIds: [],
      locationProgress: { [IDS.location]: { completed: false, completedSceneIds: [], sceneActionBatchesUsedByScene: { [IDS.choiceScene]: 1 } } },
    });

    const afterSkip = game.operationEntry.getSnapshot()!;
    expect(afterSkip.eventState.tracks[IDS.track]).toBe(1); // only the fixed action ran
    const ordinaryEmptyBatch = { runId, planVersion: afterSkip.planVersion, selections: [], cards: [] };
    expect(() => game.operationEntry.previewSceneActionBatch(ordinaryEmptyBatch)).toThrow(/exactly 2 of 4/);
    expect(game.operationEntry.getSnapshot()).toEqual(afterSkip);
  });

  test('keeps M/N and purchase offers in separate ordered Scenes, then buys both offers atomically in the Purchase Scene', () => {
    const source = createGame();
    const started = source.operationEntry.start(IDS.event, [Character.Hoshino]);
    const runId = started.runId;
    const choiceView = source.operationEntry.getView(runId)!;
    const choiceCommand = batch(runId, choiceView.planVersion, [IDS.choiceA, IDS.choiceB]);
    const beforeChoicePreview = source.operationEntry.getSnapshot()!;
    const choicePreview = source.operationEntry.previewSceneActionBatch(choiceCommand);
    expect(choicePreview.cost).toEqual({ balanceBefore: 11, totalCost: 2, balanceAfter: 9 });
    expect(source.operationEntry.getSnapshot()).toEqual(beforeChoicePreview);

    const choiceResolution = source.operationEntry.commitSceneActionBatch(choiceCommand);
    expect(choiceResolution.sceneBatch?.selections.map(selection => selection.sceneActionId)).toEqual([
      IDS.choiceA, IDS.choiceB, IDS.fixedBriefing,
    ]);
    expect(source.operationEntry.getView(runId)).toMatchObject({
      currentSceneId: IDS.purchaseScene,
      currentSceneActionChoice: null,
      currentScenePurchaseOffers: [
        { id: IDS.waterOffer, playerCost: 2, purchased: false, rewardPreview: ['补给一箱饮水，并提升现场准备度。'] },
        { id: IDS.medkitOffer, playerCost: 3, purchased: false, rewardPreview: ['补给医疗包，并提升现场准备度。'] },
      ],
      playerCost: 9,
      locationProgress: { [IDS.location]: { completed: false, completedSceneIds: [IDS.choiceScene] } },
    });
    expect(choiceResolution.sceneId).toBe(IDS.choiceScene);

    const purchaseView = source.operationEntry.getView(runId)!;
    const purchaseCommand = batch(runId, purchaseView.planVersion, [], [IDS.waterOffer, IDS.medkitOffer]);
    const beforePurchasePreview = source.operationEntry.getSnapshot()!;
    const purchasePreview = source.operationEntry.previewSceneActionBatch(purchaseCommand);
    expect(purchasePreview).toMatchObject({
      purchases: [
        { offerId: IDS.waterOffer, actionId: IDS.purchaseWaterAction, playerCost: 2, purchaseFactId: IDS.waterFact },
        { offerId: IDS.medkitOffer, actionId: IDS.purchaseMedkitAction, playerCost: 3, purchaseFactId: IDS.medkitFact },
      ],
      cost: { balanceBefore: 9, totalCost: 5, balanceAfter: 4 },
    });
    expect(source.operationEntry.getSnapshot()).toEqual(beforePurchasePreview);

    const purchaseResolution = source.operationEntry.commitSceneActionBatch(purchaseCommand);
    expect(purchaseResolution.sceneId).toBe(IDS.purchaseScene);
    expect(purchaseResolution.sceneBatch?.purchases).toEqual([
      { offerId: IDS.waterOffer, actionId: IDS.purchaseWaterAction, playerCost: 2, purchaseFactId: IDS.waterFact },
      { offerId: IDS.medkitOffer, actionId: IDS.purchaseMedkitAction, playerCost: 3, purchaseFactId: IDS.medkitFact },
    ]);
    expect(purchaseResolution.sceneBatch?.playerCostPaid).toBe(5);
    expect(source.operationEntry.getSnapshot()).toMatchObject({
      eventState: { knownFactIds: [IDS.waterFact, IDS.medkitFact], heldItemIds: [IDS.waterItem, IDS.medkitItem], tracks: { [IDS.track]: 7 } },
      playerRouteState: { playerCost: 4 },
      locationProgress: {
        [IDS.location]: {
          completed: false,
          completedSceneIds: [IDS.choiceScene],
          sceneActionBatchesUsedByScene: { [IDS.choiceScene]: 1, [IDS.purchaseScene]: 1 },
        },
      },
    });

    const afterPurchase = source.operationEntry.getSnapshot()!;
    const repeatedResolution = source.operationEntry.commitSceneActionBatch(purchaseCommand);
    expect(repeatedResolution).toEqual(purchaseResolution);
    expect(source.operationEntry.getSnapshot()).toEqual(afterPurchase);
    expect(source.operationEntry.getView(runId)?.currentScenePurchaseOffers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: IDS.waterOffer, purchased: true, unavailableReason: '已购买，本次 Run 仅可购买一次' }),
      expect.objectContaining({ id: IDS.medkitOffer, purchased: true, unavailableReason: '已购买，本次 Run 仅可购买一次' }),
    ]));

    const saved = source.save();
    const resumed = createGame();
    resumed.load(saved);
    expect(resumed.operationEntry.getLastRestoreResult()).toMatchObject({ status: 'restored', eventId: IDS.event, runId });
    const resumedView = resumed.operationEntry.getView(runId)!;
    expect(resumedView).toMatchObject({ currentSceneId: IDS.purchaseScene, knownFactIds: [IDS.waterFact, IDS.medkitFact] });
    expect(resumedView.currentScenePurchaseOffers.every(offer => offer.purchased)).toBe(true);

    const removeWaterCommand = batch(runId, resumedView.planVersion, [IDS.removeSpentWater]);
    const removeWaterResolution = resumed.operationEntry.commitSceneActionBatch(removeWaterCommand);
    expect(removeWaterResolution.sceneBatch?.selections.map(selection => selection.sceneActionId)).toEqual([IDS.removeSpentWater]);
    const afterWaterRemoval = resumed.operationEntry.getSnapshot()!;
    expect(afterWaterRemoval.eventState.knownFactIds).toContain(IDS.waterFact);
    expect(afterWaterRemoval.eventState.heldItemIds).not.toContain(IDS.waterItem);
    expect(afterWaterRemoval.locationProgress[IDS.location]).toMatchObject({ completed: false, completedSceneIds: [IDS.choiceScene] });

    const duplicate = batch(runId, resumed.operationEntry.getView(runId)!.planVersion, [], [IDS.waterOffer]);
    expect(() => resumed.operationEntry.previewSceneActionBatch(duplicate)).toThrow(/already purchased in this Run/);
    expect(() => resumed.operationEntry.commitSceneActionBatch(duplicate)).toThrow(/already purchased in this Run/);
    expect(resumed.operationEntry.getSnapshot()).toEqual(afterWaterRemoval);

    const finalView = resumed.operationEntry.getView(runId)!;
    const finalResolution = resumed.operationEntry.commitSceneActionBatch(batch(runId, finalView.planVersion, [IDS.finalInventoryCheck]));
    expect(finalResolution.sceneId).toBe(IDS.purchaseScene);
    const completedLocation = resumed.operationEntry.getSnapshot()!;
    resumed.operationEntry.transitionRoute({ runId, planVersion: completedLocation.planVersion, routeId: IDS.route });
    expect(resumed.operationEntry.getView(runId)).toMatchObject({
      currentLocationId: IDS.exitLocation,
      playerCost: 4,
      heldItemIds: [IDS.medkitItem],
      knownFactIds: [IDS.waterFact, IDS.medkitFact],
      locationProgress: { [IDS.location]: { completed: true, result: 'success', completedSceneIds: [IDS.choiceScene, IDS.purchaseScene] } },
      routeHistory: [{ fromLocationId: IDS.location, toLocationId: IDS.exitLocation, routeId: IDS.route }],
    });
  });
});
