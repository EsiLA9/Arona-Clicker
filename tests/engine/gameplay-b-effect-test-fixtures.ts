import { vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { MapRunEncounterCommitCommand, MapRunEncounterDraftToken } from '../../src/arona-clicker/contracts/map/map-run';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { GameplayEncounterDef, GameplayMapActionDef, GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';

export const LEGACY_GOLDEN_ITEM_ID = 'test:item:legacy-kit';

export interface LegacyGoldenMapOptions {
  readonly id: string;
  readonly partyCharacterIds?: readonly string[];
  readonly partyHp?: Readonly<Record<string, number>>;
  readonly playerCost?: number;
  readonly actions: readonly GameplayMapActionDef[];
  readonly participants: NonNullable<GameplayEncounterDef['participants']>;
  readonly enemies?: NonNullable<GameplayEncounterDef['enemies']>;
  readonly actorResources?: NonNullable<GameplayMapDef['initialActorResources']>;
  readonly teamResources?: NonNullable<GameplayMapDef['initialTeamResources']>;
  readonly enemyTeamResources?: NonNullable<GameplayEncounterDef['initialEnemyTeamResources']>;
  readonly abilityActionIds?: NonNullable<GameplayEncounterDef['abilityActionIds']>;
  readonly itemActions?: NonNullable<GameplayEncounterDef['itemActions']>;
  readonly itemCount?: number;
}

export interface LegacyGoldenOwner {
  readonly game: GameInstance;
  readonly runId: string;
}

export function legacyGoldenMap(options: LegacyGoldenMapOptions): GameplayMapDef {
  const partyCharacterIds = [...(options.partyCharacterIds ?? ['shiroko', 'serika'])];
  const enemyFields = {
    ...(options.enemies === undefined ? {} : { enemies: [...options.enemies] }),
    ...(options.enemyTeamResources === undefined ? {} : { initialEnemyTeamResources: [...options.enemyTeamResources] }),
    ...(options.abilityActionIds === undefined ? {} : { abilityActionIds: [...options.abilityActionIds] }),
    ...(options.itemActions === undefined ? {} : { itemActions: [...options.itemActions] }),
  };
  return {
    id: options.id,
    name: 'Legacy Effect Golden',
    resumeVersion: 1,
    startNodeId: 'start',
    exitNodeIds: ['exit'],
    partyCharacterIds,
    initialPartyHp: partyCharacterIds.map(characterId => ({
      characterId,
      initialHp: options.partyHp?.[characterId] ?? 10,
      maxHp: 10,
    })),
    initialPlayerCost: options.playerCost ?? 4,
    actions: [...options.actions],
    ...(options.actorResources === undefined ? {} : { initialActorResources: [...options.actorResources] }),
    ...(options.teamResources === undefined ? {} : { initialTeamResources: [...options.teamResources] }),
    nodes: [
      { id: 'start', title: 'Start' },
      { id: 'battle', title: 'Battle', encounter: {
        title: 'Legacy Golden Encounter',
        ...(options.enemies?.length ? {} : { completion: { kind: 'manual' as const, label: 'Complete' } }),
        ...enemyFields,
        participants: [...options.participants],
      } },
      { id: 'exit', title: 'Exit' },
    ],
    edges: [
      { fromNodeId: 'start', toNodeId: 'battle' },
      { fromNodeId: 'battle', toNodeId: 'exit' },
    ],
  };
}

function datapackFor(map: GameplayMapDef, itemCount: number): Datapack {
  return {
    ...gameplayBMapDatapack,
    spots: gameplayBMapDatapack.spots.map(spot => ({
      ...spot,
      functionalities: (spot.functionalities ?? []).filter(functionality =>
        functionality.kind !== 'mapEntry' || functionality.mapId === map.id),
    })),
    maps: [map],
    ...(itemCount > 0 ? { items: [
      ...(gameplayBMapDatapack.items ?? []),
      {
        id: LEGACY_GOLDEN_ITEM_ID,
        name: 'Legacy Golden Kit',
        description: 'Fixture consumable for the MapRun Owner path.',
        maxStack: 3,
        rarity: 'common',
        type: 'consumable',
      },
    ] } : {}),
  };
}

export function createLegacyGoldenRuntime(map: GameplayMapDef, itemCount = 0): GameInstance {
  const game = new GameInstance();
  game.init([baseDatapack, datapackFor(map, itemCount)], { enterDefaultInit: false });
  for (const characterId of map.partyCharacterIds) {
    const variant = game.rosterSystem.getAllVariants().find(candidate => candidate.proto === characterId);
    if (!variant) throw new Error(`Base Datapack has no Variant for ${characterId}`);
    game.mutations.acquireCharacter(variant.id, 'story');
  }
  return game;
}

export function createLegacyGoldenOwner(map: GameplayMapDef, itemCount = 0): LegacyGoldenOwner {
  const game = createLegacyGoldenRuntime(map, itemCount);

  // Only Encounter creation uses Math.random for its seed; real Owner draw and
  // subsequent previews use the persisted seed/cursor from this fixed point.
  const seedSource = vi.spyOn(Math, 'random').mockReturnValue(0.03125);
  try {
    const started = game.startMap(map.id);
    const edge = map.edges.find(candidate => candidate.fromNodeId === started.currentNodeId
      && map.nodes.find(node => node.id === candidate.toNodeId)?.encounter);
    if (!edge) throw new Error('Legacy golden Map has no reachable Encounter');
    const entered = game.moveMap(started.runId, edge.toNodeId);
    if (!entered.activeEncounter) throw new Error('Map Owner did not open the Encounter');
    if (entered.activeEncounter.randomState.seed !== 0x08000000) throw new Error('Fixed Encounter seed was not installed');
    return { game, runId: started.runId };
  } catch (error) {
    game.dispose();
    throw error;
  } finally {
    seedSource.mockRestore();
  }
}

export function draftToken(game: GameInstance, runId: string): MapRunEncounterDraftToken {
  const encounter = game.mapRun.getSnapshot()?.activeEncounter;
  if (!encounter) throw new Error('Legacy golden Encounter is missing');
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

export function commitCommand(game: GameInstance, runId: string, requestId: string): MapRunEncounterCommitCommand {
  const run = game.mapRun.getSnapshot();
  if (!run) throw new Error('Legacy golden MapRun is missing');
  return { runId, requestId, expectedCommitVersion: run.commitVersion, draft: draftToken(game, runId) };
}
