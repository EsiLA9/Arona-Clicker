// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { REST_SCENE_DEMO_IDS as REST_IDS } from '../../src/arona-clicker/content/operation-samples/rest-scene-demo';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import type { OperationView } from '../../src/arona-clicker/contracts/operation-view';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { UIController } from '../../src/ui/controller';
import { readOperationSceneBatchCommand } from '../../src/ui/controller-actions-operation';
import { renderOperationWorkspace } from '../../src/ui/components/operation-workspace';
import { createUIContext } from '../../src/ui/context';

function dragCardToActorTarget(root: HTMLElement, face: HTMLButtonElement, targetActorId: string, pointerId: number): void {
  const target = root.querySelector<HTMLElement>('[data-operation-actor-target="' + targetActorId + '"]');
  if (!target) throw new Error('Expected a legal Actor target card.');
  const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  const pointer = (type: string, x: number, y: number): PointerEvent => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { configurable: true, value: pointerId });
    return event as PointerEvent;
  };
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target });
  try {
    face.dispatchEvent(pointer('pointerdown', 2, 2));
    root.dispatchEvent(pointer('pointermove', 18, 18));
    face.dispatchEvent(pointer('pointerup', 18, 18));
  } finally {
    if (originalElementFromPoint) Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
    else Reflect.deleteProperty(document, 'elementFromPoint');
  }
}

