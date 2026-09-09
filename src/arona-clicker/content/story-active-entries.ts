import { activeStory } from './def-factory';
import { and, cond } from '../../engine/types';
import type { ActiveStoryEntry } from '../../data-services/contracts/story-entry';

export const baseActiveStories: ActiveStoryEntry[] = [
  activeStory('base:activestory:schale_welcome', 'base:story:schale_welcome').inits('base:init:schale_office').replayable().build(),
  activeStory('base:activestory:schale_flow_show', 'base:story:schale_flow_show').inits('base:init:schale_office').replayable().build(),
  activeStory('base:activestory:schale_theme_lite_test', 'base:story:schale_theme_lite_test').inits('base:init:schale_office').replayable().build(),
  activeStory('base:activestory:abydos_welcome', 'base:story:abydos_welcome').inits('base:init:abydos').replayable().build(),
  activeStory('base:activestory:millennium_welcome', 'base:story:millennium_welcome').inits('base:init:millennium').replayable().build(),
  activeStory('base:activestory:millennium_game_crisis', 'base:story:millennium_game_crisis_intro')
    .inits('base:init:millennium')
    .replayable()
    .completionStrategy('conditional')
    .conditionalReward(and(cond('visitedStoryInChain', 'base:story:millennium_game_crisis_debug', '==', 1)), { op: 'addResource', target: Resource.Pyroxene, value: 40 })
    .conditionalReward(and(cond('visitedStoryInChain', 'base:story:millennium_game_crisis_bribe', '==', 1)), { op: 'addResource', target: Resource.Pyroxene, value: 15 })
    .branchGuard('base:story:millennium_game_crisis_bribe', [{ storyId: 'base:story:millennium_game_crisis_bribe', talkletIndex: -1 }], '你还没有真正走过这条路线，无法回顾该分歧。')
    .build(),
  activeStory('base:activestory:serika_side_1', 'base:story:serika_side_1').inits('base:init:abydos').replayable().build(),
  activeStory('base:activestory:serika_side_2', 'base:story:serika_side_2')
    .inits('base:init:abydos')
    .replayable()
    .when(and(cond('hasReadStory', 'base:story:serika_side_1', '==', 1)))
    .reveal('name', and(cond('hasReadStory', 'base:story:serika_side_1', '==', 1)))
    .reveal('condition', and(cond('hasReadStory', 'base:story:serika_side_1', '==', 1)))
    .build(),
  activeStory('base:activestory:run_chain_1', 'base:story:run_chain_1').inits('base:init:schale_office').replayable().build(),
  activeStory('base:activestory:run_chain_2', 'base:story:run_chain_2')
    .inits('base:init:schale_office')
    .replayable()
    .when(and(cond('hasReadStoryInRun', 'base:story:run_chain_1', '==', 1)))
    .reveal('name', and(cond('hasReadStoryInRun', 'base:story:run_chain_1', '==', 1)))
    .reveal('condition', and(cond('hasReadStoryInRun', 'base:story:run_chain_1', '==', 1)))
    .build(),
  activeStory('base:activestory:run_chain_3', 'base:story:run_chain_3')
    .inits('base:init:schale_office')
    .replayable()
    .when(and(cond('hasReadStoryInRun', 'base:story:run_chain_2', '==', 1)))
    .reveal('name', and(cond('hasReadStoryInRun', 'base:story:run_chain_1', '==', 1)))
    .reveal('condition', and(cond('hasReadStoryInRun', 'base:story:run_chain_2', '==', 1)))
    .build(),
  activeStory('base:activestory:hoshino_rooftop_meet', 'base:story:hoshino_rooftop_meet').inits('base:init:schale_office').replayable().build(),
];
import { Resource } from '../types/ids';
