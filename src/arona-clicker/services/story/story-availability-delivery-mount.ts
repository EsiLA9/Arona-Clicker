import type { Registry } from '../../../data-services/registry/registry';
import { ConditionSystem } from '../../../engine/expression/condition-system';
import { EventBus } from '../../../engine/core/event-bus';
import type { PlayerState } from '../../types/state';

export type CreateAvailableStoryDelivery = (
  storyEntryId: string,
  areaId: string,
  sourceId: string,
) => boolean;

/**
 * Turns Story-page-only ActiveStoryEntry availability into durable Area offers.
 * The first Area where an entry is eligible owns its delivery for this Init.
 */
export class StoryAvailabilityDeliveryMount {
  private currentInitId: string | null = null;

  constructor(
    private readonly registry: Registry,
    private readonly conditionSystem: ConditionSystem,
    eventBus: EventBus,
    private readonly getState: () => PlayerState,
    private readonly entryIds: readonly string[],
    private readonly createDelivery: CreateAvailableStoryDelivery,
  ) {
    eventBus.on('storyCompleted', () => this.reconcileCurrentArea());
    eventBus.on('areaEntered', () => this.reconcileCurrentArea());
  }

  mountForInit(initId: string): void {
    this.currentInitId = initId;
  }

  unmountAll(): void {
    this.currentInitId = null;
  }

  /** Called after Init entry and after any event that may change entry eligibility. */
  reconcileCurrentArea(): void {
    const state = this.getState();
    const initId = this.currentInitId;
    const areaId = state.currentAreaId;
    if (!initId || state.activeInit !== initId || !areaId) return;

    const area = this.registry.areas.get(areaId);
    if (!area || area.initId !== initId) return;

    for (const entryId of this.entryIds) {
      const entry = this.registry.activeStories.get(entryId);
      const story = entry ? this.registry.stories.get(entry.storyId) : undefined;
      if (!entry || !story || story.nodes.length === 0) continue;
      if (entry.availableInits.length > 0 && !entry.availableInits.includes(initId)) continue;
      if (state.storyLog.some(completed => completed.storyId === entry.storyId)) continue;
      if (entry.triggerCondition && !this.conditionSystem.evaluateGroup(entry.triggerCondition, state)) continue;
      if (state.areaStoryDeliveries?.some(delivery => delivery.entryId === entry.id)) continue;

      this.createDelivery(entry.id, areaId, `story-availability:${entry.id}`);
    }
  }
}
