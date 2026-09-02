// ============================================================
// engine/condition-system.ts — Condition / ConditionGroup 求值系统
//
// target → 求值器注册表（模块级常量，Record 键穷尽 ConditionTarget 全集）：
// 新增 target = ConditionTarget 联合加成员 + TARGET_EVALUATORS 加一条
// （需要外部数据时在 ConditionSystem 加 @internal 依赖 + setXxx 注入）。
// 数据包 JSON 可能携带未知 target：查找失败回落 0（保持原 default 语义）。
// ============================================================

import { Condition, ConditionGroup, ConditionTarget, Comparator, ExtraPath, ExtraValue } from '../types';
import type { ConditionState } from '../contracts/state-query';
import type { ConditionEvaluationContext } from '../contracts/evaluation-context';
import { parseTagId, TagPath } from '../core/tag';
import { toNumber } from '../extra/index';

/** 单个 target 的求值器：从状态与注入依赖读取 actual 数值。 */
type TargetEvaluator = (sys: ConditionSystem, cond: Condition, state: ConditionState) => number;

const TARGET_EVALUATORS: Record<ConditionTarget, TargetEvaluator> = {
  resource: (_sys, cond, state) => state.resources[cond.key] ?? 0,
  spotLevel: (_sys, cond, state) => state.spotLevels[cond.key] ?? 0,
  manager: (_sys, cond, state) => {
    const manager = state.spotManagers[cond.key];
    return manager && manager !== 'none' ? 1 : 0;
  },
  flag: (_sys, cond, state) => {
    // flag 条件: cond.value=1 检查 flag 存在且非空, cond.value=0 检查不存在或为空
    const flagVal = state.flags[cond.key];
    if (cond.value === 0) return (!flagVal || flagVal === '') ? 1 : 0;
    return (flagVal && flagVal !== '') ? 1 : 0;
  },
  hasEnh: (_sys, cond, state) => state.unlockedEnhancements.includes(cond.key) ? 1 : 0,
  hasTag: (sys, cond, state) => (sys.countOwnedTagSpots(parseTagId(cond.key), state) > 0 ? 1 : 0),
  countTags: (sys, cond, state) => sys.countOwnedTagSpots(parseTagId(cond.key), state),
  stat: (sys, cond) => sys.statReader(cond.key) ?? 0,
  hasReadStory: (_sys, cond, state) => state.storyLog.some(s => s.storyId === cond.key) ? 1 : 0,
  hasReadStoryInRun: (sys, cond) => (sys.storyRunChecker(cond.key) ? 1 : 0),
  visitedStoryInChain: (sys, cond) => (sys.storyChainChecker(cond.key) ? 1 : 0),
  // Extra 三层合并视图数值比较（缺失 → 0，语义见 docs/13 §6.2）
  extra: (sys, cond) => toNumber(sys.extraReader(cond.key)),
  // 按 tag 聚合的收集数（TagStatService，key = `<kind>:<tagDisplay>`）
  tagCount: (sys, cond) => sys.tagCountReader(cond.key),
  // 原型聚合统计（获得次数；docs-818/12-character-rework.md §3）
  protoStat: (_sys, cond, state) => state.protoStats?.[cond.key]?.acquiredTotal ?? 0,
  // 好感等级（key = VariantId；未拥有/缺失 → 0，已拥有缺字段 ??= 1）
  affectionLevel: (sys, cond, state) => sys.affectionLevelReader(cond.key, state),
  // 当前所在区域是否等于指定 Area（key = AreaId）
  area: (_sys, cond, state) => (state.currentAreaId === cond.key ? 1 : 0),
};

const COMPARATORS: Record<Comparator, (actual: number, expected: number) => boolean> = {
  '==': (a, e) => a === e,
  '!=': (a, e) => a !== e,
  '>=': (a, e) => a >= e,
  '<=': (a, e) => a <= e,
  '>': (a, e) => a > e,
  '<': (a, e) => a < e,
};

