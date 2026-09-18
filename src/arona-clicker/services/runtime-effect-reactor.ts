import type { Effect, EntityPresentationEffectValue, GameEvent } from '../../engine/types';
import type { EntityPresentationKey } from '../../data-services/contracts/entity-presentation';
import type { ChatTextEffectValue } from '../../engine/contracts/chat-presentation';
import type { ChatFlowPort } from '../../engine/contracts/chat-flow';
import type { StoryEffectPort } from '../../engine/contracts/story-effect';
import { EventDrivenReactor } from '../../engine/effect/event-driven-reactor';
import type { EventBus } from '../../engine/core/event-bus';
import type { ColorEffectPort } from '../../engine/contracts/color-runtime';
import type { EntityPresentationService } from './entity-presentation-service';

export class RuntimeEffectReactor extends EventDrivenReactor {
  constructor(
    eventBus: EventBus,
    private readonly registry: RuntimeEffectRegistryContext,
    private readonly colorSystem: ColorEffectPort,
    private readonly entityPresentation: EntityPresentationService,
    private readonly storyService: StoryEffectPort,
    private readonly chatFlowService: ChatFlowPort,
  ) {
    super(eventBus);
    this.subscribeTo(['themeEffectRequested', 'entityPresentationEffectRequested', 'storyEffectRequested', 'chatFlowEffectRequested', 'storyCompleted', 'areaEntered', 'initEntered']);
  }

  protected override onEvent(type: GameEvent['type'], event: GameEvent): void {
    switch (type) {
      case 'themeEffectRequested':
        this.colorSystem.handleThemeEffect((event as { effect: Effect }).effect);
        break;
      case 'entityPresentationEffectRequested': {
        const effect = (event as { effect: Effect }).effect;
        const value = effect.value as EntityPresentationEffectValue;
        const key = effect.target as EntityPresentationKey;
        const owner = value.owner ?? effect.owner;
        if (!owner) break;
        if (effect.op === 'setEntityPresentation' && value.optionId) {
          this.entityPresentation.setRuntimeOverride(key, value.optionId, owner, value.lifetime ?? 'manual');
        } else if (effect.op === 'clearEntityPresentation') {
          this.entityPresentation.clearRuntimeOverride(key, owner);
        }
        break;
      }
      case 'storyCompleted':
        this.entityPresentation.clearRuntimeOverrides({
          owner: (event as Extract<GameEvent, { type: 'storyCompleted' }>).storyId,
          lifetime: 'story',
        });
        break;
      case 'areaEntered':
        this.entityPresentation.clearRuntimeOverrides({ lifetime: 'area' });
        break;
      case 'initEntered':
        this.entityPresentation.clearRuntimeOverrides({ lifetime: 'story' });
        this.entityPresentation.clearRuntimeOverrides({ lifetime: 'init' });
        this.entityPresentation.clearRuntimeOverrides({ lifetime: 'area' });
        break;
      case 'storyEffectRequested': {
        const effect = (event as { effect: Effect }).effect;
        const entry = this.registry.storyEntries.get(effect.target);
        const expectedType = entry?.type ?? 'passive';
        this.storyService.startStory(effect.target, expectedType, effect.owner ?? null, { force: true });
        break;
      }
      case 'chatFlowEffectRequested': {
        const effect = (event as { effect: Effect }).effect;
        const value = effect.value as ChatTextEffectValue;
        if (effect.op === 'clearAllChatFlow') this.chatFlowService.clearAll();
        else if (effect.op === 'showChatText') this.chatFlowService.showText(effect.target, value);
        else if (effect.op === 'clearIdChatFlow') this.chatFlowService.clearId(effect.target);
        else if (effect.op === 'clearAllChatText') this.chatFlowService.clearAllTexts();
        else if (effect.op === 'showOpeningTitle') this.chatFlowService.showOpeningTitle(typeof effect.value === 'string' && effect.value ? effect.value : undefined);
        break;
      }
    }
  }
}

export interface RuntimeEffectRegistryContext {
  readonly storyEntries: ReadonlyMap<string, { type: 'active' | 'passive' }>;
}
