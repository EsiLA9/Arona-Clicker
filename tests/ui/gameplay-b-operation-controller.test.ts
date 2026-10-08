// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { gameplayBStrategyParkDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park';
import { GAMEPLAY_B_STRATEGY_PARK_IDS as PARK_IDS } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { OperationView, OperationViewSceneAction } from '../../src/arona-clicker/contracts/operation-view';
import { UIController } from '../../src/ui/controller';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { projectOperationActorHand, readOperationSceneDraft, renderOperationWorkspace } from '../../src/ui/components/operation-workspace';
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

      expect(root.querySelector('[data-operation-start]')?.textContent).toContain('开始旋转木马安全战斗');
      root.querySelector<HTMLButtonElement>('[data-operation-start]')!.click();
      const operation = controller.panelState.workspace;
      expect(operation?.type).toBe('operation');
      if (operation?.type !== 'operation') throw new Error('Operation route did not open');
      expect(game.operationEntry.getView(operation.runId)).toMatchObject({
        currentLocationId: IDS.locations.platform,
        currentActionMode: null,
      });
      expect(root.querySelector('.operation-commit-status')?.textContent).toContain('旋转木马安全战斗');
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
    const beforeOpenRun = game.operationEntry.getView(runId);
    const beforeOpenRegions = controller.getRefreshStats().regionRefreshes;
    actionAlternatives!.click();
    expect(actionAlternatives!.getAttribute('aria-expanded')).toBe('true');
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
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect((document.activeElement as HTMLElement).dataset.actionId).toBe(selectedActionId);
    expect(root.querySelector('[data-workspace-frame="operation"]')).toBe(stableFrame);
    expect(root.querySelector('[data-operation-log]')).toBe(stableStream);
    expect(root.querySelector('[data-operation-student="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"]')).toBe(stableStudent);
    expect(root.querySelector('[data-operation-action][data-action-id="' + selectedActionId + '"]')).toBe(actionButton);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    expect(game.operationEntry.getView(runId)?.currentLocationId).toBe(IDS.locations.concourse);
    expect(root.querySelector('.operation-commit-status')?.textContent).toContain('战斗已结束');
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
    if (exitTargets.length > 1) dragCardToActorTarget(root, attachedExitFace, exitTargets[0]!, 44);
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
      frame.querySelector<HTMLElement>('[data-scroll="content"]')?.dispatchEvent(new Event('scroll', { bubbles: true }));
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

  it('单目标替代牌的键盘 Enter 直接采用其固定目标', () => {
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
    expect(game.operationEntry.getView(runId)?.interventionDraft).toMatchObject({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId,
      targetActorId: targetId,
    });
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

  it('首次推荐时可以用鼠标把星野的目标型备选行动替换进计划', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const actorId = CAROUSEL_SAFETY_IDS.actors.hoshino;
    const initialView = game.operationEntry.getView(runId)!;
    const actionId = CAROUSEL_SAFETY_IDS.actions.brace;
    const currentFace = root.querySelector<HTMLButtonElement>(
      '[data-operation-action-current][data-actor-id="' + actorId + '"][aria-pressed="true"]',
    )!;
    const alternative = root.querySelector<HTMLButtonElement>(
      '[data-operation-action-alternative][data-actor-id="' + actorId + '"][data-action-id="' + actionId + '"]',
    )!;

    expect(initialView.actorStates.find(actor => actor.id === actorId)?.currentPlan?.actionId)
      .not.toBe(actionId);
    currentFace.click();
    expect(alternative.hidden).toBe(false);
    expect(alternative.disabled).toBe(false);
    alternative.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));

    expect(game.operationEntry.getView(runId)?.interventionDraft).toMatchObject({ actorId, actionId });
  });

  it('单一合法目标的替代牌显示硬目标，不启动二次拖放', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const { currentFace, alternative, targetId, actionId } = installTargetableAlternative();
    const initialView = game.operationEntry.getView(runId)!;
    currentFace.click();
    expect(JSON.parse(alternative.dataset.legalTargetActorIds ?? '[]')).toEqual([targetId]);
    alternative.click();
    expect(game.operationEntry.getView(runId)?.interventionDraft).toMatchObject({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId,
      targetActorId: targetId,
    });
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
    workspace.querySelector<HTMLButtonElement>('[data-operation-scene-alternatives]')!.click();
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

  it('Individual 同队治疗牌使用自身候选并预览整批费用，点击不查询或写 Run', () => {
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
    expect(root.querySelector('[data-operation-cost-preview]')?.textContent).toContain('本批实际支付 2 Cost');
    expect(game.operationEntry.getSnapshot()!.planVersion).toBe(planVersion);
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
    hoshinoCard.querySelector<HTMLButtonElement>('[data-operation-scene-alternatives]')!.click();
    alternateSceneFace.click();
    expect(game.operationEntry.getView(runId)?.planVersion).toBe(individualView.planVersion);
    controller.requestOperationWorkspaceRefresh(individualView, { type: 'commit' });
    const restoredHoshino = root.querySelector<HTMLElement>('[data-operation-scene-card][data-actor-id="' + IDS.actors.hoshino + '"]')!;
    expect(restoredHoshino.querySelector('[data-operation-scene-choice][aria-pressed="true"]')?.getAttribute('data-scene-action-id')).toBe(selectedActionId);

    restoredHoshino.querySelector<HTMLButtonElement>('[data-operation-scene-alternatives]')!.click();
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
