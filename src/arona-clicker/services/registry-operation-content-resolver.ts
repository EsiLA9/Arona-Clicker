import type { Registry } from '../../data-services/registry/registry';
import type { OperationContentResolver, OperationResolvedContent } from '../contracts/operation-content-resolver';
import type { OperationEventDef } from '../contracts/operation';

/**
 * Adapts the checked Datapack tables into the detached DTO consumed by participant admission.
 * It holds a Registry reference, so it can be created before packs are loaded.
 */
export function createRegistryOperationContentResolver(
  registry: Pick<Registry, 'operationEvents' | 'operationLocations' | 'operationActions' | 'studentOperationProfiles' | 'operationStrategyProfiles' | 'operationCardPools'>,
): OperationContentResolver {
  return Object.freeze({
    resolve(eventId: string): OperationResolvedContent | null {
      const event = registry.operationEvents.get(eventId);
      if (!event) return null;

      const locations = event.locationIds.map(id => registry.operationLocations.get(id));
      if (locations.some(location => location === undefined)) return null;
      const resolvedLocations = locations.filter((location): location is NonNullable<typeof location> => location !== undefined);

      const profileIds = new Set(
        event.participants
          .filter((participant): participant is Extract<typeof participant, { kind: 'student' }> => participant.kind === 'student')
          .flatMap(participant => participant.profileId ? [participant.profileId] : []),
      );
      const availableActionIds = new Set<string>();
      for (const participant of event.participants) {
        if (participant.kind !== 'student') participant.candidateActionIds.forEach(id => availableActionIds.add(id));
      }
      for (const location of resolvedLocations) {
        location.enabledActionIds.forEach(id => availableActionIds.add(id));
        location.sceneActions?.forEach(action => availableActionIds.add(action.actionId));
      }
      const availablePoolIds = new Set(event.cardPoolIds ?? []);
      for (const location of resolvedLocations) location.cardPoolIds?.forEach(id => availablePoolIds.add(id));
      for (const poolId of availablePoolIds) {
        const pool = registry.operationCardPools.get(poolId);
        if (!pool) return null;
        pool.entries.forEach(entry => availableActionIds.add(entry.actionId));
      }
      event.playerSceneDeck?.cards.forEach(card => availableActionIds.add(card.actionId));
      event.studentSkillRules?.forEach(rule => rule.triggerActionIds.forEach(id => availableActionIds.add(id)));

      const profiles = [...registry.studentOperationProfiles.values()].filter(profile =>
        profileIds.has(profile.id)
        || (event.participants.some(participant => participant.kind === 'student' && participant.profileId === undefined)
          && profile.candidateActionIds.every(actionId => availableActionIds.has(actionId))),
      );
      for (const profile of profiles) {
        profile.candidateActionIds.forEach(id => availableActionIds.add(id));
      }

      for (const profile of profiles) profile.cardPoolIds?.forEach(id => availablePoolIds.add(id));
      const operationCardPools = [...availablePoolIds].map(id => registry.operationCardPools.get(id));
      if (operationCardPools.some(pool => pool === undefined)) return null;
      for (const pool of operationCardPools) pool?.entries.forEach(entry => availableActionIds.add(entry.actionId));

      const availableStrategyProfileIds = new Set(profiles.flatMap(profile => profile.strategyProfileId ? [profile.strategyProfileId] : []));
      const operationStrategyProfiles = [...availableStrategyProfileIds].map(id => registry.operationStrategyProfiles.get(id));
      if (operationStrategyProfiles.some(profile => profile === undefined)) return null;

      const actionDefinitions = [...availableActionIds].map(id => registry.operationActions.get(id));
      if (actionDefinitions.some(action => action === undefined)) return null;

      const {
        locationIds: _locationIds,
        participants: _participants,
        studentSkillRules,
        ...runtimeEvent
      } = event;
      const eventDefinition: OperationEventDef = {
        ...runtimeEvent,
        locations: resolvedLocations,
      };
      return {
        eventDefinition,
        participants: event.participants,
        studentProfiles: profiles,
        actionDefinitions: actionDefinitions.filter((action): action is NonNullable<typeof action> => action !== undefined),
        studentSkillRules: studentSkillRules ?? [],
        operationCardPools: operationCardPools.filter((pool): pool is NonNullable<typeof pool> => pool !== undefined),
        operationStrategyProfiles: operationStrategyProfiles.filter((profile): profile is NonNullable<typeof profile> => profile !== undefined),
      };
    },
  });
}
