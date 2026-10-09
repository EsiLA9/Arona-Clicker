// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { SCENE_OFFER_PURCHASE_DEMO_IDS as OFFER_DEMO_IDS } from '../../src/arona-clicker/content/operation-samples/scene-offer-purchase-demo';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { gameplayBStrategyParkDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park';
import { GAMEPLAY_B_STRATEGY_PARK_IDS as PARK_IDS } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { OperationView, OperationViewSceneAction } from '../../src/arona-clicker/contracts/operation-view';
import { UIController } from '../../src/ui/controller';
import { readOperationSceneBatchCommand, saveSceneDraftFromWorkspace, targetsAfterPerformerChange } from '../../src/ui/controller-actions-operation';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { projectOperationActorHand, readOperationSceneDraft, renderOperationWorkspace, saveOperationSceneDraft } from '../../src/ui/components/operation-workspace';
import { createUIContext } from '../../src/ui/context';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const VARIANTS = ['Hoshino', 'Serika', 'Shiroko'] as const;

function pointer(type: string, x: number, y: number, pointerId = 17): PointerEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { configurable: true, value: pointerId });
  return event as PointerEvent;
}

function dragSceneActionToStudent(root: HTMLElement, face: HTMLButtonElement, actorId: string, pointerId: number): void {
  const actor = root.querySelector<HTMLElement>('[data-operation-student="' + actorId + '"]');
  if (!actor) throw new Error('Expected a student card to receive the scene action.');
  const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => actor });
  try {
    face.dispatchEvent(pointer('pointerdown', 2, 2, pointerId));
    root.dispatchEvent(pointer('pointermove', 18, 18, pointerId));
    root.dispatchEvent(pointer('pointerup', 18, 18, pointerId));
  } finally {
    if (originalElementFromPoint) Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
    else Reflect.deleteProperty(document, 'elementFromPoint');
  }
}

function dragCardToActorTarget(root: HTMLElement, face: HTMLButtonElement, targetActorId: string, pointerId: number): void {
  const target = root.querySelector<HTMLElement>('[data-operation-actor-target="' + targetActorId + '"]');
  if (!target) throw new Error('Expected an actor card to receive the action target.');
  const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target });
  try {
    face.dispatchEvent(pointer('pointerdown', 2, 2, pointerId));
    root.dispatchEvent(pointer('pointermove', 18, 18, pointerId));
    face.dispatchEvent(pointer('pointerup', 18, 18, pointerId));
  } finally {
    if (originalElementFromPoint) Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
    else Reflect.deleteProperty(document, 'elementFromPoint');
  }
}

const dragPlayerCardToStudent = dragSceneActionToStudent;

