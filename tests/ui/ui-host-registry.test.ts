import { describe, expect, it } from 'vitest';
import { UIHostRegistry, UI_HOST_REGISTRY } from '../../src/ui/ui-host-registry';
import { getPresentationTargets } from '../../src/ui/presentation-targets';

describe('UI Host Registry', () => {
  it('把服务声明自动暴露给主题目标选择器', () => {
    expect(getPresentationTargets().some(target => target.id === 'centerPanel.datapack')).toBe(true);
    expect(getPresentationTargets().some(target => target.id === 'centerPanel.saves.inspector')).toBe(true);
    expect(getPresentationTargets().some(target => target.id === 'centerPanel.contacts')).toBe(true);
    expect(getPresentationTargets().some(target => target.id === 'centerPanel.records')).toBe(true);
    expect(UI_HOST_REGISTRY.get('centerPanel.datapack')?.serviceId).toBe('datapack');
  });

  it('提供父级链并通过注册表校验层级', () => {
    expect(UI_HOST_REGISTRY.resolveParent('centerPanel.datapack.inspector').map(host => host.id)).toEqual([
      'centerPanel.datapack', 'centerPanel', 'shell', 'global',
    ]);
    expect(UI_HOST_REGISTRY.validate()).toEqual([]);
  });

  it('拒绝重复宿主并报告缺失父级与循环', () => {
    const registry = new UIHostRegistry([
      { id: 'a', label: 'A', level: 'cluster', kind: 'container', parent: 'missing' },
      { id: 'b', label: 'B', level: 'region', kind: 'container', parent: 'c' },
      { id: 'c', label: 'C', level: 'region', kind: 'container', parent: 'b' },
    ]);
    expect(registry.validate().map(issue => issue.code)).toEqual(['missing-parent', 'parent-cycle', 'parent-cycle']);
    expect(() => registry.registerHost({ id: 'a', label: 'again', level: 'cluster', kind: 'container' })).toThrow('UI Host ID 重复');
  });
});
