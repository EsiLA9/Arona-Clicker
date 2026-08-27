// ============================================================
// data/base/triggers.ts — 基础 Trigger 示例（对外 DSL）
//
// 侦测条件（on）+ 附加条件（condition，可引用统计 DSL / tag / 状态）
// + 执行效果（effects）。内容作者无需接触 EventBus/ConditionSystem/EffectEngine。
// ============================================================

import { trigger, and, cond, Resource } from '../../engine/types';
import type { TriggerDef } from '../../engine/types';

export const baseTriggers: TriggerDef[] = [
  // 侦测：每帧检查（资源在变化）；条件：全局累计产出达到 100 信用点（统计 DSL 懒求值）
  trigger('base:trigger:first_credit_milestone')
    .onTick()
    .when(and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 100)))
    .effects({ op: 'addResource', target: Resource.Credit, value: 25 })
    .build(),

  // 侦测：任意设施等级变化；条件：拥有 ≥2 个带 office 标签的设施
  trigger('base:trigger:office_mastered')
    .onSpotLevel()
    .when(and(cond('countTags', 'office', '>=', 2)))
    .effects({ op: 'setFlag', target: 'office_mastered', value: '1' })
    .build(),

  // 侦测：完成欢迎剧情
  trigger('base:trigger:welcome_reward')
    .onStory('base:story:schale_welcome')
    .effects({ op: 'addItem', target: 'base:item:energy_drink', value: 1 })
    .build(),

  // ============================================================
  // 阿比多斯里程碑
  // ============================================================
  trigger('base:trigger:abydos_first_milestone')
    .onTick()
    .when(and(cond('stat', '$InitProducedAmount base:init:abydos base:resource:credit', '>=', 80)))
    .effects(
      { op: 'addResource', target: Resource.Credit, value: 30 },
      { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
    )
    .build(),

  // ============================================================
  // 千禧年里程碑
  // ============================================================
  trigger('base:trigger:millennium_first_milestone')
    .onTick()
    .when(and(cond('stat', '$InitProducedAmount base:init:millennium base:resource:credit', '>=', 100)))
    .effects(
      { op: 'addResource', target: Resource.Credit, value: 40 },
      { op: 'addItem', target: 'base:item:data_chip', value: 3 },
    )
    .build(),

  // ============================================================
  // 崔妮蒂里程碑
  // ============================================================
  trigger('base:trigger:trinity_first_milestone')
    .onTick()
    .when(and(cond('stat', '$InitProducedAmount base:init:trinity base:resource:credit', '>=', 100)))
    .effects(
      { op: 'addResource', target: Resource.Credit, value: 35 },
      { op: 'addItem', target: 'base:item:mystery_fragment', value: 2 },
    )
    .build(),

  // ============================================================
  // 盖赫纳里程碑
  // ============================================================
  trigger('base:trigger:gehenna_first_milestone')
    .onTick()
    .when(and(cond('stat', '$InitProducedAmount base:init:gehenna base:resource:credit', '>=', 100)))
    .effects(
      { op: 'addResource', target: Resource.Credit, value: 35 },
      { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
    )
    .build(),

  // ============================================================
  // 全局信用点里程碑：500
  // ============================================================
  trigger('base:trigger:milestone_500')
    .onTick()
    .when(and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 500)))
    .effects(
      { op: 'addResource', target: Resource.Credit, value: 50 },
      { op: 'addItem', target: 'base:item:premium_drink', value: 1 },
      { op: 'setFlag', target: 'milestone_500_reached', value: '1' },
    )
    .build(),

  // ============================================================
  // 全局信用点里程碑：1000
  // ============================================================
  trigger('base:trigger:milestone_1000')
    .onTick()
    .when(and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 1000)))
    .effects(
      { op: 'addResource', target: Resource.Credit, value: 100 },
      { op: 'addItem', target: 'base:item:peroro_doll', value: 1 },
      { op: 'setFlag', target: 'milestone_1000_reached', value: '1' },
    )
    .build(),
];