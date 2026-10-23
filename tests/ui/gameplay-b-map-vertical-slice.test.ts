// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID, defaultDatapack, loadDefaultDatapack } from '../../src/app/runtime-bootstrap';
import type { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { UIController } from '../../src/ui/controller/controller';
import { finishWelcome } from '../engine/story-test-fixtures';

function actionE2EDatapack(): typeof gameplayBMapDatapack {
  const source = gameplayBMapDatapack.maps?.[0];
  if (!source) throw new Error('The Gameplay B Datapack has no Map for the Encounter action E2E.');
  const commandAction = {
    id: 'e2e-player-command',
    name: '核对线索',
    description: '通过手牌外指令补充一条调查线索。',
    eligibleCharacterIds: [...source.partyCharacterIds],
    target: { kind: 'none' as const },
    effectProgram: { resolve: [{ op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'clues', delta: 1 }] },
  };
  const actions = [...(source.actions ?? []), commandAction].map(action => ({
    ...action,
    costs: [{ scope: 'actor' as const, resourceId: 'stamina', amount: 1 }],
  }));
  const candidates = actions.map(action => ({ actionId: action.id, tendencyWeight: 1 }));
  const map: GameplayMapDef = {
    ...source,
    resumeVersion: source.resumeVersion + 1,
    actions,
    // Two committed rounds exhaust the small test budget; the next round uses the real Wait state.
    initialActorResources: source.partyCharacterIds.flatMap(characterId => [
      { characterId, resourceId: 'stamina', value: 2 },
      { characterId, resourceId: 'focus', value: 0 },
    ]),
    initialTeamResources: [{ resourceId: 'supplies', value: 100 }, { resourceId: 'clues', value: 0 }],
    nodes: source.nodes.map(node => {
      if (!node.encounter) return node;
      const { completion: _completion, ...encounter } = node.encounter;
      void _completion;
      return {
        ...node,
        encounter: {
          ...encounter,
          rounds: 3,
          participants: (node.encounter.participants ?? []).map(participant => ({ ...participant, actions: candidates })),
        },
      };
    }),
  };
  return {
    ...gameplayBMapDatapack,
    maps: gameplayBMapDatapack.maps?.map(candidate => candidate.id === source.id ? map : candidate),
  };
}

function findAreaPath(game: GameInstance, targetAreaId: string): string[] | null {
  const start = game.getView().currentAreaId;
  if (!start) return null;
  if (start === targetAreaId) return [start];
  const queue: string[][] = [[start]];
  const visited = new Set([start]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1]!;
    for (const next of game.availableAreaIds(current)) {
      if (visited.has(next) || game.world.areas.get(next)?.initId !== game.getView().activeInit) continue;
      const candidate = [...path, next];
      if (next === targetAreaId) return candidate;
      visited.add(next);
      queue.push(candidate);
    }
  }
  return null;
}

function acquireMapParty(game: GameInstance, characterIds: readonly string[]): void {
  for (const characterId of characterIds) {
    const variant = game.rosterSystem.getAllVariants()
      .filter(candidate => candidate.proto === characterId)
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!variant) throw new Error(`No registered Variant for Map party Character "${characterId}"`);
    if (!game.state.roster?.[variant.id]) game.mutations.acquireCharacter(variant.id, 'story');
  }
}

function finishGlobalStory(game: GameInstance): void {
  finishWelcome(game);
}

function moveToMapNode(root: HTMLElement, nodeId: string): void {
  const card = root.querySelector<HTMLElement>(`[data-map-location-node-id="${nodeId}"]`);
  const submit = root.querySelector<HTMLButtonElement>('[data-map-location-submit]');
  if (!card || !submit) throw new Error(`Map Workspace did not render an available location ${nodeId}`);
  card.click();
  if (submit.disabled) throw new Error(`Map Workspace did not allow location ${nodeId}`);
  submit.click();
}

