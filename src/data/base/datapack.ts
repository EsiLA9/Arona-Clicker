// ============================================================
// data/base/datapack.ts — 基础数据包汇总
// ============================================================

import { Datapack, ExtraValue, Resource, ResourceDisplayDef, AffectorPackDef, affectorPack } from '../../engine/types';
import { extra } from '../../engine/extra/index';
import { basePics } from './pics-assets';
import { baseInits } from './inits';
import { baseAreas } from './areas';
import { baseSpots } from './spots';
import { allCharacters } from './characters';
import {
  baseBondStories,
  baseBondStoryEntries,
  baseCharacterPersistConfig,
  baseCharacterVariants,
  baseChatMessages,
  baseColors,
  baseColorEquipments,
  baseColorGroups,
  baseCultivateCurves,
  baseGachaPools,
} from './character-rework';
import { baseItems } from './items';
import { baseDropTables } from './drop-tables';
import { baseActiveStories, basePassiveStories, basePassivePools, baseStories } from './stories';
import { baseEnhancements, baseGlobalEnhancements } from './enhancements';
import { baseTriggers } from './triggers';
import { baseCharaProfiles } from './chara-profiles';

// 资源条显示条目：解耦 header 硬编码的货币注解。
// 信用点常显；青辉石为可选条目（仅持有量 > 0 时显示）。
const baseResourceDisplays: ResourceDisplayDef[] = [
  { resourceId: Resource.Credit, label: '信用点', order: 0 },
  {
    resourceId: Resource.Pyroxene,
    label: '青辉石',
    detailLabel: '青辉石',
    showWhen: 'hasAmount',
    order: 10,
  },
];

const baseAffectorPacks: AffectorPackDef[] = [
  affectorPack('base:pack:energy_drink')
    // Def 级 extra 示例：结构化元数据（见 docs/13 §5.2），运行时零消费
    .extra(extra.dict({
      desc: extra.str('能量饮料：每次点击 +1 信用点'),
      tier: extra.int(1),
    }))
    .entry('base:aff:energy_drink')
    .flow(Resource.Credit, 1)
    .build(),
  // 测试用：青辉石量产管线（配合 base:enh:pyroxene_rush）
  affectorPack('base:pack:pyroxene_flow')
    .extra(extra.dict({
      desc: extra.str('青辉石提纯回路：每 tick +2500 青辉石'),
      tier: extra.int(0),
    }))
    .entry('base:aff:pyroxene_flow')
    .flow(Resource.Pyroxene, 2500)
    .build(),
  affectorPack('base:pack:credit_system_mult')
    .entry('base:aff:credit_system_mult')
    .modEntity('spot', '*', 'mul', 1.5)
    .build(),
  affectorPack('base:pack:office_layout_mult')
    .entry('base:aff:office_layout_mult')
    .modTag(['office'], 'mul', 1.25)
    .build(),
  affectorPack('base:pack:field_logistics_mult')
    .entry('base:aff:field_logistics_mult')
    .modTag(['field'], 'mul', 1.35)
    .modTag(['combat'], 'mul', 1.35)
    .modTag(['tactical'], 'mul', 1.35)
    .build(),
  affectorPack('base:pack:combat_drone_mult')
    .entry('base:aff:combat_drone_mult')
    .modTag(['combat'], 'mul', 1.35)
    .build(),
  affectorPack('base:pack:research_grant_mult')
    .entry('base:aff:research_grant_mult')
    .modEntity('spot', '*', 'mul', 1.4)
    .build(),
  affectorPack('base:pack:investment_fund_mult')
    .entry('base:aff:investment_fund_mult')
    .modEntity('spot', '*', 'mul', 1.3)
    .build(),
  affectorPack('base:pack:pyroxene_rush_mult')
    .entry('base:aff:pyroxene_rush_mult')
    .modEntity('spot', '*', 'mul', 1.8)
    .build(),
  affectorPack('base:pack:tactical_command_mult')
    .entry('base:aff:tactical_command_mult')
    .modTag(['tactical'], 'mul', 1.3)
    .build(),
  affectorPack('base:pack:supply_chain_mult')
    .entry('base:aff:supply_chain_mult')
    .modEntity('spot', '*', 'mul', 1.6)
    .build(),
  affectorPack('base:pack:energy_supply_mult')
    .entry('base:aff:energy_supply_mult')
    .modEntity('spot', '*', 'mul', 1.25)
    .build(),
  affectorPack('base:pack:sanctuary_field_mult')
    .entry('base:aff:sanctuary_field_mult')
    .modEntity('spot', '*', 'mul', 1.5)
    .build(),
  // GlobalEnhancement 专用包：global 挂靠强化（仅经选择页购买，全局作用域）
  affectorPack('base:pack:foundation_mult')
    .entry('base:aff:foundation_mult')
    .modEntity('spot', '*', 'mul', 2)
    .build(),
  affectorPack('base:pack:eternal_contract_mult')
    .entry('base:aff:eternal_contract_mult')
    .modEntity('spot', '*', 'mul', 1.5)
    .build(),
  affectorPack('base:pack:unified_logistics_flow')
    .entry('base:aff:unified_logistics_flow')
    .flow(Resource.Credit, 1)
    .build(),
];

// 数据包级 Extra 全局常量表示例：扁平键 → 节点值，加载时展开为树（见 docs/13 §5.3）。
const baseExtras: Record<string, ExtraValue> = {
  'meta/author': extra.str('AronaClicker Team'),
  'meta/version': extra.str('1.0.0'),
  'balance/start-credit': extra.int(0),
};

export const baseDatapack: Datapack = {
  name: 'AronaClicker Base',
  version: '1.0.0',
  inits: baseInits,
  areas: baseAreas,
  spots: baseSpots,
  enhancements: [...baseEnhancements, ...baseGlobalEnhancements],
  activeStories: [...baseActiveStories, ...baseBondStoryEntries],
  passiveStories: basePassiveStories,
  passivePools: basePassivePools,
  stories: [...baseStories, ...baseBondStories],
  items: baseItems,
  dropTables: baseDropTables,
  affectorPacks: baseAffectorPacks,
  triggerDefs: baseTriggers,
  funcletDefs: [],
  characters: allCharacters,
  characterBonuses: [],
  characterVariants: baseCharacterVariants,
  cultivateCurves: baseCultivateCurves,
  colors: baseColors,
  colorGroups: baseColorGroups,
  colorEquipments: baseColorEquipments,
  gachaPools: baseGachaPools,
  chatMessages: baseChatMessages,
  characterPersistConfig: baseCharacterPersistConfig,
  resourceDisplays: baseResourceDisplays,
  pics: basePics,
  charaProfiles: baseCharaProfiles,
  extras: baseExtras,
};
