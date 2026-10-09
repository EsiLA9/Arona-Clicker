import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { gameplayBStrategyParkContent, gameplayBStrategyParkDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park';
import { GAMEPLAY_B_STRATEGY_PARK_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids';
import { Character } from '../../src/arona-clicker/types/ids';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { OperationView } from '../../src/arona-clicker/contracts/operation-view';

const roster = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const variants: Record<typeof roster[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};

const locationNames: Readonly<Record<string, string>> = {
  [IDS.locations.westGate]: '01 西门临时执勤点',
  [IDS.locations.corridor]: '02 林荫连廊',
  [IDS.locations.kiosk]: '03 游园服务亭',
  [IDS.locations.arcade]: '04 代币电玩馆',
  [IDS.locations.bumper]: '05 失控碰碰车区',
  [IDS.locations.aid]: '06 急救补给站',
  [IDS.locations.maze]: '07 镜面迷宫',
  [IDS.locations.ferris]: '08 摩天轮检修廊',
  [IDS.locations.fireworks]: '09 烟花排练广场',
  [IDS.locations.backstage]: '10 后台休息室',
  [IDS.locations.boss]: '11 中央舞台设备井',
  [IDS.locations.exit]: '12 东出口交接处',
  [IDS.locations.control]: '13 地下设备层控制室',
};

type SceneChoice = {
  readonly sceneActionId: string;
  readonly individualFallbackSceneActionId?: string;
  readonly targetActorIds?: readonly string[];
};
type RouteChoice = { readonly from: string; readonly routeId: string };

interface RouteScript {
  readonly label: string;
  readonly scenes: Readonly<Record<string, readonly SceneChoice[]>>;
  readonly routes: readonly RouteChoice[];
  readonly expectedStatus: string;
}

const partyTargets = [IDS.actors.hoshino, IDS.actors.serika, IDS.actors.shiroko];

const classicRoute: RouteScript = {
  label: '三场经典战斗与迷宫回访主线',
  scenes: {
    [IDS.locations.westGate]: [{ sceneActionId: IDS.sceneActions.brief }],
    [IDS.locations.corridor]: [{ sceneActionId: IDS.sceneActions.tracks }, { sceneActionId: IDS.sceneActions.tracks }],
    [IDS.locations.kiosk]: [{ sceneActionId: IDS.sceneActions.radio }],
    [IDS.locations.arcade]: [
      { sceneActionId: IDS.sceneActions.negotiateCalm, individualFallbackSceneActionId: IDS.sceneActions.negotiateListen }, // 一人搜索抽屉，其余检查控制台
      { sceneActionId: IDS.sceneActions.negotiateListen }, // 回访后检查控制台
    ],
    [IDS.locations.maze]: [
      { sceneActionId: IDS.sceneActions.negotiatePass, individualFallbackSceneActionId: IDS.sceneActions.maze }, // 一人搜索侧廊，其余跟随标记
      { sceneActionId: IDS.sceneActions.maze },
    ],
    [IDS.locations.aid]: [{ sceneActionId: IDS.sceneActions.aid, targetActorIds: partyTargets }],
    [IDS.locations.ferris]: [{ sceneActionId: IDS.sceneActions.panel }],
    [IDS.locations.backstage]: [{ sceneActionId: IDS.sceneActions.rest, targetActorIds: partyTargets }],
    [IDS.locations.exit]: [{ sceneActionId: IDS.sceneActions.handoff }],
  },
  routes: [
    { from: IDS.locations.kiosk, routeId: IDS.routes.kioskToArcade },
    { from: IDS.locations.arcade, routeId: IDS.routes.arcadeToMaze },
    { from: IDS.locations.maze, routeId: IDS.routes.mazeToArcade },
    { from: IDS.locations.arcade, routeId: IDS.routes.arcadeToMaze },
    { from: IDS.locations.maze, routeId: IDS.routes.mazeToBumper },
    { from: IDS.locations.ferris, routeId: IDS.routes.ferrisToBackstage },
  ],
  expectedStatus: 'success',
};

function controlRoute(credential: 'maintenancePass' | 'staffRadio'): RouteScript {
  return {
    label: `地下控制室支线（${credential}）`,
    scenes: {
      [IDS.locations.westGate]: [{ sceneActionId: IDS.sceneActions.brief }],
      [IDS.locations.corridor]: [{ sceneActionId: IDS.sceneActions.tracks }, { sceneActionId: IDS.sceneActions.tracks }],
      [IDS.locations.kiosk]: [{ sceneActionId: IDS.sceneActions.radio }],
      [IDS.locations.arcade]: [{ sceneActionId: IDS.sceneActions.negotiateCalm, individualFallbackSceneActionId: IDS.sceneActions.negotiateListen }],
      [IDS.locations.maze]: [{ sceneActionId: IDS.sceneActions.negotiatePass, individualFallbackSceneActionId: IDS.sceneActions.maze }],
      [IDS.locations.ferris]: [
        { sceneActionId: IDS.sceneActions.panel, individualFallbackSceneActionId: IDS.sceneActions.negotiatePass },
        { sceneActionId: IDS.sceneActions.panel, individualFallbackSceneActionId: IDS.sceneActions.negotiatePass },
      ],
      [IDS.locations.control]: [
        { sceneActionId: IDS.sceneActions.controlPower, targetActorIds: [IDS.actors.hoshino] },
        { sceneActionId: IDS.sceneActions.controlPower, targetActorIds: [IDS.actors.hoshino] },
      ],
      [IDS.locations.exit]: [{ sceneActionId: IDS.sceneActions.handoff }],
    },
    routes: [
      { from: IDS.locations.kiosk, routeId: IDS.routes.kioskToArcade },
      { from: IDS.locations.arcade, routeId: IDS.routes.arcadeToMaze },
      { from: IDS.locations.maze, routeId: IDS.routes.mazeToFerris },
      { from: IDS.locations.ferris, routeId: IDS.routes.ferrisToControl },
      { from: IDS.locations.control, routeId: IDS.routes.controlToFerris },
      { from: IDS.locations.ferris, routeId: IDS.routes.ferrisToControl },
      { from: IDS.locations.control, routeId: credential === 'maintenancePass'
        ? IDS.routes.controlToBossPass
        : IDS.routes.controlToBossRadio },
    ],
    expectedStatus: 'success',
  };
}

interface ReplayResult {
  readonly transcript: string;
  readonly route: readonly string[];
  readonly battleBeatCounts: Readonly<Record<string, number>>;
  readonly sceneIdentities: readonly string[];
  readonly status: string;
  readonly consumedItems: readonly string[];
  readonly arcadeVisits: number;
  readonly mazeVisits: number;
  readonly ferrisVisits: number;
  readonly controlVisits: number;
}

const games: GameInstance[] = [];

describe('Gameplay B Strategy Park headless virtual play', () => {
  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('replays the full classic route and control-room credential branches through real Operation with one fixed seed', () => {
    expect(gameplayBStrategyParkContent.eventDefinition.randomSeed).toBe(241024);
    expect(gameplayBStrategyParkContent.locations).toHaveLength(13);
    expect(gameplayBStrategyParkContent.locations.every(location => location.scenes === undefined)).toBe(true);
    const scripts = [classicRoute, controlRoute('maintenancePass'), controlRoute('staffRadio')];
    const first = scripts.map(playScenario);
    const replay = scripts.map(playScenario);
    expect(first).toEqual(replay);
    const observedSceneIdentities = new Set(first.flatMap(result => result.sceneIdentities));
    expect([...observedSceneIdentities].sort()).toEqual(gameplayBStrategyParkContent.locations
      .map(location => `${IDS.event}/${location.id}/main`)
      .sort());

    const [classic, passBranch, radioBranch] = first;
    expect(classic).toMatchObject({ status: 'success', battleBeatCounts: {
      [IDS.locations.bumper]: 3,
      [IDS.locations.fireworks]: 3,
      [IDS.locations.boss]: 4,
    }, arcadeVisits: 2, mazeVisits: 2, ferrisVisits: 1, controlVisits: 0 });
    expect(classic.route).toEqual([
      IDS.locations.corridor, IDS.locations.kiosk, IDS.locations.arcade, IDS.locations.maze,
      IDS.locations.arcade, IDS.locations.maze, IDS.locations.bumper, IDS.locations.aid,
      IDS.locations.ferris, IDS.locations.backstage, IDS.locations.fireworks, IDS.locations.boss, IDS.locations.exit,
    ]);
    expect(classic.route).toContain(IDS.locations.fireworks);
    expect(classic.transcript).toContain('maxVisits 已阻止第三次返回代币电玩馆');
    expect(classic.transcript).toContain('地下控制室凭证门在本主线未选择');

    expect(passBranch).toMatchObject({ status: 'success', ferrisVisits: 2, controlVisits: 2 });
    expect(passBranch.route).toEqual([
      IDS.locations.corridor, IDS.locations.kiosk, IDS.locations.arcade, IDS.locations.maze,
      IDS.locations.ferris, IDS.locations.control, IDS.locations.ferris, IDS.locations.control,
      IDS.locations.boss, IDS.locations.exit,
    ]);
    expect(passBranch.consumedItems).toContain(IDS.items.maintenancePass);
    expect(passBranch.consumedItems).not.toContain(IDS.items.staffRadio);
    expect(passBranch.transcript).toContain('maintenance-pass 已消费');
    expect(radioBranch).toMatchObject({ status: 'success', ferrisVisits: 2, controlVisits: 2 });
    expect(radioBranch.consumedItems).toContain(IDS.items.staffRadio);
    expect(radioBranch.consumedItems).not.toContain(IDS.items.maintenancePass);
    expect(radioBranch.transcript).toContain('staff-radio 已消费');

    console.info(first.map(result => result.transcript).join('\n\n'));
  });
});

function playScenario(script: RouteScript): ReplayResult {
  const game = createAppRuntime();
  games.push(game);
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  console.log = () => undefined;
  console.warn = () => undefined;
  console.info = () => undefined;
  console.debug = () => undefined;
  try {
    game.init([defaultDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    if (game.state.activeInit !== DEFAULT_INIT_ID) throw new Error('unexpected initial Init');
    for (const character of roster) game.mutations.acquireCharacter(variants[character], 'story');
    const { runId } = game.operationEntry.start(IDS.event, roster);
    const transcript = [`# ${script.label}`, `Seed: ${gameplayBStrategyParkContent.eventDefinition.randomSeed}; Event: ${IDS.event}`];
    const sceneQueues = Object.fromEntries(Object.entries(script.scenes).map(([id, choices]) => [id, [...choices]]));
    const routeQueues = new Map<string, string[]>();
    for (const choice of script.routes) routeQueues.set(choice.from, [...(routeQueues.get(choice.from) ?? []), choice.routeId]);
    const battleBeatCounts: Record<string, number> = {};
    const sceneIdentities = new Set<string>();
    const consumedItems: string[] = [];
    let arcadeThirdVisitBlocked = false;
    let run = game.operationEntry.getSnapshot()!;
    let view = game.operationEntry.getView(runId)!;
    let guard = 0;

    while (view.status === 'inProgress') {
      if (++guard > 80) throw new Error(`${script.label} exceeded 80 Operation commands at ${view.currentLocationId}`);
      const locationId = view.currentLocationId;
      const location = gameplayBStrategyParkContent.locations.find(row => row.id === locationId)!;
      transcript.push(`\n[${locationNames[locationId] ?? locationId}] visits=${run.locationProgress[locationId]?.visitCount ?? 0}`);
      if (!run.locationProgress[locationId]?.completed) {
        expect(view).toMatchObject({
          eventId: IDS.event,
          currentLocationId: locationId,
          currentSceneId: 'main',
          currentScene: { sceneId: 'main', status: 'active' },
        });
        sceneIdentities.add(`${view.eventId}/${locationId}/${view.currentSceneId}`);
      }

      if (!run.locationProgress[locationId]?.completed && location.interactionSceneId === 'park:combat') {
        battleBeatCounts[locationId] = (battleBeatCounts[locationId] ?? 0) + 1;
        if (battleBeatCounts[locationId] === 1) transcript.push('  战斗开始');
        const resolution = game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });
        expect(resolution).toMatchObject({ eventId: IDS.event, locationId, sceneId: 'main' });
        transcript.push(`  Beat ${battleBeatCounts[locationId]} 已结算`);
        run = game.operationEntry.getSnapshot()!;
        view = game.operationEntry.getView(runId)!;
        continue;
      }

      if (view.currentActionMode !== null && !run.locationProgress[locationId]?.completed) {
        const choice = sceneQueues[locationId]?.shift();
        if (!choice) throw new Error(`missing scene action script for ${locationNames[locationId] ?? locationId}`);
        const option = view.currentSceneActions.find(row => row.id === choice.sceneActionId);
        if (!option || (option.performerPolicy === 'selected-student' && !option.eligibleActorIds.includes(IDS.actors.hoshino))) {
          throw new Error(`scene action ${choice.sceneActionId} unavailable for Hoshino at ${locationId}`);
        }
        const beforeItems = new Set(view.heldItemIds);
        const performerIds: readonly (string | undefined)[] = option.performerPolicy === 'none'
          ? [undefined]
          : option.scope === 'individual' ? option.eligibleActorIds : [IDS.actors.hoshino];
        const fallback = choice.individualFallbackSceneActionId;
        const resolution = game.operationEntry.commitSceneActionBatch({
          runId,
          planVersion: run.planVersion,
          selections: performerIds.map((actorId, index) => ({
            sceneActionId: index === 0 || !fallback ? choice.sceneActionId : fallback,
            ...(actorId ? { actorId } : {}),
            targetActorIds: [...(choice.targetActorIds ?? [])],
          })),
        });
        expect(resolution).toMatchObject({ eventId: IDS.event, locationId, sceneId: 'main' });
        transcript.push(`  SceneAction ${choice.sceneActionId} 已提交; ${JSON.stringify(resolution.sceneBatch?.selections ?? [])}`);
        run = game.operationEntry.getSnapshot()!;
        view = game.operationEntry.getView(runId)!;
        if (locationId === IDS.locations.westGate) {
          expect(resolution.sceneBatch?.selections).toHaveLength(1);
          expect(resolution.sceneBatch?.selections[0]).toMatchObject({
            sceneActionId: IDS.sceneActions.brief,
            targetActorIds: [],
          });
          expect(resolution.sceneBatch?.selections[0]).not.toHaveProperty('actorId');
          expect(view.knownFactIds).toContain(IDS.facts.briefed);
        }
        if (locationId === IDS.locations.control) {
          expect(location.sceneActions?.find(action => action.id === IDS.sceneActions.controlRecord))
            .toMatchObject({ performerPolicy: 'none', selectionPolicy: 'fixed', playerCost: 0 });
          expect(resolution.sceneBatch?.selections).toEqual(expect.arrayContaining([
            expect.objectContaining({ sceneActionId: IDS.sceneActions.controlPower, actorId: IDS.actors.hoshino }),
            expect.objectContaining({ sceneActionId: IDS.sceneActions.controlRecord }),
          ]));
          expect(resolution.sceneBatch?.playerCostPaid).toBe(2);
          expect(view.knownFactIds).toContain(IDS.facts.powerPanel);
          transcript.push('  固定控制台记录随必选复位行动一同结算');
        }
        for (const itemId of beforeItems) if (!view.heldItemIds.includes(itemId)) consumedItems.push(itemId);
        continue;
      }

      const routeOptions = view.currentRoutes;
      if (routeOptions.length === 0) throw new Error(`no route options at completed location ${locationId}`);
      if (script === classicRoute && locationId === IDS.locations.maze
        && (run.locationProgress[IDS.locations.arcade]?.visitCount ?? 0) >= 2) {
        arcadeThirdVisitBlocked = routeOptions.some(route => route.routeId === IDS.routes.mazeToArcade && !route.available);
        if (arcadeThirdVisitBlocked) transcript.push('maxVisits 已阻止第三次返回代币电玩馆');
      }
      const scriptedRouteId = routeQueues.get(locationId)?.shift();
      const selected = scriptedRouteId
        ? routeOptions.find(route => route.routeId === scriptedRouteId)
        : routeOptions.find(route => route.available);
      if (!selected) throw new Error(`missing route ${scriptedRouteId ?? '(any open)'} at ${locationId}`);
      if (!selected.available) throw new Error(`scripted route ${selected.routeId} is locked at ${locationId}: ${selected.lockedReason}`);
      const visitsBefore = run.locationProgress[selected.targetLocationId]?.visitCount ?? 0;
      const transitioned = game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: selected.routeId });
      transcript.push(`  路线 ${selected.routeId} → ${locationNames[selected.targetLocationId] ?? selected.targetLocationId}`);
      if (selected.targetLocationId === IDS.locations.control) {
        expect(routeOptions.filter(route => route.targetLocationId === IDS.locations.control)).toHaveLength(1);
        transcript.push('  any-of 凭证只提供一个控制室出口');
      }
      if (selected.targetLocationId === IDS.locations.arcade && visitsBefore >= 1) transcript.push('  代币电玩馆完成一次回访');
      run = transitioned;
      view = game.operationEntry.getView(runId)!;
      const consumedItemId = transitioned.routeHistory.at(-1)?.consumedHeldItemId;
      for (const itemId of consumedItemId ? [consumedItemId] : []) {
        consumedItems.push(itemId);
        transcript.push(`  ${itemId.slice(itemId.lastIndexOf(':') + 1)} 已消费`);
      }
    }

    run = game.operationEntry.getSnapshot()!;
    view = game.operationEntry.getView(runId)!;
    if (script === classicRoute) {
      expect(arcadeThirdVisitBlocked).toBe(true);
      transcript.push('地下控制室凭证门在本主线未选择');
    }
    const locationProgress = run.locationProgress;
    const result: ReplayResult = {
      transcript: transcript.join('\n'),
      route: run.routeHistory.map(edge => edge.toLocationId),
      battleBeatCounts,
      sceneIdentities: [...sceneIdentities].sort(),
      status: view.status,
      consumedItems,
      arcadeVisits: locationProgress[IDS.locations.arcade]?.visitCount ?? 0,
      mazeVisits: locationProgress[IDS.locations.maze]?.visitCount ?? 0,
      ferrisVisits: locationProgress[IDS.locations.ferris]?.visitCount ?? 0,
      controlVisits: locationProgress[IDS.locations.control]?.visitCount ?? 0,
    };
    expect(result.status).toBe(script.expectedStatus);
    if (script.label.includes('maintenancePass')) expect(consumedItems).toContain(IDS.items.maintenancePass);
    if (script.label.includes('staffRadio')) expect(consumedItems).toContain(IDS.items.staffRadio);
    return result;
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.info = originalInfo;
    console.debug = originalDebug;
  }
}