describe('Gameplay B Map normal entry vertical slice', () => {
  const games: GameInstance[] = [];
  const controllers: UIController[] = [];

  // Keep this navigation / command chain deterministic; RNG behavior has dedicated Owner tests.
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0));

  afterEach(() => {
    for (const controller of controllers.splice(0)) controller.destroy();
    for (const game of games.splice(0)) if (game.running) game.stop();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test('plays the bundled minimal battle from its Spot through retaliation, victory and the exit', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>('#app')!;
    const game = createAppRuntime();
    games.push(game);
    await loadDefaultDatapack(game);
    const controller = new UIController(game, root);
    controllers.push(controller);
    controller.mount();
    root.querySelector<SVGElement>(`[data-init-select="${DEFAULT_INIT_ID}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    let startInit = root.querySelector<HTMLButtonElement>(`[data-init="${DEFAULT_INIT_ID}"]`);
    if (!startInit) {
      root.querySelector<HTMLButtonElement>(`[data-init-purchase="${DEFAULT_INIT_ID}"]`)!.click();
      startInit = root.querySelector<HTMLButtonElement>(`[data-init="${DEFAULT_INIT_ID}"]`);
    }
    startInit!.click();
    root.querySelector<HTMLButtonElement>('[data-init-confirm]')!.click();
    await Promise.resolve();
    finishGlobalStory(game);
    controller.render();

    const mapId = 'gameplay-b:map:minimal-battle';
    const map = game.registry.maps.get(mapId)!;
    expect(map).toBeDefined();
    const terminal = [...game.world.spots.values()].find(spot =>
      spot.functionalities?.some(fn => fn.kind === 'mapEntry' && fn.mapId === mapId),
    )!;
    expect(terminal).toBeDefined();
    const path = findAreaPath(game, terminal.areaId);
    expect(path).not.toBeNull();
    for (const areaId of (path ?? []).slice(1)) {
      root.querySelector<HTMLButtonElement>(`[data-ui-area-nav="reachable:${areaId}"]`)!.click();
    }
    if ((game.state.spotLevels[terminal.id] ?? 0) === 0) {
      root.querySelector<HTMLButtonElement>(`[data-ui-spot-card="${terminal.id}"] [data-upgrade="${terminal.id}"]`)!.click();
    }
    acquireMapParty(game, map.partyCharacterIds);
    root.querySelector<HTMLButtonElement>(`[data-map-entry-open="${mapId}"]`)!.click();
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(root.querySelector('[data-map-entry-workspace]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>(`[data-map-entry-start="${mapId}"]`)!.click();
    const runId = game.mapRun.getSnapshot()!.runId;
    moveToMapNode(root, 'battle');
    expect(root.textContent).toContain('两人对两敌');
    expect(root.querySelector('[data-map-complete-encounter]')).toBeNull();

    const commitRound = () => {
      for (const characterId of map.partyCharacterIds) {
        root.querySelector<HTMLButtonElement>(`[data-map-target-enemy][data-character-id="${characterId}"]`)!.click();
      }
      const commit = root.querySelector<HTMLButtonElement>('[data-map-commit]')!;
      expect(commit.disabled).toBe(false);
      commit.click();
    };
    commitRound();
    const afterFirst = game.mapRun.getSnapshot()!;
    expect(afterFirst.activeEncounter?.enemies).toEqual([
      { enemyId: '训练靶', currentHp: 2 },
      { enemyId: '机动靶', currentHp: 6 },
    ]);
    expect(afterFirst.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 6 },
      { characterId: 'serika', currentHp: 10 },
    ]);
    expect(afterFirst.activeEncounter?.lastCommit?.enemyActions).toHaveLength(2);
    expect(afterFirst.activeEncounter?.lastCommit?.enemyActions?.map(row => row.actionId)).toEqual([
      'robot-counterattack', 'robot-counterattack',
    ]);
    commitRound();
    const afterSecond = game.mapRun.getSnapshot()!;
    expect(afterSecond.activeEncounter?.enemies).toEqual([
      { enemyId: '训练靶', currentHp: 0 },
      { enemyId: '机动靶', currentHp: 6 },
    ]);
    expect(afterSecond.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 4 },
      { characterId: 'serika', currentHp: 10 },
    ]);
    expect(afterSecond.activeEncounter?.lastCommit?.enemyActions).toMatchObject([
      { enemyId: '训练靶', skipReason: 'defeated' },
      { enemyId: '机动靶', actionId: 'robot-counterattack' },
    ]);
    commitRound();
    const afterThird = game.mapRun.getSnapshot()!;
    expect(afterThird.activeEncounter?.enemies).toEqual([
      { enemyId: '训练靶', currentHp: 0 },
      { enemyId: '机动靶', currentHp: 2 },
    ]);
    expect(afterThird.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 2 },
      { characterId: 'serika', currentHp: 10 },
    ]);
    expect(afterThird.activeEncounter?.lastCommit?.enemyActions).toMatchObject([
      { enemyId: '训练靶', actionId: null },
      { enemyId: '机动靶', actionId: 'robot-counterattack', targetCharacterId: 'shiroko' },
    ]);
    commitRound();
    const won = game.mapRun.getSnapshot()!;
    expect(won.activeEncounter).toBeNull();
    expect(won.completedEncounterNodeIds).toContain('battle');
    expect(won.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 2 },
      { characterId: 'serika', currentHp: 10 },
    ]);
    moveToMapNode(root, 'exit');
    expect(game.mapRun.getWorkspaceView(runId)).toMatchObject({ kind: 'success', result: { mapId, runId } });
  });

  test('loads the default pack, acquires a normal Spot, and runs its Map through the UI', async () => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>('#app')!;
    const game = createAppRuntime();
    games.push(game);
    loadDefaultDatapack(game);
    const controller = new UIController(game, root);
    controllers.push(controller);
    controller.mount();

    const mapEntry = [...game.world.spots.values()].flatMap(spot =>
      (spot.functionalities ?? [])
        .filter(fn => fn.kind === 'mapEntry' && typeof fn.mapId === 'string' && game.registry.maps.has(fn.mapId))
        .map(fn => ({ spot, functionality: fn })),
    )[0];
    expect(mapEntry).toBeDefined();
    const { spot, functionality } = mapEntry!;
    const mapId = functionality.mapId!;
    const map = game.registry.maps.get(mapId)!;
    expect(map).toBeDefined();

    root.querySelector<SVGElement>(`[data-init-select="${DEFAULT_INIT_ID}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    let startInit = root.querySelector<HTMLButtonElement>(`[data-init="${DEFAULT_INIT_ID}"]`);
    if (!startInit) {
      root.querySelector<HTMLButtonElement>(`[data-init-purchase="${DEFAULT_INIT_ID}"]`)!.click();
      startInit = root.querySelector<HTMLButtonElement>(`[data-init="${DEFAULT_INIT_ID}"]`);
    }
    expect(startInit).not.toBeNull();
    startInit!.click();
    root.querySelector<HTMLButtonElement>('[data-init-confirm]')!.click();
    await Promise.resolve();
    finishGlobalStory(game);
    controller.render();
    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    expect(controller.started).toBe(true);

    const path = findAreaPath(game, spot.areaId);
    expect(path).not.toBeNull();
    for (const areaId of (path ?? []).slice(1)) {
      const areaButton = root.querySelector<HTMLButtonElement>(`[data-ui-area-nav="reachable:${areaId}"]`);
      expect(areaButton).not.toBeNull();
      expect(areaButton?.getAttribute('aria-disabled')).not.toBe('true');
      areaButton!.click();
      await Promise.resolve();
    }
    expect(game.getView().currentAreaId).toBe(spot.areaId);

    if ((game.state.spotLevels[spot.id] ?? 0) === 0) {
      const acquire = root.querySelector<HTMLButtonElement>(`[data-ui-spot-card="${spot.id}"] [data-upgrade="${spot.id}"]`);
      expect(acquire).not.toBeNull();
      expect(acquire?.disabled).toBe(false);
      acquire!.click();
      expect(game.state.spotLevels[spot.id]).toBeGreaterThan(0);
    }

    acquireMapParty(game, map.partyCharacterIds);
    const entryButton = root.querySelector<HTMLButtonElement>(
      `[data-map-entry-spot="${spot.id}"][data-map-entry-functionality="${functionality.id}"][data-map-entry-open="${mapId}"]`,
    );
    expect(entryButton).not.toBeNull();
    const fullBeforeStart = controller.getRefreshStats().fullRenders;
    entryButton!.click();
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'map-entry', mapId });
    expect(controller.getRefreshStats().fullRenders).toBe(fullBeforeStart + 1);
    const startButton = root.querySelector<HTMLButtonElement>(`[data-map-entry-start="${mapId}"]`);
    expect(startButton).not.toBeNull();
    startButton!.click();
    const started = game.mapRun.getSnapshot();
    expect(started).toMatchObject({ mapId, status: 'inProgress', currentNodeId: map.startNodeId });
    expect(controller.panelState.workspace).toBeUndefined();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'map', runId: started!.runId });
    expect(controller.getRefreshStats().fullRenders).toBe(fullBeforeStart + 2);
    expect(root.querySelector('[data-map-workspace-region]')).not.toBeNull();

    const runId = started!.runId;
    const encounterEdge = map.edges.find(edge => edge.fromNodeId === map.startNodeId
      && map.nodes.some(node => node.id === edge.toNodeId && node.encounter));
    expect(encounterEdge).toBeDefined();
    const encounterNode = map.nodes.find(node => node.id === encounterEdge!.toNodeId)!;
    const exitEdge = map.edges.find(edge => edge.fromNodeId === encounterNode.id && map.exitNodeIds.includes(edge.toNodeId));
    expect(exitEdge).toBeDefined();
    const nonAdjacent = map.nodes.find(node => node.id !== map.startNodeId
      && !map.edges.some(edge => edge.fromNodeId === map.startNodeId && edge.toNodeId === node.id));
    expect(nonAdjacent).toBeDefined();

    const beforeInvalidStartMove = game.mapRun.getSnapshot();
    expect(() => controller.commands.moveMap(runId, nonAdjacent!.id)).toThrow();
    expect(game.mapRun.getSnapshot()).toEqual(beforeInvalidStartMove);
    expect(() => controller.commands.completeMapEncounter(runId)).toThrow();
    expect(game.mapRun.getSnapshot()).toEqual(beforeInvalidStartMove);

    const fullBeforeBack = controller.getRefreshStats().fullRenders;
    root.querySelector<HTMLButtonElement>('[data-map-back-to-entry]')!.click();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'map-entry', mapId });
    expect(game.mapRun.getSnapshot()).toEqual(beforeInvalidStartMove);
    expect(root.querySelector('[data-map-entry-mode="resume"]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-map-entry-leave]')!.click();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(controller.getRefreshStats().fullRenders).toBe(fullBeforeBack + 2);
    controller.navigateToService('saves');
    controller.render();
    const saveButton = root.querySelector<HTMLButtonElement>('#save-game');
    expect(saveButton).not.toBeNull();
    saveButton!.click();
    expect(localStorage.length).toBeGreaterThan(0);
    const loadButton = root.querySelector<HTMLButtonElement>('#load-game');
    expect(loadButton).not.toBeNull();
    expect(loadButton!.disabled).toBe(false);
    loadButton!.click();
    expect(controller.panelState.service).toBe('game');
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(game.mapRun.getSnapshot()).toEqual(beforeInvalidStartMove);
    root.querySelector<HTMLButtonElement>(`[data-map-entry-spot="${spot.id}"][data-map-entry-open="${mapId}"]`)!.click();
    const continueButton = root.querySelector<HTMLButtonElement>(
      `[data-map-entry-continue-run="${runId}"]`,
    );
    expect(continueButton).not.toBeNull();
    continueButton!.click();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'map', runId });
    expect(game.mapRun.getSnapshot()).toEqual(beforeInvalidStartMove);

    let fullRenders = controller.getRefreshStats().fullRenders;
    let regionRefreshes = controller.getRefreshStats().regionRefreshes;
    moveToMapNode(root, encounterNode.id);
    expect(game.mapRun.getSnapshot()).toMatchObject({ currentNodeId: encounterNode.id, activeEncounterNodeId: encounterNode.id });
    expect(controller.getRefreshStats().fullRenders).toBe(fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(regionRefreshes);
    regionRefreshes = controller.getRefreshStats().regionRefreshes;
    expect(game.mapRun.getCurrentEncounter()).toMatchObject({ mapId, nodeId: encounterNode.id });

    const beforeBlockedMove = game.mapRun.getSnapshot();
    expect(() => controller.commands.moveMap(runId, exitEdge!.toNodeId)).toThrow();
    expect(game.mapRun.getSnapshot()).toEqual(beforeBlockedMove);
    if (!root.querySelector('[data-map-complete-encounter]')) {
      root.querySelector<HTMLButtonElement>('[data-map-action-swap][data-character-id="shiroko"][data-action-id="assist-teammate"]')!.click();
    }
    const completion = root.querySelector<HTMLButtonElement>('[data-map-complete-encounter][data-map-run-id]');
    expect(completion?.textContent).toContain(encounterNode.encounter?.completion?.label);
    completion!.click();
    expect(game.mapRun.getSnapshot()).toMatchObject({
      currentNodeId: encounterNode.id,
      activeEncounterNodeId: null,
      completedEncounterNodeIds: [encounterNode.id],
      status: 'inProgress',
    });
    expect(controller.getRefreshStats().fullRenders).toBe(fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(regionRefreshes);
    regionRefreshes = controller.getRefreshStats().regionRefreshes;
    root.querySelector<HTMLButtonElement>('[data-map-show-map]')!.click();
    expect(root.querySelector('[data-map-overview]')?.textContent).toContain(encounterNode.title);
    expect(root.querySelector('[data-map-overview]')?.textContent).toContain('当前位置');

    moveToMapNode(root, exitEdge!.toNodeId);
    const terminalView = game.mapRun.getWorkspaceView(runId);
    const exitNode = map.nodes.find(node => node.id === exitEdge!.toNodeId)!;
    expect(terminalView).toMatchObject({
      kind: 'success',
      result: {
        runId,
        mapId,
        outcome: 'success',
        exitNodeId: exitNode.id,
        mapName: map.name,
        exitNodeTitle: exitNode.title,
      },
    });
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(controller.getRefreshStats().fullRenders).toBe(fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(regionRefreshes);
    regionRefreshes = controller.getRefreshStats().regionRefreshes;
    expect(root.querySelector('[data-map-run-result="success"]')).not.toBeNull();
    expect(root.querySelector('[data-map-node-id]')).toBeNull();
    expect(root.querySelector('[data-map-move-to]')).toBeNull();
    expect(root.textContent).toContain(map.name);
    expect(root.textContent).toContain(exitNode.title);

    root.querySelector<HTMLButtonElement>('[data-map-back]')!.click();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(root.querySelector(`[data-map-entry-spot="${spot.id}"][data-map-entry-open="${mapId}"]`)).not.toBeNull();
    expect(root.querySelector(`[data-map-entry-continue-run="${runId}"]`)).toBeNull();
  });

  test('runs a real two-character Encounter action turn through Datapack, Spot and MapRun with local refresh', () => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>('#app')!;
    const game = createAppRuntime();
    games.push(game);
    game.init([defaultDatapack, actionE2EDatapack()], { enterDefaultInit: true });
    const controller = new UIController(game, root);
    controllers.push(controller);
    controller.started = true;
    controller.render();
    finishGlobalStory(game);
    controller.render();

    const mapEntry = [...game.world.spots.values()].flatMap(spot =>
      (spot.functionalities ?? [])
        .filter(fn => fn.kind === 'mapEntry' && typeof fn.mapId === 'string' && game.registry.maps.has(fn.mapId))
        .map(fn => ({ spot, functionality: fn })),
    )[0];
    expect(mapEntry).toBeDefined();
    const { spot, functionality } = mapEntry!;
    const mapId = functionality.mapId!;
    const map = game.registry.maps.get(mapId)!;
    const path = findAreaPath(game, spot.areaId);
    expect(path).not.toBeNull();
    for (const areaId of (path ?? []).slice(1)) {
      const areaButton = root.querySelector<HTMLButtonElement>(`[data-ui-area-nav="reachable:${areaId}"]`);
      expect(areaButton).not.toBeNull();
      areaButton!.click();
    }
    expect(game.getView().currentAreaId).toBe(spot.areaId);
    if ((game.state.spotLevels[spot.id] ?? 0) === 0) {
      root.querySelector<HTMLButtonElement>(`[data-ui-spot-card="${spot.id}"] [data-upgrade="${spot.id}"]`)!.click();
    }
    acquireMapParty(game, map.partyCharacterIds);
    const entryButton = root.querySelector<HTMLButtonElement>(
      `[data-map-entry-spot="${spot.id}"][data-map-entry-functionality="${functionality.id}"][data-map-entry-open="${mapId}"]`,
    );
    expect(entryButton).not.toBeNull();
    entryButton!.click();
    expect(game.mapRun.getSnapshot()).toBeNull();
    root.querySelector<HTMLButtonElement>(`[data-map-entry-start="${mapId}"]`)!.click();
    const run = game.mapRun.getSnapshot()!;
    const runId = run.runId;
    expect(run).toMatchObject({ mapId, status: 'inProgress', currentNodeId: map.startNodeId });

    const encounterNode = map.nodes.find(node => node.encounter)!;
    moveToMapNode(root, encounterNode.id);
    expect(game.mapRun.getCurrentEncounter()).toMatchObject({ mapId, nodeId: encounterNode.id });
    expect(root.querySelector('[data-map-encounter-region]')).not.toBeNull();

    const shell = root.querySelector<HTMLElement>('.console-shell')!;
    const fullRenders = controller.getRefreshStats().fullRenders;
    const workspaceRenders = controller.getRefreshStats().workspaceRenders;
    let stable = captureMapIdentity(root, runId);
    const assertStableEncounter = () => {
      expectMapIdentity(root, runId, stable);
      expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'map', runId });
      expect(controller.getRefreshStats().fullRenders).toBe(fullRenders);
      expect(controller.getRefreshStats().workspaceRenders).toBe(workspaceRenders);
      expect(root.querySelector('.console-shell')).toBe(shell);
    };

    const initialView = game.mapRun.getWorkspaceView(runId);
    expect(initialView?.kind).toBe('active');
    if (!initialView || initialView.kind !== 'active' || !initialView.actionPreview) {
      throw new Error('The Spot-launched Encounter did not project its action preview.');
    }
    expect(initialView.actionPreview.preparedActions).toHaveLength(2);
    expect(initialView.actionPreview.preparedActions.every(member => member.hand.length === 3)).toBe(true);

    const shiroko = initialView.actionPreview.preparedActions.find(member => member.characterId === 'shiroko')!;
    const swapAction = shiroko.hand.find(action => action.actionId !== shiroko.naturalAction?.actionId && action.targetKind !== 'partyCharacter')
      ?? shiroko.hand.find(action => action.actionId !== shiroko.naturalAction?.actionId);
    expect(swapAction).toBeDefined();
    const staleSwap = root.querySelector<HTMLButtonElement>(
      `[data-map-action-swap][data-character-id="shiroko"][data-action-id="${swapAction!.actionId}"]`,
    )!;
    staleSwap.focus();
    staleSwap.dataset.mapDraftVersion = String(Number(staleSwap.dataset.mapDraftVersion) + 1);
    const beforeStaleSwap = game.mapRun.getSnapshot();
    staleSwap.click();
    expect(game.mapRun.getSnapshot()).toEqual(beforeStaleSwap);
    expect(game.mapRun.getSnapshot()?.activeEncounter?.hands).toEqual(beforeStaleSwap?.activeEncounter?.hands);
    expect(document.querySelector('#toast-stack')?.textContent).toContain('行动状态已更新');
    assertStableEncounter();

    const validSwap = root.querySelector<HTMLButtonElement>(
      `[data-map-action-swap][data-character-id="shiroko"][data-action-id="${swapAction!.actionId}"]`,
    )!;
    validSwap.focus();
    validSwap.click();
    expect(game.mapRun.getSnapshot()?.activeEncounter?.overrides).toMatchObject([{
      kind: 'swap', characterId: 'shiroko', actionId: swapAction!.actionId,
    }]);
    expect(game.mapRun.getSnapshot()?.playerCost).toBe(1);
    expect((document.activeElement as HTMLElement | null)?.dataset.mapFocusKey)
      .toBe(`unit-card:shiroko:swap:${swapAction!.actionId}`);
    assertStableEncounter();

    const clearOverride = root.querySelector<HTMLButtonElement>(`[data-map-action-swap][data-character-id="shiroko"][data-action-id="${shiroko.naturalAction!.actionId}"]`)!;
    clearOverride.focus();
    clearOverride.click();
    expect(game.mapRun.getSnapshot()?.activeEncounter?.overrides).toEqual([]);
    expect((document.activeElement as HTMLElement | null)?.dataset.mapFocusKey)
      .toBe(`unit-card:shiroko:swap:${shiroko.naturalAction!.actionId}`);
    assertStableEncounter();

    root.querySelector<HTMLButtonElement>(
      `[data-map-action-swap][data-character-id="shiroko"][data-action-id="${swapAction!.actionId}"]`,
    )!.click();
    expect(game.mapRun.getSnapshot()?.activeEncounter?.overrides).toMatchObject([{
      kind: 'swap', characterId: 'shiroko', actionId: swapAction!.actionId,
    }]);
    assertStableEncounter();

    const selectRequiredTargets = () => {
      for (const characterId of map.partyCharacterIds) {
        const view = game.mapRun.getWorkspaceView(runId);
        if (!view || view.kind !== 'active' || !view.actionPreview) throw new Error('Missing active Encounter preview.');
        const prepared = view.actionPreview.preparedActions.find(member => member.characterId === characterId);
        if (!prepared?.targetSelectionRequired) continue;
        const targetCharacterId = prepared.legalTargetCharacterIds[0];
        if (!targetCharacterId) throw new Error(`No legal target was projected for ${characterId}.`);
        root.querySelector<HTMLButtonElement>(
          `[data-map-target][data-character-id="${characterId}"][data-target-character-id="${targetCharacterId}"]`,
        )!.click();
        assertStableEncounter();
      }
    };
    selectRequiredTargets();
    expect(root.querySelector<HTMLButtonElement>('[data-map-commit]')?.disabled).toBe(false);

    const staleCommit = root.querySelector<HTMLButtonElement>('[data-map-commit]')!;
    staleCommit.focus();
    staleCommit.dataset.mapExpectedCommitVersion = String(Number(staleCommit.dataset.mapExpectedCommitVersion) + 1);
    const beforeStaleCommit = game.mapRun.getSnapshot();
    staleCommit.click();
    expect(game.mapRun.getSnapshot()).toEqual(beforeStaleCommit);
    expect(game.mapRun.getSnapshot()?.activeEncounter?.hands).toEqual(beforeStaleCommit?.activeEncounter?.hands);
    expect(document.querySelector('#toast-stack')?.textContent).toContain('行动状态已更新');
    assertStableEncounter();

    const firstRound = game.mapRun.getSnapshot()!;
    const regionBeforeCommit = controller.getRefreshStats().regionRefreshes;
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    const secondRound = game.mapRun.getSnapshot()!;
    expect(secondRound.activeEncounter?.round).toBe(2);
    expect(secondRound.activeEncounter?.randomState.cursor).toBeGreaterThan(firstRound.activeEncounter!.randomState.cursor);
    expect(secondRound.activeEncounter?.hands).toHaveLength(2);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(regionBeforeCommit);
    expect(root.querySelector('[data-map-region-key="action-dock"]')?.getAttribute('aria-label')).toBe('第 2 轮行动操作');
    const secondRoundView = game.mapRun.getWorkspaceView(runId);
    if (!secondRoundView || secondRoundView.kind !== 'active' || !secondRoundView.actionPreview) {
      throw new Error('The successful Commit did not expose the next Encounter Hand.');
    }
    for (const member of secondRoundView.actionPreview.preparedActions) {
      expect(root.querySelectorAll(`[data-map-party-member="${member.characterId}"] [data-map-action-swap]`))
        .toHaveLength(member.hand.length - (member.hand.some(card => card.actionId === member.preparedAction?.actionId) ? 1 : 0));
    }
    assertStableEncounter();

    const missingPartyMember = root.querySelector<HTMLElement>('[data-workspace-column="left"] [data-map-party-member="shiroko"]')!;
    const displacedAction = missingPartyMember.querySelector<HTMLButtonElement>('[data-map-action-swap]:not(:disabled)')!;
    displacedAction.dataset.mapDraftVersion = String(Number(displacedAction.dataset.mapDraftVersion) + 1);
    displacedAction.focus();
    missingPartyMember.parentElement!.insertBefore(displacedAction, missingPartyMember);
    missingPartyMember.remove();
    const mapRegionBeforeRecovery = root.querySelector('[data-map-workspace-region]');
    const mapFrameBeforeRecovery = root.querySelector('[data-workspace-frame="map"]');
    const mapColumnsBeforeRecovery = ['left', 'center', 'right'].map(slot => root.querySelector(`[data-workspace-column="${slot}"]`));
    const beforeMissingRegionCommand = game.mapRun.getSnapshot();
    const regionBeforeRecovery = controller.getRefreshStats().regionRefreshes;
    displacedAction.click();
    expect(game.mapRun.getSnapshot()).toEqual(beforeMissingRegionCommand);
    expect(game.mapRun.getSnapshot()?.activeEncounter?.hands).toEqual(beforeMissingRegionCommand?.activeEncounter?.hands);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(regionBeforeRecovery);
    expect(root.querySelector('[data-map-workspace-region]')).toBe(mapRegionBeforeRecovery);
    expect(root.querySelector('[data-workspace-frame="map"]')).toBe(mapFrameBeforeRecovery);
    expect(['left', 'center', 'right'].map(slot => root.querySelector(`[data-workspace-column="${slot}"]`)))
      .toEqual(mapColumnsBeforeRecovery);
    expect(root.querySelector('[data-workspace-column="left"] [data-map-party-member="shiroko"]')).not.toBeNull();
    expect(root.querySelector('[data-map-encounter-region]')?.getAttribute('data-map-run-id')).toBe(runId);
    expect(root.querySelector('.console-shell')).toBe(shell);
    expect(controller.getRefreshStats().fullRenders).toBe(fullRenders);
    expect(controller.getRefreshStats().workspaceRenders).toBe(workspaceRenders);
    expect(controller.getRefreshObservations().at(-1)).toMatchObject({
      scope: 'region', reason: 'map-command', outcome: 'applied',
    });
    stable = captureMapIdentity(root, runId);
    assertStableEncounter();

    let view = game.mapRun.getWorkspaceView(runId);
    if (!view || view.kind !== 'active' || !view.actionPreview) throw new Error('Missing round two action preview.');
    const command = view.actionPreview.playerCommandOptions.find(option => option.canPayPlayerCost && option.canPayActionCosts);
    expect(command).toBeDefined();
    root.querySelector<HTMLButtonElement>(
      `[data-map-player-command][data-character-id="${command!.characterId}"][data-action-id="${command!.action.actionId}"]`,
    )!.click();
    expect(game.mapRun.getSnapshot()?.activeEncounter?.overrides).toMatchObject([{
      kind: 'playerCommand', characterId: command!.characterId, actionId: command!.action.actionId,
    }]);
    selectRequiredTargets();
    expect(root.querySelector<HTMLButtonElement>('[data-map-commit]')?.disabled).toBe(false);
    assertStableEncounter();

    const regionBeforeCommandCommit = controller.getRefreshStats().regionRefreshes;
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    const thirdRound = game.mapRun.getSnapshot()!;
    expect(thirdRound.activeEncounter?.round).toBe(3);
    expect(thirdRound.playerCost).toBe(0);
    const commandSettlement = thirdRound.activeEncounter?.lastCommit?.settlements.find(settlement =>
      settlement.characterId === command!.characterId && settlement.actionId === command!.action.actionId,
    );
    expect(commandSettlement).toMatchObject({
      characterId: command!.characterId,
      actionId: command!.action.actionId,
      overrideKind: 'playerCommand',
      playerCostSpent: 1,
      resourceChanges: expect.arrayContaining([expect.objectContaining({ delta: expect.any(Number) })]),
    });
    expect(commandSettlement?.resourceChanges.some(change => change.delta > 0)).toBe(true);
    expect(root.querySelector('[data-map-region-key="feed-recent-commit"]')?.textContent).toContain('PlayerCommand');
    expect(root.querySelector('[data-map-region-key="feed-recent-commit"]')?.textContent).toContain('PlayerCost');
    expect(root.querySelector('[data-map-region-key="feed-recent-commit"]')?.textContent).toMatch(/\+\d/);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(regionBeforeCommandCommit);
    expect(root.querySelector('[data-map-region-key="action-dock"]')?.getAttribute('aria-label')).toBe('第 3 轮行动操作');
    const thirdRoundView = game.mapRun.getWorkspaceView(runId);
    if (!thirdRoundView || thirdRoundView.kind !== 'active' || !thirdRoundView.actionPreview) {
      throw new Error('The successful PlayerCost Command Commit did not expose the next Hand.');
    }
    for (const member of thirdRoundView.actionPreview.preparedActions) {
      expect(root.querySelectorAll(`[data-map-party-member="${member.characterId}"] [data-map-action-swap]`))
        .toHaveLength(member.hand.length - (member.hand.some(card => card.actionId === member.preparedAction?.actionId) ? 1 : 0));
    }
    assertStableEncounter();

    expect(thirdRoundView.actionPreview.preparedActions.every(member => member.hand.length === 0 && member.preparedAction === null)).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-map-commit]')?.disabled).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-map-commit]')!.click();
    expect(game.mapRun.getSnapshot()).toMatchObject({
      currentNodeId: encounterNode.id,
      activeEncounterNodeId: null,
      completedEncounterNodeIds: [encounterNode.id],
      status: 'inProgress',
    });
    root.querySelector<HTMLButtonElement>('[data-map-show-map]')!.click();
    expect(root.querySelector('[data-map-overview]')?.textContent).toContain(encounterNode.title);
    expect(root.querySelector('[data-map-overview]')?.textContent).toContain('当前位置');
    const exitEdge = map.edges.find(edge => edge.fromNodeId === encounterNode.id && map.exitNodeIds.includes(edge.toNodeId))!;
    expect(root.querySelector(`[data-map-location-node-id="${exitEdge.toNodeId}"]`)?.getAttribute('data-map-location-selectable')).toBe('true');
    expect(root.querySelector<HTMLButtonElement>('[data-map-location-submit]')?.disabled).toBe(true);
    moveToMapNode(root, exitEdge.toNodeId);
    expect(game.mapRun.getWorkspaceView(runId)).toMatchObject({ kind: 'success', result: { mapId, runId } });
  });
});

