import { passiveStory } from './def-factory';
import { and, cond } from '../../engine/types';
import { passivePool } from './def-factory';
import type { PassivePoolDef } from '../../data-services/contracts/passive-pool';
import type { PassiveStoryEntry } from '../../data-services/contracts/story-entry';

export const hoshinoConversationPool: PassivePoolDef = passivePool('base:passivepool:hoshino_conv')
  .name('星野对话空间')
  .owner('Hoshino')
  .child('base:passivestory:hoshino_conv_1')
  .child('base:passivestory:hoshino_conv_2')
  .child('base:passivestory:hoshino_bond_invite')
  .build();

export const hoshinoConversationStories: PassiveStoryEntry[] = [
  passiveStory('base:passivestory:hoshino_conv_1', 'base:story:hoshino_tea_time')
    .owner('Hoshino')
    .inits()
    .weight(1)
    .cooldownFrames(600)
    .build(),
  passiveStory('base:passivestory:hoshino_conv_2', 'base:story:hoshino_rooftop_hint')
    .owner('Hoshino')
    .inits('base:init:schale_office')
    .repeatable(false)
    .weight(1)
    .block(and(cond('area', 'base:area:schale_rooftop', '==', 1)))
    .leaveArea(false)
    .interruptible(false)
    .build(),
  passiveStory('base:passivestory:hoshino_bond_invite', 'base:story:hoshino_bond_invite')
    .owner('Hoshino')
    .inits()
    .repeatable(false)
    .weight(1)
    .build(),
];

export const cooldownDemoPool: PassivePoolDef = passivePool('base:passivepool:cooldown_demo')
  .name('冷却演示池')
  .cooldownFrames(1200)
  .child('base:passivestory:cooldown_demo_1')
  .build();

export const cooldownDemoStories: PassiveStoryEntry[] = [
  passiveStory('base:passivestory:cooldown_demo_1', 'base:story:schale_briefing')
    .inits()
    .weight(1)
    .build(),
];
