// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  function installTargetableAlternative(): {
    currentFace: HTMLButtonElement;
    alternative: HTMLButtonElement;
    targetTray: HTMLDivElement;
    targetChoice: HTMLButtonElement;
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
    const targetTray = [...layer.querySelectorAll<HTMLDivElement>('[data-operation-action-targets]')]
      .find(tray => tray.dataset.operationPreparedOwnerId === actorId && tray.dataset.operationActionId === actionId)!;
    const targetChoice = targetTray.querySelector<HTMLButtonElement>('[data-operation-target][data-target-actor-id="' + targetId + '"]')!;
    return { currentFace, alternative, targetTray, targetChoice, targetId, actionId };
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
    const emergencyStopButton = root.querySelector<HTMLButtonElement>('[data-operation-action][data-actor-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"][data-action-id="' + CAROUSEL_SAFETY_IDS.actions.emergencyStop + '"]')!;
    expect(emergencyStopButton.parentElement?.matches('[data-operation-prepared-card-layer]')).toBe(true);
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
      expect(face.style.left).toBe('368px');
      expect(face.style.top).toBe('109px');
      expect(Number.parseFloat(face.style.left)).toBeGreaterThanOrEqual(ownerRect.right + 8);

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
      expect(face.style.left).toBe('378px');
      expect(face.style.top).toBe('69px');
      expect(Number.parseFloat(face.style.left)).toBeGreaterThanOrEqual(ownerRect.right + 8);

      ownerRect = rect(160, 60, 230, 160);
      resizeCallback.current?.([], {} as ResizeObserver);
      await nextFrame();
      expect(face.style.left).toBe('398px');
      expect(face.style.top).toBe('69px');
      expect(Number.parseFloat(face.style.left)).toBeGreaterThanOrEqual(ownerRect.right + 8);

      // When the owner's right side is too close to the frame edge, flip to
      // its left while preserving a gap; the identity card remains unobscured.
      Object.defineProperty(frame, 'getBoundingClientRect', { configurable: true, value: () => rect(0, 0, 500, 700) });
      Object.defineProperty(layer, 'getBoundingClientRect', { configurable: true, value: () => rect(100, 0, 700, 720) });
      ownerRect = rect(200, 60, 210, 160);
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

  it('目标型替代牌的鼠标 click 不选计划；Enter 可通过该牌自己的目标路径设置目标', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const { currentFace, alternative, targetTray, targetChoice, targetId, actionId } = installTargetableAlternative();
    const initialView = game.operationEntry.getView(runId)!;
    currentFace.click();
    expect(alternative.hidden).toBe(false);
    expect(targetTray.hidden).toBe(true);
    expect(targetChoice.getAttribute('aria-pressed')).toBe('false');
    expect(targetChoice.hasAttribute('data-default-target')).toBe(true);
    expect(initialView.interventionDraft).toMatchObject({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop,
    });

    alternative.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(targetTray.hidden).toBe(true);
    expect(game.operationEntry.getView(runId)?.planVersion).toBe(initialView.planVersion);
    expect(game.operationEntry.getView(runId)?.interventionDraft).toEqual(initialView.interventionDraft);

    alternative.focus();
    alternative.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    alternative.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    expect(targetTray.hidden).toBe(false);
    expect(document.activeElement).toBe(targetChoice);
    targetChoice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    targetChoice.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    expect(game.operationEntry.getView(runId)?.interventionDraft).toMatchObject({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId,
      targetActorId: targetId,
    });
    expect(game.operationEntry.getView(runId)!.planVersion).toBeGreaterThan(initialView.planVersion);
  });

  it('目标型替代牌仍可拖到合法对象后选择', () => {
    acquireStudents();
    startFromFeed();
    const runId = controller.panelState.workspace?.type === 'operation' ? controller.panelState.workspace.runId : '';
    const { currentFace, alternative, targetId, actionId } = installTargetableAlternative();
    const initialView = game.operationEntry.getView(runId)!;
    currentFace.click();
    const dropTarget = root.querySelector<HTMLElement>('[data-operation-actor-target="' + targetId + '"]')!;
    const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => dropTarget });
    try {
      alternative.dispatchEvent(pointer('pointerdown', 2, 2, 49));
      root.dispatchEvent(pointer('pointermove', 18, 18, 49));
      expect(dropTarget.classList.contains('is-card-legal-target')).toBe(true);
      alternative.dispatchEvent(pointer('pointerup', 18, 18, 49));
    } finally {
      if (originalElementFromPoint) Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
      else Reflect.deleteProperty(document, 'elementFromPoint');
    }
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

  it('键盘可达行动目标，合法牌面拖放只在释放时写入草稿', () => {
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
    expect(targetTray.hidden).toBe(false);
    const keyboardTarget = [...targetTray.querySelectorAll<HTMLButtonElement>('[data-operation-target]:not(:disabled)')]
      .find(button => button.dataset.targetActorId === dropTargetId)!;
    expect(document.activeElement).toBe(keyboardTarget);
    expect(keyboardTarget.getAttribute('aria-pressed')).toBe('true');
    keyboardTarget.click();
    expect(game.operationEntry.getView(runId)?.planVersion).toBe(initialView.planVersion);
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    keyboardTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(targetTray.hidden).toBe(true);
    expect(document.activeElement).toBe(actionFace);
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
