// ============================================================
// engine/def-factory/chat-message.ts — ChatMessageDef 链式 Builder
// ============================================================

import type { Condition, ConditionGroup } from '../types/expression';
import type { Talklet } from '../types/content';
import type { ChatMessageDef, ChatMessageId, VariantId } from '../types/character';

export class ChatMessageBuilder {
  private readonly _id: ChatMessageId;
  private readonly _owner: VariantId;
  private _order = 0;
  private _content = '';
  private _unlock?: Condition | ConditionGroup;
  private _repeatable?: boolean;
  private _affectionRequired?: number;
  private _affectionExpReward?: number;
  private _kizunaStoryId?: string;
  private _kizunaTail?: Talklet[];

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
  /** 可反复触发（缺省 false = 单次已读即止）。 */
  repeatable(value = true): this { this._repeatable = value; return this; }
  /** 好感等级门槛（与 unlock AND；缺省 0 = 无要求）。 */
  affectionRequired(value: number): this { this._affectionRequired = value; return this; }
  /** 读完奖励的好感小值（按 owner 归属结算；缺省 0）。 */
  affectionExpReward(value: number): this { this._affectionExpReward = value; return this; }
  /** 关联的羁绊剧情入口 id：消息在对话空间渲染羁绊卡片，点击启动该剧情。 */
  kizunaStory(storyId: string): this { this._kizunaStoryId = storyId; return this; }
  /** 羁绊收尾段：剧情完成后于对话空间追加展示的 Talklet 序列。 */
  kizunaTail(...talklets: Talklet[]): this {
    this._kizunaTail = [...(this._kizunaTail ?? []), ...talklets];
    return this;
  }

  build(): ChatMessageDef {
    if (!this._content) throw new Error(`ChatMessageBuilder(${this._id}): content 未设置`);
    const def: ChatMessageDef = {
      id: this._id,
      owner: this._owner,
      order: this._order,
      content: this._content,
    };
    if (this._unlock) def.unlock = this._unlock;
    if (this._repeatable) def.repeatable = this._repeatable;
    if (this._affectionRequired !== undefined) def.affectionRequired = this._affectionRequired;
    if (this._affectionExpReward !== undefined) def.affectionExpReward = this._affectionExpReward;
    if (this._kizunaStoryId) def.kizunaStoryId = this._kizunaStoryId;
    if (this._kizunaTail?.length) def.kizunaTail = this._kizunaTail;
    return def;
  }
}

export const chatMessage = (id: ChatMessageId, owner: VariantId): ChatMessageBuilder =>
  new ChatMessageBuilder(id, owner);