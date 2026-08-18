// ============================================================
// engine/game/debug-labels.ts — 揭示条件 → 简短文本（仅 debug 展示）
// ============================================================

import type { Condition, ConditionGroup, RevealTrigger, RevealTarget } from '../types';

/** 将某个揭示目标的 Trigger 列表转为简短文本（仅用于 debug 展示）。 */
export function triggerLabel(triggers: RevealTrigger[] | undefined, target: RevealTarget): string {
  const list = triggers?.filter(t => t.reveal === target) ?? [];
  if (!list.length) return '(无揭示门槛)';
  return list.map(t => condLabel(t.condition)).join(' 或 ');
}

/** 将单个条件（原子条件或条件组）转为简短文本（仅用于 debug 展示，不解引用名）。 */
export function condLabel(cond: Condition | ConditionGroup | undefined): string {
  if (!cond) return '(无条件)';
  if (!('conditions' in cond) || !('type' in cond)) return condItem(cond as Condition);
  const group = cond as ConditionGroup;
  if (!group.conditions.length) return '(无条件)';
  const parts = group.conditions.map(c => {
    if ('type' in c && 'conditions' in c) {
      // 嵌套组
      const inner = (c as ConditionGroup).conditions
        .map(ic => condItem(ic as Condition))
        .join((c as ConditionGroup).type === 'AND' ? ' & ' : ' | ');
      return `[${inner}]`;
    }
    return condItem(c as Condition);
  });
  return parts.join(group.type === 'AND' ? ' 且 ' : ' 或 ');
}

function condItem(c: Condition): string {
  return `${c.target}:${c.key}${c.comparator}${c.value}`;
}
