import { Resource, enhancement } from '../../engine/types';
import type { EnhancementDef } from '../../engine/types';

const CREDIT = Resource.Credit;
const PYROXENE = Resource.Pyroxene;

/**
 * 基础增强包。所有产出加成统一经 affectorPackIds 挂载的 Affector 包声明
 *（其 zoneModifiers 经桥接层转写为 PlayerState 的 tag/entity 效果，由 GameNum 的
 * zone 叶子聚合；不再使用 EnhancementDef.productionMultiplier/productionTags）。
 */
export const baseEnhancements: EnhancementDef[] = [
  enhancement('base:enh:credit_system')
    .name('财政系统升级').desc('全局信用点产出 ×1.5。')
    .tags(['core'])
    .affectorPack('base:pack:credit_system_mult')
    .cost(CREDIT, 200)
    .build(),

  enhancement('base:enh:office_layout')
    .name('办公室动线优化').desc('office 标签 Spot 产出 ×1.25。')
    .tags(['core'])
    .affectorPack('base:pack:office_layout_mult')
    .cost(CREDIT, 150)
    .build(),

  enhancement('base:enh:field_logistics')
    .name('野外后勤协议')
    .desc('field / combat / tactical 标签 Spot 产出 ×1.35；并为其注入「重启进程」外源功能。')
    .tags(['field'], ['field', 'logistics'])
    .affectorPack('base:pack:field_logistics_mult')
    .cost(CREDIT, 200)
    .addsFunctionality({ id: 'restart', kind: 'restartInit' })
    .build(),

  enhancement('base:enh:combat_drone')
    .name('战斗无人机').desc('combat 标签 Spot 产出 ×1.35。')
    .tags(['combat'], ['combat', 'tech'])
    .affectorPack('base:pack:combat_drone_mult')
    .cost(CREDIT, 200)
    .build(),

  enhancement('base:enh:field_medicine')
    .name('战地医疗').desc('活化（医疗）加成，医疗站恢复量提升。')
    .tags(['field'], ['field', 'medical'])
    .cost(CREDIT, 180)
    .build(),

  enhancement('base:enh:intel_network')
    .name('情报网络').desc('情报处理效率提升。')
    .tags(['intel'], ['intel', 'network'])
    .cost(CREDIT, 160)
    .build(),

  enhancement('base:enh:training_program')
    .name('训练计划').desc('人员效率提升。')
    .tags(['core'])
    .cost(CREDIT, 120)
    .build(),

  enhancement('base:enh:medical_station')
    .name('医疗站扩建').desc('医疗站产能提升。')
    .tags(['field'], ['field', 'medical'])
    .cost(CREDIT, 180)
    .build(),

  enhancement('base:enh:rapid_deployment')
    .name('快速部署').desc('部署速度提升。')
    .tags(['field'])
    .cost(CREDIT, 140)
    .build(),

  enhancement('base:enh:area_hub')
    .name('区域枢纽').desc('区域中转效率提升。')
    .tags(['area'])
    .cost(CREDIT, 220)
    .build(),

  enhancement('base:enh:research_grant')
    .name('研究拨款').desc('全局产出 ×1.4（研究加成）。')
    .tags(['core'])
    .affectorPack('base:pack:research_grant_mult')
    .cost(CREDIT, 260)
    .build(),

  enhancement('base:enh:investment_fund')
    .name('投资基金').desc('全局产出 ×1.3（资金杠杆）。')
    .tags(['core'])
    .affectorPack('base:pack:investment_fund_mult')
    .cost(CREDIT, 240)
    .build(),

  enhancement('base:enh:pyroxene_rush')
    .name('燧石速采').desc('全局燧石产出 ×1.8；并额外 +1 燧石/分钟。')
    .tags(['field'])
    .affectorPacks('base:pack:pyroxene_flow', 'base:pack:pyroxene_rush_mult')
    .cost(PYROXENE, 20)
    .build(),

  enhancement('base:enh:tactical_command')
    .name('战术指挥').desc('tactical 标签 Spot 产出 ×1.3。')
    .tags(['tactical'], ['tactical', 'command'])
    .affectorPack('base:pack:tactical_command_mult')
    .cost(CREDIT, 200)
    .build(),

  enhancement('base:enh:supply_chain')
    .name('供应链优化').desc('全局产出 ×1.6（后勤加成）。')
    .tags(['core'])
    .affectorPack('base:pack:supply_chain_mult')
    .cost(CREDIT, 300)
    .build(),

  enhancement('base:enh:energy_supply')
    .name('能源供给').desc('全局产出 ×1.25；并额外 +1 信用点/分钟。')
    .tags(['core'])
    .affectorPacks('base:pack:energy_drink', 'base:pack:energy_supply_mult')
    .cost(CREDIT, 150)
    .build(),

  enhancement('base:enh:sanctuary_field')
    .name('庇护所协议').desc('全局产出 ×1.5（庇护所加成）。')
    .tags(['core'])
    .affectorPack('base:pack:sanctuary_field_mult')
    .cost(CREDIT, 280)
    .build(),

  // 测试用：初始免费，每 tick +2500 青辉石
  enhancement('base:enh:test_pyroxene_cheat')
    .name('代号：燧石·改').desc('每 tick +2500 青辉石（测试专用）。')
    .tags(['core'])
    .affectorPack('base:pack:pyroxene_flow')
    .build(),
];

/**
 * 全局强化（GlobalEnhancement）：attachment.kind = 'global'，只经「选择页 → 翻面 → 全局强化」
 * 购买/启用（热插拔），不进入右侧强化面板。全局作用域经 affectorPackIds 的 zoneModifiers 声明。
 * irreversible 的强化获得后不可撤回。
 */
export const baseGlobalEnhancements: EnhancementDef[] = [
  enhancement('base:enh:foundation')
    .name('全能基建').desc('全局信用点产出 ×2.0（基建奠基）。')
    .tags(['core'])
    .attachGlobal()
    .affectorPack('base:pack:foundation_mult')
    .cost(PYROXENE, 50)
    .build(),

  enhancement('base:enh:unified_logistics')
    .name('全域物流').desc('每 tick 额外 +1 信用点（全域物流）。')
    .tags(['core'], ['logistics'])
    .attachGlobal()
    .affectorPack('base:pack:unified_logistics_flow')
    .cost(CREDIT, 500)
    .build(),

  enhancement('base:enh:eternal_contract')
    .name('永恒契约').desc('全局产出 ×1.5（不可撤回）。')
    .tags(['core'])
    .attachGlobal()
    .irreversible()
    .affectorPack('base:pack:eternal_contract_mult')
    .cost(PYROXENE, 150)
    .build(),
];