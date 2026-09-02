import type { ExtraCompound } from '../../engine/types/extra';
import type { ConditionGroup, Effect } from '../../engine/types/expression';
import type { StoryId } from '../../engine/types/ids';
import type { PicId } from './pic';
export interface StoryChoice {
  text: string;
  effects: Effect[];
  condition?: ConditionGroup;
  jumpToStory?: StoryId;
  jumpMode?: 'goto' | 'insert';
}

export interface Talklet {
  text: string;
  speaker?: string;
  choices?: StoryChoice[];
  effects?: Effect[];
  sendText?: string;
  muteReply?: boolean;
  clickWork?: { base: number; rand?: number };
  kind?: 'talk' | 'narration' | 'click';
  align?: 'center' | 'left' | 'right';
  avatar?: string;
  side?: 'left' | 'right';
  noAvatar?: boolean;
  showAvatar?: boolean;
  image?: string;
  typing?: number;
  thinking?: number;
  jumpToStory?: StoryId;
  jumpMode?: 'goto' | 'insert';
  kizuna?: { storyId: StoryId; title?: string; buttonText?: string; align?: 'left' | 'right' };
}

export interface StoryDef {
  id: StoryId;
  name: string;
  talklets: Talklet[];
  extra?: ExtraCompound;
}
