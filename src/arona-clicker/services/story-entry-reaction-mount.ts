import type { Registry } from '../../data-services/registry/registry';
import type { StoryEntryDef, StoryEntryReaction } from '../../data-services/contracts/story-entry';
import type { TriggerDef } from '../../engine/types/trigger';
import type { PlayerState } from '../types/state';
import { EventBus } from '../../engine/core/event-bus';
import { TriggerSystem } from '../../engine/effect/trigger-system';

/**
 * StoryEntry reactions 的运行时投影。
 * 数据包只保存 Entry.reactions；这里按当前 Init 和完成记录派生、挂载 TriggerDef。
 */
export class StoryEntryReactionMount {
  private currentInitId: string | null = null;
  private readonly groups = new Set<string>();

  constructor(
    private readonly registry: Registry,
    private readonly triggerSystem: TriggerSystem,
    eventBus: EventBus,
    private readonly getState: () => PlayerState,
  ) {
    eventBus.on('storyCompleted', event => this.mountForStoryCompletion(event.storyId));
  }

  mountForInit(initId: string): void {
    this.unmountAll();
    this.currentInitId = initId;
    for (const entry of this.entries()) {
      if (!this.isAvailableInInit(entry, initId)) continue;
      if (!this.hasCompleted(entry.storyId)) continue;
      this.mountEntry(entry);
    }
  }

  unmountAll(): void {
    for (const group of this.groups) this.triggerSystem.unmountGroup(group);
    this.groups.clear();
    this.currentInitId = null;
  }

  private mountForStoryCompletion(storyId: string): void {
    const initId = this.currentInitId;
    if (!initId) return;
    for (const entry of this.entries()) {
      if (entry.storyId !== storyId || !this.isAvailableInInit(entry, initId)) continue;
      this.mountEntry(entry);
    }
  }

  private mountEntry(entry: StoryEntryDef): void {
    const group = `story-entry:${entry.id}`;
    this.groups.add(group);
    for (const reaction of entry.reactions ?? []) {
      if (reaction.activation && reaction.activation !== 'after-completion') continue;
      this.triggerSystem.mount(this.toTrigger(entry, reaction), group);
    }
  }

  private toTrigger(entry: StoryEntryDef, reaction: StoryEntryReaction): TriggerDef {
    return {
      id: `${entry.id}#reaction:${reaction.id}`,
      on: reaction.on,
      condition: reaction.condition,
      effects: reaction.effects,
      once: reaction.once ?? true,
    };
  }

  private hasCompleted(storyId: string): boolean {
    return this.getState().storyLog.some(story => story.storyId === storyId);
  }

  private isAvailableInInit(entry: StoryEntryDef, initId: string): boolean {
    return entry.availableInits.length === 0 || entry.availableInits.includes(initId);
  }

  private *entries(): Iterable<StoryEntryDef> {
    yield* this.registry.activeStories.values();
    yield* this.registry.passiveStories.values();
  }
}
