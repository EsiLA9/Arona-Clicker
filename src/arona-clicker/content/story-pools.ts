import { passivePool } from './def-factory';
import { and, cond } from '../../engine/types';
import type { PassivePoolDef } from '../../data-services/contracts/passive-pool';
import { tagPath } from '../../engine/core/tag';
import { hoshinoConversationPool, cooldownDemoPool } from './story-conversation-walls';

export const basePassivePools: PassivePoolDef[] = [
  passivePool('base:passivepool:schale_root')
    .name('夏莱闲聊')
    .tags(tagPath('place', 'schale'))
    .child('base:passivepool:schale_daily', 3)
    .child('base:passivepool:schale_office_topic', 2)
    .child('base:passivepool:schale_night_owl', 2)
    .build(),
  passivePool('base:passivepool:schale_daily')
    .name('日常')
    .tags(tagPath('theme', 'daily'))
    .child('base:passivestory:schale_briefing', 1)
    .child('base:passivestory:schale_tea', 2)
    .child('base:passivestory:schale_sunset', 1)
    .child('base:passivestory:schale_planner', 2)
    .build(),
  passivePool('base:passivepool:schale_office_topic')
    .name('办公区专题')
    .tags(tagPath('theme', 'office'))
    .condition(and(cond('tagCount', 'spots:office', '>=', 1)))
    .child('base:passivestory:schale_printer', 1)
    .child('base:passivestory:schale_archive', 2)
    .child('base:passivestory:schale_vending', 1)
    .build(),
  passivePool('base:passivepool:schale_night_owl')
    .name('深夜闲聊')
    .tags(tagPath('theme', 'night'))
    .condition(and(cond('flag', 'night_mode', '==', 1)))
    .child('base:passivestory:schale_night', 1)
    .build(),
  hoshinoConversationPool,
  cooldownDemoPool,
];
