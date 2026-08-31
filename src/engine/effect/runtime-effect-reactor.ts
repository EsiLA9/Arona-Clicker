// ============================================================
// engine/effect/runtime-effect-reactor.ts — 运行时效果请求反应器
//
// 消费 EffectEngine 转发的演出类 op 请求事件（themeEffectRequested /
// storyEffectRequested / chatFlowEffectRequested），分派给
// ColorSystem / StoryService / ChatFlowService 运行时层。
// 替代原 EffectEngine 三个回调处理器字段（效果层 → 领域服务的反向
// 引用），依赖方向收敛为：服务 ← 本反应器 ← EventBus ← EffectEngine
// （docs-824/08 T7）。
// ============================================================

import type { Effect, GameEvent } from '../types';
import type { ChatTextEffectValue } from '../types/expression';
import { EventDrivenReactor } from './event-driven-reactor';
import type { EventBus } from '../core/event-bus';
import type { Registry } from '../registry/registry';
import type { ColorSystem } from '../system/color-system';
import type { StoryService } from '../game/story-service';
import type { ChatFlowService } from '../game/chat-flow-service';

export class RuntimeEffectReactor extends EventDrivenReactor {
  constructor(
    eventBus: EventBus,
    private readonly registry: Registry,
    private readonly colorSystem: ColorSystem,
    private readonly storyService: StoryService,
    private readonly chatFlowService: ChatFlowService,
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
        // 按 target=storyId 解析入口类型；force：Trigger 驱动的系统事件剧情可抢占
        // 当前进行中的被动闲聊（否则会因 AlreadyActive 失败）。
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
        else if (effect.op === 'showOpeningTitle') {
          this.chatFlowService.showOpeningTitle(typeof effect.value === 'string' && effect.value ? effect.value : undefined);
        }
        break;
      }
    }
  }
}
