import type { ExtraCompound } from '../../../engine/types/extra';
import type { StoryId } from '../../../engine/types/ids';
import type { StoryDef, Talklet } from '../../../data-services/contracts/story';
import type { TalkletBuilder } from './talklet';

export class StoryBuilder {
  private readonly _id: StoryId; private readonly _name: string; private _talklets: Talklet[] = []; private _extra?: ExtraCompound;
  constructor(id: StoryId, name: string) { this._id = id; this._name = name; }
  scene(...items: (TalkletBuilder | Talklet)[]): this { this._talklets.push(...items.map(item => (item instanceof Object && 'build' in item) ? item.build() : item)); return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }
  build(): StoryDef { const def: StoryDef = { id: this._id, name: this._name, talklets: this._talklets }; if (this._extra) def.extra = this._extra; return def; }
}
export const story = (id: StoryId, name: string): StoryBuilder => new StoryBuilder(id, name);
