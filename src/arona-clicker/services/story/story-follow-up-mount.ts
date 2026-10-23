import type { StoryEntryDef, StoryFollowUp } from '../../../data-services/contracts/story-entry';
import type { Registry } from '../../../data-services/registry/registry';
import type { PlayerState } from '../../types/state';
import { EventBus } from '../../../engine/core/event-bus';
import type { TriggerSystem } from '../../../engine/effect/trigger-system';

export type StartStoryEntry = (storyEntryId: string) => boolean;
export type CreateAreaStoryDelivery = (storyEntryId: string, areaId: string, sourceId: string) => boolean;
export type StoryFollowUpDiagnosticState = 'inactive' | 'waiting' | 'fulfilled';
export interface StoryFollowUpDiagnostic {
  sourceStoryEntryId: string;
  followUpId: string;
  areaId: string;
  targetStoryEntryId: string;
  derivedId: string;
  state: StoryFollowUpDiagnosticState;
}

/**
 * StoryFollowUp 的运行时投影。
 * FollowUp 定义与 fulfilled 记录来自数据 / PlayerState；当前 Init 内的等待监听始终可重建。
 */
export class StoryFollowUpMount {
  private currentInitId: string | null = null;
  private readonly mounted = new Map<string, StoryFollowUp>();

  constructor(
    private readonly registry: Registry,
    private readonly triggerSystem: TriggerSystem,
    eventBus: EventBus,
    private readonly getState: () => PlayerState,
    private readonly startStoryEntry: StartStoryEntry,
    private readonly createAreaStoryDelivery: CreateAreaStoryDelivery,
  ) {
    eventBus.on('storyCompleted', () => this.reconcile());
    eventBus.on('areaEntered', event => this.onAreaEntered(event.areaId));
  }

  mountForInit(initId: string): void {
    this.currentInitId = initId;
    this.reconcile();
  }

  unmountAll(): void {
    this.mounted.clear();
    this.currentInitId = null;
  }

  /** 只读诊断投影；状态优先级为 fulfilled > waiting > inactive。 */
  getDiagnostics(): StoryFollowUpDiagnostic[] {
    const currentInitId = this.currentInitId;
    const diagnostics: StoryFollowUpDiagnostic[] = [];
    for (const entry of this.entries()) {
      const sourceCompleted = this.hasCompleted(entry.storyId);
      const initValid = currentInitId !== null && this.isAvailableInInit(entry, currentInitId);
      for (const followUp of entry.followUps ?? []) {
        const derivedId = this.derivedId(entry, followUp);
        const state: StoryFollowUpDiagnosticState = this.isFulfilled(derivedId)
          ? 'fulfilled'
          : sourceCompleted && initValid
            ? 'waiting'
            : 'inactive';
        diagnostics.push({
          sourceStoryEntryId: entry.id,
          followUpId: followUp.id,
          areaId: followUp.waitFor.areaId,
          targetStoryEntryId: followUp.outcome.storyEntryId,
          derivedId,
          state,
        });
      }
    }
    return diagnostics;
  }

  private reconcile(): void {
    this.mounted.clear();
    const initId = this.currentInitId;
    if (!initId) return;
    for (const entry of this.entries()) {
      if (!this.isAvailableInInit(entry, initId) || !this.hasCompleted(entry.storyId)) continue;
      for (const followUp of entry.followUps ?? []) {
        const id = this.derivedId(entry, followUp);
        if (this.isFulfilled(id)) continue;
        this.mounted.set(id, followUp);
      }
    }
  }

  private onAreaEntered(areaId: string): void {
    const initId = this.currentInitId;
    if (!initId) return;
    const matching = [...this.mounted].filter(([, followUp]) => followUp.waitFor.areaId === areaId);

    // Area entry can deliver every matching ActiveStoryEntry. It does not start a Story,
    // so one delivery must not prevent another offer from being created in the same Area.
    for (const [id, followUp] of matching) {
      const target = this.registry.storyEntries.get(followUp.outcome.storyEntryId);
      if (target?.type !== 'active') continue;
      const area = this.registry.areas.get(areaId);
      if (!area || area.initId !== initId || !this.isAvailableInInit(target, initId)) continue;
      const targetStory = this.registry.stories.get(target.storyId);
      if (!targetStory || targetStory.talklets.length === 0) continue;
      if (this.hasCompleted(target.storyId)) {
        this.triggerSystem.commitOnce(id);
        this.mounted.delete(id);
        continue;
      }
      if (!this.createAreaStoryDelivery(target.id, areaId, id)) continue;
      this.triggerSystem.commitOnce(id);
      this.mounted.delete(id);
    }

    // Passive FollowUps keep their existing direct-start behavior and one-success-per-entry-event limit.
    for (const [id, followUp] of matching) {
      const target = this.registry.storyEntries.get(followUp.outcome.storyEntryId);
      if (target?.type === 'active') continue;
      if (!this.startStoryEntry(followUp.outcome.storyEntryId)) continue;
      this.triggerSystem.commitOnce(id);
      this.mounted.delete(id);
      break;
    }
  }

  private isFulfilled(id: string): boolean {
    return this.getState().triggersCompleted?.includes(id) ?? false;
  }

  private hasCompleted(storyId: string): boolean {
    return this.getState().storyLog.some(story => story.storyId === storyId);
  }

  private isAvailableInInit(entry: StoryEntryDef, initId: string): boolean {
    return entry.availableInits.length === 0 || entry.availableInits.includes(initId);
  }

  private derivedId(entry: StoryEntryDef, followUp: StoryFollowUp): string {
    return `${entry.id}#follow-up:${followUp.id}`;
  }

  private *entries(): Iterable<StoryEntryDef> {
    yield* this.registry.activeStories.values();
    yield* this.registry.passiveStories.values();
  }
}
