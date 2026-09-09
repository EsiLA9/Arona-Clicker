import { enhancement } from './def-factory';
import type { EnhancementDef } from '../../data-services/contracts/enhancement';
import { and, cond, or } from '../../engine/types';

const CREDIT = Resource.Credit;
const PYROXENE = Resource.Pyroxene;

export const baseEnhancements: EnhancementDef[] = [
  enhancement('base:enhancement:credit_system').name('财政系统升级').desc('全局信用点产出 ×1.5。').tags(['core']).affectorPack('base:affectorpack:credit_system_mult').cost(CREDIT, 200).build(),
  enhancement('base:enhancement:office_layout').name('办公室动线优化').desc('office 标签 Spot 产出 ×1.25。').tags(['core']).affectorPack('base:affectorpack:office_layout_mult').cost(CREDIT, 150).build(),
  enhancement('base:enhancement:field_logistics').name('野外后勤协议').desc('field / combat / tactical 标签 Spot 产出 ×1.35；并为其注入「重启进程」外源功能。').tags(['field'], ['field', 'logistics']).affectorPack('base:affectorpack:field_logistics_mult').cost(CREDIT, 200).addsFunctionality({ id: 'restart', kind: 'restartInit' }).build(),
  enhancement('base:enhancement:combat_drone').name('战斗无人机').desc('combat 标签 Spot 产出 ×1.35。').tags(['combat'], ['combat', 'tech']).affectorPack('base:affectorpack:combat_drone_mult').cost(CREDIT, 200).build(),
  enhancement('base:enhancement:field_medicine').name('战地医疗').desc('活化（医疗）加成，医疗站恢复量提升。').tags(['field'], ['field', 'medical']).cost(CREDIT, 180).build(),
  enhancement('base:enhancement:intel_network').name('情报网络').desc('情报处理效率提升。').tags(['intel'], ['intel', 'network']).cost(CREDIT, 160).build(),
  enhancement('base:enhancement:training_program').name('训练计划').desc('人员效率提升。').tags(['core']).cost(CREDIT, 120).build(),
  enhancement('base:enhancement:medical_station').name('医疗站扩建').desc('医疗站产能提升。').tags(['field'], ['field', 'medical']).cost(CREDIT, 180).build(),
  enhancement('base:enhancement:rapid_deployment').name('快速部署').desc('部署速度提升。').tags(['field']).cost(CREDIT, 140).build(),
  enhancement('base:enhancement:area_hub').name('区域枢纽').desc('区域中转效率提升。').tags(['area']).cost(CREDIT, 220).build(),
  enhancement('base:enhancement:research_grant').name('研究拨款').desc('全局产出 ×1.4（研究加成）。').tags(['core']).affectorPack('base:affectorpack:research_grant_mult').cost(CREDIT, 260).build(),
  enhancement('base:enhancement:investment_fund').name('投资基金').desc('全局产出 ×1.3（资金杠杆）。').tags(['core']).affectorPack('base:affectorpack:investment_fund_mult').cost(CREDIT, 240).build(),
  enhancement('base:enhancement:pyroxene_rush').name('燧石速采').desc('全局燧石产出 ×1.8；并额外 +1 燧石/分钟。').tags(['field']).affectorPacks('base:affectorpack:pyroxene_flow', 'base:affectorpack:pyroxene_rush_mult').cost(PYROXENE, 20).build(),
  enhancement('base:enhancement:tactical_command').name('战术指挥').desc('tactical 标签 Spot 产出 ×1.3。').tags(['tactical'], ['tactical', 'command']).affectorPack('base:affectorpack:tactical_command_mult').cost(CREDIT, 200).build(),
  enhancement('base:enhancement:supply_chain').name('供应链优化').desc('全局产出 ×1.6（后勤加成）。').tags(['core']).affectorPack('base:affectorpack:supply_chain_mult').cost(CREDIT, 300).build(),
  enhancement('base:enhancement:energy_supply').name('能源供给').desc('全局产出 ×1.25；并额外 +1 信用点/分钟。').tags(['core']).affectorPacks('base:affectorpack:energy_drink', 'base:affectorpack:energy_supply_mult').cost(CREDIT, 150).build(),
  enhancement('base:enhancement:sanctuary_field').name('庇护所协议').desc('全局产出 ×1.5（庇护所加成）。').tags(['core']).affectorPack('base:affectorpack:sanctuary_field_mult').cost(CREDIT, 280).build(),
  enhancement('base:enhancement:test_pyroxene_cheat').name('代号：燧石·改').desc('每 tick +2500 青辉石（测试专用）。').tags(['core']).affectorPack('base:affectorpack:pyroxene_flow').build(),
];

