import type { Comparator, ConditionTarget } from '../../engine/types/expression';
import type { StoryReferenceKind } from './property-options';

export const STORY_CONDITION_TARGETS: readonly [ConditionTarget, string][] = [
  ['alwaysTrue', '恒定数值 1'], ['resource', '资源'], ['spotLevel', '设施等级'], ['manager', '管理者'],
  ['flag', '存档标记'], ['hasEnh', '拥有强化'], ['hasTag', '拥有标签'], ['countTags', '标签数量'],
  ['tagCount', '分类统计'], ['stat', '统计函数'], ['hasReadStory', '完成 Story'],
  ['hasReadStoryInRun', '本次 Run 完成 Story'], ['visitedStoryInChain', '链路经过 Story'],
  ['extra', 'Extra'], ['protoStat', '原型统计'], ['affectionLevel', '好感等级'], ['area', '当前区域'],
];

export const STORY_CONDITION_REFERENCES: Partial<Record<ConditionTarget, StoryReferenceKind>> = {
  resource: 'resource', spotLevel: 'spot', manager: 'spot', hasEnh: 'enhancement',
  hasReadStory: 'story', hasReadStoryInRun: 'story', visitedStoryInChain: 'story',
  protoStat: 'character', affectionLevel: 'variant', area: 'area',
};

export const STORY_CONDITION_COMPARATORS: readonly [Comparator, string][] = [
  ['==', '等于'], ['!=', '不等于'], ['>=', '大于等于'], ['<=', '小于等于'], ['>', '大于'], ['<', '小于'],
];

export interface ConditionFieldLabels { key: string; comparator: string; value: string }

const FIELD_LABELS: Partial<Record<ConditionTarget, Partial<ConditionFieldLabels>>> = {
  resource: { key: '资源', value: '资源数量' },
  spotLevel: { key: '设施', value: '设施等级' },
  manager: { key: '设施', value: '管理者分配状态值' },
  flag: { key: '存档标记名称', value: '标记比较值' },
  hasEnh: { key: '强化', value: '持有状态值' },
  hasTag: { key: '设施标签路径', value: '标签存在状态值' },
  countTags: { key: '设施标签路径', value: '拥有数量' },
  tagCount: { key: '统计类别与标签', value: '收集数量' },
  stat: { key: '统计函数调用', value: '统计数值' },
  hasReadStory: { key: 'Story', value: '完成状态值' },
  hasReadStoryInRun: { key: 'Story', value: '本次游玩的完成状态值' },
  visitedStoryInChain: { key: 'Story', value: '本次剧情链的经过状态值' },
  extra: { key: 'Extra 路径', value: '转换后的数值' },
  protoStat: { key: '角色原型', comparator: '次数关系', value: '累计获得次数' },
  affectionLevel: { key: '角色版本', value: '好感等级' },
  area: { key: '区域', value: '位置状态值' },
};

export function conditionFieldLabels(target: string): ConditionFieldLabels {
  const known = STORY_CONDITION_TARGETS.find(([id]) => id === target)?.[0];
  return { key: '条件键', comparator: '比较方式', value: '比较值', ...(known && FIELD_LABELS[known]) };
}

export const STORY_CONDITION_HINTS: Partial<Record<ConditionTarget, string>> = {
  alwaysTrue: '判断对象的值固定为 1，无需条件键。',
  manager: '设施已分配管理者时为 1，否则为 0。',
  flag: '按存档标记是否为空求值，常用「等于 1」检查标记是否有内容。',
  hasEnh: '已持有该强化时为 1，否则为 0。',
  hasTag: '拥有带此层级标签的设施时为 1，否则为 0。',
  countTags: '填写设施层级标签路径，比较拥有数量。',
  tagCount: '填写 kind:tag，例如 characters:school/abydos。',
  stat: '填写统计函数调用，例如 $FunctionName 参数。',
  hasReadStory: '存档中完成过该 Story 时为 1，否则为 0。',
  hasReadStoryInRun: '本次游玩完成过该 Story 时为 1，否则为 0。',
  visitedStoryInChain: '本次剧情链经过该 Story 时为 1，否则为 0。',
  extra: '填写 ExtraPath，读取合并视图数值。',
  protoStat: '选择角色原型。获得次数按该原型汇总。',
  area: '当前位置与所选区域相同时，位置状态值为 1，否则为 0。',
};
export function entryConditionField(path: readonly (string | number)[]): { label: string; optional?: boolean; absent?: string } | undefined {
  if (path.length === 1) {
    if (path[0] === 'triggerCondition') return { label: '触发条件' };
    if (path[0] === 'block') return { label: '解除阻塞条件', optional: true, absent: '未设置阻塞' };
  }
  if (path.length !== 3 || typeof path[1] !== 'number' || path[2] !== 'condition') return;
  if (path[0] === 'conditionalRewards') return { label: '奖励条件' };
  if (path[0] === 'revealTriggers') return { label: '揭示条件', optional: true, absent: '无条件揭示' };
  if (path[0] === 'reactions') return { label: '反应条件', optional: true, absent: '匹配事件即执行' };
}

