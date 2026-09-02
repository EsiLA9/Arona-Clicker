import { trigger, and, cond } from '../../engine/types';
import type { TriggerDef } from '../../engine/types';

export const baseTriggers: TriggerDef[] = [
  trigger('base:trigger:first_credit_milestone').onTick().when(and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 100))).effects({ op: 'addResource', target: Resource.Credit, value: 25 }).build(),
  trigger('base:trigger:office_mastered').onSpotLevel().when(and(cond('countTags', 'office', '>=', 2))).effects({ op: 'setFlag', target: 'office_mastered', value: '1' }).build(),
  trigger('base:trigger:welcome_reward').onStory('base:story:schale_welcome').effects({ op: 'addItem', target: 'base:item:energy_drink', value: 1 }).build(),
  trigger('base:trigger:abydos_first_milestone').onTick().when(and(cond('stat', '$InitProducedAmount base:init:abydos base:resource:credit', '>=', 80))).effects(
    { op: 'addResource', target: Resource.Credit, value: 30 },
    { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
  ).build(),
  trigger('base:trigger:millennium_first_milestone').onTick().when(and(cond('stat', '$InitProducedAmount base:init:millennium base:resource:credit', '>=', 100))).effects(
    { op: 'addResource', target: Resource.Credit, value: 40 },
    { op: 'addItem', target: 'base:item:data_chip', value: 3 },
  ).build(),
  trigger('base:trigger:trinity_first_milestone').onTick().when(and(cond('stat', '$InitProducedAmount base:init:trinity base:resource:credit', '>=', 100))).effects(
    { op: 'addResource', target: Resource.Credit, value: 35 },
    { op: 'addItem', target: 'base:item:mystery_fragment', value: 2 },
  ).build(),
  trigger('base:trigger:gehenna_first_milestone').onTick().when(and(cond('stat', '$InitProducedAmount base:init:gehenna base:resource:credit', '>=', 100))).effects(
    { op: 'addResource', target: Resource.Credit, value: 35 },
    { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
  ).build(),
  trigger('base:trigger:milestone_500').onTick().when(and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 500))).effects(
    { op: 'addResource', target: Resource.Credit, value: 50 },
    { op: 'addItem', target: 'base:item:premium_drink', value: 1 },
    { op: 'setFlag', target: 'milestone_500_reached', value: '1' },
  ).build(),
  trigger('base:trigger:milestone_1000').onTick().when(and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 1000))).effects(
    { op: 'addResource', target: Resource.Credit, value: 100 },
    { op: 'addItem', target: 'base:item:peroro_doll', value: 1 },
    { op: 'setFlag', target: 'milestone_1000_reached', value: '1' },
  ).build(),
];
import { Resource } from '../types/ids';
