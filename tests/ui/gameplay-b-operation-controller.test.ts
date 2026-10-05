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

    const actionAlternatives = root.querySelector<HTMLDetailsElement>('[data-operation-student="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"] [data-operation-action-disclosure]');
    expect(actionAlternatives?.open).toBe(false);
    actionAlternatives!.open = true;
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
    alternatives!.closest('details')!.open = true;
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

    root.querySelector<HTMLButtonElement>('[data-operation-scene-stage]')!.click();
    const staged = game.operationEntry.getView(runId)?.pendingSceneActionBatch;
    expect(staged?.preview.cards).toContainEqual(expect.objectContaining({
      cardInstanceId: aidCard!.cardInstanceId,
      actorId: IDS.actors.serika,
      targetActorIds: [IDS.actors.hoshino],
    }));
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
