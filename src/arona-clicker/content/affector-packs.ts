import { affectorPack } from '../../engine/types';
import type { AffectorPackDef } from '../../engine/types';
import { extra } from '../../engine/extra/index';

export const baseAffectorPacks: AffectorPackDef[] = [
  affectorPack('base:affectorpack:energy_drink').extra(extra.dict({ desc: extra.str('能量饮料：每次点击 +1 信用点'), tier: extra.int(1) })).entry('base:affector:energy_drink').flow(Resource.Credit, 1).build(),
  affectorPack('base:affectorpack:pyroxene_flow').extra(extra.dict({ desc: extra.str('青辉石提纯回路：每 tick +2500 青辉石'), tier: extra.int(0) })).entry('base:affector:pyroxene_flow').flow(Resource.Pyroxene, 2500).build(),
  affectorPack('base:affectorpack:credit_system_mult').entry('base:affector:credit_system_mult').modEntity('spot', '*', 'mul', 1.5).build(),
  affectorPack('base:affectorpack:office_layout_mult').entry('base:affector:office_layout_mult').modTag(['office'], 'mul', 1.25).build(),
  affectorPack('base:affectorpack:field_logistics_mult').entry('base:affector:field_logistics_mult').modTag(['field'], 'mul', 1.35).modTag(['combat'], 'mul', 1.35).modTag(['tactical'], 'mul', 1.35).build(),
  affectorPack('base:affectorpack:combat_drone_mult').entry('base:affector:combat_drone_mult').modTag(['combat'], 'mul', 1.35).build(),
  affectorPack('base:affectorpack:research_grant_mult').entry('base:affector:research_grant_mult').modEntity('spot', '*', 'mul', 1.4).build(),
  affectorPack('base:affectorpack:investment_fund_mult').entry('base:affector:investment_fund_mult').modEntity('spot', '*', 'mul', 1.3).build(),
  affectorPack('base:affectorpack:pyroxene_rush_mult').entry('base:affector:pyroxene_rush_mult').modEntity('spot', '*', 'mul', 1.8).build(),
  affectorPack('base:affectorpack:tactical_command_mult').entry('base:affector:tactical_command_mult').modTag(['tactical'], 'mul', 1.3).build(),
  affectorPack('base:affectorpack:supply_chain_mult').entry('base:affector:supply_chain_mult').modEntity('spot', '*', 'mul', 1.6).build(),
  affectorPack('base:affectorpack:energy_supply_mult').entry('base:affector:energy_supply_mult').modEntity('spot', '*', 'mul', 1.25).build(),
  affectorPack('base:affectorpack:sanctuary_field_mult').entry('base:affector:sanctuary_field_mult').modEntity('spot', '*', 'mul', 1.5).build(),
  affectorPack('base:affectorpack:foundation_mult').entry('base:affector:foundation_mult').modEntity('spot', '*', 'mul', 2).build(),
  affectorPack('base:affectorpack:eternal_contract_mult').entry('base:affector:eternal_contract_mult').modEntity('spot', '*', 'mul', 1.5).build(),
  affectorPack('base:affectorpack:unified_logistics_flow').entry('base:affector:unified_logistics_flow').flow(Resource.Credit, 1).build(),
];
import { Resource } from '../types/ids';
