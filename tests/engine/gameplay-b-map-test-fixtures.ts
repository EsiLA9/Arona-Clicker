import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { GameplayMapDef, GameplayMapNodeDef } from '../../src/data-services/contracts/gameplay-map';

/**
 * Sample Map fixtures for MapRun tests.
 *
 * The sample Map keeps growing (extra Nodes, Actions and condition-based Encounter completion).
 * These helpers keep single-purpose fixtures consistent without weakening the authoring rules
 * they are supposed to exercise.
 */

/** Encounter Action references declared by a Node, including enemies, Ability and Item sources. */
function referencedActionIds(node: GameplayMapNodeDef): string[] {
  const encounter = node.encounter;
  if (!encounter) return [];
  return [
    ...(encounter.participants ?? []).flatMap(participant => (participant.actions ?? []).map(candidate => candidate.actionId)),
    ...(encounter.enemies ?? []).flatMap(enemy => (enemy.actions ?? []).map(candidate => candidate.actionId)),
    ...(encounter.abilityActionIds ?? []),
    ...(encounter.itemActions ?? []).map(item => item.actionId),
  ];
}

/**
 * Derived fixtures replace the Map-local `actions`, Team resources or MapRun facts. Encounters and
 * Edges inherited from the sample Map may still cite removed entries, which the Registry rejects as
 * an authoring error. Drop only the now-unresolvable references so the derived Map stays legal.
 */
export function withoutDanglingEncounters(map: GameplayMapDef): GameplayMapDef {
  const actionIds = new Set((map.actions ?? []).map(action => action.id));
  const teamResourceIds = new Set((map.initialTeamResources ?? []).map(row => row.resourceId));
  const counterIds = new Set((map.mapRunFacts?.counters ?? []).map(row => row.id));
  const flagIds = new Set((map.mapRunFacts?.flags ?? []).map(row => row.id));
  const resolvable = (condition: GameplayMapDef['edges'][number]['condition']): boolean => {
    if (!condition) return true;
    if (condition.kind === 'teamResourceAtLeast') return teamResourceIds.has(condition.resourceId);
    if (condition.kind === 'counter') return counterIds.has(condition.counterId);
    return flagIds.has(condition.flagId);
  };
  return {
    ...map,
    nodes: map.nodes.map(node => {
      if (referencedActionIds(node).every(id => actionIds.has(id))) return node;
      const { encounter: _dropped, ...rest } = node;
      void _dropped;
      return rest;
    }),
    edges: map.edges.filter(edge => resolvable(edge.condition)),
  };
}

/**
 * The sample Encounter now completes through a MapRun Counter condition. Tests that only need
 * "an Encounter that can be completed on demand" override the completion instead of replaying
 * three Clue-earning Actions that are irrelevant to what they assert.
 */
export function withManualEncounterCompletion(map: GameplayMapDef, label = '完成调查'): GameplayMapDef {
  return {
    ...map,
    nodes: map.nodes.map(node => node.encounter
      ? { ...node, encounter: { ...node.encounter, completion: { kind: 'manual' as const, label } } }
      : node),
  };
}

/** Replace the sample Map inside a Datapack, keeping every other entry untouched. */
export function withMap(datapack: Datapack, map: GameplayMapDef): Datapack {
  return {
    ...datapack,
    maps: (datapack.maps ?? []).map(candidate => candidate.id === map.id ? map : candidate),
  };
}
