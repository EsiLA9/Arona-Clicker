// ============================================================
// ui/components/tooltip-enhancement.ts — 强化诊断：条件/统计/产出倍率描述
// 从 tooltip.ts 拆出：STAT_TEXT / describeStatDsl / describeConditionItem /
//   describeCondition / getEnhancementMultiplier / getSpotYieldBreakdown
// ============================================================

import { Condition, ConditionGroup, SpotDef } from '../../engine/types';
import { parseStatCall } from '../../engine/expression/stat-dsl';
import { UIContext } from '../context';

/** 统计函数 DSL 的函数名 → 正式文体模板（{init}=世界线名，{key}=资源/物品名）。 */
const STAT_TEXT: Record<string, string> = {
  // 产出 / 消耗（key = 资源）
  $GlobalProducedAmount: '全局累计产出 {key}',
  $CurrentRunProducedAmount: '本次游玩累计产出 {key}',
  $InitProducedAmount: '在 {init} 累计产出 {key}',
  $GlobalConsumedAmount: '全局累计消耗 {key}',
  $CurrentRunConsumedAmount: '本次游玩累计消耗 {key}',
  $InitConsumedAmount: '在 {init} 累计消耗 {key}',
  // 获得 / 使用（key = 物品）
  $GlobalCollectedAmount: '全局累计获得 {key}',
  $CurrentRunCollectedAmount: '本次游玩累计获得 {key}',
  $InitCollectedAmount: '在 {init} 累计获得 {key}',
  $GlobalUsedAmount: '全局累计使用 {key}',
  $CurrentRunUsedAmount: '本次游玩累计使用 {key}',
  $InitUsedAmount: '在 {init} 累计使用 {key}',
  // 计数类（无 key）
  $GlobalUnlockedSpots: '全局已解锁设施数',
  $CurrentRunUnlockedSpots: '本次游玩已解锁设施数',
  $InitUnlockedSpots: '在 {init} 已解锁设施数',
  $GlobalUpgradedSpots: '全局升级设施数',
  $CurrentRunUpgradedSpots: '本次游玩升级设施数',
  $InitUpgradedSpots: '在 {init} 升级设施数',
  $GlobalUnlockedEnhancements: '全局已解锁强化数',
  $CurrentRunUnlockedEnhancements: '本次游玩已解锁强化数',
  $InitUnlockedEnhancements: '在 {init} 已解锁强化数',
  $GlobalCompletedStories: '全局已完成剧情数',
  $CurrentRunCompletedStories: '本次游玩已完成剧情数',
  $InitCompletedStories: '在 {init} 已完成剧情数',
  $GlobalUnlockedInits: '全局已解锁世界线数',
  $CurrentRunUnlockedInits: '本次游玩已解锁世界线数',
  $InitUnlockedInits: '在 {init} 已解锁世界线数',
  $GlobalFramesActive: '全局运行帧数',
  $CurrentRunFramesActive: '本次游玩运行帧数',
  $InitFramesActive: '在 {init} 运行帧数',
  $InitFramesInInit: '在 {init} 停留帧数',
};

/**
 * 将统计函数 DSL（如 `$GlobalProducedAmount base:resource:credit`）转义为正式文体，
 * 供 hover 条件描述展示。无法解析（未知函数 / 缺参）时原样返回。
 */
export function describeStatDsl(dsl: string, nameOf: (type: string, id: string) => string): string {
  const q = parseStatCall(dsl);
  if (!q) return dsl;
  const template = STAT_TEXT[q.fn];
  if (!template) return dsl;
  const key = q.key !== undefined
    ? nameOf(q.def.metric === 'itemsCollected' || q.def.metric === 'itemsUsed' ? 'item' : 'resource', q.key)
    : '';
  const init = q.initId ? nameOf('init', q.initId) : '';
  return template.replace('{key}', key).replace('{init}', init);
}

/** 单条原子条件转文本（仅覆盖原型中使用的常见形式）。 */
function describeConditionItem(c: Condition, nameOf: (type: string, id: string) => string): string {
  const valueLabel = c.value.toString();
  switch (c.target) {
    case 'resource': return `${nameOf('resource', c.key)} ${c.comparator} ${valueLabel}`;
    case 'spotLevel': return `${nameOf('spot', c.key)} 等级 ${c.comparator} ${valueLabel}`;
    case 'manager': return `${nameOf('spot', c.key)} 已分配 Manager`;
    case 'flag': return `标记 ${c.key}`;
    case 'hasEnh': return `已拥有 ${nameOf('enh', c.key)}`;
    case 'hasTag': return `拥有 "${c.key}" 标签`;
    case 'countTags': return `"${c.key}" 标签数 ${c.comparator} ${valueLabel}`;
    case 'stat': {
      const statText = describeStatDsl(c.key, nameOf);
      return `${statText} ${c.comparator} ${valueLabel}`;
    }
    case 'hasReadStory': return `已完成故事 ${nameOf('story', c.key)}`;
    case 'hasReadStoryInRun': return `本次游玩已完成 ${nameOf('story', c.key)}`;
    default: return `${c.target} ${c.key} ${c.comparator} ${valueLabel}`;
  }
}

/** 条件文本描述：单条原子条件或条件组（仅覆盖原型中使用的常见形式）。 */
export function describeCondition(
  cond: Condition | ConditionGroup | undefined,
  nameOf: (type: string, id: string) => string = (_, id) => id,
): string {
  if (!cond) return '无条件';
  if (!('conditions' in cond) || !('type' in cond)) {
    return describeConditionItem(cond as Condition, nameOf);
  }
  const group = cond as ConditionGroup;
  if (!group.conditions.length) return '无条件';
  const parts = group.conditions.map(condition => {
    if ('type' in condition && 'conditions' in condition) {
      return `(${describeCondition(condition as ConditionGroup, nameOf)})`;
    }
    return describeConditionItem(condition as Condition, nameOf);
  });
  return parts.join(group.type === 'AND' ? ' 且 ' : ' 或 ');
}

/** 计算某 Spot 适用的产出倍率（统一经 GameNum 的 zone 聚合）。 */
export function getEnhancementMultiplier(ctx: UIContext, spot: SpotDef): number {
  return ctx.game.gameNumSystem.getSpotMultiplier(spot.id, ctx.game.state as never);
}

export interface YieldBreakdown {
  base: number;
  managerBonus: number;
  tagMultiplier: number;
  enhMultiplier: number;
  total: number;
}

/** 与 TickSystem 一致的产出分解，供 hover 展示（manager 加成已冻结，恒 0/1）。 */
export function getSpotYieldBreakdown(ctx: UIContext, spot: SpotDef): YieldBreakdown {
  const base = ctx.game.valueSystem.evaluate(spot.baseYield, ctx.game.state as never);
  const enhMultiplier = getEnhancementMultiplier(ctx, spot);
  return {
    base,
    managerBonus: 0,
    tagMultiplier: 1,
    enhMultiplier,
    total: base * enhMultiplier,
  };
}