export class ConditionSystem implements ConditionEvaluationContext<ConditionState> {
  // --- 注入依赖（@internal：供 TARGET_EVALUATORS 模块级求值器读取） ---

  /** @internal 查询拥有指定标签的 Spot（由 Registry 的层级标签索引提供）。 */
  tagIndex: (tag: TagPath) => string[] = () => [];
  /** @internal 统计函数 DSL 求值器（由 StatsService 提供）。 */
  statReader: (dsl: string) => number | null = () => null;
  /** @internal 查询当前 Run 中是否完成过某个 Story（由 StatsService 提供）。 */
  storyRunChecker: (storyId: string) => boolean = () => false;
  /** @internal 查询当前 Entry 跳转链中是否经过某个 Story（由 StoryService 提供）。 */
  storyChainChecker: (storyId: string) => boolean = () => false;
  /** @internal Extra 三层合并视图读取器（由 GameInstance.getExtra 提供）。 */
  extraReader: (path: ExtraPath) => ExtraValue | undefined = () => undefined;
  /** @internal 按 tag 聚合的收集数读取器（由 TagStatService 提供）。 */
  tagCountReader: (key: string) => number = () => 0;
  /** @internal 好感等级读取器（由 RosterSystem 提供，注入星级锁与缺省等级兜底）。 */
  affectionLevelReader: (variantId: string, state: ConditionState) => number = () => 0;

  setTagIndex(index: (tag: TagPath) => string[]): void {
    this.tagIndex = index;
  }

  setStatReader(reader: (dsl: string) => number | null): void {
    this.statReader = reader;
  }

  setStoryRunChecker(checker: (storyId: string) => boolean): void {
    this.storyRunChecker = checker;
  }

  setStoryChainChecker(checker: (storyId: string) => boolean): void {
    this.storyChainChecker = checker;
  }

  setExtraReader(reader: (path: ExtraPath) => ExtraValue | undefined): void {
    this.extraReader = reader;
  }

  setTagCountReader(reader: (key: string) => number): void {
    this.tagCountReader = reader;
  }

  setAffectionLevelReader(reader: (variantId: string, state: ConditionState) => number): void {
    this.affectionLevelReader = reader;
  }

  evaluate(cond: Condition, state: ConditionState): boolean {
    const actual = this.getActualValue(cond, state);
    return this.compare(actual, cond.comparator, cond.value);
  }

  /** 求值一条条件表达式：单条原子条件直接求值，条件组递归求值（Trigger 的 condition 可为两者）。 */
  evaluateExpr(expr: Condition | ConditionGroup, state: ConditionState): boolean {
    if ('conditions' in expr && 'type' in expr) {
      return this.evaluateGroup(expr as ConditionGroup, state);
    }
    return this.evaluate(expr as Condition, state);
  }

  evaluateGroup(group: ConditionGroup, state: ConditionState): boolean {
    const results = group.conditions.map(c => {
      if ('conditions' in c && 'type' in c) {
        return this.evaluateGroup(c as ConditionGroup, state);
      }
      return this.evaluate(c as Condition, state);
    });

    if (group.type === 'AND') return results.every(Boolean);
    if (group.type === 'OR') return results.some(Boolean);
    return false;
  }

  private getActualValue(cond: Condition, state: ConditionState): number {
    const evaluator = TARGET_EVALUATORS[cond.target];
    return evaluator ? evaluator(this, cond, state) : 0;
  }

  /** @internal 拥有指定标签（含 child，前缀匹配）且已拥有的 Spot 数量。 */
  countOwnedTagSpots(tag: TagPath, state: ConditionState): number {
    return this.tagIndex(tag).filter(spotId => (state.spotLevels[spotId] ?? 0) > 0).length;
  }

  private compare(actual: number, comparator: string, expected: number): boolean {
    const op = COMPARATORS[comparator as Comparator];
    return op ? op(actual, expected) : false;
  }
}
