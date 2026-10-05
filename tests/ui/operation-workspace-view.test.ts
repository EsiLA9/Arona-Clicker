// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_ROUTE_IDS, carouselRouteSliceResolver } from '../../src/arona-clicker/content/operation-samples/carousel-route-slice';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { PanelState } from '../../src/ui/components/app-shell';
import { renderOperationWorkspace } from '../../src/ui/components/operation-workspace';
import { createUIContext } from '../../src/ui/context';
import { renderWorkspace } from '../../src/ui/workspace/workspace-renderer';
import { createWorkspaceNavigation } from '../../src/ui/workspace/workspace-router';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { baseDatapack } from '../../src/data/test-datapack';

const STUDENTS = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const VARIANTS = ['Hoshino', 'Serika', 'Shiroko'] as const;

describe('Gameplay B Operation workspace view', () => {
  const games: GameInstance[] = [];

  function createGame(): GameInstance {
    const game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
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

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  it('shows the three roles and keeps plans attached to their owning cards', () => {
    const game = createGame();
    const runId = start(game);
    const html = render(game, runId);
    const host = document.createElement('div');
    host.innerHTML = html;
    const text = host.textContent ?? '';

    expect(html).toContain('data-composition="columns"');
    expect(html).toContain('data-workspace-role="our-team"');
    expect(html).toContain('data-workspace-role="information"');
    expect(html).toContain('data-workspace-role="opponents"');
    expect(host.querySelectorAll('[data-workspace-column]')).toHaveLength(3);
    expect(host.querySelectorAll('[data-operation-student]')).toHaveLength(3);
    expect(host.querySelectorAll('[data-operation-opponent]')).toHaveLength(2);
    expect(host.querySelectorAll('[data-operation-environment-actor]')).toHaveLength(1);
    expect(host.querySelector('[data-operation-plan="' + IDS.actors.hoshino + '"]')?.closest('[data-operation-student]')?.getAttribute('data-operation-student')).toBe(IDS.actors.hoshino);
    expect(host.querySelector('[data-operation-intent="' + IDS.actors.saboteur + '"]')?.closest('[data-operation-opponent]')?.getAttribute('data-operation-opponent')).toBe(IDS.actors.saboteur);
    expect(host.querySelector('.operation-student-list')).toBeNull();
    expect(host.querySelector('.operation-intents')).toBeNull();
    expect(host.querySelector('[data-operation-log]')).not.toBeNull();
    expect(host.querySelector('[data-operation-action]')).not.toBeNull();
    expect(text).toContain('旋转木马安全行动');
    expect(text).toContain('设施危险度');
    expect(text).toContain('星野');
    expect(text).toContain('对手意图');
    expect(text).toContain('场景 / 设施');
    expect(text).toContain('Cost 5');
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
    let view = game.operationEntry.getView(runId)!;
    expect(view.currentLocationId).toBe(IDS.locations.concourse);
    let host = document.createElement('div');
    host.innerHTML = render(game, runId);
    expect(host.querySelectorAll('[data-operation-scene-card][data-actor-id]')).toHaveLength(3);
    expect(host.querySelectorAll('[data-operation-scene-selection]')).toHaveLength(0);
    expect(host.querySelector('[data-operation-player-hand]')).not.toBeNull();

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
    expect(resolutionLog).toContain('记录事实：旋转木马控制台已检查');
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
    expect(host.querySelector('[data-global-scene-card]')).not.toBeNull();
    expect(host.querySelector('[data-operation-global-action]')).toBeNull();
    expect(host.querySelector('[data-operation-route-history]')?.textContent).toContain('游乐园通道 → 出口集合点');
    expect(host.querySelectorAll('[data-operation-entry-cost-item]')).toHaveLength(3);
    expect(host.querySelectorAll('[data-operation-player-card]')).toHaveLength(view.playerCards.hand.length);
    expect(host.querySelector('[data-operation-cost-balance]')).not.toBeNull();
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
