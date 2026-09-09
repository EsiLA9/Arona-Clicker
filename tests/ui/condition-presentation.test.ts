import { describe, expect, it } from 'vitest';
import type { ConditionGroup } from '../../src/engine/types';
import { buildConditionView, renderConditionText, renderConditionTree } from '../../src/ui/condition-presentation';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

describe('condition presentation tree', () => {
  const resource = (key: string, value: number) => ({ target: 'resource' as const, key, comparator: '>=' as const, value });

  it('flattens only direct groups of the same mode and retains mixed branches', () => {
    const condition: ConditionGroup = { type: 'AND', conditions: [resource('a', 1), { type: 'AND', conditions: [resource('b', 2)] }, { type: 'OR', conditions: [resource('c', 3), resource('d', 4)] }] };
    const tree = buildConditionView(condition, { nameOf: (_, id) => id, style: 'ui' })!;
    expect(tree.kind).toBe('group');
    if (tree.kind === 'group') {
      expect(tree.children).toHaveLength(3);
      expect(tree.children[2]).toMatchObject({ kind: 'group', mode: 'OR' });
    }
  });

  it('uses evaluator results for leaves and groups without changing their evaluation path', () => {
    const condition: ConditionGroup = { type: 'OR', conditions: [resource('a', 1), resource('b', 2)] };
    const calls: unknown[] = [];
    const tree = buildConditionView(condition, { evaluate: node => { calls.push(node); return node === condition; } })!;
    expect(tree).toMatchObject({ kind: 'group', met: true });
    expect(calls).toHaveLength(3);
  });

  it('renders compact leaves, escaped nested HTML, and hides unknown details', () => {
    const tree = buildConditionView({ type: 'AND', conditions: [resource('<credit>', 1000), resource('gem', 2)] }, { nameOf: (_, id) => id, formatNumber: n => n.toLocaleString('en-US'), style: 'ui' })!;
    const html = renderConditionTree(tree, escapeHtml);
    expect(html).toContain('condition-group-head');
    expect(html).toContain('&lt;credit&gt; ≥ 1,000');
    expect(renderConditionTree(tree, escapeHtml, false)).toBe('<span class="condition-obfuscated" aria-label="条件未知">???</span>');
  });

  it('keeps the plain-text fallback ASCII-compatible', () => {
    expect(renderConditionText(resource('credit', 100), { nameOf: (_, id) => id, style: 'plain' })).toBe('credit >= 100');
  });
});
