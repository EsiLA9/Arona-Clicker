// ============================================================
// engine/def-factory/story.ts — StoryDef 链式 Builder
// 构造演出本体（StoryDef）。Talklet 由 TalkletBuilder / 紧凑自由函数
//（line / narrate / click）构造，.scene() 自动 build，免逐句 .build()。
// Story 与 StoryEntry（active/passive/kizuna）保持分离。
// ============================================================

import type { ExtraCompound } from '../types/extra';
import type { StoryId } from '../types/ids';
import type { StoryDef, Talklet } from '../types/content';
import type { TalkletBuilder } from './talklet';

export class StoryBuilder {
  private readonly _id: StoryId;
  private readonly _name: string;
  private _talklets: Talklet[] = [];
  private _extra?: ExtraCompound;

  constructor(id: StoryId, name: string) {
    this._id = id;
    this._name = name;
  }

  /** 追加演出片段（接受 TalkletBuilder 自动 build，或已构建的 Talklet）。 */
  scene(...items: (TalkletBuilder | Talklet)[]): this {
    this._talklets.push(...items.map(item => (item instanceof Object && 'build' in item) ? item.build() : item));
    return this;
  }

  extra(value: ExtraCompound): this { this._extra = value; return this; }

  build(): StoryDef {
    const def: StoryDef = {
      id: this._id,
      name: this._name,
      talklets: this._talklets,
    };
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

export const story = (id: StoryId, name: string): StoryBuilder => new StoryBuilder(id, name);