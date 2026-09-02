import { passiveStory } from './def-factory';
import { and, cond } from '../../engine/types';
import type { PassiveStoryEntry } from '../../data-services/contracts/story-entry';
import { tagPath } from '../../engine/core/tag';
import { hoshinoConversationStories, cooldownDemoStories } from './story-conversation-walls';

export const basePassiveStories: PassiveStoryEntry[] = [
  passiveStory('base:passivestory:schale_briefing', 'base:story:schale_briefing').inits('base:init:schale_office').weight(1).tags(tagPath('theme', 'daily')).reveal('name', and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 30))).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:schale_tea', 'base:story:schale_tea').inits('base:init:schale_office').weight(2).tags(tagPath('theme', 'daily')).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:schale_printer', 'base:story:schale_printer').inits('base:init:schale_office').weight(1).tags(tagPath('theme', 'office')).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:schale_archive', 'base:story:schale_archive').inits('base:init:schale_office').weight(2).tags(tagPath('theme', 'office')).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:schale_sunset', 'base:story:schale_sunset').inits('base:init:schale_office').weight(1).tags(tagPath('theme', 'daily')).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:schale_planner', 'base:story:schale_planner').inits('base:init:schale_office').weight(2).tags(tagPath('theme', 'daily')).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:schale_vending', 'base:story:schale_vending').inits('base:init:schale_office').weight(1).tags(tagPath('theme', 'office')).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:schale_night', 'base:story:schale_night').inits('base:init:schale_office').weight(2).tags(tagPath('theme', 'night')).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:abydos_daily_committee', 'base:story:abydos_daily_committee').inits('base:init:abydos').weight(2).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:abydos_siesta', 'base:story:abydos_siesta').inits('base:init:abydos').weight(1).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:abydos_serika_shift', 'base:story:abydos_serika_shift').inits('base:init:abydos').weight(2).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:abydos_money', 'base:story:abydos_money').inits('base:init:abydos').weight(1).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:millennium_calculation', 'base:story:millennium_calculation').inits('base:init:millennium').weight(2).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:millennium_game_dev', 'base:story:millennium_game_dev').inits('base:init:millennium').weight(2).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:millennium_hack', 'base:story:millennium_hack').inits('base:init:millennium').weight(1).rewardPyroxene(15, 5).build(),
  passiveStory('base:passivestory:millennium_server', 'base:story:millennium_server').inits('base:init:millennium').weight(1).rewardPyroxene(15, 5).build(),
  ...hoshinoConversationStories,
  ...cooldownDemoStories,
  passiveStory('base:passivestory:hoshino_selfie', 'base:story:hoshino_selfie').inits('base:init:schale_office').weight(2).tags(tagPath('theme', 'daily')).rewardPyroxene(15, 5).build(),
];
