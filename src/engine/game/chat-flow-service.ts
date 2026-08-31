// ============================================================
// engine/game/chat-flow-service.ts — 聊天流演出服务（Talklet 专用）
// 职责：把 clearAllChatFlow / showChatText / clearIdChatFlow 三种
// 演出效果转译为运行时事件，由 UI 订阅后操作聊天流。
// 纯运行时桥（非持久）：不写入 PlayerState，只发事件（同 setTheme/triggerStory 模式）。
// ============================================================

import type { EventBus } from '../core/event-bus';
import type { ChatTextEffectValue } from '../types/expression';

/** 演出专用文本（showChatText）：可直接给 text，或嵌入标准 Talklet 复用其渲染。 */
export type ChatTextShowOptions = ChatTextEffectValue;

/** 聊天流演出服务：Talklet 的聊天流操作统一入口（经 effect-engine 转发）。 */
export class ChatFlowService {
  constructor(private readonly eventBus: EventBus) {}

  /** 清理聊天流：清空当前流的全部聊天内容（含演出专用文本）。 */
  clearAll(): void {
    this.eventBus.emit({ type: 'chatFlowCleared' });
  }

  /** 删除全部可变位置的演出文本：清空覆盖层，保留聊天历史。 */
  clearAllTexts(): void {
    this.eventBus.emit({ type: 'chatTextClearedAll' });
  }

  /** 显示演出专用文本：target = 临时 id（供 clearId 后续擦除）。 */
  showText(id: string, options: ChatTextShowOptions): void {
    this.eventBus.emit({ type: 'chatTextShown', id, ...options });
  }

  /** 按临时 id 擦除演出专用文本。 */
  clearId(id: string): void {
    this.eventBus.emit({ type: 'chatTextCleared', id });
  }

  /** 呼出开幕标题横幅：title = showOpeningTitle 效果的 value 文本（缺省时 UI 回退 entry.openingTitle ?? StoryDef.name）。 */
  showOpeningTitle(title?: string): void {
    this.eventBus.emit(title ? { type: 'openingTitleShown', title } : { type: 'openingTitleShown' });
  }
}
