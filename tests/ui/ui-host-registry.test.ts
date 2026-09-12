import { describe, expect, it } from 'vitest';
import { UIHostRegistry, UI_HOST_REGISTRY } from '../../src/ui/ui-host-registry';
import { getPresentationTargets, presentationTargetForLegacyRegion } from '../../src/ui/presentation-targets';

describe('UI Host Registry', () => {
  it('把服务声明自动暴露给主题目标选择器', () => {
    expect(getPresentationTargets().some(target => target.id === 'centerPanel.datapack')).toBe(true);
    expect(getPresentationTargets().some(target => target.id === 'centerPanel.saves.inspector')).toBe(true);
    expect(getPresentationTargets().some(target => target.id === 'centerPanel.contacts')).toBe(true);
    expect(getPresentationTargets().some(target => target.id === 'centerPanel.records')).toBe(true);
    expect(UI_HOST_REGISTRY.get('centerPanel.datapack')?.serviceId).toBe('datapack');
  });

  it('保留旧 region 到物理列 Host 的兼容解析', () => {
    expect(presentationTargetForLegacyRegion('leftPanel')?.id).toBe('leftPanel');
    expect(presentationTargetForLegacyRegion('centerPanel')?.id).toBe('centerPanel');
    expect(presentationTargetForLegacyRegion('rightPanel')?.id).toBe('rightPanel');
    expect(presentationTargetForLegacyRegion('missing')).toBeUndefined();
  });

  it('为功能工作区登记物理列 Host，并保持父级与服务归属稳定', () => {
    const expected = [
      ['shop', 'leftPanel.shop.feed', 'leftPanel'],
      ['shop', 'centerPanel.shop.catalog', 'centerPanel'],
      ['shop', 'rightPanel.shop.settlement', 'rightPanel'],
      ['character', 'leftPanel.character.contacts', 'leftPanel'],
      ['character', 'centerPanel.character.story', 'centerPanel'],
      ['character', 'rightPanel.character.progression', 'rightPanel'],
    ] as const;
    for (const [serviceId, hostId, parent] of expected) {
      expect(UI_HOST_REGISTRY.get(hostId)).toMatchObject({ serviceId, parent, level: 'region', kind: 'container' });
    }
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

  it('报告未注册的 Workspace owner', () => {
    const registry = new UIHostRegistry([
      { id: 'workspace-host', label: 'Workspace Host', level: 'region', kind: 'container', workspaceOwner: 'missing-workspace' },
    ]);
    expect(registry.validate()).toEqual([
      expect.objectContaining({ hostId: 'workspace-host', code: 'unknown-workspace-owner' }),
    ]);
  });
});
