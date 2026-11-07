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
 * Turns explicitly configured ActiveStoryEntry availability into durable Area offers.
 * The configured fallback selects the current or fixed Area in the active Init.
 */
export class StoryAvailabilityDeliveryMount {
  private currentInitId: string | null = null;

  constructor(
    private readonly registry: Registry,
    private readonly conditionSystem: ConditionSystem,
    eventBus: EventBus,
    private readonly getState: () => PlayerState,
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
    const currentAreaId = state.currentAreaId;
    if (!initId || state.activeInit !== initId || !currentAreaId) return;

    for (const entry of this.registry.activeStories.values()) {
      const fallback = entry.activation.fallback;
      if (!fallback) continue;
      const areaId = fallback.kind === 'fixed-area' ? fallback.areaId : currentAreaId;
      const area = this.registry.areas.get(areaId);
      if (!area || area.initId !== initId) continue;
      const story = this.registry.stories.get(entry.storyId);
      if (!story || story.nodes.length === 0) continue;
      if (entry.availableInits.length > 0 && !entry.availableInits.includes(initId)) continue;
      if (state.storyLog.some(completed => completed.storyId === entry.storyId)) continue;
      if (entry.triggerCondition && !this.conditionSystem.evaluateGroup(entry.triggerCondition, state)) continue;
      if (state.areaStoryDeliveries?.some(delivery => delivery.entryId === entry.id)) continue;

      this.createDelivery(entry.id, areaId, `story-availability:${entry.id}`);
    }
  }
}
