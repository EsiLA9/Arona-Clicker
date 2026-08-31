import { describe, test, expect } from 'vitest';
import {
  resolveTheme,
  themeContributionFromThemeDef,
} from '../../src/engine/system/color-system';
import type { ColorGroupDef, ColorGroupId } from '../../src/engine/types';

const blue: ColorGroupDef = { id: 'test:colorgroup:g-blue', name: '蓝', compositionType: 'solid', slots: [{ role: 'primary', color: '#3b82f6' }] };
const pink: ColorGroupDef = { id: 'g-pink', name: '粉', compositionType: 'solid', slots: [{ role: 'primary', color: '#ff5d8f' }] };
const getGroup = (id: ColorGroupId): ColorGroupDef | undefined =>
  ({ 'test:colorgroup:g-blue': blue, 'g-pink': pink } as Record<string, ColorGroupDef>)[id];

describe('theme-tree 快速映射：resolveTheme / themeContributionFromThemeDef → token 贡献', () => {
  test('resolveTheme 取主色位色值派生整包 token', () => {
    const t = resolveTheme(blue);
    expect(t['primary']).toBe('#3b82f6');
    expect(t['bg']).toBeTruthy(); // 整包 token（不只 primary）
  });

  test('resolveTheme 无 primary role 时回退首个 slot', () => {
    const group: ColorGroupDef = { id: 'g2', name: 'g2', compositionType: 'solid', slots: [{ role: 'shadow', color: '#ff5d8f' }] };
    const t = resolveTheme(group);
    expect(t['primary']).toBe('#ff5d8f');
  });

  test('resolveTheme 空 slot → 默认 primary', () => {
    const group: ColorGroupDef = { id: 'g3', name: 'g3', compositionType: 'solid', slots: [] };
    const t = resolveTheme(group);
    expect(t['primary']).toBeTruthy();
  });

  test('resolveTheme 组自身 theme 覆盖叠加在主色位之上（部分节点）', () => {
    const group: ColorGroupDef = {
      id: 'g5', name: 'g5', compositionType: 'solid',
      slots: [{ role: 'primary', color: '#3b82f6' }],
      theme: { panel: '#101828', playerBubble: '#0e3a4d' },
    };
    const t = resolveTheme(group);
    // 主色位派生值保留
    expect(t['primary']).toBe('#3b82f6');
    expect(t['bg']).toBeTruthy();
    // 组声明的部分节点覆盖生效
    expect(t['panel']).toBe('#101828');
    expect(t['playerBubble']).toBe('#0e3a4d');
  });

  test('themeContributionFromThemeDef groupId 打底 + tokens 覆盖', () => {
    const t = themeContributionFromThemeDef({ colorGroupId: 'test:colorgroup:g-blue', tokens: { bg: '#101828' } }, getGroup);
    expect(t['primary']).toBe('#3b82f6');
    expect(t['bg']).toBe('#101828');
  });

  test('themeContributionFromThemeDef 仅 tokens', () => {
    const t = themeContributionFromThemeDef({ tokens: { primary: '#abcdef', bg: '#000' } }, getGroup);
    expect(t['primary']).toBe('#abcdef');
    expect(t['bg']).toBe('#000');
  });

  test('themeContributionFromThemeDef undefined → 空表', () => {
    expect(themeContributionFromThemeDef(undefined, getGroup)).toEqual({});
  });
});