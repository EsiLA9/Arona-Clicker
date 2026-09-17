// ============================================================
// ui/runtime-editor/condition-target-editors.ts — 原子条件目标编辑器注册表
//
// 每个 ConditionTarget 负责自己的字段投影、回读与摘要；引擎仍消费
// 统一的 Condition 四元组。目标专用候选与复杂控件在后续切片逐项接入。
// ============================================================

import type { Condition, ConditionTarget, Comparator } from '../../engine/types/expression';
import type { UIContext } from '../context';

export interface ConditionTargetOption {
  readonly value: ConditionTarget;
  readonly label: string;
}

export interface ConditionTargetEditor {
  readonly target: ConditionTarget;
  readonly label: string;
  readonly fields: readonly ('key' | 'comparator' | 'value')[];
  readonly createDefault: () => Condition;
  readonly summarize: (ctx: UIContext, condition: Condition) => string;
}

export const CONDITION_COMPARATORS: readonly Comparator[] = ['==', '!=', '>=', '<=', '>', '<'];

export const CONDITION_TARGET_OPTIONS: readonly ConditionTargetOption[] = [
  { value: 'alwaysTrue', label: '恒真条件' },
  { value: 'resource', label: '资源数量' },
  { value: 'spotLevel', label: '设施等级' },
  { value: 'manager', label: '已指派管理' },
  { value: 'flag', label: '标记' },
  { value: 'hasEnh', label: '拥有强化' },
  { value: 'hasTag', label: '存在标签' },
  { value: 'countTags', label: '标签设施数' },
  { value: 'tagCount', label: '标签收集数' },
  { value: 'stat', label: '统计表达式' },
  { value: 'hasReadStory', label: '完成过剧情' },
  { value: 'hasReadStoryInRun', label: '本世界线完成剧情' },
  { value: 'visitedStoryInChain', label: '当前剧情链经过' },
  { value: 'extra', label: 'Extra 数值' },
  { value: 'protoStat', label: '原型统计' },
  { value: 'affectionLevel', label: '好感等级' },
  { value: 'area', label: '当前所在区域' },
];

const GENERIC_FIELDS: readonly ('key' | 'comparator' | 'value')[] = ['key', 'comparator', 'value'];

const EDITOR_LIST: ConditionTargetEditor[] = [{
    target: 'alwaysTrue',
    label: '恒真条件',
    fields: [],
    createDefault: () => ({ target: 'alwaysTrue', key: '', comparator: '==', value: 1 }),
    summarize: () => 'True',
  }];

for (const option of CONDITION_TARGET_OPTIONS) {
  if (option.value === 'alwaysTrue') continue;
  EDITOR_LIST.push({
    target: option.value,
    label: option.label,
    fields: GENERIC_FIELDS,
    createDefault: () => ({ target: option.value, key: '', comparator: '>=', value: 1 }),
    summarize: (ctx, condition) => `${option.label} · ${referenceLabel(ctx, condition.target, condition.key)} ${condition.comparator} ${String(condition.value)}`,
  });
}

const EDITORS: ReadonlyMap<ConditionTarget, ConditionTargetEditor> = new Map(
  EDITOR_LIST.map(editor => [editor.target, editor]),
);

export function conditionTargetEditorOf(target: ConditionTarget): ConditionTargetEditor | undefined {
  return EDITORS.get(target);
}

export function conditionTargetLabelOf(target: ConditionTarget): string {
  return conditionTargetEditorOf(target)?.label ?? `${target}（未知目标）`;
}

export function renderConditionTargetFields(ctx: UIContext, condition: Condition): string {
  const editor = conditionTargetEditorOf(condition.target);
  if (editor?.target === 'alwaysTrue') {
    return '<p class="runtime-condition-target-note">该条件始终成立，不需要额外输入。</p>';
  }
  const esc = ctx.escapeHtml;
  const reference = referenceOptions(ctx, condition.target);
  const keyLabel = condition.target === 'resource' ? '资源' : condition.target === 'spotLevel' ? 'Spot' : condition.target === 'area' ? '区域' : '键';
  const keyInput = reference
    ? `<input data-runtime-condition-editor-field="key" list="runtime-condition-options-${condition.target}" value="${esc(condition.key)}"><datalist id="runtime-condition-options-${condition.target}">${reference
      .map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join('')}</datalist>`
    : `<input data-runtime-condition-editor-field="key" value="${esc(condition.key)}">`;
  const valueStep = condition.target === 'spotLevel' ? ' step="1"' : '';
  return `<label class="user-theme-field"><span>${keyLabel}</span>${keyInput}</label>
    <label class="user-theme-field"><span>比较</span><select data-runtime-condition-editor-field="comparator">${[condition.comparator, ...CONDITION_COMPARATORS.filter(value => value !== condition.comparator)]
      .map(value => `<option value="${value}"${value === condition.comparator ? ' selected="selected"' : ''}>${value}</option>`)
      .join('')}</select></label>
    <label class="user-theme-field"><span>值</span><input data-runtime-condition-editor-field="value" type="number" step="any"${valueStep} value="${esc(String(condition.value))}"></label>`;
}

export function readConditionTargetFields(scope: ParentNode, target: ConditionTarget, fallback: Condition): Condition {
  const editor = conditionTargetEditorOf(target);
  if (editor?.target === 'alwaysTrue') return editor.createDefault();
  const value = (name: string): string => scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-condition-editor-field="${name}"]`)?.value ?? '';
  return {
    target,
    key: value('key') || fallback.key,
    comparator: (value('comparator') || fallback.comparator) as Comparator,
    value: Number(value('value') || fallback.value),
  };
}

export function summarizeCondition(ctx: UIContext, condition: Condition): string {
  return conditionTargetEditorOf(condition.target)?.summarize(ctx, condition) ?? `${condition.target} · ${condition.key} ${condition.comparator} ${String(condition.value)}`;
}

function referenceOptions(ctx: UIContext, target: ConditionTarget): readonly { value: string; label: string }[] | undefined {
  switch (target) {
    case 'resource':
      return [...ctx.game.registry.resourceDisplays.values()].map(resource => ({ value: resource.resourceId, label: resource.label || resource.resourceId }));
    case 'spotLevel':
      return [...ctx.game.registry.spots.values()].map(spot => ({ value: spot.id, label: spot.name || spot.id }));
    case 'area':
      return [...ctx.game.registry.areas.values()].map(area => ({ value: area.id, label: area.name || area.id }));
    case 'hasEnh':
      return [...ctx.game.registry.enhancements.values()].map(enhancement => ({ value: enhancement.id, label: enhancement.name || enhancement.id }));
    case 'hasTag':
    case 'countTags':
      return [...new Set([
        ...[...ctx.game.registry.spots.values()].flatMap(spot => spot.tags ?? []).map(tag => tag.join('/')),
        ...[...ctx.game.registry.enhancements.values()].flatMap(enhancement => enhancement.tags ?? []).map(tag => tag.join('/')),
      ])].map(tag => ({ value: tag, label: tag }));
    case 'hasReadStory':
    case 'hasReadStoryInRun':
    case 'visitedStoryInChain':
      return [...ctx.game.registry.stories.values()].map(story => ({ value: story.id, label: story.name || story.id }));
    default:
      return undefined;
  }
}

function referenceLabel(ctx: UIContext, target: ConditionTarget, key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '（未填写键）';
  return referenceOptions(ctx, target)?.find(option => option.value === trimmed)?.label ?? trimmed;
}