function captureMapIdentity(root: HTMLElement, runId: string) {
  const scroll = (key: string) => root.querySelector<HTMLElement>(`[data-map-region-key="${key}"][data-scroll-owner="content-region"]`)!;
  const snapshot = {
    workspace: root.querySelector('[data-map-workspace-region]'),
    frame: root.querySelector('[data-workspace-frame="map"]'),
    left: root.querySelector('[data-workspace-column="left"]'),
    center: root.querySelector('[data-workspace-column="center"]'),
    right: root.querySelector('[data-workspace-column="right"]'),
    mapToggle: root.querySelector('[data-map-show-map]'),
    currentNode: root.querySelector('[data-map-region-key^="feed-node:"]'),
    partyScroll: scroll('party-scroll'),
    feedScroll: scroll('talk-feed'),
    actionDock: root.querySelector('[data-map-region-key="action-dock"]'),
    actionOptions: root.querySelector<HTMLElement>('[data-map-region-key="action-options"][data-scroll-owner="content-region"]'),
    contextScroll: scroll('context-scroll'),
  };
  snapshot.partyScroll.scrollTop = 31;
  expect(snapshot.actionOptions).toBeNull(); // This fixture declares no Ability / Item source controls.
  Object.defineProperties(snapshot.feedScroll, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 200 },
  });
  snapshot.feedScroll.scrollTop = 47;
  if (snapshot.actionOptions) snapshot.actionOptions.scrollTop = 61;
  snapshot.contextScroll.scrollTop = 73;
  return { runId, snapshot };
}

