import { describe, expect, test } from 'vitest';
import {
  addTargetLayer,
  getTargetLayerOrder,
  getTargetLayers,
  hasLocalTarget,
  materializeTargetLayers,
  moveTargetLayer,
  normalizeUserThemeLayerIds,
  removeTargetLayer,
  setTargetLayerEnabled,
  updateTargetLayer,
} from '../../src/arona-clicker/services/user-theme-layer-service';
import { validateUserThemeDraft } from '../../src/arona-clicker/services/user-theme-service';
import type { UserThemeDraft } from '../../src/arona-clicker/types/user-theme';

const layer = (id: string | undefined, value: string) => ({ id, kind: 'solid' as const, value });

describe('UserThemeLayerService', () => {
  test('匿名层进入 session 后获得稳定 ID，并同步 order', () => {
    const draft: UserThemeDraft = { version: 1, background: [layer(undefined, '#111'), layer(undefined, '#222')], backgroundLayerOrder: ['system-color-background'] };
    normalizeUserThemeLayerIds(draft);
    const ids = draft.background!.map(item => item.id);
    expect(ids[0]).toBeTruthy();
    expect(new Set(ids).size).toBe(2);
    expect(draft.backgroundLayerOrder).toEqual(['system-color-background', ...ids]);
  });

  test('目标隔离、排序只改对应 order，稳定 ID 不随视觉顺序变化', () => {
    const draft: UserThemeDraft = { version: 1, presentation: { hosts: [{ id: 'header.button', layers: [layer('a', '#111'), layer('b', '#222')], layerOrder: ['a', 'b'] }] } };
    const target = { kind: 'host' as const, hostId: 'header.button', state: 'default' as const };
    expect(moveTargetLayer(draft, target, 'a', 'up')).toBe(true);
    expect(getTargetLayerOrder(draft, target)).toEqual(['b', 'a']);
    expect(getTargetLayers(draft, target).map(item => item.id)).toEqual(['a', 'b']);
    expect(getTargetLayers(draft, { kind: 'global' })).toHaveLength(0);
  });

  test('materialize 只在首次 mutation 建立当前目标本地层，读取不写 draft', () => {
    const draft: UserThemeDraft = { version: 1, presentation: { hosts: [] } };
    const target = { kind: 'host' as const, hostId: 'header.button', state: 'active' as const };
    expect(hasLocalTarget(draft, target)).toBe(false);
    const resolved = [layer('runtime', '#123456')];
    expect(materializeTargetLayers(draft, target, resolved).map(item => item.id)).toEqual(['runtime']);
    expect(hasLocalTarget(draft, target)).toBe(true);
    expect(draft.presentation?.hosts?.[0].states?.active?.layers).toEqual([resolved[0]]);
  });

  test('没有本地目标时归一化只读，不创建全局覆盖或排序数据', () => {
    const draft: UserThemeDraft = { version: 1, presentation: { hosts: [] } };
    normalizeUserThemeLayerIds(draft);
    expect(draft.background).toBeUndefined();
    expect(draft.backgroundLayerOrder).toBeUndefined();
  });

  test('校验器拒绝同一目标内的重复图层 ID', () => {
    const issues = validateUserThemeDraft({ version: 1, background: [layer('same', '#111'), layer('same', '#222')] });
    expect(issues).toContain('全局背景图层 ID 重复：same');
  });

  test('新增、改名、隐藏、删除均按 ID 操作并维护 order', () => {
    const draft: UserThemeDraft = { version: 1 };
    const target = { kind: 'global' as const };
    const id = addTargetLayer(draft, target, layer(undefined, '#111'));
    expect(updateTargetLayer(draft, target, id, layer('renamed', '#222'))).toBe(true);
    expect(setTargetLayerEnabled(draft, target, 'renamed', false)).toBe(true);
    expect(draft.background?.[0]).toMatchObject({ id: 'renamed', value: '#222', enabled: false });
    expect(removeTargetLayer(draft, target, 'renamed')).toBe(true);
    expect(draft.background).toEqual([]);
    expect(getTargetLayerOrder(draft, target)).toEqual(['system-color-background']);
    expect(removeTargetLayer(draft, target, 'system-color-background')).toBe(false);
  });
});
