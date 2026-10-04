// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { UIController } from '../../src/ui/controller';
import { baseDatapack } from '../../src/data/test-datapack';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const VARIANTS = ['Hoshino', 'Serika', 'Shiroko'] as const;

describe('Gameplay B Operation Controller', () => {
  let game: GameInstance;
  let controller: UIController;
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    game = createAppRuntime();
    game.init([baseDatapack], { enterDefaultInit: true });
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
  }

  function startFromFeed(): void {
    root.querySelector<HTMLButtonElement>('[data-operation-start]')!.click();
    expect(controller.panelState.workspace?.type).toBe('operation');
  }

  it('入口只在夏莱办公室出现；准入失败明确提示且不补发角色', () => {
    expect(root.querySelector('[data-operation-start]')).not.toBeNull();
    game.inits.enterInit(MILLENNIUM);
    controller.render();
    expect(root.querySelector('[data-operation-start]')).toBeNull();

    game.inits.enterInit(OFFICE);
    controller.render();
    expect(root.querySelector('[data-operation-start]')).not.toBeNull();
    const before = controller.getRefreshStats();
    root.querySelector<HTMLButtonElement>('[data-operation-start]')!.click();

    expect(controller.panelState.workspace).toBeUndefined();
    expect(game.operationEntry.getView()).toBeNull();
    expect(controller.panelState.chatEntries.some(entry => entry.text.includes('还需要持有并解锁星野、芹香、白子'))).toBe(true);
    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshObservations().at(-1)).toMatchObject({ scope: 'region', reason: 'operation-admission-failed', outcome: 'applied' });
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

  it('修订、改目标、取消与 Beat Commit 各自只替换一个 Operation region', () => {
    acquireStudents();
    startFromFeed();
    const workspace = controller.panelState.workspace;
    if (workspace?.type !== 'operation') throw new Error('Operation route did not open');
    const runId = workspace.runId;
    const fullBefore = controller.getRefreshStats().fullRenders;
    let regionBefore = controller.getRefreshStats().regionRefreshes;
    const stableFrame = root.querySelector('[data-workspace-frame="operation"]');
    const stableStream = root.querySelector('[data-operation-log]');
    const stableStudent = root.querySelector(`[data-operation-student="${CAROUSEL_SAFETY_IDS.actors.hoshino}"]`);
    const emergencyStopButton = root.querySelector<HTMLButtonElement>(`[data-operation-action][data-actor-id="${CAROUSEL_SAFETY_IDS.actors.hoshino}"][data-action-id="${CAROUSEL_SAFETY_IDS.actions.emergencyStop}"]`)!;

    const alternateTarget = root.querySelector<HTMLButtonElement>(
      `[data-operation-target][data-actor-id="${CAROUSEL_SAFETY_IDS.actors.hoshino}"][data-action-id="${CAROUSEL_SAFETY_IDS.actions.brace}"]:not([aria-pressed="true"])`,
    );
    expect(alternateTarget).not.toBeNull();
    alternateTarget!.click();
    expect(game.operationEntry.getView(runId)?.interventionDraft?.targetActorId).toBe(alternateTarget!.dataset.targetActorId);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);

    root.querySelector<HTMLButtonElement>('[data-operation-clear]')!.click();
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);

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
    expect(root.querySelector(`[data-operation-student="${CAROUSEL_SAFETY_IDS.actors.hoshino}"]`)).toBe(stableStudent);
    expect(root.querySelector(`[data-operation-action][data-action-id="${CAROUSEL_SAFETY_IDS.actions.emergencyStop}"]`)).toBe(emergencyStopButton);
    root.querySelector<HTMLButtonElement>('[data-operation-clear]')!.click();
    expect(game.operationEntry.getView(runId)?.interventionDraft).toBeNull();
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);

    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    expect(game.operationEntry.getView(runId)?.resolutions).toHaveLength(1);
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    root.querySelector<HTMLButtonElement>('[data-operation-commit]')!.click();
    const view = game.operationEntry.getView(runId);
    expect(view?.resolutions).toHaveLength(2);
    expect(view?.status).toBe('inProgress');
    expect(root.querySelector<HTMLButtonElement>('[data-operation-commit]')?.disabled).toBe(true);
    expect(root.textContent).toContain('处置失败');
    expect(root.textContent).toContain('不会改写正式事件结局');
    expect(controller.getRefreshStats().regionRefreshes).toBe(++regionBefore);
    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    const operationUpdates = controller.getRefreshObservations().filter(item => item.reason === 'operation-command').slice(-6);
    expect(operationUpdates).toHaveLength(6);
    for (const observation of operationUpdates) expect(observation).toMatchObject({ scope: 'region', outcome: 'applied' });
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
});