function expectMapIdentity(root: HTMLElement, runId: string, identity: ReturnType<typeof captureMapIdentity>): void {
  expect(root.querySelector('[data-map-workspace-region]')).toBe(identity.snapshot.workspace);
  expect(root.querySelector('[data-workspace-frame="map"]')).toBe(identity.snapshot.frame);
  expect(root.querySelector('[data-workspace-column="left"]')).toBe(identity.snapshot.left);
  expect(root.querySelector('[data-workspace-column="center"]')).toBe(identity.snapshot.center);
  expect(root.querySelector('[data-workspace-column="right"]')).toBe(identity.snapshot.right);
  expect(root.querySelector('[data-map-show-map]')).toBe(identity.snapshot.mapToggle);
  expect(root.querySelector('[data-map-region-key^="feed-node:"]')).toBe(identity.snapshot.currentNode);
  expect(root.querySelector('[data-map-region-key="party-scroll"][data-scroll-owner="content-region"]')).toBe(identity.snapshot.partyScroll);
  expect(root.querySelector('[data-map-region-key="talk-feed"][data-scroll-owner="content-region"]')).toBe(identity.snapshot.feedScroll);
  expect(root.querySelector('[data-map-region-key="action-dock"]')).toBe(identity.snapshot.actionDock);
  expect(root.querySelector('[data-map-region-key="action-options"][data-scroll-owner="content-region"]')).toBe(identity.snapshot.actionOptions);
  expect(root.querySelector('[data-map-region-key="context-scroll"][data-scroll-owner="content-region"]')).toBe(identity.snapshot.contextScroll);
  expect(identity.snapshot.partyScroll.scrollTop).toBe(31);
  expect(identity.snapshot.feedScroll.scrollTop).toBe(47);
  if (identity.snapshot.actionOptions) expect(identity.snapshot.actionOptions.scrollTop).toBe(61);
  expect(identity.snapshot.contextScroll.scrollTop).toBe(73);
  expect(root.querySelector('[data-map-workspace-region]')?.getAttribute('data-map-run-id')).toBe(runId);
}
