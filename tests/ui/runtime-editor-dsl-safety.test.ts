// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { decodeSpotContent, MAX_CONDITION_DEPTH, MAX_CONDITION_ITEMS } from '../../src/data-services/authoring/content-policy-dsl';
import type { SpotDef } from '../../src/data-services/contracts/world';
import type { ConditionGroup, Effect, ValueExpression } from '../../src/engine/types/expression';
import type { UIContext } from '../../src/ui/runtime/context';
import {
  MAX_VALUE_EXPRESSION_DEPTH,
  MAX_VALUE_EXPRESSION_NODES,
  readAtomicConditionEditor,
  readConditionEditor,
  readEffectEditor,
  renderAtomicConditionEditor,
  renderConditionEditor,
  renderEffectEditor,
} from '../../src/ui/runtime-editor/dsl-editors';

const ctx = {
  game: {
    registry: {
      areas: new Map(),
      resourceDisplays: new Map(),
      spots: new Map(),
      enhancements: new Map(),
    },
  },
  escapeHtml: (value: string) => value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character] ?? character)),
} as unknown as UIContext;

function mount(html: string): HTMLDivElement {
  const scope = document.createElement('div');
  scope.innerHTML = html;
  return scope;
}

function nestedGroups(depth: number): ConditionGroup {
  let group: ConditionGroup = {
    type: 'AND',
    conditions: [{ target: 'flag', key: 'leaf', comparator: '==', value: 1 }],
  };
  for (let index = 0; index < depth; index += 1) {
    group = { type: 'AND', conditions: [group] };
  }
  return group;
}

function deepExpression(depth: number): ValueExpression {
  let expression: ValueExpression = { type: 'const', value: 1 };
  for (let index = 0; index < depth; index += 1) {
    expression = { type: 'add', left: expression, right: { type: 'const', value: 1 } };
  }
  return expression;
}

