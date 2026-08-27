import { describe, test, expect } from 'vitest';
import {
  resolveTheme,
  themeContributionFromColor,
  themeContributionFromGroup,
  themeContributionFromThemeDef,
} from '../../src/engine/system/color-system';
import type { ColorDef, ColorGroupDef, ColorId } from '../../src/engine/types';

const blue: ColorDef = { id: 'c-blue', name: '蓝', theme: { primary: '#3b82f6' } };
const pink: ColorDef = { id: 'c-pink', name: '粉', theme: { primary: '#ff5d8f' } };
const getColor = (id: ColorId): ColorDef | undefined =>
  ({ 'c-blue': blue, 'c-pink': pink } as Record<string, ColorDef>)[id];

describe('theme-tree 快速映射：Color/ColorGroup/ThemeDef → token 贡献', () => {
  test('themeContributionFromColor 与 resolveTheme 一致', () => {
    expect(themeContributionFromColor(blue)).toEqual(resolveTheme(blue));
  });

  test('themeContributionFromGroup 取 primary role slot 的 Color 整包 token', () => {
    const group: ColorGroupDef = {
      id: 'g1', name: 'g1', compositionType: 'gradient',
      slots: [
        { role: 'secondary', colorId: 'c-pink' },
        { role: 'primary', colorId: 'c-blue' },
      ],
    };
    const t = themeContributionFromGroup(group, getColor);
    expect(t['primary']).toBe('#3b82f6');
    expect(t['bg']).toBeTruthy(); // 整包 token（不只 primary）
  });

  test('themeContributionFromGroup 无 primary role 时回退首个 slot', () => {
    const group: ColorGroupDef = {
      id: 'g2', name: 'g2', compositionType: 'solid',
      slots: [{ role: 'shadow', colorId: 'c-pink' }],
    };
    const t = themeContributionFromGroup(group, getColor);
    expect(t['primary']).toBe('#ff5d8f');
  });

  test('themeContributionFromGroup 主色位 Color 未定义 → 空表', () => {
    const group: ColorGroupDef = {
      id: 'g3', name: 'g3', compositionType: 'solid',
      slots: [{ role: 'primary', colorId: 'missing' }],
    };
    expect(themeContributionFromGroup(group, getColor)).toEqual({});
  });

  test('themeContributionFromGroup 无 slot → 空表', () => {
    const group: ColorGroupDef = { id: 'g4', name: 'g4', compositionType: 'solid', slots: [] };
    expect(themeContributionFromGroup(group, getColor)).toEqual({});
  });

  test('themeContributionFromThemeDef colorId 打底 + tokens 覆盖', () => {
    const t = themeContributionFromThemeDef({ colorId: 'c-blue', tokens: { bg: '#101828' } }, getColor);
    expect(t['primary']).toBe('#3b82f6');
    expect(t['bg']).toBe('#101828');
  });

  test('themeContributionFromThemeDef 仅 tokens', () => {
    const t = themeContributionFromThemeDef({ tokens: { primary: '#abcdef', bg: '#000' } }, getColor);
    expect(t['primary']).toBe('#abcdef');
    expect(t['bg']).toBe('#000');
  });

  test('themeContributionFromThemeDef undefined → 空表', () => {
    expect(themeContributionFromThemeDef(undefined, getColor)).toEqual({});
  });
});
