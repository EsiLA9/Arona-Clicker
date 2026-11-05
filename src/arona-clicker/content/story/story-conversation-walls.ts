import { passiveStory } from '../def-factory/index';
import { passivePool } from '../def-factory/index';
import type { PassivePoolDef } from '../../../data-services/contracts/passive-pool';
import type { PassiveStoryEntry } from '../../../data-services/contracts/story-entry';

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
    .replayable()
    .leaveArea(false)
    .interruptible(false)
    .build(),
  passiveStory('base:passivestory:hoshino_bond_invite', 'base:story:hoshino_bond_invite')
    .owner('Hoshino')
    .replayable()
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
