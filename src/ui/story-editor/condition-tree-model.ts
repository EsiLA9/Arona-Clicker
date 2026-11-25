import type { Condition, ConditionGroup } from '../../engine/types/expression';
import { conditionFieldLabels, STORY_CONDITION_COMPARATORS, STORY_CONDITION_TARGETS } from './condition-fields';
import { readStructuredInput } from './structured-value';

export interface ConditionTreeGroup {
  kind: 'group';
  id: string;
  operator: ConditionGroup['type'] | '';
  expanded: boolean;
  children: ConditionTreeNode[];
}

export interface ConditionTreeLeaf {
  kind: 'leaf';
  id: string;
  target: string;
  key?: string;
  comparator: string;
  value: string;
}

export type ConditionTreeNode = ConditionTreeGroup | ConditionTreeLeaf;
export type ConditionRootMode = 'OR' | 'true';

// The first OR operand keeps evaluation true while preserving the editable branches.
const TRUE_ROOT_OPERAND: Condition = { target: 'alwaysTrue', key: '$storyEditor:true', comparator: '==', value: 1 };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function isTrueConditionRoot(value: unknown): boolean {
  const group = asRecord(value);
  if (!Array.isArray(group?.conditions)) return false;
  if (group.type === 'AND') return group.conditions.length === 0;
  if (group.type !== 'OR') return false;
  const first = asRecord(group.conditions[0]);
  return first?.target === TRUE_ROOT_OPERAND.target && first.key === TRUE_ROOT_OPERAND.key
    && first.comparator === TRUE_ROOT_OPERAND.comparator && first.value === TRUE_ROOT_OPERAND.value;
}

export function createConditionTree(value: unknown, pendingValue?: (path: readonly (string | number)[]) => string | undefined, plainRoot = false) {
  let nextId = 0;
  const newGroup = (): ConditionTreeGroup => ({ kind: 'group', id: String(nextId++), operator: '', expanded: true, children: [] });
  const newLeaf = (): ConditionTreeLeaf => ({ kind: 'leaf', id: String(nextId++), target: '', comparator: '', value: '' });
  const original = asRecord(value);
  const root = newGroup();
  root.operator = 'OR';
  const mode: ConditionRootMode = !plainRoot && isTrueConditionRoot(value) ? 'true' : 'OR';

  const read = (value: unknown, path: readonly (string | number)[]): ConditionTreeNode => {
    const record = asRecord(value);
    if (record && ('conditions' in record || record.type === 'AND' || record.type === 'OR')) {
      const group = newGroup();
      if (Array.isArray(record.conditions)) {
        if (record.type === 'AND' || record.type === 'OR') group.operator = record.type;
        group.children = record.conditions.map((child, index) => read(child, [...path, 'conditions', index]));
      }
      return group;
    }
    const node = newLeaf();
    if (typeof record?.target === 'string') node.target = record.target;
    if (typeof record?.key === 'string') node.key = record.key;
    if (typeof record?.comparator === 'string') node.comparator = record.comparator;
    node.value = pendingValue?.([...path, 'value']) ?? (typeof record?.value === 'number' ? String(record.value) : '');
    return node;
  };

  if (plainRoot && Array.isArray(original?.conditions) && (original.type === 'AND' || original.type === 'OR')) {
    root.operator = original.type;
    root.children = original.conditions.map((child, index) => read(child, ['conditions', index]));
  } else if (value !== undefined) {
    if (original?.type === 'OR' && Array.isArray(original.conditions)) {
      const offset = mode === 'true' ? 1 : 0;
      root.children = original.conditions.slice(offset).map((child, index) => read(child, ['conditions', index + offset]));
    } else if (mode === 'OR') {
      root.children.push(read(value, []));
    }
  }
  return { root, mode, newGroup, newLeaf };
}

export function conditionTreeLocation(parent: ConditionTreeGroup, id: string): { node: ConditionTreeNode; parent: ConditionTreeGroup; index: number } | undefined {
  for (const [index, node] of parent.children.entries()) {
    if (node.id === id) return { node, parent, index };
    if (node.kind === 'group') {
      const location = conditionTreeLocation(node, id);
      if (location) return location;
    }
  }
}

export function moveConditionTreeNode(root: ConditionTreeGroup, id: string, parent: ConditionTreeGroup, before?: ConditionTreeNode): boolean {
  const source = conditionTreeLocation(root, id);
  if (!source || source.node === before || source.node === parent) return false;
  if (source.node.kind === 'group' && conditionTreeLocation(source.node, parent.id)) return false;
  if (before && !parent.children.includes(before)) return false;
  source.parent.children.splice(source.index, 1);
  parent.children.splice(before ? parent.children.indexOf(before) : parent.children.length, 0, source.node);
  parent.expanded = true;
  return true;
}

export function conditionFromLeaf(node: ConditionTreeLeaf): Condition | undefined {
  const target = STORY_CONDITION_TARGETS.find(([value]) => value === node.target)?.[0];
  const comparator = STORY_CONDITION_COMPARATORS.find(([value]) => value === node.comparator)?.[0];
  const parsed = readStructuredInput('number', node.value.trim());
  const key = node.key ?? (target === 'alwaysTrue' ? '' : undefined);
  if (target && comparator && (target === 'alwaysTrue' || key?.trim()) && key !== undefined
    && parsed.ok && typeof parsed.value === 'number') {
    return { target, key, comparator, value: parsed.value };
  }
}

export function compileConditionTree(root: ConditionTreeGroup, mode: ConditionRootMode):
  { condition: ConditionGroup } | { nodeId: string; message: string } {
  const readGroup = (group: ConditionTreeGroup): ReturnType<typeof compileConditionTree> => {
    if (!group.operator) return { nodeId: group.id, message: '请为条件组选择「全部满足」或「任一满足」。' };
    const conditions: (Condition | ConditionGroup)[] = [];
    for (const node of group.children) {
      if (node.kind === 'group') {
        const result = readGroup(node);
        if ('message' in result) return result;
        conditions.push(result.condition);
      } else {
        const condition = conditionFromLeaf(node);
        if (!condition) {
          const labels = conditionFieldLabels(node.target);
          const fields = [labels.comparator, labels.value];
          if (node.target !== 'alwaysTrue') fields.unshift(labels.key);
          return { nodeId: node.id, message: node.target ? `请完整填写「${fields.join('」「')}」。` : '请选择判断对象。' };
        }
        conditions.push(condition);
      }
    }
    return { condition: { type: group.operator, conditions } };
  };
  const result = readGroup(root);
  if (mode !== 'true' || 'message' in result) return result;
  const { conditions } = result.condition;
  return {
    condition: conditions.length
      ? { type: 'OR', conditions: [{ ...TRUE_ROOT_OPERAND }, ...conditions] }
      : { type: 'AND', conditions: [] },
  };
}
