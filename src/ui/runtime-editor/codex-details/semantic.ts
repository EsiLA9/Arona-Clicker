import type { Condition, ConditionGroup, Effect, ValueExpression } from '../../../engine/types';
import { describeEffect, describeValueExpression } from '../../../engine/effect/affector-text';
import { describeConditionLeaf, renderConditionText } from '../../condition-presentation';
import type { InspectorNameResolver } from './types';

export type InspectorSemanticKind = 'condition' | 'effect' | 'value' | 'payment' | 'reveal';

const SEMANTIC_KIND_LABELS: Readonly<Record<InspectorSemanticKind, string>> = {
  condition: '条件',
  effect: '效果',
  value: '数值',
  payment: '支付',
  reveal: '揭示',
};

const REVEAL_LABELS: Readonly<Record<string, string>> = {
  existence: '出现',
  name: '名称',
  condition: '条件',
  utility: '用途',
  unlock: '解锁',
  purchaseable: '可购买',
  owned: '已拥有',
};

export interface InspectorSemanticSummary {
  readonly kind: InspectorSemanticKind;
  readonly label: string;
  readonly path: string;
  readonly text: string;
}

interface RecordLike {
  readonly [key: string]: unknown;
}

const COMPARATORS = new Set(['==', '!=', '>=', '<=', '>', '<']);
const VALUE_BINARY = new Set(['add', 'sub', 'mul', 'div', 'min', 'max', 'pow']);
const VALUE_UNARY = new Set(['floor', 'ceil', 'round']);

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCondition(value: unknown): value is Condition {
  return isRecord(value)
    && typeof value.target === 'string'
    && typeof value.key === 'string'
    && typeof value.comparator === 'string'
    && COMPARATORS.has(value.comparator)
    && typeof value.value === 'number';
}

function isConditionGroup(value: unknown): value is ConditionGroup {
  return isRecord(value)
    && (value.type === 'AND' || value.type === 'OR')
    && Array.isArray(value.conditions);
}

function isValueExpression(value: unknown): value is ValueExpression {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'const') return typeof value.value === 'number';
  if (value.type === 'value') return isRecord(value.value) && typeof value.value.type === 'string' && typeof value.value.source === 'string';
  if (VALUE_BINARY.has(value.type)) return 'left' in value && 'right' in value;
  if (VALUE_UNARY.has(value.type)) return 'expr' in value;
  return value.type === 'clamp' && 'expr' in value && 'min' in value && 'max' in value;
}

function isEffect(value: unknown): value is Effect {
  return isRecord(value) && typeof value.op === 'string' && typeof value.target === 'string' && 'value' in value;
}

function isPaymentOption(value: unknown): value is { id?: string; label?: string; costs: readonly unknown[]; condition?: unknown } {
  return isRecord(value)
    && Array.isArray(value.costs)
    && (value.id === undefined || typeof value.id === 'string')
    && (value.label === undefined || typeof value.label === 'string');
}

function isRevealTrigger(value: unknown): value is { reveal: string; condition?: unknown } {
  return isRecord(value) && typeof value.reveal === 'string' && (!('condition' in value) || value.condition === undefined || isCondition(value.condition) || isConditionGroup(value.condition));
}

function nameResolver(options: SemanticOptions): InspectorNameResolver {
  return options.nameOf ?? ((_, id) => id);
}

