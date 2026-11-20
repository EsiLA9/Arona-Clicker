import type { Comparator, Condition } from '../../engine/types/expression';
import { describeConditionLeaf } from '../presentation/condition-presentation';
import {
  conditionFieldLabels, STORY_CONDITION_COMPARATORS, STORY_CONDITION_HINTS, STORY_CONDITION_REFERENCES, STORY_CONDITION_TARGETS,
} from './condition-fields';
import { renderConditionReferenceField } from './condition-reference-navi';
import type { ConditionReferenceRow } from '../components/shared/condition-reference-picker';
import { conditionFromLeaf, type ConditionTreeLeaf } from './condition-tree-model';
import type { StoryReferenceKind } from './property-options';

type SelectField = (name: string, caption: string, value: string, items: readonly [string, string][], placeholder?: string) => string;

export interface ConditionLeafView {
  escape: (value: string) => string;
  select: SelectField;
  choices: (kind: StoryReferenceKind) => readonly ConditionReferenceRow[];
  labelOf: (kind: StoryReferenceKind, key: string) => string;
  globalFlags: readonly string[];
  targets: typeof STORY_CONDITION_TARGETS;
}

interface ConditionLeafEditor {
  comparators?: readonly [Comparator, string][];
  render?: (node: ConditionTreeLeaf, view: ConditionLeafView) => string | undefined;
  update?: (node: ConditionTreeLeaf, field: string, value: string) => boolean;
  describe?: (condition: Condition, view: ConditionLeafView) => string;
  incomplete?: (node: ConditionTreeLeaf) => string | undefined;
}

const AREA_RELATIONS: [string, string][] = [['in', '位于'], ['out', '不在']];
const COUNT_COMPARATORS: readonly [Comparator, string][] = [
  ['==', '恰好'], ['!=', '不等于'], ['>=', '至少'], ['<=', '至多'], ['>', '多于'], ['<', '少于'],
];

function areaRelation(comparator: string, value: string): string | undefined {
  if (!comparator && !value) return '';
  if (comparator === '==' && value === '1') return 'in';
  if (comparator === '==' && value === '0') return 'out';
}

const SPECIAL_EDITORS: Partial<Record<string, ConditionLeafEditor>> = {
  alwaysTrue: {
    describe: condition => `固定值 1 ${condition.comparator} ${condition.value}`,
  },
  protoStat: {
    comparators: COUNT_COMPARATORS,
    describe: (condition, view) => {
      const relation = COUNT_COMPARATORS.find(([id]) => id === condition.comparator)?.[1];
      return `${view.labelOf('character', condition.key)}累计获得次数 ${relation} ${condition.value}`;
    },
  },
  area: {
    render: (node, view) => {
      const relation = areaRelation(node.comparator, node.value);
      if (relation === undefined) return;
      return `${view.select('area-relation', '位置关系', relation, AREA_RELATIONS, '选择位置关系')}
        ${renderConditionReferenceField('区域', node.key ?? '', node.id, view.choices('area'), view.escape)}`;
    },
    update: (node, field, relation) => {
      if (field !== 'area-relation') return false;
      if (relation !== '' && relation !== 'in' && relation !== 'out') return false;
      node.comparator = relation ? '==' : '';
      node.value = relation === 'in' ? '1' : relation === 'out' ? '0' : '';
      return true;
    },
    describe: (condition, view) => {
      const relation = areaRelation(condition.comparator, String(condition.value));
      const label = view.labelOf('area', condition.key);
      if (relation) return `${relation === 'in' ? '位于' : '不在'}「${label}」`;
      return `位于「${label}」的位置状态值 ${condition.comparator} ${condition.value}`;
    },
    incomplete: node => areaRelation(node.comparator, node.value) !== undefined ? '请选择区域和位置关系。' : undefined,
  },
};

export function conditionLeafEditor(target: string): ConditionLeafEditor | undefined {
  return Object.prototype.hasOwnProperty.call(SPECIAL_EDITORS, target) ? SPECIAL_EDITORS[target] : undefined;
}

export function renderConditionLeafFields(node: ConditionTreeLeaf, view: ConditionLeafView): string {
  const target = STORY_CONDITION_TARGETS.find(([id]) => id === node.target)?.[0];
  const targetControl = view.select('target', '判断对象', node.target, view.targets, '选择判断对象');
  if (!node.target) return targetControl;
  const editor = conditionLeafEditor(node.target);
  const custom = editor?.render?.(node, view);
  if (custom !== undefined) return targetControl + custom;
  const { escape } = view;
  const labels = conditionFieldLabels(node.target);
  const kind = target && STORY_CONDITION_REFERENCES[target];
  const keyChoices = target === 'flag' ? view.globalFlags.map(value => ({ value, label: value })) : [];
  const list = `condition-tree-key-${node.id}`;
  const hint = target && STORY_CONDITION_HINTS[target];
  const keyControl = kind
    ? renderConditionReferenceField(labels.key, node.key ?? '', node.id, view.choices(kind), escape)
    : `<label data-editor-key="condition-label:key">${escape(labels.key)}<input data-condition-field="key" value="${escape(node.key ?? '')}"${keyChoices.length ? ` list="${list}"` : ''}></label>`;
  return `${targetControl}
    ${target && target !== 'alwaysTrue' ? keyControl : ''}
    ${keyChoices.length ? `<datalist id="${list}">${keyChoices.map(item => `<option value="${escape(item.value)}" label="${escape(item.label)}"></option>`).join('')}</datalist>` : ''}
    ${hint ? `<small class="story-editor-hint">${escape(hint)}</small>` : ''}
    ${view.select('comparator', labels.comparator, node.comparator, editor?.comparators ?? STORY_CONDITION_COMPARATORS, `选择${labels.comparator}`)}
    <label data-editor-key="condition-label:value">${escape(labels.value)}<input data-condition-field="value" value="${escape(node.value)}" inputmode="decimal"></label>`;
}

export function describeConditionTreeLeaf(node: ConditionTreeLeaf, view: ConditionLeafView): string {
  const condition = conditionFromLeaf(node);
  if (!condition) return '条件 · 待填写';
  const custom = conditionLeafEditor(condition.target)?.describe;
  if (custom) return custom(condition, view);
  return describeConditionLeaf(condition, {
    style: 'ui',
    nameOf: (_, id) => {
      const kind = STORY_CONDITION_REFERENCES[condition.target];
      return kind ? view.labelOf(kind, id) : id;
    },
  });
}
