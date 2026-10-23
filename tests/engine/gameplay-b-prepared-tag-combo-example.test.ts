import { describe, expect, test } from 'vitest';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { gameplayBPreparedTagComboExampleMap, GAMEPLAY_B_PREPARED_TAG_COMBO_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-prepared-tag-combo-example';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { validateMapEffectCommitReceipt } from '../../src/arona-clicker/services/map/map-effect-receipt-validator';
import { Registry } from '../../src/data-services/registry/registry';
import { tagRef } from '../../src/engine/core/tag';

function serviceFor(map: GameplayMapDef): MapRunService {
  return new MapRunService({ resolve: id => id === map.id ? map : null }, variantId => variantId);
}

function openBattle(map: GameplayMapDef) {
  const service = serviceFor(map);
  const party = map.partyCharacterIds.map(characterId => ({ characterId, variantId: characterId }));
  const started = service.start(map.id, party);
  const entered = service.move(started.runId, 'battle');
  if (!entered.activeEncounter) throw new Error('Prepared Tag example did not open its Encounter');
  return { service, runId: started.runId };
}

function commit(service: MapRunService, runId: string, requestId: string) {
  const before = service.getSnapshot();
  const encounter = before?.activeEncounter;
  if (!before || !encounter) throw new Error('Expected an active Prepared Tag Encounter');
  return service.commitEncounterRound({
    runId,
    requestId,
    expectedCommitVersion: before.commitVersion,
    draft: { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion },
  });
}

describe('Gameplay B Prepared Tag combo author example', () => {
  test('registers an enterable Map and commits ordered 2+1 damage with a replayable frozen count', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registered = registry.maps.get(GAMEPLAY_B_PREPARED_TAG_COMBO_MAP_ID);
    expect(registered).toEqual(gameplayBPreparedTagComboExampleMap);
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_PREPARED_TAG_COMBO_MAP_ID, mapEntryLabel: '进入爆破连携演练',
    }));

    const { service, runId } = openBattle(registered!);
    const preview = service.previewEncounterCommit(runId);
    expect(preview).toMatchObject({ canCommit: true, diagnostics: [] });
    expect(preview?.effectTrace?.find(row => row.op === 'when')).toMatchObject({
      result: true,
      reads: [{ op: 'preparedTagCount', side: 'party', tag: 'gameplay-b:action/explosive', count: 2,
        comparison: 'gte', value: 2, result: true }],
    });
    expect(preview?.effectTrace?.filter(row => row.actionId === 'combo-shot' && row.op === 'damage'))
      .toMatchObject([{ amount: 2 }, { amount: 1 }]);

    const committed = commit(service, runId, 'prepared-tag-combo-two-cards');
    const receipt = committed.lastEncounterCommit;
    const active = committed.activeEncounter;
    const encounterDef = registered!.nodes.find(node => node.id === 'battle')?.encounter;
    if (!receipt || !active || !encounterDef) throw new Error('Commit did not retain its Prepared Tag receipt');
    expect(active.enemies).toEqual([{ enemyId: 'training-target', currentHp: 5 }]);
    const validationContext = {
      runId, map: registered!, encounter: encounterDef,
      currentEncounter: { ...active, partyHp: committed.partyHp },
    };
    expect(validateMapEffectCommitReceipt(receipt, validationContext)).toEqual({ ok: true, errors: [] });

    const forged = structuredClone(receipt) as any;
    forged.effectTrace.find((row: any) => row.op === 'when').reads[0].count = 1;
    expect(validateMapEffectCommitReceipt(forged, validationContext).ok).toBe(false);
  });

  test('does not append the follow-up hit when only one Party Action is prepared', () => {
    const oneTagMap: GameplayMapDef = {
      ...gameplayBPreparedTagComboExampleMap,
      nodes: gameplayBPreparedTagComboExampleMap.nodes.map(node => node.id !== 'battle' || !node.encounter ? node : {
        ...node,
        encounter: { ...node.encounter, participants: node.encounter.participants?.map(participant => participant.characterId === 'serika'
          ? { ...participant, actions: [] }
          : participant) },
      }),
    };
    const { service, runId } = openBattle(oneTagMap);
    const preview = service.previewEncounterCommit(runId);
    expect(preview?.effectTrace?.find(row => row.op === 'when')).toMatchObject({
      result: false, reads: [{ op: 'preparedTagCount', count: 1, result: false }],
    });
    expect(preview?.effectTrace?.filter(row => row.actionId === 'combo-shot' && row.op === 'damage'))
      .toMatchObject([{ amount: 2 }]);

    const committed = commit(service, runId, 'prepared-tag-combo-one-card');
    expect(committed.activeEncounter?.enemies).toEqual([{ enemyId: 'training-target', currentHp: 8 }]);
  });

  test('counts a selected PlayerCommand but not the other unselected command offers', () => {
    const explosiveTag = tagRef('gameplay-b', ['action', 'explosive']);
    const commandActions = Array.from({ length: 5 }, (_, index) => ({
      id: `command-blast-${index + 1}`,
      name: `Command Blast ${index + 1}`,
      tags: [explosiveTag],
      eligibleCharacterIds: ['serika'] as const,
      target: { kind: 'none' as const },
    }));
    const definition: GameplayMapDef = {
      ...gameplayBPreparedTagComboExampleMap,
      initialPlayerCost: 1,
      actions: [...(gameplayBPreparedTagComboExampleMap.actions ?? []), ...commandActions],
      nodes: gameplayBPreparedTagComboExampleMap.nodes.map(node => node.id !== 'battle' || !node.encounter ? node : {
        ...node,
        encounter: { ...node.encounter, participants: node.encounter.participants?.map(participant => participant.characterId === 'serika'
          ? { ...participant, actions: [
            { actionId: 'partner-blast', tendencyWeight: 1 },
            ...commandActions.map(action => ({ actionId: action.id, tendencyWeight: 1 })),
          ] }
          : participant) },
      }),
    };
    const { service, runId } = openBattle(definition);
    const before = service.previewActions(runId);
    const option = before?.playerCommandOptions.find(row => row.characterId === 'serika');
    expect(option).toBeDefined();
    const active = service.getSnapshot()?.activeEncounter;
    if (!active || !option) throw new Error('Expected an unselected PlayerCommand option');
    service.issuePlayerCommand(runId, 'serika', option.actionId, {
      nodeId: active.nodeId, round: active.round, draftVersion: active.draftVersion,
    });
    const selected = service.previewActions(runId)?.preparedActions.find(row => row.characterId === 'serika');
    expect(selected).toMatchObject({ preparedActionId: option.actionId, overrideKind: 'playerCommand' });

    const preview = service.previewEncounterCommit(runId);
    expect(preview?.effectTrace?.find(row => row.op === 'when')).toMatchObject({
      result: true,
      reads: [{ op: 'preparedTagCount', count: 2, comparison: 'gte', value: 2, result: true }],
    });
  });
});