function inlineValue(value: unknown, options: SemanticOptions): string {
  const nameOf = nameResolver(options);
  if (isValueExpression(value)) {
    try {
      return describeValueExpression(value, nameOf);
    } catch {
      return '[无效数值表达式]';
    }
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return options.formatNumber?.(value) ?? String(value);
  if (typeof value === 'boolean' || value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return `[${value.slice(0, 6).map(item => inlineValue(item, options)).join(', ')}${value.length > 6 ? ', …' : ''}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).slice(0, 6);
    return `{${keys.map(key => `${key}: ${inlineValue(value[key], options)}`).join(', ')}${Object.keys(value).length > 6 ? ', …' : ''}}`;
  }
  return String(value);
}

function conditionSummary(value: Condition | ConditionGroup, options: SemanticOptions): string {
  const presentation = {
    nameOf: nameResolver(options),
    formatNumber: options.formatNumber,
    style: 'ui' as const,
  };
  try {
    return isConditionGroup(value) ? renderConditionText(value, presentation) : describeConditionLeaf(value, presentation);
  } catch {
    return '[无效条件节点]';
  }
}

function effectSummary(effect: Effect, options: SemanticOptions): string {
  try {
    const text = describeEffect(effect, nameResolver(options));
    if (text && text !== 'undefined') return text;
  } catch {
    // Fall through to a generic read-only summary for partially known effects.
  }
  return `${effect.op} → ${effect.target} = ${inlineValue(effect.value, options)}`;
}

function isRemovedManagerSemantic(value: unknown): boolean {
  if (isConditionGroup(value)) return value.conditions.some(condition => isRemovedManagerSemantic(condition));
  if (isCondition(value)) return value.target === 'manager';
  if (isEffect(value)) return value.op === 'setManager';
  if (!isValueExpression(value)) return false;
  if (value.type === 'value') return value.value.source === 'managerCount';
  if (value.type === 'const') return false;
  if (value.type === 'floor' || value.type === 'ceil' || value.type === 'round') return isRemovedManagerSemantic(value.expr);
  if (value.type === 'clamp') return [value.expr, value.min, value.max].some(child => isRemovedManagerSemantic(child));
  return 'left' in value && 'right' in value
    ? isRemovedManagerSemantic(value.left) || isRemovedManagerSemantic(value.right)
    : false;
}

function paymentSummary(option: { id?: string; label?: string; costs: readonly unknown[]; condition?: unknown }, options: SemanticOptions): string {
  const nameOf = nameResolver(options);
  const costs = option.costs.map(cost => {
    if (!isRecord(cost)) return inlineValue(cost, options);
    const asset = cost.type === 'resource' ? `资源 ${nameOf('resource', String(cost.resourceId ?? ''))}`
      : cost.type === 'item' ? `物品 ${nameOf('item', String(cost.itemId ?? ''))}`
      : String(cost.type ?? '未知资产');
    return `${asset} × ${inlineValue(cost.amount, options)}`;
  }).join('；') || '免费';
  const condition = isConditionGroup(option.condition) || isCondition(option.condition)
    ? `；条件：${conditionSummary(option.condition, options)}`
    : '';
  const label = option.label ?? option.id;
  return `${label ? `${label}：` : ''}${costs}${condition}`;
}

function revealSummary(trigger: { reveal: string; condition?: unknown }, options: SemanticOptions): string {
  const condition = isConditionGroup(trigger.condition) || isCondition(trigger.condition)
    ? `；条件：${conditionSummary(trigger.condition, options)}`
    : '；无条件';
  return `揭示${REVEAL_LABELS[trigger.reveal] ?? trigger.reveal}${condition}`;
}

export function semanticKindLabel(kind: InspectorSemanticKind): string {
  return SEMANTIC_KIND_LABELS[kind];
}

export interface SemanticOptions {
  readonly nameOf?: InspectorNameResolver;
  readonly formatNumber?: (value: number) => string;
  readonly maxItems?: number;
}

export function summarizeSemanticValue(value: unknown, options: SemanticOptions = {}): Omit<InspectorSemanticSummary, 'path' | 'label'> | undefined {
  if (isRemovedManagerSemantic(value)) return undefined;
  if (isConditionGroup(value) || isCondition(value)) {
    return { kind: 'condition', text: conditionSummary(value, options) };
  }
  if (isEffect(value)) return { kind: 'effect', text: effectSummary(value, options) };
  if (isValueExpression(value)) return { kind: 'value', text: inlineValue(value, options) };
  if (isPaymentOption(value)) return { kind: 'payment', text: paymentSummary(value, options) };
  if (isRevealTrigger(value)) return { kind: 'reveal', text: revealSummary(value, options) };
  return undefined;
}

export function collectSemanticSummaries(value: unknown, options: SemanticOptions = {}, path = '$'): InspectorSemanticSummary[] {
  const maxItems = Math.max(1, options.maxItems ?? 64);
  const result: InspectorSemanticSummary[] = [];
  const ancestors = new WeakSet<object>();

  const visit = (current: unknown, currentPath: string): void => {
    if (result.length >= maxItems) return;
  const summary = summarizeSemanticValue(current, options);
  if (summary) {
      result.push({ ...summary, label: semanticKindLabel(summary.kind), path: currentPath });
      return;
    }
    if (typeof current !== 'object' || current === null) return;
    if (ancestors.has(current)) return;
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        current.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      } else {
        for (const key of Object.keys(current)) {
          if (result.length >= maxItems) break;
          let child: unknown;
          try {
            const descriptor = Object.getOwnPropertyDescriptor(current, key);
            if (!descriptor || !('value' in descriptor)) continue;
            child = descriptor.value;
          } catch {
            continue;
          }
          visit(child, /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${currentPath}.${key}` : `${currentPath}[${JSON.stringify(key)}]`);
        }
      }
    } finally {
      ancestors.delete(current);
    }
  };

  visit(value, path);
  return result;
}
