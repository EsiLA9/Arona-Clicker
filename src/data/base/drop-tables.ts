import { dropTable } from '../../engine/types';
import type { DropTableDef } from '../../engine/types';

export const baseDropTables: DropTableDef[] = [
  dropTable('base:drop:basic_field_reward')
    .maxRolls(1)
    .guaranteed('base:item:field_note', 1)
    .entry('base:item:energy_drink', 1, 1, 1)
    .build(),
  dropTable('base:drop:trinity_daily')
    .maxRolls(2)
    .guaranteed('base:item:field_note', 1)
    .entry('base:item:mystery_fragment', 1, 2, 2)
    .entry('base:item:momo_friends_cookie', 1, 2, 3)
    .entry('base:item:peroro_doll', 1, 1, 1)
    .build(),
  dropTable('base:drop:gehenna_daily')
    .maxRolls(2)
    .guaranteed('base:item:battle_report', 1)
    .entry('base:item:tactical_kit', 1, 1, 1)
    .entry('base:item:energy_drink', 1, 2, 3)
    .entry('base:item:broken_core', 1, 1, 2)
    .build(),
  dropTable('base:drop:millennium_research')
    .maxRolls(3)
    .guaranteed('base:item:data_chip', 1)
    .entry('base:item:premium_drink', 1, 1, 1)
    .entry('base:item:broken_core', 1, 2, 3)
    .entry('base:item:data_chip', 1, 2, 3)
    .build(),
  dropTable('base:drop:abydos_field')
    .maxRolls(2)
    .guaranteed('base:item:field_note', 2)
    .entry('base:item:tactical_kit', 1, 1, 1)
    .entry('base:item:energy_drink', 1, 2, 3)
    .entry('base:item:mystery_fragment', 1, 1, 1)
    .build(),
];