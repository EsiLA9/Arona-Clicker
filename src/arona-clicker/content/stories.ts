import type { StoryDef } from '../../data-services/contracts/story';
import { baseSchaleMainStories } from './story-schale-main';
import { baseSchaleDailyStories } from './story-schale-daily';
import { baseAbydosMainStories } from './story-abydos-main';
import { baseRegionalChatStories } from './story-regional-chat';
import { baseMillenniumMainStories } from './story-millennium-main';
import { baseStoryChains } from './story-chains';
import { baseHoshinoStories } from './story-hoshino';

export const baseStories: StoryDef[] = [
  ...baseSchaleMainStories,
  ...baseSchaleDailyStories,
  ...baseAbydosMainStories,
  ...baseRegionalChatStories,
  ...baseMillenniumMainStories,
  ...baseStoryChains,
  ...baseHoshinoStories,
];
