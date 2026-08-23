// ============================================================
// engine/condition-system.ts — Condition / ConditionGroup 求值系统
// ============================================================

import { Condition, ConditionGroup, PlayerState, Character, ExtraPath, ExtraValue } from './types';
import { parseTagId, TagPath } from './tag';
import { toNumber } from './extra';

export class ConditionSystem {
  /** 查询拥有指定标签的 Spot（由 Registry 的层级标签索引提供）。 */
  private tagIndex: (tag: TagPath) => string[] = () => [];
  /** 统计函数 DSL 求值器（由 StatsService 提供）。 */
  private statReader: (dsl: string) => number | null = () => null;
  /** 查询当前 Run 中是否完成过某个 Story（由 StatsService 提供）。 */
  private storyRunChecker: (storyId: string) => boolean = () => false;
  /** 查询当前 Entry 跳转链中是否经过某个 Story（由 StoryService 提供）。 */
  private storyChainChecker: (storyId: string) => boolean = () => false;
  /** Extra 三层合并视图读取器（全局 → per-Init → 数据包常量表，由 GameInstance.getExtra 提供）。 */
  private extraReader: (path: ExtraPath) => ExtraValue | undefined = () => undefined;
  /** 按 tag 聚合的收集数读取器（key = `<kind>:<tagDisplay>`，由 TagStatService 提供）。 */
  private tagCountReader: (key: string) => number = () => 0;

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

  evaluate(cond: Condition, state: PlayerState): boolean {
    const actual = this.getActualValue(cond, state);
    return this.compare(actual, cond.comparator, cond.value);
  }

  /** 求值一条条件表达式：单条原子条件直接求值，条件组递归求值（Trigger 的 condition 可为两者）。 */
  evaluateExpr(expr: Condition | ConditionGroup, state: PlayerState): boolean {
    if ('conditions' in expr && 'type' in expr) {
      return this.evaluateGroup(expr as ConditionGroup, state);
    }
    return this.evaluate(expr as Condition, state);
  }

  evaluateGroup(group: ConditionGroup, state: PlayerState): boolean {
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

  private getActualValue(cond: Condition, state: PlayerState): number {
    switch (cond.target) {
      case 'resource':
        return state.resources[cond.key] ?? 0;

      case 'spotLevel':
        return state.spotLevels[cond.key] ?? 0;

      case 'manager':
        return state.spotManagers[cond.key] && state.spotManagers[cond.key] !== Character.None
          ? 1
          : 0;

      case 'flag': {
        // flag 条件: cond.value=1 检查 flag 存在且非空, cond.value=0 检查不存在或为空
        const flagVal = state.flags[cond.key];
        if (cond.value === 0) return (!flagVal || flagVal === '') ? 1 : 0;
        return (flagVal && flagVal !== '') ? 1 : 0;
      }

      case 'hasEnh':
        return state.unlockedEnhancements.includes(cond.key) ? 1 : 0;

      case 'hasTag':
      case 'countTags': {
        const count = this.countOwnedTagSpots(parseTagId(cond.key), state);
        if (cond.target === 'countTags') return count;
        // hasTag：value=1 检查存在，value=0 检查不存在（与 compare 配合）
        return count > 0 ? 1 : 0;
      }

      case 'stat':
        return this.statReader(cond.key) ?? 0;

      case 'hasReadStory':
        return state.storyLog.some(s => s.storyId === cond.key) ? 1 : 0;

      case 'hasReadStoryInRun':
        return this.storyRunChecker(cond.key) ? 1 : 0;

      case 'visitedStoryInChain':
        // 当前 Entry 跳转链中是否经过该 Story（由 StoryService 提供运行时上下文）
        return this.storyChainChecker(cond.key) ? 1 : 0;

      case 'extra':
        // Extra 三层合并视图数值比较（缺失 → 0，语义见 docs/13 §6.2）
        return toNumber(this.extraReader(cond.key));

      case 'tagCount':
        // 按 tag 聚合的收集数（TagStatService，key = `<kind>:<tagDisplay>`）
        return this.tagCountReader(cond.key);

      case 'protoStat':
        // 原型聚合统计（获得次数；docs-818/12-character-rework.md §3）
        return state.protoStats?.[cond.key]?.acquiredTotal ?? 0;

      default:
        return 0;
    }
  }

  /** 拥有指定标签（含 child，前缀匹配）且已拥有的 Spot 数量。 */
  private countOwnedTagSpots(tag: TagPath, state: PlayerState): number {
    return this.tagIndex(tag).filter(spotId => (state.spotLevels[spotId] ?? 0) > 0).length;
  }

  private compare(actual: number, comparator: string, expected: number): boolean {
    switch (comparator) {
      case '==': return actual === expected;
      case '!=': return actual !== expected;
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '>':  return actual > expected;
      case '<':  return actual < expected;
      default:   return false;
    }
  }
}
