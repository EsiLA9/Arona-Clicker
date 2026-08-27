// ============================================================
// engine/def-factory/chat-message.ts — ChatMessageDef 链式 Builder
// ============================================================

import type { Condition, ConditionGroup } from '../types/expression';
import type { ChatMessageDef, ChatMessageId, VariantId } from '../types/character';

export class ChatMessageBuilder {
  private readonly _id: ChatMessageId;
  private readonly _owner: VariantId;
  private _order = 0;
  private _content = '';
  private _unlock?: Condition | ConditionGroup;

  constructor(id: ChatMessageId, owner: VariantId) {
    this._id = id;
    this._owner = owner;
  }

  /** @label 排序 */
  order(value: number): this { this._order = value; return this; }
  /** @label 内容 */
  content(value: string): this { this._content = value; return this; }
  /** @label 解锁条件 */
  unlock(condition: Condition | ConditionGroup): this { this._unlock = condition; return this; }

  build(): ChatMessageDef {
    if (!this._content) throw new Error(`ChatMessageBuilder(${this._id}): content 未设置`);
    const def: ChatMessageDef = {
      id: this._id,
      owner: this._owner,
      order: this._order,
      content: this._content,
    };
    if (this._unlock) def.unlock = this._unlock;
    return def;
  }
}

export const chatMessage = (id: ChatMessageId, owner: VariantId): ChatMessageBuilder =>
  new ChatMessageBuilder(id, owner);