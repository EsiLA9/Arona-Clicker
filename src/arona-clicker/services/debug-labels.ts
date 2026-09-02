import type { Condition, ConditionGroup, RevealTrigger, RevealTarget } from '../../engine/types';

export function triggerLabel(triggers: RevealTrigger[] | undefined, target: RevealTarget): string {
  const list = triggers?.filter(t => t.reveal === target) ?? [];
  if (!list.length) return '(无揭示门槛)';
  return list.map(t => condLabel(t.condition)).join(' 或 ');
}

export function condLabel(cond: Condition | ConditionGroup | undefined): string {
  if (!cond) return '(无条件)';
  if (!('conditions' in cond) || !('type' in cond)) return condItem(cond as Condition);
  const group = cond as ConditionGroup;
  if (!group.conditions.length) return '(无条件)';
  const parts = group.conditions.map(c => {
    if ('type' in c && 'conditions' in c) {
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