describe('Runtime Editor DSL 安全边界', () => {
  test('未知条件节点 fail-closed，并在读回时保留原始节点', () => {
    const unknown = { type: 'FutureCondition', payload: { key: 'x' } };
    const group = { type: 'AND', conditions: [unknown] } as unknown as ConditionGroup;
    const scope = mount(renderConditionEditor(ctx, group));

    expect(scope.querySelector('[data-runtime-condition-item="opaque"]')).not.toBeNull();
    expect(scope.querySelector('[data-runtime-condition-unsupported]')?.textContent).toContain('Apply');
    expect(readConditionEditor(scope)).toEqual(group);
  });

  test('未知 target 不投影成通用可编辑字段，原子条件仍原样读回', () => {
    const condition = {
      target: 'futureTarget',
      key: 'future.key',
      comparator: '???',
      value: 7,
    } as unknown as Parameters<typeof renderAtomicConditionEditor>[1];
    const scope = mount(renderAtomicConditionEditor(ctx, condition));

    expect(scope.querySelector('[data-runtime-condition-unknown-target]')).not.toBeNull();
    expect(scope.querySelector('[data-runtime-condition-opaque-target]')).not.toBeNull();
    expect(scope.querySelector('[data-runtime-condition-editor-field="key"]')?.hasAttribute('readonly')).toBe(true);
    expect(readAtomicConditionEditor(scope)).toEqual(condition);
  });

  test('超出条件条数上限时不截断，并禁用新增入口', () => {
    const group: ConditionGroup = {
      type: 'AND',
      conditions: Array.from({ length: MAX_CONDITION_ITEMS + 2 }, (_, index) => ({
        target: 'flag' as const,
        key: `flag.${index}`,
        comparator: '==' as const,
        value: index,
      })),
    };
    const scope = mount(renderConditionEditor(ctx, group));

    expect(scope.querySelector('[data-runtime-condition-item-limit]')?.textContent).toContain('不会截断');
    expect(scope.querySelectorAll('[data-runtime-condition-item="condition"]')).toHaveLength(MAX_CONDITION_ITEMS + 2);
    expect(scope.querySelector('[data-runtime-condition-add="condition"]')?.hasAttribute('disabled')).toBe(true);
    expect(readConditionEditor(scope)).toEqual(group);
  });

  test('超出条件深度时保留边界节点，并保留完整原树', () => {
    const group = nestedGroups(MAX_CONDITION_DEPTH);
    const scope = mount(renderConditionEditor(ctx, group));

    expect(scope.querySelector('[data-runtime-condition-boundary]')).not.toBeNull();
    expect(readConditionEditor(scope)).toEqual(group);
  });

  test('动态 ValueExpression 只读保留，不折算成当前常量，摘要带效果路径', () => {
    const value: ValueExpression = {
      type: 'value',
      value: { type: 'value', source: 'res', params: { resource: 'base:resource:credit' } },
    };
    const effect = { op: 'addExtra', target: 'global.counter', value } satisfies Effect;
    const scope = mount(renderEffectEditor(ctx, [effect]));
    const valueInput = scope.querySelector<HTMLInputElement>('[data-runtime-effect-field="value"]');

    expect(valueInput?.hasAttribute('readonly')).toBe(true);
    expect(valueInput?.disabled).toBe(true);
    expect(scope.querySelector('[data-runtime-effect-summary]')?.textContent).toContain('addExtra');
    expect(scope.querySelector('[data-runtime-effect-summary]')?.textContent).toContain('global.counter');
    expect(scope.querySelector('[data-runtime-effect-row]')?.getAttribute('data-runtime-effect-path')).toBe('effects[0]');
    expect(readEffectEditor(scope)).toEqual([effect]);
  });

  test('已知 effect 操作仍尊重用户在下拉框中的新选择', () => {
    const effect = { op: 'addExtra', target: 'global.counter', value: 1 } satisfies Effect;
    const scope = mount(renderEffectEditor(ctx, [effect]));
    const op = scope.querySelector<HTMLSelectElement>('[data-runtime-effect-field="op"]');

    expect(op).not.toBeNull();
    op!.value = 'setResource';
    expect(readEffectEditor(scope)[0]?.op).toBe('setResource');
  });

  test('超出 ValueExpression 深度边界时不求值，保留原始表达式并给出定位提示', () => {
    const value = deepExpression(MAX_VALUE_EXPRESSION_DEPTH + 1);
    const effect = { op: 'addExtra', target: 'global.deep', value } satisfies Effect;
    const scope = mount(renderEffectEditor(ctx, [effect]));

    expect(scope.querySelector('[data-runtime-effect-value-boundary]')?.textContent).toContain(String(MAX_VALUE_EXPRESSION_DEPTH));
    expect(scope.querySelector('[data-runtime-effect-value-boundary]')?.textContent).toContain(String(MAX_VALUE_EXPRESSION_NODES));
    expect(readEffectEditor(scope)).toEqual([effect]);
  });

  test('未知 effect op 作为不支持节点保留，摘要包含 op、target 和路径', () => {
    const effect = {
      op: 'futureEffect',
      target: 'future.target',
      value: { payload: 'opaque' },
    } as unknown as Effect;
    const scope = mount(renderEffectEditor(ctx, [effect]));
    const summary = scope.querySelector('[data-runtime-effect-summary]')?.textContent ?? '';

    expect(scope.querySelector('[data-runtime-effect-unsupported]')).not.toBeNull();
    expect(summary).toContain('futureEffect');
    expect(summary).toContain('future.target');
    expect(summary).toContain('effects[0]');
    expect(readEffectEditor(scope)).toEqual([effect]);
  });

  test('Payment 动态金额沿用已有 fail-closed 解码路径，不静默折算为常量', () => {
    const amount: ValueExpression = {
      type: 'value',
      value: { type: 'value', source: 'res', params: { resource: 'base:resource:credit' } },
    };
    const decoded = decodeSpotContent({
      id: 'base:spot:dynamic-payment',
      purchaseOptions: [{ id: 'dynamic', costs: [{ type: 'resource', resourceId: 'base:resource:credit', amount }] }],
    } as unknown as SpotDef);

    expect(decoded.purchaseOptions).toEqual([]);
    expect(decoded.unsupportedPaymentOptionPaths).toEqual(['purchaseOptions[dynamic].costs[0].amount']);
  });
});