export const baseGlobalEnhancements: EnhancementDef[] = [
  enhancement('base:enhancement:user-theme-editor').name('主题编辑权限').desc('开放用户自定主题编辑服务。').tags(['core']).attachGlobal().affectorPack('base:affectorpack:user-theme-editor').build(),
  enhancement('base:enhancement:foundation').name('全能基建').desc('全局信用点产出 ×2.0（基建奠基）。').tags(['core']).attachGlobal().affectorPack('base:affectorpack:foundation_mult').cost(PYROXENE, 50).build(),
  enhancement('base:enhancement:unified_logistics').name('全域物流').desc('每 tick 额外 +1 信用点（全域物流）。').tags(['core'], ['logistics']).attachGlobal().affectorPack('base:affectorpack:unified_logistics_flow').cost(CREDIT, 500).build(),
  enhancement('base:enhancement:eternal_contract').name('永恒契约').desc('全局产出 ×1.5（不可撤回）。').tags(['core']).attachGlobal().irreversible().affectorPack('base:affectorpack:eternal_contract_mult').cost(PYROXENE, 150).build(),
  enhancement('base:enhancement:hangar_dispatch_protocol')
    .name('机库调度协议')
    .desc('为夏莱机库建立跨区域出勤调度。')
    .tags(['logistics'], ['logistics', 'vehicle'])
    .attachArea('base:area:schale_hangar')
    .reveal('existence', or(
      and(
        cond('spotLevel', 'base:spot:hangar_dispatch_deck', '>=', 1),
        cond('stat', '$CurrentRunProducedAmount base:resource:credit', '>=', 1200),
      ),
      and(
        cond('hasEnh', 'base:enhancement:supply_chain', '==', 1),
        cond('hasReadStory', 'base:story:schale_flow_show', '==', 1),
      ),
    ))
    .reveal('unlock', and(
      cond('countTags', 'vehicle', '>=', 2),
      or(
        cond('resource', CREDIT, '>=', 800),
        cond('hasEnh', 'base:enhancement:area_hub', '==', 1),
      ),
    ))
    .cost(CREDIT, 420).build(),
  enhancement('base:enhancement:hangar_safety_grid')
    .name('机库安全网')
    .desc('将维护、情报与战术系统接入同一套出勤安全协议。')
    .tags(['vehicle', 'tech'], ['tactical', 'defense'])
    .attachArea('base:area:schale_hangar')
    .reveal('existence', and(
      cond('spotLevel', 'base:spot:hangar_maintenance_bay', '>=', 1),
      or(
        and(
          cond('hasEnh', 'base:enhancement:combat_drone', '==', 1),
          cond('hasEnh', 'base:enhancement:intel_network', '==', 1),
        ),
        and(
          cond('hasReadStory', 'base:story:schale_welcome', '==', 1),
          cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 3000),
        ),
      ),
    ))
    .reveal('unlock', and(
      cond('countTags', 'tech', '>=', 2),
      cond('countTags', 'tactical', '>=', 1),
      or(
        cond('spotLevel', 'base:spot:hangar_command_link', '>=', 1),
        cond('hasEnh', 'base:enhancement:tactical_command', '==', 1),
      ),
    ))
    .cost(CREDIT, 650).build(),
];
import { Resource } from '../types/ids';
