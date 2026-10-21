import { afterEach, describe, expect, test } from 'vitest';
import { createGameCommands } from '../../src/arona-clicker/runtime-commands';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b-map-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { GameplayMapActionDef } from '../../src/data-services/contracts/gameplay-map';
import { resolveGameplayBActionPreview } from '../../src/arona-clicker/services/gameplay-b-action-preview-resolver';

describe('Gameplay B MapRun GameInstance integration', () => {
  const games: GameInstance[] = [];

  function createGame(datapack: Datapack = gameplayBMapDatapack): GameInstance {
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack, datapack], { enterDefaultInit: false });
    return game;
  }

  function withHandOutPartyTargetActions(): { datapack: Datapack; commandActionIds: readonly string[] } {
    const sourceMap = gameplayBMapDatapack.maps?.[0];
    if (!sourceMap) throw new Error('Gameplay B sample Map is missing');
    const commandActionIds = ['command-target-a', 'command-target-b', 'command-target-c', 'command-target-d'];
    const commandActions: GameplayMapActionDef[] = commandActionIds.map((id, index) => ({
      id,
      name: `Command Target ${index + 1}`,
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
    }));
    const datapack: Datapack = {
      ...gameplayBMapDatapack,
      maps: gameplayBMapDatapack.maps?.map(map => map.id !== sourceMap.id ? map : ({
        ...map,
        resumeVersion: map.resumeVersion + 1,
        actions: [...(map.actions ?? []), ...commandActions],
        nodes: map.nodes.map(node => !node.encounter ? node : ({
          ...node,
          encounter: {
            ...node.encounter,
            participants: (node.encounter.participants ?? []).map(participant => ({
              ...participant,
              actions: [
                ...participant.actions,
                ...commandActionIds.map(actionId => ({ actionId, tendencyWeight: 1 })),
              ],
            })),
          },
        })),
      })) ?? [],
    };
    return { datapack, commandActionIds };
  }

  function acquireShiroko(game: GameInstance): string {
    const variant = game.rosterSystem.getAllVariants().find(candidate => candidate.proto === 'shiroko');
    if (!variant) throw new Error('Base Datapack has no registered Shiroko Variant');
    game.mutations.acquireCharacter(variant.id, 'story');
    return variant.id;
  }

  function acquireSerika(game: GameInstance): string {
    const variant = game.rosterSystem.getAllVariants().find(candidate => candidate.proto === 'serika');
    if (!variant) throw new Error('Base Datapack has no registered Serika Variant');
    game.mutations.acquireCharacter(variant.id, 'story');
    return variant.id;
  }

  function acquireMapParty(game: GameInstance): { shirokoVariantId: string; serikaVariantId: string } {
    return {
      shirokoVariantId: acquireShiroko(game),
      serikaVariantId: acquireSerika(game),
    };
  }

  afterEach(() => {
    for (const game of games.splice(0)) game.dispose();
  });

  test('routes MapRun commands through GameCommands and exposes detached run and Encounter reads', () => {
    const game = createGame();
    const commands = createGameCommands(game);
    const mapId = gameplayBMapDatapack.maps?.[0]?.id;
    expect(mapId).toBeDefined();
    const map = game.registry.maps.get(mapId!);
    expect(map).toBeDefined();
    if (!map) throw new Error('Gameplay B sample Map was not loaded into Registry');

    const stateBeforeRejectedAdmission = JSON.stringify(game.state);
    expect(() => commands.startMap(map.id)).toThrow(/shiroko/i);
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(JSON.stringify(game.state)).toBe(stateBeforeRejectedAdmission);

    const { shirokoVariantId, serikaVariantId } = acquireMapParty(game);

    const started = commands.startMap(map.id);
    expect(started).toMatchObject({
      currentNodeId: map.startNodeId,
      party: [
        { characterId: 'shiroko', variantId: shirokoVariantId },
        { characterId: 'serika', variantId: serikaVariantId },
      ],
      playerCost: map.initialPlayerCost,
    });
    expect(game.mapRun.getSnapshot()).toEqual(started);
    expect(game.mapRun.getSnapshot()).not.toBe(started);
    expect(Object.isFrozen(game.mapRun.getSnapshot())).toBe(true);
    expect(game.mapRun.getCurrentEncounter()).toBeNull();

    const entryEdge = map.edges.find(edge => edge.fromNodeId === started.currentNodeId);
    expect(entryEdge).toBeDefined();
    if (!entryEdge) throw new Error('Sample Map start Node has no outgoing Edge');
    const atEncounter = commands.moveMap(started.runId, entryEdge.toNodeId);
    expect(atEncounter.currentNodeId).toBe(entryEdge.toNodeId);
    expect(atEncounter.activeEncounterNodeId).toBe(entryEdge.toNodeId);
    expect(atEncounter.activeEncounter?.nodeId).toBe(entryEdge.toNodeId);
    expect(atEncounter.activeEncounter?.hands.map(hand => hand.characterId)).toEqual(['shiroko', 'serika']);
    expect(Object.keys(atEncounter)).not.toContain('activeEncounterNodeId');

    const encounterView = game.mapRun.getCurrentEncounter();
    expect(encounterView).toMatchObject({
      mapId: map.id,
      nodeId: entryEdge.toNodeId,
      title: map.nodes.find(node => node.id === entryEdge.toNodeId)?.encounter?.title,
      completion: { kind: 'manual', label: '完成调查' },
    });
    expect(Object.isFrozen(encounterView)).toBe(true);
    expect(Object.isFrozen(encounterView?.completion)).toBe(true);

    const exitEdge = map.edges.find(edge => edge.fromNodeId === atEncounter.currentNodeId);
    expect(exitEdge).toBeDefined();
    if (!exitEdge) throw new Error('Sample Encounter Node has no outgoing Edge');
    expect(() => commands.moveMap(started.runId, exitEdge.toNodeId)).toThrow();
    expect(game.mapRun.getSnapshot()).toEqual(atEncounter);

    const completed = commands.completeMapEncounter(started.runId);
    expect(completed).toMatchObject({
      currentNodeId: atEncounter.currentNodeId,
      activeEncounterNodeId: null,
      completedEncounterNodeIds: [atEncounter.currentNodeId],
    });
    expect(game.mapRun.getCurrentEncounter()).toBeNull();

    const exited = commands.moveMap(started.runId, exitEdge.toNodeId);
    expect(exited).toMatchObject({ currentNodeId: exitEdge.toNodeId, status: 'success' });
    commands.reset();
    expect(game.mapRun.getSnapshot()).toBeNull();
  });

  test('projects fresh, blocked, unavailable and same-Run preparation views without writing state', () => {
    const game = createGame();
    const commands = createGameCommands(game);
    const map = gameplayBMapDatapack.maps?.[0];
    const anotherMap = gameplayBMapDatapack.maps?.find(candidate => candidate.id !== map?.id);
    if (!map || !anotherMap) throw new Error('Gameplay B sample Maps are missing');
    acquireMapParty(game);

    const stateBeforeQuery = JSON.stringify(game.state);
    const fresh = game.mapRun.getEntryView(map.id);
    expect(fresh).toMatchObject({
      mapId: map.id,
      name: map.name,
      mode: 'fresh',
      partyMode: 'fixed',
      playerCost: map.initialPlayerCost,
      party: [
        { characterId: 'shiroko', admission: 'admitted', initialHp: map.initialPartyHp[0]?.initialHp },
        { characterId: 'serika', admission: 'admitted' },
      ],
    });
    expect(Object.isFrozen(fresh)).toBe(true);
    expect(Object.isFrozen(fresh.party)).toBe(true);
    expect(Object.isFrozen(fresh.party[0])).toBe(true);
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(JSON.stringify(game.state)).toBe(stateBeforeQuery);

    const started = commands.startMap(map.id);
    const runBeforeResumeQuery = JSON.stringify(game.mapRun.getSnapshot());
    const resumed = game.mapRun.getEntryView(map.id);
    expect(resumed).toMatchObject({
      mapId: map.id,
      mode: 'resume',
      progress: { runId: started.runId, currentNodeId: map.startNodeId },
      party: [
        { characterId: 'shiroko', variantId: started.party[0]?.variantId, currentHp: started.partyHp[0]?.currentHp, maxHp: map.initialPartyHp[0]?.maxHp },
        { characterId: 'serika', currentHp: started.partyHp[1]?.currentHp },
      ],
      playerCost: started.playerCost,
    });
    expect(game.mapRun.getSnapshot()).toEqual(started);
    expect(JSON.stringify(game.mapRun.getSnapshot())).toBe(runBeforeResumeQuery);

    const blocked = game.mapRun.getEntryView(anotherMap.id);
    expect(blocked).toMatchObject({ mode: 'blocked', reason: 'other-map-active', blockedByMapName: map.name });
    expect(game.mapRun.getSnapshot()).toEqual(started);
    expect(game.mapRun.getEntryView('missing:map')).toMatchObject({ mode: 'unavailable', reason: 'map-not-found' });
  });

  test('projects Enemy Hands and automatic targets as a read-only Runtime action view', () => {
    const sourceMap = gameplayBMapDatapack.maps?.find(candidate => candidate.id === 'gameplay-b:map:minimal-battle');
    if (!sourceMap) throw new Error('Minimal battle Map is missing');
    const enemyAction: GameplayMapActionDef = {
      id: 'enemy-autonomous-shot',
      name: '敌方自主射击',
      eligibleCharacterIds: [],
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
      tendencyRole: 'attack',
    };
    const datapack: Datapack = {
      ...gameplayBMapDatapack,
      maps: gameplayBMapDatapack.maps?.map(map => map.id !== sourceMap.id ? map : ({
        ...map,
        resumeVersion: map.resumeVersion + 1,
        actions: [...(map.actions ?? []), enemyAction],
        nodes: map.nodes.map(node => !node.encounter ? node : ({
          ...node,
          encounter: {
            ...node.encounter,
            enemies: node.encounter.enemies?.map(enemy => ({
              ...enemy,
              actions: [{ actionId: enemyAction.id, tendencyWeight: 1 }],
            })),
          },
        })),
      })) ?? [],
    };
    const game = createGame(datapack);
    const commands = createGameCommands(game);
    acquireMapParty(game);
    const started = commands.startMap(sourceMap.id);
    const map = game.registry.maps.get(sourceMap.id);
    if (!map) throw new Error('Minimal battle Map did not load');
    const edge = map.edges.find(candidate => candidate.fromNodeId === started.currentNodeId
      && map.nodes.find(node => node.id === candidate.toNodeId)?.encounter);
    if (!edge) throw new Error('Minimal battle has no Encounter edge');
    const entered = commands.moveMap(started.runId, edge.toNodeId);
    const view = game.mapRun.getWorkspaceView(started.runId);
    if (view?.kind !== 'active' || !view.actionPreview) throw new Error('Enemy Runtime Preview is missing');

    expect(view.actionPreview.preparedEnemyActions).toMatchObject([
      {
        enemyId: '训练靶',
        hand: [{ actionId: enemyAction.id, name: enemyAction.name }],
        naturalAction: { actionId: enemyAction.id },
        targetKind: 'partyCharacter',
        legalTargetCharacterIds: ['shiroko', 'serika'],
        targetCharacterId: 'shiroko',
        targetSelectionRequired: false,
      },
      {
        enemyId: '机动靶',
        naturalAction: { actionId: enemyAction.id },
        targetCharacterId: 'shiroko',
      },
    ]);
    expect(view.actionPreview.commitPreview.enemyActions).toMatchObject([
      { enemyId: '训练靶', action: { actionId: enemyAction.id, name: enemyAction.name }, targetCharacterId: 'shiroko' },
      { enemyId: '机动靶', action: { actionId: enemyAction.id }, targetCharacterId: 'shiroko' },
    ]);
    expect(Object.isFrozen(view.actionPreview.preparedEnemyActions)).toBe(true);
    expect(Object.isFrozen(view.actionPreview.preparedEnemyActions[0])).toBe(true);
    expect(game.mapRun.getSnapshot()?.activeEncounter).toEqual(entered.activeEncounter);

    commands.commitMapEncounterRound({
      runId: started.runId,
      requestId: 'enemy-runtime-receipt',
      expectedCommitVersion: entered.commitVersion,
      draft: view.actionPreview.draft,
    });
    const recent = game.mapRun.getWorkspaceView(started.runId);
    if (recent?.kind !== 'active' || !recent.actionPreview) throw new Error('Enemy Commit receipt View is missing');
    expect(recent.actionPreview.recentCommit?.enemyActions).toMatchObject([
      { enemyId: '训练靶', action: { actionId: enemyAction.id, name: enemyAction.name }, targetCharacterId: 'shiroko' },
      { enemyId: '机动靶', action: { actionId: enemyAction.id }, targetCharacterId: 'shiroko' },
    ]);
  });

  test('resumes on load, ignores legacy saves without MapRun, and clears its owner on init, reset, and dispose', () => {
    const game = createGame();
    const commands = createGameCommands(game);
    const mapId = gameplayBMapDatapack.maps?.[0]?.id;
    expect(mapId).toBeDefined();
    if (!mapId) throw new Error('Gameplay B sample Map ID is missing');

    acquireMapParty(game);

    commands.startMap(mapId);
    game.init([baseDatapack, gameplayBMapDatapack], { enterDefaultInit: false });
    expect(game.mapRun.getSnapshot()).toBeNull();

    const started = commands.startMap(mapId);
    const map = game.registry.maps.get(mapId);
    expect(map).toBeDefined();
    if (!map) throw new Error('Gameplay B sample Map was not loaded into Registry');
    const encounterEdge = map.edges.find(edge => edge.fromNodeId === started.currentNodeId
      && map.nodes.find(node => node.id === edge.toNodeId)?.encounter);
    expect(encounterEdge).toBeDefined();
    if (!encounterEdge) throw new Error('Sample Map start Node has no Encounter edge');
    const atEncounter = commands.moveMap(started.runId, encounterEdge.toNodeId);
    const checkpoint = game.save();
    game.load(checkpoint);
    expect(game.mapRun.getSnapshot()).toEqual(atEncounter);
    expect(game.mapRun.getSnapshot()).toMatchObject({
      runId: started.runId,
      mapId,
      currentNodeId: encounterEdge.toNodeId,
      visitedNodeIds: [started.currentNodeId, encounterEdge.toNodeId],
      activeEncounterNodeId: encounterEdge.toNodeId,
    });
    expect(game.mapRun.getSnapshot()?.activeEncounter?.hands).toEqual(atEncounter.activeEncounter?.hands);
    expect(checkpoint.mapRun?.run).not.toHaveProperty('activeEncounterNodeId');

    const activeEncounter = atEncounter.activeEncounter;
    const shirokoHand = activeEncounter?.hands.find(hand => hand.characterId === 'shiroko');
    const serikaHand = activeEncounter?.hands.find(hand => hand.characterId === 'serika');
    if (!activeEncounter || !shirokoHand || !serikaHand) throw new Error('Sample Encounter Hands are missing');
    const assistActionId = 'assist-teammate';
    let overrideCharacterId: 'shiroko' | 'serika';
    let overrideActionId: string;
    let targetCharacterId: 'shiroko' | 'serika';
    if (shirokoHand.actionIds[0] !== assistActionId) {
      overrideCharacterId = 'shiroko';
      overrideActionId = assistActionId;
      targetCharacterId = 'shiroko';
    } else if (serikaHand.actionIds[0] !== assistActionId) {
      overrideCharacterId = 'serika';
      overrideActionId = assistActionId;
      targetCharacterId = 'serika';
    } else {
      overrideCharacterId = 'shiroko';
      overrideActionId = shirokoHand.actionIds[1]!;
      targetCharacterId = 'serika';
    }
    const selectedTargetCharacterId = targetCharacterId === 'shiroko' ? 'serika' : 'shiroko';
    const draftedEncounter = {
      ...activeEncounter,
      overrides: [{
        kind: 'swap' as const,
        characterId: overrideCharacterId,
        actionId: overrideActionId,
      }],
      targetSelections: [{ characterId: targetCharacterId, targetCharacterId: selectedTargetCharacterId }],
      draftVersion: 1,
    };
    const savedRun = checkpoint.mapRun;
    expect(savedRun).toBeDefined();
    if (!savedRun) throw new Error('MapRun checkpoint is missing');
    const draftedCheckpoint = {
      ...checkpoint,
      mapRun: {
        ...savedRun,
        run: { ...savedRun.run, activeEncounter: draftedEncounter },
      },
    };
    game.load(draftedCheckpoint);
    expect(game.mapRun.getSnapshot()?.activeEncounter).toMatchObject({
      overrides: draftedEncounter.overrides,
      targetSelections: draftedEncounter.targetSelections,
      draftVersion: 1,
    });
    expect(game.save().mapRun?.run.activeEncounter).toMatchObject({
      overrides: draftedEncounter.overrides,
      targetSelections: draftedEncounter.targetSelections,
      draftVersion: 1,
    });
    game.load(checkpoint);

    const { mapRun: savedMapRun, ...legacySave } = checkpoint;
    void savedMapRun;
    game.load(legacySave);
    expect(game.mapRun.getSnapshot()).toBeNull();

    acquireMapParty(game);
    commands.startMap(mapId);
    commands.reset();
    expect(game.mapRun.getSnapshot()).toBeNull();

    acquireMapParty(game);
    commands.startMap(mapId);
    game.dispose();
    expect(game.mapRun.getSnapshot()).toBeNull();
  });

  test('roundtrips a PlayerCommand override and its party target through a saved checkpoint', () => {
    const { datapack, commandActionIds } = withHandOutPartyTargetActions();
    const game = createGame(datapack);
    const commands = createGameCommands(game);
    const mapId = gameplayBMapDatapack.maps?.[0]?.id;
    if (!mapId) throw new Error('Gameplay B sample Map ID is missing');
    const map = game.registry.maps.get(mapId);
    if (!map) throw new Error('Gameplay B sample Map was not loaded into Registry');

    const { shirokoVariantId, serikaVariantId } = acquireMapParty(game);
    const started = commands.startMap(mapId);
    const encounterEdge = map.edges.find(edge => edge.fromNodeId === started.currentNodeId
      && map.nodes.find(node => node.id === edge.toNodeId)?.encounter);
    if (!encounterEdge) throw new Error('Sample Map has no Encounter edge');
    const atEncounter = commands.moveMap(started.runId, encounterEdge.toNodeId);
    const activeEncounter = atEncounter.activeEncounter;
    const shirokoHand = activeEncounter?.hands.find(hand => hand.characterId === 'shiroko');
    if (!activeEncounter || !shirokoHand) throw new Error('Shiroko Encounter Hand is missing');

    const commandActionId = commandActionIds.find(actionId => !shirokoHand.actionIds.includes(actionId));
    if (!commandActionId) throw new Error('Expected a party-target Action outside Shiroko Hand');
    const draftedEncounter = {
      ...activeEncounter,
      overrides: [{ kind: 'playerCommand' as const, characterId: 'shiroko', actionId: commandActionId }],
      targetSelections: [{ characterId: 'shiroko', targetCharacterId: 'serika' }],
      draftVersion: 1,
    };
    const checkpoint = game.save();
    const mapRunCheckpoint = checkpoint.mapRun;
    if (!mapRunCheckpoint) throw new Error('MapRun checkpoint is missing');
    game.load({
      ...checkpoint,
      mapRun: {
        ...mapRunCheckpoint,
        run: { ...mapRunCheckpoint.run, activeEncounter: draftedEncounter },
      },
    });
    const savedAfterLoad = game.save();
    game.load(savedAfterLoad);

    const restored = game.mapRun.getSnapshot();
    const restoredEncounter = restored?.activeEncounter;
    if (!restored || !restoredEncounter) throw new Error('PlayerCommand checkpoint did not restore an active Encounter');
    const preview = resolveGameplayBActionPreview({
      definition: map,
      encounter: restoredEncounter,
      party: restored.party,
      playerCost: restored.playerCost,
      actorResources: restored.actorResources,
      teamResources: restored.teamResources,
    });
    expect(restored.party).toEqual([
      { characterId: 'shiroko', variantId: shirokoVariantId },
      { characterId: 'serika', variantId: serikaVariantId },
    ]);
    expect(restoredEncounter.overrides).toEqual([
      { kind: 'playerCommand', characterId: 'shiroko', actionId: commandActionId },
    ]);
    expect(restoredEncounter.targetSelections).toEqual([
      { characterId: 'shiroko', targetCharacterId: 'serika' },
    ]);
    expect(preview.preparedActions.find(row => row.characterId === 'shiroko')).toMatchObject({
      preparedActionId: commandActionId,
      targetKind: 'partyCharacter',
      targetCharacterId: 'serika',
      overrideKind: 'playerCommand',
      playerCost: 1,
    });
    expect(preview.playerCommandOptions.find(row => row.characterId === 'shiroko' && row.actionId === commandActionId))
      .toMatchObject({ playerCost: 1, canPayPlayerCost: true, canPayActionCosts: true });
    expect(restored.playerCost).toBe(map.initialPlayerCost);
    expect(restored.actorResources).toEqual(atEncounter.actorResources);
    expect(restored.teamResources).toEqual(atEncounter.teamResources);
    expect(restored.activeEncounter?.hands).toEqual(atEncounter.activeEncounter?.hands);
    expect(restored.activeEncounter?.round).toBe(atEncounter.activeEncounter?.round);
    expect(restored.activeEncounter?.randomState).toEqual(atEncounter.activeEncounter?.randomState);
    expect(game.save().mapRun?.run).toMatchObject({ playerCost: map.initialPlayerCost });
    expect(game.save().mapRun?.run.activeEncounter?.overrides).toEqual(draftedEncounter.overrides);
  });

  test('routes full-round Commit through GameCommands and preserves its receipt across save and retry', () => {
    const game = createGame();
    const commands = createGameCommands(game);
    const mapId = gameplayBMapDatapack.maps?.[0]?.id;
    if (!mapId) throw new Error('Gameplay B sample Map ID is missing');
    const map = game.registry.maps.get(mapId);
    if (!map) throw new Error('Gameplay B sample Map was not loaded into Registry');
    acquireMapParty(game);

    const started = commands.startMap(mapId);
    const encounterEdge = map.edges.find(edge => edge.fromNodeId === started.currentNodeId
      && map.nodes.find(node => node.id === edge.toNodeId)?.encounter);
    if (!encounterEdge) throw new Error('Sample Map has no Encounter edge');
    const entered = commands.moveMap(started.runId, encounterEdge.toNodeId);
    const sourceEncounter = entered.activeEncounter;
    if (!sourceEncounter) throw new Error('Sample Map Encounter is missing');
    const actionsById = new Map((map.actions ?? []).map(action => [action.id, action]));
    const assistFirstForBoth = sourceEncounter.hands.every(hand => hand.actionIds[0] === 'assist-teammate');
    const override = assistFirstForBoth
      ? { kind: 'swap' as const, characterId: 'shiroko', actionId: 'inspect-site' }
      : null;
    const targetSelections = sourceEncounter.hands.flatMap(hand => {
      const actionId = override?.characterId === hand.characterId ? override.actionId : hand.actionIds[0];
      const action = actionId ? actionsById.get(actionId) : undefined;
      if (action?.target.kind !== 'partyCharacter') return [];
      const targetCharacterId = entered.party.find(member => member.characterId !== hand.characterId)?.characterId;
      if (!targetCharacterId) throw new Error('Sample Map target action has no other party member');
      return [{ characterId: hand.characterId, targetCharacterId }];
    });
    const patchedEncounter = {
      ...sourceEncounter,
      overrides: override ? [override] : [],
      targetSelections,
      draftVersion: sourceEncounter.draftVersion + 1,
    };
    const beforeDraftSave = game.save();
    const savedRun = beforeDraftSave.mapRun;
    if (!savedRun) throw new Error('MapRun checkpoint is missing');
    commands.load({
      ...beforeDraftSave,
      mapRun: { ...savedRun, run: { ...savedRun.run, activeEncounter: patchedEncounter } },
    });
    const preparedRun = game.mapRun.getSnapshot();
    const preparedEncounter = preparedRun?.activeEncounter;
    if (!preparedRun || !preparedEncounter) throw new Error('Prepared Encounter did not restore');
    const preview = resolveGameplayBActionPreview({
      definition: map,
      encounter: preparedEncounter,
      party: preparedRun.party,
      playerCost: preparedRun.playerCost,
      actorResources: preparedRun.actorResources,
      teamResources: preparedRun.teamResources,
    });
    expect(preview.preparedActions.every(action => !action.targetSelectionRequired)).toBe(true);

    const command = {
      runId: preparedRun.runId,
      requestId: 'runtime-round-commit-1',
      expectedCommitVersion: preparedRun.commitVersion,
      draft: {
        nodeId: preparedEncounter.nodeId,
        round: preparedEncounter.round,
        draftVersion: preparedEncounter.draftVersion,
      },
    };
    const stateBeforeCommit = JSON.stringify(game.state);
    const committed = commands.commitMapEncounterRound(command);
    expect(committed.commitVersion).toBe(preparedRun.commitVersion + 1);
    expect(committed.activeEncounter?.round).toBe(preparedEncounter.round + 1);
    expect(committed.activeEncounter?.lastCommit?.settlements.map(row => row.characterId))
      .toEqual(preparedRun.party.map(member => member.characterId));
    expect(committed.activeEncounter?.lastCommit?.settlements.map(row => row.actionId))
      .toEqual(preview.preparedActions.map(row => row.preparedActionId));
    expect(JSON.stringify(game.state)).toBe(stateBeforeCommit);

    const afterSaveLoad = game.save();
    commands.load(afterSaveLoad);
    const beforeRetry = game.mapRun.getSnapshot();
    expect(beforeRetry?.activeEncounter?.lastCommit?.requestId).toBe(command.requestId);
    expect(commands.commitMapEncounterRound(command)).toEqual(beforeRetry);
    expect(game.mapRun.getSnapshot()).toEqual(beforeRetry);
    expect(JSON.stringify(game.state)).toBe(stateBeforeCommit);
  });
});
