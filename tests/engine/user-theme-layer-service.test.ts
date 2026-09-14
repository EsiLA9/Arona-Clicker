import { describe, expect, test } from 'vitest';
import {
  addTargetLayer,
  clearTargetOverride,
  getTargetLayerOrder,
  getTargetLayers,
  hasLocalTarget,
  materializeTargetLayers,
  moveTargetLayer,
  normalizeUserThemeLayerIds,
  removeTargetLayer,
  setTargetLayerEnabled,
  updateTargetLayer,
  withPreviewLayer,
} from '../../src/arona-clicker/services/user-theme-layer-service';
import { validateUserThemeDraft } from '../../src/arona-clicker/services/user-theme-service';
import type { UserThemeDraft } from '../../src/arona-clicker/types/user-theme';

const layer = (id: string | undefined, value: string) => ({ id, kind: 'solid' as const, value });

describe('UserThemeLayerService', () => {
  test('匿名层进入 session 后获得稳定 ID，并同步 order', () => {
    const draft: UserThemeDraft = { version: 1, presentation: { hosts: [{ id: 'global', layers: [layer(undefined, '#111'), layer(undefined, '#222')], layerOrder: ['system-color-background'] }] } };
    normalizeUserThemeLayerIds(draft);
    const ids = draft.presentation!.hosts![0].layers!.map(item => item.id);
    expect(ids[0]).toBeTruthy();
    expect(new Set(ids).size).toBe(2);
    expect(draft.presentation?.hosts?.[0].layerOrder).toEqual(['system-color-background', ...ids]);
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
    expect(draft.presentation?.hosts).toEqual([]);
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
    expect(draft.presentation?.hosts?.[0].layers?.[0]).toMatchObject({ id: 'renamed', value: '#222', enabled: false });
    expect(removeTargetLayer(draft, target, 'renamed')).toBe(true);
    expect(draft.presentation?.hosts?.[0].layers).toEqual([]);
    expect(getTargetLayerOrder(draft, target)).toEqual(['system-color-background']);
    expect(removeTargetLayer(draft, target, 'system-color-background')).toBe(false);
  });

  test('清除本地覆盖移除 layers/order，无其他配置时连 host 记录一起删除', () => {
    const draft: UserThemeDraft = { version: 1, presentation: { hosts: [{ id: 'global', layers: [layer('a', '#111')], layerOrder: ['system-color-background', 'a'] }] } };
    expect(clearTargetOverride(draft, { kind: 'global' })).toBe(true);
    expect(draft.presentation?.hosts).toEqual([]);
  });

  test('预览层不写回会话 draft，并按目标追加或替换单层', () => {
    const draft: UserThemeDraft = { version: 1, presentation: { hosts: [{ id: 'global', layers: [layer('existing', '#111')], layerOrder: ['system-color-background', 'existing'] }] } };
    const target = { kind: 'global' as const };

    const appended = withPreviewLayer(draft, target, null, layer(undefined, '#222'));
    expect(getTargetLayers(appended, target)).toHaveLength(2);
    expect(getTargetLayerOrder(appended, target)[0]).toBe('system-color-background');
    expect(draft.presentation?.hosts?.[0].layers).toHaveLength(1);

    const replaced = withPreviewLayer(draft, target, 'existing', layer('existing', '#333'));
    expect(getTargetLayers(replaced, target).map(item => item.value)).toEqual(['#333']);
    expect(getTargetLayers(draft, target).map(item => item.value)).toEqual(['#111']);
  });

  test('预览替换已有图层时保留原有视觉顺序', () => {
    const draft: UserThemeDraft = { version: 1, presentation: { hosts: [{ id: 'global', layers: [layer('bottom', '#111'), layer('middle', '#222'), layer('top', '#333')], layerOrder: ['bottom', 'middle', 'top'] }] } };
    const next = withPreviewLayer(draft, { kind: 'global' }, 'middle', layer('middle', '#f00'));
    expect(getTargetLayerOrder(next, { kind: 'global' })).toEqual(['system-color-background', 'bottom', 'middle', 'top']);
  });

  test('预览替换继承图层时先带入完整有效层，不丢失原图层', () => {
    const draft: UserThemeDraft = { version: 1 };
    const target = { kind: 'host' as const, hostId: 'header.button', state: 'default' as const };
    const resolved = [layer('inherited-bottom', '#111'), layer('inherited-top', '#222')];
    const next = withPreviewLayer(draft, target, 'inherited-bottom', layer('inherited-bottom', '#f00'), resolved);
    expect(getTargetLayers(next, target).map(item => item.id)).toEqual(['inherited-bottom', 'inherited-top']);
    expect(getTargetLayers(next, target)[0].value).toBe('#f00');
  });

  test('首次预览补齐带入层的堆叠顺序，未编辑的层不会浮到被编辑层之上', () => {
    const draft: UserThemeDraft = { version: 1 };
    const target = { kind: 'global' as const };
    const resolved = [layer('atmosphere', '#111'), layer('glow', '#222')];

    const next = withPreviewLayer(draft, target, 'glow', layer('glow', '#f00'), resolved);

    expect(getTargetLayerOrder(next, target)).toEqual(['system-color-background', 'atmosphere', 'glow']);
    expect(getTargetLayers(next, target).map(item => item.id)).toEqual(['atmosphere', 'glow']);
    expect(getTargetLayers(next, target)[1].value).toBe('#f00');
    expect(getTargetLayerOrder(draft, target)).toEqual([]);
  });
});
