// ============================================================
// data/base/datapack.ts — 基础数据包汇总
// ============================================================

import { Datapack, ExtraValue, Resource, ResourceDisplayDef } from '../../engine/types';
import { extra } from '../../engine/extra';
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
  baseCultivateCurves,
  baseGachaPools,
} from './character-rework';
import { baseItems } from './items';
import { baseDropTables } from './drop-tables';
import { baseActiveStories, basePassiveStories, basePassivePools, baseStories } from './stories';
import { baseEnhancements } from './enhancements';
import { baseTriggers } from './triggers';

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

const baseAffectorPacks = [
  {
    id: 'base:pack:energy_drink',
    // Def 级 extra 示例：结构化元数据（见 docs/13 §5.2），运行时零消费
    extra: extra.dict({
      desc: extra.str('能量饮料：每次点击 +1 信用点'),
      tier: extra.int(1),
    }),
    entries: [{
      id: 'base:aff:energy_drink',
      effects: [{ op: 'addResource' as const, target: Resource.Credit, value: 1 }],
    }],
  },
  {
    // 测试用：青辉石量产管线（配合 base:enh:pyroxene_rush）
    id: 'base:pack:pyroxene_flow',
    extra: extra.dict({
      desc: extra.str('青辉石提纯回路：每 tick +2500 青辉石'),
      tier: extra.int(0),
    }),
    entries: [{
      id: 'base:aff:pyroxene_flow',
      effects: [{ op: 'addResource' as const, target: Resource.Pyroxene, value: 2500 }],
    }],
  },
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
  enhancements: baseEnhancements,
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
  gachaPools: baseGachaPools,
  chatMessages: baseChatMessages,
  characterPersistConfig: baseCharacterPersistConfig,
  resourceDisplays: baseResourceDisplays,
  extras: baseExtras,
};
