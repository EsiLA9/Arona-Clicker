import type { Effect } from '../../../engine/types/expression';
import type { StoryId } from '../../../engine/types/ids';
import type { StoryChoice, Talklet } from '../../../data-services/contracts/story';

export class TalkletBuilder {
  private readonly _text: string; private _speaker?: string; private _avatar?: string;
  private _kind?: Talklet['kind']; private _align?: Talklet['align']; private _effects: Effect[] = [];
  private _sendText?: string; private _muteReply = false; private _choices: StoryChoice[] = [];
  private _clickWork?: { base: number; rand?: number }; private _side?: Talklet['side'];
  private _noAvatar = false; private _showAvatar = false; private _image?: string;
  private _typing?: number; private _thinking?: number; private _jumpToStory?: StoryId;
  private _jumpMode?: Talklet['jumpMode']; private _kizuna?: Talklet['kizuna'];
  constructor(text: string) { this._text = text; }
  speaker(name: string): this { this._speaker = name; return this; }
  avatar(value: string): this { this._avatar = value; return this; }
  narrate(align: Talklet['align'] = 'center'): this { this._kind = 'narration'; this._align = align; return this; }
  click(base: number, rand?: number): this { this._kind = 'click'; this._clickWork = rand !== undefined ? { base, rand } : { base }; return this; }
  effects(...effs: Effect[]): this { this._effects.push(...effs); return this; }
  reply(value: string): this { this._sendText = value; return this; }
  sendText(value: string): this { this._sendText = value; return this; }
  mute(): this { this._muteReply = true; return this; }
  muteReply(): this { this._muteReply = true; return this; }
  side(value: Talklet['side']): this { this._side = value; return this; }
  noAvatar(): this { this._noAvatar = true; return this; }
  showAvatar(): this { this._showAvatar = true; return this; }
  image(value: string): this { this._image = value; return this; }
  typing(seconds: number): this { this._typing = seconds; return this; }
  thinking(seconds: number): this { this._thinking = seconds; return this; }
  choice(text: string, ...effects: Effect[]): this { this._choices.push({ text, effects }); return this; }
  choiceJump(text: string, storyId: StoryId, mode: 'goto' | 'insert' = 'goto', ...effects: Effect[]): this {
    this._choices.push({ text, effects, jumpToStory: storyId, jumpMode: mode }); return this;
  }
  jump(storyId: StoryId, mode?: 'goto' | 'insert'): this { this._jumpToStory = storyId; if (mode) this._jumpMode = mode; return this; }
  kizunaCard(storyId: StoryId, opts?: { title?: string; buttonText?: string; align?: 'left' | 'right' }): this { this._kizuna = { storyId, ...opts }; return this; }
  build(): Talklet {
    if (!this._text) throw new Error('TalkletBuilder: text 未设置');
    const def: Talklet = { text: this._text };
    if (this._speaker) def.speaker = this._speaker; if (this._avatar) def.avatar = this._avatar;
    if (this._kind) def.kind = this._kind; if (this._align) def.align = this._align;
    if (this._effects.length) def.effects = this._effects; if (this._sendText) def.sendText = this._sendText;
    if (this._muteReply) def.muteReply = true; if (this._choices.length) def.choices = this._choices;
    if (this._clickWork) def.clickWork = this._clickWork; if (this._side) def.side = this._side;
    if (this._noAvatar) def.noAvatar = true; if (this._showAvatar) def.showAvatar = true;
    if (this._image) def.image = this._image; if (this._typing !== undefined) def.typing = this._typing;
    if (this._thinking !== undefined) def.thinking = this._thinking;
    if (this._jumpToStory) { def.jumpToStory = this._jumpToStory; if (this._jumpMode) def.jumpMode = this._jumpMode; }
    if (this._kizuna) def.kizuna = this._kizuna; return def;
  }
}
export const talklet = (text: string): TalkletBuilder => new TalkletBuilder(text);
export const line = (speaker: string, text: string, reply?: string, opts?: { mute?: boolean; side?: Talklet['side']; noAvatar?: boolean; avatar?: string; image?: string }): TalkletBuilder => {
  const b = new TalkletBuilder(text).speaker(speaker); if (reply) b.reply(reply); if (opts?.mute) b.mute();
  if (opts?.side) b.side(opts.side); if (opts?.noAvatar) b.noAvatar(); if (opts?.avatar) b.avatar(opts.avatar); if (opts?.image) b.image(opts.image); return b;
};
export const narrate = (text: string, align: Talklet['align'] = 'center'): TalkletBuilder => new TalkletBuilder(text).narrate(align);
export const click = (text: string, base: number, rand?: number): TalkletBuilder => new TalkletBuilder(text).click(base, rand);