describe('Gameplay B automatic Rest Scene UI', () => {
  let game: GameInstance;
  let controller: UIController;
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
    game.mutations.acquireCharacter('Hoshino', 'story');
    game.mutations.acquireCharacter('Serika', 'story');
    controller = new UIController(game, root);
    controller.started = true;
    controller.render();
  });

  afterEach(() => {
    controller.destroy();
    if (game.running) game.stop();
    localStorage.clear();
  });

  function startRest(): string {
    const start = root.querySelector<HTMLButtonElement>('[data-operation-start="' + REST_IDS.event + '"]');
    expect(start).not.toBeNull();
    expect(start?.disabled).toBe(false);
    start!.click();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    expect(runId).not.toBe('');
    return runId;
  }

  test('directly commits two Character plans, then a Player SceneCard in the second batch', () => {
    const runId = startRest();
    const initial = game.operationEntry.getView(runId)!;
    expect(initial).toMatchObject({
      currentSceneId: REST_IDS.scene,
      currentScene: { autoCharacterActions: true },
      currentActionMode: 'global',
      sceneActionBatchesRemaining: null,
      playerCost: 2,
    });
    expect(initial.playerCards.hand).toHaveLength(2);
    expect(root.querySelectorAll('[data-operation-scene-plan-state="automatic"]')).toHaveLength(2);
    expect(root.querySelectorAll('[data-card-kind="scene-character-action"]')).toHaveLength(4);
    expect(root.querySelector('[data-operation-scene-completion]')?.textContent).toContain('rest readiness ≥ 4');
    expect(root.querySelector<HTMLElement>('[data-operation-cost-preview]')?.dataset.previewStatus).toBe('valid');
    expect(initial.interventionDraft).toBeNull();

    const autoOnlyView = { ...initial, currentActionMode: null, currentSceneActions: [] } as OperationView;
    const autoOnlyHost = document.createElement('div');
    autoOnlyHost.innerHTML = renderOperationWorkspace(createUIContext(game), autoOnlyView);
    expect(autoOnlyHost.querySelector('[data-operation-scene-submit]')).not.toBeNull();
    const autoOnlyCommand = readOperationSceneBatchCommand(autoOnlyView, { runId, planVersion: initial.planVersion }, { selections: [], cards: [], purchases: [] });
    expect(autoOnlyCommand).toMatchObject({ runId, planVersion: initial.planVersion, selections: [] });
    expect(autoOnlyCommand.cards).toBeUndefined();

    const firstSubmit = root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!;
    expect(firstSubmit.disabled).toBe(false);
    firstSubmit.click();
    const afterFirst = game.operationEntry.getView(runId)!;
    expect(afterFirst).toMatchObject({
      status: 'inProgress',
      tracks: { [REST_IDS.track]: 3 },
      sceneActionBatchesUsed: 1,
      playerCost: 2,
    });
    expect(afterFirst.resolutions.at(-1)?.actorPlans.filter(plan => plan.kind === 'studentAction')).toHaveLength(2);
    expect(afterFirst.resolutions.at(-1)?.sceneBatch?.cards).toEqual([]);
    expect(afterFirst.resolutions.at(-1)?.sceneBatch?.selections).toContainEqual(expect.objectContaining({ sceneActionId: REST_IDS.sceneAction }));
    expect(afterFirst.playerCards.hand.map(card => card.cardInstanceId)).toEqual(initial.playerCards.hand.map(card => card.cardInstanceId));

    const card = root.querySelector<HTMLButtonElement>('[data-operation-player-hand] [data-operation-card-toggle]')!;
    card.click();
    expect(root.querySelector<HTMLElement>('[data-operation-cost-preview]')?.textContent).toContain('本批支付 1 PlayerCost · 余额 2 → 1');
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();

    const completed = game.operationEntry.getView(runId)!;
    expect(completed).toMatchObject({ status: 'success', tracks: { [REST_IDS.track]: 4 }, playerCost: 1 });
    expect(completed.playerCards.hand).toHaveLength(1);
    expect(completed.playerCards.hand[0]?.cardInstanceId).not.toBe(card.dataset.cardInstanceId);
    expect(completed.resolutions.at(-1)?.actorPlans.filter(plan => plan.kind === 'studentAction')).toHaveLength(2);
    expect(completed.resolutions.at(-1)?.sceneBatch?.cards).toHaveLength(1);
    expect(root.querySelector('[data-operation-outcome]')?.textContent).toContain('行动成功');

    root.querySelector<HTMLButtonElement>('[data-operation-back]')!.click();
    const restart = root.querySelector<HTMLButtonElement>('[data-operation-start="' + REST_IDS.event + '"]')!;
    expect(restart.textContent).toContain('重新开始Gameplay B 休整演示');
    restart.click();
    const replayRunId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    expect(replayRunId).not.toBe(runId);
    expect(game.operationEntry.getView(replayRunId)).toMatchObject({ tracks: { [REST_IDS.track]: 0 }, playerCards: { hand: expect.any(Array) } });
  });

  test('labels an automatic target override, restores it on undo, and commits only that Character override', () => {
    const runId = startRest();
    const initial = game.operationEntry.getView(runId)!;
    const hoshinoId = CAROUSEL_SAFETY_IDS.actors.hoshino;
    const serikaId = CAROUSEL_SAFETY_IDS.actors.serika;
    const hoshinoDefault = initial.basePreparedBeat!.actorPlans.find(plan => plan.actorId === hoshinoId)!;
    const serikaDefault = initial.basePreparedBeat!.actorPlans.find(plan => plan.actorId === serikaId)!;
    expect([REST_IDS.actions.care, REST_IDS.actions.tea]).toContain(hoshinoDefault.actionId);
    expect(hoshinoDefault.targetActorId).toBe(serikaId);
    const targetActionId = hoshinoDefault.actionId;

    const selectedAction = root.querySelector<HTMLButtonElement>('[data-operation-action-current][data-operation-action][data-operation-action-owner-id="' + hoshinoId + '"]')!;
    expect(selectedAction.dataset.cardKind).toBe('scene-character-action');
    dragCardToActorTarget(root, selectedAction, hoshinoId, 91);

    const revised = game.operationEntry.getView(runId)!;
    expect(revised.interventionDraft).toMatchObject({ actorId: hoshinoId, actionId: targetActionId, targetActorId: hoshinoId });
    expect(revised.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === hoshinoId)?.targetActorId).toBe(hoshinoId);
    expect(revised.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === serikaId)).toEqual(serikaDefault);
    expect(root.querySelector('[data-operation-scene-plan-state="intervention"]')?.textContent).toContain('玩家覆盖');

    root.querySelector<HTMLButtonElement>('[data-operation-clear][data-actor-id="' + hoshinoId + '"]')!.click();
    const restored = game.operationEntry.getView(runId)!;
    expect(restored.interventionDraft).toBeNull();
    expect(restored.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === hoshinoId)).toEqual(hoshinoDefault);
    expect(root.querySelector('[data-operation-scene-plan-state="automatic"]')?.textContent).toContain('目标：黑见芹香');

    const currentAction = root.querySelector<HTMLButtonElement>('[data-operation-action-current][data-operation-action][data-operation-action-owner-id="' + hoshinoId + '"]')!;
    dragCardToActorTarget(root, currentAction, hoshinoId, 92);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    expect(game.operationEntry.getView(runId)?.resolutions.at(-1)?.actorPlans).toContainEqual(expect.objectContaining({
      actorId: hoshinoId,
      actionId: targetActionId,
      targetActorId: hoshinoId,
    }));
    expect(game.operationEntry.getView(runId)?.resolutions.at(-1)?.actorPlans).toContainEqual(serikaDefault);
  });

  test('Skip still commits the fixed SceneAction and both automatic Character plans', () => {
    const runId = startRest();
    const before = game.operationEntry.getView(runId)!;
    root.querySelector<HTMLButtonElement>('[data-operation-scene-skip]')!.click();
    const afterSkip = game.operationEntry.getView(runId)!;
    expect(afterSkip).toMatchObject({
      status: 'inProgress',
      tracks: { [REST_IDS.track]: 3 },
      sceneActionBatchesUsed: 1,
      playerCost: 2,
    });
    expect(afterSkip.playerCards.hand.map(card => card.cardInstanceId)).toEqual(before.playerCards.hand.map(card => card.cardInstanceId));
    const skippedBatch = afterSkip.resolutions.at(-1)!;
    expect(skippedBatch.sceneBatch?.skip).toBe(true);
    expect(skippedBatch.sceneBatch?.selections).toContainEqual(expect.objectContaining({ sceneActionId: REST_IDS.sceneAction }));
    expect(skippedBatch.actorPlans.filter(plan => plan.kind === 'studentAction')).toHaveLength(2);

    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    expect(game.operationEntry.getView(runId)?.status).toBe('success');
  });

  test('projects a legal no-action plan as an explicit Wait on the automatic Scene surface', () => {
    const runId = startRest();
    const view = game.operationEntry.getView(runId)!;
    const actorId = CAROUSEL_SAFETY_IDS.actors.hoshino;
    const defaultPlan = view.basePreparedBeat!.actorPlans.find(plan => plan.actorId === actorId)!;
    const waitPlan = {
      ...defaultPlan,
      kind: 'wait' as const,
      actionId: 'operation:action:wait',
      targetActorId: null,
      cost: null,
      reasonIds: ['operation:plan:no-candidate-action'],
    };
    const waitBeat = {
      ...view.basePreparedBeat!,
      actorPlans: view.basePreparedBeat!.actorPlans.map(plan => plan.actorId === actorId ? waitPlan : plan),
    };
    const waitView = {
      ...view,
      actorStates: view.actorStates.map(actor => actor.id === actorId
        ? { ...actor, currentPlan: waitPlan, profile: actor.profile ? { ...actor.profile, actionOptions: [] } : undefined }
        : actor),
      basePreparedBeat: waitBeat,
      effectivePreparedBeat: waitBeat,
    } as OperationView;
    const host = document.createElement('div');
    host.innerHTML = renderOperationWorkspace(createUIContext(game), waitView);
    expect(host.querySelector('[data-operation-scene-plan-state="wait"]')?.textContent).toContain('等待');
    expect(host.querySelector('[data-operation-action-current-toggle][data-operation-action-owner-id="' + actorId + '"]')?.textContent).toContain('待命');
  });
});
