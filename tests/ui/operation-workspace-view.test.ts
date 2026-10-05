// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { PanelState } from '../../src/ui/components/app-shell';
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
    expect(host.querySelectorAll('[data-operation-scene-selection]')).toHaveLength(3);
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
    expect(host.querySelector('[data-operation-routes]')).not.toBeNull();
    expect(host.textContent).toContain('员工通道');

    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: IDS.routes.staffGate });
    view = game.operationEntry.getView(runId)!;
    host = document.createElement('div');
    host.innerHTML = render(game, runId);
    expect(view).toMatchObject({ currentLocationId: IDS.locations.exit, currentActionMode: 'global' });
    expect(host.querySelector('[data-operation-global-action]')).not.toBeNull();
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
});
