// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_ROUTE_IDS, carouselRouteSliceResolver } from '../../src/arona-clicker/content/operation-samples/carousel-route-slice';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { Character } from '../../src/arona-clicker/types/ids';
import { gameplayBStrategyParkDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park';
import { GAMEPLAY_B_STRATEGY_PARK_IDS as PARK_IDS } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids';
import { ATOMIC_SCENE_DEMO_IDS } from '../../src/arona-clicker/content/operation-samples/atomic-scene-demo';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { OperationView } from '../../src/arona-clicker/contracts/operation-view';
import type { PanelState } from '../../src/ui/components/app-shell';
import { projectOperationActorHand, readOperationSceneDraft, renderOperationWorkspace, saveOperationSceneDraft } from '../../src/ui/components/operation-workspace';
import { createUIContext } from '../../src/ui/context';
import { renderWorkspace } from '../../src/ui/workspace/workspace-renderer';
import { createWorkspaceNavigation } from '../../src/ui/workspace/workspace-router';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';

const STUDENTS = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const VARIANTS = ['Hoshino', 'Serika', 'Shiroko'] as const;

describe('Gameplay B Operation workspace view', () => {
  const games: GameInstance[] = [];
  const controllers: UIController[] = [];

  function createGame(): GameInstance {
    const game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    games.push(game);
    for (const student of VARIANTS) game.mutations.acquireCharacter(student, 'story');
    return game;
  }

  function render(game: GameInstance, runId: string): string {
    const state = {
      service: 'game',
      workspaceNavigation: createWorkspaceNavigation({ kind: 'operation', runId }),
      workspace: {
        type: 'operation',
        runId,
        returnContext: {
          route: { kind: 'game' },
          leftTab: 'area',
          centerTab: 'chat',
          rightTab: 'spot',
          selectedVariantId: null,
          conversationVariantId: null,
        },
      },
    } as PanelState;
    return renderWorkspace(createUIContext(game), { kind: 'operation', runId }, state);
  }

  function start(game: GameInstance): string {
    return game.operationEntry.start(IDS.event, STUDENTS).runId;
  }

  function startPark(game: GameInstance): string {
    return game.operationEntry.start(PARK_IDS.event, STUDENTS).runId;
  }

  afterEach(() => {
    for (const controller of controllers.splice(0)) controller.destroy();
    for (const game of games.splice(0)) if (game.running) game.stop();
    document.body.innerHTML = '';
  });

  it('shows the three roles and keeps plans attached to their owning cards', () => {
    const game = createGame();
    const runId = start(game);
    const html = render(game, runId);
    const view = game.operationEntry.getView(runId)!;
    const host = document.createElement('div');
    host.innerHTML = html;
    const text = host.textContent ?? '';

    expect(html).toContain('data-composition="columns"');
    expect(html).toContain('data-workspace-role="our-team"');
    expect(html).toContain('data-workspace-role="information"');
    expect(html).toContain('data-workspace-role="opponents"');
    expect(host.querySelectorAll('[data-workspace-column]')).toHaveLength(3);
    const columns = [...host.querySelectorAll<HTMLElement>('[data-workspace-column]')];
    const columnHeaders = [...host.querySelectorAll<HTMLElement>('.workspace-column__header')];
    expect(columnHeaders).toHaveLength(3);
    expect(columns.every(column => column.querySelector(':scope > .workspace-column__body > .workspace-column__header'))).toBe(true);
    const centerColumn = host.querySelector<HTMLElement>('[data-workspace-column="center"]')!;
    const centerHeader = centerColumn.querySelector<HTMLElement>(':scope > .workspace-column__body > .workspace-column__header')!;
    const centerMain = centerColumn.querySelector<HTMLElement>(':scope > .workspace-column__body > .operation-chat')!;
    expect(centerHeader.querySelector('h1')?.textContent).toBe(view.eventTitle);
    expect(centerHeader.querySelector('[data-operation-back]')).not.toBeNull();
    expect(centerMain.querySelector('.operation-chat-heading')).toBeNull();
    expect(centerHeader.compareDocumentPosition(centerMain) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host.querySelectorAll('[data-operation-student]')).toHaveLength(3);
    const hoshinoHand = projectOperationActorHand(game.operationEntry.getView(runId)!, IDS.actors.hoshino);
    expect(hoshinoHand.length).toBeGreaterThan(0);
    expect(hoshinoHand.every(card => card.ownerActorId === IDS.actors.hoshino && card.source === 'character-hand')).toBe(true);
    expect(host.querySelectorAll('[data-operation-opponent]')).toHaveLength(2);
    expect(host.querySelectorAll('[data-operation-environment-actor]')).toHaveLength(1);
    const operationFrame = host.querySelector<HTMLElement>('[data-workspace-frame="operation"]');
    const preparedLayer = host.querySelector<HTMLElement>('[data-operation-prepared-card-layer]');
    expect(preparedLayer?.parentElement).toBe(operationFrame);
    expect(host.querySelector('[data-operation-relation-layer]')?.parentElement).toBe(operationFrame);
    expect(host.querySelector('[data-operation-drag-status]')?.parentElement).toBe(operationFrame);
    const hoshinoAction = host.querySelector<HTMLElement>('[data-operation-action][data-actor-id="' + IDS.actors.hoshino + '"][aria-pressed="true"]');
    expect(host.querySelector('[data-operation-student="' + IDS.actors.hoshino + '"]')?.getAttribute('data-operation-action-anchor')).toBe(IDS.actors.hoshino);
    expect(hoshinoAction?.parentElement).toBe(preparedLayer);
    expect(hoshinoAction?.dataset.operationPreparedOwnerId).toBe(IDS.actors.hoshino);
    expect(hoshinoAction?.closest('[data-operation-student]')).toBeNull();
    const saboteurIntent = host.querySelector<HTMLElement>('[data-operation-intent="' + IDS.actors.saboteur + '"]');
    expect(saboteurIntent?.parentElement?.matches('[data-operation-prepared-card-layer]')).toBe(true);
    expect(saboteurIntent?.dataset.operationPreparedOwnerId).toBe(IDS.actors.saboteur);
    expect(host.querySelector('.operation-student-list')).toBeNull();
    expect(host.querySelector('.operation-intents')).toBeNull();
    expect(host.querySelector('[data-operation-log]')).not.toBeNull();
    expect(host.querySelector('[data-operation-action]')).not.toBeNull();
    expect(text).toContain('旋转木马安全行动');
    expect(text).toContain('设施危险度');
    expect(text).toContain('星野');
    expect(text).toContain('公开意图');
    expect(text).toContain('场景 / 设施');
    expect(text).toContain('Cost 5');
    expect(view).toMatchObject({ currentStage: 'combat', eventTitle: '旋转木马安全行动' });
    expect(host.querySelector('.operation-chat-heading h1')?.textContent).toBe(view.eventTitle);
    expect(host.querySelector('.operation-opening-message .chat-bubble p')?.textContent).toBe(view.eventDescription);
    expect(host.querySelector('[data-operation-stage="combat"]')).not.toBeNull();
    const battleFaces = [...host.querySelectorAll<HTMLButtonElement>('.operation-card-face--battle[data-operation-action]')];
    expect(battleFaces.length).toBeGreaterThan(3);
    expect(battleFaces.every(face => face.dataset.cardKind === 'battle-action' && !face.querySelector('button'))).toBe(true);
    expect(host.querySelectorAll('.operation-card-face--intent')).toHaveLength(3);
    expect(host.querySelector('[data-operation-intent="' + IDS.actors.saboteur + '"]')?.tagName).toBe('ARTICLE');
    expect(host.querySelectorAll('[data-operation-action-option]')).toHaveLength(battleFaces.length);
    expect(host.querySelector('[data-operation-action-disclosure]')).toBeNull();
    expect(host.querySelector('.operation-card-face--battle .operation-card-type')).toBeNull();
    expect(host.querySelectorAll('[data-operation-action-option][data-operation-action-alternative][hidden]').length).toBeGreaterThan(0);
  });

  it('lets an actorless SceneCard join from the public hand without performer-drag instructions', () => {
    const game = createGame();
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>('#app')!;
    const controller = new UIController(game, root);
    controllers.push(controller);
    controller.started = true;
    controller.render();

    const entry = root.querySelector<HTMLButtonElement>(`[data-operation-start="${ATOMIC_SCENE_DEMO_IDS.event}"]`);
    expect(entry).not.toBeNull();
    entry!.click();
    const workspace = controller.panelState.workspace;
    const runId = workspace?.type === 'operation' ? workspace.runId : '';
    const view = game.operationEntry.getView(runId)!;
    const actorlessCard = view.playerCards.hand.find(card => card.performerPolicy === 'none');
    expect(actorlessCard).toBeDefined();
    const face = root.querySelector<HTMLButtonElement>(
      '[data-operation-player-hand] [data-operation-card-toggle][data-performer-policy="none"]',
    );
    expect(face).not.toBeNull();
    expect(face!.disabled).toBe(false);
    expect(face!.dataset.performerPolicy).toBe('none');
    expect(face!.dataset.actorId).toBe('');
    expect(face!.getAttribute('aria-label')).toContain('点按加入本批');
    expect(face!.getAttribute('aria-label')).not.toContain('角色卡');
    expect(face!.getAttribute('aria-label')).not.toContain('执行者');
    expect(face!.querySelector('[data-operation-card-status]')?.textContent).toBe('可就地加入本批');
    expect(face!.textContent).toContain('遥控停机');

    const snapshotBefore = game.operationEntry.getSnapshot();
    face!.click();

    expect(face!.getAttribute('aria-pressed')).toBe('true');
    expect(readOperationSceneDraft(runId, view.planVersion, view.currentLocationId)?.cards).toEqual([
      { cardInstanceId: actorlessCard!.cardInstanceId, targetActorIds: [] },
    ]);
    expect(game.operationEntry.getSnapshot()).toEqual(snapshotBefore);
    expect(root.querySelector('[data-operation-cost-preview]')?.getAttribute('data-player-cost')).toBe('0');
  });

  it('替代行动牌与目标 tray 使用自身 option 的默认目标', () => {
    const game = createGame();
    const runId = start(game);
    const view = game.operationEntry.getView(runId)!;
    const hoshino = view.actorStates.find(actor => actor.id === IDS.actors.hoshino)!;
    const serika = view.actorStates.find(actor => actor.id === IDS.actors.serika)!;
    const ride = view.actorStates.find(actor => actor.id === IDS.actors.ride)!;
    const options = hoshino.profile!.actionOptions;
    const activePlan = hoshino.currentPlan!;
    const selectedOption = options.find(option => option.actionId === activePlan.actionId)!;
    const alternativeOption = options.find(option => option.actionId !== selectedOption.actionId)!;
    const projectedView = {
      ...view,
      actorStates: view.actorStates.map(actor => actor.id !== hoshino.id ? actor : {
        ...actor,
        currentPlan: { ...activePlan, targetActorId: ride.id },
        profile: {
          ...actor.profile!,
          actionOptions: actor.profile!.actionOptions.map(option => option.actionId === selectedOption.actionId ? {
            ...option,
            defaultTargetActorId: ride.id,
            legalTargetActorIds: [ride.id, serika.id],
          } : option.actionId === alternativeOption.actionId ? {
            ...option,
            defaultTargetActorId: serika.id,
            legalTargetActorIds: [serika.id, ride.id],
          } : option),
        },
      }),
    };
    const host = document.createElement('div');
    host.innerHTML = renderOperationWorkspace(createUIContext(game), projectedView);

    const currentFace = host.querySelector<HTMLButtonElement>(
      '[data-operation-action-current][data-action-id="' + selectedOption.actionId + '"]',
    )!;
    const alternativeFace = host.querySelector<HTMLButtonElement>(
      '[data-operation-action-alternative][data-action-id="' + alternativeOption.actionId + '"]',
    )!;
    expect(currentFace.dataset.targetSummary).toBe('→ ' + ride.displayName);
    expect(currentFace.dataset.selectedTargetActorId).toBe(ride.id);
    expect(alternativeFace.dataset.targetSummary).toBe('→ ' + serika.displayName);
    expect(alternativeFace.dataset.selectedTargetActorId).toBe(serika.id);
    expect(alternativeFace.querySelector('[data-operation-card-target-summary]')?.textContent).toBe('→ ' + serika.displayName);
    expect(host.querySelector('[data-operation-action-targets]')).toBeNull();
    expect(host.querySelector('[data-operation-target]')).toBeNull();
    expect(currentFace.querySelector('[data-operation-action-status]')?.textContent).toBe('自动计划');
    expect(alternativeFace.querySelector('[data-operation-action-status]')?.textContent).toBe('可替换');
  });

  it('uses the explicit Runtime stage for any Location and renders a balance without implying a cap', () => {
    const game = createGame();
    const runId = start(game);
    const view = game.operationEntry.getView(runId)!;
    const combatView: OperationView = {
      ...view,
      currentLocationId: 'test:operation-location:combat',
      currentStage: 'combat',
      currentActionMode: null,
      currentSceneActions: [],
      sceneActionBatchesRemaining: 0,
      locationProgress: {
        ...view.locationProgress,
        'test:operation-location:combat': { ...view.locationProgress[view.currentLocationId]!, completed: false },
      },
    };
    expect(projectOperationActorHand(combatView, IDS.actors.hoshino).every(card => card.kind === 'battle-action')).toBe(true);
    const combatHost = document.createElement('div');
    combatHost.innerHTML = renderOperationWorkspace(createUIContext(game), combatView);
    expect(combatHost.querySelector('[data-operation-stage="combat"]')).not.toBeNull();
    expect(combatHost.querySelector('[data-operation-commit]')).not.toBeNull();
    const sixCost = document.createElement('div');
    sixCost.innerHTML = renderOperationWorkspace(createUIContext(game), { ...view, playerCost: 6 });
    expect(sixCost.querySelector('[data-operation-cost-balance]')?.getAttribute('data-cost-balance')).toBe('6');
    expect(sixCost.querySelectorAll('.operation-cost-slot')).toHaveLength(6);
    expect(sixCost.querySelector('[data-operation-commit]')).not.toBeNull();

    const highCost = document.createElement('div');
    highCost.innerHTML = renderOperationWorkspace(createUIContext(game), { ...view, playerCost: 42 });
    expect(highCost.textContent).toContain('Cost 42');
    expect(highCost.querySelector('[data-cost-compact]')?.textContent).toBe('42');
    expect(highCost.querySelectorAll('.operation-cost-slot')).toHaveLength(0);
  });

  it('renders generic Event copy from OperationView and keeps shared defaults when copy is absent', () => {
    const game = createGame();
    const runId = start(game);
    const sourceView = game.operationEntry.getView(runId)!;
    const genericView: OperationView = {
      ...sourceView,
      eventId: 'author-pack:operation-event:generic-sample',
      eventTitle: '临时设施检查',
      eventDescription: '检查者自定义的任务简报。',
    };
    const host = document.createElement('div');
    host.innerHTML = renderOperationWorkspace(createUIContext(game), genericView);

    expect(host.querySelector('.operation-chat-heading h1')?.textContent).toBe('临时设施检查');
    expect(host.querySelector('.operation-opening-message .chat-bubble p')?.textContent).toBe('检查者自定义的任务简报。');

    host.innerHTML = renderOperationWorkspace(createUIContext(game), {
      ...genericView,
      eventTitle: null,
      eventDescription: null,
    });
    expect(host.querySelector('.operation-chat-heading h1')?.textContent).toBe('Operation 行动');
    expect(host.querySelector('.operation-opening-message .chat-bubble p')?.textContent)
      .toBe('按当前地点和行动提示完成本次行动。');

    const shippedEvents = [
      ...(gameplayBCarouselDatapack.operationEvents ?? []),
      ...(gameplayBStrategyParkDatapack.operationEvents ?? []),
    ];
    expect(shippedEvents.length).toBeGreaterThan(0);
    for (const event of shippedEvents) {
      expect(event.title?.trim(), event.id + ' must provide a title').toBeTruthy();
      expect(event.description?.trim(), event.id + ' must provide a description').toBeTruthy();
    }
  });

  it('uses Event-local presentation, position, and reason labels for Strategy Park', () => {
    const game = createGame();
    const runId = startPark(game);
    let run = game.operationEntry.getSnapshot()!;
    let view = game.operationEntry.getView(runId)!;
    expect(view).toMatchObject({ currentStage: 'scene', eventTitle: '游园会停电巡查' });
    expect(view.eventDescription).toContain('园区多处设施停电');

    game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [{ sceneActionId: PARK_IDS.sceneActions.brief, targetActorIds: [] }],
    });
    view = game.operationEntry.getView(runId)!;
    const host = document.createElement('div');
    host.innerHTML = renderOperationWorkspace(createUIContext(game), view);
    expect(host.querySelector('.operation-chat-heading h1')?.textContent).toBe(view.eventTitle);
    expect(host.querySelector('.operation-opening-message .chat-bubble p')?.textContent).toBe(view.eventDescription);
    expect(host.querySelector('[data-operation-track="' + PARK_IDS.tracks.risk + '"]')?.textContent).toContain('现场风险');
    expect(host.textContent).toContain('队伍已完成出发简报');
    expect(host.textContent).not.toContain('旋转木马控制台已检查');
    expect(host.querySelector('[data-operation-student="' + PARK_IDS.actors.hoshino + '"] [data-operation-position]')?.textContent).toBe('后排');
    expect(host.querySelector('[data-operation-student="' + PARK_IDS.actors.shiroko + '"] [data-operation-position]')?.textContent).toBe('前排');
    expect(host.querySelector('[data-operation-commit]')).toBeNull();

    const unavailable = {
      ...view,
      currentLocationId: 'test:operation-location:combat',
      currentStage: 'combat',
      currentActionMode: null,
      currentSceneActions: [],
      sceneActionBatchesRemaining: 0,
      heldItemIds: [PARK_IDS.items.maintenancePass],
      actorStates: view.actorStates.map(actor => actor.id !== PARK_IDS.actors.hoshino ? actor : {
        ...actor,
        positionId: 'private-position-id',
        profile: {
          ...actor.profile!,
          actionOptions: actor.profile!.actionOptions.map(option => ({
            ...option,
            selectable: false,
            blockedReasonIds: ['operation:intervention:action-not-enabled'],
          })),
        },
      }),
      locationProgress: {
        ...view.locationProgress,
        'test:operation-location:combat': { ...view.locationProgress[view.currentLocationId]!, completed: false },
      },
    } satisfies OperationView;
    const unavailableHand = projectOperationActorHand(unavailable, PARK_IDS.actors.hoshino);
    expect(unavailableHand.filter(card => card.state === 'selected')).toHaveLength(1);
    expect(unavailableHand.filter(card => card.state === 'unavailable').every(card => card.unavailableReason)).toBe(true);
    host.innerHTML = renderOperationWorkspace(createUIContext(game), unavailable);
    expect(host.textContent).toContain('维修通行证');
    expect(host.textContent).toContain('不可用');
    expect(host.textContent).toContain('当前地点不允许此行动。');
    expect(host.textContent).not.toContain('private-position-id');
    expect(host.querySelector('[data-operation-student="' + PARK_IDS.actors.hoshino + '"] [data-operation-position]')?.getAttribute('data-operation-position')).toBe('unknown');
  });

  it('shows the first legal target as the SceneAction default without selecting the Action', () => {
    const game = createGame();
    const runId = game.operationEntry.start(ATOMIC_SCENE_DEMO_IDS.event, [Character.Hoshino, Character.Serika]).runId;
    const view = game.operationEntry.getView(runId)!;
    const sceneAction = view.currentSceneActions.find(action => action.id === ATOMIC_SCENE_DEMO_IDS.sceneAction)!;
    const prioritizedTargets = [ATOMIC_SCENE_DEMO_IDS.enemyBack, ATOMIC_SCENE_DEMO_IDS.enemyFrontA];
    const prioritizedView: OperationView = {
      ...view,
      currentSceneActions: view.currentSceneActions.map(action => action.id !== sceneAction.id ? action : {
        ...action,
        selectionPolicy: 'required',
        legalTargetActorIdsByActorId: {
          ...action.legalTargetActorIdsByActorId,
          [CAROUSEL_SAFETY_IDS.actors.hoshino]: prioritizedTargets,
        },
      }),
    };
    const host = document.createElement('div');
    host.innerHTML = renderOperationWorkspace(createUIContext(game), prioritizedView);
    const face = host.querySelector<HTMLButtonElement>(
      '[data-operation-scene-card][data-actor-id="' + CAROUSEL_SAFETY_IDS.actors.hoshino + '"] [data-operation-scene-choice][data-scene-action-id="' + ATOMIC_SCENE_DEMO_IDS.sceneAction + '"]',
    )!;

    expect(JSON.parse(face.dataset.selectedTargetActorIds ?? '[]')).toEqual([ATOMIC_SCENE_DEMO_IDS.enemyBack]);
    expect(face.dataset.targetSummary).toContain('敌人丙');
    expect(face.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps SceneAction controls available and labels an omitted batch limit as unlimited', () => {
    const game = createGame();
    const runId = start(game);
    const view = game.operationEntry.getView(runId)!;
    const unlimitedView: OperationView = {
      ...view,
      currentActionMode: 'individual',
      sceneActionBatchesUsed: 7,
      sceneActionBatchesRemaining: null,
    };
    const host = document.createElement('div');
    host.innerHTML = renderOperationWorkspace(createUIContext(game), unlimitedView);

    expect(host.textContent).toContain('已提交 7 批 · 不限');
    expect(host.querySelector('[data-operation-scene-submit]')).not.toBeNull();
    expect(host.querySelector('[data-operation-scene-skip]')).not.toBeNull();
  });

  it('reading a missing scene-draft version does not evict the stored draft', () => {
    const runId = 'operation-draft-pure-read-regression';
    const draft = { selections: [{ sceneActionId: IDS.sceneActions.inspect, actorId: IDS.actors.hoshino, targetActorIds: [] }], cards: [] };
    saveOperationSceneDraft(runId, 3, IDS.locations.concourse, draft);

    expect(readOperationSceneDraft(runId, 4, IDS.locations.concourse)).toBeUndefined();
    expect(readOperationSceneDraft(runId, 3, IDS.locations.concourse)).toBe(draft);
  });

  it('projects detached actor names and HP on each side of the chat stream', () => {
    const game = createGame();
    const runId = start(game);
    const view = game.operationEntry.getView(runId)!;
    const hoshino = view.actorStates.find(actor => actor.id === IDS.actors.hoshino)!;
    const opponent = view.actorStates.find(actor => actor.id === IDS.actors.saboteur)!;
    expect(hoshino).toMatchObject({ displayName: '小鸟游星野', maxHp: expect.any(Number) });
    expect(opponent).toMatchObject({ displayName: '破坏者', maxHp: expect.any(Number), participantKind: 'opponent' });
    const host = document.createElement('div');
    host.innerHTML = render(game, runId);
    expect(host.querySelector('[data-operation-student="' + hoshino.id + '"]')?.textContent).toContain(hoshino.displayName);
    expect(host.querySelector('[data-operation-opponent="' + opponent.id + '"]')?.textContent).toContain(opponent.displayName);
    const serika = view.actorStates.find(actor => actor.id === IDS.actors.serika)!;
    const shiroko = view.actorStates.find(actor => actor.id === IDS.actors.shiroko)!;
    const student = (id: string) => host.querySelector<HTMLElement>('[data-operation-student="' + id + '"]');
    expect(student(hoshino.id)?.querySelector('[data-operation-scost]')?.textContent).toContain('体力 1');
    expect(student(serika.id)?.querySelector('[data-operation-scost]')?.textContent).toContain('专注 0');
    expect(student(shiroko.id)?.querySelector('[data-operation-scost]')?.textContent).toContain('—');
    expect(student(shiroko.id)?.querySelector('[data-operation-scost]')?.textContent).not.toContain('协调');
    expect(view.teamStates.some(team => team.resources.coordination !== undefined)).toBe(true);
    const personalCoordinationView = {
      ...view,
      actorStates: view.actorStates.map(actor => actor.id === shiroko.id ? { ...actor, resources: { coordination: 2 } } : actor),
    };
    const personalCoordinationHost = document.createElement('div');
    personalCoordinationHost.innerHTML = renderOperationWorkspace(createUIContext(game), personalCoordinationView);
    expect(personalCoordinationHost.querySelector('[data-operation-student="' + shiroko.id + '"] [data-operation-scost]')?.textContent).toContain('个人协调 2');
    expect(student(hoshino.id)?.querySelector('[role="meter"]')).not.toBeNull();
    expect(student(hoshino.id)?.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe(String(hoshino.hp));
    expect(student(hoshino.id)?.querySelector('[role="meter"]')?.getAttribute('aria-valuemax')).toBe(String(hoshino.maxHp));
    expect(student(hoshino.id)?.querySelector('[role="meter"] span')?.getAttribute('style')).toContain('--operation-hp-fill:');
  });

  it('shows the Individual scene batch, held-item route and Global hand at their locations', () => {
    const game = createGame();
    const runId = start(game);
    let run = game.operationEntry.getSnapshot()!;
    game.operationEntry.reviseIntervention({
      runId,
      planVersion: run.planVersion,
      draft: { actorId: IDS.actors.hoshino, actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop },
    });
    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });
    run = game.operationEntry.getSnapshot()!;
    expect(run.currentLocationId).toBe(IDS.locations.platform);
    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: IDS.routes.platformToConcourse });
    let view = game.operationEntry.getView(runId)!;
    expect(view.currentLocationId).toBe(IDS.locations.concourse);
    expect(view.currentStage).toBe('scene');
    let host = document.createElement('div');
    host.innerHTML = render(game, runId);
    expect(host.querySelectorAll('[data-operation-scene-card][data-actor-id]')).toHaveLength(3);
    expect(host.querySelectorAll('[data-operation-scene-selection]')).toHaveLength(0);
    expect(host.querySelector('[data-operation-player-hand]')).not.toBeNull();
    const sceneFaces = [...host.querySelectorAll<HTMLButtonElement>('[data-operation-scene-choice]')];
    expect(sceneFaces.length).toBeGreaterThanOrEqual(3);
    expect(sceneFaces.every(face => face.classList.contains('operation-card-face--scene') && face.dataset.cardKind === 'scene-action')).toBe(true);
    expect(sceneFaces.every(face => face.getAttribute('aria-pressed') === 'false' && face.dataset.selectionState === 'browsing')).toBe(true);
    const physicalCards = [...host.querySelectorAll<HTMLElement>('[data-operation-player-card]')];
    expect(new Set(physicalCards.map(card => card.dataset.operationPlayerCard)).size).toBe(physicalCards.length);
    expect(physicalCards.every(card => card.querySelectorAll('.operation-card-face--player[data-operation-card-toggle]').length === 1)).toBe(true);
    expect(host.querySelector('.operation-player-card__tools')).toBeNull();
    expect(host.querySelector('[data-operation-card-owner-select], [data-operation-scene-performer-select]')).toBeNull();

    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [
        { sceneActionId: IDS.sceneActions.inspect, actorId: IDS.actors.hoshino, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.serika, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.shiroko, targetActorIds: [] },
      ],
    });
    view = game.operationEntry.getView(runId)!;
    expect(view.heldItemIds).toContain(IDS.item);
    expect(view.currentRoutes.find(route => route.routeId === IDS.routes.staffGate)?.available).toBe(true);
    host = document.createElement('div');
    host.innerHTML = render(game, runId);
    const resolutionLog = host.querySelector('[data-operation-resolution-log]')?.textContent ?? '';
    expect(resolutionLog).toContain('星野使用检查控制台');
    expect(resolutionLog).toContain('本批实际支付 ' + view.resolutions.at(-1)?.sceneBatch?.playerCostPaid + ' PlayerCost');
    expect(resolutionLog).toContain('记录信息：旋转木马控制台已检查');
    expect(resolutionLog).toContain('获得员工证');
    expect(host.querySelector('[data-operation-fact-message]')).toBeNull();
    expect(host.querySelector('.operation-current-items')?.textContent).toContain('当前持有：员工证');
    expect(host.querySelector('[data-operation-routes]')).not.toBeNull();
    expect(host.textContent).toContain('员工通道');

    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: IDS.routes.staffGate });
    view = game.operationEntry.getView(runId)!;
    host = document.createElement('div');
    host.innerHTML = render(game, runId);
    expect(view).toMatchObject({ currentLocationId: IDS.locations.exit, currentActionMode: 'global' });
    const globalSceneCard = host.querySelector<HTMLElement>('[data-global-scene-card]');
    expect(globalSceneCard).not.toBeNull();
    expect(host.querySelector('[data-operation-global-action]')).toBeNull();
    expect(host.querySelector('[data-operation-route-history]')?.textContent).toContain('游乐园通道 → 出口集合点');
    expect(host.querySelectorAll('[data-operation-entry-cost-item]')).toHaveLength(3);
    const timelineItems = [...host.querySelectorAll<HTMLElement>('[data-operation-timeline-sequence]')];
    const timelineSequences = timelineItems.map(item => Number(item.dataset.operationTimelineSequence));
    expect(timelineSequences).toEqual([...timelineSequences].sort((left, right) => left - right));
    expect(new Set(timelineSequences).size).toBe(timelineSequences.length);
    expect(view.resolutions.at(-1)!.timelineSequence).toBeLessThan(view.routeHistory.at(-1)!.timelineSequence);
    expect(view.routeHistory.at(-1)!.timelineSequence).toBeLessThan(view.locationEntryCostHistory.at(-1)!.timelineSequence);
    expect(host.querySelector('[data-operation-timeline-order-warning]')).toBeNull();
    expect(host.querySelectorAll('[data-operation-player-card]')).toHaveLength(view.playerCards.hand.length);
    expect(host.querySelectorAll('.operation-card-face--scene.is-global')).toHaveLength(1);
    const globalSceneFace = globalSceneCard!.querySelector<HTMLButtonElement>('[data-operation-scene-choice]')!;
    expect(globalSceneFace.getAttribute('aria-pressed')).toBe('false');
    expect(globalSceneFace.dataset.actorId).toBe('');
    expect(JSON.parse(globalSceneFace.dataset.operationPerformerCandidateActorIds ?? '[]')).toContain(IDS.actors.hoshino);
    expect(globalSceneCard!.querySelector('[data-operation-scene-performer]')).toBeNull();
    expect(globalSceneCard!.textContent).toContain('可就地激活；也可指定学生');
    expect(host.querySelector('[data-operation-cost-balance]')).not.toBeNull();

    const handCard = view.playerCards.hand.find(card => card.selectionPolicy === 'required' && card.performerPolicy === 'optional-student')!;
    const unavailablePerformerView: OperationView = {
      ...view,
      playerCards: {
        ...view.playerCards,
        hand: view.playerCards.hand.map(card => card.cardInstanceId === handCard.cardInstanceId
          ? { ...card, performerPolicy: 'selected-student' as const, eligibleActorIds: [], legalTargetActorIdsByActorId: {} }
          : card),
      },
    };
    host.innerHTML = renderOperationWorkspace(createUIContext(game), unavailablePerformerView);
    const unavailableCardFace = host.querySelector<HTMLButtonElement>(
      '[data-operation-player-card="' + handCard.cardInstanceId + '"] [data-operation-card-toggle]',
    );
    expect(unavailableCardFace?.disabled).toBe(true);
    expect(unavailableCardFace?.dataset.selectionState).toBe('unavailable');
    expect(unavailableCardFace?.getAttribute('aria-label')).toContain('当前没有合格执行者');
    expect(unavailableCardFace?.querySelector('[data-operation-card-status]')?.textContent).toContain('当前没有合格执行者');
  });

  it('shows an unavailable state instead of exposing a stale run', () => {
    const game = new GameInstance();
    game.init([baseDatapack], { enterDefaultInit: true });
    games.push(game);
    const html = render(game, 'stale-operation-run');
    const host = document.createElement('div');
    host.innerHTML = html;

    expect(host.querySelector('[data-operation-unavailable]')).not.toBeNull();
    expect(host.textContent).toContain('持有且解锁星野、芹香与白子');
    expect(host.textContent).not.toContain('stale-operation-run');
    expect(host.querySelector('[data-operation-commit]')).toBeNull();
  });

  it('keeps route loops in their own recorded order and shows one terminal conclusion', () => {
    const game = createAppRuntime({ operationContentResolver: carouselRouteSliceResolver });
    game.init([baseDatapack], { enterDefaultInit: true });
    games.push(game);
    for (const student of VARIANTS) game.mutations.acquireCharacter(student, 'story');
    const runId = game.operationEntry.start(CAROUSEL_ROUTE_IDS.event, STUDENTS).runId;
    let run = game.operationEntry.getSnapshot()!;
    game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });
    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: CAROUSEL_ROUTE_IDS.routes.staffGate });
    expect(game.operationEntry.getView(runId)?.heldItemIds).not.toContain(CAROUSEL_ROUTE_IDS.item);
    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: CAROUSEL_ROUTE_IDS.routes.maintenanceLoop });
    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: CAROUSEL_ROUTE_IDS.routes.emergencyExit });
    const view = game.operationEntry.getView(runId)!;
    expect(view.status).toBe('success');
    const host = document.createElement('div');
    host.innerHTML = render(game, runId);
    const routeItems = [...host.querySelectorAll<HTMLElement>('[data-operation-route-history-item]')];
    expect(routeItems.map(item => item.dataset.routeId)).toEqual([
      CAROUSEL_ROUTE_IDS.routes.staffGate,
      CAROUSEL_ROUTE_IDS.routes.maintenanceLoop,
      CAROUSEL_ROUTE_IDS.routes.emergencyExit,
    ]);
    expect(routeItems.map(item => item.dataset.fromLocationId)).toEqual([
      CAROUSEL_ROUTE_IDS.locations.platform,
      CAROUSEL_ROUTE_IDS.locations.maintenance,
      CAROUSEL_ROUTE_IDS.locations.platform,
    ]);
    expect(host.querySelectorAll('[data-operation-outcome]')).toHaveLength(1);
    expect(host.querySelector('[data-operation-commit-dock]')?.textContent).not.toContain('主要目标已完成');
    expect(host.querySelectorAll('[data-operation-entry-cost-item]')).toHaveLength(0);
    const resolution = view.resolutions[0];
    const clippedView = {
      ...view,
      resolutions: Array.from({ length: 32 }, (_, index) => ({ ...resolution, resolutionSequence: index + 2 })),
      resolutionSequence: 33,
    };
    host.innerHTML = renderOperationWorkspace(createUIContext(game), clippedView);
    expect(host.querySelector('[data-operation-history-limit]')?.textContent).toContain('最近 32 条');
    expect(host.querySelector('[data-operation-resolution="2"]')).not.toBeNull();
    expect(host.querySelector('[data-operation-resolution="33"]')).not.toBeNull();
  });
});
