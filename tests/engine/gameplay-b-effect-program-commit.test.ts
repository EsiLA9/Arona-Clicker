import { afterEach, describe, expect, test, vi } from 'vitest';
import type { MapRunEncounterDraftToken } from '../../src/arona-clicker/contracts/map-run';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { MapRunService } from '../../src/arona-clicker/services/map-run-service';
import type { GameplayMapActionDef, GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import {
  createLegacyGoldenOwner,
  createLegacyGoldenRuntime,
  commitCommand as runtimeCommitCommand,
  LEGACY_GOLDEN_ITEM_ID,
  legacyGoldenMap,
} from './gameplay-b-effect-test-fixtures';

const games: GameInstance[] = [];

function withLocals(
  map: GameplayMapDef,
  locals: NonNullable<NonNullable<GameplayMapDef['nodes'][number]['encounter']>['locals']>,
): GameplayMapDef {
  return {
    ...map,
    nodes: map.nodes.map(node => node.id === 'battle' && node.encounter
      ? { ...node, encounter: { ...node.encounter, locals } }
      : node),
  };
}

function owner(map: GameplayMapDef, itemCount = 0, resolvedMap: GameplayMapDef = map) {
  const fixture = createLegacyGoldenOwner(map, itemCount);
  games.push(fixture.game);
  const admittedParty = fixture.game.mapRun.getSnapshot()?.party;
  if (!admittedParty) throw new Error('Registry Owner did not admit a fixed party');
  const service = new MapRunService(
    { resolve: mapId => mapId === resolvedMap.id ? resolvedMap : null },
    variantId => fixture.game.rosterSystem.getAllVariants().find(variant => variant.id === variantId)?.proto ?? null,
  );
  const seed = vi.spyOn(Math, 'random').mockReturnValue(0.03125);
  try {
    const started = service.start(resolvedMap.id, admittedParty);
    const edge = resolvedMap.edges.find(row => row.fromNodeId === started.currentNodeId
      && (resolvedMap.nodes.find(node => node.id === row.toNodeId)?.encounter
        || resolvedMap.nodes.find(node => node.id === row.toNodeId)?.activities?.length));
    if (!edge) throw new Error('Expected a reachable Encounter');
    const entered = service.move(started.runId, edge.toNodeId);
    expect(entered.activeEncounter?.randomState.seed).toBe(0x08000000);
    return { game: fixture.game, gameRunId: fixture.runId, service, runId: started.runId };
  } finally {
    seed.mockRestore();
  }
}

function draft(service: MapRunService): MapRunEncounterDraftToken {
  const encounter = service.getSnapshot()?.activeEncounter;
  if (!encounter) throw new Error('Expected an active Encounter');
  return {
    nodeId: encounter.nodeId,
    ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
    round: encounter.round,
    draftVersion: encounter.draftVersion,
  };
}

function command(service: MapRunService, runId: string, requestId: string) {
  const current = service.getSnapshot();
  if (!current) throw new Error('Expected an active MapRun');
  return { runId, requestId, expectedCommitVersion: current.commitVersion, draft: draft(service) };
}

function runtimeActivityCommand(game: GameInstance, runId: string, requestId: string) {
  const current = game.mapRun.getSnapshot();
  if (!current?.activeEncounter) throw new Error('GameInstance has no active activity Encounter');
  const encounter = current.activeEncounter;
  return {
    runId,
    requestId,
    expectedCommitVersion: current.commitVersion,
    draft: {
      nodeId: encounter.nodeId,
      activityId: encounter.activityId,
      round: encounter.round,
      draftVersion: encounter.draftVersion,
    },
  };
}

function ownerForActivities(map: GameplayMapDef) {
  const game = createLegacyGoldenRuntime(map);
  games.push(game);
  const seed = vi.spyOn(Math, 'random').mockReturnValue(0.03125);
  try {
    const gameStarted = game.startMap(map.id);
    const gameEdge = map.edges.find(row => row.fromNodeId === gameStarted.currentNodeId
      && map.nodes.find(node => node.id === row.toNodeId)?.activities?.length);
    if (!gameEdge) throw new Error('GameInstance has no reachable activity node');
    game.moveMap(gameStarted.runId, gameEdge.toNodeId);
    const admittedParty = game.mapRun.getSnapshot()?.party;
    if (!admittedParty) throw new Error('Registry Owner did not admit an activity party');
    const service = new MapRunService(
      { resolve: mapId => mapId === map.id ? map : null },
      variantId => game.rosterSystem.getAllVariants().find(variant => variant.id === variantId)?.proto ?? null,
    );
    const planned = service.start(map.id, admittedParty);
    const edge = map.edges.find(row => row.fromNodeId === planned.currentNodeId
      && map.nodes.find(node => node.id === row.toNodeId)?.activities?.length);
    if (!edge) throw new Error('Expected a reachable activity node');
    service.move(planned.runId, edge.toNodeId);
    return { game, gameRunId: gameStarted.runId, service, runId: planned.runId };
  } finally {
    seed.mockRestore();
  }
}

afterEach(() => { games.splice(0).forEach(game => game.dispose()); });

describe('Gameplay B effect program installation and public Commit', () => {
  test.each([
    { initialHp: 4, guardBeforeHeal: true, threshold: 4, expectedMed: 1, expectedCurrent: 7 },
    { initialHp: 5, guardBeforeHeal: true, threshold: 4, expectedMed: 0, expectedCurrent: 8 },
    { initialHp: 4, guardBeforeHeal: false, threshold: 4, expectedMed: 0, expectedCurrent: 7 },
    { initialHp: 5, guardBeforeHeal: false, threshold: 4, expectedMed: 0, expectedCurrent: 8 },
  ])('NEW01 primary HP $initialHp reads the live value with guardBeforeHeal=$guardBeforeHeal', scenario => {
    const guarded = {
      op: 'when' as const,
      condition: { kind: 'hpAtMost' as const, target: 'primary' as const, value: scenario.threshold },
      then: [
        { op: 'counterAdd' as const, counterId: 'guarded', delta: 1 },
        { op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'med', delta: 1 },
      ],
      else: [],
    };
    const heal = { op: 'hpChange' as const, target: 'primary' as const, delta: 3 };
    const map = withLocals(legacyGoldenMap({
      id: `test:map:program-new01-${scenario.initialHp}-${scenario.guardBeforeHeal ? 'guard-heal' : 'heal-guard'}`,
      partyHp: { shiroko: 10, serika: scenario.initialHp },
      teamResources: [{ resourceId: 'med', value: 0 }],
      actions: [
        { id: 'treat', name: 'Treat', eligibleCharacterIds: ['shiroko'], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: scenario.guardBeforeHeal ? [guarded, heal] : [heal, guarded] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'treat', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
      ],
      enemies: [{ id: 'robot', initialHp: 20, maxHp: 20 }],
    }), { counters: [{ id: 'guarded', initial: 0, min: 0, max: 4 }] });
    const { game, gameRunId, service, runId } = owner(map);
    service.setPreparedTarget(runId, 'shiroko', 'serika', draft(service));
    const runtimeEncounter = game.mapRun.getSnapshot()?.activeEncounter;
    if (!runtimeEncounter) throw new Error('GameInstance did not open the NEW01 Encounter');
    game.setMapPreparedTarget(gameRunId, 'shiroko', 'serika', {
      nodeId: runtimeEncounter.nodeId, round: runtimeEncounter.round, draftVersion: runtimeEncounter.draftVersion,
    });
    const before = service.getSnapshot();
    const preview = service.previewEncounterCommit(runId);
    expect(preview).toMatchObject({ canCommit: true, diagnostics: [], executionContractId: 'E1-COMPAT-1' });
    expect(preview?.effectTrace?.find(row => row.op === 'when')).toMatchObject({
      result: scenario.guardBeforeHeal && scenario.initialHp === 4,
      reads: [{ op: 'hpAtMost', current: scenario.guardBeforeHeal ? scenario.initialHp : scenario.initialHp + 3,
        value: scenario.threshold, result: scenario.expectedMed === 1 }],
    });
    expect(preview?.effectTrace?.filter(row => row.op === 'resourceSettlement')).toMatchObject(
      scenario.expectedMed === 1
        ? [{ account: 'sourceTeam', resourceId: 'med', before: 0, after: 1, delta: 1 }]
        : [],
    );
    expect(service.getSnapshot()).toEqual(before);
    expect(service.previewEncounterCommit(runId)).toEqual(preview);

    const committed = service.commitEncounterRound(command(service, runId, `new01-${scenario.initialHp}-${scenario.guardBeforeHeal}`));
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(scenario.expectedCurrent);
    expect(committed.teamResources.find(row => row.resourceId === 'med')?.value).toBe(scenario.expectedMed);
    expect(committed.lastEncounterCommit?.effectTrace).toEqual(preview?.effectTrace);
    const runtimeWorkspace = game.mapRun.getWorkspaceView(gameRunId);
    if (runtimeWorkspace?.kind !== 'active' || !runtimeWorkspace.actionPreview) throw new Error('Missing NEW01 GameInstance Preview');
    expect(runtimeWorkspace.actionPreview.commitPreview.canCommit).toBe(true);
    const runtimeCommitted = game.commitMapEncounterRound(
      runtimeCommitCommand(game, gameRunId, `runtime-new01-${scenario.initialHp}-${scenario.guardBeforeHeal}`),
    );
    expect(runtimeCommitted.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(scenario.expectedCurrent);
    expect(runtimeCommitted.teamResources.find(row => row.resourceId === 'med')?.value).toBe(scenario.expectedMed);
    expect(runtimeCommitted.lastEncounterCommit?.plannedLocals).toEqual(committed.lastEncounterCommit?.plannedLocals);
    expect(runtimeCommitted.lastEncounterCommit?.effectTrace).toEqual(committed.lastEncounterCommit?.effectTrace);
    expect(runtimeCommitted.lastEncounterCommit).toMatchObject({
      programReceiptVersion: 1,
      executionContractId: 'E1-COMPAT-1',
      effectScope: { runId: gameRunId, mapId: map.id, nodeId: 'battle', round: 1 },
    });
  });

  test('NEW02 legal natural Team cost plus later PlayerCommand cost rejects the whole GameInstance Commit', () => {
    const map = legacyGoldenMap({
      id: 'test:map:program-new02-commit-reject',
      playerCost: 1,
      teamResources: [{ resourceId: 'supplies', value: 1 }],
      actions: [
        { id: 'natural-spend', name: 'Natural Spend', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }] },
        { id: 'late-refill', name: 'Late Refill', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
          costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'natural-spend', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'late-refill', tendencyWeight: 1 }] },
      ],
    });
    const fixture = createLegacyGoldenOwner(map);
    games.push(fixture.game);
    const current = fixture.game.mapRun.getSnapshot();
    if (!current?.activeEncounter) throw new Error('GameInstance did not open the NEW02 Encounter');
    fixture.game.issueMapPlayerCommand(fixture.runId, 'serika', 'late-refill', {
      nodeId: current.activeEncounter.nodeId,
      round: current.activeEncounter.round,
      draftVersion: current.activeEncounter.draftVersion,
    });
    const before = fixture.game.mapRun.getSnapshot();
    const beforeState = structuredClone(fixture.game.state);
    const beforeStats = fixture.game.statsService.getSnapshot();
    const workspace = fixture.game.mapRun.getWorkspaceView(fixture.runId);
    if (workspace?.kind !== 'active' || !workspace.actionPreview) throw new Error('Missing NEW02 public Preview');
    expect(workspace.actionPreview.commitPreview).toMatchObject({
      canCommit: false,
      diagnostics: [expect.stringContaining('cannot afford resource cost "supplies"')],
    });
    expect(() => fixture.game.commitMapEncounterRound(
      runtimeCommitCommand(fixture.game, fixture.runId, 'new02-cost-conflict'),
    )).toThrow(/cannot afford resource cost "supplies"/);
    expect(fixture.game.mapRun.getSnapshot()).toEqual(before);
    expect(fixture.game.state).toEqual(beforeState);
    expect(fixture.game.statsService.getSnapshot()).toEqual(beforeStats);
    expect(fixture.game.mapRun.getSnapshot()?.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
    expect(fixture.game.mapRun.getSnapshot()?.playerCost).toBe(1);
  });

  test('Item program success installs MapRun and Inventory once, and same-request replay is inert', () => {
    const map = withLocals(legacyGoldenMap({
      id: 'test:map:program-item-commit',
      actions: [
        { id: 'item-program', name: 'Item Program', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: [
            { op: 'counterAdd', counterId: 'uses', delta: 1 },
            { op: 'hpChange', target: 'primary', delta: -1 },
          ] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' } },
      ],
      participants: ['shiroko', 'serika'].map(characterId => ({
        characterId, actions: [{ actionId: 'wait', tendencyWeight: 1 }],
      })),
      enemies: [{ id: 'robot', initialHp: 20, maxHp: 20 }],
      itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'item-program' }],
    }), { counters: [{ id: 'uses', initial: 0, min: 0, max: 5 }] });
    const fixture = createLegacyGoldenOwner(map, 1);
    games.push(fixture.game);
    fixture.game.mutations.addItem(LEGACY_GOLDEN_ITEM_ID, 1, 3);
    const current = fixture.game.mapRun.getSnapshot();
    if (!current?.activeEncounter) throw new Error('GameInstance did not open the Item Encounter');
    fixture.game.setMapItemDraft(fixture.runId, LEGACY_GOLDEN_ITEM_ID,
      { kind: 'partyCharacter', characterId: 'serika' }, {
        nodeId: current.activeEncounter.nodeId, round: current.activeEncounter.round,
        draftVersion: current.activeEncounter.draftVersion,
      });
    const workspace = fixture.game.mapRun.getWorkspaceView(fixture.runId);
    if (workspace?.kind !== 'active' || !workspace.actionPreview) throw new Error('Missing Item Preview');
    expect(workspace.actionPreview.commitPreview.canCommit).toBe(true);
    const cmd = runtimeCommitCommand(fixture.game, fixture.runId, 'item-program-success');
    const itemEvents: unknown[] = [];
    fixture.game.eventBus.on('itemCollected', event => {
      if (event.itemId === LEGACY_GOLDEN_ITEM_ID && event.count === -1) itemEvents.push(event);
    });
    const committed = fixture.game.commitMapEncounterRound(cmd);
    expect(committed.lastEncounterCommit).toMatchObject({
      programReceiptVersion: 1,
      executionContractId: 'E1-COMPAT-1',
      item: { itemId: LEGACY_GOLDEN_ITEM_ID, consumedCount: 1 },
      programVisitCount: 2,
      plannedLocals: { counters: { uses: { value: 1 } }, flags: {} },
    });
    expect(committed.lastEncounterCommit?.effectScope).toMatchObject({
      runId: fixture.runId, mapId: map.id, nodeId: 'battle', activityId: null, round: 1,
    });
    expect(committed.lastEncounterCommit?.programVisits).toHaveLength(2);
    expect(committed.lastEncounterCommit?.effectTrace).toHaveLength(2);
    expect(Object.isFrozen(committed.lastEncounterCommit?.effectScope)).toBe(true);
    expect(Object.isFrozen(committed.lastEncounterCommit?.programVisits)).toBe(true);
    expect(Object.isFrozen(committed.lastEncounterCommit?.programVisits?.[0]?.source)).toBe(true);
    expect(Object.isFrozen(committed.lastEncounterCommit?.effectTrace?.[0])).toBe(true);
    expect(Object.isFrozen(committed.lastEncounterCommit?.plannedLocals?.counters.uses)).toBe(true);
    expect(committed.activeEncounter?.locals?.counters.uses?.value).toBe(1);
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(9);
    expect(fixture.game.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBeUndefined();
    expect(itemEvents).toHaveLength(1);
    const stateAfterCommit = structuredClone(fixture.game.state);
    const statsAfterCommit = fixture.game.statsService.getSnapshot();
    const replayed = fixture.game.commitMapEncounterRound(cmd);
    expect(replayed).toEqual(committed);
    expect(fixture.game.mapRun.getSnapshot()).toEqual(committed);
    expect(fixture.game.state).toEqual(stateAfterCommit);
    expect(fixture.game.statsService.getSnapshot()).toEqual(statsAfterCommit);
    expect(itemEvents).toHaveLength(1);
  });

  test('an Item removed after drafting rejects before either Owner writes', () => {
    const map = withLocals(legacyGoldenMap({
      id: 'test:map:program-item-missing-inventory',
      actions: [
        { id: 'item-program', name: 'Item Program', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: [{ op: 'counterAdd', counterId: 'uses', delta: 1 }] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' } },
      ],
      participants: ['shiroko', 'serika'].map(characterId => ({
        characterId, actions: [{ actionId: 'wait', tendencyWeight: 1 }],
      })),
      enemies: [{ id: 'robot', initialHp: 20, maxHp: 20 }],
      itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'item-program' }],
    }), { counters: [{ id: 'uses', initial: 0, min: 0, max: 5 }] });
    const fixture = createLegacyGoldenOwner(map, 1);
    games.push(fixture.game);
    fixture.game.mutations.addItem(LEGACY_GOLDEN_ITEM_ID, 1, 3);
    const current = fixture.game.mapRun.getSnapshot();
    if (!current?.activeEncounter) throw new Error('GameInstance did not open the Item Encounter');
    fixture.game.setMapItemDraft(fixture.runId, LEGACY_GOLDEN_ITEM_ID,
      { kind: 'partyCharacter', characterId: 'serika' }, {
        nodeId: current.activeEncounter.nodeId, round: current.activeEncounter.round,
        draftVersion: current.activeEncounter.draftVersion,
      });
    const draft = fixture.game.mapRun.getSnapshot();
    expect(draft?.activeEncounter?.itemDraft?.itemId).toBe(LEGACY_GOLDEN_ITEM_ID);
    fixture.game.mutations.removeItem(LEGACY_GOLDEN_ITEM_ID, 1);
    const beforeRun = fixture.game.mapRun.getSnapshot();
    const beforeState = structuredClone(fixture.game.state);
    const beforeStats = fixture.game.statsService.getSnapshot();
    const events: unknown[] = [];
    fixture.game.eventBus.on('itemCollected', event => events.push(event));
    expect(() => fixture.game.commitMapEncounterRound(
      runtimeCommitCommand(fixture.game, fixture.runId, 'item-program-missing-inventory'),
    )).toThrow(/inventory/i);
    expect(fixture.game.mapRun.getSnapshot()).toEqual(beforeRun);
    expect(fixture.game.state).toEqual(beforeState);
    expect(fixture.game.statsService.getSnapshot()).toEqual(beforeStats);
    expect(events).toEqual([]);
  });

  test('Counter saturation, Flag writes, and safe-add overflow install or reject as one round', () => {
    const boundedTemplate = legacyGoldenMap({
      id: 'test:map:program-counter-commit',
      actions: [
        { id: 'update-with-flag', name: 'Update with Flag', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [
            { op: 'counterAdd', counterId: 'trust', delta: 1 },
            { op: 'flagSet', flagId: 'ready', value: true },
            { op: 'flagSet', flagId: 'ready', value: false },
          ] } },
        { id: 'update-counter', name: 'Update Counter', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'counterAdd', counterId: 'trust', delta: 1 }] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'update-with-flag', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'update-counter', tendencyWeight: 1 }] },
      ],
    });
    const battleNode = boundedTemplate.nodes.find(node => node.id === 'battle');
    if (!battleNode?.encounter) throw new Error('Bounded Counter fixture has no Encounter');
    const { completion: _manualCompletion, ...nonBattleEncounter } = battleNode.encounter;
    const bounded: GameplayMapDef = {
      ...boundedTemplate,
      nodes: boundedTemplate.nodes.map(node => node.id === 'battle' ? { ...node, encounter: {
        ...nonBattleEncounter,
        rounds: 3,
        locals: { counters: [{ id: 'trust', initial: 2, min: 0, max: 3 }], flags: [{ id: 'ready', initial: false }] },
      } } : node),
    };
    const state = owner(bounded);
    const preview = state.service.previewEncounterCommit(state.runId);
    expect(preview).toMatchObject({ canCommit: true, plannedLocals: {
      counters: { trust: { value: 3, min: 0, max: 3 } }, flags: { ready: false },
    } });
    expect(preview?.effectTrace?.filter(row => row.op === 'counterAdd').map(row => row.op === 'counterAdd'
      && [row.source?.kind === 'partyCharacter' ? row.source.id : null, row.before, row.after, row.delta]))
      .toEqual([['shiroko', 2, 3, 1], ['serika', 3, 3, 0]]);
    expect(preview?.effectTrace?.filter(row => row.op === 'flagSet').map(row => row.op === 'flagSet' && [row.before, row.after]))
      .toEqual([[false, true], [true, false]]);
    const committed = state.service.commitEncounterRound(command(state.service, state.runId, 'counter-flag-installed'));
    expect(committed.activeEncounter).toMatchObject({ round: 2, locals: preview?.plannedLocals });
    expect(committed.lastEncounterCommit?.effectTrace).toEqual(preview?.effectTrace);
    const boundedRuntime = state.game.mapRun.getSnapshot()?.activeEncounter;
    if (!boundedRuntime) throw new Error('GameInstance did not open the bounded Counter Encounter');
    const boundedWorkspace = state.game.mapRun.getWorkspaceView(state.gameRunId);
    if (boundedWorkspace?.kind !== 'active' || !boundedWorkspace.actionPreview) throw new Error('Missing bounded Counter Preview');
    expect(boundedWorkspace.actionPreview.commitPreview.canCommit).toBe(true);
    const runtimeCommitted = state.game.commitMapEncounterRound(
      runtimeCommitCommand(state.game, state.gameRunId, 'runtime-counter-flag-installed'),
    );
    expect(runtimeCommitted.activeEncounter).toMatchObject({ round: 2, locals: preview?.plannedLocals });
    expect(runtimeCommitted.lastEncounterCommit?.effectTrace).toEqual(committed.lastEncounterCommit?.effectTrace);

    const lower = withLocals(legacyGoldenMap({
      id: 'test:map:program-counter-lower-saturation',
      actions: [
        { id: 'decrement', name: 'Decrement', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'counterAdd', counterId: 'trust', delta: -1 }] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'decrement', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
      ],
      enemies: [{ id: 'robot', initialHp: 20, maxHp: 20 }],
    }), { counters: [{ id: 'trust', initial: 0, min: 0, max: 3 }] });
    const lowState = owner(lower);
    const lowPreview = lowState.service.previewEncounterCommit(lowState.runId);
    expect(lowPreview?.effectTrace?.find(row => row.op === 'counterAdd')).toMatchObject({ before: 0, after: 0, delta: 0 });
    const lowCommit = lowState.service.commitEncounterRound(command(lowState.service, lowState.runId, 'counter-lower-saturation'));
    expect(lowCommit.activeEncounter?.locals?.counters.trust?.value).toBe(0);
    const lowRuntimeWorkspace = lowState.game.mapRun.getWorkspaceView(lowState.gameRunId);
    if (lowRuntimeWorkspace?.kind !== 'active' || !lowRuntimeWorkspace.actionPreview) throw new Error('Missing lower-bound Preview');
    expect(lowRuntimeWorkspace.actionPreview.commitPreview.canCommit).toBe(true);
    const lowRuntimeCommit = lowState.game.commitMapEncounterRound(
      runtimeCommitCommand(lowState.game, lowState.gameRunId, 'runtime-counter-lower-saturation'),
    );
    expect(lowRuntimeCommit.lastEncounterCommit?.effectTrace).toEqual(lowCommit.lastEncounterCommit?.effectTrace);
    expect(lowRuntimeCommit.activeEncounter?.locals?.counters.trust?.value).toBe(0);

    const overflow = withLocals(legacyGoldenMap({
      id: 'test:map:program-counter-safe-add-overflow',
      actions: [
        { id: 'overflow', name: 'Overflow', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'counterAdd', counterId: 'trust', delta: 1 }] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'overflow', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
      ],
      enemies: [{ id: 'robot', initialHp: 20, maxHp: 20 }],
    }), { counters: [{ id: 'trust', initial: Number.MAX_SAFE_INTEGER, min: 0, max: Number.MAX_SAFE_INTEGER }] });
    const overflowState = owner(overflow);
    const before = overflowState.service.getSnapshot();
    expect(overflowState.service.previewEncounterCommit(overflowState.runId)).toMatchObject({
      canCommit: false,
      diagnostics: [expect.stringMatching(/safe integer|overflow/i)],
      settlements: null,
    });
    expect(() => overflowState.service.commitEncounterRound(
      command(overflowState.service, overflowState.runId, 'counter-safe-add-overflow'),
    )).toThrow(/safe integer|overflow/i);
    expect(overflowState.service.getSnapshot()).toEqual(before);
    const runtimeBefore = overflowState.game.mapRun.getSnapshot();
    const playerStateBefore = structuredClone(overflowState.game.state);
    const overflowWorkspace = overflowState.game.mapRun.getWorkspaceView(overflowState.gameRunId);
    if (overflowWorkspace?.kind !== 'active' || !overflowWorkspace.actionPreview) throw new Error('Missing overflow Preview');
    expect(overflowWorkspace.actionPreview.commitPreview.canCommit).toBe(false);
    expect(() => overflowState.game.commitMapEncounterRound(
      runtimeCommitCommand(overflowState.game, overflowState.gameRunId, 'runtime-counter-safe-add-overflow'),
    )).toThrow(/safe integer|overflow/i);
    expect(overflowState.game.mapRun.getSnapshot()).toEqual(runtimeBefore);
    expect(overflowState.game.state).toEqual(playerStateBefore);
  });

  test('Counter locals carry between rounds, reset on activity change, and receipts match Preview', () => {
    const actionDefs: GameplayMapActionDef[] = [
      { id: 'tick', name: 'Tick', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
        effectProgram: { resolve: [{ op: 'counterAdd', counterId: 'trust', delta: 1 }] } },
      { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
    ];
    const participants = [
      { characterId: 'shiroko', actions: [{ actionId: 'tick', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
    ];
    const template = legacyGoldenMap({
      id: 'test:map:program-activity-local-install', actions: actionDefs, participants,
    });
    const map: GameplayMapDef = {
      ...template,
      nodes: template.nodes.map(node => node.id !== 'battle' ? node : {
        id: 'battle', title: 'Rest', activities: [
          { id: 'first', encounter: { title: 'First Rest', rounds: 2, participants,
            locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 5 }] } } },
          { id: 'second', encounter: { title: 'Second Rest', rounds: 2, participants,
            locals: { counters: [{ id: 'trust', initial: 7, min: 0, max: 10 }] } } },
        ],
      }),
    };
    const { game, gameRunId, service, runId } = ownerForActivities(map);
    const firstPreview = service.previewEncounterCommit(runId);
    expect(firstPreview).toMatchObject({ canCommit: true, effectScope: { activityId: 'first', round: 1 } });
    const first = service.commitEncounterRound(command(service, runId, 'activity-first-round'));
    expect(first.activeEncounter).toMatchObject({ activityId: 'first', round: 2, locals: { counters: { trust: { value: 1 } } } });
    expect(first.lastEncounterCommit?.plannedLocals).toEqual(firstPreview?.plannedLocals);
    const firstRuntime = game.commitMapEncounterRound(runtimeActivityCommand(game, gameRunId, 'runtime-activity-first-round'));
    expect(firstRuntime.activeEncounter).toMatchObject({ activityId: 'first', round: 2, locals: { counters: { trust: { value: 1 } } } });
    expect(firstRuntime.lastEncounterCommit?.plannedLocals).toEqual(firstPreview?.plannedLocals);

    const secondRoundPreview = service.previewEncounterCommit(runId);
    expect(secondRoundPreview?.plannedLocals?.counters.trust?.value).toBe(2);
    const transitioned = service.commitEncounterRound(command(service, runId, 'activity-second-round'));
    expect(transitioned.activeEncounter).toMatchObject({
      activityId: 'second', round: 1, locals: { counters: { trust: { value: 7, min: 0, max: 10 } } },
    });
    expect(transitioned.lastEncounterCommit?.plannedLocals?.counters.trust?.value).toBe(2);
    const secondRuntimePreview = game.mapRun.getWorkspaceView(gameRunId);
    if (secondRuntimePreview?.kind !== 'active' || !secondRuntimePreview.actionPreview) throw new Error('Missing activity Runtime Preview');
    expect(secondRuntimePreview.actionPreview.commitPreview.canCommit).toBe(true);
    const runtimeTransition = game.commitMapEncounterRound(runtimeActivityCommand(game, gameRunId, 'runtime-activity-second-round'));
    expect(runtimeTransition.activeEncounter).toMatchObject({
      activityId: 'second', round: 1, locals: { counters: { trust: { value: 7, min: 0, max: 10 } } },
    });
    expect(runtimeTransition.lastEncounterCommit?.plannedLocals?.counters.trust?.value).toBe(2);
  });

  test('4096 prepare-plus-resolve accesses install and 4097 rejects with zero writes', () => {
    const statements = (count: number) => Array.from({ length: count }, (_, index) => ({
      op: 'flagSet' as const, flagId: 'tick', value: index % 2 === 0,
    }));
    const budgetMap = (id: string, partyResolveCount: number, enemyResolveCount: number): GameplayMapDef => {
      const actions: GameplayMapActionDef[] = [
        { id: 'shot', name: 'Shot', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
          costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] },
        { id: 'enemy-program', name: 'Enemy Program', eligibleCharacterIds: [], target: { kind: 'none' },
          effectProgram: { resolve: statements(enemyResolveCount) } },
        { id: 'party-prepare', name: 'Party Prepare', eligibleCharacterIds: ['shiroko'],
          target: { kind: 'card', side: 'ally' },
          effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }], resolve: statements(partyResolveCount) } },
      ];
      return withLocals(legacyGoldenMap({
        id,
        actorResources: [{ characterId: 'serika', resourceId: 'sCost', value: 1 }],
        actions,
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'party-prepare', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'shot', tendencyWeight: 1 }] },
        ],
        enemies: Array.from({ length: 64 }, (_, index) => ({
          id: `enemy-${index + 1}`, initialHp: 10, maxHp: 10,
          actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }],
        })),
      }), { flags: [{ id: 'tick', initial: false }] });
    };
    const exactMap = budgetMap('test:map:program-commit-budget-4096', 63, 63);
    const exact = owner(exactMap);
    const targetCard = exact.service.getCards(exact.runId)
      .find(card => card.owner.kind === 'partyCharacter' && card.owner.id === 'serika' && card.actionId === 'shot')?.ref;
    if (!targetCard) throw new Error('4096 fixture has no Owner-generated target CardRef');
    exact.service.setPreparedCardTarget(exact.runId, 'shiroko', targetCard, draft(exact.service));
    const beforePreview = exact.service.getSnapshot();
    const preview = exact.service.previewEncounterCommit(exact.runId);
    expect(preview).toMatchObject({ canCommit: true, diagnostics: [], programReceiptVersion: 1, programVisitCount: 4096 });
    expect(preview?.programVisits).toHaveLength(4096);
    expect(exact.service.previewEncounterCommit(exact.runId)).toEqual(preview);
    expect(exact.service.getSnapshot()).toEqual(beforePreview);
    const commit = command(exact.service, exact.runId, 'program-budget-exact-commit');
    const installed = exact.service.commitEncounterRound(commit);
    expect(installed.lastEncounterCommit?.programVisitCount).toBe(4096);
    expect(installed.lastEncounterCommit?.effectTrace).toHaveLength(4096);
    expect(exact.service.commitEncounterRound(commit)).toEqual(installed);
    const runtimeTargetCard = exact.game.mapRun.getCards(exact.gameRunId)
      .find(card => card.owner.kind === 'partyCharacter' && card.owner.id === 'serika' && card.actionId === 'shot')?.ref;
    const runtimeEncounter = exact.game.mapRun.getSnapshot()?.activeEncounter;
    if (!runtimeTargetCard || !runtimeEncounter) throw new Error('4096 Runtime fixture has no Owner-generated target CardRef');
    exact.game.setMapPreparedCardTarget(exact.gameRunId, 'shiroko', runtimeTargetCard, {
      nodeId: runtimeEncounter.nodeId, round: runtimeEncounter.round, draftVersion: runtimeEncounter.draftVersion,
    });
    const runtimeWorkspace = exact.game.mapRun.getWorkspaceView(exact.gameRunId);
    if (runtimeWorkspace?.kind !== 'active' || !runtimeWorkspace.actionPreview) throw new Error('Missing 4096 Runtime Preview');
    expect(runtimeWorkspace.actionPreview.commitPreview.canCommit).toBe(true);
    const runtimeCommand = runtimeCommitCommand(exact.game, exact.gameRunId, 'runtime-program-budget-exact');
    const runtimeInstalled = exact.game.commitMapEncounterRound(runtimeCommand);
    expect(runtimeInstalled.lastEncounterCommit).toMatchObject({
      programReceiptVersion: 1,
      executionContractId: 'E1-COMPAT-1',
      effectScope: { runId: exact.gameRunId, mapId: exactMap.id, nodeId: 'battle', round: 1 },
      programVisitCount: 4096,
      programVisits: expect.any(Array),
      plannedLocals: { flags: { tick: true } },
    });
    expect(runtimeInstalled.lastEncounterCommit?.programVisits).toHaveLength(4096);
    expect(runtimeInstalled.lastEncounterCommit?.effectTrace).toHaveLength(4096);
    expect(Object.isFrozen(runtimeInstalled.lastEncounterCommit?.programVisits)).toBe(true);
    expect(Object.isFrozen(runtimeInstalled.lastEncounterCommit?.programVisits?.[0]?.source)).toBe(true);
    const stateAfterRuntimeCommit = structuredClone(exact.game.state);
    const statsAfterRuntimeCommit = exact.game.statsService.getSnapshot();
    expect(exact.game.commitMapEncounterRound(runtimeCommand)).toEqual(runtimeInstalled);
    expect(exact.game.mapRun.getSnapshot()).toEqual(runtimeInstalled);
    expect(exact.game.state).toEqual(stateAfterRuntimeCommit);
    expect(exact.game.statsService.getSnapshot()).toEqual(statsAfterRuntimeCommit);

    const overflowMap = budgetMap('test:map:program-commit-budget-4097', 0, 64);
    const overflow = owner(overflowMap);
    const overflowCard = overflow.service.getCards(overflow.runId)
      .find(card => card.owner.kind === 'partyCharacter' && card.owner.id === 'serika' && card.actionId === 'shot')?.ref;
    if (!overflowCard) throw new Error('4097 fixture has no Owner-generated target CardRef');
    overflow.service.setPreparedCardTarget(overflow.runId, 'shiroko', overflowCard, draft(overflow.service));
    const beforeOverflow = overflow.service.getSnapshot();
    expect(overflow.service.previewEncounterCommit(overflow.runId)).toMatchObject({
      canCommit: false,
      diagnostics: [expect.stringContaining('visit budget exceeds 4096')],
      settlements: null,
    });
    expect(overflow.service.getSnapshot()).toEqual(beforeOverflow);
    expect(() => overflow.service.commitEncounterRound(command(overflow.service, overflow.runId, 'program-budget-overflow')))
      .toThrow(/visit budget exceeds 4096/);
    expect(overflow.service.getSnapshot()).toEqual(beforeOverflow);
    const runtimeOverflowCard = overflow.game.mapRun.getCards(overflow.gameRunId)
      .find(card => card.owner.kind === 'partyCharacter' && card.owner.id === 'serika' && card.actionId === 'shot')?.ref;
    const runtimeOverflowEncounter = overflow.game.mapRun.getSnapshot()?.activeEncounter;
    if (!runtimeOverflowCard || !runtimeOverflowEncounter) throw new Error('4097 Runtime fixture has no Owner-generated target CardRef');
    overflow.game.setMapPreparedCardTarget(overflow.gameRunId, 'shiroko', runtimeOverflowCard, {
      nodeId: runtimeOverflowEncounter.nodeId, round: runtimeOverflowEncounter.round,
      draftVersion: runtimeOverflowEncounter.draftVersion,
    });
    const runtimeBeforeOverflow = overflow.game.mapRun.getSnapshot();
    const playerStateBeforeOverflow = structuredClone(overflow.game.state);
    const statsBeforeOverflow = overflow.game.statsService.getSnapshot();
    const runtimeOverflowWorkspace = overflow.game.mapRun.getWorkspaceView(overflow.gameRunId);
    if (runtimeOverflowWorkspace?.kind !== 'active' || !runtimeOverflowWorkspace.actionPreview) {
      throw new Error('Missing 4097 Runtime Preview');
    }
    expect(runtimeOverflowWorkspace.actionPreview.commitPreview.canCommit).toBe(false);
    expect(() => overflow.game.commitMapEncounterRound(
      runtimeCommitCommand(overflow.game, overflow.gameRunId, 'runtime-program-budget-overflow'),
    )).toThrow(/visit budget exceeds 4096/);
    expect(overflow.game.mapRun.getSnapshot()).toEqual(runtimeBeforeOverflow);
    expect(overflow.game.state).toEqual(playerStateBeforeOverflow);
    expect(overflow.game.statsService.getSnapshot()).toEqual(statsBeforeOverflow);
  });
});
