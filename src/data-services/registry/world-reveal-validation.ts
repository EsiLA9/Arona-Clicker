const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const targets = new Set(['existence', 'name', 'utility', 'condition']);
const comparators = new Set(['==', '!=', '>=', '<=', '>', '<']);
const conditionTargets = new Set([
  'alwaysTrue', 'resource', 'spotLevel', 'manager', 'flag', 'hasEnh', 'hasTag', 'countTags', 'tagCount', 'stat',
  'hasReadStory', 'hasReadStoryInRun', 'visitedStoryInChain', 'extra', 'protoStat', 'affectionLevel', 'area', 'hasAreaMap',
]);

export function isWorldCondition(value: unknown): boolean {
  if (!record(value)) return false;
  if (typeof value.target === 'string') {
    return conditionTargets.has(value.target) && Object.keys(value).every(key => ['target', 'key', 'comparator', 'value'].includes(key))
      && typeof value.key === 'string' && typeof value.comparator === 'string'
      && comparators.has(value.comparator) && typeof value.value === 'number' && Number.isFinite(value.value);
  }
  return (value.type === 'AND' || value.type === 'OR') && Object.keys(value).every(key => key === 'type' || key === 'conditions') && Array.isArray(value.conditions)
    && value.conditions.length > 0 && value.conditions.every(isWorldCondition);
}

export function validateWorldReveal(value: unknown, path: string, fail: (message: string) => never): void {
  if (value === undefined) return;
  if (!record(value)) fail(`${path} 必须是对象`);
  for (const [target, rule] of Object.entries(value)) {
    if (!targets.has(target)) fail(`${path}.${target} 不是有效信息面`);
    if (!record(rule)) fail(`${path}.${target} 必须是规则对象`);
    if (rule.mode === 'explicit') {
      if (Object.keys(rule).some(key => key !== 'mode')) fail(`${path}.${target} explicit 规则含未允许字段`);
    } else if (rule.mode === 'condition') {
      if (!isWorldCondition(rule.condition) || Object.keys(rule).some(key => !['mode', 'condition'].includes(key))) {
        fail(`${path}.${target} condition 规则必须含有效 condition，且不得有其他字段`);
      }
    } else fail(`${path}.${target}.mode 必须是 condition 或 explicit`);
  }
}

