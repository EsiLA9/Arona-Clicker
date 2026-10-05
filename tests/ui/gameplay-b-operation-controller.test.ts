// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { UIController } from '../../src/ui/controller';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const VARIANTS = ['Hoshino', 'Serika', 'Shiroko'] as const;

function pointer(type: string, x: number, y: number, pointerId = 17): PointerEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { configurable: true, value: pointerId });
  return event as PointerEvent;
}

describe('Gameplay B Operation Controller', () => {
  let game: GameInstance;
  let controller: UIController;
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
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

      root.querySelector<HTMLButtonElement>('[data-operation-start]')!.click();
      const operation = controller.panelState.workspace;
      expect(operation?.type).toBe('operation');
      if (operation?.type !== 'operation') throw new Error('Operation route did not open');
      expect(game.operationEntry.getView(operation.runId)).not.toBeNull();
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
    const alternateTarget = root.querySelector<HTMLButtonElement>(
      '[data-operation-target][data-actor-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"][data-action-id="' + CAROUSEL_SAFETY_IDS.actions.brace + '"]:not([aria-pressed="true"])',
    );
    expect(alternateTarget).not.toBeNull();
    alternateTarget!.click();
    expect(game.operationEntry.getView(runId)?.interventionDraft?.targetActorId).toBe(alternateTarget!.dataset.targetActorId);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);

    root.querySelector<HTMLButtonElement>('[data-operation-clear]')!.click();
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);

    const actionAlternatives = root.querySelector<HTMLButtonElement>('[data-operation-student="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"] [data-operation-action-disclosure]');
    expect(actionAlternatives?.getAttribute('aria-expanded')).toBe('false');
    actionAlternatives!.click();
    const emergencyStopButton = root.querySelector<HTMLButtonElement>('[data-operation-action][data-actor-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"][data-action-id="' + CAROUSEL_SAFETY_IDS.actions.emergencyStop + '"]')!;
    emergencyStopButton.click();
    expect(game.operationEntry.getView(runId)?.interventionDraft).toMatchObject({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop,
    });
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect((document.activeElement as HTMLElement).dataset.actionId).toBe(CAROUSEL_SAFETY_IDS.actions.emergencyStop);
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBe(stableFrame);
    expect(root.querySelector('[data-operation-log]')).toBe(stableStream);
    expect(root.querySelector('[data-operation-student="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"]')).toBe(stableStudent);
    expect(root.querySelector('[data-operation-action][data-action-id="' + CAROUSEL_SAFETY_IDS.actions.emergencyStop + '"]')).toBe(emergencyStopButton);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    expect(game.operationEntry.getView(runId)?.currentLocationId).toBe(IDS.locations.concourse);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBe(stableFrame);
    expect(root.querySelector('[data-operation-log]')).toBe(stableStream);
    expect(root.querySelector('[data-operation-commit-dock]')).toBe(stableDock);

    const individualCards = [...root.querySelectorAll<HTMLElement>('[data-operation-scene-card][data-actor-id]')];
    expect(individualCards).toHaveLength(3);
    expect(root.querySelector('[data-operation-scene-selection]')).toBeNull();
    const preselectedActions = individualCards.map(card => card.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]')?.dataset.sceneActionId);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!.click();
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(game.operationEntry.getView(runId)?.pendingSceneActionBatch).not.toBeNull();
    expect(document.activeElement).toBe(root.querySelector('[data-operation-scene-commit]'));
    root.querySelector<HTMLButtonElement>('[data-operation-clear-scene]')!.click();
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(document.activeElement).toBe(root.querySelector('[data-operation-scene-stage]'));
    const restoredActions = [...root.querySelectorAll<HTMLElement>('[data-operation-scene-card][data-actor-id]')]
      .map(card => card.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]')?.dataset.sceneActionId);
    expect(restoredActions).toEqual(preselectedActions);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!.click();
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-commit]')!.click();
    expect(game.operationEntry.getView(runId)?.heldItemIds).toContain(IDS.item);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);

    root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + IDS.routes.staffGate + '"]')!.click();
    expect(game.operationEntry.getView(runId)?.currentLocationId).toBe(IDS.locations.exit);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBe(stableFrame);
    expect(root.querySelector('[data-operation-log]')).toBe(stableStream);
    expect(root.querySelector('[data-operation-commit-dock]')).toBe(stableDock);
    root.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!.click();
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-commit]')!.click();
    expect(game.operationEntry.getView(runId)?.status).toBe('success');
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    root.querySelector<HTMLButtonElement>('[data-operation-reward]')!.click();
    expect(game.operationEntry.getView(runId)?.rewardClaimed).toBe(true);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);

    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect(root.querySelector('[data-operation-outcome]')?.textContent).toContain('行动成功');
    const operationUpdates = controller.getRefreshObservations().filter(item => item.reason === 'operation-command').slice(-10);
    expect(operationUpdates).toHaveLength(10);
    for (const observation of operationUpdates) expect(observation).toMatchObject({ scope: 'region', outcome: 'applied' });
  });

  it('角色卡悬停与聊天流滚动不触发 Operation 查询或 UI 重建', () => {
    acquireStudents();
    startFromFeed();
    const before = controller.getRefreshStats();
    root.querySelector<HTMLElement>('.operation-action-choice')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    root.querySelector<HTMLElement>('[data-operation-log]')?.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBe(before.regionRefreshes);
  });

  it('卡片选择只更新当前 DOM，不改 Runtime 计划或触发刷新', () => {
    acquireStudents();
    startFromFeed();
    root.querySelector<HTMLButtonElement>('[data-operation-action][data-action-id="' + CAROUSEL_SAFETY_IDS.actions.emergencyStop + '"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    const workspace = root.querySelector<HTMLElement>('[data-workspace-frame="operation"]')!;
    const student = root.querySelector<HTMLElement>('[data-operation-student="' + IDS.actors.hoshino + '"]')!;
    const planVersion = game.operationEntry.getSnapshot()!.planVersion;
    const regionBefore = controller.getRefreshStats().regionRefreshes;
    const alternatives = workspace.querySelector<HTMLButtonElement>('[data-operation-scene-choice]:not([aria-pressed="true"])');
    expect(alternatives).not.toBeNull();
    workspace.querySelector<HTMLButtonElement>('[data-operation-scene-alternatives]')!.click();
    alternatives!.click();
    expect(alternatives!.getAttribute('aria-pressed')).toBe('true');
    expect(game.operationEntry.getSnapshot()!.planVersion).toBe(planVersion);
    expect(controller.getRefreshStats().regionRefreshes).toBe(regionBefore);
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBe(workspace);
    expect(root.querySelector('[data-operation-student="' + IDS.actors.hoshino + '"]')).toBe(student);
    const selectedActorId = alternatives!.dataset.actorId;
    const selectedActionId = alternatives!.dataset.sceneActionId;
    const stageButton = root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!;
    stageButton.click();
    const staged = game.operationEntry.getView(stageButton.dataset.runId)?.pendingSceneActionBatch;
    expect(staged?.preview.selections.find(selection => selection.actorId === selectedActorId)?.sceneActionId).toBe(selectedActionId);
  });

  it('行动牌拖向合法人物会显示临时关系并写入正确边界的草稿', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const initialView = game.operationEntry.getView(runId)!;
    const actionFace = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-action][aria-pressed="true"]')]
      .find(face => (JSON.parse(face.dataset.legalTargetActorIds ?? '[]') as string[])
        .some(id => id !== face.dataset.defaultTargetActorId))!;
    expect(actionFace).toBeDefined();
    const legalTargets = JSON.parse(actionFace.dataset.legalTargetActorIds ?? '[]') as string[];
    const dropTargetId = legalTargets.find(id => id !== actionFace.dataset.defaultTargetActorId)!;
    const dropTarget = [...root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')]
      .find(actor => actor.dataset.operationActorTarget === dropTargetId)!;
    const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    expect(actionFace.tagName).toBe('BUTTON');
    expect(actionFace.tabIndex).toBe(0);
    expect(actionFace.getAttribute('aria-label')).toContain('行动');
    const targetTray = actionFace.parentElement?.querySelector<HTMLElement>('.operation-action-targets')!;
    actionFace.focus();
    actionFace.click();
    expect(targetTray.hidden).toBe(false);
    expect(document.activeElement).toBe(targetTray.querySelector('[data-operation-target]:not([aria-pressed="true"])'));
    actionFace.click();
    expect(targetTray.hidden).toBe(true);
    const illegalTarget = [...root.querySelectorAll<HTMLElement>('[data-operation-actor-target]')]
      .find(actor => !legalTargets.includes(actor.dataset.operationActorTarget ?? ''))!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => dropTarget });
    try {
      actionFace.dispatchEvent(pointer('pointerdown', 2, 2, 19));
      root.dispatchEvent(pointer('pointermove', 18, 18, 19));
      expect(dropTarget.classList.contains('is-card-legal-target')).toBe(true);
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(dropTarget.classList.contains('is-card-legal-target')).toBe(false);
      expect(document.activeElement).toBe(actionFace);
      expect(game.operationEntry.getView(runId)?.planVersion).toBe(initialView.planVersion);
      expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();

      actionFace.dispatchEvent(pointer('pointerdown', 2, 2, 21));
      root.dispatchEvent(pointer('pointermove', 18, 18, 21));
      expect(actionFace.classList.contains('is-card-drag-source')).toBe(true);
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
      expect(dropTarget.classList.contains('is-card-legal-target')).toBe(true);
      expect(dropTarget.classList.contains('is-card-hover-target')).toBe(true);
      expect(root.querySelector('[data-operation-drag-relation]')?.getAttribute('d')).toContain('M');
      expect(game.operationEntry.getSnapshot()!.planVersion).toBe(initialView.planVersion);
      actionFace.dispatchEvent(pointer('pointerup', 18, 18));
    } finally {
      if (originalElementFromPoint) Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
      else Reflect.deleteProperty(document, 'elementFromPoint');
    }
    expect(game.operationEntry.getView(runId)?.interventionDraft).toMatchObject({
      actorId: actionFace.dataset.actorId,
      actionId: actionFace.dataset.actionId,
      targetActorId: dropTargetId,
    });
    expect(game.operationEntry.getView(runId)!.planVersion).toBeGreaterThan(initialView.planVersion);
    expect(root.querySelector('[data-operation-action][data-actor-id="' + actionFace.dataset.actorId + '"][data-action-id="' + actionFace.dataset.actionId + '"]')).toBe(actionFace);
    expect(document.activeElement).toBe(actionFace);

    // Reset this isolated drag scenario so the existing safety plan takes its normal route to Individual actions.
    root.querySelector<HTMLButtonElement>('[data-operation-clear]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-scene-commit]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + IDS.routes.staffGate + '"]')!.click();
    const sceneView = game.operationEntry.getView(runId)!;
    const cardFace = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-card-toggle]')]
      .find(face => (JSON.parse(face.dataset.legalTargetActorIds ?? '[]') as string[]).length > 0)!;
    expect(sceneView.currentActionMode).toBe('global');
    expect(cardFace).toBeDefined();
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
    const targetName = cardFace.closest<HTMLElement>('[data-operation-player-card]')!
      .querySelector<HTMLElement>('[data-operation-card-target][data-target-actor-id="' + cardTargetId + '"]')?.textContent?.trim();
    expect(targetName).toBeTruthy();
    expect(visibleCardTarget?.textContent).toContain(targetName!);
    expect(cardFace.getAttribute('aria-label')).toContain(targetName!);
    expect(cardFace.getAttribute('aria-label')).toContain('已加入本批');
    expect(cardFace.querySelector('[data-operation-card-status]')?.textContent).toBe('已加入');
    root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!.click();
    const staged = game.operationEntry.getView(runId)?.pendingSceneActionBatch;
    expect(staged?.preview.cards.find(card => card.cardInstanceId === cardFace.closest<HTMLElement>('[data-operation-player-card]')?.dataset.operationPlayerCard)?.targetActorIds).toContain(cardTargetId);
  });

  it('Individual 同队治疗牌使用自身候选并预览整批费用，点击不查询或写 Run', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    root.querySelector<HTMLButtonElement>('[data-operation-action][data-action-id="' + CAROUSEL_SAFETY_IDS.actions.emergencyStop + '"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    const view = game.operationEntry.getView(runId)!;
    expect(view.currentActionMode).toBe('individual');
    const aidCard = view.playerCards.hand.find(card => card.eligibleActorIds.includes(IDS.actors.serika)
      && card.legalTargetActorIdsByActorId[IDS.actors.serika]?.includes(IDS.actors.hoshino));
    expect(aidCard).toBeDefined();
    const card = root.querySelector<HTMLElement>('[data-operation-player-card="' + aidCard!.cardInstanceId + '"]')!;
    const projectedActors = [...card.querySelectorAll<HTMLElement>('[data-operation-card-actor]')].map(button => button.dataset.actorId);
    expect(projectedActors).toEqual(aidCard!.eligibleActorIds);
    const secondAidCard = view.playerCards.hand.find(item => item.cardInstanceId !== aidCard!.cardInstanceId && item.actionId === aidCard!.actionId);
    expect(secondAidCard).toBeDefined();
    const secondCard = root.querySelector<HTMLElement>('[data-operation-player-card="' + secondAidCard!.cardInstanceId + '"]')!;
    const planVersion = view.planVersion;
    const refreshBefore = controller.getRefreshStats();
    card.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!.click();
    card.querySelector<HTMLButtonElement>('[data-operation-card-actor][data-actor-id="' + IDS.actors.serika + '"]')!.click();
    const targets = card.querySelector<HTMLElement>('[data-operation-card-targets-for="' + IDS.actors.serika + '"]')!;
    expect(targets.hidden).toBe(false);
    expect([...targets.querySelectorAll<HTMLElement>('[data-operation-card-target]')].map(button => button.dataset.targetActorId))
      .toEqual(aidCard!.legalTargetActorIdsByActorId[IDS.actors.serika]);
    targets.querySelector<HTMLButtonElement>('[data-target-actor-id="' + IDS.actors.hoshino + '"]')!.click();
    secondCard.querySelector<HTMLButtonElement>('[data-operation-card-toggle]')!.click();
    secondCard.querySelector<HTMLButtonElement>('[data-operation-card-actor][data-actor-id="' + IDS.actors.serika + '"]')!.click();
    secondCard.querySelector<HTMLElement>('[data-operation-card-targets-for="' + IDS.actors.serika + '"]')!
      .querySelector<HTMLButtonElement>('[data-target-actor-id="' + IDS.actors.hoshino + '"]')!.click();
    expect(root.querySelector('[data-operation-cost-preview]')?.textContent).toContain('本批预计 5 Cost');
    expect(game.operationEntry.getSnapshot()!.planVersion).toBe(planVersion);
    expect(controller.getRefreshStats()).toMatchObject({ fullRenders: refreshBefore.fullRenders, regionRefreshes: refreshBefore.regionRefreshes });

    const individualSelections = [...root.querySelectorAll<HTMLElement>('[data-operation-scene-card][data-actor-id]')]
      .map(sceneCard => ({ actorId: sceneCard.dataset.actorId, sceneActionId: sceneCard.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]')?.dataset.sceneActionId }));
    const firstCardInstanceId = aidCard!.cardInstanceId;
    const secondCardInstanceId = secondAidCard!.cardInstanceId;
    const expectedCardTargetIds = [IDS.actors.hoshino];
    controller.requestOperationWorkspaceRefresh(game.operationEntry.getView(runId)!, { type: 'commit' });
    expect(controller.getRefreshStats().regionRefreshes).toBe(refreshBefore.regionRefreshes + 1);
    expect([...root.querySelectorAll<HTMLElement>('[data-operation-scene-card][data-actor-id]')]
      .map(sceneCard => ({ actorId: sceneCard.dataset.actorId, sceneActionId: sceneCard.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]')?.dataset.sceneActionId })))
      .toEqual(individualSelections);
    for (const cardInstanceId of [firstCardInstanceId, secondCardInstanceId]) {
      const restoredCard = root.querySelector<HTMLElement>('[data-operation-player-card="' + cardInstanceId + '"]')!;
      expect(restoredCard.classList.contains('is-selected')).toBe(true);
      expect(restoredCard.querySelector('[data-operation-card-actor][aria-pressed="true"]')?.getAttribute('data-actor-id')).toBe(IDS.actors.serika);
      expect([...restoredCard.querySelectorAll<HTMLElement>('[data-operation-card-targets-for="' + IDS.actors.serika + '"] [data-operation-card-target][aria-pressed="true"]')]
        .map(button => button.dataset.targetActorId)).toEqual(expectedCardTargetIds);
    }

    root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!.click();
    const staged = game.operationEntry.getView(runId)?.pendingSceneActionBatch;
    expect(staged?.preview.cards).toContainEqual(expect.objectContaining({
      cardInstanceId: firstCardInstanceId,
      actorId: IDS.actors.serika,
      targetActorIds: expectedCardTargetIds,
    }));
  });

  it('Operation 区域重建从内存 SceneDraft 恢复行动牌、执行者、目标和已选玩家卡', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    root.querySelector<HTMLButtonElement>('[data-operation-action][data-action-id="' + CAROUSEL_SAFETY_IDS.actions.emergencyStop + '"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();

    const individualView = game.operationEntry.getView(runId)!;
    expect(individualView.currentActionMode).toBe('individual');
    const hoshinoCard = root.querySelector<HTMLElement>('[data-operation-scene-card][data-actor-id="' + IDS.actors.hoshino + '"]')!;
    const defaultSceneFace = hoshinoCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice][aria-pressed="true"]')!;
    const defaultActionId = defaultSceneFace.dataset.sceneActionId!;
    const alternateSceneFace = hoshinoCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice]:not([aria-pressed="true"])')!;
    const selectedActionId = alternateSceneFace.dataset.sceneActionId!;
    hoshinoCard.querySelector<HTMLButtonElement>('[data-operation-scene-alternatives]')!.click();
    alternateSceneFace.click();
    expect(game.operationEntry.getView(runId)?.planVersion).toBe(individualView.planVersion);
    controller.requestOperationWorkspaceRefresh(individualView, { type: 'commit' });
    const restoredHoshino = root.querySelector<HTMLElement>('[data-operation-scene-card][data-actor-id="' + IDS.actors.hoshino + '"]')!;
    expect(restoredHoshino.querySelector('[data-operation-scene-choice][aria-pressed="true"]')?.getAttribute('data-scene-action-id')).toBe(selectedActionId);

    restoredHoshino.querySelector<HTMLButtonElement>('[data-operation-scene-alternatives]')!.click();
    restoredHoshino.querySelector<HTMLButtonElement>('[data-operation-scene-choice][data-scene-action-id="' + defaultActionId + '"]')!.click();

    root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!.click();
    expect(game.operationEntry.getView(runId)?.pendingSceneActionBatch?.preview.selections)
      .toContainEqual(expect.objectContaining({ actorId: IDS.actors.hoshino, sceneActionId: defaultActionId }));
    root.querySelector<HTMLButtonElement>('[data-operation-scene-commit]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-route][data-route-id="' + IDS.routes.staffGate + '"]')!.click();

    const globalView = game.operationEntry.getView(runId)!;
    expect(globalView.currentActionMode).toBe('global');
    const globalCard = root.querySelector<HTMLElement>('[data-global-scene-card]')!;
    const globalFace = globalCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice][aria-pressed="true"]')!;
    globalFace.click();
    const performer = [...globalCard.querySelectorAll<HTMLButtonElement>('[data-operation-scene-performer]')]
      .find(button => button.getAttribute('aria-pressed') !== 'true')!;
    performer.click();
    const performerId = performer.dataset.actorId!;
    const targetGroup = [...globalCard.querySelectorAll<HTMLElement>('[data-targets-for]')]
      .find(group => group.dataset.targetsFor === performerId)!;
    const sceneTarget = targetGroup.querySelector<HTMLButtonElement>('[data-operation-scene-target]')!;
    sceneTarget.click();
    const selectedSceneTargets = [...targetGroup.querySelectorAll<HTMLButtonElement>('[data-operation-scene-target][aria-pressed="true"]')]
      .map(button => button.dataset.targetActorId);
    expect(selectedSceneTargets.length).toBeGreaterThan(0);

    const playerCardFace = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-card-toggle]')]
      .find(face => (JSON.parse(face.dataset.legalTargetActorIds ?? '[]') as string[]).length > 0)!;
    const playerCard = playerCardFace.closest<HTMLElement>('[data-operation-player-card]')!;
    playerCardFace.click();
    const alternatePerformer = [...playerCard.querySelectorAll<HTMLButtonElement>('[data-operation-card-actor]')]
      .find(button => button.getAttribute('aria-pressed') !== 'true');
    alternatePerformer?.click();
    const cardActorId = playerCardFace.dataset.actorId!;
    const cardTargetGroup = [...playerCard.querySelectorAll<HTMLElement>('[data-operation-card-targets-for]')]
      .find(group => group.dataset.operationCardTargetsFor === cardActorId)!;
    const cardTargetButtons = [...cardTargetGroup.querySelectorAll<HTMLButtonElement>('[data-operation-card-target]')];
    if (cardTargetButtons.length > 1) {
      const chosen = cardTargetButtons.find(button => button.getAttribute('aria-pressed') !== 'true') ?? cardTargetButtons[0];
      if (chosen.getAttribute('aria-pressed') === 'true') {
        const remaining = cardTargetButtons.find(button => button !== chosen && button.getAttribute('aria-pressed') === 'true');
        if (remaining) chosen.click();
      } else chosen.click();
    }
    const cardTargetIds = [...cardTargetGroup.querySelectorAll<HTMLButtonElement>('[data-operation-card-target][aria-pressed="true"]')]
      .map(button => button.dataset.targetActorId);
    expect(cardTargetIds.length).toBeGreaterThan(0);
    const selectedCardInstanceId = playerCard.dataset.operationPlayerCard!;

    const refreshBefore = controller.getRefreshStats().regionRefreshes;
    controller.requestOperationWorkspaceRefresh(globalView, { type: 'commit' });
    expect(controller.getRefreshStats().regionRefreshes).toBe(refreshBefore + 1);
    const restoredGlobalCard = root.querySelector<HTMLElement>('[data-global-scene-card]')!;
    const restoredGlobalFace = restoredGlobalCard.querySelector<HTMLButtonElement>('[data-operation-scene-choice][aria-pressed="true"]')!;
    expect(restoredGlobalFace.dataset.sceneActionId).toBe(globalFace.dataset.sceneActionId);
    expect(restoredGlobalCard.querySelector('[data-operation-scene-performer][aria-pressed="true"]')?.getAttribute('data-actor-id')).toBe(performerId);
    const restoredTargetGroup = [...restoredGlobalCard.querySelectorAll<HTMLElement>('[data-targets-for]')]
      .find(group => group.dataset.targetsFor === performerId)!;
    expect([...restoredTargetGroup.querySelectorAll<HTMLElement>('[data-operation-scene-target][aria-pressed="true"]')]
      .map(button => button.dataset.targetActorId)).toEqual(selectedSceneTargets);
    const restoredPlayerCard = root.querySelector<HTMLElement>('[data-operation-player-card="' + selectedCardInstanceId + '"]')!;
    expect(restoredPlayerCard.classList.contains('is-selected')).toBe(true);
    expect(restoredPlayerCard.querySelector('[data-operation-card-actor][aria-pressed="true"]')?.getAttribute('data-actor-id')).toBe(cardActorId);
    const restoredCardTargetGroup = [...restoredPlayerCard.querySelectorAll<HTMLElement>('[data-operation-card-targets-for]')]
      .find(group => group.dataset.operationCardTargetsFor === cardActorId)!;
    expect([...restoredCardTargetGroup.querySelectorAll<HTMLElement>('[data-operation-card-target][aria-pressed="true"]')]
      .map(button => button.dataset.targetActorId)).toEqual(cardTargetIds);

    root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!.click();
    const staged = game.operationEntry.getView(runId)?.pendingSceneActionBatch?.preview;
    expect(staged?.selections).toContainEqual(expect.objectContaining({
      sceneActionId: globalFace.dataset.sceneActionId,
      actorId: performerId,
      targetActorIds: selectedSceneTargets,
    }));
    expect(staged?.cards).toContainEqual(expect.objectContaining({
      cardInstanceId: selectedCardInstanceId,
      actorId: cardActorId,
      targetActorIds: cardTargetIds,
    }));
    expect(defaultSceneFace.dataset.sceneActionId).toBe(defaultActionId);
  });

  it('拒绝过期 planVersion 时显示可读提示并刷新到当前版本', () => {
    acquireStudents();
    startFromFeed();
    const action = root.querySelector<HTMLButtonElement>(`[data-operation-action][data-action-id="${CAROUSEL_SAFETY_IDS.actions.emergencyStop}"]`)!;
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
    root.querySelector<HTMLButtonElement>('[data-operation-action][data-action-id="' + CAROUSEL_SAFETY_IDS.actions.emergencyStop + '"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    const student = root.querySelector<HTMLElement>('[data-operation-student="' + IDS.actors.hoshino + '"]')!;
    const choice = student.querySelector<HTMLElement>('[data-operation-scene-choice][aria-pressed="true"]')!;
    const stream = root.querySelector('[data-operation-log]');
    const dock = root.querySelector('[data-operation-commit-dock]');
    const stage = root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!;
    stage.dataset.planVersion = '999';
    const regionBefore = controller.getRefreshStats().regionRefreshes;
    stage.click();

    expect(controller.getRefreshStats().regionRefreshes).toBe(regionBefore + 1);
    expect(root.querySelector('[data-operation-student="' + IDS.actors.hoshino + '"]')).toBe(student);
    expect(student.querySelector('[data-operation-scene-choice][aria-pressed="true"]')).toBe(choice);
    expect(root.querySelector('[data-operation-log]')).toBe(stream);
    expect(root.querySelector('[data-operation-commit-dock]')).toBe(dock);
    expect(root.querySelector('[data-operation-command-notice]')?.textContent).toContain('行动计划刚刚更新了');
    expect(document.activeElement).toBe(root.querySelector('[data-operation-command-notice]'));
  });
});
