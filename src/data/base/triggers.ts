// ============================================================
// data/base/triggers.ts — 基础 Trigger 示例（对外 DSL）
//
// 侦测条件（on）+ 附加条件（condition，可引用统计 DSL / tag / 状态）
// + 执行效果（effects）。内容作者无需接触 EventBus/ConditionSystem/EffectEngine。
// ============================================================

import { TriggerDef, and, Resource } from '../../engine/types';

export const baseTriggers: TriggerDef[] = [
  {
    id: 'base:trigger:first_credit_milestone',
    // 侦测：每帧检查（资源在变化）
    on: { kind: 'tick' },
    // 条件：全局累计产出达到 100 信用点（统计 DSL 懒求值）
    condition: and({
      target: 'stat',
      key: '$GlobalProducedAmount base:resource:credit',
      comparator: '>=',
      value: 100,
    }),
    effects: [
      { op: 'addResource', target: Resource.Credit, value: 25 },
    ],
    once: true,
  },
  {
    id: 'base:trigger:office_mastered',
    // 侦测：任意设施等级变化
    on: { kind: 'spotLevel' },
    // 条件：拥有 ≥2 个带 office 标签的设施
    condition: and({
      target: 'countTags',
      key: 'office',
      comparator: '>=',
      value: 2,
    }),
    effects: [
      { op: 'setFlag', target: 'office_mastered', value: '1' },
    ],
    once: true,
  },
  {
    id: 'base:trigger:welcome_reward',
    // 侦测：完成欢迎剧情
    on: { kind: 'story', storyId: 'base:story:schale_welcome' },
    effects: [
      { op: 'addItem', target: 'base:item:energy_drink', value: 1 },
    ],
    once: true,
  },
  // ============================================================
  // 阿比多斯里程碑
  // ============================================================
  {
    id: 'base:trigger:abydos_first_milestone',
    on: { kind: 'tick' },
    condition: and({
      target: 'stat',
      key: '$InitProducedAmount base:init:abydos base:resource:credit',
      comparator: '>=',
      value: 80,
    }),
    effects: [
      { op: 'addResource', target: Resource.Credit, value: 30 },
      { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
    ],
    once: true,
  },
  // ============================================================
  // 千禧年里程碑
  // ============================================================
  {
    id: 'base:trigger:millennium_first_milestone',
    on: { kind: 'tick' },
    condition: and({
      target: 'stat',
      key: '$InitProducedAmount base:init:millennium base:resource:credit',
      comparator: '>=',
      value: 100,
    }),
    effects: [
      { op: 'addResource', target: Resource.Credit, value: 40 },
      { op: 'addItem', target: 'base:item:data_chip', value: 3 },
    ],
    once: true,
  },
  // ============================================================
  // 崔妮蒂里程碑
  // ============================================================
  {
    id: 'base:trigger:trinity_first_milestone',
    on: { kind: 'tick' },
    condition: and({
      target: 'stat',
      key: '$InitProducedAmount base:init:trinity base:resource:credit',
      comparator: '>=',
      value: 100,
    }),
    effects: [
      { op: 'addResource', target: Resource.Credit, value: 35 },
      { op: 'addItem', target: 'base:item:mystery_fragment', value: 2 },
    ],
    once: true,
  },
  // ============================================================
  // 盖赫纳里程碑
  // ============================================================
  {
    id: 'base:trigger:gehenna_first_milestone',
    on: { kind: 'tick' },
    condition: and({
      target: 'stat',
      key: '$InitProducedAmount base:init:gehenna base:resource:credit',
      comparator: '>=',
      value: 100,
    }),
    effects: [
      { op: 'addResource', target: Resource.Credit, value: 35 },
      { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
    ],
    once: true,
  },
  // ============================================================
  // 全局信用点里程碑：500
  // ============================================================
  {
    id: 'base:trigger:milestone_500',
    on: { kind: 'tick' },
    condition: and({
      target: 'stat',
      key: '$GlobalProducedAmount base:resource:credit',
      comparator: '>=',
      value: 500,
    }),
    effects: [
      { op: 'addResource', target: Resource.Credit, value: 50 },
      { op: 'addItem', target: 'base:item:premium_drink', value: 1 },
      { op: 'setFlag', target: 'milestone_500_reached', value: '1' },
    ],
    once: true,
  },
  // ============================================================
  // 全局信用点里程碑：1000
  // ============================================================
  {
    id: 'base:trigger:milestone_1000',
    on: { kind: 'tick' },
    condition: and({
      target: 'stat',
      key: '$GlobalProducedAmount base:resource:credit',
      comparator: '>=',
      value: 1000,
    }),
    effects: [
      { op: 'addResource', target: Resource.Credit, value: 100 },
      { op: 'addItem', target: 'base:item:peroro_doll', value: 1 },
      { op: 'setFlag', target: 'milestone_1000_reached', value: '1' },
    ],
    once: true,
  },
];
