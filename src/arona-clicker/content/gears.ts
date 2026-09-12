// ============================================================
// arona-clicker/content/gears.ts — base 示例装备（Gear）内容
//
// 全部数值为占位示例，供 UI 联调与验收；正式数值由策划另给表，不放引擎。
// 见 docs/plan-work/newPlan/11-gear-equipment-system。
// ============================================================

import { gear, gearCost, item } from './def-factory';
import type { Effect } from '../../engine/types/expression';
import type { ItemDef } from '../../data-services/contracts/item';
import type { GearConfigDef, GearDef, GearSlotKind } from '../types/character';
import { Resource } from '../types/ids';

/** 装备类型线声明；scale 表示不同装备的培养侧重强度（示意）。 */
interface GearLineSpec {
  id: string;
  slot: GearSlotKind;
  name: string;
  description: string;
  scale: number;
}

const GEAR_LINES: GearLineSpec[] = [
  { id: 'attack-hat', slot: 'attack', name: '攻击装备·帽子', description: '阿比多斯制式战术帽，提升学生的作战意识。', scale: 1 },
  { id: 'attack-glove', slot: 'attack', name: '攻击装备·手套', description: '强化握持与射击稳定性的战术手套。', scale: 1.2 },
  { id: 'defense-vest', slot: 'defense', name: '防御装备·防弹背心', description: '标准配发的防弹背心，兼顾防护与机动。', scale: 0.8 },
  { id: 'defense-shoes', slot: 'defense', name: '防御装备·护甲靴', description: '带护甲片的战术靴，提升战场生存能力。', scale: 0.9 },
  { id: 'special-badge', slot: 'special', name: '特殊装备·徽章', description: '寄托信念的徽章，激发学生的额外干劲。', scale: 1.1 },
  { id: 'special-watch', slot: 'special', name: '特殊装备·腕表', description: '精密战术腕表，帮助把握行动节奏。', scale: 1.05 },
];

/** 示例层级数（蔚蓝档案本体为 T1–T10）。 */
const MAX_TIER = 10;

const gearIdOf = (lineId: string): string => `base:gear:${lineId}`;
const blueprintItemId = (lineId: string, tier: number): string => `base:item:gear-bp-${lineId}-t${tier}`;

/** 示例效果：以信用点加成示意（引擎当前无独立战斗属性表）。 */
function creditEffect(amount: number): Effect {
  return { op: 'addResource', target: Resource.Credit, value: Math.round(amount) };
}

/** 图纸物品：每条类型线每 tier 一个。 */
const baseGearBlueprintItems: ItemDef[] = GEAR_LINES.flatMap(line =>
  Array.from({ length: MAX_TIER }, (_, index) => {
    const tier = index + 1;
    const rarity = tier >= 8 ? 'legendary' : tier >= 5 ? 'epic' : tier >= 3 ? 'rare' : 'common';
    return item(blueprintItemId(line.id, tier))
      .name(`${line.name} 图纸 T${tier}`)
      .desc(`${line.name} 的第 ${tier} 阶图纸，用于装配或升级该装备。`)
      .maxStack(999).rarity(rarity).type('material')
      .build();
  }));

/** 装备经验材料物品。 */
const baseGearExpItems: ItemDef[] = [
  item('base:item:gear-exp-basic')
    .name('初级装备强化石').desc('为装备提供 100 点装备经验。')
    .maxStack(999).rarity('common').type('material').build(),
  item('base:item:gear-exp-advanced')
    .name('高级装备强化石').desc('为装备提供 500 点装备经验。')
    .maxStack(999).rarity('rare').type('material').build(),
];

/** base 示例装备涉及的物品（图纸 + 经验材料）。 */
export const baseGearItems: ItemDef[] = [...baseGearBlueprintItems, ...baseGearExpItems];

/**
 * base 示例装备类型线：每 tier 自带基础效果 + 每级线性成长。
 * 装配消耗 T1 图纸 ×1；升到第 N 阶消耗 T(N) 图纸 ×N。
 */
export const baseGears: GearDef[] = GEAR_LINES.map(line => {
  const builder = gear(gearIdOf(line.id)).name(line.name).desc(line.description).slot(line.slot);
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    builder.tier(tier, tier * 10, 100 * tier, {
      upgradeCost: [gearCost(blueprintItemId(line.id, tier), tier === 1 ? 1 : tier)],
      baseEffects: [creditEffect(100 * tier * line.scale)],
      perLevelEffects: [creditEffect(10 * tier * line.scale)],
    });
  }
  return builder.build();
});

/** base 示例装备成长配置：经验材料换算。 */
export const baseGearConfig: GearConfigDef = {
  expItems: [
    { itemId: 'base:item:gear-exp-basic', exp: 100 },
    { itemId: 'base:item:gear-exp-advanced', exp: 500 },
  ],
};
