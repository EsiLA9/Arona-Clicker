import { DropTableDef } from '../../engine/types';

export const baseDropTables: DropTableDef[] = [
  {
    id: 'base:drop:basic_field_reward',
    maxRolls: 1,
    guaranteed: [{ itemId: 'base:item:field_note', count: 1 }],
    entries: [
      { itemId: 'base:item:energy_drink', min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: 'base:drop:trinity_daily',
    maxRolls: 2,
    guaranteed: [{ itemId: 'base:item:field_note', count: 1 }],
    entries: [
      { itemId: 'base:item:mystery_fragment', min: 1, max: 2, weight: 2 },
      { itemId: 'base:item:momo_friends_cookie', min: 1, max: 2, weight: 3 },
      { itemId: 'base:item:peroro_doll', min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: 'base:drop:gehenna_daily',
    maxRolls: 2,
    guaranteed: [{ itemId: 'base:item:battle_report', count: 1 }],
    entries: [
      { itemId: 'base:item:tactical_kit', min: 1, max: 1, weight: 1 },
      { itemId: 'base:item:energy_drink', min: 1, max: 2, weight: 3 },
      { itemId: 'base:item:broken_core', min: 1, max: 1, weight: 2 },
    ],
  },
  {
    id: 'base:drop:millennium_research',
    maxRolls: 3,
    guaranteed: [{ itemId: 'base:item:data_chip', count: 1 }],
    entries: [
      { itemId: 'base:item:premium_drink', min: 1, max: 1, weight: 1 },
      { itemId: 'base:item:broken_core', min: 1, max: 2, weight: 3 },
      { itemId: 'base:item:data_chip', min: 1, max: 2, weight: 3 },
    ],
  },
  {
    id: 'base:drop:abydos_field',
    maxRolls: 2,
    guaranteed: [{ itemId: 'base:item:field_note', count: 2 }],
    entries: [
      { itemId: 'base:item:tactical_kit', min: 1, max: 1, weight: 1 },
      { itemId: 'base:item:energy_drink', min: 1, max: 2, weight: 3 },
      { itemId: 'base:item:mystery_fragment', min: 1, max: 1, weight: 1 },
    ],
  },
];
