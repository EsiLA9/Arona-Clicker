import type { Effect, GameEvent } from '../../engine/types';
import type { ChatTextEffectValue } from '../../engine/contracts/chat-presentation';
import type { ChatFlowPort } from '../../engine/contracts/chat-flow';
import type { StoryEffectPort } from '../../engine/contracts/story-effect';
import { EventDrivenReactor } from '../../engine/effect/event-driven-reactor';
import type { EventBus } from '../../engine/core/event-bus';
import type { ColorEffectPort } from '../../engine/contracts/color-runtime';

export class RuntimeEffectReactor extends EventDrivenReactor {
  constructor(
    eventBus: EventBus,
    private readonly registry: RuntimeEffectRegistryContext,
    private readonly colorSystem: ColorEffectPort,
    private readonly storyService: StoryEffectPort,
    private readonly chatFlowService: ChatFlowPort,
  ) {
    super(eventBus);
    this.subscribeTo(['themeEffectRequested', 'storyEffectRequested', 'chatFlowEffectRequested']);
  }

  protected override onEvent(type: GameEvent['type'], event: GameEvent): void {
    switch (type) {
      case 'themeEffectRequested':
        this.colorSystem.handleThemeEffect((event as { effect: Effect }).effect);
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
