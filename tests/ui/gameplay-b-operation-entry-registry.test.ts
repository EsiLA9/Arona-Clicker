// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { Character } from '../../src/arona-clicker/types/ids';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { UIController } from '../../src/ui/controller';
import { ATOMIC_SCENE_DEMO_IDS } from '../../src/arona-clicker/content/operation-samples/atomic-scene-demo';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';

const VARIANTS: Record<typeof Character.Hoshino | typeof Character.Serika | typeof Character.Shiroko, string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};

function dragCardToActorTarget(root: HTMLElement, face: HTMLButtonElement, targetActorId: string, pointerId: number): void {
  const target = root.querySelector<HTMLElement>('[data-operation-actor-target="' + targetActorId + '"]');
  if (!target) throw new Error('Expected a target Actor card.');
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

describe('Gameplay B Registry operation entries', () => {
  const games: GameInstance[] = [];
  const controllers: UIController[] = [];

  afterEach(() => {
    for (const controller of controllers.splice(0)) controller.destroy();
    for (const game of games.splice(0)) if (game.running) game.stop();
    localStorage.clear();
  });

  test('starts from the Registry entry and completes two ordered Scenes in the same Location', () => {
    const game = createAppRuntime();
    games.push(game);
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    const unavailableEntry = game.operationEntry.getLaunchEntries()
      .find(candidate => candidate.eventId === ATOMIC_SCENE_DEMO_IDS.event);
    expect(unavailableEntry?.admission).toMatchObject({
      available: false,
      missingCharacterIds: [Character.Hoshino, Character.Serika],
      unavailableReason: '缺少持有且已解锁的固定队员。',
    });
    for (const character of [Character.Hoshino, Character.Serika]) {
      game.mutations.acquireCharacter(VARIANTS[character], 'story');
    }
    const launchEntry = game.operationEntry.getLaunchEntries()
      .find(candidate => candidate.eventId === ATOMIC_SCENE_DEMO_IDS.event);
    expect(launchEntry).toMatchObject({
      eventId: ATOMIC_SCENE_DEMO_IDS.event,
      title: '原子场景演示',
      description: '两名学生先调查旋转木马设备，再压制敌方前排、改变敌人站位并明确选择一人处理警报。',
      characterIds: [Character.Hoshino, Character.Serika],
      admission: {
        available: true,
        participants: [
          { characterId: Character.Hoshino, displayName: '小鸟游星野' },
          { characterId: Character.Serika, displayName: '黑见芹香' },
        ],
        unavailableReason: null,
      },
    });
    game.inits.enterInit('base:init:millennium');
    expect(game.operationEntry.getLaunchEntries().some(candidate => candidate.eventId === ATOMIC_SCENE_DEMO_IDS.event)).toBe(false);
    game.inits.enterInit(DEFAULT_INIT_ID);
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>('#app')!;
    const controller = new UIController(game, root);
    controllers.push(controller);
    controller.started = true;
    const originalRegistry = game.registry;
    const ownRegistryDescriptor = Object.getOwnPropertyDescriptor(game, 'registry');
    Object.defineProperty(game, 'registry', {
      configurable: true,
      value: new Proxy(originalRegistry, {
        get(target, property) {
          if (property === 'operationEvents' || property === 'studentOperationProfiles') {
            throw new Error(`Operation entry UI read Registry.${String(property)} directly`);
          }
          return Reflect.get(target, property, target);
        },
      }),
    });
    try {
      controller.render();

      const entry = root.querySelector<HTMLElement>(`[data-operation-entry="${ATOMIC_SCENE_DEMO_IDS.event}"]`);
      expect(entry?.textContent).toContain('原子场景演示');
      expect(entry?.textContent).toContain('两名学生先调查旋转木马设备');
      expect(entry?.textContent).toContain('固定出动：小鸟游星野、黑见芹香');
      const startButton = root.querySelector<HTMLButtonElement>(`[data-operation-start="${ATOMIC_SCENE_DEMO_IDS.event}"]`)!;
      expect(JSON.parse(startButton.dataset.operationCharacterIds ?? '[]')).toEqual([Character.Hoshino, Character.Serika]);
      startButton.click();

    expect(controller.panelState.workspace?.type).toBe('operation');
    const runId = controller.panelState.workspace?.type === 'operation'
      ? controller.panelState.workspace.runId
      : '';
    const started = game.operationEntry.getView(runId)!;
    const locationId = started.currentLocationId;
    expect(started).toMatchObject({
      eventId: ATOMIC_SCENE_DEMO_IDS.event,
      currentSceneId: ATOMIC_SCENE_DEMO_IDS.scene,
      currentScene: { sceneId: ATOMIC_SCENE_DEMO_IDS.scene, title: '调查故障设备', status: 'active' },
      scenes: [
        { sceneId: ATOMIC_SCENE_DEMO_IDS.scene, status: 'active' },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene, status: 'ready' },
      ],
      locationProgress: { [locationId]: { completed: false } },
    });
    expect(started.actorStates.filter(actor => actor.participantKind === 'student')).toHaveLength(2);
    expect(started.actorStates.filter(actor => actor.participantKind === 'environment')).toHaveLength(1);
    expect(started.actorStates.filter(actor => actor.participantKind === 'opponent')).toHaveLength(3);
    const actorlessCardOffer = started.actionOffers.find(offer => offer.source === 'player-scene-card');
    expect(actorlessCardOffer).toMatchObject({
      source: 'player-scene-card',
      sceneId: ATOMIC_SCENE_DEMO_IDS.scene,
      card: { performerPolicy: 'none', playerCost: 0 },
    });
    const activeScene = root.querySelector<HTMLElement>(`[data-operation-scene="${ATOMIC_SCENE_DEMO_IDS.scene}"]`);
    expect(activeScene?.getAttribute('data-scene-status')).toBe('active');
    expect(activeScene?.textContent).toContain('调查故障设备');
    expect(activeScene?.textContent).toContain('进行中');
    expect(activeScene?.textContent).toContain('找到警报设备的维修线索后，本场景完成');
    expect(root.querySelector('[data-operation-location-status]')?.getAttribute('data-operation-location-status')).toBe('inProgress');
    expect(root.querySelector(`[data-operation-environment-actor="${CAROUSEL_SAFETY_IDS.actors.ride}"]`)).not.toBeNull();
    const battleActionOptions = started.actorStates.flatMap(actor => actor.profile?.actionOptions ?? [])
      .filter(option => option.actionId === ATOMIC_SCENE_DEMO_IDS.action);
    expect(battleActionOptions).toHaveLength(2);
    expect(battleActionOptions.every(option => !option.enabledAtLocation && !option.selectable)).toBe(true);
    expect(root.querySelectorAll('[data-operation-action]')).toHaveLength(0);
    expect(root.querySelector('[data-operation-commit]')).toBeNull();
    expect(root.querySelectorAll(`[data-operation-scene-choice][data-scene-action-id="${ATOMIC_SCENE_DEMO_IDS.sceneAction}"]`)).toHaveLength(0);
    expect(root.querySelectorAll(`[data-operation-fixed-scene-action="${ATOMIC_SCENE_DEMO_IDS.sceneAction}"]`)).toHaveLength(2);
    expect(root.textContent).toContain('自动目标：旋转木马');
    const beforeRejectedBeatAction = game.operationEntry.getSnapshot();
    expect(() => game.operationEntry.reviseIntervention({
      runId,
      planVersion: started.planVersion,
      draft: { actorId: CAROUSEL_SAFETY_IDS.actors.hoshino, actionId: ATOMIC_SCENE_DEMO_IDS.action },
    })).toThrow();
    expect(game.operationEntry.getSnapshot()).toEqual(beforeRejectedBeatAction);

    const beforeCommit = game.operationEntry.getView(runId)!;
    expect(beforeCommit.locationProgress[locationId].completed).toBe(false);
    const submit = root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!;
    expect(submit.disabled).toBe(false);
    submit.click();

    const afterInvestigation = game.operationEntry.getView(runId)!;
    expect(afterInvestigation).toMatchObject({
      currentLocationId: locationId,
      currentSceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene,
      currentScene: { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene, title: '处理现场警报', status: 'active' },
      scenes: [
        { sceneId: ATOMIC_SCENE_DEMO_IDS.scene, status: 'completed' },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene, status: 'active' },
      ],
      locationProgress: { [locationId]: { completed: false, result: null, completedSceneIds: [ATOMIC_SCENE_DEMO_IDS.scene] } },
      currentRoutes: [{ routeId: ATOMIC_SCENE_DEMO_IDS.route, targetLocationId: ATOMIC_SCENE_DEMO_IDS.exitLocation, available: false }],
      routeHistory: [],
      resolutions: [{ sceneId: ATOMIC_SCENE_DEMO_IDS.scene }],
    });
    expect(root.querySelector<HTMLElement>(`[data-operation-scene="${ATOMIC_SCENE_DEMO_IDS.scene}"]`)
      ?.getAttribute('data-scene-status')).toBe('completed');
    const activeAlarmScene = root.querySelector<HTMLElement>(`[data-operation-scene="${ATOMIC_SCENE_DEMO_IDS.alarmScene}"]`);
    expect(activeAlarmScene?.getAttribute('data-scene-status')).toBe('active');
    expect(activeAlarmScene?.textContent).toContain('处理现场警报');
    expect(root.querySelector('[data-operation-location-status]')?.getAttribute('data-operation-location-status')).toBe('inProgress');
    const sceneOptions = [...root.querySelectorAll<HTMLElement>('[data-operation-scene-actions] [data-operation-scene-option]')];
    expect(sceneOptions.length).toBeGreaterThan(1);
    expect(sceneOptions.every(option => !option.hidden)).toBe(true);
    expect(root.querySelector('[data-operation-scene-alternatives]')).toBeNull();
    expect(root.querySelector('[data-operation-performer-open]')).toBeNull();

    const frontActorIds = [ATOMIC_SCENE_DEMO_IDS.enemyFrontA, ATOMIC_SCENE_DEMO_IDS.enemyFrontB];
    let pointerId = 80;
    const activateAction = (sceneActionId: string, targetActorId?: string): void => {
      let face = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-scene-choice]')]
        .find(button => button.dataset.sceneActionId === sceneActionId);
      expect(face).toBeDefined();
      if (!face!.dataset.actorId) {
        face!.click();
        const option = face!.closest<HTMLElement>('[data-operation-scene-option]')!;
        const picker = option.querySelector<HTMLDetailsElement>('[data-operation-performer-picker]')!;
        expect(option.classList.contains('is-selected')).toBe(true);
        expect(picker.open).toBe(true);
        picker.querySelector<HTMLButtonElement>(`[data-performer-actor-id="${CAROUSEL_SAFETY_IDS.actors.hoshino}"]`)!.click();
      }
      face = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-scene-choice]')]
        .find(button => button.dataset.sceneActionId === sceneActionId && button.dataset.actorId === CAROUSEL_SAFETY_IDS.actors.hoshino);
      expect(face).toBeDefined();
      if (targetActorId) {
        expect(JSON.parse(face!.dataset.legalTargetActorIds ?? '[]')).toContain(targetActorId);
        dragCardToActorTarget(root, face!, targetActorId, pointerId++);
        expect(JSON.parse(face!.dataset.selectedTargetActorIds ?? '[]')).toContain(targetActorId);
      } else if (face!.dataset.targetSelectionMode === 'all-eligible') {
        const legalTargets = JSON.parse(face!.dataset.legalTargetActorIds ?? '[]') as string[];
        expect(face!.dataset.targetSummary).toContain('自动作用于全部合格目标（' + legalTargets.length + '）');
      }
      root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    };

    const groupFace = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-scene-choice]')]
      .find(button => button.dataset.sceneActionId === ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction)!;
    expect(groupFace.dataset.targetSelectionMode).toBe('all-eligible');
    groupFace.click();
    const performerChoice = root.querySelector<HTMLButtonElement>(
      `[data-operation-performer-picker][data-card-identity="${ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction}"] [data-performer-actor-id="${CAROUSEL_SAFETY_IDS.actors.hoshino}"]`,
    )!;
    expect(performerChoice.closest<HTMLElement>('[data-operation-performer-picker]')?.querySelector(':scope > summary')
      ?.hasAttribute('data-operation-performer-open')).toBe(false);
    performerChoice.click();
    const assignedPicker = root.querySelector<HTMLDetailsElement>(
      `[data-operation-performer-picker][data-card-identity="${ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction}"]`,
    );
    expect(document.activeElement).toBe(assignedPicker?.querySelector(':scope > summary'));
    const resolvedGroupFace = [...root.querySelectorAll<HTMLButtonElement>('[data-operation-scene-choice]')]
      .find(button => button.dataset.sceneActionId === ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction
        && button.dataset.actorId === CAROUSEL_SAFETY_IDS.actors.hoshino)!;
    expect(JSON.parse(resolvedGroupFace.dataset.selectedTargetActorIds ?? 'null')).toEqual([]);
    expect(resolvedGroupFace.dataset.targetSummary).toContain('自动作用于全部合格目标（2）');
    expect((game.operationEntry.getView(runId)!.currentSceneActions.find(action => action.id === ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction)
      ?.legalTargetActorIdsByActorId[CAROUSEL_SAFETY_IDS.actors.hoshino])).toEqual(frontActorIds);
    root.querySelector<HTMLButtonElement>('[data-operation-scene-submit]')!.click();
    expect(game.operationEntry.getSnapshot()?.resolutions.at(-1)?.sceneBatch?.selections[0]?.targetActorIds).toEqual(frontActorIds);

    const afterGroup = game.operationEntry.getView(runId)!;
    expect(afterGroup.currentSceneActions.find(action => action.id === ATOMIC_SCENE_DEMO_IDS.alarmMoveSceneAction)
      ?.legalTargetActorIdsByActorId[CAROUSEL_SAFETY_IDS.actors.hoshino]).toEqual(frontActorIds);
    const enemyFrontCard = root.querySelector<HTMLElement>(`[data-operation-opponent="${ATOMIC_SCENE_DEMO_IDS.enemyFrontA}"]`);
    expect(enemyFrontCard?.querySelector('[data-operation-position]')?.getAttribute('data-operation-position')).toBe('front');
    expect(enemyFrontCard?.querySelector('[data-operation-position]')?.textContent).toBe('前排');
    activateAction(ATOMIC_SCENE_DEMO_IDS.alarmMoveSceneAction, ATOMIC_SCENE_DEMO_IDS.enemyFrontA);
    const afterMove = game.operationEntry.getView(runId)!;
    const remainingFrontActorIds = [ATOMIC_SCENE_DEMO_IDS.enemyFrontB];
    expect(afterMove.actorStates.find(actor => actor.id === ATOMIC_SCENE_DEMO_IDS.enemyFrontA)?.positionId).toBe('back');
    const movedEnemyCard = root.querySelector<HTMLElement>(`[data-operation-opponent="${ATOMIC_SCENE_DEMO_IDS.enemyFrontA}"]`);
    expect(movedEnemyCard?.querySelector('[data-operation-position]')?.getAttribute('data-operation-position')).toBe('back');
    expect(movedEnemyCard?.querySelector('[data-operation-position]')?.textContent).toBe('后排');
    expect(movedEnemyCard?.textContent).toContain('敌人甲');
    expect(afterMove.currentSceneActions.find(action => action.id === ATOMIC_SCENE_DEMO_IDS.alarmSceneAction)
      ?.legalTargetActorIdsByActorId[CAROUSEL_SAFETY_IDS.actors.hoshino]).toEqual([
        ATOMIC_SCENE_DEMO_IDS.enemyFrontA,
        ATOMIC_SCENE_DEMO_IDS.enemyFrontB,
        ATOMIC_SCENE_DEMO_IDS.enemyBack,
      ]);
    activateAction(ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction);
    expect(game.operationEntry.getSnapshot()?.resolutions.at(-1)?.sceneBatch?.selections[0]?.targetActorIds)
      .toEqual(remainingFrontActorIds);
    const afterSecondGroup = game.operationEntry.getView(runId)!;
    expect(afterSecondGroup.currentSceneActions.find(action => action.id === ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction)
      ?.legalTargetActorIdsByActorId[CAROUSEL_SAFETY_IDS.actors.hoshino]).toEqual(remainingFrontActorIds);
    activateAction(ATOMIC_SCENE_DEMO_IDS.alarmSceneAction, ATOMIC_SCENE_DEMO_IDS.enemyBack);

    const completed = game.operationEntry.getView(runId)!;
    expect(completed).toMatchObject({
      currentLocationId: ATOMIC_SCENE_DEMO_IDS.exitLocation,
      currentRoutes: [],
      locationProgress: {
        [locationId]: {
          completed: true,
          result: 'success',
          completedSceneIds: [ATOMIC_SCENE_DEMO_IDS.scene, ATOMIC_SCENE_DEMO_IDS.alarmScene],
        },
      },
      routeHistory: [{ routeId: ATOMIC_SCENE_DEMO_IDS.route, fromLocationId: locationId, toLocationId: ATOMIC_SCENE_DEMO_IDS.exitLocation }],
      resolutions: [
        { sceneId: ATOMIC_SCENE_DEMO_IDS.scene },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene },
      ],
    });
    expect(completed.map.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ locationId, completed: true, current: false }),
    ]));
    const routeItem = root.querySelector<HTMLElement>(`[data-operation-route-history-item][data-route-id="${ATOMIC_SCENE_DEMO_IDS.route}"]`);
    expect(routeItem?.textContent).toContain('路线转场');
    expect(routeItem?.textContent).toContain('行动现场');
    } finally {
      if (ownRegistryDescriptor) Object.defineProperty(game, 'registry', ownRegistryDescriptor);
      else Reflect.deleteProperty(game, 'registry');
    }
  });
});