describe('Gameplay B Operation Controller', () => {
  let game: GameInstance;
  let controller: UIController;
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
  });

  afterEach(() => {
    controller.destroy();
    if (game.running) game.stop();
    localStorage.clear();
  });

  function acquireStudents(): void {
    for (const variantId of VARIANTS) game.mutations.acquireCharacter(variantId, 'story');
    controller.render();
  }

  function startFromFeed(): void {
    root.querySelector<HTMLButtonElement>('[data-operation-start]')!.click();
    expect(controller.panelState.workspace?.type).toBe('operation');
  }

  function selectActionIfNotCurrent(actionId: string): void {
    const option = root.querySelector<HTMLButtonElement>(
      '[data-operation-action][data-action-id="' + actionId + '"]',
    );
    if (option && option.getAttribute('aria-pressed') !== 'true' && !option.disabled) option.click();
  }

  function selectSceneAction(actorId: string, sceneActionId: string): void {
    const face = root.querySelector<HTMLButtonElement>(`[data-operation-scene-card][data-actor-id="${actorId}"] [data-operation-scene-choice][data-scene-action-id="${sceneActionId}"]`);
    expect(face).not.toBeNull();
    if (face!.getAttribute('aria-pressed') !== 'true') face!.click();
  }

  function enterCarouselExit(): string {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    selectActionIfNotCurrent(CAROUSEL_SAFETY_IDS.actions.emergencyStop);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    selectSceneAction(IDS.actors.hoshino, IDS.sceneActions.inspect);
    selectSceneAction(IDS.actors.serika, IDS.sceneActions.guide);
    selectSceneAction(IDS.actors.shiroko, IDS.sceneActions.guide);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + IDS.routes.staffGate + '"]')!.click();
    expect(game.operationEntry.getView(runId)?.currentLocationId).toBe(IDS.locations.exit);
    return runId;
  }

  function installTargetableAlternative(): {
    currentFace: HTMLButtonElement;
    alternative: HTMLButtonElement;
    targetTray: HTMLDivElement | null;
    targetChoice: HTMLButtonElement | null;
    targetId: string;
    actionId: string;
  } {
    const actorId = CAROUSEL_SAFETY_IDS.actors.hoshino;
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const initialView = game.operationEntry.getView(runId)!;
    const actionId = CAROUSEL_SAFETY_IDS.actions.brace;
    // Move the current plan to its targetless legal alternative so Brace is a
    // distinct target-required alternative with a renderer-owned default marker.
    game.operationEntry.reviseIntervention({
      runId,
      planVersion: initialView.planVersion,
      draft: { actorId, actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop },
    });
    controller.render();
    const currentFace = root.querySelector<HTMLButtonElement>(
      '[data-operation-action-current][data-actor-id="' + actorId + '"][aria-pressed="true"]',
    )!;
    const alternative = root.querySelector<HTMLButtonElement>(
      '[data-operation-action-alternative][data-actor-id="' + actorId + '"][data-action-id="' + actionId + '"]',
    )!;
    const layer = alternative.closest<HTMLElement>('[data-operation-prepared-card-layer]')!;
    const targetId = CAROUSEL_SAFETY_IDS.actors.ride;
    return { currentFace, alternative, targetTray: null, targetChoice: null, targetId, actionId };
  }

  it('入口只在夏莱办公室出现；准入状态说明缺失角色且不补发角色', () => {
    expect(root.querySelector('[data-operation-start]')).not.toBeNull();
    game.inits.enterInit(MILLENNIUM);
    controller.render();
    expect(root.querySelector('[data-operation-start]')).toBeNull();

    game.inits.enterInit(OFFICE);
    controller.render();
    const start = root.querySelector<HTMLButtonElement>('[data-operation-start]')!;
    expect(start).not.toBeNull();
    expect(start.disabled).toBe(true);
    expect(root.querySelector('.operation-admission-reason')?.textContent).toContain('缺少持有且已解锁的固定队员');
    const before = controller.getRefreshStats();

    expect(controller.panelState.workspace).toBeUndefined();
    expect(game.operationEntry.getView()).toBeNull();
    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
  });

  it('shows the exact M-of-N counter and purchase preview; one batch applies both purchases', () => {
    acquireStudents();
    const start = root.querySelector<HTMLButtonElement>('[data-operation-start="' + OFFER_DEMO_IDS.event + '"]')!;
    expect(start.disabled).toBe(false);
    start.click();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    expect(runId).not.toBe('');
    expect(root.querySelector('[data-operation-choice-group]')?.textContent).toContain('恰好选择 2 项');
    expect(root.querySelector('[data-scene-choice-count]')?.textContent).toContain('0 / 2');
    expect(root.querySelector('[data-operation-cost-preview]')?.textContent).toContain('恰好选择 2 项');
    const choiceFaces = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-choice-group-card] [data-operation-scene-choice]')];
    expect(choiceFaces.map(face => face.dataset.sceneActionId)).toEqual([
      OFFER_DEMO_IDS.choiceA,
      OFFER_DEMO_IDS.choiceB,
      OFFER_DEMO_IDS.choiceC,
      OFFER_DEMO_IDS.choiceD,
    ]);
    expect(choiceFaces.every(face => !face.closest<HTMLElement>('[data-operation-scene-option]')?.hidden)).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + OFFER_DEMO_IDS.choiceA + '"]')!.click();
    expect(root.querySelector('[data-scene-choice-count]')?.textContent).toContain('1 / 2');
    expect(root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')?.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + OFFER_DEMO_IDS.choiceB + '"]')!.click();
    expect(root.querySelector('[data-scene-choice-count]')?.textContent).toContain('2 / 2');
    expect(root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')?.disabled).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + OFFER_DEMO_IDS.choiceB + '"]')!.click();
    expect(root.querySelector('[data-scene-choice-count]')?.textContent).toContain('1 / 2');
    expect(root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')?.disabled).toBe(true);
    expect(game.operationEntry.getView(runId)).toMatchObject({ playerCost: 11, tracks: { [OFFER_DEMO_IDS.track]: 0 }, resolutions: [] });
    root.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + OFFER_DEMO_IDS.choiceC + '"]')!.click();
    expect(root.querySelector('[data-scene-choice-count]')?.textContent).toContain('2 / 2');
    expect(root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')?.disabled).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();

    expect(game.operationEntry.getView(runId)?.currentSceneId).toBe(OFFER_DEMO_IDS.purchaseScene);
    expect(root.querySelector('[data-operation-choice-group]')).toBeNull();

    const waterOffer = root.querySelector<HTMLButtonElement>('[data-operation-purchase-toggle][data-offer-id="' + OFFER_DEMO_IDS.waterOffer + '"]')!;
    const medkitOffer = root.querySelector<HTMLButtonElement>('[data-operation-purchase-toggle][data-offer-id="' + OFFER_DEMO_IDS.medkitOffer + '"]')!;
    const waterOfferCard = root.querySelector('[data-operation-purchase-offer="' + OFFER_DEMO_IDS.waterOffer + '"]')!;
    expect(waterOfferCard.textContent).toContain('补给一箱饮水，并提升现场准备度。');
    expect(waterOfferCard.textContent).not.toContain(OFFER_DEMO_IDS.waterItem);
    expect(waterOffer.textContent).toContain('2 Cost');
    expect(medkitOffer.textContent).toContain('3 Cost');
    const purchaseBeforeToggle = game.operationEntry.getSnapshot();
    root.querySelector<HTMLButtonElement>('[data-operation-purchase-toggle][data-offer-id="' + OFFER_DEMO_IDS.waterOffer + '"]')!.click();
    expect(root.querySelector('[data-operation-cost-preview]')?.textContent).toContain('本批支付 2 PlayerCost · 余额 9 → 7');
    expect(game.operationEntry.getSnapshot()).toEqual(purchaseBeforeToggle);
    root.querySelector<HTMLButtonElement>('[data-operation-purchase-toggle][data-offer-id="' + OFFER_DEMO_IDS.waterOffer + '"]')!.click();
    expect(root.querySelector('[data-operation-cost-preview]')?.textContent).toContain('本批支付 0 PlayerCost · 余额 9 → 9');
    expect(game.operationEntry.getSnapshot()).toEqual(purchaseBeforeToggle);
    root.querySelector<HTMLButtonElement>('[data-operation-purchase-toggle][data-offer-id="' + OFFER_DEMO_IDS.waterOffer + '"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-purchase-toggle][data-offer-id="' + OFFER_DEMO_IDS.medkitOffer + '"]')!.click();
    expect(root.querySelector('[data-operation-cost-preview]')?.textContent).toContain('本批支付 5 PlayerCost · 余额 9 → 4');
    expect(game.operationEntry.getSnapshot()).toEqual(purchaseBeforeToggle);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();

    expect(game.operationEntry.getView(runId)).toMatchObject({
      currentLocationId: OFFER_DEMO_IDS.location,
      currentSceneId: OFFER_DEMO_IDS.purchaseScene,
      locationProgress: { [OFFER_DEMO_IDS.location]: { completedSceneIds: [OFFER_DEMO_IDS.choiceScene] } },
      heldItemIds: [OFFER_DEMO_IDS.waterItem, OFFER_DEMO_IDS.medkitItem],
      knownFactIds: [OFFER_DEMO_IDS.waterFact, OFFER_DEMO_IDS.medkitFact],
      playerCost: 4,
    });
    expect(root.querySelector<HTMLButtonElement>('[data-operation-purchase-toggle][data-offer-id="' + OFFER_DEMO_IDS.waterOffer + '"]')?.disabled).toBe(true);
    const resolution = game.operationEntry.getView(runId)?.resolutions.find(row => row.sceneId === OFFER_DEMO_IDS.purchaseScene && row.sceneBatch?.purchases?.length);
    expect(resolution?.sceneBatch?.purchases?.map(purchase => purchase.offerId)).toEqual([
      OFFER_DEMO_IDS.waterOffer,
      OFFER_DEMO_IDS.medkitOffer,
    ]);
    expect(resolution?.sceneBatch?.playerCostPaid).toBe(5);

    root.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + OFFER_DEMO_IDS.removeSpentWater + '"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    expect(game.operationEntry.getView(runId)).toMatchObject({
      currentSceneId: OFFER_DEMO_IDS.purchaseScene,
      heldItemIds: [OFFER_DEMO_IDS.medkitItem],
      knownFactIds: [OFFER_DEMO_IDS.waterFact, OFFER_DEMO_IDS.medkitFact],
    });

    root.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + OFFER_DEMO_IDS.finalInventoryCheck + '"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    expect(game.operationEntry.getView(runId)).toMatchObject({
      currentLocationId: OFFER_DEMO_IDS.exitLocation,
      locationProgress: { [OFFER_DEMO_IDS.location]: { completed: true, result: 'success', completedSceneIds: [OFFER_DEMO_IDS.choiceScene, OFFER_DEMO_IDS.purchaseScene] } },
    });
  });

  it('创建与恢复 Run 使用 Operation Surface；返回后恢复聊天位置、焦点和面板状态', () => {
    acquireStudents();
    const originalCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) { return this.classList?.contains('chat-stream') ? 100 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement) { return this.classList?.contains('chat-stream') ? 400 : 0; },
    });
    try {
      controller.panelState.leftTab = 'story';
      controller.panelState.centerTab = 'chat';
      controller.panelState.rightTab = 'character';
      const beforeStream = root.querySelector<HTMLElement>('.chat-stream')!;
      beforeStream.scrollTop = 90;
      const fullBefore = controller.getRefreshStats().fullRenders;

      expect(root.querySelector('[data-operation-start]')?.textContent).toContain('开始旋转木马安全行动');
      root.querySelector<HTMLButtonElement>('[data-operation-start]')!.click();
      const operation = controller.panelState.workspace;
      expect(operation?.type).toBe('operation');
      if (operation?.type !== 'operation') throw new Error('Operation route did not open');
      expect(game.operationEntry.getView(operation.runId)).toMatchObject({
        currentLocationId: IDS.locations.platform,
        currentStage: 'combat',
        currentActionMode: null,
      });
      expect(root.querySelector('.operation-commit-status')?.textContent).toContain('战斗阶段');
      expect(root.querySelector('[data-workspace-frame="operation"]')).not.toBeNull();
      expect(controller.getRefreshStats().fullRenders).toBe(fullBefore + 1);
      expect(document.activeElement).toBe(root.querySelector('[data-operation-commit]'));

      root.querySelector<HTMLButtonElement>('[data-operation-back]')!.click();
      expect(controller.panelState.workspace).toBeUndefined();
      expect(controller.panelState.leftTab).toBe('story');
      expect(controller.panelState.centerTab).toBe('chat');
      expect(controller.panelState.rightTab).toBe('character');
      expect(root.querySelector<HTMLElement>('.chat-stream')?.scrollTop).toBe(90);
      expect(document.activeElement).toBe(root.querySelector('[data-operation-resume-run]'));

      root.querySelector<HTMLButtonElement>('[data-operation-resume-run]')!.click();
      expect(controller.panelState.workspace?.type).toBe('operation');
      expect(root.querySelector('[data-workspace-frame="operation"]')).not.toBeNull();
    } finally {
      if (originalCapture) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalCapture);
      else Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
      if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    }
  });

  it('策略园入口按 Event ID 启动并进入地图起点，旋转木马入口仍可用', () => {
    acquireStudents();
    const parkStart = root.querySelector<HTMLButtonElement>(`[data-operation-start="${PARK_IDS.event}"]`);
    const carouselStart = root.querySelector<HTMLButtonElement>(`[data-operation-start="${IDS.event}"]`);
    expect(parkStart?.disabled).toBe(false);
    expect(carouselStart?.disabled).toBe(false);

    parkStart!.click();
    const workspace = controller.panelState.workspace;
    if (workspace?.type !== 'operation') throw new Error('Strategy Park did not open the Operation workspace');
    expect(game.operationEntry.getView(workspace.runId)).toMatchObject({
      eventId: PARK_IDS.event,
      currentLocationId: PARK_IDS.locations.westGate,
      currentActionMode: 'global',
    });

    root.querySelector<HTMLButtonElement>(`[data-operation-back]`)!.click();
    const resume = root.querySelector<HTMLButtonElement>(`[data-operation-resume-run][data-operation-event-id="${PARK_IDS.event}"]`);
    expect(resume).not.toBeNull();
    resume!.click();
    expect(controller.panelState.workspace).toMatchObject({ type: 'operation', runId: workspace.runId });
    expect(game.operationEntry.getView(workspace.runId)?.eventId).toBe(PARK_IDS.event);
  });

  it('沿正式事件流完成干预、两类场景行动、路线、玩家卡与奖励，始终只刷新 Operation region', () => {
    acquireStudents();
    startFromFeed();
    const workspace = controller.panelState.workspace;
    if (workspace?.type !== 'operation') throw new Error('Operation route did not open');
    const runId = workspace.runId;
    const fullBefore = controller.getRefreshStats().fullRenders;
    let regionBefore = controller.getRefreshStats().regionRefreshes;
    const stableFrame = root.querySelector('[data-workspace-frame="operation"]');
    const stableStream = root.querySelector('[data-operation-log]');
    const stableDock = root.querySelector('[data-operation-commit-dock]');
    const stableStudent = root.querySelector('[data-operation-student="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"]');
    const hoshinoBrace = root.querySelector<HTMLButtonElement>('[data-operation-action][data-actor-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"][data-action-id="' + CAROUSEL_SAFETY_IDS.actions.brace + '"]')!;
    expect(JSON.parse(hoshinoBrace.dataset.legalTargetActorIds ?? '[]')).toEqual([CAROUSEL_SAFETY_IDS.actors.ride]);
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(controller.getRefreshStats().regionRefreshes).toBe(regionBefore);

    const actionAlternatives = root.querySelector<HTMLButtonElement>('[data-operation-action][data-actor-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"][aria-pressed="true"]');
    expect(actionAlternatives?.getAttribute('aria-expanded')).toBe('false');
    expect(actionAlternatives?.querySelector('[data-operation-action-status]')?.textContent).toBe('自动计划');
    const beforeOpenRun = game.operationEntry.getView(runId);
    const beforeOpenRegions = controller.getRefreshStats().regionRefreshes;
    actionAlternatives!.click();
    expect(actionAlternatives!.getAttribute('aria-expanded')).toBe('true');
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(root.querySelector('[data-operation-action-alternatives-panel][data-operation-action-owner-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"]')?.hasAttribute('hidden')).toBe(false);
    expect(game.operationEntry.getView(runId)?.planVersion).toBe(beforeOpenRun?.planVersion);
    expect(controller.getRefreshStats().regionRefreshes).toBe(beforeOpenRegions);
    const hoshinoState = game.operationEntry.getView(runId)!.actorStates.find(actor => actor.id === CAROUSEL_SAFETY_IDS.actors.hoshino)!;
    const selectedActionIdBefore = hoshinoState.currentPlan?.actionId;
    const selectedActionId = hoshinoState.profile?.actionOptions.find(option => option.selectable && option.actionId !== selectedActionIdBefore)?.actionId;
    expect(selectedActionId).toBeTruthy();
    const actionButton = root.querySelector<HTMLButtonElement>('[data-operation-action][data-actor-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"][data-action-id="' + selectedActionId + '"]')!;
    expect(actionButton.parentElement?.matches('[data-operation-prepared-card-layer]')).toBe(true);
    const selectedOption = hoshinoState.profile?.actionOptions.find(option => option.actionId === selectedActionId)!;
    if (selectedOption.legalTargetActorIds.length > 1) {
      actionButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
      dragCardToActorTarget(root, actionButton, CAROUSEL_SAFETY_IDS.actors.hoshino, 26);
    } else actionButton.click();
    expect(game.operationEntry.getView(runId)?.interventionDraft).toMatchObject({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId: selectedActionId,
    });
    expect(root.querySelector('[data-operation-action-current][data-actor-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"] [data-operation-action-status]')?.textContent)
      .toBe('玩家已修订');
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect((document.activeElement as HTMLElement).dataset.actionId).toBe(selectedActionId);
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBe(stableFrame);
    expect(root.querySelector('[data-operation-log]')).toBe(stableStream);
    expect(root.querySelector('[data-operation-student="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"]')).toBe(stableStudent);
    expect(root.querySelector('[data-operation-action][data-action-id="' + selectedActionId + '"]')).toBe(actionButton);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    expect(game.operationEntry.getView(runId)?.currentLocationId).toBe(IDS.locations.concourse);
    expect(root.querySelector('.operation-commit-status')?.textContent).toContain('处理地点行动');
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBe(stableFrame);
    expect(root.querySelector('[data-operation-log]')).toBe(stableStream);
    expect(root.querySelector('[data-operation-commit-dock]')).toBe(stableDock);

    const individualCards = [...root.querySelectorAll<HTMLElement>('[data-operation-scene-card][data-actor-id]')];
    expect(individualCards).toHaveLength(3);
    expect([...root.querySelectorAll<HTMLElement>('[data-operation-student]')].every(card => card.querySelector('[data-operation-actor-hand-cards] [data-operation-scene-card]'))).toBe(true);
    expect(root.querySelector('[data-operation-scene-selection]')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')?.textContent).toBe('确认本批');
    selectSceneAction(IDS.actors.hoshino, IDS.sceneActions.inspect);
    selectSceneAction(IDS.actors.serika, IDS.sceneActions.guide);
    selectSceneAction(IDS.actors.shiroko, IDS.sceneActions.guide);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(game.operationEntry.getView(runId)?.pendingSceneActionBatch).toBeNull();
    expect(game.operationEntry.getView(runId)?.heldItemIds).toContain(IDS.item);

    root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + IDS.routes.staffGate + '"]')!.click();
    expect(game.operationEntry.getView(runId)?.currentLocationId).toBe(IDS.locations.exit);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBe(stableFrame);
    expect(root.querySelector('[data-operation-log]')).toBe(stableStream);
    expect(root.querySelector('[data-operation-commit-dock]')).toBe(stableDock);
    const globalPerformerCard = root.querySelector<HTMLElement>('[data-global-scene-card]')!;
    const globalPerformerFace = globalPerformerCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice]')!;
    dragSceneActionToStudent(root, globalPerformerFace, IDS.actors.hoshino, 43);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(root.querySelector('[data-operation-scene-actions] [data-global-scene-card]')).toBeNull();
    const attachedExitFace = root.querySelector<HTMLButtonElement>('[data-operation-student="' + IDS.actors.hoshino + '"] [data-global-scene-card] [data-operation-scene-choice][aria-pressed="true"]')!;
    const exitTargets = JSON.parse(attachedExitFace.dataset.legalTargetActorIds ?? '[]') as string[];
    if (exitTargets.length > 1) {
      const beforeTargetSelection = controller.getRefreshStats().regionRefreshes;
      dragCardToActorTarget(root, attachedExitFace, exitTargets[0]!, 44);
      expect(controller.getRefreshStats().regionRefreshes).toBe(beforeTargetSelection);
    }
    expect(root.querySelector('[data-operation-student="' + IDS.actors.hoshino + '"] [data-global-scene-card]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(game.operationEntry.getView(runId)?.status).toBe('success');
    root.querySelector<HTMLButtonElement>('[data-operation-reward]')!.click();
    expect(game.operationEntry.getView(runId)?.rewardClaimed).toBe(true);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);

    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect(root.querySelector('[data-operation-outcome]')?.textContent).toContain('行动成功');
    const operationUpdates = controller.getRefreshObservations().filter(item => item.reason === 'operation-command').slice(-10);
    expect(operationUpdates).toHaveLength(7);
    for (const observation of operationUpdates) expect(observation).toMatchObject({ scope: 'region', outcome: 'applied' });
  });

  it('角色卡悬停与聊天流滚动不触发 Operation 查询或 UI 重建', () => {
    acquireStudents();
    startFromFeed();
    const before = controller.getRefreshStats();
    root.querySelector<HTMLElement>('.operation-prepared-card[data-operation-action-current]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    root.querySelector<HTMLElement>('[data-operation-log]')?.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBe(before.regionRefreshes);
  });

  it('根据 owner 与固定共享层的真实矩形定位牌面，并响应 scroll 与尺寸变化', async () => {
    acquireStudents();
    const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
      x: left, y: top, left, top, width, height, right: left + width, bottom: top + height,
      toJSON: () => ({}),
    });
    let ownerRect = rect(150, 100, 210, 150);
    const resizeCallback: { current: ResizeObserverCallback | null } = { current: null };
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) { resizeCallback.current = callback; }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const nextFrame = () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    startFromFeed();
    try {
      await Promise.resolve();
      await nextFrame();
      expect(resizeCallback.current).not.toBeNull();

      const frame = root.querySelector<HTMLElement>('[data-workspace-frame="operation"]')!;
      const layer = [...frame.children].find(child => child instanceof HTMLElement && child.matches('[data-operation-prepared-card-layer]')) as HTMLElement;
      const owner = frame.querySelector<HTMLElement>('[data-operation-card-anchor="' + IDS.actors.hoshino + '"]')!;
      const face = layer.querySelector<HTMLButtonElement>('[data-operation-action-current][data-actor-id="' + IDS.actors.hoshino + '"]')!;
      const originalRects = [frame, layer, owner].map(element => element.getBoundingClientRect.bind(element));
      ownerRect = rect(150, 100, 210, 150);
      Object.defineProperty(frame, 'getBoundingClientRect', { configurable: true, value: () => rect(0, 0, 1000, 700) });
      Object.defineProperty(layer, 'getBoundingClientRect', { configurable: true, value: () => rect(0, 0, 1280, 720) });
      Object.defineProperty(owner, 'getBoundingClientRect', { configurable: true, value: () => ownerRect });
      resizeCallback.current?.([], {} as ResizeObserver);
      await nextFrame();
      expect(face.style.left).toBe('240px');
      expect(face.style.top).toBe('180px');
      expect(Number.parseFloat(face.style.left)).toBeGreaterThanOrEqual(ownerRect.left);
      expect(Number.parseFloat(face.style.left) + 112).toBeLessThanOrEqual(ownerRect.right);
      expect(Number.parseFloat(face.style.top)).toBeGreaterThanOrEqual(ownerRect.top);
      expect(Number.parseFloat(face.style.top) + 62).toBeLessThanOrEqual(ownerRect.bottom);

      const alternative = layer.querySelector<HTMLButtonElement>('[data-operation-action-alternative][data-operation-action-owner-id="' + IDS.actors.hoshino + '"]')!;
      const alternativePanel = layer.querySelector<HTMLElement>('[data-operation-action-alternatives-panel][data-operation-action-owner-id="' + IDS.actors.hoshino + '"]')!;
      face.click();
      await nextFrame();
      expect(alternative.hidden).toBe(false);
      expect(alternativePanel.hidden).toBe(false);
      expect(Number.parseFloat(alternative.style.left)).toBeGreaterThan(Number.parseFloat(face.style.left));
      face.click();
      await nextFrame();
      expect(alternative.hidden).toBe(true);

      ownerRect = rect(160, 60, 210, 160);
      frame.dispatchEvent(new Event('scroll', { bubbles: true }));
      await nextFrame();
      expect(face.style.left).toBe('250px');
      expect(face.style.top).toBe('150px');
      expect(Number.parseFloat(face.style.left)).toBeGreaterThanOrEqual(ownerRect.left);
      expect(Number.parseFloat(face.style.left) + 112).toBeLessThanOrEqual(ownerRect.right);

      ownerRect = rect(160, 60, 230, 160);
      resizeCallback.current?.([], {} as ResizeObserver);
      await nextFrame();
      expect(face.style.left).toBe('270px');
      expect(face.style.top).toBe('150px');
      expect(Number.parseFloat(face.style.left)).toBeGreaterThanOrEqual(ownerRect.left);
      expect(Number.parseFloat(face.style.left) + 112).toBeLessThanOrEqual(ownerRect.right);

      // When the owner's width cannot contain the selected face, fall back to
      // an exterior anchor and flip left if the frame edge blocks the right.
      Object.defineProperty(frame, 'getBoundingClientRect', { configurable: true, value: () => rect(0, 0, 350, 700) });
      Object.defineProperty(layer, 'getBoundingClientRect', { configurable: true, value: () => rect(100, 0, 700, 720) });
      ownerRect = rect(200, 60, 100, 160);
      resizeCallback.current?.([], {} as ResizeObserver);
      await nextFrame();
      expect(face.style.left).toBe('-20px');
      expect(100 + Number.parseFloat(face.style.left) + 112).toBeLessThanOrEqual(ownerRect.left - 8);
      await nextFrame();
      for (const [index, element] of [frame, layer, owner].entries()) {
        Object.defineProperty(element, 'getBoundingClientRect', { configurable: true, value: originalRects[index] });
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('替换当前行动后，新当前牌能收起遗留的待替换卡并再次展开', () => {
    acquireStudents();
    startFromFeed();
    const actorId = CAROUSEL_SAFETY_IDS.actors.hoshino;
    const { currentFace, alternative } = installTargetableAlternative();
    currentFace.click();
    expect(alternative.hidden).toBe(false);
    alternative.click();

    const replacement = root.querySelector<HTMLButtonElement>(
      '[data-operation-action-current][data-operation-action-owner-id="' + actorId + '"][aria-pressed="true"]',
    )!;
    const alternatives = [...root.querySelectorAll<HTMLButtonElement>(
      '[data-operation-action-alternative][data-operation-action-owner-id="' + actorId + '"]',
    )];
    const panel = root.querySelector<HTMLElement>(
      '[data-operation-action-alternatives-panel][data-operation-action-owner-id="' + actorId + '"]',
    )!;
    expect(replacement.dataset.actionId).toBe(alternative.dataset.actionId);
    expect(replacement.getAttribute('aria-expanded')).toBe('false');
    expect(alternatives.every(option => option.hidden)).toBe(true);
    expect(panel.hidden).toBe(true);

    // Reproduce a stale visible alternative layer after the current card has been re-rendered.
    alternatives.forEach(option => { option.hidden = false; });
    panel.hidden = false;
    replacement.click();
    expect(replacement.getAttribute('aria-expanded')).toBe('false');
    expect(alternatives.every(option => option.hidden)).toBe(true);
    expect(panel.hidden).toBe(true);

    replacement.click();
    expect(replacement.getAttribute('aria-expanded')).toBe('true');
    expect(alternatives.some(option => !option.hidden)).toBe(true);
    expect(panel.hidden).toBe(false);
    replacement.click();
    expect(replacement.getAttribute('aria-expanded')).toBe('false');
    expect(alternatives.every(option => option.hidden)).toBe(true);
    expect(panel.hidden).toBe(true);
  });

  it('键盘选择当前自动行动时清除干预并恢复自动目标', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const { currentFace, alternative, targetTray, targetChoice, targetId, actionId } = installTargetableAlternative();
    const initialView = game.operationEntry.getView(runId)!;
    currentFace.click();
    expect(alternative.hidden).toBe(false);
    expect(targetTray).toBeNull();
    expect(targetChoice).toBeNull();
    expect(initialView.interventionDraft).toMatchObject({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop,
    });

    alternative.focus();
    alternative.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    alternative.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    expect(targetTray).toBeNull();
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(game.operationEntry.getView(runId)?.actorStates.find(actor => actor.id === CAROUSEL_SAFETY_IDS.actors.hoshino)?.currentPlan)
      .toMatchObject({ actionId, targetActorId: targetId });
    expect(root.querySelector('[data-operation-action-current][data-actor-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"] [data-operation-action-status]')?.textContent)
      .toBe('自动计划');
    expect(game.operationEntry.getView(runId)!.planVersion).toBeGreaterThan(initialView.planVersion);
  });

  it('首次推荐时星野可通过鼠标选择无目标的替代行动', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const actorId = CAROUSEL_SAFETY_IDS.actors.hoshino;
    const actionId = CAROUSEL_SAFETY_IDS.actions.emergencyStop;
    const initialView = game.operationEntry.getView(runId)!;
    const hoshino = initialView.actorStates.find(actor => actor.id === actorId)!;
    expect(hoshino.profile?.actionOptions.map(option => option.actionId)).toContain(actionId);
    game.operationEntry.reviseIntervention({
      runId,
      planVersion: initialView.planVersion,
      draft: { actorId, actionId: CAROUSEL_SAFETY_IDS.actions.brace, targetActorId: CAROUSEL_SAFETY_IDS.actors.ride },
    });
    controller.render();
    const currentFace = root.querySelector<HTMLButtonElement>(
      '[data-operation-action-current][data-actor-id="' + actorId + '"][aria-pressed="true"]',
    )!;
    const alternative = root.querySelector<HTMLButtonElement>(
      '[data-operation-action-alternative][data-actor-id="' + actorId + '"][data-action-id="' + actionId + '"]',
    )!;
    currentFace.click();
    expect(alternative.hidden).toBe(false);
    expect(alternative.disabled).toBe(false);
    alternative.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));

    expect(game.operationEntry.getView(runId)?.interventionDraft).toMatchObject({
      actorId,
      actionId,
    });
  });

  it('首次推荐按 Profile 选择目标型行动并显示自动目标，不创建干预', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const actorId = CAROUSEL_SAFETY_IDS.actors.hoshino;
    const initialView = game.operationEntry.getView(runId)!;
    const actionId = CAROUSEL_SAFETY_IDS.actions.brace;
    const currentFace = root.querySelector<HTMLButtonElement>(
      '[data-operation-action-current][data-actor-id="' + actorId + '"][aria-pressed="true"]',
    )!;
    const plan = initialView.actorStates.find(actor => actor.id === actorId)?.currentPlan;
    expect(plan).toMatchObject({ actionId, targetActorId: CAROUSEL_SAFETY_IDS.actors.ride });
    expect(currentFace.dataset.actionId).toBe(actionId);
    expect(currentFace.dataset.targetSummary).toContain('→');
    expect(currentFace.querySelector('[data-operation-action-status]')?.textContent).toBe('自动计划');
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(game.operationEntry.getView(runId)?.planVersion).toBe(initialView.planVersion);
  });

  it('单一合法目标的自动行动显示固定目标，选择后清除干预', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const { currentFace, alternative, targetId, actionId } = installTargetableAlternative();
    const initialView = game.operationEntry.getView(runId)!;
    currentFace.click();
    expect(JSON.parse(alternative.dataset.legalTargetActorIds ?? '[]')).toEqual([targetId]);
    alternative.click();
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(game.operationEntry.getView(runId)?.actorStates.find(actor => actor.id === CAROUSEL_SAFETY_IDS.actors.hoshino)?.currentPlan)
      .toMatchObject({ actionId, targetActorId: targetId });
    expect(game.operationEntry.getView(runId)!.planVersion).toBeGreaterThan(initialView.planVersion);
  });

  it('UIController.destroy 幂等释放牌层 scroll、MutationObserver、ResizeObserver 与 pending rAF', () => {
    controller.destroy();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    const resizeObservers: Array<{ observed: Set<Element>; disconnected: boolean; disconnectCount: number }> = [];
    class TestResizeObserver {
      readonly observed = new Set<Element>();
      disconnected = false;
      disconnectCount = 0;
      constructor(_callback: ResizeObserverCallback) { resizeObservers.push(this); }
      observe(target: Element): void { this.observed.add(target); }
      unobserve(target: Element): void { this.observed.delete(target); }
      disconnect(): void { this.disconnected = true; this.disconnectCount += 1; this.observed.clear(); }
    }
    const mutationObservers: Array<{ target: Node | null; disconnected: boolean; disconnectCount: number }> = [];
    class TestMutationObserver {
      target: Node | null = null;
      disconnected = false;
      disconnectCount = 0;
      constructor(_callback: MutationCallback) { mutationObservers.push(this); }
      observe(target: Node): void { this.target = target; }
      disconnect(): void { this.disconnected = true; this.disconnectCount += 1; }
      takeRecords(): MutationRecord[] { return []; }
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('MutationObserver', TestMutationObserver);
    let nextFrameId = 0;
    const pendingFrames = new Map<number, FrameRequestCallback>();
    const cancelledFrames: number[] = [];
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      const id = ++nextFrameId;
      pendingFrames.set(id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      cancelledFrames.push(id);
      pendingFrames.delete(id);
    });
    const addListener = vi.spyOn(root, 'addEventListener');
    const removeListener = vi.spyOn(root, 'removeEventListener');
    const flushPendingFrames = (): void => {
      const queued = [...pendingFrames.entries()];
      for (const [id, callback] of queued) {
        pendingFrames.delete(id);
        callback(16);
      }
    };

    try {
      controller = new UIController(game, root);
      controller.started = true;
      controller.render();
      flushPendingFrames();
      acquireStudents();
      startFromFeed();
      root.dispatchEvent(new Event('scroll', { bubbles: true }));
      flushPendingFrames();

      const layer = root.querySelector<HTMLElement>('[data-operation-prepared-card-layer]')!;
      const resizeObserver = resizeObservers.find(observer => observer.observed.has(layer));
      const mutationObserver = mutationObservers.find(observer => observer.target === root);
      const scrollRegistration = addListener.mock.calls.find(call => call[0] === 'scroll' && call[2] === true);
      expect(resizeObserver).toBeDefined();
      expect(mutationObserver).toBeDefined();
      expect(scrollRegistration).toBeDefined();
      expect(requestFrame).toHaveBeenCalled();

      root.dispatchEvent(new Event('scroll', { bubbles: true }));
      const pendingEntry = [...pendingFrames.entries()].at(-1);
      expect(pendingEntry).toBeDefined();
      const [pendingFrameId, staleCallback] = pendingEntry!;
      controller.destroy();
      controller.destroy();

      expect(removeListener).toHaveBeenCalledWith('scroll', scrollRegistration![1], true);
      expect(mutationObserver!.disconnected).toBe(true);
      expect(mutationObserver!.disconnectCount).toBe(1);
      expect(resizeObserver!.disconnected).toBe(true);
      expect(resizeObserver!.disconnectCount).toBe(1);
      expect(cancelledFrames).toContain(pendingFrameId);
      expect(pendingFrames.has(pendingFrameId)).toBe(false);
      staleCallback(32);
      expect(pendingFrames.size).toBe(0);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it('卡片选择只更新当前 DOM，不改 Runtime 计划或触发刷新', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    selectActionIfNotCurrent(CAROUSEL_SAFETY_IDS.actions.emergencyStop);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    const workspace = root.querySelector<HTMLElement>('[data-workspace-frame="operation"]')!;
    const student = root.querySelector<HTMLElement>('[data-operation-student="' + IDS.actors.hoshino + '"]')!;
    const planVersion = game.operationEntry.getSnapshot()!.planVersion;
    const regionBefore = controller.getRefreshStats().regionRefreshes;
    const alternatives = workspace.querySelector<HTMLButtonElement>('[data-operation-scene-choice]:not([aria-pressed="true"])');
    expect(alternatives).not.toBeNull();
    expect([...workspace.querySelectorAll<HTMLElement>('[data-operation-scene-option]')].every(option => !option.hidden)).toBe(true);
    alternatives!.click();
    expect(alternatives!.getAttribute('aria-pressed')).toBe('true');
    expect(game.operationEntry.getSnapshot()!.planVersion).toBe(planVersion);
    expect(controller.getRefreshStats().regionRefreshes).toBe(regionBefore);
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBe(workspace);
    expect(root.querySelector('[data-operation-student="' + IDS.actors.hoshino + '"]')).toBe(student);
    const selectedActorId = alternatives!.dataset.actorId;
    const selectedActionId = alternatives!.dataset.sceneActionId;
    const sceneDraft = readOperationSceneDraft(runId, planVersion, IDS.locations.concourse);
    expect(sceneDraft?.selections.find(selection => selection.actorId === selectedActorId)?.sceneActionId).toBe(selectedActionId);
  });

  it('单一行动目标固定显示，多目标场景牌通过拖拽改选', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    let initialView = game.operationEntry.getView(runId)!;
    let actionFace = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-action][aria-pressed="true"]')]
      .find(face => (JSON.parse(face.dataset.legalTargetActorIds ?? '[]') as string[]).length > 0)!;
    expect(actionFace).toBeDefined();
    let legalTargets = JSON.parse(actionFace.dataset.legalTargetActorIds ?? '[]') as string[];
    const dropTargetId = legalTargets[0];
    let dropTarget = [...root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')]
      .find(actor => actor.dataset.operationActorTarget === dropTargetId)!;
    const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    expect(actionFace.tagName).toBe('BUTTON');
    expect(actionFace.tabIndex).toBe(0);
    expect(actionFace.getAttribute('aria-label')).toContain('行动');
    let targetTray = [...root.querySelectorAll<HTMLElement>('[data-operation-action-targets]')]
      .find(tray => tray.dataset.operationPreparedOwnerId === actionFace.dataset.actorId && tray.dataset.operationActionId === actionFace.dataset.actionId)!;
    actionFace.focus();
    actionFace.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(legalTargets).toHaveLength(1);
    expect(targetTray).toBeUndefined();
    expect(game.operationEntry.getView(runId)?.planVersion).toBe(initialView.planVersion);
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(document.activeElement).toBe(actionFace);
    const illegalTarget = [...root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')]
      .find(actor => !legalTargets.includes(actor.dataset.operationActorTarget ?? ''))!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => dropTarget });
    try {
      actionFace.dispatchEvent(pointer('pointerdown', 2, 2, 19));
      root.dispatchEvent(pointer('pointermove', 18, 18, 19));
      expect(dropTarget.classList.contains('is-card-legal-target')).toBe(false);
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(dropTarget.classList.contains('is-card-legal-target')).toBe(false);
      expect(document.activeElement).toBe(actionFace);
      expect(game.operationEntry.getView(runId)?.planVersion).toBe(initialView.planVersion);
      expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();

      actionFace.dispatchEvent(pointer('pointerdown', 2, 2, 21));
      root.dispatchEvent(pointer('pointermove', 18, 18, 21));
      expect(actionFace.classList.contains('is-card-drag-source')).toBe(false);
      root.dispatchEvent(pointer('pointercancel', 18, 18, 21));
      expect(actionFace.classList.contains('is-card-drag-source')).toBe(false);
      expect(dropTarget.classList.contains('is-card-legal-target')).toBe(false);
      expect(root.querySelector('[data-workspace-frame="operation"]')?.classList.contains('is-card-dragging')).toBe(false);
      expect(game.operationEntry.getView(runId)?.planVersion).toBe(initialView.planVersion);
      expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();

      actionFace.dispatchEvent(pointer('pointerdown', 2, 2, 22));
      root.dispatchEvent(pointer('pointermove', 18, 18, 22));
      actionFace.dispatchEvent(pointer('lostpointercapture', 18, 18, 22));
      expect(actionFace.classList.contains('is-card-drag-source')).toBe(false);
      expect(dropTarget.classList.contains('is-card-legal-target')).toBe(false);
      expect(game.operationEntry.getView(runId)?.planVersion).toBe(initialView.planVersion);
      expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();

      Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => illegalTarget });
      actionFace.dispatchEvent(pointer('pointerdown', 2, 2, 20));
      root.dispatchEvent(pointer('pointermove', 18, 18, 20));
      actionFace.dispatchEvent(pointer('pointerup', 18, 18, 20));
      expect(game.operationEntry.getView(runId)?.planVersion).toBe(initialView.planVersion);
      expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();

      Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => dropTarget });
      actionFace.dispatchEvent(pointer('pointerdown', 2, 2));
      root.dispatchEvent(pointer('pointermove', 18, 18));
      expect(dropTarget.classList.contains('is-card-legal-target')).toBe(false);
      expect(game.operationEntry.getSnapshot()!.planVersion).toBe(initialView.planVersion);
      actionFace.dispatchEvent(pointer('pointerup', 18, 18));
    } finally {
      if (originalElementFromPoint) Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
      else Reflect.deleteProperty(document, 'elementFromPoint');
    }
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(game.operationEntry.getView(runId)!.planVersion).toBe(initialView.planVersion);
    expect(root.querySelector('[data-operation-action][data-actor-id="' + actionFace.dataset.actorId + '"][data-action-id="' + actionFace.dataset.actionId + '"]')).toBe(actionFace);
    expect(document.activeElement).toBe(actionFace);

    // Reset this isolated drag scenario so the existing safety plan takes its normal route to Individual actions.
    root.querySelector<HTMLButtonElement>('[data-operation-clear]')?.click();
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    selectSceneAction(IDS.actors.hoshino, IDS.sceneActions.inspect);
    selectSceneAction(IDS.actors.serika, IDS.sceneActions.guide);
    selectSceneAction(IDS.actors.shiroko, IDS.sceneActions.guide);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + IDS.routes.staffGate + '"]')!.click();
    const sceneView = game.operationEntry.getView(runId)!;
    let cardFace = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-card-toggle]')]
      .find(face => face.dataset.performerPolicy !== 'none')!;
    expect(sceneView.currentActionMode).toBe('global');
    expect(cardFace).toBeDefined();
    const cardOwnerId = (JSON.parse(cardFace.dataset.operationPerformerCandidateActorIds ?? '[]') as string[])[0];
    expect(cardOwnerId).toBeTruthy();
    dragPlayerCardToStudent(root, cardFace, cardOwnerId, 25);
    cardFace = root.querySelector<HTMLButtonElement>('[data-operation-player-card] [data-operation-card-toggle][data-actor-id="' + cardOwnerId + '"]')!;
    const cardTargetId = (JSON.parse(cardFace.dataset.legalTargetActorIds ?? '[]') as string[])[0];
    const cardTarget = [...root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')]
      .find(actor => actor.dataset.operationActorTarget === cardTargetId)!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => cardTarget });
    try {
      cardFace.dispatchEvent(pointer('pointerdown', 2, 2, 18));
      root.dispatchEvent(pointer('pointermove', 18, 18, 18));
      expect(cardTarget.classList.contains('is-card-legal-target')).toBe(true);
      cardFace.dispatchEvent(pointer('pointerup', 18, 18, 18));
    } finally {
      if (originalElementFromPoint) Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
      else Reflect.deleteProperty(document, 'elementFromPoint');
    }
    expect(game.operationEntry.getView(runId)?.planVersion).toBe(sceneView.planVersion);
    expect(game.operationEntry.getView(runId)?.pendingSceneActionBatch).toBeNull();
    expect(cardFace.getAttribute('aria-pressed')).toBe('true');
    expect(cardFace.dataset.targetSummary).toContain('→');
    const visibleCardTarget = cardFace.querySelector<HTMLElement>('[data-operation-card-target-summary]');
    expect(visibleCardTarget?.textContent).toContain('→');
    const targetName = root.querySelector<HTMLElement>('[data-operation-actor-target="' + cardTargetId + '"] header strong')?.textContent?.trim();
    expect(targetName).toBeTruthy();
    expect(visibleCardTarget?.textContent).toContain(targetName!);
    expect(cardFace.getAttribute('aria-label')).toContain(targetName!);
    expect(cardFace.getAttribute('aria-label')).toContain('已加入本批');
    expect(cardFace.querySelector('[data-operation-card-status]')?.textContent).toBe('已加入本批');
    const sceneDraft = readOperationSceneDraft(runId, sceneView.planVersion, IDS.locations.exit);
    expect(sceneDraft?.cards.find(card => card.cardInstanceId === cardFace.closest<HTMLElement>('[data-operation-player-card]')?.dataset.operationPlayerCard)?.targetActorIds).toContain(cardTargetId);
  });

  it('PlayerSceneCard 挂靠后通过拖拽切换执行者与效果目标，单击退出', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    selectActionIfNotCurrent(CAROUSEL_SAFETY_IDS.actions.emergencyStop);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    const view = game.operationEntry.getView(runId)!;
    const card = view.playerCards.hand.find(item => item.performerPolicy !== 'none' && item.eligibleActorIds.length > 1);
    expect(card).toBeDefined();
    const ownerActorId = card!.eligibleActorIds[0];
    const alternateActorId = (card!.legalTargetActorIdsByActorId[ownerActorId] ?? []).find(actorId => actorId !== ownerActorId)!;
    expect(alternateActorId).toBeTruthy();
    dragPlayerCardToStudent(root, root.querySelector<HTMLButtonElement>('[data-operation-player-card="' + card!.cardInstanceId + '"] [data-operation-card-toggle]')!, ownerActorId, 92);
    let face = root.querySelector<HTMLButtonElement>('[data-operation-player-card="' + card!.cardInstanceId + '"] [data-operation-card-toggle]')!;
    expect(face.closest('[data-operation-actor-hand]')?.getAttribute('data-operation-actor-hand')).toBe(ownerActorId);
    dragPlayerCardToStudent(root, face, alternateActorId, 93);
    face = root.querySelector<HTMLButtonElement>('[data-operation-player-card="' + card!.cardInstanceId + '"] [data-operation-card-toggle]')!;
    expect(face.dataset.actorId).toBe(ownerActorId);
    expect(face.closest('[data-operation-actor-hand]')?.getAttribute('data-operation-actor-hand')).toBe(ownerActorId);
    expect(readOperationSceneDraft(runId, view.planVersion, IDS.locations.concourse)?.cards)
      .toContainEqual(expect.objectContaining({ cardInstanceId: card!.cardInstanceId, actorId: ownerActorId, targetActorIds: [alternateActorId] }));
    expect(projectOperationActorHand(game.operationEntry.getView(runId)!, ownerActorId))
      .toContainEqual(expect.objectContaining({ identity: card!.cardInstanceId, kind: 'player-card', source: 'shared-player-deck', ownerActorId, selected: true }));
    expect(root.querySelector('[data-operation-player-card] select')).toBeNull();
    face.click();
    const returned = root.querySelector<HTMLElement>('[data-operation-player-hand] [data-operation-player-card="' + card!.cardInstanceId + '"]')!;
    expect(returned).not.toBeNull();
    const cardToggle = returned.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!;
    cardToggle.focus();
    cardToggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(returned.querySelector('[data-operation-card-choice-tray]')).toBeNull();
    dragPlayerCardToStudent(root, cardToggle, ownerActorId, 62);
    face = root.querySelector<HTMLButtonElement>('[data-operation-player-card="' + card!.cardInstanceId + '"] [data-operation-card-toggle]')!;
    expect(face.dataset.actorId).toBe(ownerActorId);
  });

  it('纯点击为 Global SceneAction 选择、改派并取消合格执行者', () => {
    const runId = enterCarouselExit();
    const view = game.operationEntry.getView(runId)!;
    const source = view.currentSceneActions.find(action => action.scope === 'global' && action.performerPolicy === 'optional-student')!;
    const sceneAction = { ...source, performerPolicy: 'selected-student' as const };
    const syntheticView: OperationView = {
      ...view,
      currentSceneActions: view.currentSceneActions.map(action => action.id === source.id ? sceneAction : action),
    };
    const renderSynthetic = () => { root.innerHTML = renderOperationWorkspace(createUIContext(game), syntheticView); };
    const initialRun = game.operationEntry.getSnapshot();
    renderSynthetic();
    let picker = root.querySelector<HTMLElement>('[data-operation-performer-picker][data-card-kind="scene-action"][data-card-identity="' + source.id + '"]')!;
    let choices = [...picker.querySelectorAll<HTMLButtonElement>('[data-operation-card-actor]')];
    expect(choices.map(button => button.dataset.performerActorId)).toEqual(source.eligibleActorIds);
    choices[0]!.click();
    expect(readOperationSceneDraft(runId, view.planVersion, view.currentLocationId)?.selections)
      .toContainEqual(expect.objectContaining({ sceneActionId: source.id, actorId: source.eligibleActorIds[0] }));
    expect(game.operationEntry.getSnapshot()).toEqual(initialRun);

    renderSynthetic();
    picker = root.querySelector<HTMLElement>('[data-operation-performer-picker][data-card-kind="scene-action"][data-card-identity="' + source.id + '"]')!;
    choices = [...picker.querySelectorAll<HTMLButtonElement>('[data-operation-card-actor]')];
    choices[1]!.click();
    expect(readOperationSceneDraft(runId, view.planVersion, view.currentLocationId)?.selections)
      .toContainEqual(expect.objectContaining({ sceneActionId: source.id, actorId: source.eligibleActorIds[1] }));
    expect(game.operationEntry.getSnapshot()).toEqual(initialRun);

    renderSynthetic();
    root.querySelector<HTMLButtonElement>('[data-operation-performer-clear][data-card-identity="' + source.id + '"]')!.click();
    expect(readOperationSceneDraft(runId, view.planVersion, view.currentLocationId)?.selections).toEqual([]);
    expect(game.operationEntry.getSnapshot()).toEqual(initialRun);
  });

  it('公共手牌可点选 Performer，清除后焦点回到同一张卡', () => {
    const runId = enterCarouselExit();
    const view = game.operationEntry.getView(runId)!;
    const source = view.playerCards.hand.find(card => card.selectionPolicy === 'required' && card.performerPolicy === 'optional-student')!;
    const card = { ...source, performerPolicy: 'selected-student' as const };
    const syntheticView: OperationView = {
      ...view,
      playerCards: {
        ...view.playerCards,
        hand: view.playerCards.hand.map(item => item.cardInstanceId === source.cardInstanceId ? card : item),
      },
    };
    root.innerHTML = renderOperationWorkspace(createUIContext(game), syntheticView);
    const initialRun = game.operationEntry.getSnapshot();
    const picker = root.querySelector<HTMLElement>(
      '[data-operation-performer-picker][data-card-kind="player-card"][data-card-identity="' + card.cardInstanceId + '"]',
    );
    expect(picker).not.toBeNull();
    const performers = [...picker!.querySelectorAll<HTMLButtonElement>('[data-operation-card-actor]')];
    expect(performers.map(button => button.dataset.performerActorId)).toEqual(card.eligibleActorIds);
    const face = root.querySelector<HTMLButtonElement>('[data-operation-card-toggle][data-card-instance-id="' + card.cardInstanceId + '"]');
    expect(face).not.toBeNull();
    face!.click();
    expect((picker as HTMLDetailsElement).open).toBe(true);
    expect(document.activeElement).toBe(performers[0]);
    performers[0]!.click();

    const assignedDraft = readOperationSceneDraft(runId, view.planVersion, view.currentLocationId)!;
    expect(assignedDraft.cards).toContainEqual(expect.objectContaining({
      cardInstanceId: card.cardInstanceId,
      actorId: card.eligibleActorIds[0],
    }));
    expect(game.operationEntry.getSnapshot()).toEqual(initialRun);

    root.innerHTML = renderOperationWorkspace(createUIContext(game), syntheticView);
    root.querySelector<HTMLButtonElement>('[data-operation-performer-clear][data-card-identity="' + card.cardInstanceId + '"]')!.click();
    const returnedCard = root.querySelector<HTMLButtonElement>(
      '[data-operation-player-hand] [data-operation-player-card="' + card.cardInstanceId + '"] [data-operation-card-toggle]',
    );
    expect(returnedCard).not.toBeNull();
    expect(document.activeElement).toBe(returnedCard);
    expect(readOperationSceneDraft(runId, view.planVersion, view.currentLocationId)?.cards).toEqual([]);
    expect(game.operationEntry.getSnapshot()).toEqual(initialRun);
  });

  it('通过真实 Controller 改派后保留合法目标并交给批次构造器', () => {
    const runId = enterCarouselExit();
    const view = game.operationEntry.getView(runId)!;
    const source = view.currentSceneActions.find(action => action.scope === 'global' && action.performerPolicy === 'optional-student')!;
    const previousActorId = IDS.actors.hoshino;
    const nextActorId = IDS.actors.serika;
    const retainedTargetId = IDS.actors.shiroko;
    expect(source.eligibleActorIds).toContain(previousActorId);
    expect(source.eligibleActorIds).toContain(nextActorId);
    expect(source.legalTargetActorIdsByActorId[previousActorId]).toContain(retainedTargetId);
    expect(source.legalTargetActorIdsByActorId[nextActorId]).toContain(retainedTargetId);

    saveOperationSceneDraft(runId, view.planVersion, view.currentLocationId, {
      selections: [{ sceneActionId: source.id, actorId: previousActorId, targetActorIds: [retainedTargetId] }],
      cards: [],
    });
    const sceneAction = { ...source, performerPolicy: 'selected-student' as const };
    const syntheticView: OperationView = {
      ...view,
      currentSceneActions: view.currentSceneActions.map(action => action.id === source.id ? sceneAction : action),
    };
    root.innerHTML = renderOperationWorkspace(createUIContext(game), syntheticView);
    const runtimeBefore = game.operationEntry.getSnapshot();
    const performerChoice = root.querySelector<HTMLButtonElement>(
      '[data-operation-performer-picker][data-card-kind="scene-action"][data-card-identity="' + source.id + '"] [data-performer-actor-id="' + nextActorId + '"]',
    );
    expect(performerChoice).not.toBeNull();
    performerChoice!.click();

    const reassignedDraft = readOperationSceneDraft(runId, view.planVersion, view.currentLocationId)!;
    expect(reassignedDraft.selections).toEqual([{
      sceneActionId: source.id,
      actorId: nextActorId,
      targetActorIds: [retainedTargetId],
    }]);
    expect(game.operationEntry.getSnapshot()).toEqual(runtimeBefore);

    const workspace = root.querySelector<HTMLElement>('[data-workspace-frame="operation"]')!;
    const serialized = saveSceneDraftFromWorkspace(workspace)!;
    expect(serialized.selections).toEqual(reassignedDraft.selections);
    const batch = readOperationSceneBatchCommand(view, { runId, planVersion: view.planVersion }, serialized);
    expect(batch.selections).toEqual([{
      sceneActionId: source.id,
      actorId: nextActorId,
      targetActorIds: [retainedTargetId],
    }]);
  });

  it('改派 Global SceneAction 后序列化并构造批次时保留空目标意图', () => {
    const previousActorId = IDS.actors.hoshino;
    const nextActorId = IDS.actors.serika;
    expect(targetsAfterPerformerChange({ actorId: previousActorId, targetActorIds: [IDS.actors.serika, IDS.actors.shiroko] },
      nextActorId, [IDS.actors.serika, IDS.actors.hoshino])).toEqual([IDS.actors.serika]);
    const runId = enterCarouselExit();
    const view = game.operationEntry.getView(runId)!;
    const source = view.currentSceneActions.find(action => action.scope === 'global' && action.performerPolicy === 'optional-student')!;
    const action: OperationViewSceneAction = {
      ...source,
      scope: 'individual',
      performerPolicy: 'selected-student',
      eligibleActorIds: [nextActorId],
      legalTargetActorIdsByActorId: { [previousActorId]: [IDS.actors.shiroko], [nextActorId]: [IDS.actors.hoshino] },
    };
    const individualView: OperationView = {
      ...view,
      currentActionMode: 'individual',
      currentSceneActions: [action],
    };
    const unselectedTargets = targetsAfterPerformerChange({ actorId: previousActorId, targetActorIds: [IDS.actors.shiroko] },
      nextActorId, action.legalTargetActorIdsByActorId[nextActorId]!);
    expect(unselectedTargets).toEqual([]);
    expect(targetsAfterPerformerChange(undefined, nextActorId, [IDS.actors.hoshino])).toEqual([IDS.actors.hoshino]);
    expect(targetsAfterPerformerChange({ targetActorIds: [IDS.actors.shiroko] }, nextActorId, [IDS.actors.hoshino]))
      .toEqual([IDS.actors.hoshino]);

    const makeWorkspace = (global: boolean, selectedTargets: readonly string[], legalTargets: readonly string[]): HTMLElement => {
      const workspace = document.createElement('section');
      workspace.dataset.workspaceFrame = 'operation';
      const location = document.createElement('div');
      location.dataset.operationLocation = view.currentLocationId;
      const submit = document.createElement('button');
      submit.dataset.operationSceneSubmit = '';
      submit.dataset.runId = runId;
      submit.dataset.planVersion = String(view.planVersion);
      const card = document.createElement('div');
      card.dataset.operationSceneCard = '';
      if (global) card.dataset.globalSceneCard = '';
      card.dataset.actorId = nextActorId;
      const option = document.createElement('div');
      option.dataset.operationSceneOption = '';
      const face = document.createElement('button');
      face.dataset.operationSceneChoice = '';
      face.dataset.sceneActionId = action.id;
      face.dataset.actorId = nextActorId;
      face.dataset.selectedTargetActorIds = JSON.stringify(selectedTargets);
      face.dataset.legalTargetActorIds = JSON.stringify(legalTargets);
      face.setAttribute('aria-pressed', 'true');
      option.append(face);
      card.append(option);
      workspace.append(location, submit, card);
      return workspace;
    };

    const runBefore = game.operationEntry.getSnapshot();
    const workspace = makeWorkspace(false, unselectedTargets, action.legalTargetActorIdsByActorId[nextActorId]!);
    const serialized = saveSceneDraftFromWorkspace(workspace)!;
    expect(serialized.selections).toEqual([{ sceneActionId: action.id, actorId: nextActorId, targetActorIds: [] }]);
    expect(() => readOperationSceneBatchCommand(individualView, { runId, planVersion: view.planVersion }, serialized))
      .toThrow('请为个人行动选择一名目标。');
    const visibleUniqueDefault = [IDS.actors.hoshino];
    expect(saveSceneDraftFromWorkspace(makeWorkspace(false, visibleUniqueDefault, visibleUniqueDefault))?.selections[0]?.targetActorIds)
      .toEqual(visibleUniqueDefault);

    const globalAction = { ...source, performerPolicy: 'selected-student' as const, eligibleActorIds: [nextActorId],
      legalTargetActorIdsByActorId: { [nextActorId]: [IDS.actors.hoshino, IDS.actors.shiroko] } };
    const globalView: OperationView = { ...view, currentActionMode: 'global', currentSceneActions: [globalAction] };
    const globalSerialized = saveSceneDraftFromWorkspace(makeWorkspace(true, [], [IDS.actors.hoshino, IDS.actors.shiroko]))!;
    expect(() => readOperationSceneBatchCommand(globalView, { runId, planVersion: view.planVersion }, globalSerialized))
      .toThrow('请至少选择一名行动目标；也可以取消这张行动并跳过本批。');
    expect(game.operationEntry.getSnapshot()).toEqual(runBefore);
  });

  it('Individual SceneAction 空目标草稿保持未选择，不扩成全部合法目标', () => {
    const runId = enterCarouselExit();
    const view = game.operationEntry.getView(runId)!;
    const source = view.currentSceneActions[0]!;
    const targets = [IDS.actors.hoshino, IDS.actors.serika];
    const action: OperationViewSceneAction = {
      ...source,
      scope: 'individual',
      eligibleActorIds: [IDS.actors.hoshino],
      legalTargetActorIdsByActorId: { [IDS.actors.hoshino]: targets },
    };
    const individualView: OperationView = { ...view, currentActionMode: 'individual', currentSceneActions: [action] };
    const command = { runId, planVersion: view.planVersion };
    const draft = {
      selections: [{ sceneActionId: action.id, actorId: IDS.actors.hoshino, targetActorIds: [] }],
      cards: [],
    };
    expect(() => readOperationSceneBatchCommand(individualView, command, draft)).toThrow('请为个人行动选择一名目标。');
    expect(readOperationSceneBatchCommand(individualView, command, {
      ...draft,
      selections: [{ sceneActionId: action.id, actorId: IDS.actors.hoshino, targetActorIds: [IDS.actors.serika] }],
    }).selections).toEqual([{ sceneActionId: action.id, actorId: IDS.actors.hoshino, targetActorIds: [IDS.actors.serika] }]);
  });

  it('all-eligible SceneAction 明示自动合格目标，序列化保留空手选 ID', () => {
    const runId = enterCarouselExit();
    const view = game.operationEntry.getView(runId)!;
    const source = view.currentSceneActions.find(action => action.scope === 'global' && action.performerPolicy === 'optional-student')!;
    const targetIds = [IDS.actors.serika, IDS.actors.shiroko];
    const groupAction: OperationViewSceneAction = {
      ...source,
      targetSelectionMode: 'all-eligible',
      performerPolicy: 'selected-student',
      eligibleActorIds: [IDS.actors.hoshino],
      legalTargetActorIdsByActorId: { [IDS.actors.hoshino]: targetIds },
    };
    const groupView: OperationView = {
      ...view,
      currentActionMode: 'global',
      sceneActionBatchesRemaining: Math.max(1, view.sceneActionBatchesRemaining ?? 1),
      pendingSceneActionBatch: null,
      currentSceneActions: [groupAction],
    };
    const draft = {
      selections: [{ sceneActionId: groupAction.id, actorId: IDS.actors.hoshino, targetActorIds: [] }],
      cards: [],
    };
    saveOperationSceneDraft(runId, view.planVersion, view.currentLocationId, draft);
    const markup = renderOperationWorkspace(createUIContext(game), groupView);
    root.innerHTML = markup;

    const face = root.querySelector<HTMLButtonElement>(
      '[data-operation-scene-choice][data-scene-action-id="' + groupAction.id + '"]',
    )!;
    expect(face.dataset.targetSelectionMode).toBe('all-eligible');
    expect(JSON.parse(face.dataset.selectedTargetActorIds ?? 'null')).toEqual([]);
    expect(face.dataset.targetSummary).toContain('自动作用于全部合格目标（2）');
    for (const targetId of targetIds) {
      expect(face.textContent).toContain(view.actorStates.find(actor => actor.id === targetId)?.displayName);
    }

    const command = { runId, planVersion: view.planVersion };
    expect(readOperationSceneBatchCommand(groupView, command, draft).selections).toEqual([{
      sceneActionId: groupAction.id,
      actorId: IDS.actors.hoshino,
      targetActorIds: [],
    }]);
    expect(() => readOperationSceneBatchCommand(groupView, command, {
      ...draft,
      selections: [{ ...draft.selections[0]!, targetActorIds: [targetIds[0]!] }],
    })).toThrow('全体目标行动不接受手动目标列表。');
    const emptyGroupView: OperationView = {
      ...groupView,
      currentSceneActions: [{ ...groupAction, legalTargetActorIdsByActorId: { [IDS.actors.hoshino]: [] } }],
    };
    expect(() => readOperationSceneBatchCommand(emptyGroupView, command, draft))
      .toThrow('当前没有合格目标，无法执行全体目标行动。');
  });

  it('fixed SceneAction 作为不可交互牌展示，点击不会从批次移除', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const view = game.operationEntry.getView(runId)!;
    const fixed: OperationViewSceneAction = {
      id: PARK_IDS.sceneActions.controlRecord,
      actionId: PARK_IDS.actions.recordConsole,
      title: '登记控制台记录',
      description: '记录控制室内的设备信息。',
      targetSelectionMode: 'select',
      scope: 'global',
      playerCost: 0,
      selectionPolicy: 'fixed',
      performerPolicy: 'none',
      eligibleActorIds: [],
      legalTargetActorIdsByActorId: {},
      legalActorlessTargetActorIds: [],
    };
    const fixedView = {
      ...view,
      currentLocationId: PARK_IDS.locations.control,
      currentActionMode: 'global',
      sceneActionBatchesRemaining: 1,
      currentSceneActions: [fixed],
    } as OperationView;
    root.innerHTML = renderOperationWorkspace(createUIContext(game), fixedView);
    const fixedFace = root.querySelector<HTMLElement>('[data-operation-fixed-scene-action="' + fixed.id + '"]')!;
    expect(fixedFace.tagName).toBe('DIV');
    expect(fixedFace.classList.contains('is-fixed')).toBe(true);
    expect(fixedFace.classList.contains('is-selected')).toBe(true);
    expect(fixedFace.closest('button')).toBeNull();
    expect(fixedFace.querySelector('[data-operation-scene-choice]')).toBeNull();
    const before = game.operationEntry.getSnapshot();
    fixedFace.click();
    expect(fixedFace.classList.contains('is-selected')).toBe(true);
    expect(game.operationEntry.getSnapshot()).toEqual(before);
  });

  it('Individual 同队治疗牌使用 Runtime 预览整批费用，编辑草稿不写 Run', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    selectActionIfNotCurrent(CAROUSEL_SAFETY_IDS.actions.emergencyStop);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    const view = game.operationEntry.getView(runId)!;
    expect(view.currentActionMode).toBe('individual');
    const aidCard = view.playerCards.hand.find(card => card.eligibleActorIds.includes(IDS.actors.serika)
      && card.legalTargetActorIdsByActorId[IDS.actors.serika]?.includes(IDS.actors.hoshino));
    expect(aidCard).toBeDefined();
    const card = root.querySelector<HTMLElement>('[data-operation-player-card="' + aidCard!.cardInstanceId + '"]')!;
    const projectedActors = JSON.parse(card.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!.dataset.operationPerformerCandidateActorIds ?? '[]') as string[];
    expect(projectedActors).toEqual(aidCard!.eligibleActorIds);
    const secondAidCard = view.playerCards.hand.find(item => item.cardInstanceId !== aidCard!.cardInstanceId && item.actionId === aidCard!.actionId);
    expect(secondAidCard).toBeDefined();
    const secondCard = root.querySelector<HTMLElement>('[data-operation-player-card="' + secondAidCard!.cardInstanceId + '"]')!;
    const planVersion = view.planVersion;
    const runtimeBefore = game.operationEntry.getSnapshot();
    const refreshBefore = controller.getRefreshStats();
    dragPlayerCardToStudent(root, card.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!, IDS.actors.serika, 81);
    let assignedCard = root.querySelector<HTMLElement>('[data-operation-player-card="' + aidCard!.cardInstanceId + '"]')!;
    expect(assignedCard.closest('[data-operation-actor-hand]')?.getAttribute('data-operation-actor-hand')).toBe(IDS.actors.serika);
    expect(root.querySelector('[data-operation-player-hand] [data-operation-player-card="' + aidCard!.cardInstanceId + '"]')).toBeNull();
    const assignedFace = assignedCard.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!;
    assignedFace.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(root.querySelector('[data-operation-drag-relation]')?.getAttribute('visibility')).not.toBe('hidden');
    assignedFace.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
    expect(root.querySelector('[data-operation-drag-relation]')?.getAttribute('visibility')).toBe('hidden');
    expect(assignedCard.querySelector('[data-operation-card-choice-tray]')).toBeNull();
    dragCardToActorTarget(root, assignedFace, IDS.actors.hoshino, 83);
    dragPlayerCardToStudent(root, secondCard.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!, IDS.actors.serika, 82);
    const assignedSecondCard = root.querySelector<HTMLElement>('[data-operation-player-card="' + secondAidCard!.cardInstanceId + '"]')!;
    dragCardToActorTarget(root, assignedSecondCard.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!, IDS.actors.hoshino, 84);
    expect(root.querySelector('[data-operation-cost-preview]')?.textContent).toContain('本批支付 2 PlayerCost');
    expect(root.querySelector<HTMLElement>('[data-operation-cost-preview]')?.dataset.previewStatus).toBe('valid');
    expect(game.operationEntry.getSnapshot()).toEqual(runtimeBefore);
    expect(controller.getRefreshStats()).toMatchObject({ fullRenders: refreshBefore.fullRenders, regionRefreshes: refreshBefore.regionRefreshes + 2 });

    const individualSelections = [...root.querySelectorAll<HTMLElement>('[data-operation-scene-card][data-actor-id]')]
      .map(sceneCard => ({ actorId: sceneCard.dataset.actorId, sceneActionId: sceneCard.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]')?.dataset.sceneActionId }));
    const firstCardInstanceId = aidCard!.cardInstanceId;
    const secondCardInstanceId = secondAidCard!.cardInstanceId;
    const expectedCardTargetIds = [IDS.actors.hoshino];
    controller.requestOperationWorkspaceRefresh(game.operationEntry.getView(runId)!, { type: 'commit' });
    expect(controller.getRefreshStats().regionRefreshes).toBe(refreshBefore.regionRefreshes + 3);
    expect([...root.querySelectorAll<HTMLElement>('[data-operation-scene-card][data-actor-id]')]
      .map(sceneCard => ({ actorId: sceneCard.dataset.actorId, sceneActionId: sceneCard.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]')?.dataset.sceneActionId })))
      .toEqual(individualSelections);
    for (const cardInstanceId of [firstCardInstanceId, secondCardInstanceId]) {
      const restoredCard = root.querySelector<HTMLElement>('[data-operation-player-card="' + cardInstanceId + '"]')!;
      expect(restoredCard.classList.contains('is-selected')).toBe(true);
      expect(restoredCard.querySelector('[data-operation-card-toggle]')?.getAttribute('data-actor-id')).toBe(IDS.actors.serika);
      expect(JSON.parse(restoredCard.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!.dataset.selectedTargetActorIds ?? '[]')).toEqual(expectedCardTargetIds);
    }

    const sceneDraft = readOperationSceneDraft(runId, planVersion, IDS.locations.concourse);
    expect(sceneDraft?.cards).toContainEqual(expect.objectContaining({
      cardInstanceId: firstCardInstanceId,
      actorId: IDS.actors.serika,
      targetActorIds: expectedCardTargetIds,
    }));
  });

  it('Operation 区域重建从内存 SceneDraft 恢复行动牌、执行者、目标和已选玩家卡', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    selectActionIfNotCurrent(CAROUSEL_SAFETY_IDS.actions.emergencyStop);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();

    const individualView = game.operationEntry.getView(runId)!;
    expect(individualView.currentActionMode).toBe('individual');
    const hoshinoCard = root.querySelector<HTMLElement>('[data-operation-scene-card][data-actor-id="' + IDS.actors.hoshino + '"]')!;
    const sceneFaces = [...hoshinoCard.querySelectorAll<HTMLButtonElement>('[data-operation-scene-choice]')];
    const defaultSceneFace = sceneFaces[0]!;
    const defaultActionId = defaultSceneFace.dataset.sceneActionId!;
    const alternateSceneFace = sceneFaces.find(face => face !== defaultSceneFace)!;
    const selectedActionId = alternateSceneFace.dataset.sceneActionId!;
    expect([...hoshinoCard.querySelectorAll<HTMLElement>('[data-operation-scene-option]')].every(option => !option.hidden)).toBe(true);
    alternateSceneFace.click();
    expect(game.operationEntry.getView(runId)?.planVersion).toBe(individualView.planVersion);
    controller.requestOperationWorkspaceRefresh(individualView, { type: 'commit' });
    const restoredHoshino = root.querySelector<HTMLElement>('[data-operation-scene-card][data-actor-id="' + IDS.actors.hoshino + '"]')!;
    expect(restoredHoshino.querySelector('[data-operation-scene-choice][aria-pressed="true"]')?.getAttribute('data-scene-action-id')).toBe(selectedActionId);

    expect([...restoredHoshino.querySelectorAll<HTMLElement>('[data-operation-scene-option]')].every(option => !option.hidden)).toBe(true);
    restoredHoshino.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + defaultActionId + '"]')!.click();

    expect(readOperationSceneDraft(runId, individualView.planVersion, IDS.locations.concourse)?.selections)
      .toContainEqual(expect.objectContaining({ actorId: IDS.actors.hoshino, sceneActionId: defaultActionId }));
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + IDS.routes.staffGate + '"]')!.click();

    const globalView = game.operationEntry.getView(runId)!;
    expect(globalView.currentActionMode).toBe('global');
    const globalCard = root.querySelector<HTMLElement>('[data-global-scene-card]')!;
    const globalFace = globalCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice]')!;
    const performerId = IDS.actors.serika;
    dragSceneActionToStudent(root, globalFace, performerId, 47);
    let attachedGlobalCard = root.querySelector<HTMLElement>('[data-operation-student="' + performerId + '"] [data-global-scene-card]')!;
    expect(root.querySelector('[data-operation-scene-actions] [data-global-scene-card]')).toBeNull();
    expect(attachedGlobalCard.querySelector('[data-operation-scene-performer]')).toBeNull();
    expect(attachedGlobalCard.querySelector('[data-operation-scene-performer-choice]')).toBeNull();
    expect(attachedGlobalCard.querySelector('select')).toBeNull();
    const attachedGlobalFace = attachedGlobalCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice][aria-pressed="true"]')!;
    attachedGlobalFace.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(root.querySelector('[data-operation-drag-relation]')?.getAttribute('visibility')).not.toBe('hidden');
    attachedGlobalFace.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
    expect(root.querySelector('[data-operation-drag-relation]')?.getAttribute('visibility')).toBe('hidden');
    attachedGlobalFace.click();
    expect(root.querySelector('[data-operation-student="' + performerId + '"] [data-global-scene-card]')).toBeNull();
    const returnedGlobalCard = root.querySelector<HTMLElement>('[data-operation-scene-actions] [data-global-scene-card]')!;
    const returnedGlobalFace = returnedGlobalCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice]')!;
    returnedGlobalFace.focus();
    returnedGlobalFace.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(returnedGlobalCard.querySelector('[data-operation-card-choice-tray]')).toBeNull();
    dragSceneActionToStudent(root, returnedGlobalFace, performerId, 92);
    attachedGlobalCard = root.querySelector<HTMLElement>('[data-operation-student="' + performerId + '"] [data-global-scene-card]')!;
    let attachedPerformerFace = attachedGlobalCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice][aria-pressed="true"]')!;
    const globalLegalTargets = JSON.parse(attachedPerformerFace.dataset.legalTargetActorIds ?? '[]') as string[];
    expect(globalLegalTargets.length).toBeGreaterThan(1);
    const draggedTargetId = globalLegalTargets.find(id => id !== performerId) ?? globalLegalTargets[0]!;
    dragCardToActorTarget(root, attachedPerformerFace, draggedTargetId, 50);
    attachedGlobalCard = root.querySelector<HTMLElement>('[data-operation-student="' + performerId + '"] [data-global-scene-card]')!;
    attachedPerformerFace = attachedGlobalCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice][aria-pressed="true"]')!;
    expect(attachedPerformerFace.dataset.actorId).toBe(performerId);
    const draggedTargetName = root.querySelector<HTMLElement>('[data-operation-actor-target="' + draggedTargetId + '"] header strong')?.textContent?.trim();
    expect(draggedTargetName).toBeTruthy();
    expect(attachedPerformerFace.dataset.targetSummary).toContain(draggedTargetName!);
    expect(readOperationSceneDraft(runId, globalView.planVersion, globalView.currentLocationId)?.selections)
      .toContainEqual(expect.objectContaining({ sceneActionId: attachedPerformerFace.dataset.sceneActionId, actorId: performerId, targetActorIds: [draggedTargetId] }));
    const nextSceneTarget = globalLegalTargets.find(id => id !== draggedTargetId)!;
    dragCardToActorTarget(root, attachedPerformerFace, nextSceneTarget, 51);
    attachedPerformerFace = root.querySelector<HTMLButtonElement>('[data-operation-student="' + performerId + '"] [data-global-scene-card] [data-operation-scene-choice][aria-pressed="true"]')!;
    const selectedSceneTargets = JSON.parse(attachedPerformerFace.dataset.selectedTargetActorIds ?? '[]') as string[];
    expect(selectedSceneTargets.length).toBeGreaterThan(0);

    let playerCardFace = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-card-toggle]')]
      .find(face => face.dataset.performerPolicy !== 'none')!;
    const playerOwnerId = (JSON.parse(playerCardFace.dataset.operationPerformerCandidateActorIds ?? '[]') as string[])[0];
    dragPlayerCardToStudent(root, playerCardFace, playerOwnerId, 91);
    playerCardFace = root.querySelector<HTMLButtonElement>('[data-operation-player-card] [data-operation-card-toggle][data-actor-id="' + playerOwnerId + '"]')!;
    const playerCard = playerCardFace.closest<HTMLElement>('[data-operation-player-card]')!;
    const cardActorId = playerCardFace.dataset.actorId!;
    const cardLegalTargets = JSON.parse(playerCardFace.dataset.legalTargetActorIds ?? '[]') as string[];
    if (cardLegalTargets.length > 1) dragCardToActorTarget(root, playerCardFace, cardLegalTargets[0]!, 93);
    playerCardFace = root.querySelector<HTMLButtonElement>('[data-operation-player-card="' + playerCard.dataset.operationPlayerCard + '"] [data-operation-card-toggle]')!;
    const cardTargetIds = JSON.parse(playerCardFace.dataset.selectedTargetActorIds ?? '[]') as string[];
    expect(cardTargetIds.length).toBeGreaterThan(0);
    const selectedCardInstanceId = playerCard.dataset.operationPlayerCard!;

    const refreshBefore = controller.getRefreshStats().regionRefreshes;
    controller.requestOperationWorkspaceRefresh(globalView, { type: 'commit' });
    expect(controller.getRefreshStats().regionRefreshes).toBe(refreshBefore + 1);
    const restoredGlobalCard = root.querySelector<HTMLElement>('[data-operation-student="' + performerId + '"] [data-global-scene-card]')!;
    const restoredGlobalFace = restoredGlobalCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice][aria-pressed="true"]')!;
    expect(restoredGlobalFace.dataset.sceneActionId).toBe(globalFace.dataset.sceneActionId);
    expect(restoredGlobalFace.dataset.actorId).toBe(performerId);
    expect(restoredGlobalCard.closest('[data-operation-student]')?.getAttribute('data-operation-student')).toBe(performerId);
    expect(JSON.parse(restoredGlobalCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice][aria-pressed="true"]')!.dataset.selectedTargetActorIds ?? '[]')).toEqual(selectedSceneTargets);
    const restoredPlayerCard = root.querySelector<HTMLElement>('[data-operation-player-card="' + selectedCardInstanceId + '"]')!;
    expect(restoredPlayerCard.classList.contains('is-selected')).toBe(true);
    expect(restoredPlayerCard.querySelector('[data-operation-card-toggle]')?.getAttribute('data-actor-id')).toBe(cardActorId);
    expect(JSON.parse(restoredPlayerCard.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!.dataset.selectedTargetActorIds ?? '[]')).toEqual(cardTargetIds);

    const sceneDraft = readOperationSceneDraft(runId, globalView.planVersion, IDS.locations.exit);
    expect(sceneDraft?.selections).toContainEqual(expect.objectContaining({
      sceneActionId: globalFace.dataset.sceneActionId,
      actorId: performerId,
      targetActorIds: selectedSceneTargets,
    }));
    expect(sceneDraft?.cards).toContainEqual(expect.objectContaining({
      cardInstanceId: selectedCardInstanceId,
      actorId: cardActorId,
      targetActorIds: cardTargetIds,
    }));
    expect(defaultSceneFace.dataset.sceneActionId).toBe(defaultActionId);
  });

  it('拒绝过期 planVersion 时显示可读提示并刷新到当前版本', () => {
    acquireStudents();
    startFromFeed();
    const action = root.querySelector<HTMLButtonElement>('[data-operation-commit]')!;
    action.dataset.planVersion = '999';
    const regionBefore = controller.getRefreshStats().regionRefreshes;
    action.click();

    expect(controller.getRefreshStats().regionRefreshes).toBe(regionBefore + 1);
    expect(root.querySelector('[data-operation-command-notice]')?.textContent).toContain('行动计划刚刚更新了');
    expect(root.querySelector<HTMLButtonElement>('[data-operation-action]')?.dataset.planVersion).not.toBe('999');
    expect(controller.getRefreshObservations().at(-1)).toMatchObject({ scope: 'region', reason: 'operation-command', outcome: 'applied' });
  });

  it('场景提交失败时保留卡片、主流和坞站节点身份并聚焦错误提示', () => {
    acquireStudents();
    startFromFeed();
    selectActionIfNotCurrent(CAROUSEL_SAFETY_IDS.actions.emergencyStop);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    selectSceneAction(IDS.actors.hoshino, IDS.sceneActions.inspect);
    const student = root.querySelector<HTMLElement>('[data-operation-student="' + IDS.actors.hoshino + '"]')!;
    const choice = root.querySelector<HTMLElement>('[data-operation-scene-card][data-actor-id="' + IDS.actors.hoshino + '"] [data-operation-scene-choice][aria-pressed="true"]')!;
    const selectedActionId = IDS.sceneActions.inspect;
    expect(choice.dataset.sceneActionId).toBe(selectedActionId);
    const stream = root.querySelector('[data-operation-log]');
    const dock = root.querySelector('[data-operation-commit-dock]');
    const submit = root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!;
    submit.dataset.planVersion = '999';
    const regionBefore = controller.getRefreshStats().regionRefreshes;
    submit.click();

    expect(controller.getRefreshStats().regionRefreshes).toBe(regionBefore + 1);
    expect(root.querySelector('[data-operation-student="' + IDS.actors.hoshino + '"]')).toBe(student);
    expect(root.querySelector<HTMLElement>('[data-operation-scene-card][data-actor-id="' + IDS.actors.hoshino + '"] [data-operation-scene-choice][aria-pressed="true"]')?.dataset.sceneActionId).toBe(selectedActionId);
    expect(root.querySelector('[data-operation-log]')).toBe(stream);
    expect(root.querySelector('[data-operation-commit-dock]')).toBe(dock);
    expect(root.querySelector('[data-operation-command-notice]')?.textContent).toContain('行动计划刚刚更新了');
    expect(document.activeElement).toBe(root.querySelector('[data-operation-command-notice]'));
  });

  it('出口急救可以就地激活并指定绝对目标', () => {
    const runId = enterCarouselExit();
    const view = game.operationEntry.getView(runId)!;
    const planVersion = view.planVersion;
    const face = root.querySelector<HTMLButtonElement>('[data-global-scene-card] [data-operation-scene-choice]')!;
    expect(face.dataset.performerPolicy).toBe('optional-student');
    expect(face.getAttribute('aria-pressed')).toBe('false');
    face.click();
    expect(face.getAttribute('aria-pressed')).toBe('true');
    expect(face.dataset.actorId).toBe('');
    face.focus();
    face.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(root.querySelector('[data-operation-card-choice-tray]')).toBeNull();
    dragCardToActorTarget(root, face, IDS.actors.shiroko, 112);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    expect(game.operationEntry.getView(runId)).toMatchObject({ status: 'success', playerCost: view.playerCost - 2 });
    expect(game.operationEntry.getView(runId)?.resolutions.at(-1)?.sceneBatch?.selections).toEqual([
      { sceneActionId: IDS.sceneActions.firstAid, targetActorIds: [IDS.actors.shiroko] },
    ]);
    expect(readOperationSceneDraft(runId, planVersion, IDS.locations.exit)).toBeUndefined();

  });

  it('空选择可以跳过出口批次且保留全部 Cost', () => {
    const skippedRunId = enterCarouselExit();
    const beforeCost = game.operationEntry.getView(skippedRunId)!.playerCost;
    root.querySelector<HTMLButtonElement>('[data-operation-scene-skip]')!.click();
    expect(game.operationEntry.getView(skippedRunId)).toMatchObject({ status: 'success', playerCost: beforeCost });
    expect(game.operationEntry.getView(skippedRunId)?.resolutions.at(-1)?.sceneBatch).toMatchObject({ selections: [], playerCostPaid: 0 });
  });

  it('玩家场景牌可以在公共手牌区就地激活，无需挂到学生', () => {
    const runId = enterCarouselExit();
    const beforeCost = game.operationEntry.getView(runId)!.playerCost;
    const face = root.querySelector<HTMLButtonElement>('[data-operation-player-card] [data-operation-card-toggle][data-performer-policy="optional-student"]')!;
    expect(face.dataset.actorId).toBe('');
    face.click();
    expect(face.getAttribute('aria-pressed')).toBe('true');
    for (const targetId of [IDS.actors.hoshino, IDS.actors.serika, IDS.actors.shiroko]) dragCardToActorTarget(root, face, targetId, 121);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    const view = game.operationEntry.getView(runId)!;
    expect(view.status).toBe('success');
    expect(view.playerCost).toBe(beforeCost - 1);
    expect(view.resolutions.at(-1)?.sceneBatch).toMatchObject({
      selections: [],
      cards: [expect.objectContaining({ playerCost: 1, targetActorIds: [IDS.actors.hoshino, IDS.actors.serika, IDS.actors.shiroko] })],
    });
    expect(view.resolutions.at(-1)?.sceneBatch?.cards[0]).not.toHaveProperty('actorId');
  });
});
