import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { gameplayBStrategyParkContent, gameplayBStrategyParkDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park';
import { GAMEPLAY_B_STRATEGY_PARK_MAP } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map';
import { GAMEPLAY_B_STRATEGY_PARK_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-ids';
import { CAROUSEL_SAFETY_IDS as CAROUSEL } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { carouselSafetySliceContent } from '../../src/arona-clicker/content/operation-samples/carousel-safety-slice';
import { CAROUSEL_SCENE_ACTION_IDS as SCENE, carouselSceneActionSliceContent } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { Character } from '../../src/arona-clicker/types/ids';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';

const roster = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const variants: Record<typeof roster[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};

const expectedRoutes = [
  IDS.routes.gateToCorridor, IDS.routes.corridorToKiosk,
  IDS.routes.kioskToArcade, IDS.routes.kioskToAid,
  IDS.routes.arcadeToMaze, IDS.routes.arcadeToKiosk,
  IDS.routes.bumperToAid, IDS.routes.aidToFerris,
  IDS.routes.mazeToArcade, IDS.routes.mazeToBumper, IDS.routes.mazeToAid, IDS.routes.mazeToFerris,
  IDS.routes.ferrisToBackstage, IDS.routes.ferrisToControl,
  IDS.routes.backstageToFireworks, IDS.routes.fireworksToBoss, IDS.routes.bossToExit,
  IDS.routes.controlToFerris, IDS.routes.controlToBossPass, IDS.routes.controlToBossRadio,
].sort();

describe('Gameplay B Strategy Park 13-location map', () => {
  const games: GameInstance[] = [];
  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('registers all 13 locations, map nodes, and the full graph route set', () => {
    const game = createAppRuntime();
    game.init([defaultDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    games.push(game);

    const event = game.registry.operationEvents.get(IDS.event)!;
    const registryLocations = event.locationIds;
    const contentLocations = gameplayBStrategyParkContent.locations;
    const routeEdges = contentLocations.flatMap(location => location.routeEdges);
    const mapLocations = Object.keys(GAMEPLAY_B_STRATEGY_PARK_MAP.locations);
    const areaLocations = GAMEPLAY_B_STRATEGY_PARK_MAP.areas.flatMap(area => area.locationIds);

    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    expect(registryLocations).toHaveLength(13);
    expect(contentLocations.filter(location => location.stage === 'combat').map(location => location.id)).toEqual([
      IDS.locations.bumper,
      IDS.locations.fireworks,
      IDS.locations.boss,
    ]);
    expect(contentLocations.filter(location => location.stage === 'scene')).toHaveLength(10);
    expect(new Set(registryLocations)).toEqual(new Set(Object.values(IDS.locations)));
    expect(contentLocations.map(location => location.id)).toEqual(registryLocations);
    expect(mapLocations).toHaveLength(13);
    expect(new Set(areaLocations)).toEqual(new Set(registryLocations));
    expect(routeEdges.map(route => route.id).sort()).toEqual(expectedRoutes);
    expect(new Set(routeEdges.map(route => route.id)).size).toBe(20);

    expect(contentLocations.find(location => location.id === IDS.locations.westGate)?.maxVisits).toBe(1);
    expect(contentLocations.find(location => location.id === IDS.locations.bumper)?.maxVisits).toBe(1);
    expect(contentLocations.find(location => location.id === IDS.locations.arcade)?.maxVisits).toBe(2);
    expect(contentLocations.find(location => location.id === IDS.locations.maze)?.maxVisits).toBe(2);
    expect(contentLocations.find(location => location.id === IDS.locations.ferris)?.maxVisits).toBe(2);
    expect(contentLocations.find(location => location.id === IDS.locations.control)?.maxVisits).toBe(2);
    expect(event.maxLocationVisits).toBe(18);

    const ferrisControlRoutes = contentLocations.find(location => location.id === IDS.locations.ferris)!
      .routeEdges.filter(route => route.targetLocationId === IDS.locations.control);
    expect(ferrisControlRoutes).toHaveLength(1);
    expect(ferrisControlRoutes[0]?.anyOfHeldItemIds).toEqual([IDS.items.maintenancePass, IDS.items.staffRadio]);
    expect(contentLocations.find(location => location.id === IDS.locations.control)?.routeEdges
      .find(route => route.id === IDS.routes.controlToBossPass)).toMatchObject({
      requiredHeldItemId: IDS.items.maintenancePass,
      consumeRequiredHeldItem: true,
    });
    expect(contentLocations.find(location => location.id === IDS.locations.control)?.routeEdges
      .find(route => route.id === IDS.routes.controlToBossRadio)).toMatchObject({
      requiredHeldItemId: IDS.items.staffRadio,
      consumeRequiredHeldItem: true,
    });
  });

  test('authors explicit Action copy and distinct fixed versus required scene choices', () => {
    expect(gameplayBStrategyParkContent.actions.every(action => action.title.trim().length > 0 && action.description?.trim().length)).toBe(true);
    const sceneActions = gameplayBStrategyParkContent.locations.flatMap(location => location.sceneActions ?? []);
    expect(sceneActions.every(action => action.title?.trim().length)).toBe(true);

    const westGateBriefing = sceneActions.find(action => action.id === IDS.sceneActions.brief)!;
    expect(westGateBriefing).toMatchObject({
      performerPolicy: 'none',
      selectionPolicy: 'required',
      playerCost: 0,
    });
    const controlRecord = sceneActions.find(action => action.id === IDS.sceneActions.controlRecord)!;
    const controlPower = sceneActions.find(action => action.id === IDS.sceneActions.controlPower)!;
    expect(controlRecord).toMatchObject({ performerPolicy: 'none', selectionPolicy: 'fixed', playerCost: 0 });
    expect(controlPower).toMatchObject({ performerPolicy: 'selected-student', selectionPolicy: 'required', playerCost: 2 });
    expect(gameplayBStrategyParkContent.actions.find(action => action.id === IDS.actions.recordConsole)?.effects)
      .toContainEqual({ kind: 'eventFact', factId: IDS.facts.powerPanel, op: 'reveal' });
    expect(gameplayBStrategyParkContent.actions.find(action => action.id === IDS.actions.resetPower)).toMatchObject({
      title: '协助控制室队员',
      description: '为一名队员恢复 1 点 HP。',
      effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }],
    });
    for (const actionId of [IDS.actions.chargerAttack, IDS.actions.fireworksAttack, IDS.actions.bossAttack]) {
      expect(gameplayBStrategyParkContent.actions.find(action => action.id === actionId)?.description)
        .toBe('对一名队员造成 1 点伤害。');
    }
    for (const actionId of [IDS.actions.speakCarefully, IDS.actions.deescalate, IDS.actions.requestPass]) {
      expect(gameplayBStrategyParkContent.actions.find(action => action.id === actionId)?.description)
        .toContain('以维修员为交涉对象');
    }
  });

  test('逐项核对两个 Demo 的全部 36 张 Action 文案、目标合同与实际效果', () => {
    const scene = 'gameplay-b:operation-track:scene-queue-order';
    const risk = IDS.tracks.risk;
    const rows: Array<{
      id: string; title: string; description: string;
      target: Record<string, unknown>; effects: Record<string, unknown>[];
    }> = [
      { id: CAROUSEL.actions.brace, title: '压住制动杆', description: '稳住设备；与芹香的节奏信号可形成合流。', target: { kind: 'actor', relation: 'any', allowedActorIds: [CAROUSEL.actors.ride] }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }] },
      { id: CAROUSEL.actions.emergencyStop, title: '紧急停机', description: '消耗星野 1 点体力，危险度 -4；会放弃制动合流。', target: { kind: 'none' }, effects: [{ kind: 'eventTrackDelta', trackId: CAROUSEL.track, amount: -4 }] },
      { id: CAROUSEL.actions.signal, title: '节奏信号', description: '降低危险度，并可与制动动作形成合流。', target: { kind: 'actor', relation: 'any', allowedActorIds: [CAROUSEL.actors.ride] }, effects: [{ kind: 'eventTrackDelta', trackId: CAROUSEL.track, amount: -1 }] },
      { id: CAROUSEL.actions.crowdGuide, title: '疏导游客', description: '消耗小组 1 点协调资源，危险度 -3；无法参与制动合流。', target: { kind: 'none' }, effects: [{ kind: 'eventTrackDelta', trackId: CAROUSEL.track, amount: -3 }] },
      { id: CAROUSEL.actions.shield, title: '护住设备外框', description: '保护关键目标。', target: { kind: 'actor', relation: 'any', allowedActorIds: [CAROUSEL.actors.ride] }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }] },
      { id: CAROUSEL.actions.sabotage, title: '破坏安全闩', description: '破坏旋转木马安全闩，扣除 1 点设备耐久。', target: { kind: 'actor', relation: 'any', allowedActorIds: [CAROUSEL.actors.ride] }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }] },
      { id: CAROUSEL.actions.alarm, title: '制造混乱', description: '推高现场危险度。', target: { kind: 'none' }, effects: [{ kind: 'eventTrackDelta', trackId: CAROUSEL.track, amount: 2 }] },
      { id: CAROUSEL.actions.surge, title: '机械惯性', description: '旋转仍会推高危险度。', target: { kind: 'none' }, effects: [{ kind: 'eventTrackDelta', trackId: CAROUSEL.track, amount: 1 }] },
      { id: SCENE.actions.investigate, title: '检查控制台', description: '发现员工证并记录设备已检查。', target: { kind: 'none' }, effects: [{ kind: 'eventFact', factId: SCENE.fact, op: 'reveal' }, { kind: 'heldItem', itemId: SCENE.item, op: 'grant' }] },
      { id: SCENE.actions.guideCrowd, title: '引导游客', description: '改善通道秩序。', target: { kind: 'none' }, effects: [{ kind: 'eventTrackDelta', trackId: SCENE.track, amount: -1 }] },
      { id: SCENE.actions.treatTeam, title: '全队急救', description: '为每名选定队员恢复 1 点 HP，并降低现场危险度。', target: { kind: 'actor', relation: 'sameTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }, { kind: 'eventTrackDelta', trackId: SCENE.track, amount: -1 }] },
      { id: IDS.actions.quickShot, title: '快速射击', description: '对选定对手造成 2 点伤害。', target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -2 }] },
      { id: IDS.actions.suppress, title: '压制射击', description: '对对手造成伤害并降低现场风险。', target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }, { kind: 'eventTrackDelta', trackId: risk, amount: -1 }] },
      { id: IDS.actions.cover, title: '掩护同伴', description: '为一名队员恢复 1 点 HP。', target: { kind: 'actor', relation: 'sameTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }] },
      { id: IDS.actions.observe, title: '观察战场', description: '观察局势并降低现场风险。', target: { kind: 'none' }, effects: [{ kind: 'eventTrackDelta', trackId: risk, amount: -1 }] },
      { id: IDS.actions.stepForward, title: '进入前排', description: '从后排移动到前排，为队伍承担压力。', target: { kind: 'none' }, effects: [{ kind: 'actorPosition', recipient: 'actor', positionId: 'front' }] },
      { id: IDS.actions.frontGuard, title: '前排护卫', description: '为一名队员恢复 2 点 HP。', target: { kind: 'actor', relation: 'sameTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 2 }] },
      { id: IDS.actions.speakCarefully, title: '倾听维修员', description: '以维修员为交涉对象，降低交涉风险。', target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'eventTrackDelta', trackId: risk, amount: -1 }] },
      { id: IDS.actions.deescalate, title: '缓和交涉', description: '以维修员为交涉对象，降低风险并记录其配合事实。', target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'eventTrackDelta', trackId: risk, amount: -2 }, { kind: 'eventFact', factId: IDS.facts.staffCooperates, op: 'reveal' }] },
      { id: IDS.actions.requestPass, title: '请求维修通行证', description: '以维修员为交涉对象，取得维修凭证并记录其配合。', target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'eventFact', factId: IDS.facts.staffCooperates, op: 'reveal' }, { kind: 'heldItem', itemId: IDS.items.maintenancePass, op: 'grant' }] },
      { id: IDS.actions.brief, title: '领取巡查任务', description: '记录队伍已完成出发简报。', target: { kind: 'none' }, effects: [{ kind: 'eventFact', factId: IDS.facts.briefed, op: 'reveal' }] },
      { id: IDS.actions.followTracks, title: '追踪轮迹', description: '沿现场痕迹确认可行路线。', target: { kind: 'none' }, effects: [{ kind: 'eventFact', factId: IDS.facts.trail, op: 'reveal' }] },
      { id: IDS.actions.callStaff, title: '联系服务亭', description: '取得员工广播凭证。', target: { kind: 'none' }, effects: [{ kind: 'eventFact', factId: IDS.facts.trail, op: 'reveal' }, { kind: 'heldItem', itemId: IDS.items.staffRadio, op: 'grant' }] },
      { id: IDS.actions.firstAid, title: '急救队员', description: '为一名队员恢复 2 点 HP。', target: { kind: 'actor', relation: 'sameTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 2 }] },
      { id: IDS.actions.searchMaze, title: '搜索镜面迷宫', description: '搜索侧廊并寻找维修凭证。', target: { kind: 'none' }, effects: [{ kind: 'eventFact', factId: IDS.facts.mazeRoute, op: 'reveal' }, { kind: 'heldItem', itemId: IDS.items.maintenancePass, op: 'grant' }] },
      { id: IDS.actions.inspectPanel, title: '检查摩天轮面板', description: '记录检修面板线索。', target: { kind: 'none' }, effects: [{ kind: 'eventFact', factId: IDS.facts.powerPanel, op: 'reveal' }] },
      { id: IDS.actions.rest, title: '后台休整', description: '为一名队员恢复 2 点 HP。', target: { kind: 'actor', relation: 'sameTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 2 }] },
      { id: IDS.actions.handoff, title: '东门交接', description: '确认园区安全并结束巡查。', target: { kind: 'none' }, effects: [{ kind: 'eventFact', factId: IDS.facts.safe, op: 'reveal' }] },
      { id: IDS.actions.searchDrawer, title: '搜索维修抽屉', description: '在电玩馆维修抽屉中寻找通行证。', target: { kind: 'none' }, effects: [{ kind: 'heldItem', itemId: IDS.items.maintenancePass, op: 'grant' }] },
      { id: IDS.actions.inspectConsole, title: '检查控制台', description: '读取维修记录。', target: { kind: 'none' }, effects: [{ kind: 'eventFact', factId: IDS.facts.powerPanel, op: 'reveal' }] },
      { id: IDS.actions.searchStaffEntry, title: '寻找员工入口', description: '搜索检修廊员工入口并取得凭证。', target: { kind: 'none' }, effects: [{ kind: 'heldItem', itemId: IDS.items.maintenancePass, op: 'grant' }] },
      { id: IDS.actions.resetPower, title: '协助控制室队员', description: '为一名队员恢复 1 点 HP。', target: { kind: 'actor', relation: 'sameTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }] },
      { id: IDS.actions.recordConsole, title: '登记控制台记录', description: '记录控制室内的设备信息。', target: { kind: 'none' }, effects: [{ kind: 'eventFact', factId: IDS.facts.powerPanel, op: 'reveal' }] },
      { id: IDS.actions.chargerAttack, title: '碰碰车冲撞', description: '对一名队员造成 1 点伤害。', target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }] },
      { id: IDS.actions.fireworksAttack, title: '烟花骚乱攻击', description: '对一名队员造成 1 点伤害。', target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }] },
      { id: IDS.actions.bossAttack, title: '领头者攻击', description: '对一名队员造成 1 点伤害。', target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }] },
    ];
    expect(rows).toHaveLength(36);
    const definitions = [...carouselSceneActionSliceContent.actionDefinitions, ...gameplayBStrategyParkContent.actions];
    expect(definitions).toHaveLength(rows.length);
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(definitions.map(action => action.id).sort()).toEqual(rows.map(row => row.id).sort());
    for (const expected of rows) {
      const action = definitions.find(candidate => candidate.id === expected.id)!;
      expect(action, expected.id).toMatchObject({
        title: expected.title,
        description: expected.description,
        target: expected.target,
        effects: expected.effects,
      });
    }
    for (const action of gameplayBStrategyParkContent.actions) {
      expect(GAMEPLAY_B_STRATEGY_PARK_MAP.actions[action.id], action.id).toMatchObject({
        name: action.title,
        description: action.description,
      });
    }
  });

  test('the west gate briefing commits its direct Effect without an implicit student performer', () => {
    const game = createAppRuntime();
    game.init([defaultDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    games.push(game);
    for (const character of roster) game.mutations.acquireCharacter(variants[character], 'story');
    const runId = game.operationEntry.start(IDS.event, roster).runId;
    const run = game.operationEntry.getSnapshot()!;
    const view = game.operationEntry.getView(runId)!;
    expect(view.currentLocationId).toBe(IDS.locations.westGate);
    expect(view.currentSceneActions.find(action => action.id === IDS.sceneActions.brief)).toMatchObject({
      performerPolicy: 'none',
      selectionPolicy: 'required',
      title: '领取巡查任务',
      description: '记录队伍已完成出发简报。',
    });
    expect(view.knownFactIds).not.toContain(IDS.facts.briefed);

    const resolution = game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [{ sceneActionId: IDS.sceneActions.brief, targetActorIds: [] }],
    });

    expect(resolution.sceneBatch?.selections).toEqual(expect.arrayContaining([
      expect.objectContaining({ sceneActionId: IDS.sceneActions.brief, targetActorIds: [] }),
    ]));
    expect(resolution.sceneBatch?.selections[0]).not.toHaveProperty('actorId');
    expect(resolution.membershipChanges.filter(change => change.target.kind === 'knownFact' && change.target.id === IDS.facts.briefed))
      .toEqual([{ target: { kind: 'knownFact', id: IDS.facts.briefed }, before: false, after: true }]);
    const committedView = game.operationEntry.getView(runId)!;
    expect(committedView.knownFactIds).toContain(IDS.facts.briefed);
    expect(committedView.locationProgress[IDS.locations.westGate]?.completed).toBe(true);
  });

  test('the real Operation facade grants both credentials and exposes one any-of control-room gate', () => {
    const game = createAppRuntime();
    game.init([defaultDatapack, gameplayBStrategyParkDatapack], { enterDefaultInit: true });
    games.push(game);
    for (const character of roster) game.mutations.acquireCharacter(variants[character], 'story');
    const runId = game.operationEntry.start(IDS.event, roster).runId;

    const act = (sceneActionId: string, individualFallbackSceneActionId?: string) => {
      const run = game.operationEntry.getSnapshot()!;
      const view = game.operationEntry.getView(runId)!;
      const action = view.currentSceneActions.find(option => option.id === sceneActionId);
      if (action?.performerPolicy === 'selected-student') expect(action.eligibleActorIds).toContain(IDS.actors.hoshino);
      const performerIds: readonly (string | undefined)[] = action?.performerPolicy === 'none'
        ? [undefined]
        : action?.scope === 'individual' ? action.eligibleActorIds : [IDS.actors.hoshino];
      game.operationEntry.commitSceneActionBatch({
        runId,
        planVersion: run.planVersion,
        selections: performerIds.map((actorId, index) => ({
          sceneActionId: index === 0 || !individualFallbackSceneActionId ? sceneActionId : individualFallbackSceneActionId,
          ...(actorId ? { actorId } : {}),
          targetActorIds: [],
        })),
      });
    };
    const route = (routeId: string) => {
      const run = game.operationEntry.getSnapshot()!;
      const view = game.operationEntry.getView(runId)!;
      expect(view.currentRoutes.find(option => option.routeId === routeId)?.available).toBe(true);
      game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId });
    };

    act(IDS.sceneActions.brief);
    act(IDS.sceneActions.tracks);
    act(IDS.sceneActions.tracks);
    act(IDS.sceneActions.radio);
    route(IDS.routes.kioskToArcade);
    act(IDS.sceneActions.negotiateCalm, IDS.sceneActions.negotiateListen);
    route(IDS.routes.arcadeToMaze);
    act(IDS.sceneActions.negotiatePass, IDS.sceneActions.maze);
    route(IDS.routes.mazeToFerris);
    act(IDS.sceneActions.panel, IDS.sceneActions.negotiatePass);

    const view = game.operationEntry.getView(runId)!;
    expect(view.currentLocationId).toBe(IDS.locations.ferris);
    expect(view.heldItemIds).toEqual(expect.arrayContaining([IDS.items.maintenancePass, IDS.items.staffRadio]));
    const controlGates = view.currentRoutes.filter(option => option.targetLocationId === IDS.locations.control);
    expect(controlGates).toHaveLength(1);
    expect(controlGates[0]).toMatchObject({
      available: true,
      requiredHeldItemId: null,
      anyOfHeldItemIds: [IDS.items.maintenancePass, IDS.items.staffRadio],
      consumesHeldItem: false,
    });
    expect(view.currentRoutes.filter(option => option.targetLocationId === IDS.locations.backstage)).toHaveLength(1);
  });
});
