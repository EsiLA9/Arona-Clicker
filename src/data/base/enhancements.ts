// ============================================================
// data/base/enhancements.ts — 基础 Enhancement 定义
// ============================================================

import { EnhancementDef, and, or, Resource } from '../../engine/types';
import { tagPath } from '../../engine/tag';

export const baseEnhancements: EnhancementDef[] = [
  {
    id: 'base:enh:credit_system',
    name: '信用点流通优化',
    description: '优化夏莱内部信用点的流通效率。全部 Spot 的信用点产出 +50%。',
    revealTriggers: [{ reveal: 'unlock', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 50 }) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.5,
    price: [{ resourceId: Resource.Credit, amount: 100 }],
    // 挂靠（UI 显示位置）：仅在夏莱主厅展示；作用域仍为全局
    attachment: { kind: 'area', areaId: 'base:area:schale_main' },
  },
  {
    id: 'base:enh:office_layout',
    name: '办公区整合计划',
    description: '重新规划办公区域的动线，让办公室类 Spot 运转更高效。',
    effects: [],
    autoApply: true,
    productionMultiplier: 1.25,
    productionTags: [tagPath('office')],
    price: [{ resourceId: Resource.Credit, amount: 150 }],
    // 信息揭示示例：随 credit_printer 等级逐级点亮 名称 → 名称+条件 → 效用
    revealTriggers: [
      { reveal: 'unlock', condition: and({ target: 'spotLevel', key: 'base:spot:credit_printer', comparator: '>=', value: 2 }) },
      { reveal: 'name', condition: and({ target: 'spotLevel', key: 'base:spot:credit_printer', comparator: '>=', value: 2 }) },
      { reveal: 'condition', condition: and({ target: 'spotLevel', key: 'base:spot:credit_printer', comparator: '>=', value: 1 }) },
      { reveal: 'utility', condition: and({ target: 'spotLevel', key: 'base:spot:credit_printer', comparator: '>=', value: 3 }) },
    ],
  },
  {
    id: 'base:enh:field_logistics',
    name: '野外补给网络',
    description: '建立野外补给线路，提升野外与战术类 Spot 的产出。',
    revealTriggers: [{ reveal: 'unlock', condition: and({ target: 'spotLevel', key: 'base:spot:field_work', comparator: '>=', value: 2 }) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.35,
    productionTags: [tagPath('field'), tagPath('combat'), tagPath('tactical')],
    price: [{ resourceId: Resource.Credit, amount: 200 }],
    attachment: { kind: 'area', areaId: 'base:area:schale_main' },
    // 外源功能：获得后为命中的野外/战术 Spot 注入"结束当前游戏（重选 Init）"功能
    addsFunctionalities: [
      { id: 'base:func:field_restart', kind: 'restartInit' },
    ],
  },

  // ============================================================
  // 条件验证 Enhancement：覆盖 AND / OR / 嵌套场景
  // ============================================================

  // 1. 纯 AND（两个独立条件）
  {
    id: 'base:enh:test_and_simple',
    name: '【测试·与】双条件并联',
    description: '[AND 条件验证] 需求：信用点 ≥100 且 信用点制造机 ≥2级。两个条件都必须满足才能解锁。',
    revealTriggers: [{ reveal: 'unlock', condition: and(
      { target: 'resource', key: Resource.Credit, comparator: '>=', value: 100 },
      { target: 'spotLevel', key: 'base:spot:credit_printer', comparator: '>=', value: 2 },
    ) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.1,
    price: [{ resourceId: Resource.Credit, amount: 30 }],
    attachment: { kind: 'area', areaId: 'base:area:schale_main' },
  },

  // 2. 纯 OR（任一满足即可）
  {
    id: 'base:enh:test_or_simple',
    name: '【测试·或】二选一入口',
    description: '[OR 条件验证] 需求：野外调查站 ≥1级 或 战术指挥台 ≥1级。只需满足其中一个即可解锁。',
    revealTriggers: [{ reveal: 'unlock', condition: or(
      { target: 'spotLevel', key: 'base:spot:field_work', comparator: '>=', value: 1 },
      { target: 'spotLevel', key: 'base:spot:tactical_desk', comparator: '>=', value: 1 },
    ) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.15,
    productionTags: [tagPath('field'), tagPath('tactical'), tagPath('combat')],
    price: [{ resourceId: Resource.Credit, amount: 40 }],
    attachment: { kind: 'area', areaId: 'base:area:schale_main' },
  },

  // 3. AND 内嵌套 OR
  {
    id: 'base:enh:test_and_nested_or',
    name: '【测试·与或】配置达标线',
    description: '[AND(OR) 嵌套验证] 需求：信用点 ≥200 且 (战术指挥台 ≥2级 或 已拥有信用点流通优化)。内层 OR 任一满足 + 外层 AND 必满足。',
    revealTriggers: [{ reveal: 'unlock', condition: and(
      { target: 'resource', key: Resource.Credit, comparator: '>=', value: 200 },
      or(
        { target: 'spotLevel', key: 'base:spot:tactical_desk', comparator: '>=', value: 2 },
        { target: 'hasEnh', key: 'base:enh:credit_system', comparator: '==', value: 1 },
      ),
    ) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.3,
    price: [{ resourceId: Resource.Credit, amount: 100 }],
    attachment: { kind: 'area', areaId: 'base:area:schale_main' },
  },

  // 4. 多条件纯 AND（三种不同 target）
  {
    id: 'base:enh:test_multi_and',
    name: '【测试·与】三重证书',
    description: '[多条件 AND 验证] 需求：拥有 office 标签的 Spot 且 信用点制造机已派人 且 信用点 ≥150。三种不同类型的条件必须同时满足。',
    revealTriggers: [{ reveal: 'unlock', condition: and(
      { target: 'hasTag', key: 'office', comparator: '==', value: 1 },
      { target: 'manager', key: 'base:spot:credit_printer', comparator: '==', value: 1 },
      { target: 'resource', key: Resource.Credit, comparator: '>=', value: 150 },
    ) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.2,
    price: [{ resourceId: Resource.Credit, amount: 80 }],
    attachment: { kind: 'area', areaId: 'base:area:schale_main' },
  },

  // 5. 多条件纯 OR（四个条件任意满足）
  {
    id: 'base:enh:test_multi_or',
    name: '【测试·或】四海皆可',
    description: '[多条件 OR 验证] 需求：已拥有信用点流通优化 或 办公区整合计划 或 野外补给网络 或 信用点 ≥300。四个条件满足任意一个即可解锁。',
    revealTriggers: [{ reveal: 'unlock', condition: or(
      { target: 'hasEnh', key: 'base:enh:credit_system', comparator: '==', value: 1 },
      { target: 'hasEnh', key: 'base:enh:office_layout', comparator: '==', value: 1 },
      { target: 'hasEnh', key: 'base:enh:field_logistics', comparator: '==', value: 1 },
      { target: 'resource', key: Resource.Credit, comparator: '>=', value: 300 },
    ) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.05,
    price: [{ resourceId: Resource.Credit, amount: 20 }],
    attachment: { kind: 'area', areaId: 'base:area:schale_main' },
  },

  // 6. OR 内嵌套 AND（两组 AND 取 OR）
  {
    id: 'base:enh:test_or_nested_and',
    name: '【测试·或与】双路线进阶',
    description: '[OR(AND) 嵌套验证] 需求：(信用点 ≥200 且 信用点制造机 ≥3级) 或 (信用点 ≥100 且 野外调查站 ≥2级)。两组 AND 满足任意一组即可解锁。',
    revealTriggers: [{ reveal: 'unlock', condition: or(
      and(
        { target: 'resource', key: Resource.Credit, comparator: '>=', value: 200 },
        { target: 'spotLevel', key: 'base:spot:credit_printer', comparator: '>=', value: 3 },
      ),
      and(
        { target: 'resource', key: Resource.Credit, comparator: '>=', value: 100 },
        { target: 'spotLevel', key: 'base:spot:field_work', comparator: '>=', value: 2 },
      ),
    ) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.25,
    price: [{ resourceId: Resource.Credit, amount: 120 }],
    attachment: { kind: 'area', areaId: 'base:area:schale_main' },
  },

  // ============================================================
  // 各学院专属 Enhancement
  // ============================================================

  // 夏莱 — 能量饮料后勤（演示 Enhancement 承载持续 Affector）
  {
    id: 'base:enh:energy_supply',
    name: '能量饮料后勤',
    description: '建立战术能量饮料的稳定供应渠道，每 tick 自动恢复 1 信用点。',
    revealTriggers: [{ reveal: 'unlock', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 50 }) }],
    effects: [],
    autoApply: true,
    affectorPackIds: ['base:pack:energy_drink'],
    price: [{ resourceId: Resource.Credit, amount: 50 }],
    attachment: { kind: 'area', areaId: 'base:area:schale_main' },
  },

  // 阿比多斯 — 沙漠生存指南
  {
    id: 'base:enh:desert_survival',
    name: '沙漠生存指南',
    description: '阿比多斯对策委员会积累的沙漠作战经验。野外与防御类 Spot 产出 +40%。',
    revealTriggers: [{ reveal: 'unlock', condition: and({ target: 'spotLevel', key: 'base:spot:abydos_rehab', comparator: '>=', value: 2 }) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.4,
    productionTags: [tagPath('field'), tagPath('defense'), tagPath('training')],
    price: [{ resourceId: Resource.Credit, amount: 180 }],
    attachment: { kind: 'area', areaId: 'base:area:abydos_campus' },
  },

  // 千禧年 — 数据挖掘协议
  {
    id: 'base:enh:data_mining',
    name: '数据挖掘协议',
    description: '千禧年工程部研发的高效数据挖矿算法。科技与情报类 Spot 产出 +50%。',
    revealTriggers: [{ reveal: 'unlock', condition: and({ target: 'spotLevel', key: 'base:spot:millennium_lab', comparator: '>=', value: 2 }) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.5,
    productionTags: [tagPath('tech'), tagPath('intel'), tagPath('data')],
    price: [{ resourceId: Resource.Credit, amount: 220 }],
    attachment: { kind: 'area', areaId: 'base:area:millennium_lab' },
  },

  // 崔妮蒂 — 圣所祝福
  {
    id: 'base:enh:cathedral_blessing',
    name: '圣所祝福',
    description: '崔妮蒂大圣堂的祝福降临。信仰与礼仪类 Spot 产出 +35%。',
    revealTriggers: [{ reveal: 'unlock', condition: and({ target: 'spotLevel', key: 'base:spot:trinity_donation', comparator: '>=', value: 2 }) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.35,
    productionTags: [tagPath('faith'), tagPath('courtesy')],
    price: [{ resourceId: Resource.Credit, amount: 200 }],
    attachment: { kind: 'area', areaId: 'base:area:trinity_cathedral' },
  },

  // 盖赫纳 — 万魔殿的「效率」
  {
    id: 'base:enh:gehenna_discipline',
    name: '万魔殿的效率学',
    description: '看似混乱的万魔殿，其实有着一套独特的效率法则。行政与商业类 Spot 产出 +40%。',
    revealTriggers: [{ reveal: 'unlock', condition: and({ target: 'spotLevel', key: 'base:spot:gehenna_hall', comparator: '>=', value: 2 }) }],
    effects: [],
    autoApply: true,
    productionMultiplier: 1.4,
    productionTags: [tagPath('admin'), tagPath('business'), tagPath('outlaw')],
    price: [{ resourceId: Resource.Credit, amount: 210 }],
    attachment: { kind: 'area', areaId: 'base:area:gehenna_council' },
  },
];
