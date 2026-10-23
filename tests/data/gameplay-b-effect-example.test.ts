import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GAMEPLAY_B_EFFECT_PROGRAM_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-effect-program-example';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import type { MapRun, MapRunEncounterDraftToken } from '../../src/arona-clicker/contracts/map/map-run';
import { Registry } from '../../src/data-services/registry/registry';

function draftOf(run: MapRun): MapRunEncounterDraftToken {
  const encounter = run.activeEncounter;
  if (!encounter) throw new Error('Expected an active example Encounter');
  return {
    nodeId: encounter.nodeId,
    ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
    round: encounter.round,
    draftVersion: encounter.draftVersion,
  };
}

function commitRound(owner: MapRunService, run: MapRun): MapRun {
  const preview = owner.previewEncounterCommit(run.runId);
  expect(preview?.canCommit, preview?.diagnostics.join('; ')).toBe(true);
  return owner.commitEncounterRound({
    runId: run.runId,
    requestId: `example-round-${run.commitVersion + 1}`,
    expectedCommitVersion: run.commitVersion,
    draft: draftOf(run),
  });
}

describe('Gameplay B E1 author example', () => {
  test('loads through the optional bundle, targets a real Hand CardRef, and completes ordered activities in one Owner', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);

    const map = registry.maps.get(GAMEPLAY_B_EFFECT_PROGRAM_EXAMPLE_MAP_ID);
    expect(map).toBeDefined();
    expect(map?.resumeVersion).toBe(4);
    expect(map?.nodes.find(node => node.id === 'range')?.activities?.map(activity => activity.id))
      .toEqual(['opening-shot', 'card-range', 'cover-range', 'triage', 'talk']);
    const mapEntry = registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities?.find(
      functionality => functionality.kind === 'mapEntry' && functionality.mapId === GAMEPLAY_B_EFFECT_PROGRAM_EXAMPLE_MAP_ID,
    );
    expect(mapEntry?.kind).toBe('mapEntry');

    const resolver = createRegistryMapContentResolver(registry);
    expect(resolver.resolve(GAMEPLAY_B_EFFECT_PROGRAM_EXAMPLE_MAP_ID)).toBe(map);
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const owner = new MapRunService(resolver, resolveCharacterIdForVariant);
    let run = owner.start(GAMEPLAY_B_EFFECT_PROGRAM_EXAMPLE_MAP_ID, [
      ...map!.partyCharacterIds.map(characterId => {
        const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
        if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
        return { characterId, variantId: variant.id };
      }),
    ]);
    expect(run.activeEncounter?.activityId).toBe('opening-shot');
    run = commitRound(owner, run);
    expect(run.activeActivity?.activityId).toBe('card-range');
    expect(run.actorResources.find(balance => balance.characterId === 'serika' && balance.resourceId === 'sCost')?.value).toBe(1);

    const shotCard = owner.getCards(run.runId).find(card => card.zone === 'hand'
      && card.owner.kind === 'partyCharacter' && card.owner.id === 'serika'
      && card.actionId === 'precision-shot');
    expect(shotCard).toBeDefined();
    expect(owner.resolveCardReference(shotCard!.ref)).toMatchObject({ actionId: 'precision-shot', zone: 'hand' });
    run = owner.setPreparedCardTarget(run.runId, 'shiroko', shotCard!.ref, draftOf(run));
    const cardPreview = owner.previewEncounterCommit(run.runId)!;
    expect(cardPreview.canCommit).toBe(true);
    expect(cardPreview.effectTrace).toContainEqual(expect.objectContaining({
      op: 'discountSCost', actionId: 'prepare-shot', amount: 1, targetCard: shotCard!.ref,
    }));
    run = commitRound(owner, run);
    expect(run.activeActivity?.activityId).toBe('cover-range');
    expect(run.actorResources.find(balance => balance.characterId === 'serika' && balance.resourceId === 'sCost')?.value).toBe(1);

    run = commitRound(owner, run);
    expect(run.activeEncounter?.enemies[0]?.currentHp).toBe(2);
    expect(run.actorResources.find(balance => balance.characterId === 'shiroko' && balance.resourceId === 'ammo')?.value).toBe(0);
    expect(run.actorResources.find(balance => balance.characterId === 'serika' && balance.resourceId === 'ammo')?.value).toBe(1);
    run = commitRound(owner, run);
    expect(run.activeActivity?.activityId).toBe('triage');

    run = commitRound(owner, run);
    expect(run.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 7 },
      { characterId: 'serika', currentHp: 8 },
    ]);
    expect(run.teamResources.find(balance => balance.resourceId === 'field-medkits')?.value).toBe(1);
    expect(run.activeActivity?.activityId).toBe('talk');

    run = commitRound(owner, run);
    expect(run.activeEncounter?.locals?.counters.trust?.value).toBe(2);
    run = commitRound(owner, run);
    const trustDeltas = run.lastEncounterCommit?.effectTrace?.flatMap(visit =>
      visit.op === 'counterAdd' && visit.actionId === 'negotiate' ? [visit.delta] : [],
    );
    expect(trustDeltas).toEqual([1, 0]);
    expect(run.lastEncounterCommit?.plannedLocals?.counters.trust?.value).toBe(3);
    expect(run.activeEncounter).toBeNull();
    expect(run.completedActivityIds).toContain('range/talk');
    expect(run.teamResources.find(balance => balance.resourceId === 'field-reports')?.value).toBe(4);
  });
});
